
# Requirements Document

## Introduction

The Fan API is a set of public, read-only HTTP endpoints under `/api/fan/` that expose league, season, club, player, coach, match, and rating data to external fan-facing websites and applications. All routes are unauthenticated — no login or token is required. Responses include only active/completed data (no draft, pending, or internal-only records). The API is designed to return maximum useful data including aggregated statistics, standings, and rating scores in a single request where practical.

The existing codebase uses Next.js App Router route handlers, Prisma ORM with PostgreSQL, and a set of shared helpers (`success()`, `badRequest()`, `notFound()`, `serverError()`, `parseUUID()`) from `@/lib/api-helpers`. The `computeStandings()` utility from `@/lib/standings` and the `EntityRating` / `RatingSnapshot` Prisma models are available for reuse.

---

## Glossary

- **Fan_API**: The collection of public route handlers under `/api/fan/`.
- **League**: A permanent competition entity owned by an Organization (Prisma model `League`).
- **Season**: A time-bounded edition of a League (Prisma model `Season`).
- **Club**: A football club that participates in Seasons (Prisma model `Club`).
- **Player**: An individual athlete registered to a Club in a Season (Prisma model `Player`).
- **Coach**: A coaching staff member assigned to a Club in a Season (Prisma model `Coach`).
- **Match**: A single fixture between two Clubs within a Season (Prisma model `Match`).
- **Standing**: A computed row in a season standings table derived from completed match results.
- **EntityRating**: A current rating score for a Player or Club (Prisma model `EntityRating`).
- **RatingSnapshot**: A historical rating score record for a Player or Club (Prisma model `RatingSnapshot`).
- **MatchEvent**: A recorded in-match event (goal, card, substitution, etc.) (Prisma model `MatchEvent`).
- **MatchLineup**: A player's match-day role (starting XI or bench) for a specific match (Prisma model `MatchLineup`).
- **MatchMedia**: A photo or video asset attached to a match (Prisma model `MatchMedia`).
- **SeasonClub**: The join record linking a Club to a Season (Prisma model `SeasonClub`).
- **SeasonClubPlayer**: The join record linking a Player to a SeasonClub (Prisma model `SeasonClubPlayer`).
- **SeasonClubCoach**: The join record linking a Coach to a SeasonClub (Prisma model `SeasonClubCoach`).
- **Public_Data**: Records with `status` values of `"active"` or `"completed"` only; records with `"pending"`, `"draft"`, `"inactive"`, or `"upcoming"` are excluded unless explicitly noted.
- **Aggregated_Stats**: Computed summary metrics (totals, averages, bests) derived from multiple records.

---

## Requirements

### Requirement 1: Public Access — No Authentication

**User Story:** As a fan website developer, I want to call Fan API endpoints without providing any authentication token, so that I can display public league data without managing user sessions.

#### Acceptance Criteria

1. THE Fan_API SHALL process all requests under `/api/fan/` without requiring an `Authorization` header or session cookie.
2. IF a request to any `/api/fan/` route includes an `Authorization` header, THE Fan_API SHALL ignore it and process the request normally.
3. THE Fan_API SHALL return only records whose `status` field is `"active"` or `"completed"` (Public_Data), unless a specific endpoint explicitly documents additional status values it exposes.

---

### Requirement 2: League List Endpoint

**User Story:** As a fan website developer, I want to list leagues with optional filtering, so that I can display a browsable directory of competitions.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/leagues`, THE Fan_API SHALL return an array of League records including their associated Organization name, LeagueType name, and total season count.
2. WHEN the `?search` query parameter is provided, THE Fan_API SHALL return only Leagues whose `name` contains the search string (case-insensitive).
3. WHEN the `?leagueTypeId` query parameter is provided, THE Fan_API SHALL return only Leagues matching that `leagueTypeId`.
4. WHEN the `?genderCategory` query parameter is provided, THE Fan_API SHALL return only Leagues matching that `genderCategory`.
5. WHEN the `?ageCategory` query parameter is provided, THE Fan_API SHALL return only Leagues matching that `ageCategory`.
6. WHEN the `?organizationId` query parameter is provided, THE Fan_API SHALL return only Leagues belonging to that Organization.
7. WHEN the `?status` query parameter is provided, THE Fan_API SHALL return only Leagues matching that `status` value.
8. WHEN no filters are provided, THE Fan_API SHALL return all Leagues with `status = "active"`.

---

### Requirement 3: League Detail Endpoint

**User Story:** As a fan, I want to view a league's full profile including its organization, type, seasons, and current rating score, so that I can understand the competition.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/leagues/[id]`, THE Fan_API SHALL return the League record including its Organization, LeagueType, list of Seasons (id, name, status, startDate, endDate), and the League's current EntityRating score if one exists.
2. IF the `[id]` path parameter is not a valid UUID, THE Fan_API SHALL return HTTP 400 with a descriptive error message.
3. IF no League with the given `[id]` exists, THE Fan_API SHALL return HTTP 404.

---

### Requirement 4: League Seasons Endpoint

**User Story:** As a fan, I want to list all seasons for a league with optional status filtering, so that I can navigate to a specific season.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/leagues/[id]/seasons`, THE Fan_API SHALL return an array of Season records for that League including club count and match count per season.
2. WHEN the `?status` query parameter is provided, THE Fan_API SHALL return only Seasons matching that status value.
3. IF the League does not exist, THE Fan_API SHALL return HTTP 404.

---

### Requirement 5: League All-Time Stats Endpoint

**User Story:** As a fan, I want to see aggregated all-time statistics for a league, so that I can understand its history at a glance.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/leagues/[id]/stats`, THE Fan_API SHALL return Aggregated_Stats including: total seasons count, total matches count, total goals scored, total distinct clubs that have participated, average goals per match, the all-time top scorer (player name, club, goal count), and the club with the most season titles (most times finishing first in standings).
2. IF the League has no completed Seasons, THE Fan_API SHALL return the stats object with zero values and null for top scorer and most-titles club.
3. IF the League does not exist, THE Fan_API SHALL return HTTP 404.

---

### Requirement 6: Season Detail Endpoint

**User Story:** As a fan, I want to view a season's full profile including its league, organization, and summary counts, so that I can understand the competition edition.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/seasons/[id]`, THE Fan_API SHALL return the Season record including its League, the League's Organization, total club count, and total match count.
2. IF the Season does not exist, THE Fan_API SHALL return HTTP 404.

---

### Requirement 7: Season Standings Endpoint

**User Story:** As a fan, I want to view the standings table for a season, so that I can see how clubs are ranked.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/seasons/[id]/standings`, THE Fan_API SHALL return a standings array computed from all completed matches in that Season using the `computeStandings()` utility, including club name, logo, played, won, drawn, lost, goals for, goals against, goal difference, and points.
2. WHEN the `?clubId` query parameter is provided, THE Fan_API SHALL include a `highlight` field on the matching standing row set to `true`.
3. IF the Season has no completed matches, THE Fan_API SHALL return an empty array.

---

### Requirement 8: Season Matches Endpoint

**User Story:** As a fan, I want to browse matches in a season with filtering options, so that I can find specific fixtures.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/seasons/[id]/matches`, THE Fan_API SHALL return an array of Match records for that Season including home club, away club, stadium, score, status, round number, and match date.
2. WHEN the `?round` query parameter is provided, THE Fan_API SHALL return only Matches with that `roundNumber`.
3. WHEN the `?clubId` query parameter is provided, THE Fan_API SHALL return only Matches where the Club is either the home or away club.
4. WHEN the `?status` query parameter is provided, THE Fan_API SHALL return only Matches with that status.
5. WHEN the `?from` query parameter is provided (ISO 8601 date), THE Fan_API SHALL return only Matches with `matchDate` on or after that date.
6. WHEN the `?to` query parameter is provided (ISO 8601 date), THE Fan_API SHALL return only Matches with `matchDate` on or before that date.

---

### Requirement 9: Season Top Scorers Endpoint

**User Story:** As a fan, I want to see the top scorers for a season, so that I can follow individual player performance.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/seasons/[id]/top-scorers`, THE Fan_API SHALL return a ranked array of players with their goal counts, player name, and club name, sorted descending by goals.
2. WHEN the `?limit` query parameter is provided as a positive integer, THE Fan_API SHALL return at most that many results.
3. WHEN the `?clubId` query parameter is provided, THE Fan_API SHALL return only top scorers from that Club.

---

### Requirement 10: Season Discipline Endpoint

**User Story:** As a fan, I want to see yellow and red card statistics for a season, so that I can track disciplinary records.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/seasons/[id]/discipline`, THE Fan_API SHALL return discipline data aggregated by player (player name, club, yellow cards, red cards) and by club (club name, yellow cards, red cards).
2. WHEN the `?clubId` query parameter is provided, THE Fan_API SHALL return only discipline records for players from that Club.
3. WHEN the `?limit` query parameter is provided as a positive integer, THE Fan_API SHALL return at most that many player rows.

---

### Requirement 11: Season Clubs Endpoint

**User Story:** As a fan, I want to list the clubs participating in a season, so that I can see who is competing.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/seasons/[id]/clubs`, THE Fan_API SHALL return an array of Club records registered in that Season including club name, logo, city, and country.
2. WHEN the `?search` query parameter is provided, THE Fan_API SHALL return only Clubs whose name contains the search string (case-insensitive).

---

### Requirement 12: Season Players Endpoint

**User Story:** As a fan, I want to browse players registered in a season with filtering options, so that I can find specific players.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/seasons/[id]/players`, THE Fan_API SHALL return an array of Player records registered in that Season including player name, nationality, position, jersey number, and their club name.
2. WHEN the `?search` query parameter is provided, THE Fan_API SHALL return only Players whose first or last name contains the search string (case-insensitive).
3. WHEN the `?clubId` query parameter is provided, THE Fan_API SHALL return only Players registered under that Club in the Season.
4. WHEN the `?positionId` query parameter is provided, THE Fan_API SHALL return only Players with that position.
5. WHEN the `?nationality` query parameter is provided, THE Fan_API SHALL return only Players with that nationality.

---

### Requirement 13: Club List Endpoint

**User Story:** As a fan website developer, I want to list clubs with optional filtering, so that I can display a browsable club directory.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/clubs`, THE Fan_API SHALL return an array of Club records with `status = "active"` including their primary stadium name and season participation count.
2. WHEN the `?search` query parameter is provided, THE Fan_API SHALL return only Clubs whose name contains the search string (case-insensitive).
3. WHEN the `?leagueId` query parameter is provided, THE Fan_API SHALL return only Clubs associated with that League.
4. WHEN the `?city` query parameter is provided, THE Fan_API SHALL return only Clubs in that city.
5. WHEN the `?country` query parameter is provided, THE Fan_API SHALL return only Clubs in that country.

---

### Requirement 14: Club Detail Endpoint

**User Story:** As a fan, I want to view a club's full profile including stadium, current squad, rating score, and current standing, so that I can learn about the club.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/clubs/[id]`, THE Fan_API SHALL return the Club record including its primary Stadium details, current season squad (players with name, position, jersey number), current EntityRating score if one exists, and the club's standing in its most recent active Season if available.
2. IF the Club does not exist, THE Fan_API SHALL return HTTP 404.

---

### Requirement 15: Club Season History Endpoint

**User Story:** As a fan, I want to see a club's season-by-season history, so that I can track its performance over time.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/clubs/[id]/seasons`, THE Fan_API SHALL return an array of season history records for that Club, each including: season name, league name, final standing position, wins, draws, losses, goals for, goals against, goal difference, points, and top scorer for that season.
2. THE Fan_API SHALL order the season history records by season start date descending (most recent first).

---

### Requirement 16: Club Players Endpoint

**User Story:** As a fan, I want to browse a club's squad with filtering options, so that I can find specific players.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/clubs/[id]/players`, THE Fan_API SHALL return an array of Player records registered to that Club including name, position, jersey number, nationality, and photo.
2. WHEN the `?seasonId` query parameter is provided, THE Fan_API SHALL return only Players registered in that specific Season.
3. WHEN the `?positionId` query parameter is provided, THE Fan_API SHALL return only Players with that position.
4. WHEN the `?search` query parameter is provided, THE Fan_API SHALL return only Players whose first or last name contains the search string (case-insensitive).

---

### Requirement 17: Club Coaches Endpoint

**User Story:** As a fan, I want to see a club's coaching staff, so that I can know who manages the team.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/clubs/[id]/coaches`, THE Fan_API SHALL return an array of Coach records assigned to that Club including name, role, nationality, and photo.
2. WHEN the `?seasonId` query parameter is provided, THE Fan_API SHALL return only Coaches assigned in that specific Season.

---

### Requirement 18: Club Matches Endpoint

**User Story:** As a fan, I want to browse a club's match history with filtering options, so that I can review past and upcoming fixtures.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/clubs/[id]/matches`, THE Fan_API SHALL return an array of Match records where the Club is either the home or away team, including opponent name, score, date, stadium, and status.
2. WHEN the `?seasonId` query parameter is provided, THE Fan_API SHALL return only Matches from that Season.
3. WHEN the `?status` query parameter is provided, THE Fan_API SHALL return only Matches with that status.
4. WHEN the `?from` query parameter is provided (ISO 8601 date), THE Fan_API SHALL return only Matches with `matchDate` on or after that date.
5. WHEN the `?to` query parameter is provided (ISO 8601 date), THE Fan_API SHALL return only Matches with `matchDate` on or before that date.

---

### Requirement 19: Club All-Time Stats Endpoint

**User Story:** As a fan, I want to see aggregated all-time statistics for a club, so that I can understand its overall record.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/clubs/[id]/stats`, THE Fan_API SHALL return Aggregated_Stats including: total seasons participated, total matches played, total wins, total draws, total losses, total goals scored, total goals conceded, win rate (percentage), best season (highest points), total trophies (seasons finished in first place), current EntityRating score, and EntityRating history (array of RatingSnapshot records).
2. IF the Club has no match history, THE Fan_API SHALL return the stats object with zero values and null for best season.
3. IF the Club does not exist, THE Fan_API SHALL return HTTP 404.

---

### Requirement 20: Player List Endpoint

**User Story:** As a fan website developer, I want to list players with optional filtering, so that I can display a searchable player directory.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/players`, THE Fan_API SHALL return an array of Player records with `status = "active"` including name, nationality, primary position, photo, and current club name.
2. WHEN the `?search` query parameter is provided, THE Fan_API SHALL return only Players whose first or last name contains the search string (case-insensitive).
3. WHEN the `?nationality` query parameter is provided, THE Fan_API SHALL return only Players with that nationality.
4. WHEN the `?positionId` query parameter is provided, THE Fan_API SHALL return only Players with that primary position.
5. WHEN the `?clubId` query parameter is provided, THE Fan_API SHALL return only Players whose origin club matches that Club.
6. WHEN the `?leagueId` query parameter is provided, THE Fan_API SHALL return only Players who have a SeasonClubPlayer record in a Season belonging to that League.
7. WHEN the `?seasonId` query parameter is provided, THE Fan_API SHALL return only Players registered in that Season.

---

### Requirement 21: Player Detail Endpoint

**User Story:** As a fan, I want to view a player's full profile including current club, position, and rating score, so that I can learn about the player.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/players/[id]`, THE Fan_API SHALL return the Player record including primary position, current club (most recent active SeasonClub), and current EntityRating score if one exists.
2. IF the Player does not exist, THE Fan_API SHALL return HTTP 404.

---

### Requirement 22: Player Career History Endpoint

**User Story:** As a fan, I want to see a player's season-by-season career history, so that I can track their development.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/players/[id]/seasons`, THE Fan_API SHALL return an array of career history records for that Player, each including: season name, league name, club name, appearances (matches with lineup entry), goals, assists, yellow cards, red cards, and EntityRating score for that season if available.
2. THE Fan_API SHALL order career history records by season start date descending (most recent first).

---

### Requirement 23: Player All-Time Stats Endpoint

**User Story:** As a fan, I want to see aggregated all-time statistics for a player, so that I can understand their overall career record.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/players/[id]/stats`, THE Fan_API SHALL return Aggregated_Stats including: total appearances, total goals, total assists, total yellow cards, total red cards, goals per match ratio, best season (most goals), total clubs played for, total leagues played in, current EntityRating score, and EntityRating history (array of RatingSnapshot records).
2. IF the Player has no match history, THE Fan_API SHALL return the stats object with zero values and null for best season.
3. IF the Player does not exist, THE Fan_API SHALL return HTTP 404.

---

### Requirement 24: Player Match Appearances Endpoint

**User Story:** As a fan, I want to browse a player's match appearances with filtering options, so that I can review their match-by-match record.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/players/[id]/matches`, THE Fan_API SHALL return an array of Match records where the Player has a MatchLineup entry, including match date, home club, away club, score, and the player's lineup type (starting or substitute).
2. WHEN the `?seasonId` query parameter is provided, THE Fan_API SHALL return only appearances from that Season.
3. WHEN the `?clubId` query parameter is provided, THE Fan_API SHALL return only appearances where the Player was registered under that Club.

---

### Requirement 25: Match List Endpoint

**User Story:** As a fan website developer, I want to list matches with filtering options, so that I can display fixture lists and results.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/matches`, THE Fan_API SHALL return an array of Match records including home club, away club, stadium, score, status, round number, and match date.
2. WHEN the `?seasonId` query parameter is provided, THE Fan_API SHALL return only Matches in that Season.
3. WHEN the `?clubId` query parameter is provided, THE Fan_API SHALL return only Matches where the Club is either the home or away team.
4. WHEN the `?status` query parameter is provided, THE Fan_API SHALL return only Matches with that status.
5. WHEN the `?round` query parameter is provided, THE Fan_API SHALL return only Matches with that `roundNumber`.
6. WHEN the `?from` query parameter is provided (ISO 8601 date), THE Fan_API SHALL return only Matches with `matchDate` on or after that date.
7. WHEN the `?to` query parameter is provided (ISO 8601 date), THE Fan_API SHALL return only Matches with `matchDate` on or before that date.
8. WHEN the `?stadiumId` query parameter is provided, THE Fan_API SHALL return only Matches played at that Stadium.

---

### Requirement 26: Match Detail Endpoint

**User Story:** As a fan, I want to view a match's full details including clubs, score, stadium, attendance, referees, and status, so that I can get a complete picture of the fixture.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/matches/[id]`, THE Fan_API SHALL return the Match record including home club details, away club details, stadium details, final score, attendance, assigned referees (name and role), and match status.
2. IF the Match does not exist, THE Fan_API SHALL return HTTP 404.

---

### Requirement 27: Match Events Endpoint

**User Story:** As a fan, I want to see the event timeline for a match, so that I can follow what happened minute by minute.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/matches/[id]/events`, THE Fan_API SHALL return an array of MatchEvent records ordered by minute ascending, each including: minute, extra time, event type name, player name, club name, and related player name if applicable.
2. IF the Match does not exist, THE Fan_API SHALL return HTTP 404.

---

### Requirement 28: Match Lineups Endpoint

**User Story:** As a fan, I want to see the starting XI and bench for both clubs in a match, so that I can know who played.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/matches/[id]/lineups`, THE Fan_API SHALL return lineup data grouped by club, each group containing starting XI players and bench players with player name, shirt number, position, and captain flag.
2. IF the Match does not exist, THE Fan_API SHALL return HTTP 404.

---

### Requirement 29: Match Media Endpoint

**User Story:** As a fan, I want to browse photos and videos from a match, so that I can relive the experience.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/matches/[id]/media`, THE Fan_API SHALL return an array of MatchMedia records ordered by `sortOrder` ascending, each including media URL, media type, and caption.
2. WHEN the `?mediaType` query parameter is provided with value `"image"` or `"video"`, THE Fan_API SHALL return only media of that type.
3. IF the Match does not exist, THE Fan_API SHALL return HTTP 404.

---

### Requirement 30: Coach Detail Endpoint

**User Story:** As a fan, I want to view a coach's profile, so that I can learn about the person managing a team.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/coaches/[id]`, THE Fan_API SHALL return the Coach record including name, photo, nationality, license level, and experience years.
2. IF the Coach does not exist, THE Fan_API SHALL return HTTP 404.

---

### Requirement 31: Coach Career History Endpoint

**User Story:** As a fan, I want to see a coach's season-by-season career history, so that I can track their coaching record.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/coaches/[id]/seasons`, THE Fan_API SHALL return an array of career history records for that Coach, each including: season name, league name, club name, and role.
2. THE Fan_API SHALL order career history records by season start date descending (most recent first).

---

### Requirement 32: Player Ratings Ranked List Endpoint

**User Story:** As a fan, I want to see a ranked list of players by rating score, so that I can discover the best performers.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/ratings/players`, THE Fan_API SHALL return a ranked array of players with their EntityRating score, player name, nationality, position, and current club, sorted descending by score.
2. WHEN the `?leagueId` query parameter is provided, THE Fan_API SHALL return only Players who have participated in a Season of that League.
3. WHEN the `?seasonId` query parameter is provided, THE Fan_API SHALL return only Players registered in that Season.
4. WHEN the `?limit` query parameter is provided as a positive integer, THE Fan_API SHALL return at most that many results.
5. WHEN the `?search` query parameter is provided, THE Fan_API SHALL return only Players whose name contains the search string (case-insensitive).

---

### Requirement 33: Club Ratings Ranked List Endpoint

**User Story:** As a fan, I want to see a ranked list of clubs by rating score, so that I can discover the top clubs.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/ratings/clubs`, THE Fan_API SHALL return a ranked array of clubs with their EntityRating score, club name, logo, city, and country, sorted descending by score.
2. WHEN the `?leagueId` query parameter is provided, THE Fan_API SHALL return only Clubs associated with that League.
3. WHEN the `?limit` query parameter is provided as a positive integer, THE Fan_API SHALL return at most that many results.
4. WHEN the `?search` query parameter is provided, THE Fan_API SHALL return only Clubs whose name contains the search string (case-insensitive).

---

### Requirement 34: Rating History Endpoint

**User Story:** As a fan, I want to see the rating score history for a player or club over time, so that I can track their performance trend.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/ratings/[entityType]/[entityId]/history`, THE Fan_API SHALL return an array of RatingSnapshot records for that entity ordered by `snapshotAt` descending.
2. WHEN `[entityType]` is not `"player"` or `"club"`, THE Fan_API SHALL return HTTP 400 with a descriptive error message.
3. IF `[entityId]` is not a valid UUID, THE Fan_API SHALL return HTTP 400 with a descriptive error message.

---

### Requirement 35: Global Search Endpoint

**User Story:** As a fan, I want to search across leagues, clubs, players, coaches, and matches in a single query, so that I can quickly find what I am looking for.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/fan/search` with a `?q` query parameter, THE Fan_API SHALL return a results object containing matching records grouped by entity type: leagues, clubs, players, coaches, and matches.
2. WHEN the `?type` query parameter is provided with one of `"league"`, `"club"`, `"player"`, `"coach"`, or `"match"`, THE Fan_API SHALL return results for only that entity type.
3. THE Fan_API SHALL search League records by name, Club records by name, Player records by first name or last name, Coach records by first name or last name, and Match records by home club name or away club name.
4. IF the `?q` query parameter is absent or empty, THE Fan_API SHALL return HTTP 400 with a descriptive error message.
5. THE Fan_API SHALL return at most 10 results per entity type in the search response.
6. THE Fan_API SHALL only include Public_Data records in search results.

---

### Requirement 36: Consistent Error Responses

**User Story:** As a fan website developer, I want consistent error response shapes across all Fan API endpoints, so that I can handle errors uniformly in my client code.

#### Acceptance Criteria

1. WHEN any Fan_API endpoint encounters an invalid UUID path parameter, THE Fan_API SHALL return HTTP 400 with a JSON body containing an `error` string field.
2. WHEN any Fan_API endpoint cannot find the requested resource, THE Fan_API SHALL return HTTP 404 with a JSON body containing an `error` string field.
3. WHEN any Fan_API endpoint encounters an unexpected server error, THE Fan_API SHALL return HTTP 500 with a JSON body containing an `error` string field.
4. THE Fan_API SHALL return all successful responses as JSON with HTTP 200 status.
