# Implementation Plan: Ethio League — Feature Completion

## Overview

This plan completes the Ethio League platform across 9 phases. Tasks marked `[x]` are already implemented. Tasks marked `[ ]` still need to be built.

### What's already built (summary)
- Full Prisma schema with all models
- Auth API (login, set-password, refresh-token, validate-token)
- Organization API (request, approve/reject, CRUD) — **email not yet sent**
- Clubs API (list, PATCH, DELETE, approve/reject) — **League Admin workflow missing**
- Players API (list, create, PATCH, DELETE) — **no scope filtering**
- Coaches API (list, create, PATCH, DELETE) — **no scope filtering**
- Referees API (full CRUD, assign-league)
- Seasons API (list, create, PATCH, DELETE, clubs sub-route, assignments sub-route)
- Matches API (list, create, PATCH, DELETE, fixtures generation, lineups) — **lineups missing validation; no approve endpoint**
- Match Events API (list, create, PATCH, DELETE) — **10-min window exists; no score auto-increment; no scope check**
- Notifications API (list, mark-read, send)
- Users API (list, create, PATCH, DELETE, assign-role, roles)
- Dashboard shell (sidebar, topbar, AuthProvider, OrganizationProvider)
- Dashboard pages: overview (Super Admin + Org Admin, mock stats), organizations (fully wired), clubs (approve/reject wired), referees (fully wired), users (Org Admin MEA creation wired), leagues (fully wired), notifications (wired)
- Dashboard pages with mock data only: seasons, matches, players, coaches

---

## Tasks

---

## Phase 1: Foundation

- [x] 1. Create `lib/email.ts` — transactional email utility
  - Implement `sendPasswordSetupEmail(to: string, token: string): Promise<void>` using Nodemailer/SMTP (env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`)
  - Build the password setup URL as `${process.env.NEXT_PUBLIC_APP_URL}/set-password?token=<token>`
  - On transport failure, throw an error so callers can catch and log it
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7_

- [x] 2. Create `lib/audit.ts` — audit log helper
  - Implement `logAudit({ userId, actionType, targetId, targetType, description }): Promise<void>`
  - Write to the `AuditLog` Prisma model; swallow errors silently so audit failures never break the main request
  - _Requirements: 13.1, 13.2_

- [x] 3. Create `lib/scope-guard.ts` — centralised scope enforcement
  - Implement `assertOrgScope(auth, organizationId)`, `assertSeasonScope(auth, seasonId)`, `assertClubScope(auth, clubId)`, `assertMEASeasonScope(auth, seasonId)`
  - Each returns `true` for `super_admin`; otherwise checks the relevant `UserRoleScope` entry; returns `false` on mismatch
  - Add `forbidden()` helper to `lib/api-helpers.ts` that returns `NextResponse.json({ error: 'Forbidden' }, { status: 403 })`
  - _Requirements: 15.1–15.6_

- [x] 4. Create `lib/standings.ts` — pure standings computation
  - Define `StandingRow` interface: `{ clubId, clubName, logoUrl, played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points }`
  - Implement `computeStandings(matches: MatchResult[], pointsWin: number, pointsDraw: number): StandingRow[]`
  - Sort output: points DESC → goalDifference DESC → goalsFor DESC
  - No Prisma calls; accepts plain match result objects
  - _Requirements: 11.1, 11.2_

- [x] 5. Extend `lib/auth-context.tsx` with new role helpers
  - Add `isLeagueAdmin(): boolean`, `isClubAdmin(): boolean`, `isMEA(): boolean`
  - Add `getSeasonId(): string | null` (reads from `league_admin` or `match_event_admin` scope)
  - Add `getClubId(): string | null` (reads from `club_admin` scope)
  - _Requirements: 3.4, 6.2, 8.1, 9.6_

---

## Phase 2: API Completions and Scope Hardening

- [x] 6. Harden `POST /api/organizations/approve` — add email sending + audit log
  - After generating `passwordResetToken`, call `sendPasswordSetupEmail()`; on failure call `logAudit({ actionType: 'email_failure' })` and return 500
  - Omit `passwordResetToken` from the response body when `NODE_ENV === 'production'`
  - Call `logAudit({ actionType: 'organization_approved' })` on success
  - Note: token generation and user activation already exist — only email + audit are missing
  - _Requirements: 1.1, 1.5, 13.1, 17.3_

- [x] 7. Extend `POST /api/clubs` — League Admin club creation workflow
  - Allow `league_admin` role in addition to existing roles
  - When caller is `league_admin`, accept `{ name, adminFullName, adminEmail, adminPhone, seasonId }`
  - Call `assertSeasonScope(auth, seasonId)` — return 403 on failure
  - Check email uniqueness — return 400 with descriptive error if duplicate
  - In a Prisma transaction: create `Club` (status: `pending`), create `User` (status: `inactive`, `passwordResetToken`), create `UserRoleScope` (club_admin scoped to new club), create `SeasonClub` (status: `pending`)
  - Call `sendPasswordSetupEmail()`; on failure log audit and return 500
  - Call `logAudit({ actionType: 'club_created' })` and create notification for org admin
  - Return `{ club, user: { id, email } }` — never return the raw token
  - _Requirements: 2.1–2.5, 1.4, 18.3_

- [x] 8. Add `POST /api/auth/resend-setup-email` — resend password setup
  - Accept `{ email }` in body; require `super_admin`, `organization_admin`, or `league_admin`
  - Find user by email; regenerate `passwordResetToken` and `passwordResetExpires` (now + 1h)
  - Call `sendPasswordSetupEmail()`; log audit; return success
  - _Requirements: 1.6_

- [x] 9. Add `POST /api/matches/[id]/approve` — MEA match approval
  - Call `assertMEASeasonScope(auth, match.seasonId)` — 403 on failure
  - Validate `match.matchDate - now <= 24 hours` — 400 with descriptive error if too early
  - Validate `match.status` is `scheduled` or `upcoming` — 400 otherwise
  - Update `match.status` to `approved`; call `logAudit({ actionType: 'match_approved' })`
  - _Requirements: 8.2, 8.3, 8.4, 8.5_

- [x] 10. Add season player assignment endpoints
  - `GET /api/seasons/[id]/players` — list `SeasonClubPlayer` records for the season; enforce `assertSeasonScope`
  - `POST /api/seasons/[id]/players` — assign player: validate club's `SeasonClub.status === 'active'`; check no duplicate; create `SeasonClubPlayer`; enforce `assertSeasonScope`
  - `DELETE /api/seasons/[id]/players/[scpId]` — remove assignment; enforce `assertSeasonScope`
  - _Requirements: 6.1–6.5_

- [x] 11. Add standings and analytics endpoints
  - `GET /api/seasons/[id]/standings` — fetch completed matches, call `computeStandings()`, return `StandingRow[]`; enforce `assertSeasonScope`
  - `GET /api/seasons/[id]/top-scorers` — aggregate goal/penalty_goal counts per player; return sorted list
  - `GET /api/seasons/[id]/discipline` — aggregate yellow/red card counts per player and per club
  - _Requirements: 11.1–11.6_

- [x] 12. Harden `POST /api/matches/[id]/lineups` — full validation
  - Call `assertClubScope(auth, clubId)` — 403 on failure
  - Validate club is `homeClubId` or `awayClubId` of the match — 400 if not participant
  - Validate exactly 11 starters (`lineupType === 'starting'`) — 400 otherwise
  - Validate exactly 1 captain (`isCaptain === true`) — 400 otherwise
  - Validate no player appears in both starting and substitute lists — 400 on overlap
  - Validate all `seasonClubPlayerIds` belong to the club's `SeasonClub` for the match's season — 400 on violation
  - On success: notify league admin, call `logAudit({ actionType: 'lineup_submitted' })`
  - Return structured error body `{ error, details: string[] }` on validation failure
  - Note: basic upsert logic already exists — only validation + notifications are missing
  - _Requirements: 10.1–10.7, 18.5_

- [x] 13. Harden `POST /api/match-events` — score auto-increment and scope check
  - Call `assertMEASeasonScope(auth, match.seasonId)` — 403 on failure (allow `league_admin` and `super_admin` to bypass)
  - After creating event: if `eventType.name` is `goal` or `penalty_goal`, increment the scoring club's score on the match record
  - If `eventType.name` is `own_goal`, increment the opponent's score
  - If `eventType.name` is `substitution`, require `relatedPlayerId` — 400 if missing
  - Notify league admin; call `logAudit({ actionType: 'match_event_created' })`
  - Note: basic event creation and live-match check already exist — score increment + scope + audit are missing
  - _Requirements: 9.1–9.7, 18.6_

- [x] 14. Harden `PATCH /api/match-events/[id]` — add MEA season scope check + audit
  - Call `assertMEASeasonScope(auth, match.seasonId)` for `match_event_admin` callers
  - Note: 10-minute window already enforced — only scope check and audit log are missing
  - Call `logAudit({ actionType: 'match_event_edited' })`
  - _Requirements: 9.4, 9.5, 7.6_

- [x] 15. Add profile API endpoints
  - `GET /api/users/me` — return `{ id, fullName, email, phone, roles }` for the authenticated user; never return `passwordHash`
  - `PATCH /api/users/me` — allow updating `fullName` and `phone`; call `logAudit({ actionType: 'profile_updated' })`
  - `POST /api/users/me/change-password` — require `{ currentPassword, newPassword, confirmPassword }`; verify current password with bcrypt; validate new password >= 8 chars; update hash; call `logAudit`
  - _Requirements: 12.1–12.6_

- [x] 16. Add Super Admin system config endpoints
  - `POST /api/league-types`, `PATCH /api/league-types/[id]` — require `super_admin`; create/edit `LeagueType`
  - Extend `POST /api/match-events/event-types`, add `PATCH /api/match-events/event-types/[id]` — require `super_admin`
  - Extend `POST /api/players/positions`, add `PATCH /api/players/positions/[id]` — require `super_admin`
  - For delete operations: check for referencing records; return 400 with descriptive error if referenced
  - _Requirements: 14.1–14.5_

- [x] 17. Add `GET /api/audit-logs` — Super Admin audit log
  - Require `super_admin`; support query params: `actionType`, `fromDate`, `toDate`, `userId`
  - Return paginated results ordered by `timestamp DESC`
  - _Requirements: 13.3, 13.4, 13.5_

- [x] 18. Apply scope filters to existing GET list endpoints
  - `GET /api/matches` — filter by `seasonId` for `league_admin`; filter by assigned season IDs for `match_event_admin`
  - `GET /api/players` — filter to club's players for `club_admin`; filter to org's clubs for `organization_admin`
  - `GET /api/coaches` — same scoping pattern as players
  - `GET /api/seasons` — filter to org's seasons for `organization_admin`; filter to assigned season for `league_admin`
  - `GET /api/clubs` — filter to org's clubs for `organization_admin`; filter to assigned season's clubs for `league_admin`
  - _Requirements: 15.1–15.6_

- [x] 19. Add `GET /api/dashboard/stats` — scoped aggregate stats endpoint
  - For `super_admin`: return counts of orgs, clubs, players, users, seasons, matches
  - For `organization_admin`: return counts of leagues, clubs (total + pending), referees, MEAs, upcoming matches scoped to org
  - For `league_admin`: return counts of clubs, matches by status, top standings preview scoped to season
  - For `club_admin`: return counts of players, coaches, upcoming fixtures scoped to club
  - _Requirements: 16.6_

---

## Phase 3: Club Admin Features

- [x] 20. Add Club Admin and League Admin and MEA overview branches to `app/dashboard/page.tsx`
  - Add `isClubAdmin()` branch rendering `<ClubAdminOverview />` — club profile summary, player/coach counts, upcoming fixtures
  - Add `isLeagueAdmin()` branch rendering `<LeagueAdminOverview />` — season stats, standings preview (top 3), upcoming fixtures
  - Add `isMEA()` branch rendering `<MEAOverview />` — matches needing approval within 24h, live matches
  - All three fetch from real API via `GET /api/dashboard/stats`
  - Show `ErrorState` if any fetch fails
  - _Requirements: 3.1, 8.1, 11.5_

- [x] 21. Create `app/dashboard/clubs/[id]/page.tsx` — Club Admin club profile editor
  - Fetch club by `getClubId()` from auth context via `GET /api/clubs/[id]`
  - Display: name, logo URL, stadium, description, contact info, current status badge
  - Allow editing name, logoUrl, stadiumId, description, website, city, country via `PATCH /api/clubs/[id]`
  - Validate that `name` is not empty before submitting
  - Disable lineup submission link/button while `club.status === 'pending'`
  - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [x] 22. Wire `app/dashboard/players/page.tsx` for Club Admin — create/edit/delete with real API
  - Replace mock `handleSubmit` with real `POST /api/players` and `PATCH /api/players/[id]` calls
  - Replace mock `handleDelete` with real `DELETE /api/players/[id]` call
  - On create: set `clubId` from `getClubId()`; default `status` to `active`
  - Before saving: warn if a player with the same `firstName + lastName + dateOfBirth` already exists in the club (client-side check)
  - Remove `fallbackData: mockPlayers`; show `ErrorState` on SWR fetch failure
  - _Requirements: 4.1–4.6, 16.3_

- [x] 23. Wire `app/dashboard/coaches/page.tsx` for Club Admin — create/edit/deactivate with real API
  - Replace mock handlers with real `POST /api/coaches` and `PATCH /api/coaches/[id]` calls
  - Add coaching role field to the form: `head_coach`, `assistant_coach`, `goalkeeping_coach`, `fitness_coach`, `medical_staff`
  - Add deactivate action (PATCH status to `inactive`) in the actions dropdown
  - Remove `fallbackData: mockCoaches`; show `ErrorState` on SWR fetch failure
  - _Requirements: 5.1–5.4, 16.4_

- [x] 24. Create `app/dashboard/lineups/page.tsx` — lineup submission UI
  - List upcoming matches for the club (fetched from `GET /api/matches?clubId=<clubId>`)
  - For each match, show a "Submit Lineup" button that opens a dialog
  - Dialog: select 11 starters with position assignments, select substitutes, designate captain — all from the club's `SeasonClubPlayer` list fetched via `GET /api/seasons/[id]/players`
  - On submit: call `POST /api/matches/[id]/lineups`; display structured validation errors if returned
  - Disable submission if `club.status === 'pending'`
  - _Requirements: 10.1–10.7_

---

## Phase 4: League Admin Features

- [x] 25. Create `app/dashboard/standings/page.tsx` — standings and analytics
  - Standings tab: fetch `GET /api/seasons/[seasonId]/standings`; render full table with columns: rank, club, P, W, D, L, GF, GA, GD, Pts
  - Top Scorers tab: fetch `GET /api/seasons/[seasonId]/top-scorers`; render player name, club, goals
  - Discipline tab: fetch `GET /api/seasons/[seasonId]/discipline`; render yellow/red cards per player and per club
  - Season Summary tab: total matches played, total goals, average goals per match
  - Show `ErrorState` on any fetch failure
  - _Requirements: 11.1–11.6_

- [x] 26. Create `app/dashboard/seasons/[id]/players/page.tsx` — season player assignment
  - Fetch all clubs in the season via `GET /api/seasons/[id]/clubs`
  - For each club, list its players and their assignment status
  - Allow League Admin to assign a player (jersey number + position) via `POST /api/seasons/[id]/players`
  - Allow removing an assignment via `DELETE /api/seasons/[id]/players/[scpId]`
  - Show error if player's club `SeasonClub.status` is not `active`
  - _Requirements: 6.1–6.5_

- [x] 27. Wire fixture generation and match management for League Admin in `app/dashboard/matches/page.tsx`
  - Add "Generate Fixtures" button visible to `league_admin`; calls `POST /api/matches/fixtures`
  - If fixtures already exist, show a confirm dialog warning about deletion before regenerating
  - Add "Assign Officials" action per match row: opens a dialog to assign referee, 2 assistants, fourth official, MEA from season-assigned officials
  - Add "Edit Match" action: allow editing `matchDate`, `matchTime`, `stadiumId` via `PATCH /api/matches/[id]`
  - Wire "Start Match" to `PATCH /api/matches/[id]` with `{ status: 'live' }`
  - Wire "End Match" to `PATCH /api/matches/[id]` with `{ status: 'completed' }`
  - Remove `fallbackData: mockMatches`; show `ErrorState` on SWR error
  - _Requirements: 7.1–7.7, 16.2_

---

## Phase 5: Match Event Admin Features

- [x] 28. Create `app/dashboard/matches/[id]/page.tsx` — match detail and live event logging
  - Fetch match details, lineups, and events via `GET /api/matches/[id]`, `GET /api/matches/[id]/lineups`, `GET /api/match-events?matchId=[id]`
  - Show match header: teams, score, status, date, stadium
  - Show lineup panels for both clubs
  - Show chronological event log
  - If `match.status === 'scheduled'` or `upcoming` and within 24h: show "Approve Match" button for MEA; calls `POST /api/matches/[id]/approve`
  - If `match.status === 'live'`: show event logging panel — form with event type, player, club, minute, optional fields; calls `POST /api/match-events`
  - Show edit button on each event (within 10-minute window for MEA, always for league_admin); calls `PATCH /api/match-events/[id]`
  - Show `ErrorState` on fetch failure
  - _Requirements: 8.1–8.5, 9.1–9.7_

---

## Phase 6: Super Admin Features

- [x] 29. Create `app/dashboard/audit-log/page.tsx` — audit log viewer
  - Fetch `GET /api/audit-logs` with filter params: `actionType`, `fromDate`, `toDate`, `userId`
  - Render filterable table: timestamp, acting user, action type, target type/ID, description
  - Redirect non-super-admin users to `/dashboard`
  - Show `ErrorState` on fetch failure
  - _Requirements: 13.1–13.5_

- [x] 30. Create `app/dashboard/system-config/page.tsx` — system configuration
  - Three tabs: League Types, Event Types, Positions
  - Each tab: list existing records, allow create and edit via inline dialogs
  - Delete button: calls DELETE endpoint; on 400 (referenced record), show descriptive error toast
  - Redirect non-super-admin users to `/dashboard`
  - _Requirements: 14.1–14.5_

- [x] 31. Update sidebar navigation in `components/dashboard/sidebar.tsx`
  - Add nav items conditionally by role:
    - "Standings" → visible to `league_admin`
    - "Lineups" → visible to `club_admin`
    - "Audit Log" → visible to `super_admin`
    - "System Config" → visible to `super_admin`
    - "Profile" → visible to all roles
  - _Requirements: 3.1, 11.1, 13.4, 14.4_

---

## Phase 7: Real API Wiring for Remaining Mock-Data Pages

- [x] 32. Create `components/dashboard/error-state.tsx` — shared error component
  - Render a card with an error icon, a message prop, and an optional "Retry" button
  - Used by all dashboard pages on SWR fetch failure
  - _Requirements: 16.6_

- [x] 33. Wire `app/dashboard/seasons/page.tsx` to real API
  - Replace mock `handleSubmit` with `POST /api/seasons` (create) and `PATCH /api/seasons/[id]` (edit)
  - Replace mock `handleDelete` with `DELETE /api/seasons/[id]`
  - Remove `fallbackData: mockSeasons`; show `ErrorState` on SWR error
  - _Requirements: 16.1_

- [x] 34. Wire `app/dashboard/organizations/page.tsx` — remove mock fallback
  - Organizations page is already wired to real API for approve/reject
  - Remove any remaining mock data fallbacks; show `ErrorState` on SWR error
  - Wire `GET /api/dashboard/stats` for the Super Admin overview stats
  - _Requirements: 16.5, 17.1–17.6_

---

## Phase 8: Profile Management

- [x] 35. Create `app/dashboard/profile/page.tsx` — profile view and edit
  - Fetch `GET /api/users/me`; display full name, email, phone, role(s), and scope info (org name, season name, or club name as applicable)
  - Allow editing `fullName` and `phone` via `PATCH /api/users/me`
  - Password change section: fields for current password, new password, confirm new password; calls `POST /api/users/me/change-password`
  - Show inline validation: new password must be >= 8 chars; confirm must match
  - Show `ErrorState` on fetch failure
  - _Requirements: 12.1–12.6_

- [x] 36. Checkpoint — verify all pages load without errors and all wired actions work end-to-end

---

## Phase 9: Property-Based Tests

- [x] 37. Set up fast-check test infrastructure
  - Install `fast-check` as a dev dependency
  - Create `__tests__/` directory; configure Jest or Vitest to pick it up
  - Add a shared test helper for seeding minimal Prisma test data (use a test database or mock Prisma client)
  - _Requirements: design section "Property-Based Testing"_

- [x] 38. Write property tests for `lib/standings.ts`
  - [x] 38.1 Property 10: Standings computation correctness
    - Generate random sets of completed matches with arbitrary scores; assert: every participating club appears, `played = won + drawn + lost`, `goalDifference = goalsFor - goalsAgainst`, `points = won×pointsWin + drawn×pointsDraw`, rows sorted by points DESC then GD DESC
    - Tag: `// Feature: ethio-league, Property 10: Standings computation correctness`
    - **Validates: Requirements 11.1, 11.2**

- [x] 39. Write property tests for `lib/scope-guard.ts`
  - [x] 39.1 Property 11: Scope enforcement — 403 on out-of-scope access
    - Generate random scoped `AuthUser` objects and resource IDs from different scopes; assert scope guards return `false` for mismatched IDs and `true` for matching IDs; assert `super_admin` always returns `true`
    - Tag: `// Feature: ethio-league, Property 11: Scope enforcement — 403 on out-of-scope access`
    - **Validates: Requirements 15.1–15.6**

- [x] 40. Write property tests for password token and user creation
  - [x] 40.1 Property 1: Password token is set on user approval
    - Tag: `// Feature: ethio-league, Property 1: Password token is set on user approval`
    - **Validates: Requirements 1.1–1.4**
  - [x] 40.2 Property 2: Club creation atomicity
    - Tag: `// Feature: ethio-league, Property 2: Club creation atomicity`
    - **Validates: Requirements 2.1, 2.4**
  - [x] 40.3 Property 3: Duplicate email rejection
    - Tag: `// Feature: ethio-league, Property 3: Duplicate email rejection`
    - **Validates: Requirements 2.5**

- [-] 41. Write property tests for season player assignment
  - [ ] 41.1 Property 4: Season player assignment round trip
    - Tag: `// Feature: ethio-league, Property 4: Season player assignment round trip`
    - **Validates: Requirements 6.1, 6.3**
  - [ ] 41.2 Property 5: Only approved-club players can be season-assigned
    - Tag: `// Feature: ethio-league, Property 5: Only approved-club players can be season-assigned`
    - **Validates: Requirements 6.4**

- [ ] 42. Write property tests for match approval and event logging
  - [ ] 42.1 Property 6: Match approval 24-hour window
    - Tag: `// Feature: ethio-league, Property 6: Match approval 24-hour window`
    - **Validates: Requirements 8.2, 8.4**
  - [ ] 42.2 Property 7: Goal event increments score
    - Tag: `// Feature: ethio-league, Property 7: Goal event increments score`
    - **Validates: Requirements 9.3**
  - [ ] 42.3 Property 8: MEA event edit 10-minute window
    - Tag: `// Feature: ethio-league, Property 8: MEA event edit 10-minute window`
    - **Validates: Requirements 9.4, 9.5**

- [ ] 43. Write property tests for lineup validation
  - [ ] 43.1 Property 9: Lineup validity invariants
    - Generate random lineup arrays with varying starter counts, captain counts, overlapping players, and out-of-scope player IDs; assert all invalid combinations are rejected and valid ones are accepted
    - Tag: `// Feature: ethio-league, Property 9: Lineup validity invariants`
    - **Validates: Requirements 10.1–10.4**

- [ ] 44. Write property tests for password change and notification isolation
  - [ ] 44.1 Property 12: Password change validation
    - Tag: `// Feature: ethio-league, Property 12: Password change validation`
    - **Validates: Requirements 12.3–12.5**
  - [ ] 44.2 Property 13: Notification isolation
    - Tag: `// Feature: ethio-league, Property 13: Notification isolation`
    - **Validates: Requirements 18.8**
  - [ ] 44.3 Property 14: Lineup submission triggers league admin notification
    - Tag: `// Feature: ethio-league, Property 14: Lineup submission triggers league admin notification`
    - **Validates: Requirements 18.5**

- [ ] 45. Final checkpoint — ensure all tests pass

---

## Notes

- All API routes use the existing `requireAuth` / `isAuthError` pattern from `lib/auth.ts`
- All scope checks use `lib/scope-guard.ts` helpers added in Phase 1
- `lib/standings.ts` is a pure function — property tests for it require no database
- The organizations page, referees page, users page (Org Admin), leagues page, clubs page (approve/reject), and notifications page are already fully wired — no rework needed
