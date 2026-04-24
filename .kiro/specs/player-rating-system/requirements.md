# Requirements Document

## Introduction

The Player Rating System adds automatic, data-driven ratings to the Ethio League platform. Every major entity — players, clubs, leagues, coaches, and referees — receives a numeric score that is computed from existing match data (events, standings, discipline records) and updated automatically whenever relevant data changes. Ratings are surfaced via API endpoints and the admin dashboard to give administrators a quick quality signal for every entity.

Ratings are computed on a **0–100 scale** (floating-point, two decimal places). Each entity type has its own formula built from weighted sub-factors derived from data already present in the system (MatchEvent, Match standings, SeasonClubPlayer, etc.). No manual rating entry is allowed; all values are derived automatically.

---

## Glossary

- **Rating_Engine**: The server-side module responsible for computing and persisting entity ratings.
- **Rating_Score**: A numeric value in the range [0, 100] representing an entity's computed quality.
- **Rating_Snapshot**: A persisted record of an entity's Rating_Score at a point in time, used for history and trend display.
- **Player_Rating**: The Rating_Score assigned to a Player, derived from goals, assists, cards, appearances, and clean sheets.
- **Club_Rating**: The Rating_Score assigned to a Club, derived from season standings, win rate, goal difference, and discipline.
- **League_Rating**: The Rating_Score assigned to a League, derived from match activity, average goals, club quality, and season completion rate.
- **Coach_Rating**: The Rating_Score assigned to a Coach, derived from the Club_Rating of clubs the coach has managed and win rate during their tenure.
- **Referee_Activity_Score**: The Rating_Score assigned to a Referee, measuring activity level and consistency derived from match assignment frequency and discipline event consistency.
- **Rating_Trigger**: A system event (match approved, match event created/deleted, season completed) that causes the Rating_Engine to recompute affected ratings.
- **Season_Weight**: A decay multiplier applied to historical seasons so that recent performance contributes more to the current rating than older seasons. Applies to Players, Clubs, and Coaches only — League ratings use equal weight across all seasons.

---

## Requirements

### Requirement 1: Player Rating Computation

**User Story:** As a fan or administrator, I want to see an automatically computed rating for each player, so that I can quickly assess a player's quality based on their actual match performance.

#### Acceptance Criteria

1. THE Rating_Engine SHALL compute a Player_Rating for every Player who has at least one approved SeasonClubPlayer record.
2. WHEN computing a Player_Rating, THE Rating_Engine SHALL derive the score from the following weighted sub-factors across all seasons the player has participated in, applying a Season_Weight that gives the most recent season a weight of 1.0 and each prior season a weight reduced by 0.15 per season back (minimum weight 0.1):
   - Goals scored (EventType = "goal" or "penalty_goal"): +3.0 points per goal, capped contribution at 30 points
   - Assists (EventType = "assist", where the player is the relatedPlayer on a goal event): +2.0 points per assist, capped contribution at 20 points
   - Yellow cards (EventType = "yellow_card"): −1.5 points per card
   - Red cards (EventType = "red_card"): −4.0 points per card
   - Appearances (distinct matches where the player has at least one MatchEvent or MatchLineup entry): +0.5 points per appearance, capped contribution at 15 points
   - Clean sheets (goalkeeper only — matches where the player's club conceded 0 goals and the player appeared): +2.0 points per clean sheet, capped contribution at 10 points
3. THE Rating_Engine SHALL normalize the raw weighted sum to the [0, 100] range using a configurable baseline maximum raw score of 100.
4. THE Rating_Engine SHALL clamp the final Player_Rating to the range [0, 100].
5. WHEN a Player has no match data (no events, no lineups), THE Rating_Engine SHALL assign a Player_Rating of 0.

---

### Requirement 2: Club Rating Computation

**User Story:** As a fan or administrator, I want to see an automatically computed rating for each club, so that I can understand a club's overall quality based on their league performance.

#### Acceptance Criteria

1. THE Rating_Engine SHALL compute a Club_Rating for every Club that has participated in at least one Season.
2. WHEN computing a Club_Rating, THE Rating_Engine SHALL aggregate performance across all seasons the club has participated in, applying the same Season_Weight decay as Player ratings (most recent season weight 1.0, −0.15 per prior season, minimum 0.1), using the following sub-factors:
   - Win rate (wins / matches played): contributes up to 40 points (win_rate × 40)
   - Goal difference per match (goalDifference / matchesPlayed): contributes up to 20 points, normalized against a configurable maximum of +2.0 goals/match
   - Points per match (points / matchesPlayed): contributes up to 25 points, normalized against a configurable maximum of 3.0 points/match
   - Discipline penalty (total yellow cards × 0.5 + total red cards × 2.0 across all club players in the season): subtracted from the raw score, capped deduction at 15 points
3. THE Rating_Engine SHALL normalize the raw weighted sum to the [0, 100] range.
4. THE Rating_Engine SHALL clamp the final Club_Rating to the range [0, 100].
5. WHEN a Club has no completed season data, THE Rating_Engine SHALL assign a Club_Rating of 0.

---

### Requirement 3: League Rating Computation

**User Story:** As a fan or administrator, I want to see an automatically computed rating for each league, so that I can gauge the league's overall quality and activity level.

#### Acceptance Criteria

1. THE Rating_Engine SHALL compute a League_Rating for every League that has at least one Season.
2. WHEN computing a League_Rating, THE Rating_Engine SHALL use the following sub-factors aggregated across all seasons of the league, applying equal weight to every season regardless of recency:
   - Season completion rate (seasons with status "completed" / total seasons): contributes up to 20 points
   - Average goals per match across all completed seasons: contributes up to 20 points, normalized against a configurable maximum of 4.0 goals/match
   - Average Club_Rating of all clubs that have participated in the league: contributes up to 40 points (averageClubRating × 0.4)
   - Match activity rate (total approved/completed matches / total scheduled matches across all seasons): contributes up to 20 points
3. THE Rating_Engine SHALL clamp the final League_Rating to the range [0, 100].
4. WHEN a League has no seasons or no completed matches, THE Rating_Engine SHALL assign a League_Rating of 0.

---

### Requirement 4: Coach Rating Computation

**User Story:** As a fan or administrator, I want to see an automatically computed rating for each coach, so that I can evaluate a coach's effectiveness based on their managed clubs' performance.

#### Acceptance Criteria

1. THE Rating_Engine SHALL compute a Coach_Rating for every Coach who has at least one SeasonClubCoach record with status "active" or "approved".
2. WHEN computing a Coach_Rating, THE Rating_Engine SHALL derive the score from the following sub-factors across all seasons the coach has been active, applying the same Season_Weight decay:
   - Weighted average Club_Rating of clubs managed during each season: contributes up to 60 points (weightedAvgClubRating × 0.6)
   - Win rate of the club during the coach's active seasons: contributes up to 30 points (winRate × 30)
   - Discipline of managed club (inverse of discipline penalty from Club_Rating formula): contributes up to 10 points
3. THE Rating_Engine SHALL clamp the final Coach_Rating to the range [0, 100].
4. WHEN a Coach has no active season records, THE Rating_Engine SHALL assign a Coach_Rating of 0.

---

### Requirement 5: Referee Activity Score Computation

**User Story:** As a fan or administrator, I want to see an automatically computed activity score for each referee, so that I can understand a referee's activity level and consistency.

#### Acceptance Criteria

1. THE Rating_Engine SHALL compute a Referee_Activity_Score for every Referee who has at least one MatchReferee record.
2. WHEN computing a Referee_Activity_Score, THE Rating_Engine SHALL use the following sub-factors to measure activity and consistency — not quality:
   - Match assignment rate (total matches assigned / total matches in assigned seasons): contributes up to 50 points
   - Seasons assigned (distinct seasons via SeasonReferee): contributes up to 30 points, normalized against a configurable maximum of 10 seasons
   - Consistency score (1 − stddev of cards-per-match across assigned matches, normalized): contributes up to 20 points
3. THE Rating_Engine SHALL clamp the final Referee_Activity_Score to the range [0, 100].
4. WHEN a Referee has no match assignments, THE Rating_Engine SHALL assign a Referee_Activity_Score of 0.

---

### Requirement 6: Automatic Rating Triggers

**User Story:** As a system operator, I want ratings to update automatically when relevant data changes, so that displayed ratings always reflect the latest match data without manual intervention.

#### Acceptance Criteria

1. WHEN a match is approved (status transitions to "approved"), THE Rating_Engine SHALL recompute the Player_Rating for all players who appeared in that match, the Club_Rating for both clubs in that match, the League_Rating for the league that owns the match's season, the Coach_Rating for all coaches active in both clubs during that season, and the Referee_Activity_Score for the referee assigned to that match.
2. WHEN a MatchEvent is created or deleted, THE Rating_Engine SHALL recompute the Player_Rating for the player referenced in the event and the Club_Rating for the club referenced in the event.
3. WHEN a Season status transitions to "completed", THE Rating_Engine SHALL recompute Club_Ratings for all clubs in that season, Player_Ratings for all players in that season, Coach_Ratings for all coaches in that season, and the League_Rating for the league owning that season.
4. THE Rating_Engine SHALL perform rating recomputation asynchronously so that the triggering API request (match approval, event creation) returns a response without waiting for rating computation to finish.
5. IF a rating recomputation fails, THE Rating_Engine SHALL log the failure with the entity type, entity ID, and error details, and SHALL retain the previously computed rating value.

---

### Requirement 7: Rating Persistence and History

**User Story:** As a fan or administrator, I want to see a player's or club's rating history over time, so that I can understand how their performance has evolved across seasons.

#### Acceptance Criteria

1. THE System SHALL persist each computed Rating_Score in a dedicated `EntityRating` table storing: entity type (player/club/league/coach/referee), entity ID, rating value, and computation timestamp.
2. WHEN a rating is recomputed, THE System SHALL update the current rating record for that entity and SHALL insert a new Rating_Snapshot record preserving the previous value and its timestamp.
3. THE System SHALL expose a `GET /api/ratings/:entityType/:entityId/history` endpoint that returns the Rating_Snapshot records for the specified entity, ordered by timestamp descending.
4. THE System SHALL expose a `GET /api/ratings/:entityType/:entityId` endpoint that returns the current Rating_Score and tier for the specified entity.
5. THE System SHALL expose a `GET /api/ratings/:entityType` endpoint that returns current ratings for all entities of the given type, sorted by rating descending, with pagination support (default page size 20).

---

### Requirement 8: First-Run Backfill

**User Story:** As a system operator, I want ratings to be automatically computed from existing match data on first startup, so that the system is immediately useful without requiring manual intervention.

#### Acceptance Criteria

1. WHEN the system starts and no EntityRating records exist in the database, THE Rating_Engine SHALL automatically trigger a full recomputation of all entity ratings using all available match data.
2. THE Rating_Engine SHALL perform the first-run backfill asynchronously so that the application startup is not blocked.
3. IF the first-run backfill fails for any entity, THE Rating_Engine SHALL log the failure with the entity type, entity ID, and error details, and SHALL continue processing remaining entities.
4. WHEN the first-run backfill completes, THE System SHALL log a summary including the total number of entities processed and any failures encountered.

---

### Requirement 9: Rating Configuration (Super Admin)

**User Story:** As a Super Admin, I want to configure the weights and parameters used in rating formulas, so that I can tune the system to reflect the league's priorities without code changes.

#### Acceptance Criteria

1. THE Super_Admin SHALL be able to view and edit the following rating formula parameters via the system configuration page: goal weight, assist weight, yellow card penalty, red card penalty, appearance weight, clean sheet weight, win rate weight, goal difference normalization maximum, points per match normalization maximum, season decay rate, and season minimum weight.
2. WHEN a Super Admin saves updated rating parameters, THE System SHALL persist the new values and SHALL trigger a full recomputation of all entity ratings using the updated parameters.
3. THE System SHALL store rating configuration in a dedicated `RatingConfig` table with a single active configuration record.
4. THE System SHALL provide default values for all rating parameters that match the formulas defined in Requirements 1–5.
5. IF a Super Admin sets a weight to a value outside the allowed range (weights: 0.0–10.0; penalties: 0.0–10.0; normalization maxima: 0.1–100.0; decay rate: 0.0–1.0), THEN THE System SHALL reject the update with a descriptive validation error.

---

### Requirement 10: Rating Data Integrity

**User Story:** As a system operator, I want rating computations to be consistent and reproducible, so that the same input data always produces the same rating output.

#### Acceptance Criteria

1. THE Rating_Engine SHALL be a pure function of its inputs: given the same match events, standings data, and configuration parameters, THE Rating_Engine SHALL always produce the same Rating_Score.
2. WHEN the Rating_Engine recomputes a rating, THE System SHALL read all relevant data from the database within a single read transaction to ensure a consistent snapshot.
3. THE System SHALL expose a `POST /api/ratings/recompute` endpoint (Super Admin only) that triggers a full recomputation of all entity ratings on demand.
4. WHEN a full recomputation is triggered, THE System SHALL process entities in the following order: Players → Clubs → Coaches → Referees → Leagues, so that Club_Ratings are available when computing Coach and League ratings.
5. THE Rating_Engine SHALL handle the case where a referenced entity (player, club, season) has been soft-deleted or deactivated by excluding that entity's data from the computation without failing.

