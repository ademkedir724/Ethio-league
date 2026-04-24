# Implementation Plan: League Model Refactor

## Overview

This plan introduces the `League` model between `Organization` and `Season`, updates all scope rules, APIs, and frontend pages. Tasks are ordered so each phase is safe to deploy independently.

---

## Phase 1: Database Schema

- [x] 1. Update `prisma/schema.prisma`
  - Add `League` model with fields: id, organizationId, name, leagueTypeId, genderCategory, ageCategory, divisionLevel, logoUrl, description, status, createdAt, updatedAt
  - Add `leagues League[]` relation to `Organization`; remove `seasons Season[]` from `Organization`
  - Update `Season`: replace `organizationId` + `leagueName` + `leagueTypeId` + `genderCategory` + `ageCategory` + `divisionLevel` with `leagueId String @db.Uuid`; add `league League` relation
  - Update `UserRoleScope`: add `leagueId String? @db.Uuid` and `league League?` relation
  - Rename `RefereeLeague` model to `SeasonReferee`, rename table to `season_referees`; update all relations referencing `RefereeLeague`
  - Add `userRoleScopes UserRoleScope[]` relation to `League`
  - _Requirements: 1.1, 2.1, 3.1, 4.1_

- [x] 2. Write and run migration script
  - Create `prisma/migrations/league-refactor/migrate.sql`:
    - Create `leagues` table
    - For each unique `(organizationId, leagueName)` in `seasons`, insert a League row (use `leagueName` as league name, carry over `leagueTypeId`, `genderCategory`, `ageCategory`, `divisionLevel`)
    - Add nullable `league_id` column to `seasons`
    - Backfill `league_id` on all seasons by matching `organizationId + leagueName`
    - Make `league_id` NOT NULL, drop `organization_id`, `league_name`, `league_type_id`, `gender_category`, `age_category`, `division_level` from `seasons`
    - Add nullable `league_id` column to `user_role_scopes`
    - Backfill `league_id` for existing `league_admin` scopes: find season → find league by season's old leagueName → set leagueId
    - Rename `referee_leagues` table to `season_referees`
  - If migration fails, run `npx prisma migrate reset --force` and `npx prisma db push`
  - _Requirements: 2.4, 2.5, 8.1, 8.4_

---

## Phase 2: Backend — Scope Guard and Auth

- [x] 3. Update `lib/scope-guard.ts`
  - Add `assertLeagueScope(auth: AuthUser, leagueId: string): boolean` — returns true for `super_admin` or `league_admin` with matching `leagueId`
  - Update `assertSeasonScope(auth: AuthUser, seasonId: string, seasonLeagueId: string): boolean` — for `league_admin`, check `r.leagueId === seasonLeagueId` instead of `r.seasonId === seasonId`
  - Update `assertMEASeasonScope` — `league_admin` bypass now checks `r.leagueId` is set (any league admin can bypass)
  - _Requirements: 3.3, 3.5_

- [x] 4. Update `lib/auth-context.tsx`
  - Add `leagueId?: string | null` to `RoleScope` interface
  - Add `getLeagueId(): string | null` — reads from `league_admin` scope
  - Update `getSeasonId()` — remove `league_admin` from its logic (league admins use `getLeagueId()` now)
  - _Requirements: 3.4_

---

## Phase 3: Backend — League API Routes

- [x] 5. Create `app/api/leagues/route.ts`
  - `GET` — list leagues; for `super_admin` return all; for `organization_admin` return org's leagues; for `league_admin` return their league
  - `POST` — create league; require `organization_admin` or `super_admin`; validate `organizationId`, `name` uniqueness within org; call `logAudit`
  - _Requirements: 1.6, 6.1, 6.2_

- [x] 6. Create `app/api/leagues/[id]/route.ts`
  - `GET` — get league by id; enforce `assertLeagueScope` or `assertOrgScope`
  - `PATCH` — edit league fields; enforce `assertOrgScope`; call `logAudit`
  - `DELETE` — delete league; check no seasons exist; enforce `assertOrgScope`; call `logAudit`
  - _Requirements: 1.5, 1.6, 6.3, 6.4, 6.5_

- [x] 7. Create `app/api/leagues/[id]/seasons/route.ts`
  - `GET` — list seasons for a league; enforce `assertLeagueScope` or `assertOrgScope`
  - _Requirements: 6.6_

---

## Phase 4: Backend — Updated Season and Assignment Routes

- [x] 8. Update `app/api/seasons/route.ts`
  - `POST` — accept `leagueId` instead of `organizationId`; validate league exists and caller has org scope; derive org from league
  - `GET` — for `league_admin`: filter by `league.id = auth.leagueId`; for `organization_admin`: filter by org's leagues; for `super_admin`: return all
  - _Requirements: 6.4, 6.5_

- [x] 9. Update `app/api/seasons/[id]/route.ts` and all sub-routes
  - All scope checks: fetch season → get `season.leagueId` → call `assertLeagueScope(auth, season.leagueId)` instead of old `assertSeasonScope`
  - Update `GET /api/seasons/[id]/standings`, `top-scorers`, `discipline`, `players` — same scope update
  - _Requirements: 6.6_

- [x] 10. Update `app/api/seasons/[id]/assignments/route.ts`
  - Rename all references from `refereeLeague` / `RefereeLeague` to `seasonReferee` / `SeasonReferee`
  - Scope check: Org Admin assigns referees/MEAs to seasons; validate org owns the season's league
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [x] 11. Update `app/api/matches/[id]/lineups/route.ts` and `app/api/matches/[id]/approve/route.ts`
  - Scope checks: fetch match → fetch season → use `assertLeagueScope(auth, season.leagueId)` for league_admin checks
  - _Requirements: 5.4_

- [x] 12. Update `app/api/match-events/route.ts` and `app/api/match-events/[id]/route.ts`
  - Scope checks: fetch match → fetch season → use `assertLeagueScope` for league_admin bypass
  - _Requirements: 5.4_

- [x] 13. Update `app/api/matches/assign-referee/route.ts` (or equivalent)
  - Validate referee is in `SeasonReferee` pool for the match's season
  - Validate MEA is assigned to the season via `UserRoleScope`
  - Enforce `assertLeagueScope` for the caller
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 14. Update `app/api/clubs/route.ts`
  - League Admin club creation: accept `leagueId` to derive the season context; use `assertLeagueScope`
  - _Requirements: 3.5_

- [x] 15. Update `app/api/dashboard/stats/route.ts`
  - For `league_admin`: scope stats to their `leagueId` (all seasons under that league)
  - _Requirements: 7.3_

---

## Phase 5: Frontend — Auth and Scope

- [x] 16. Update `lib/fetch-client.ts` or equivalent — no changes needed (token-based, transparent)

- [x] 17. Update all dashboard pages that call `getSeasonId()` for league_admin
  - Replace with `getLeagueId()` where the intent is league-level scope
  - Affected pages: `standings`, `seasons/[id]/players`, `matches`, `lineups`
  - _Requirements: 7.5_

---

## Phase 6: Frontend — League Pages

- [x] 18. Update `app/dashboard/leagues/page.tsx`
  - Wire to `GET /api/leagues` (replace any mock data)
  - Show league cards with: name, type, gender, division, season count, status
  - "View Seasons" button navigates to `/dashboard/leagues/[id]/seasons`
  - Create/edit league dialog: fields for name, leagueTypeId, genderCategory, ageCategory, divisionLevel, logoUrl, description
  - _Requirements: 7.1_

- [x] 19. Create `app/dashboard/leagues/[id]/seasons/page.tsx`
  - Fetch seasons via `GET /api/leagues/[id]/seasons`
  - List seasons with create/edit/delete actions (same UI as current seasons page)
  - Breadcrumb: Organization → League → Seasons
  - _Requirements: 7.2_

- [x] 20. Update `app/dashboard/seasons/page.tsx`
  - For League Admin: fetch from `GET /api/seasons` (already scoped by leagueId server-side)
  - Remove any `organizationId` references; use `leagueId` context
  - _Requirements: 7.2_

---

## Phase 7: Frontend — Dashboard Overview and Sidebar

- [x] 21. Update `app/dashboard/page.tsx` — League Admin overview
  - Show assigned league name (from `getLeagueId()` → fetch league details)
  - Show all seasons under that league with status badges
  - _Requirements: 7.3_

- [x] 22. Update `app/dashboard/page.tsx` — Org Admin overview
  - Show leagues count and season counts per league
  - _Requirements: 7.4_

- [x] 23. Update `components/dashboard/sidebar.tsx`
  - League Admin: show "My League" label with league name; seasons accessible from leagues page
  - Org Admin: "Leagues" nav item (already exists); ensure it links to updated leagues page
  - _Requirements: 7.5_

---

## Phase 8: Cleanup and Validation

- [x] 24. Remove dead code
  - Remove `leagueName`, `organizationId` from any Season form/type definitions in the frontend
  - Remove old `RefereeLeague` type references; replace with `SeasonReferee`
  - Update TypeScript interfaces across the codebase

- [x] 25. Update `lib/standings.ts` — no logic changes needed (pure function, takes match results)

- [x] 26. Final checkpoint — verify all pages load, all API routes return correct scoped data, and the League → Season hierarchy is enforced end-to-end

---

## Notes

- `assertSeasonScope` now requires the season's `leagueId` to be passed — API routes must fetch the season before calling the guard
- `match_event_admin` scope remains on `seasonId` (unchanged)
- `league_admin` scope moves from `seasonId` to `leagueId` — existing league admin users need their `UserRoleScope` backfilled during migration
- The `RefereeLeague` Prisma model rename to `SeasonReferee` requires updating all `prisma.refereeLeague` calls to `prisma.seasonReferee`
