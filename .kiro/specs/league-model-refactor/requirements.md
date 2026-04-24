# Requirements: League Model Refactor

## Introduction

The current system has a flat `Organization → Season` hierarchy with no real `League` entity. This refactor introduces a proper `League` model, making the hierarchy `Organization → League → Season`, and updates all related roles, APIs, and UI accordingly.

---

## Glossary

- **League**: A named, permanent competition owned by an Organization (e.g., "Ethiopian Premier League"). Has many Seasons over time.
- **Season**: A time-bounded edition of a League (e.g., "2025/26 Season"). All match activity, club participation, player registration, and standings belong to a Season.
- **League Admin**: A user scoped to a specific **League** (not a Season). They manage all seasons within that league.
- **SeasonReferee**: A referee assigned to a specific Season by the Org Admin — the eligible pool for that season.
- **SeasonMEA**: A Match Event Admin assigned to a specific Season by the Org Admin.

---

## Requirements

### Requirement 1: League Model

**User Story:** As an Org Admin, I want to create and manage Leagues under my organization so that each competition has a permanent identity separate from its seasons.

#### Acceptance Criteria

1. WHEN an Org Admin creates a League, THE System SHALL store: name, organizationId, leagueTypeId, genderCategory, ageCategory, divisionLevel, logoUrl, description, and status.
2. THE System SHALL enforce that a League belongs to exactly one Organization.
3. THE System SHALL allow an Organization to have multiple Leagues.
4. THE System SHALL allow a League to have multiple Seasons.
5. WHEN a League is deleted, THE System SHALL prevent deletion if it has any associated Seasons.
6. THE System SHALL enforce that only Org Admins (scoped to the org) and Super Admins can create, edit, or delete Leagues.

---

### Requirement 2: Season belongs to League

**User Story:** As an Org Admin, I want each Season to belong to a specific League so that seasons are properly grouped under their competition.

#### Acceptance Criteria

1. WHEN a Season is created, THE System SHALL require a `leagueId` foreign key linking it to a League.
2. THE Season SHALL no longer have a direct `organizationId` field — the org is derived through the League.
3. THE `leagueName`, `leagueTypeId`, `genderCategory`, `ageCategory`, and `divisionLevel` fields SHALL be removed from Season and moved to League.
4. THE System SHALL migrate existing Season records by creating a League per unique `leagueName` within each org, then linking seasons to those leagues.
5. IF migration is not feasible, THE System SHALL reset the database.

---

### Requirement 3: League Admin scoped to League

**User Story:** As a system operator, I want League Admins scoped to a League so one admin can manage all seasons of their league.

#### Acceptance Criteria

1. THE `UserRoleScope` table SHALL add a `leagueId` UUID nullable field.
2. WHEN a League Admin is created, THE System SHALL store `leagueId` in their `UserRoleScope`.
3. THE `assertLeagueScope` function SHALL return `true` if the user is `super_admin` OR has `league_admin` scoped to the given `leagueId`.
4. THE `getLeagueId()` helper in `lib/auth-context.tsx` SHALL return the `leagueId` from the League Admin's scope.
5. THE existing `assertSeasonScope` SHALL be updated: for `league_admin`, check that the season's `leagueId` matches the admin's scoped `leagueId`.

---

### Requirement 4: Referee and MEA assigned to Season by Org Admin

**User Story:** As an Org Admin, I want to assign referees and MEAs to a specific season so only approved officials can work matches in that season.

#### Acceptance Criteria

1. THE `RefereeLeague` table SHALL be renamed to `SeasonReferee`; its `seasonId` FK remains pointing to `Season`.
2. WHEN an Org Admin assigns a referee to a season, THE System SHALL create a `SeasonReferee` record.
3. WHEN an Org Admin assigns a MEA to a season, THE System SHALL update the MEA's `UserRoleScope` to include the `seasonId`.
4. THE System SHALL enforce that only Org Admins scoped to the org that owns the season's league can assign officials.
5. THE System SHALL prevent duplicate referee assignments to the same season.

---

### Requirement 5: League Admin assigns officials to Match

**User Story:** As a League Admin, I want to assign referees and MEAs from the season pool to individual matches.

#### Acceptance Criteria

1. WHEN a League Admin assigns a referee to a match, THE System SHALL validate the referee is in the `SeasonReferee` pool for that season.
2. WHEN a League Admin assigns a MEA to a match, THE System SHALL validate the MEA is assigned to that season via `UserRoleScope`.
3. THE System SHALL allow: 1 main referee, up to 2 assistants, 1 fourth official, 1 MEA per match.
4. THE System SHALL enforce that only League Admins (scoped to the league) and Super Admins can assign officials to matches.

---

### Requirement 6: API updates

**User Story:** As a developer, I want all API routes to reflect the new League model and updated scope rules.

#### Acceptance Criteria

1. NEW `GET/POST /api/leagues` — list and create leagues.
2. NEW `GET/PATCH/DELETE /api/leagues/[id]` — get, edit, delete a league.
3. NEW `GET /api/leagues/[id]/seasons` — list seasons for a league.
4. UPDATED `POST /api/seasons` — require `leagueId` instead of `organizationId`.
5. UPDATED `GET /api/seasons` — filter by league for League Admin; by org's leagues for Org Admin.
6. UPDATED all scope guard calls that use `seasonId` for `league_admin` to use `leagueId`.
7. UPDATED season assignments endpoint to use `SeasonReferee` table name.

---

### Requirement 7: Frontend updates

**User Story:** As a user, I want the dashboard UI to reflect the League → Season hierarchy.

#### Acceptance Criteria

1. THE Leagues page SHALL show leagues grouped under their org, with a "View Seasons" action per league.
2. THE Seasons page SHALL be accessible from within a League context.
3. THE League Admin dashboard SHALL show their assigned league name and all its seasons.
4. THE Org Admin dashboard SHALL show leagues and their season counts.
5. ALL pages that reference `seasonId` for League Admin scope SHALL be updated to use `leagueId`.

---

### Requirement 8: Data migration

**User Story:** As a system operator, I want existing data preserved through the migration.

#### Acceptance Criteria

1. THE System SHALL provide a migration script that: creates a `leagues` table, creates one League per unique `leagueName` per org from existing seasons, adds `leagueId` to `seasons`, backfills `leagueId` on all existing seasons, removes migrated fields from `seasons`, adds `leagueId` to `user_role_scopes`, and renames `referee_leagues` to `season_referees`.
2. IF any season has a null or empty `leagueName`, THE migration SHALL assign it to a default league named "Default League" for that org.
3. THE migration SHALL be idempotent — safe to run multiple times.
4. IF the migration fails, THE System SHALL provide a reset script that drops all data and recreates the schema.
