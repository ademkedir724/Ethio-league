# Design Document — Fan API

## Overview

The Fan API is a collection of public, read-only Next.js App Router route handlers under `app/api/fan/`. No authentication is required. All handlers query Prisma directly, filter to `status = "active"` or `"completed"` data, and return JSON using the existing `success()`, `badRequest()`, `notFound()`, and `serverError()` helpers from `@/lib/api-helpers`.

---

## Architecture

```
External Fan Client
        │
        ▼
  Next.js App Router
  app/api/fan/**
        │
        ▼
  Prisma Client (PostgreSQL)
        │
        ├── League / Season / Club / Player / Coach / Match
        ├── MatchEvent / MatchLineup / MatchMedia / MatchReferee
        ├── SeasonClub / SeasonClubPlayer / SeasonClubCoach
        ├── EntityRating / RatingSnapshot
        └── Stadium / Position / EventType / LeagueType
```

No middleware, no auth layer, no audit logging. Each route handler is a standalone `GET` function.

---

## Shared Patterns

### Public data filter
All queries that list records apply `status: { in: ["active", "completed"] }` unless the entity uses different status vocabulary (e.g. matches use `"scheduled"`, `"live"`, `"completed"` — all are public).

### Query parameter parsing
Each handler reads `req.nextUrl.searchParams` and builds a Prisma `where` object conditionally.

### UUID validation
Path params are validated with `parseUUID()` from `@/lib/api-helpers`. Invalid UUIDs return HTTP 400.

### Standings computation
Reuses `computeStandings(matches, pointsWin, pointsDraw)` from `@/lib/standings`.

### Rating lookup
```ts
const rating = await prisma.entityRating.findUnique({
  where: { entityType_entityId: { entityType: "player", entityId: id } }
});
```

---

## File Structure

```
app/api/fan/
├── leagues/
│   ├── route.ts                          # GET /api/fan/leagues
│   └── [id]/
│       ├── route.ts                      # GET /api/fan/leagues/[id]
│       ├── seasons/route.ts              # GET /api/fan/leagues/[id]/seasons
│       └── stats/route.ts               # GET /api/fan/leagues/[id]/stats
├── seasons/
│   └── [id]/
│       ├── route.ts                      # GET /api/fan/seasons/[id]
│       ├── standings/route.ts            # GET /api/fan/seasons/[id]/standings
│       ├── matches/route.ts              # GET /api/fan/seasons/[id]/matches
│       ├── top-scorers/route.ts          # GET /api/fan/seasons/[id]/top-scorers
│       ├── discipline/route.ts           # GET /api/fan/seasons/[id]/discipline
│       ├── clubs/route.ts               # GET /api/fan/seasons/[id]/clubs
│       └── players/route.ts             # GET /api/fan/seasons/[id]/players
├── clubs/
│   ├── route.ts                          # GET /api/fan/clubs
│   └── [id]/
│       ├── route.ts                      # GET /api/fan/clubs/[id]
│       ├── seasons/route.ts              # GET /api/fan/clubs/[id]/seasons
│       ├── players/route.ts             # GET /api/fan/clubs/[id]/players
│       ├── coaches/route.ts             # GET /api/fan/clubs/[id]/coaches
│       ├── matches/route.ts             # GET /api/fan/clubs/[id]/matches
│       └── stats/route.ts               # GET /api/fan/clubs/[id]/stats
├── players/
│   ├── route.ts                          # GET /api/fan/players
│   └── [id]/
│       ├── route.ts                      # GET /api/fan/players/[id]
│       ├── seasons/route.ts              # GET /api/fan/players/[id]/seasons
│       ├── stats/route.ts               # GET /api/fan/players/[id]/stats
│       └── matches/route.ts             # GET /api/fan/players/[id]/matches
├── matches/
│   ├── route.ts                          # GET /api/fan/matches
│   └── [id]/
│       ├── route.ts                      # GET /api/fan/matches/[id]
│       ├── events/route.ts              # GET /api/fan/matches/[id]/events
│       ├── lineups/route.ts             # GET /api/fan/matches/[id]/lineups
│       └── media/route.ts               # GET /api/fan/matches/[id]/media
├── coaches/
│   └── [id]/
│       ├── route.ts                      # GET /api/fan/coaches/[id]
│       └── seasons/route.ts              # GET /api/fan/coaches/[id]/seasons
├── ratings/
│   ├── players/route.ts                  # GET /api/fan/ratings/players
│   ├── clubs/route.ts                    # GET /api/fan/ratings/clubs
│   └── [entityType]/
│       └── [entityId]/
│           └── history/route.ts          # GET /api/fan/ratings/[entityType]/[entityId]/history
└── search/
    └── route.ts                          # GET /api/fan/search
```

---

## Route Designs

### GET /api/fan/leagues

**Query params:** `search`, `leagueTypeId`, `genderCategory`, `ageCategory`, `organizationId`, `status`

**Prisma query:**
```ts
prisma.league.findMany({
  where: {
    status: status ?? "active",
    ...(search && { name: { contains: search, mode: "insensitive" } }),
    ...(leagueTypeId && { leagueTypeId: Number(leagueTypeId) }),
    ...(genderCategory && { genderCategory }),
    ...(ageCategory && { ageCategory }),
    ...(organizationId && { organizationId }),
  },
  include: {
    organization: { select: { id: true, name: true } },
    leagueType: { select: { id: true, name: true } },
    _count: { select: { seasons: true } },
  },
  orderBy: { name: "asc" },
})
```

---

### GET /api/fan/leagues/[id]

**Prisma query:**
```ts
prisma.league.findUnique({
  where: { id },
  include: {
    organization: true,
    leagueType: true,
    seasons: {
      select: { id: true, name: true, status: true, startDate: true, endDate: true },
      orderBy: { startDate: "desc" },
    },
  },
})
// + entityRating lookup for entityType="league"
```

---

### GET /api/fan/leagues/[id]/seasons

**Query params:** `status`

**Prisma query:**
```ts
prisma.season.findMany({
  where: { leagueId: id, ...(status && { status }) },
  include: {
    _count: { select: { seasonClubs: true, matches: true } },
  },
  orderBy: { startDate: "desc" },
})
```

---

### GET /api/fan/leagues/[id]/stats

**Aggregation logic:**
1. Fetch all seasons for the league
2. Fetch all completed matches across those seasons with scores
3. Compute: totalSeasons, totalMatches, totalGoals (sum homeScore + awayScore), distinctClubs (Set of clubIds from SeasonClub)
4. avgGoalsPerMatch = totalGoals / totalMatches (or 0)
5. Top scorer: aggregate goal events across all seasons, group by playerId, sort desc
6. Most titles: for each completed season, compute standings, take rank-1 club, count per club

**Response shape:**
```json
{
  "totalSeasons": 5,
  "totalMatches": 120,
  "totalGoals": 340,
  "totalClubs": 18,
  "avgGoalsPerMatch": 2.83,
  "topScorer": { "playerId": "...", "playerName": "...", "clubName": "...", "goals": 45 },
  "mostTitlesClub": { "clubId": "...", "clubName": "...", "titles": 3 }
}
```

---

### GET /api/fan/seasons/[id]

**Prisma query:**
```ts
prisma.season.findUnique({
  where: { id },
  include: {
    league: { include: { organization: { select: { id: true, name: true } } } },
    _count: { select: { seasonClubs: true, matches: true } },
  },
})
```

---

### GET /api/fan/seasons/[id]/standings

**Query params:** `clubId` (for highlight)

Reuses `computeStandings()`. After computing, if `clubId` is provided, adds `highlight: true` to the matching row.

---

### GET /api/fan/seasons/[id]/matches

**Query params:** `round`, `clubId`, `status`, `from`, `to`

**Prisma query:**
```ts
prisma.match.findMany({
  where: {
    seasonId: id,
    ...(round && { roundNumber: Number(round) }),
    ...(clubId && { OR: [{ homeClubId: clubId }, { awayClubId: clubId }] }),
    ...(status && { status }),
    ...(from && { matchDate: { gte: new Date(from) } }),
    ...(to && { matchDate: { lte: new Date(to) } }),
  },
  include: {
    homeClub: { select: { id: true, name: true, logoUrl: true } },
    awayClub: { select: { id: true, name: true, logoUrl: true } },
    stadium: { select: { id: true, name: true, city: true } },
  },
  orderBy: { matchDate: "asc" },
})
```

---

### GET /api/fan/seasons/[id]/top-scorers

**Query params:** `limit`, `clubId`

Fetches goal/penalty_goal events for the season, aggregates by playerId, optionally filters by clubId, sorts desc, applies limit.

---

### GET /api/fan/seasons/[id]/discipline

**Query params:** `clubId`, `limit`

Fetches yellow_card and red_card events for the season. Aggregates by player (and by club). Returns:
```json
{
  "byPlayer": [{ "playerId": "...", "playerName": "...", "clubName": "...", "yellowCards": 3, "redCards": 1 }],
  "byClub": [{ "clubId": "...", "clubName": "...", "yellowCards": 12, "redCards": 2 }]
}
```

---

### GET /api/fan/seasons/[id]/clubs

**Query params:** `search`

```ts
prisma.seasonClub.findMany({
  where: {
    seasonId: id,
    club: { ...(search && { name: { contains: search, mode: "insensitive" } }) },
  },
  include: {
    club: {
      include: { primaryStadium: { select: { id: true, name: true } } },
    },
  },
})
```

---

### GET /api/fan/seasons/[id]/players

**Query params:** `search`, `clubId`, `positionId`, `nationality`

```ts
prisma.seasonClubPlayer.findMany({
  where: {
    seasonClub: {
      seasonId: id,
      ...(clubId && { clubId }),
    },
    player: {
      ...(search && { OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ]}),
      ...(nationality && { nationality }),
    },
    ...(positionId && { positionId: Number(positionId) }),
  },
  include: {
    player: { include: { primaryPosition: true } },
    seasonClub: { include: { club: { select: { id: true, name: true } } } },
  },
})
```

---

### GET /api/fan/clubs

**Query params:** `search`, `leagueId`, `city`, `country`

```ts
prisma.club.findMany({
  where: {
    status: "active",
    ...(search && { name: { contains: search, mode: "insensitive" } }),
    ...(leagueId && { leagueId }),
    ...(city && { city: { contains: city, mode: "insensitive" } }),
    ...(country && { country: { contains: country, mode: "insensitive" } }),
  },
  include: {
    primaryStadium: { select: { id: true, name: true } },
    _count: { select: { seasonClubs: true } },
  },
  orderBy: { name: "asc" },
})
```

---

### GET /api/fan/clubs/[id]

Returns full club profile + primary stadium + current season squad + rating score + current standing position.

**Logic:**
1. Fetch club with primaryStadium
2. Find most recent active season for this club via SeasonClub
3. Fetch SeasonClubPlayer records for that season
4. Fetch EntityRating for entityType="club"
5. Compute standings for that season, find club's position

---

### GET /api/fan/clubs/[id]/seasons

Returns per-season history. For each SeasonClub record:
1. Fetch completed matches for that season where club is home or away
2. Compute W/D/L, GF/GA/GD, points using the same logic as computeStandings
3. Compute standings to get final position
4. Find top scorer for that club in that season

**Response shape per season:**
```json
{
  "seasonId": "...",
  "seasonName": "2023/24",
  "leagueId": "...",
  "leagueName": "Premier League",
  "position": 3,
  "played": 30,
  "won": 18,
  "drawn": 7,
  "lost": 5,
  "goalsFor": 55,
  "goalsAgainst": 28,
  "goalDifference": 27,
  "points": 61,
  "topScorer": { "playerId": "...", "playerName": "...", "goals": 12 }
}
```

---

### GET /api/fan/clubs/[id]/players

**Query params:** `seasonId`, `positionId`, `search`

If `seasonId` provided: query SeasonClubPlayer via SeasonClub. Otherwise query Player by originClub.

---

### GET /api/fan/clubs/[id]/coaches

**Query params:** `seasonId`

Query SeasonClubCoach via SeasonClub, include Coach details.

---

### GET /api/fan/clubs/[id]/matches

**Query params:** `seasonId`, `status`, `from`, `to`

```ts
prisma.match.findMany({
  where: {
    OR: [{ homeClubId: id }, { awayClubId: id }],
    ...(seasonId && { seasonId }),
    ...(status && { status }),
    ...(from && { matchDate: { gte: new Date(from) } }),
    ...(to && { matchDate: { lte: new Date(to) } }),
  },
  include: {
    homeClub: { select: { id: true, name: true, logoUrl: true } },
    awayClub: { select: { id: true, name: true, logoUrl: true } },
    stadium: { select: { id: true, name: true } },
    season: { select: { id: true, name: true } },
  },
  orderBy: { matchDate: "desc" },
})
```

---

### GET /api/fan/clubs/[id]/stats

**Aggregation logic:**
1. Fetch all SeasonClub records for the club → totalSeasons
2. Fetch all matches (home + away) → totalMatches, W/D/L, GF/GA
3. winRate = (wins / totalMatches) * 100
4. bestSeason: season with highest points (compute per season)
5. trophies: count seasons where club finished position 1
6. EntityRating score + RatingSnapshot history

---

### GET /api/fan/players

**Query params:** `search`, `nationality`, `positionId`, `clubId`, `leagueId`, `seasonId`

```ts
prisma.player.findMany({
  where: {
    status: "active",
    ...(search && { OR: [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
    ]}),
    ...(nationality && { nationality }),
    ...(positionId && { primaryPositionId: Number(positionId) }),
    ...(clubId && { clubId }),
    ...(seasonId && { seasonClubPlayers: { some: { seasonClub: { seasonId } } } }),
    ...(leagueId && { seasonClubPlayers: { some: { seasonClub: { season: { leagueId } } } } }),
  },
  include: {
    primaryPosition: { select: { id: true, name: true, code: true } },
    originClub: { select: { id: true, name: true } },
  },
  orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
})
```

---

### GET /api/fan/players/[id]

Returns full player profile + primary position + current club (most recent SeasonClubPlayer) + EntityRating.

---

### GET /api/fan/players/[id]/seasons

Career history per season. For each SeasonClubPlayer record:
1. Count MatchLineup entries → appearances
2. Count goal events → goals
3. Count assist events → assists
4. Count yellow/red card events → cards
5. Lookup RatingSnapshot for that season period (closest snapshotAt to season endDate)

---

### GET /api/fan/players/[id]/stats

All-time aggregated:
1. Sum appearances, goals, assists, yellow cards, red cards across all seasons
2. goalsPerMatch = totalGoals / totalAppearances
3. bestSeason = season with most goals
4. Distinct clubs and leagues
5. EntityRating score + RatingSnapshot history

---

### GET /api/fan/players/[id]/matches

**Query params:** `seasonId`, `clubId`

```ts
prisma.matchLineup.findMany({
  where: {
    seasonClubPlayer: {
      playerId: id,
      ...(clubId && { seasonClub: { clubId } }),
      ...(seasonId && { seasonClub: { seasonId } }),
    },
  },
  include: {
    match: {
      include: {
        homeClub: { select: { id: true, name: true, logoUrl: true } },
        awayClub: { select: { id: true, name: true, logoUrl: true } },
        season: { select: { id: true, name: true } },
      },
    },
  },
  orderBy: { match: { matchDate: "desc" } },
})
```

---

### GET /api/fan/matches

**Query params:** `seasonId`, `clubId`, `status`, `round`, `from`, `to`, `stadiumId`

```ts
prisma.match.findMany({
  where: {
    ...(seasonId && { seasonId }),
    ...(clubId && { OR: [{ homeClubId: clubId }, { awayClubId: clubId }] }),
    ...(status && { status }),
    ...(round && { roundNumber: Number(round) }),
    ...(from && { matchDate: { gte: new Date(from) } }),
    ...(to && { matchDate: { lte: new Date(to) } }),
    ...(stadiumId && { stadiumId }),
  },
  include: {
    homeClub: { select: { id: true, name: true, logoUrl: true } },
    awayClub: { select: { id: true, name: true, logoUrl: true } },
    stadium: { select: { id: true, name: true, city: true } },
    season: { select: { id: true, name: true } },
  },
  orderBy: { matchDate: "desc" },
})
```

---

### GET /api/fan/matches/[id]

```ts
prisma.match.findUnique({
  where: { id },
  include: {
    homeClub: true,
    awayClub: true,
    stadium: true,
    season: { include: { league: true } },
    matchReferees: { include: { referee: { select: { id: true, firstName: true, lastName: true } } } },
  },
})
```

---

### GET /api/fan/matches/[id]/events

```ts
prisma.matchEvent.findMany({
  where: { matchId: id },
  include: {
    eventType: { select: { id: true, name: true } },
    player: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
    relatedPlayer: { select: { id: true, firstName: true, lastName: true } },
    club: { select: { id: true, name: true } },
  },
  orderBy: [{ minute: "asc" }, { extraTime: "asc" }],
})
```

---

### GET /api/fan/matches/[id]/lineups

Fetch MatchLineup records, group by club (home/away), split into `starting` and `bench` arrays.

```ts
prisma.matchLineup.findMany({
  where: { matchId: id },
  include: {
    seasonClubPlayer: {
      include: {
        player: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
        seasonClub: { select: { clubId: true } },
      },
    },
    position: { select: { id: true, name: true, code: true } },
  },
})
```

**Response shape:**
```json
{
  "home": {
    "clubId": "...", "clubName": "...",
    "starting": [{ "playerId": "...", "playerName": "...", "shirtNumber": 9, "position": "FW", "isCaptain": true }],
    "bench": [...]
  },
  "away": { ... }
}
```

---

### GET /api/fan/matches/[id]/media

**Query params:** `mediaType`

```ts
prisma.matchMedia.findMany({
  where: {
    matchId: id,
    ...(mediaType && { mediaType }),
  },
  orderBy: { sortOrder: "asc" },
})
```

---

### GET /api/fan/coaches/[id]

```ts
prisma.coach.findUnique({
  where: { id },
  include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
})
```

---

### GET /api/fan/coaches/[id]/seasons

```ts
prisma.seasonClubCoach.findMany({
  where: { coachId: id },
  include: {
    seasonClub: {
      include: {
        club: { select: { id: true, name: true } },
        season: { include: { league: { select: { id: true, name: true } } } },
      },
    },
  },
  orderBy: { seasonClub: { season: { startDate: "desc" } } },
})
```

---

### GET /api/fan/ratings/players

**Query params:** `leagueId`, `seasonId`, `limit`, `search`

```ts
prisma.entityRating.findMany({
  where: {
    entityType: "player",
    ...(leagueId || seasonId || search ? {
      // join via player
    } : {}),
  },
  orderBy: { score: "desc" },
  take: limit ? Number(limit) : 50,
})
```

For `leagueId`/`seasonId` filters, fetch matching playerIds first via SeasonClubPlayer, then filter EntityRating by those IDs.

---

### GET /api/fan/ratings/clubs

**Query params:** `leagueId`, `limit`, `search`

Same pattern as player ratings but for `entityType: "club"`.

---

### GET /api/fan/ratings/[entityType]/[entityId]/history

```ts
prisma.ratingSnapshot.findMany({
  where: { entityType, entityId },
  orderBy: { snapshotAt: "desc" },
})
```

Validates `entityType` is `"player"` or `"club"`, validates `entityId` is a UUID.

---

### GET /api/fan/search

**Query params:** `q` (required), `type` (optional)

Runs up to 5 parallel Prisma queries (one per entity type), each limited to 10 results:

```ts
// leagues
prisma.league.findMany({
  where: { status: "active", name: { contains: q, mode: "insensitive" } },
  take: 10,
})

// clubs
prisma.club.findMany({
  where: { status: "active", name: { contains: q, mode: "insensitive" } },
  take: 10,
})

// players
prisma.player.findMany({
  where: {
    status: "active",
    OR: [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
    ],
  },
  take: 10,
})

// coaches
prisma.coach.findMany({
  where: {
    status: "active",
    OR: [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
    ],
  },
  take: 10,
})

// matches (search by club name)
prisma.match.findMany({
  where: {
    OR: [
      { homeClub: { name: { contains: q, mode: "insensitive" } } },
      { awayClub: { name: { contains: q, mode: "insensitive" } } },
    ],
  },
  include: {
    homeClub: { select: { id: true, name: true } },
    awayClub: { select: { id: true, name: true } },
  },
  take: 10,
})
```

When `?type` is provided, only the matching query runs. Returns:
```json
{
  "leagues": [...],
  "clubs": [...],
  "players": [...],
  "coaches": [...],
  "matches": [...]
}
```

---

## Correctness Properties

1. **No auth leakage** — No route handler calls `requireAuth()`. Any request without a token must receive a 200 (or 4xx for bad input), never a 401.
2. **Status filter** — No record with `status = "pending"`, `"inactive"`, or `"draft"` appears in any list response.
3. **UUID validation** — Any path param that is not a valid UUID returns HTTP 400, never a 500.
4. **404 on missing resource** — Any request for a non-existent entity by valid UUID returns HTTP 404.
5. **Standings consistency** — The standings array for a season must have exactly as many rows as distinct clubs that appear in completed matches for that season.
6. **Aggregation correctness** — `totalGoals` in league stats equals the sum of `homeScore + awayScore` across all completed matches in that league's seasons.
7. **Search limit** — No entity type in a search response returns more than 10 results.
8. **Rating history order** — RatingSnapshot arrays are always ordered by `snapshotAt` descending.
