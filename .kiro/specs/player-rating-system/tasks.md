# Implementation Plan: Player Rating System

## Overview

Implement automatic, data-driven ratings for players, clubs, leagues, coaches, and referees using existing match data. The engine lives in `lib/ratings.ts` as pure computation functions plus DB-integrated helpers, triggered fire-and-forget from existing API routes. A first-run backfill runs on startup via `instrumentation.ts`.

## Tasks

- [x] 1. Add Prisma schema models and run migration
  - [x] 1.1 Add `EntityRating`, `RatingSnapshot`, and `RatingConfig` models to `prisma/schema.prisma`
    - `EntityRating`: `id` (UUID PK), `entityType String`, `entityId String @db.Uuid`, `score Float`, `computedAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, `@@unique([entityType, entityId])`, `@@map("entity_ratings")`
    - `RatingSnapshot`: `id` (UUID PK), `entityType String`, `entityId String @db.Uuid`, `score Float`, `snapshotAt DateTime @default(now())`, `@@index([entityType, entityId, snapshotAt(sort: Desc)])`, `@@map("rating_snapshots")`
    - `RatingConfig`: `id` (UUID PK), `isActive Boolean @default(true)`, all weight/penalty/normalization fields with defaults matching Requirements 1–5, `createdAt`, `updatedAt`, `@@map("rating_configs")`
    - _Requirements: 7.1, 9.3, 9.4_
  - [x] 1.2 Create and apply Prisma migration
    - Run `npx prisma migrate dev --name player-rating-system` to generate SQL and regenerate the Prisma client
    - _Requirements: 7.1_

- [x] 2. Implement core rating computation functions in `lib/ratings.ts`
  - [x] 2.1 Define `RatingConfigValues`, `EntityType`, `RatingResult`, and all input data interfaces (`PlayerRatingData`, `ClubRatingData`, `LeagueRatingData`, `CoachRatingData`, `RefereeRatingData`)
    - Each `*RatingData` type holds pre-fetched, per-season arrays so computation functions are pure (no DB access)
    - Include `seasonIndex: number` on each season entry for weight calculation
    - _Requirements: 10.1_
  - [x] 2.2 Implement `getSeasonWeight(index: number, config: RatingConfigValues): number`
    - Returns `Math.max(config.seasonMinWeight, 1.0 - index * config.seasonDecayRate)`
    - _Requirements: 1.2, 2.2, 4.2_
  - [x] 2.3 Implement `computePlayerRatingFromData(data: PlayerRatingData, config: RatingConfigValues): number`
    - Apply per-season weights; cap goals at 30 pts, assists at 20 pts, appearances at 15 pts, clean sheets at 10 pts; subtract card penalties; normalize via `baselineMax = 100`; clamp to [0, 100]
    - Return 0 when data has no seasons
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [ ]* 2.4 Write property tests for player rating computation (Properties 1, 2, 3, 4, 5)
    - **Property 1: All rating scores are in [0, 100]** — generate arbitrary `PlayerRatingData`, verify output ∈ [0, 100]
    - **Property 2: Zero-data entities receive a rating of 0** — pass empty `PlayerRatingData`, verify result === 0
    - **Property 3: Rating computation is deterministic** — call twice with same data, verify strict equality
    - **Property 4: Adding a positive event increases or maintains player rating** — add a goal event, verify new score ≥ old score
    - **Property 5: Adding a negative event decreases or maintains player rating** — add a red card event, verify new score ≤ old score
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 10.1**
  - [x] 2.5 Implement `computeClubRatingFromData(data: ClubRatingData, config: RatingConfigValues): number`
    - Apply per-season weights; compute win rate × winRateWeight, goal diff per match normalized to 20 pts, points per match normalized to 25 pts, discipline deduction capped at 15 pts; clamp to [0, 100]
    - Return 0 when data has no seasons
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 2.6 Write property tests for club rating computation (Properties 1, 2, 3, 6)
    - **Property 1: All rating scores are in [0, 100]** — generate arbitrary `ClubRatingData`
    - **Property 2: Zero-data entities receive a rating of 0** — pass empty `ClubRatingData`
    - **Property 3: Rating computation is deterministic** — call twice, verify equality
    - **Property 6: Higher win rate produces higher or equal club rating** — two datasets differing only in win rate, verify ordering
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 10.1**
  - [x] 2.7 Implement `computeLeagueRatingFromData(data: LeagueRatingData, config: RatingConfigValues): number`
    - Equal weight across all seasons (no decay); sum completion rate × 20, avg goals normalized × 20, avg club rating × 0.4, match activity rate × 20; clamp to [0, 100]
    - Return 0 when data has no seasons or no completed matches
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 2.8 Implement `computeCoachRatingFromData(data: CoachRatingData, config: RatingConfigValues): number`
    - Apply per-season weights; weighted avg club rating × 0.6, win rate × 30, discipline inverse up to 10 pts; clamp to [0, 100]
    - Return 0 when data has no active season records
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 2.9 Implement `computeRefereeActivityScoreFromData(data: RefereeRatingData, config: RatingConfigValues): number`
    - Match assignment rate × 50, distinct seasons normalized × 30, consistency score × 20; clamp to [0, 100]
    - Return 0 when data has no match assignments
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 2.10 Write property tests for league, coach, and referee computation (Properties 1, 2, 3)
    - **Property 1: All rating scores are in [0, 100]** — generate arbitrary data for each entity type
    - **Property 2: Zero-data entities receive a rating of 0** — pass empty data structs
    - **Property 3: Rating computation is deterministic** — call twice, verify equality
    - **Property 12: Soft-deleted entity data is excluded without failure** — mix soft-deleted entries, verify success
    - **Validates: Requirements 3.3, 3.4, 4.3, 4.4, 5.3, 5.4, 10.1, 10.5**

- [x] 3. Implement `getActiveConfig` and `persistRating` helpers in `lib/ratings.ts`
  - [x] 3.1 Implement `getActiveConfig(prisma): Promise<RatingConfigValues>`
    - Fetch the single `RatingConfig` record where `isActive = true`; fall back to hardcoded defaults if none found, logging a warning
    - _Requirements: 9.4_
  - [x] 3.2 Implement `persistRating(entityType, entityId, score, prisma): Promise<void>`
    - Within a transaction: fetch existing `EntityRating`; if exists, insert a `RatingSnapshot` with the old score/timestamp, then upsert `EntityRating` with new score; if not exists, just create `EntityRating`
    - _Requirements: 7.1, 7.2_
  - [ ]* 3.3 Write property tests for persistence logic (Properties 7, 10)
    - **Property 7: Rating history grows monotonically on recompute** — simulate N calls to `persistRating` with a mock, verify snapshot count equals N
    - **Property 10: Exactly one active RatingConfig record at all times** — simulate multiple config updates, verify active count is always 1
    - **Validates: Requirements 7.2, 9.3**

- [x] 4. Implement DB-integrated `computeAndPersist*` functions in `lib/ratings.ts`
  - [x] 4.1 Implement `computeAndPersistPlayerRating(playerId, prisma): Promise<void>`
    - Fetch all `SeasonClubPlayer` records for the player (with season, match events, lineups); build `PlayerRatingData`; call `computePlayerRatingFromData`; call `persistRating`
    - Exclude soft-deleted/inactive entities from the query
    - _Requirements: 1.1, 10.2, 10.5_
  - [x] 4.2 Implement `computeAndPersistClubRating(clubId, prisma): Promise<void>`
    - Fetch all `SeasonClub` records with standings data and discipline events; build `ClubRatingData`; compute and persist
    - _Requirements: 2.1, 10.2_
  - [x] 4.3 Implement `computeAndPersistLeagueRating(leagueId, prisma): Promise<void>`
    - Fetch all seasons for the league with match counts and existing club ratings; build `LeagueRatingData`; compute and persist
    - _Requirements: 3.1, 10.2_
  - [x] 4.4 Implement `computeAndPersistCoachRating(coachId, prisma): Promise<void>`
    - Fetch all `SeasonClubCoach` records with status "active" or "approved"; join club ratings and win rates; build `CoachRatingData`; compute and persist
    - _Requirements: 4.1, 10.2_
  - [x] 4.5 Implement `computeAndPersistRefereeRating(refereeId, prisma): Promise<void>`
    - Fetch all `MatchReferee` and `SeasonReferee` records; compute assignment rate, distinct seasons, consistency score; build `RefereeRatingData`; compute and persist
    - _Requirements: 5.1, 10.2_

- [x] 5. Implement trigger helpers and full recompute in `lib/ratings.ts`
  - [x] 5.1 Implement `recomputeMatchRatings(matchId): Promise<void>`
    - Fetch match with players (via lineups + events), both clubs, league, coaches, and referee; call `computeAndPersist*` for each; wrap each in try/catch logging `[ratings] compute failed: {entityType} {entityId}`
    - _Requirements: 6.1, 6.5_
  - [x] 5.2 Implement `recomputeEventRatings(matchEventId): Promise<void>`
    - Fetch event with player and club; call `computeAndPersistPlayerRating` and `computeAndPersistClubRating`; wrap in try/catch
    - _Requirements: 6.2, 6.5_
  - [x] 5.3 Implement `recomputeSeasonRatings(seasonId): Promise<void>`
    - Fetch all clubs, players, coaches in the season and the league; recompute in order: players → clubs → coaches → league; wrap each in try/catch
    - _Requirements: 6.3, 10.4_
  - [x] 5.4 Implement `runFullRecompute(): Promise<void>`
    - Fetch all entity IDs; process in order: Players → Clubs → Coaches → Referees → Leagues; wrap each entity in try/catch; log summary on completion
    - _Requirements: 10.3, 10.4_
  - [x] 5.5 Implement `runBackfillIfNeeded(): Promise<void>`
    - Check `EntityRating` count; if zero, call `runFullRecompute()` asynchronously (fire-and-forget); log start and completion with entity count and failure count
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [ ]* 5.6 Write property test for backfill resilience (Property 13)
    - **Property 13: Backfill failure for one entity does not stop others** — inject a throwing compute function for one entity, verify remaining entities are processed
    - **Validates: Requirements 8.3**

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Wire trigger hooks into existing API routes
  - [x] 7.1 Update `app/api/matches/[id]/approve/route.ts`
    - After returning the success response, add fire-and-forget: `recomputeMatchRatings(matchId).catch(err => console.error("[ratings] match recompute failed", err))`
    - _Requirements: 6.1, 6.4_
  - [x] 7.2 Update `app/api/match-events/route.ts` (POST handler)
    - After returning the created event, add fire-and-forget: `recomputeEventRatings(newEvent.id).catch(...)`
    - _Requirements: 6.2, 6.4_
  - [x] 7.3 Update `app/api/match-events/[id]/route.ts` (DELETE handler)
    - Before deleting, capture `matchEventId`; after returning success, add fire-and-forget: `recomputeEventRatings(matchEventId).catch(...)`
    - _Requirements: 6.2, 6.4_
  - [x] 7.4 Update the season status transition logic (in `app/api/seasons/[id]/route.ts` or wherever season status is set to "completed")
    - After returning success when status transitions to "completed", add fire-and-forget: `recomputeSeasonRatings(seasonId).catch(...)`
    - _Requirements: 6.3, 6.4_

- [x] 8. Create `instrumentation.ts` for first-run backfill
  - Create `instrumentation.ts` at the project root exporting `register(): Promise<void>`
  - Inside `register`, import `runBackfillIfNeeded` from `lib/ratings.ts` and call it (fire-and-forget, catch and log errors)
  - Only run in the `nodejs` runtime (guard with `process.env.NEXT_RUNTIME === 'nodejs'`)
  - _Requirements: 8.1, 8.2_

- [-] 9. Implement API routes under `app/api/ratings/`
  - [x] 9.1 Create `app/api/ratings/[entityType]/[entityId]/route.ts` — GET handler
    - Auth: any authenticated user
    - Fetch `EntityRating` by `entityType` + `entityId`; return `{ score, tier, computedAt }` where tier is derived from score (Elite/High/Medium/Low/Developing)
    - Return 404 if no rating exists yet
    - _Requirements: 7.4_
  - [x] 9.2 Create `app/api/ratings/[entityType]/[entityId]/history/route.ts` — GET handler
    - Auth: any authenticated user
    - Fetch `RatingSnapshot` records for the entity ordered by `snapshotAt desc`
    - _Requirements: 7.3_
  - [ ]* 9.3 Write property tests for API response ordering (Properties 8, 9)
    - **Property 8: Rating history is returned in descending timestamp order** — generate snapshots with random timestamps, verify sort order
    - **Property 9: Ratings list is sorted by score descending** — generate EntityRating records with random scores, verify list sort order
    - **Validates: Requirements 7.3, 7.5**
  - [x] 9.4 Create `app/api/ratings/[entityType]/route.ts` — GET handler
    - Auth: any authenticated user
    - Fetch all `EntityRating` records for the given `entityType`, sorted by `score desc`, with pagination (`page` + `pageSize` query params, default page size 20)
    - _Requirements: 7.5_
  - [x] 9.5 Create `app/api/ratings/recompute/route.ts` — POST handler
    - Auth: `super_admin` only (return 403 otherwise)
    - Fire-and-forget `runFullRecompute()`; return 202 immediately
    - _Requirements: 10.3_
  - [ ] 9.6 Create `app/api/ratings/config/route.ts` — GET and PUT handlers
    - GET: Auth `super_admin`; return the active `RatingConfig` record
    - PUT: Auth `super_admin`; validate all fields against allowed ranges (weights 0–10, penalties 0–10, normalization maxima 0.1–100, decay rate 0–1); return 400 with field-level errors on failure; on success, set previous config `isActive = false`, insert new active config, fire-and-forget `runFullRecompute()`
    - _Requirements: 9.1, 9.2, 9.3, 9.5_
  - [ ]* 9.7 Write property tests for config validation (Property 10, 11)
    - **Property 10: Exactly one active RatingConfig record at all times** — simulate multiple PUT operations, verify active count is always 1
    - **Property 11: Out-of-range config values are rejected** — generate out-of-range values for each parameter, verify 400 response with correct field names
    - **Validates: Requirements 9.3, 9.5**

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- All trigger hooks use fire-and-forget so the originating request is never blocked (Requirement 6.4)
- Computation order for full recompute: Players → Clubs → Coaches → Referees → Leagues (Requirement 10.4)
- Property tests live in `__tests__/player-rating-system.property.test.ts` using `fast-check`
- On rating compute failure, the previous `EntityRating` value is retained (Requirement 6.5)
