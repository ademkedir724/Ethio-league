# Design Document: Player Rating System

## Overview

The Player Rating System adds automatic, data-driven ratings to every major entity in the Ethio League platform: players, clubs, leagues, coaches, and referees. Ratings are computed from existing match data (events, standings, discipline records) and updated automatically whenever relevant data changes.

All ratings use a **0–100 floating-point scale** (two decimal places). Computation is **asynchronous** — triggering API requests return immediately and rating updates happen in the background. A first-run backfill auto-triggers on startup when no `EntityRating` records exist.

The system introduces three new Prisma models: `EntityRating` (current score), `RatingSnapshot` (history), and `RatingConfig` (configurable formula weights).

---

## Architecture

The rating system follows the same pattern as `lib/standings.ts`: pure computation functions in `lib/` that are called from API route handlers and trigger points.

```
┌─────────────────────────────────────────────────────────────────┐
│  Trigger Points                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ match approve    │  │ match event      │  │ season        │ │
│  │ route.ts         │  │ create/delete    │  │ complete      │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬────────┘ │
└───────────┼─────────────────────┼───────────────────┼──────────┘
            │  fire-and-forget    │                   │
            ▼                     ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  lib/ratings.ts  (Rating Engine)                                │
│                                                                  │
│  computePlayerRating(playerId, config, prisma)                  │
│  computeClubRating(clubId, config, prisma)                      │
│  computeLeagueRating(leagueId, config, prisma)                  │
│  computeCoachRating(coachId, config, prisma)                    │
│  computeRefereeActivityScore(refereeId, config, prisma)         │
│  persistRating(entityType, entityId, score, prisma)             │
│  runFullRecompute(prisma)                                        │
│  runBackfillIfNeeded(prisma)                                     │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Database (Prisma)                                               │
│  EntityRating  │  RatingSnapshot  │  RatingConfig               │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  API Routes  (app/api/ratings/)                                  │
│  GET  /api/ratings/:entityType/:entityId                        │
│  GET  /api/ratings/:entityType/:entityId/history                │
│  GET  /api/ratings/:entityType                                   │
│  POST /api/ratings/recompute                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Async Trigger Pattern

Following the existing codebase pattern (inline async after response), triggers use `Promise` fire-and-forget after the response is sent:

```typescript
// In match approve route — after returning success(updatedMatch):
recomputeMatchRatings(matchId).catch((err) =>
  console.error("[ratings] match recompute failed", err)
);
```

No separate queue infrastructure is needed.

### First-Run Backfill

`lib/ratings.ts` exports `runBackfillIfNeeded(prisma)`. This is called from a Next.js instrumentation hook (`instrumentation.ts`) on startup. It checks `EntityRating` count; if zero, triggers `runFullRecompute` asynchronously.

---

## Components and Interfaces

### `lib/ratings.ts` — Rating Engine

```typescript
export interface RatingConfigValues {
  goalWeight: number;           // default 3.0
  assistWeight: number;         // default 2.0
  yellowCardPenalty: number;    // default 1.5
  redCardPenalty: number;       // default 4.0
  appearanceWeight: number;     // default 0.5
  cleanSheetWeight: number;     // default 2.0
  winRateWeight: number;        // default 40.0
  goalDiffNormMax: number;      // default 2.0
  pointsPerMatchNormMax: number;// default 3.0
  seasonDecayRate: number;      // default 0.15
  seasonMinWeight: number;      // default 0.1
  maxSeasonsNorm: number;       // default 10 (referee)
  leagueGoalsNormMax: number;   // default 4.0
}

export type EntityType = "player" | "club" | "league" | "coach" | "referee";

export interface RatingResult {
  entityType: EntityType;
  entityId: string;
  score: number;          // [0, 100], 2 decimal places
  computedAt: Date;
}

// Core computation functions (pure — accept data, return score)
export function computePlayerRatingFromData(data: PlayerRatingData, config: RatingConfigValues): number;
export function computeClubRatingFromData(data: ClubRatingData, config: RatingConfigValues): number;
export function computeLeagueRatingFromData(data: LeagueRatingData, config: RatingConfigValues): number;
export function computeCoachRatingFromData(data: CoachRatingData, config: RatingConfigValues): number;
export function computeRefereeActivityScoreFromData(data: RefereeRatingData, config: RatingConfigValues): number;

// DB-integrated computation + persistence
export async function computeAndPersistPlayerRating(playerId: string, prisma: PrismaClient): Promise<void>;
export async function computeAndPersistClubRating(clubId: string, prisma: PrismaClient): Promise<void>;
export async function computeAndPersistLeagueRating(leagueId: string, prisma: PrismaClient): Promise<void>;
export async function computeAndPersistCoachRating(coachId: string, prisma: PrismaClient): Promise<void>;
export async function computeAndPersistRefereeRating(refereeId: string, prisma: PrismaClient): Promise<void>;

// Trigger helpers (called from API routes)
export async function recomputeMatchRatings(matchId: string): Promise<void>;
export async function recomputeEventRatings(matchEventId: string): Promise<void>;
export async function recomputeSeasonRatings(seasonId: string): Promise<void>;

// Full recompute (ordered: Players → Clubs → Coaches → Referees → Leagues)
export async function runFullRecompute(): Promise<void>;
export async function runBackfillIfNeeded(): Promise<void>;
```

### API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/ratings/:entityType/:entityId` | any authenticated | Current rating + tier |
| GET | `/api/ratings/:entityType/:entityId/history` | any authenticated | Snapshot history, desc |
| GET | `/api/ratings/:entityType` | any authenticated | All ratings, sorted desc, paginated |
| POST | `/api/ratings/recompute` | super_admin | Trigger full recompute |
| GET | `/api/ratings/config` | super_admin | View current config |
| PUT | `/api/ratings/config` | super_admin | Update config + trigger recompute |

### Rating Tier Mapping

| Score | Tier |
|-------|------|
| 80–100 | Elite |
| 60–79 | High |
| 40–59 | Medium |
| 20–39 | Low |
| 0–19 | Developing |

---

## Data Models

### `EntityRating` — current score per entity

```prisma
model EntityRating {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  entityType  String   // "player" | "club" | "league" | "coach" | "referee"
  entityId    String   @db.Uuid
  score       Float    // [0, 100]
  computedAt  DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([entityType, entityId])
  @@map("entity_ratings")
}
```

### `RatingSnapshot` — historical record

```prisma
model RatingSnapshot {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  entityType  String
  entityId    String   @db.Uuid
  score       Float
  snapshotAt  DateTime @default(now())

  @@index([entityType, entityId, snapshotAt(sort: Desc)])
  @@map("rating_snapshots")
}
```

### `RatingConfig` — single active configuration record

```prisma
model RatingConfig {
  id                    String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  isActive              Boolean  @default(true)
  goalWeight            Float    @default(3.0)
  assistWeight          Float    @default(2.0)
  yellowCardPenalty     Float    @default(1.5)
  redCardPenalty        Float    @default(4.0)
  appearanceWeight      Float    @default(0.5)
  cleanSheetWeight      Float    @default(2.0)
  winRateWeight         Float    @default(40.0)
  goalDiffNormMax       Float    @default(2.0)
  pointsPerMatchNormMax Float    @default(3.0)
  seasonDecayRate       Float    @default(0.15)
  seasonMinWeight       Float    @default(0.1)
  maxSeasonsNorm        Float    @default(10.0)
  leagueGoalsNormMax    Float    @default(4.0)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@map("rating_configs")
}
```

### Season Weight Calculation

```
weight(seasonIndex) = max(seasonMinWeight, 1.0 - seasonIndex * seasonDecayRate)
```

Where `seasonIndex = 0` for the most recent season, `1` for the prior season, etc. Applies to Players, Clubs, and Coaches. Leagues use equal weight (1.0) for all seasons.

### Formula Summaries

**Player Rating (raw score, then clamp to [0,100]):**
```
rawScore = Σ over seasons {
  weight(i) * (
    min(goals * goalWeight, 30) +
    min(assists * assistWeight, 20) +
    min(appearances * appearanceWeight, 15) +
    min(cleanSheets * cleanSheetWeight, 10) -
    yellowCards * yellowCardPenalty -
    redCards * redCardPenalty
  )
}
normalizedScore = clamp(rawScore / baselineMax * 100, 0, 100)
```

**Club Rating:**
```
rawScore = Σ over seasons {
  weight(i) * (
    winRate * winRateWeight +
    clamp(goalDiffPerMatch / goalDiffNormMax, -1, 1) * 20 +
    min(pointsPerMatch / pointsPerMatchNormMax, 1) * 25 -
    min(yellowCards * 0.5 + redCards * 2.0, 15)
  )
}
score = clamp(rawScore, 0, 100)
```

**League Rating (equal weight, no decay):**
```
score = clamp(
  completionRate * 20 +
  min(avgGoalsPerMatch / leagueGoalsNormMax, 1) * 20 +
  avgClubRating * 0.4 +
  matchActivityRate * 20,
  0, 100
)
```

**Coach Rating:**
```
rawScore = Σ over seasons {
  weight(i) * (
    weightedAvgClubRating * 0.6 +
    winRate * 30 +
    max(0, 10 - disciplinePenalty)
  )
}
score = clamp(rawScore, 0, 100)
```

**Referee Activity Score:**
```
score = clamp(
  matchAssignmentRate * 50 +
  min(distinctSeasons / maxSeasonsNorm, 1) * 30 +
  consistencyScore * 20,
  0, 100
)
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: All rating scores are in [0, 100]

*For any* valid input data and configuration, every rating computation function (player, club, league, coach, referee) SHALL return a value in the closed interval [0, 100].

**Validates: Requirements 1.3, 1.4, 2.3, 2.4, 3.3, 4.3, 5.3**

---

### Property 2: Zero-data entities receive a rating of 0

*For any* entity with no match data (no events, no lineups, no season participation), the rating computation SHALL return exactly 0.

**Validates: Requirements 1.5, 2.5, 3.4, 4.4, 5.4**

---

### Property 3: Rating computation is deterministic

*For any* fixed input dataset and configuration, calling the rating computation function twice SHALL produce identical results.

**Validates: Requirements 10.1**

---

### Property 4: Adding a positive event increases or maintains player rating

*For any* player dataset, adding a goal or assist event to the dataset SHALL produce a player rating greater than or equal to the rating without that event.

**Validates: Requirements 1.2**

---

### Property 5: Adding a negative event decreases or maintains player rating

*For any* player dataset, adding a yellow card or red card event to the dataset SHALL produce a player rating less than or equal to the rating without that event.

**Validates: Requirements 1.2**

---

### Property 6: Higher win rate produces higher or equal club rating

*For any* two club datasets that are identical except one has a strictly higher win rate, the club with the higher win rate SHALL receive a higher or equal Club_Rating.

**Validates: Requirements 2.2**

---

### Property 7: Rating history grows monotonically on recompute

*For any* entity, after N recomputations, the RatingSnapshot table SHALL contain exactly N records for that entity (one snapshot inserted per recompute).

**Validates: Requirements 7.2**

---

### Property 8: Rating history is returned in descending timestamp order

*For any* entity with multiple RatingSnapshot records, the history endpoint SHALL return them ordered by snapshotAt descending (most recent first).

**Validates: Requirements 7.3**

---

### Property 9: Ratings list is sorted by score descending

*For any* set of EntityRating records for a given entity type, the list endpoint SHALL return them sorted by score descending.

**Validates: Requirements 7.5**

---

### Property 10: Exactly one active RatingConfig record at all times

*For any* sequence of config update operations, the database SHALL contain exactly one RatingConfig record with isActive = true after each operation.

**Validates: Requirements 9.3**

---

### Property 11: Out-of-range config values are rejected

*For any* config update where a weight is outside [0.0, 10.0], a penalty is outside [0.0, 10.0], a normalization maximum is outside [0.1, 100.0], or a decay rate is outside [0.0, 1.0], the system SHALL reject the update and return a validation error.

**Validates: Requirements 9.5**

---

### Property 12: Soft-deleted entity data is excluded without failure

*For any* dataset containing soft-deleted or deactivated entities, the rating computation SHALL succeed and SHALL exclude the soft-deleted entity's data from the result.

**Validates: Requirements 10.5**

---

### Property 13: Backfill failure for one entity does not stop others

*For any* set of entities where one entity's computation throws an error, the backfill process SHALL continue processing the remaining entities and SHALL not propagate the error.

**Validates: Requirements 8.3**

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Rating computation throws | Log `[ratings] compute failed: {entityType} {entityId} — {error}`, retain previous `EntityRating` value |
| Referenced entity not found (soft-deleted) | Skip that entity's data, continue computation |
| No active `RatingConfig` | Fall back to hardcoded defaults, log a warning |
| Full recompute already in progress | Log and skip (no lock needed — idempotent) |
| Config update with invalid values | Return 400 with field-level validation errors |
| Backfill entity failure | Log failure, increment failure counter, continue to next entity |

All rating computation errors are non-fatal to the triggering request. The triggering API route always returns its own response before rating computation begins.

---

## Testing Strategy

### Unit Tests (example-based)

- `computePlayerRatingFromData` with known inputs produces expected score
- `computeClubRatingFromData` with zero matches returns 0
- `computeLeagueRatingFromData` with all completed seasons returns expected score
- Season weight decay: season index 0 → 1.0, index 1 → 0.85, index 6 → 0.1 (min)
- Tier mapping: score 85 → "Elite", score 55 → "Medium", score 0 → "Developing"
- Config validation rejects out-of-range values with correct field names

### Property-Based Tests (fast-check, minimum 100 iterations each)

The codebase uses `fast-check` for property-based testing (see `__tests__/*.property.test.ts`). Each property test below corresponds to a Correctness Property above.

**File: `__tests__/player-rating-system.property.test.ts`**

- **Property 1** — `// Feature: player-rating-system, Property 1: All rating scores are in [0, 100]`
  Generate arbitrary player/club/league/coach/referee data, verify all outputs ∈ [0, 100].

- **Property 2** — `// Feature: player-rating-system, Property 2: Zero-data entities receive a rating of 0`
  Pass empty data structs to each compute function, verify result === 0.

- **Property 3** — `// Feature: player-rating-system, Property 3: Rating computation is deterministic`
  Generate arbitrary data, call compute twice, verify results are strictly equal.

- **Property 4** — `// Feature: player-rating-system, Property 4: Adding a positive event increases or maintains player rating`
  Generate base player data, add a goal event, verify new score ≥ old score.

- **Property 5** — `// Feature: player-rating-system, Property 5: Adding a negative event decreases or maintains player rating`
  Generate base player data, add a red card event, verify new score ≤ old score.

- **Property 6** — `// Feature: player-rating-system, Property 6: Higher win rate produces higher or equal club rating`
  Generate two club datasets differing only in win rate, verify ordering.

- **Property 7** — `// Feature: player-rating-system, Property 7: Rating history grows monotonically on recompute`
  Simulate N recomputes via `persistRating`, verify snapshot count equals N.

- **Property 8** — `// Feature: player-rating-system, Property 8: Rating history is returned in descending timestamp order`
  Generate snapshots with random timestamps, verify sort order.

- **Property 9** — `// Feature: player-rating-system, Property 9: Ratings list is sorted by score descending`
  Generate EntityRating records with random scores, verify list sort order.

- **Property 10** — `// Feature: player-rating-system, Property 10: Exactly one active RatingConfig record at all times`
  Simulate multiple config updates, verify active count is always 1.

- **Property 11** — `// Feature: player-rating-system, Property 11: Out-of-range config values are rejected`
  Generate out-of-range values for each parameter, verify validation rejects them.

- **Property 12** — `// Feature: player-rating-system, Property 12: Soft-deleted entity data is excluded without failure`
  Generate data with soft-deleted entities mixed in, verify computation succeeds.

- **Property 13** — `// Feature: player-rating-system, Property 13: Backfill failure for one entity does not stop others`
  Inject a throwing compute function for one entity, verify others are processed.

### Integration Tests

- Match approval triggers rating recompute for correct entity IDs (mock rating engine)
- MatchEvent creation triggers player + club rating recompute (mock rating engine)
- Season completion triggers full season rating recompute (mock rating engine)
- `POST /api/ratings/recompute` requires super_admin role (returns 403 for others)
- `PUT /api/ratings/config` persists new values and triggers recompute

### Smoke Tests

- On startup with empty `EntityRating` table, backfill is triggered
- `GET /api/ratings/config` returns a config record with all expected fields
