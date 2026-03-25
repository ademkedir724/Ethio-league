# Design Document: Ethio League — Feature Completion

## Overview

Ethio League is a role-based football league management platform built with Next.js 14 App Router, Prisma ORM (PostgreSQL), and TypeScript. A significant portion of the system is already implemented. This design covers the remaining work needed to complete the platform per the 18 requirements.

The existing system provides:
- Full Prisma schema with all models (UUIDs throughout)
- JWT auth with scoped roles via `UserRoleScope` (`lib/auth.ts`)
- Dashboard shell with sidebar, topbar, AuthProvider, OrganizationProvider
- API routes for: auth, organizations, clubs, leagues, seasons, matches, match-events, lineups, fixtures, referees, players, coaches, users, notifications, assignments
- Dashboard pages for: overview, clubs, matches, players, coaches, referees, seasons, leagues, users, notifications

What remains: email delivery, club creation workflow, Club Admin dashboard, League Admin scoped views, MEA live event UI, lineup validation, match approval, standings/analytics, profile, audit log, system config, scope enforcement hardening, and real API wiring for mock-data pages.

---

## Architecture

### Request Flow

```
Browser → Next.js App Router
  ├── (auth)/ — public pages (login, set-password, request-org)
  └── dashboard/ — protected shell (DashboardLayout)
        ├── AuthProvider (JWT from localStorage)
        ├── OrganizationProvider (org context for org admins)
        └── pages → useSWR → /api/** → requireAuth → Prisma → PostgreSQL
```

### Role Hierarchy and Scope

| Role | Scope Field | Key Capabilities |
|---|---|---|
| super_admin | none | Full platform access, audit log, system config |
| organization_admin | organizationId | Manage leagues, clubs, referees, MEAs within org |
| league_admin | seasonId | Manage fixtures, clubs, players, standings within season |
| club_admin | clubId | Manage club profile, players, coaches, lineups |
| match_event_admin | seasonId | Approve matches, log live events |

Scope is stored in `UserRoleScope` and loaded into the JWT payload on every request via `authenticate()` in `lib/auth.ts`. The existing `hasRole`, `hasOrgRole`, `hasSeasonRole`, `hasClubRole` helpers are used for enforcement.


### New Utility Modules

**`lib/scope-guard.ts`** — centralizes scope enforcement logic:
```typescript
export function assertOrgScope(auth: AuthUser, organizationId: string): boolean
export function assertSeasonScope(auth: AuthUser, seasonId: string): boolean
export function assertClubScope(auth: AuthUser, clubId: string): boolean
export function assertMEASeasonScope(auth: AuthUser, seasonId: string): boolean
```
Each returns `true` if the user is super_admin OR has the relevant scoped role. API routes call these and return 403 on failure.

**`lib/email.ts`** — wraps a transactional email provider (Resend or Nodemailer/SMTP):
```typescript
export async function sendPasswordSetupEmail(to: string, token: string): Promise<void>
```
Called after token generation in org approval, user creation, and club creation routes.

**`lib/audit.ts`** — single helper called after successful mutations:
```typescript
export async function logAudit(params: {
  userId: string; actionType: string
  targetId: string; targetType: string; description: string
}): Promise<void>
```

**`lib/standings.ts`** — pure function, no DB side effects:
```typescript
export interface StandingRow {
  clubId: string; clubName: string; logoUrl: string | null
  played: number; won: number; drawn: number; lost: number
  goalsFor: number; goalsAgainst: number; goalDifference: number; points: number
}
export function computeStandings(
  matches: MatchResult[], pointsWin: number, pointsDraw: number
): StandingRow[]
```

---

## Components and Interfaces

### Dashboard Overview Branches

The existing `app/dashboard/page.tsx` branches on `isOrgAdmin()`. It needs additional branches:

- `isClubAdmin()` → `<ClubAdminOverview />` — club profile summary, player/coach counts, upcoming fixtures
- `isLeagueAdmin()` → `<LeagueAdminOverview />` — season stats, standings preview, upcoming fixtures
- `isMEA()` → `<MEAOverview />` — matches needing approval, live match controls

### New Pages

| Route | Role | Description |
|---|---|---|
| `app/dashboard/standings/page.tsx` | league_admin | Standings table, top scorers, discipline stats, season summary |
| `app/dashboard/matches/[id]/page.tsx` | MEA, league_admin | Match detail, live event logging panel, approval button |
| `app/dashboard/lineups/page.tsx` | club_admin | Lineup submission per match |
| `app/dashboard/profile/page.tsx` | all | Profile view/edit, password change |
| `app/dashboard/audit-log/page.tsx` | super_admin | Filterable audit log table |
| `app/dashboard/system-config/page.tsx` | super_admin | Tabs: LeagueTypes, EventTypes, Positions |

### Auth Context Extensions

`lib/auth-context.tsx` needs new helpers mirroring the existing `isOrgAdmin()` pattern:
```typescript
isLeagueAdmin(): boolean
isClubAdmin(): boolean
isMEA(): boolean
getSeasonId(): string | null   // from league_admin or MEA scope
getClubId(): string | null     // from club_admin scope
```

### Sidebar Navigation Updates

New nav items added conditionally by role in `DashboardSidebar`:

| Nav Item | Visible To |
|---|---|
| Standings | league_admin |
| Lineups | club_admin |
| Audit Log | super_admin |
| System Config | super_admin |
| Profile | all roles |

---

## Data Models

All models are defined in `prisma/schema.prisma`. No schema migrations are required for the core feature set. Key relationships:

```
Season (1) ──< SeasonClub (N) ──< SeasonClubPlayer (N) ── Player
                                └─< SeasonClubCoach (N) ── Coach
Season (1) ──< Match (N) ──< MatchEvent (N)
                          ──< MatchLineup (N) ── SeasonClubPlayer
                          ──< MatchReferee (N) ── Referee
UserRoleScope ── User + Role + (org? | season? | club?)
AuditLog ── User
```

One optional schema addition: `approvedByUserId String? @db.Uuid` on `Match` to record the MEA who approved. This is a non-breaking additive migration. If deferred, the audit log `details` field captures this information.

---

## API Design

### Modified Endpoints

**`POST /api/organizations/approve`** — add `sendPasswordSetupEmail()` call; omit token from response when `NODE_ENV === 'production'`.

**`POST /api/clubs`** — extend to support League Admin workflow:
- Add `league_admin` to allowed roles
- When called by league_admin, accept `{ name, adminFullName, adminEmail, adminPhone, seasonId }`
- Auto-create Club Admin user (status: inactive), assign club_admin role scope, create pending SeasonClub, send setup email

**`POST /api/matches/:id/lineups`** — add full validation (see Lineup Submission Flow below).

**`POST /api/match-events`** — add score auto-increment for goal events; add MEA season scope check.

**`PATCH /api/match-events/:id`** — already has 10-minute window logic; add season scope check for MEA.

### New Endpoints

```
POST   /api/auth/resend-setup-email          — regenerate token, resend email
GET    /api/seasons/:id/players              — list SeasonClubPlayers for season
POST   /api/seasons/:id/players              — assign player to season
DELETE /api/seasons/:id/players/:scpId       — remove player from season
POST   /api/matches/:id/approve              — MEA approves match (24h window)
GET    /api/seasons/:id/standings            — computed standings
GET    /api/seasons/:id/top-scorers          — aggregated goal stats
GET    /api/seasons/:id/discipline           — aggregated card stats
GET    /api/users/me                         — current user profile + scopes
PATCH  /api/users/me                         — update fullName, phone
POST   /api/users/me/change-password         — validate current pw, set new pw
GET    /api/audit-logs                       — super_admin only, filterable
GET    /api/league-types                     — list (already exists via seasons)
POST   /api/league-types                     — create (super_admin)
PATCH  /api/league-types/:id                 — edit (super_admin)
POST   /api/event-types                      — create (super_admin)
PATCH  /api/event-types/:id                  — edit (super_admin)
POST   /api/players/positions                — create (super_admin)
PATCH  /api/players/positions/:id            — edit (super_admin)
```

---

## Data Flow

### Email Sending Flow

```
Admin action (approve org / create user / create club)
  → API route: crypto.randomBytes(32) → token
  → prisma.user.update({ passwordResetToken: token, passwordResetExpires: now+1h })
  → lib/email.ts sendPasswordSetupEmail(user.email, token)
      → on failure: logAudit({ actionType: 'email_failure' }), return error to caller
  → Response: omit passwordResetToken field in production
```

### Club Creation Flow (League Admin)

```
POST /api/clubs { name, adminEmail, adminFullName, adminPhone, seasonId }
  → assertSeasonScope(auth, seasonId) — 403 if not scoped
  → prisma.club.create({ status: 'pending' })
  → check email uniqueness → 400 if duplicate
  → prisma.user.create({ status: 'inactive', passwordResetToken })
  → prisma.userRoleScope.create({ roleId: club_admin, clubId })
  → prisma.seasonClub.create({ seasonId, clubId, status: 'pending' })
  → sendPasswordSetupEmail(adminEmail, token)
  → logAudit('club_created')
  → notify org admin
  → return { club, user: { id, email } }  — no token in response
```

### Lineup Submission Flow

```
POST /api/matches/:id/lineups { lineups: [...] }
  → assertClubScope(auth, clubId) — 403 if not club's match
  → validate: club is homeClub or awayClub of match — 400 if not participant
  → validate: starters.length === 11 — 400 if not
  → validate: captains.length === 1 — 400 if not
  → validate: intersection(starters, substitutes) === empty — 400 if overlap
  → validate: all seasonClubPlayerIds belong to club's SeasonClub for match's season
  → prisma.matchLineup.createMany(...)
  → notify league admin
  → logAudit('lineup_submitted')
  → return created lineups
```

### Match Approval Flow

```
POST /api/matches/:id/approve
  → assertMEASeasonScope(auth, match.seasonId) — 403 if not assigned
  → validate: match.matchDate - now <= 24 hours — 400 if too early
  → validate: match.status in ['scheduled', 'upcoming'] — 400 otherwise
  → prisma.match.update({ status: 'approved' })
  → logAudit('match_approved')
  → return updated match
```

### Live Event Logging Flow

```
POST /api/match-events { matchId, eventTypeId, playerId, clubId, minute, ... }
  → assertMEASeasonScope(auth, match.seasonId) — 403 if not assigned
  → validate: match.status === 'live' — 400 if not live
  → validate: if substitution eventType, relatedPlayerId required
  → prisma.matchEvent.create(...)
  → if goal/penalty_goal: prisma.match.update({ homeScore++ or awayScore++ })
  → if own_goal: increment opponent's score
  → notify league admin
  → logAudit('match_event_created')
```

### Standings Computation Flow

```
GET /api/seasons/:id/standings
  → fetch all matches WHERE seasonId = id AND status = 'completed'
  → computeStandings(matches, season.pointsWin, season.pointsDraw)
      → for each match: accumulate W/D/L, GF, GA per club
      → sort: points DESC, goalDifference DESC, goalsFor DESC
  → return StandingRow[]
```

---

## Scope Enforcement

For GET list endpoints, scope is applied as a Prisma `where` filter (not post-fetch):

```typescript
// League admin: only their season's matches
const seasonId = auth.roles.find(r => r.roleName === 'league_admin')?.seasonId
const matches = await prisma.match.findMany({ where: { seasonId } })

// Club admin: only their club's players
const clubId = auth.roles.find(r => r.roleName === 'club_admin')?.clubId
const players = await prisma.player.findMany({
  where: { seasonClubPlayers: { some: { seasonClub: { clubId } } } }
})

// MEA: only seasons they are assigned to
const meaSeasonIds = auth.roles
  .filter(r => r.roleName === 'match_event_admin')
  .map(r => r.seasonId).filter(Boolean)
const matches = await prisma.match.findMany({ where: { seasonId: { in: meaSeasonIds } } })
```

For write operations, the scope guard returns 403 before any DB mutation.

---

## Real API Wiring for Existing Pages

| Page | Change |
|---|---|
| Seasons | Wire to `GET /api/seasons`, add create/edit/delete dialogs |
| Matches | Wire to `GET /api/matches?seasonId=X`, add status transitions |
| Players | Wire to `GET /api/players`, add create/edit for club_admin |
| Coaches | Wire to `GET /api/coaches`, add create/edit for club_admin |
| Organizations | Wire list to `GET /api/organizations`, add status filter |
| Dashboard overview | Wire stats to real aggregate queries |

Each page adds an error state shown when SWR fetch fails, replacing silent fallback to mock data.

---


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Password token is set on user approval

*For any* organization approval action, the associated user record should have a non-null `passwordResetToken` and a `passwordResetExpires` timestamp strictly greater than the current time.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

---

### Property 2: Club creation atomicity

*For any* valid club creation request from a League Admin, the resulting database state should contain exactly one Club record (status: pending), one User record (status: inactive) with the provided email, one UserRoleScope record linking that user to club_admin scoped to the new club, and one SeasonClub record linking the club to the provided season.

**Validates: Requirements 2.1, 2.4**

---

### Property 3: Duplicate email rejection

*For any* club creation request where the provided adminEmail already exists in the users table, the system should return an error and the total user count should remain unchanged.

**Validates: Requirements 2.5**

---

### Property 4: Season player assignment round trip

*For any* player belonging to an approved club in a season, assigning that player to the season and then querying `GET /api/seasons/:id/players` should return a result set that includes that player.

**Validates: Requirements 6.1, 6.3**

---

### Property 5: Only approved-club players can be season-assigned

*For any* player belonging to a club whose SeasonClub status is not "active", attempting to assign that player to the season should return an error.

**Validates: Requirements 6.4**

---

### Property 6: Match approval 24-hour window

*For any* match whose `matchDate` is more than 24 hours in the future, a MEA approval request should be rejected with a 4xx error. *For any* match whose `matchDate` is within 24 hours of the current time, a MEA approval request from an assigned MEA should succeed.

**Validates: Requirements 8.2, 8.4**

---

### Property 7: Goal event increments score

*For any* live match, logging a goal event for the home club should result in `match.homeScore` increasing by exactly 1. Logging a goal event for the away club should result in `match.awayScore` increasing by exactly 1. Logging an own_goal for the home club should increment `match.awayScore` by 1.

**Validates: Requirements 9.3**

---

### Property 8: MEA event edit 10-minute window

*For any* match event where `now - event.createdAt > 10 minutes`, a PATCH request from a match_event_admin should be rejected with a 403 error. *For any* event where `now - event.createdAt <= 10 minutes`, a PATCH from an assigned MEA should succeed.

**Validates: Requirements 9.4, 9.5**

---

### Property 9: Lineup validity invariants

*For any* lineup submission, the following must all hold simultaneously or the submission must be rejected:
- The count of entries with `lineupType = 'starting'` equals exactly 11
- The count of entries with `isCaptain = true` equals exactly 1
- The set of starting player IDs and the set of substitute player IDs are disjoint
- Every `seasonClubPlayerId` in the submission belongs to the submitting club's SeasonClub for the match's season

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

---

### Property 10: Standings computation correctness

*For any* set of completed matches in a season, the computed standings must satisfy:
- Every club that participated in at least one match appears in the standings
- For each club: `played = won + drawn + lost`
- For each club: `goalDifference = goalsFor - goalsAgainst`
- For each club: `points = (won × pointsWin) + (drawn × pointsDraw)`
- The rows are sorted such that for any two adjacent rows i and j, `row[i].points >= row[j].points`, and when points are equal, `row[i].goalDifference >= row[j].goalDifference`

**Validates: Requirements 11.1, 11.2**

---

### Property 11: Scope enforcement — 403 on out-of-scope access

*For any* authenticated user with a scoped role (league_admin, club_admin, match_event_admin), a request to read or write a resource belonging to a different scope (different seasonId or clubId) should return HTTP 403.

**Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6**

---

### Property 12: Password change validation

*For any* password change request where the provided current password does not match the stored bcrypt hash, the request should be rejected and the stored hash should remain unchanged. *For any* new password shorter than 8 characters, the request should be rejected.

**Validates: Requirements 12.3, 12.4, 12.5**

---

### Property 13: Notification isolation

*For any* authenticated user, a GET request to `/api/notifications` should return only notifications where `notification.userId = auth.userId`. No notifications addressed to other users should appear in the response.

**Validates: Requirements 18.8**

---

### Property 14: Lineup submission triggers league admin notification

*For any* successful lineup submission, a Notification record should exist in the database addressed to the League Admin of the relevant season.

**Validates: Requirements 18.5**

---

## Error Handling

### API Error Responses

All API routes use the existing `lib/api-helpers.ts` helpers (`badRequest`, `notFound`, `serverError`, `forbidden`). A new `forbidden()` helper is added:
```typescript
export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 })
}
```

### Email Failure Handling

If `sendPasswordSetupEmail()` throws, the API route:
1. Logs the failure via `logAudit({ actionType: 'email_failure', ... })`
2. Returns a 500 response with a message indicating the user was created but the email failed
3. The admin can use `POST /api/auth/resend-setup-email` to retry

### Lineup Validation Errors

Lineup validation returns a structured error body:
```json
{ "error": "Lineup validation failed", "details": ["Exactly 11 starters required", "..."] }
```

### Dashboard Error States

Every dashboard page that uses `useSWR` adds an error state:
```tsx
if (error) return <ErrorState message="Failed to load data. Please refresh." />
```
The `ErrorState` component is a new shared component in `components/dashboard/error-state.tsx`.

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. Unit tests cover specific examples and integration points; property tests verify universal correctness across generated inputs.

### Unit Tests

Focus areas:
- `lib/standings.ts` — specific match result scenarios (win/draw/loss, tiebreakers)
- `lib/scope-guard.ts` — specific role/scope combinations
- API route integration tests for key workflows (club creation, lineup submission, match approval)
- Email module — mock the transport, verify correct arguments

### Property-Based Testing

Use **fast-check** (TypeScript-native PBT library). Each property test runs a minimum of 100 iterations.

Tag format: `// Feature: ethio-league, Property N: <property_text>`

**Property 1 test** — `// Feature: ethio-league, Property 1: Password token is set on user approval`
Generate random organization approval actions; assert user.passwordResetToken is non-null and passwordResetExpires > Date.now().

**Property 2 test** — `// Feature: ethio-league, Property 2: Club creation atomicity`
Generate random valid club creation inputs; assert all four records exist after creation.

**Property 5 test** — `// Feature: ethio-league, Property 5: Only approved-club players can be season-assigned`
Generate random players with non-active SeasonClub status; assert assignment returns error.

**Property 6 test** — `// Feature: ethio-league, Property 6: Match approval 24-hour window`
Generate random match dates both inside and outside the 24h window; assert correct accept/reject behavior.

**Property 7 test** — `// Feature: ethio-league, Property 7: Goal event increments score`
Generate random live matches and goal events; assert score increments correctly for home/away/own-goal cases.

**Property 8 test** — `// Feature: ethio-league, Property 8: MEA event edit 10-minute window`
Generate random event creation timestamps; assert edit is rejected after 10 minutes and accepted within 10 minutes.

**Property 9 test** — `// Feature: ethio-league, Property 9: Lineup validity invariants`
Generate random lineup arrays with varying starter counts, captain counts, and player overlaps; assert all invalid combinations are rejected and valid ones are accepted.

**Property 10 test** — `// Feature: ethio-league, Property 10: Standings computation correctness`
Generate random sets of completed matches; assert all five invariants hold on the output of `computeStandings()`.

**Property 11 test** — `// Feature: ethio-league, Property 11: Scope enforcement — 403 on out-of-scope access`
Generate random scoped users and resource IDs from different scopes; assert all out-of-scope requests return 403.

**Property 12 test** — `// Feature: ethio-league, Property 12: Password change validation`
Generate random wrong passwords and short passwords; assert both are rejected without modifying the stored hash.

**Property 13 test** — `// Feature: ethio-league, Property 13: Notification isolation`
Generate random users with interleaved notifications; assert each user's query returns only their own notifications.
