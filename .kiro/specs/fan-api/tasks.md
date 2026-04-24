# Implementation Tasks — Fan API

## Tasks

- [x] 1. League routes
  - [x] 1.1 Create `app/api/fan/leagues/route.ts` — GET with search/filter query params
  - [x] 1.2 Create `app/api/fan/leagues/[id]/route.ts` — detail with org, leagueType, seasons, rating
  - [x] 1.3 Create `app/api/fan/leagues/[id]/seasons/route.ts` — seasons list with status filter and counts
  - [x] 1.4 Create `app/api/fan/leagues/[id]/stats/route.ts` — all-time aggregated stats

- [x] 2. Season routes
  - [x] 2.1 Create `app/api/fan/seasons/[id]/route.ts` — detail with league, org, club count, match count
  - [x] 2.2 Create `app/api/fan/seasons/[id]/standings/route.ts` — standings using computeStandings with clubId highlight
  - [x] 2.3 Create `app/api/fan/seasons/[id]/matches/route.ts` — match list with round/clubId/status/from/to filters
  - [x] 2.4 Create `app/api/fan/seasons/[id]/top-scorers/route.ts` — goal aggregation with limit/clubId filters
  - [x] 2.5 Create `app/api/fan/seasons/[id]/discipline/route.ts` — yellow/red card aggregation by player and club
  - [x] 2.6 Create `app/api/fan/seasons/[id]/clubs/route.ts` — clubs in season with search filter
  - [x] 2.7 Create `app/api/fan/seasons/[id]/players/route.ts` — players in season with search/clubId/positionId/nationality filters

- [x] 3. Club routes
  - [x] 3.1 Create `app/api/fan/clubs/route.ts` — list with search/leagueId/city/country filters
  - [x] 3.2 Create `app/api/fan/clubs/[id]/route.ts` — full profile with stadium, squad, rating, current standing
  - [x] 3.3 Create `app/api/fan/clubs/[id]/seasons/route.ts` — season history with W/D/L/GF/GA/position/top scorer per season
  - [x] 3.4 Create `app/api/fan/clubs/[id]/players/route.ts` — squad with seasonId/positionId/search filters
  - [x] 3.5 Create `app/api/fan/clubs/[id]/coaches/route.ts` — coaching staff with seasonId filter
  - [x] 3.6 Create `app/api/fan/clubs/[id]/matches/route.ts` — match history with seasonId/status/from/to filters
  - [x] 3.7 Create `app/api/fan/clubs/[id]/stats/route.ts` — all-time aggregated stats with rating and history

- [x] 4. Player routes
  - [x] 4.1 Create `app/api/fan/players/route.ts` — list with search/nationality/positionId/clubId/leagueId/seasonId filters
  - [x] 4.2 Create `app/api/fan/players/[id]/route.ts` — full profile with position, current club, rating
  - [x] 4.3 Create `app/api/fan/players/[id]/seasons/route.ts` — career history with appearances/goals/assists/cards per season
  - [x] 4.4 Create `app/api/fan/players/[id]/stats/route.ts` — all-time aggregated stats with rating and history
  - [x] 4.5 Create `app/api/fan/players/[id]/matches/route.ts` — match appearances with seasonId/clubId filters

- [x] 5. Match routes
  - [x] 5.1 Create `app/api/fan/matches/route.ts` — list with seasonId/clubId/status/round/from/to/stadiumId filters
  - [x] 5.2 Create `app/api/fan/matches/[id]/route.ts` — full detail with clubs, stadium, referees, score
  - [x] 5.3 Create `app/api/fan/matches/[id]/events/route.ts` — event timeline ordered by minute
  - [x] 5.4 Create `app/api/fan/matches/[id]/lineups/route.ts` — lineups grouped by club with starting/bench split
  - [x] 5.5 Create `app/api/fan/matches/[id]/media/route.ts` — media with mediaType filter

- [x] 6. Coach routes
  - [x] 6.1 Create `app/api/fan/coaches/[id]/route.ts` — coach profile
  - [x] 6.2 Create `app/api/fan/coaches/[id]/seasons/route.ts` — career history ordered by season start date desc

- [x] 7. Rating routes
  - [x] 7.1 Create `app/api/fan/ratings/players/route.ts` — ranked player list with leagueId/seasonId/limit/search filters
  - [x] 7.2 Create `app/api/fan/ratings/clubs/route.ts` — ranked club list with leagueId/limit/search filters
  - [x] 7.3 Create `app/api/fan/ratings/[entityType]/[entityId]/history/route.ts` — rating snapshots ordered desc

- [x] 8. Search route
  - [x] 8.1 Create `app/api/fan/search/route.ts` — global search across leagues/clubs/players/coaches/matches with type filter
