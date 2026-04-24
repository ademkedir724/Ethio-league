# Design: League Model Refactor

## Overview

This design introduces a `League` model between `Organization` and `Season`, updates the `UserRoleScope` to support `leagueId` for League Admins, renames `RefereeLeague` to `SeasonReferee`, and updates all affected APIs, scope guards, auth context, and frontend pages.

---

## New Data Hierarchy

```
Organization (1)
  └── League (N)           ← NEW
        ├── leagueTypeId
        ├── genderCategory
        ├── ageCategory
        ├── divisionLevel
        └── Season (N)
              ├── SeasonClub (N)
              │     ├── SeasonClubPlayer (N)
              │     └── SeasonClubCoach (N)
              ├── Match (N)
              │     ├── MatchReferee (N)   ← assigned by League Admin from SeasonReferee pool
              │     ├── MatchLineup (N)
              │     └── MatchEvent (N)
              └── SeasonReferee (N)        ← renamed from RefereeLeague, assigned by Org Admin

UserRoleScope
  ├── super_admin          → no scope
  ├── organization_admin   → organizationId
  ├── league_admin         → leagueId (NEW, replaces seasonId)
  ├── club_admin           → clubId
  └── match_event_admin    → seasonId (assigned per season by Org Admin)
```

---

## Schema Changes

### New model: `League`

```prisma
model League {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String   @db.Uuid
  name           String
  leagueTypeId   Int?
  genderCategory String?
  ageCategory    String?
  divisionLevel  Int?
  logoUrl        String?
  description    String?
  status         String   @default("active")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  leagueType     LeagueType?  @relation(fields: [leagueTypeId], references: [id])
  seasons        Season[]
  userRoleScopes UserRoleScope[]

  @@unique([organizationId, name])
  @@map("leagues")
}
```

### Updated model: `Season`

Remove: `organizationId`, `leagueName`, `leagueTypeId`, `genderCategory`, `ageCategory`, `divisionLevel`
Add: `leagueId String @db.Uuid`

```prisma
model Season {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  leagueId   String   @db.Uuid   // ← replaces organizationId
  name       String
  startDate  DateTime
  endDate    DateTime
  pointsWin  Int      @default(3)
  pointsDraw Int      @default(1)
  pointsLoss Int      @default(0)
  status     String   @default("upcoming")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  league         League           @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  seasonClubs    SeasonClub[]
  matches        Match[]
  seasonReferees SeasonReferee[]
  userRoleScopes UserRoleScope[]

  @@map("seasons")
}
```

### Updated model: `UserRoleScope`

Add: `leagueId String? @db.Uuid`

```prisma
model UserRoleScope {
  ...
  leagueId       String?  @db.Uuid   // ← NEW for league_admin
  organizationId String?  @db.Uuid
  seasonId       String?  @db.Uuid   // kept for match_event_admin
  clubId         String?  @db.Uuid

  league League? @relation(fields: [leagueId], references: [id])
  ...
}
```

### Renamed model: `SeasonReferee` (was `RefereeLeague`)

```prisma
model SeasonReferee {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  refereeId    String    @db.Uuid
  seasonId     String    @db.Uuid
  roleLevel    String?
  approvedDate DateTime?
  status       String    @default("active")

  referee Referee @relation(fields: [refereeId], references: [id], onDelete: Cascade)
  season  Season  @relation(fields: [seasonId], references: [id], onDelete: Cascade)

  @@unique([refereeId, seasonId])
  @@map("season_referees")
}
```

### Updated model: `Organization`

Remove: `seasons Season[]`
Add: `leagues League[]`

---

## Migration Strategy

### Option A: Migrate existing data (preferred)

```sql
-- 1. Create leagues table
-- 2. For each unique (organizationId, leagueName) in seasons:
--    INSERT INTO leagues (id, organizationId, name, leagueTypeId, genderCategory, ageCategory, divisionLevel)
--    SELECT gen_random_uuid(), organizationId, leagueName, leagueTypeId, genderCategory, ageCategory, divisionLevel
--    FROM seasons GROUP BY organizationId, leagueName, ...
-- 3. Add leagueId column to seasons (nullable first)
-- 4. UPDATE seasons SET leagueId = leagues.id WHERE leagues.organizationId = seasons.organizationId AND leagues.name = seasons.leagueName
-- 5. Make leagueId NOT NULL, drop old columns
-- 6. Add leagueId column to user_role_scopes (nullable)
-- 7. For existing league_admin scopes: find the league via their seasonId → season.leagueName → league.id, backfill leagueId
-- 8. Rename referee_leagues → season_referees
```

### Option B: Reset (fallback)

If migration fails due to null leagueNames or data conflicts:
```bash
npx prisma migrate reset --force
npx prisma db push
npx prisma db seed
```

---

## Scope Guard Updates (`lib/scope-guard.ts`)

```typescript
// NEW
export function assertLeagueScope(auth: AuthUser, leagueId: string): boolean {
  return auth.roles.some(
    r => r.roleName === 'super_admin' ||
         (r.roleName === 'league_admin' && r.leagueId === leagueId)
  )
}

// UPDATED — league_admin now checks leagueId via season's league
export function assertSeasonScope(auth: AuthUser, seasonId: string, seasonLeagueId: string): boolean {
  return auth.roles.some(
    r => r.roleName === 'super_admin' ||
         (r.roleName === 'league_admin' && r.leagueId === seasonLeagueId) ||
         (r.roleName === 'organization_admin' && /* org owns the league */ true)
  )
}
```

Note: `assertSeasonScope` will need the season's `leagueId` passed in, which means API routes must fetch the season first to get its `leagueId` before calling the guard.

---

## Auth Context Updates (`lib/auth-context.tsx`)

```typescript
// NEW
getLeagueId(): string | null  // reads from league_admin scope
isLeagueAdmin(): boolean      // already exists, no change needed
```

The `RoleScope` interface gains `leagueId?: string | null`.

---

## New API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/leagues` | List leagues (scoped by org for org_admin, all for super_admin) |
| POST | `/api/leagues` | Create league (org_admin or super_admin) |
| GET | `/api/leagues/[id]` | Get league details |
| PATCH | `/api/leagues/[id]` | Edit league |
| DELETE | `/api/leagues/[id]` | Delete league (only if no seasons) |
| GET | `/api/leagues/[id]/seasons` | List seasons for a league |

---

## Updated API Routes

| Route | Change |
|-------|--------|
| `POST /api/seasons` | Accept `leagueId` instead of `organizationId` |
| `GET /api/seasons` | Filter by `leagueId` for league_admin; by org's leagues for org_admin |
| `GET/PATCH/DELETE /api/seasons/[id]` | Scope check uses `assertLeagueScope(auth, season.leagueId)` |
| `POST /api/seasons/[id]/assignments` | Use `SeasonReferee` table (renamed) |
| `GET /api/seasons/[id]/standings` | No change to logic, scope check updated |
| `POST /api/leagues` (was in leagues page) | Now a proper API route |
| All league_admin scope checks | Replace `assertSeasonScope` with `assertLeagueScope` where appropriate |

---

## Frontend Updates

### New pages
- `app/dashboard/leagues/page.tsx` — already exists, needs updating to use new API
- `app/dashboard/leagues/[id]/seasons/page.tsx` — NEW: seasons list within a league

### Updated pages
- `app/dashboard/seasons/page.tsx` — now navigated to from within a league
- `app/dashboard/page.tsx` — League Admin overview shows league name + seasons
- `components/dashboard/sidebar.tsx` — League Admin sees "My League" → seasons drill-down
- All pages using `getSeasonId()` for league_admin → replace with `getLeagueId()`

---

## Correctness Properties

### Property 1: League belongs to org
For any League, `league.organizationId` must match an existing Organization.

### Property 2: Season belongs to league
For any Season, `season.leagueId` must match an existing League.

### Property 3: League Admin scope isolation
For any League Admin, `assertLeagueScope(auth, leagueId)` returns true only for their assigned `leagueId` and false for all others.

### Property 4: Season scope via league
For any League Admin, they can access a Season if and only if `season.leagueId === auth.leagueId`.

### Property 5: SeasonReferee pool integrity
For any MatchReferee assignment, the referee must exist in `SeasonReferee` for that match's season.
