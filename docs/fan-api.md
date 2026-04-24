# Fan API — Developer Reference

Public, read-only API for fan-facing applications. No authentication required.

**Base URL:** `https://your-domain.com/api/fan`

**CORS:** Requests from `https://ethio-league-live.vercel.app` are allowed. All routes support `OPTIONS` preflight.

**All responses** are JSON. Successful responses return HTTP 200. Errors return `{ "error": "message" }` with the appropriate HTTP status code (400, 404, 500).

---

## Table of Contents

1. [Leagues](#leagues)
2. [Seasons](#seasons)
3. [Clubs](#clubs)
4. [Players](#players)
5. [Matches](#matches)
6. [Coaches](#coaches)
7. [Ratings](#ratings)
8. [Search](#search)

---

## Leagues

### List Leagues

```
GET /api/fan/leagues
```

Returns all active leagues. Use query params to filter.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `search` | string | Case-insensitive name search |
| `leagueTypeId` | number | Filter by league type ID |
| `genderCategory` | string | e.g. `"male"`, `"female"` |
| `ageCategory` | string | e.g. `"senior"`, `"u21"` |
| `organizationId` | UUID | Filter by organization |
| `status` | string | Default: `"active"`. Pass `"all"` to include inactive |

**Example**

```
GET /api/fan/leagues?search=premier&genderCategory=male
```

**Response**

```json
[
  {
    "id": "uuid",
    "name": "Ethiopian Premier League",
    "logoUrl": "https://...",
    "genderCategory": "male",
    "ageCategory": "senior",
    "divisionLevel": 1,
    "organization": { "id": "uuid", "name": "EFF", "logoUrl": "..." },
    "leagueType": { "id": 1, "name": "League" },
    "_count": { "seasons": 5, "clubs": 16 }
  }
]
```

---

### League Detail

```
GET /api/fan/leagues/:id
```

Returns full league profile including all seasons and current rating.

**Response**

```json
{
  "id": "uuid",
  "name": "Ethiopian Premier League",
  "logoUrl": "...",
  "description": "...",
  "organization": { "id": "uuid", "name": "EFF", "country": "Ethiopia" },
  "leagueType": { "id": 1, "name": "League" },
  "seasons": [
    { "id": "uuid", "name": "2023/24", "status": "completed", "startDate": "...", "endDate": "..." }
  ],
  "rating": { "score": 87.4, "computedAt": "..." }
}
```

---

### League Seasons

```
GET /api/fan/leagues/:id/seasons
```

Lists all seasons for a league with club and match counts.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter: `upcoming`, `active`, `completed` |

**Response**

```json
[
  {
    "id": "uuid",
    "name": "2023/24",
    "status": "completed",
    "startDate": "2023-09-01T00:00:00.000Z",
    "endDate": "2024-05-31T00:00:00.000Z",
    "_count": { "seasonClubs": 16, "matches": 240 }
  }
]
```

---

### League All-Time Stats

```
GET /api/fan/leagues/:id/stats
```

Aggregated all-time statistics for a league.

**Response**

```json
{
  "totalSeasons": 5,
  "totalMatches": 1200,
  "totalGoals": 3400,
  "totalClubs": 24,
  "avgGoalsPerMatch": 2.83,
  "topScorer": {
    "playerId": "uuid",
    "playerName": "Getaneh Kebede",
    "clubName": "St. George",
    "goals": 87
  },
  "mostTitlesClub": {
    "clubId": "uuid",
    "clubName": "St. George",
    "titles": 3
  }
}
```

---

## Seasons

### Season Detail

```
GET /api/fan/seasons/:id
```

Returns season info with league, organization, and summary counts.

**Response**

```json
{
  "id": "uuid",
  "name": "2023/24",
  "status": "active",
  "startDate": "...",
  "endDate": "...",
  "pointsWin": 3,
  "pointsDraw": 1,
  "league": {
    "id": "uuid",
    "name": "Ethiopian Premier League",
    "organization": { "id": "uuid", "name": "EFF" }
  },
  "_count": { "seasonClubs": 16, "matches": 240 }
}
```

---

### Season Standings

```
GET /api/fan/seasons/:id/standings
```

Returns the standings table computed from all completed matches.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `clubId` | UUID | Adds `highlight: true` to that club's row |

**Response**

```json
[
  {
    "rank": 1,
    "clubId": "uuid",
    "clubName": "St. George",
    "logoUrl": "...",
    "played": 20,
    "won": 14,
    "drawn": 4,
    "lost": 2,
    "goalsFor": 42,
    "goalsAgainst": 18,
    "goalDifference": 24,
    "points": 46,
    "highlight": true
  }
]
```

---

### Season Matches

```
GET /api/fan/seasons/:id/matches
```

Lists all matches in a season.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `round` | number | Filter by round number |
| `clubId` | UUID | Only matches involving this club |
| `status` | string | `scheduled`, `live`, `completed` |
| `from` | ISO date | Matches on or after this date |
| `to` | ISO date | Matches on or before this date |

**Response**

```json
[
  {
    "id": "uuid",
    "matchDate": "2024-01-15T15:00:00.000Z",
    "roundNumber": 12,
    "status": "completed",
    "homeScore": 2,
    "awayScore": 1,
    "homeClub": { "id": "uuid", "name": "St. George", "logoUrl": "..." },
    "awayClub": { "id": "uuid", "name": "Adama City", "logoUrl": "..." },
    "stadium": { "id": "uuid", "name": "Addis Ababa Stadium", "city": "Addis Ababa" }
  }
]
```

---

### Season Top Scorers

```
GET /api/fan/seasons/:id/top-scorers
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `limit` | number | Max results (default: all) |
| `clubId` | UUID | Only scorers from this club |

**Response**

```json
[
  {
    "playerId": "uuid",
    "playerName": "Getaneh Kebede",
    "playerPhoto": "...",
    "clubId": "uuid",
    "clubName": "St. George",
    "clubLogo": "...",
    "goals": 18
  }
]
```

---

### Season Discipline

```
GET /api/fan/seasons/:id/discipline
```

Yellow and red card aggregation by player and by club.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `clubId` | UUID | Filter to one club |
| `limit` | number | Max player rows |

**Response**

```json
{
  "byPlayer": [
    {
      "playerId": "uuid",
      "playerName": "...",
      "clubName": "...",
      "yellowCards": 5,
      "redCards": 1
    }
  ],
  "byClub": [
    {
      "clubId": "uuid",
      "clubName": "...",
      "yellowCards": 22,
      "redCards": 3
    }
  ]
}
```

---

### Season Clubs

```
GET /api/fan/seasons/:id/clubs
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `search` | string | Case-insensitive club name search |

**Response**

```json
[
  {
    "id": "uuid",
    "name": "St. George",
    "logoUrl": "...",
    "city": "Addis Ababa",
    "country": "Ethiopia",
    "primaryStadium": { "id": "uuid", "name": "Addis Ababa Stadium", "capacity": 35000 },
    "squadSize": 25,
    "coachCount": 3
  }
]
```

---

### Season Players

```
GET /api/fan/seasons/:id/players
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `search` | string | First or last name search |
| `clubId` | UUID | Filter by club |
| `positionId` | number | Filter by position |
| `nationality` | string | Filter by nationality |

**Response**

```json
[
  {
    "playerId": "uuid",
    "firstName": "Getaneh",
    "lastName": "Kebede",
    "photoUrl": "...",
    "nationality": "Ethiopian",
    "jerseyNumber": 9,
    "position": { "id": 1, "name": "Forward", "code": "FW" },
    "club": { "id": "uuid", "name": "St. George", "logoUrl": "..." }
  }
]
```

---

## Clubs

### List Clubs

```
GET /api/fan/clubs
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `search` | string | Club name search |
| `leagueId` | UUID | Filter by league |
| `city` | string | Filter by city |
| `country` | string | Filter by country |

**Response**

```json
[
  {
    "id": "uuid",
    "name": "St. George",
    "shortName": "STG",
    "logoUrl": "...",
    "city": "Addis Ababa",
    "country": "Ethiopia",
    "foundedYear": 1935,
    "primaryStadium": { "id": "uuid", "name": "Addis Ababa Stadium" },
    "league": { "id": "uuid", "name": "Ethiopian Premier League" },
    "_count": { "seasonClubs": 20 }
  }
]
```

---

### Club Detail

```
GET /api/fan/clubs/:id
```

Full club profile including current squad, coaching staff, rating, and current standing.

**Response**

```json
{
  "id": "uuid",
  "name": "St. George",
  "logoUrl": "...",
  "description": "...",
  "primaryStadium": { "id": "uuid", "name": "...", "capacity": 35000, "images": [...] },
  "currentSeason": {
    "seasonId": "uuid",
    "seasonName": "2023/24",
    "seasonStatus": "active",
    "squad": [
      { "playerId": "uuid", "firstName": "...", "lastName": "...", "jerseyNumber": 9, "position": {...} }
    ],
    "coaches": [
      { "coachId": "uuid", "firstName": "...", "lastName": "...", "role": "head_coach" }
    ]
  },
  "currentStanding": {
    "rank": 1,
    "played": 20,
    "won": 14,
    "points": 46,
    "seasonName": "2023/24"
  },
  "rating": { "score": 91.2, "computedAt": "..." }
}
```

---

### Club Season History

```
GET /api/fan/clubs/:id/seasons
```

Season-by-season history for a club, most recent first.

**Response**

```json
[
  {
    "seasonId": "uuid",
    "seasonName": "2023/24",
    "leagueName": "Ethiopian Premier League",
    "position": 1,
    "played": 30,
    "won": 20,
    "drawn": 6,
    "lost": 4,
    "goalsFor": 62,
    "goalsAgainst": 24,
    "goalDifference": 38,
    "points": 66,
    "topScorer": { "playerId": "uuid", "playerName": "Getaneh Kebede", "goals": 18 }
  }
]
```

---

### Club Players

```
GET /api/fan/clubs/:id/players
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `seasonId` | UUID | Filter to a specific season's squad |
| `positionId` | number | Filter by position |
| `search` | string | Name search |

---

### Club Coaches

```
GET /api/fan/clubs/:id/coaches
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `seasonId` | UUID | Filter to a specific season |

**Response**

```json
[
  {
    "coachId": "uuid",
    "firstName": "Sewnet",
    "lastName": "Bishaw",
    "photoUrl": "...",
    "nationality": "Ethiopian",
    "licenseLevel": "UEFA A",
    "role": "head_coach",
    "season": { "id": "uuid", "name": "2023/24", "status": "active" }
  }
]
```

---

### Club Matches

```
GET /api/fan/clubs/:id/matches
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `seasonId` | UUID | Filter by season |
| `status` | string | `scheduled`, `live`, `completed` |
| `from` | ISO date | Start date filter |
| `to` | ISO date | End date filter |

**Response** — each match includes a `perspective` field:

```json
{
  "id": "uuid",
  "matchDate": "...",
  "homeClub": {...},
  "awayClub": {...},
  "homeScore": 2,
  "awayScore": 0,
  "perspective": {
    "isHome": true,
    "goalsFor": 2,
    "goalsAgainst": 0,
    "result": "W"
  }
}
```

---

### Club All-Time Stats

```
GET /api/fan/clubs/:id/stats
```

**Response**

```json
{
  "totalSeasons": 20,
  "totalMatches": 600,
  "totalWins": 380,
  "totalDraws": 120,
  "totalLosses": 100,
  "totalGoalsScored": 1100,
  "totalGoalsConceded": 480,
  "winRate": 63.33,
  "bestSeason": { "seasonId": "uuid", "seasonName": "2018/19", "points": 72 },
  "trophies": 8,
  "rating": { "score": 91.2, "computedAt": "..." },
  "ratingHistory": [
    { "score": 91.2, "snapshotAt": "2024-05-01T00:00:00.000Z" }
  ]
}
```

---

## Players

### List Players

```
GET /api/fan/players
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `search` | string | First or last name search |
| `nationality` | string | Filter by nationality |
| `positionId` | number | Filter by primary position |
| `clubId` | UUID | Filter by origin club |
| `leagueId` | UUID | Players who played in this league |
| `seasonId` | UUID | Players registered in this season |

---

### Player Detail

```
GET /api/fan/players/:id
```

Full player profile with current club and rating.

**Response**

```json
{
  "id": "uuid",
  "firstName": "Getaneh",
  "lastName": "Kebede",
  "dateOfBirth": "1988-03-15T00:00:00.000Z",
  "nationality": "Ethiopian",
  "heightCm": 178,
  "weightKg": 74,
  "preferredFoot": "right",
  "photoUrl": "...",
  "primaryPosition": { "id": 1, "name": "Forward", "code": "FW" },
  "currentClub": { "id": "uuid", "name": "St. George", "logoUrl": "..." },
  "currentSeason": { "id": "uuid", "name": "2023/24", "status": "active" },
  "currentJerseyNumber": 9,
  "rating": { "score": 88.5, "computedAt": "..." },
  "images": [...]
}
```

---

### Player Career History

```
GET /api/fan/players/:id/seasons
```

Season-by-season career stats, most recent first.

**Response**

```json
[
  {
    "seasonId": "uuid",
    "seasonName": "2023/24",
    "leagueName": "Ethiopian Premier League",
    "clubName": "St. George",
    "jerseyNumber": 9,
    "appearances": 28,
    "goals": 18,
    "assists": 7,
    "yellowCards": 3,
    "redCards": 0,
    "ratingScore": 88.5
  }
]
```

---

### Player All-Time Stats

```
GET /api/fan/players/:id/stats
```

**Response**

```json
{
  "totalAppearances": 320,
  "totalGoals": 187,
  "totalAssists": 64,
  "totalYellowCards": 28,
  "totalRedCards": 2,
  "goalsPerMatch": 0.58,
  "bestSeason": { "seasonId": "uuid", "seasonName": "2018/19", "goals": 24 },
  "totalClubs": 3,
  "clubs": [{ "clubId": "uuid", "clubName": "St. George" }],
  "totalLeagues": 2,
  "leagues": [{ "leagueId": "uuid", "leagueName": "Ethiopian Premier League" }],
  "rating": { "score": 88.5, "computedAt": "..." },
  "ratingHistory": [
    { "score": 88.5, "snapshotAt": "2024-05-01T00:00:00.000Z" }
  ]
}
```

---

### Player Match Appearances

```
GET /api/fan/players/:id/matches
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `seasonId` | UUID | Filter by season |
| `clubId` | UUID | Filter by club |

**Response**

```json
[
  {
    "matchId": "uuid",
    "matchDate": "2024-01-15T15:00:00.000Z",
    "homeClub": { "id": "uuid", "name": "St. George", "logoUrl": "..." },
    "awayClub": { "id": "uuid", "name": "Adama City", "logoUrl": "..." },
    "homeScore": 2,
    "awayScore": 1,
    "lineupType": "starting",
    "shirtNumber": 9,
    "isCaptain": false,
    "position": { "id": 1, "name": "Forward", "code": "FW" }
  }
]
```

---

## Matches

### List Matches

```
GET /api/fan/matches
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `seasonId` | UUID | Filter by season |
| `clubId` | UUID | Matches involving this club |
| `status` | string | `scheduled`, `live`, `completed` |
| `round` | number | Filter by round number |
| `from` | ISO date | Start date |
| `to` | ISO date | End date |
| `stadiumId` | UUID | Filter by stadium |

---

### Match Detail

```
GET /api/fan/matches/:id
```

Full match detail including clubs, stadium, referees, and counts.

**Response**

```json
{
  "id": "uuid",
  "matchDate": "2024-01-15T15:00:00.000Z",
  "roundNumber": 12,
  "status": "completed",
  "homeScore": 2,
  "awayScore": 1,
  "attendance": 28000,
  "homeClub": { "id": "uuid", "name": "St. George", "logoUrl": "...", "primaryStadium": {...} },
  "awayClub": { "id": "uuid", "name": "Adama City", "logoUrl": "..." },
  "stadium": { "id": "uuid", "name": "Addis Ababa Stadium", "city": "Addis Ababa", "images": [...] },
  "season": { "id": "uuid", "name": "2023/24", "league": { "id": "uuid", "name": "..." } },
  "matchReferees": [
    { "role": "main", "referee": { "id": "uuid", "firstName": "...", "lastName": "..." } }
  ],
  "_count": { "matchEvents": 8, "matchLineups": 22, "media": 5 }
}
```

---

### Match Events (Timeline)

```
GET /api/fan/matches/:id/events
```

Ordered by minute ascending.

**Response**

```json
[
  {
    "id": "uuid",
    "minute": 23,
    "extraTime": null,
    "eventType": { "id": 1, "name": "goal" },
    "player": { "id": "uuid", "firstName": "Getaneh", "lastName": "Kebede", "photoUrl": "..." },
    "relatedPlayer": { "id": "uuid", "firstName": "...", "lastName": "..." },
    "club": { "id": "uuid", "name": "St. George", "logoUrl": "..." }
  }
]
```

---

### Match Lineups

```
GET /api/fan/matches/:id/lineups
```

Starting XI and bench for both clubs.

**Response**

```json
{
  "home": {
    "clubId": "uuid",
    "clubName": "St. George",
    "clubLogo": "...",
    "starting": [
      {
        "playerId": "uuid",
        "firstName": "...",
        "lastName": "...",
        "photoUrl": "...",
        "shirtNumber": 9,
        "position": { "id": 1, "name": "Forward", "code": "FW" },
        "isCaptain": true,
        "lineupType": "starting"
      }
    ],
    "bench": [...]
  },
  "away": { ... }
}
```

---

### Match Media

```
GET /api/fan/matches/:id/media
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `mediaType` | string | `image` or `video` |

**Response**

```json
[
  {
    "id": "uuid",
    "mediaUrl": "https://res.cloudinary.com/...",
    "mediaType": "image",
    "caption": "Goal celebration",
    "sortOrder": 0
  }
]
```

---

## Coaches

### Coach Detail

```
GET /api/fan/coaches/:id
```

**Response**

```json
{
  "id": "uuid",
  "firstName": "Sewnet",
  "lastName": "Bishaw",
  "photoUrl": "...",
  "nationality": "Ethiopian",
  "licenseLevel": "UEFA A",
  "experienceYears": 15,
  "originClub": { "id": "uuid", "name": "St. George", "logoUrl": "..." },
  "images": [...]
}
```

---

### Coach Career History

```
GET /api/fan/coaches/:id/seasons
```

**Response**

```json
[
  {
    "seasonId": "uuid",
    "seasonName": "2023/24",
    "leagueName": "Ethiopian Premier League",
    "clubId": "uuid",
    "clubName": "St. George",
    "role": "head_coach",
    "startDate_assignment": "2023-09-01T00:00:00.000Z",
    "endDate_assignment": null
  }
]
```

---

## Ratings

### Ranked Player Ratings

```
GET /api/fan/ratings/players
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `leagueId` | UUID | Only players from this league |
| `seasonId` | UUID | Only players from this season |
| `limit` | number | Max results (default: 50, max: 200) |
| `search` | string | Name search |

**Response**

```json
[
  {
    "rank": 1,
    "playerId": "uuid",
    "firstName": "Getaneh",
    "lastName": "Kebede",
    "photoUrl": "...",
    "nationality": "Ethiopian",
    "position": { "id": 1, "name": "Forward", "code": "FW" },
    "club": { "id": "uuid", "name": "St. George", "logoUrl": "..." },
    "ratingScore": 88.5,
    "ratingComputedAt": "2024-05-01T00:00:00.000Z"
  }
]
```

---

### Ranked Club Ratings

```
GET /api/fan/ratings/clubs
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `leagueId` | UUID | Only clubs in this league |
| `limit` | number | Max results (default: 50, max: 200) |
| `search` | string | Club name search |

**Response**

```json
[
  {
    "rank": 1,
    "clubId": "uuid",
    "name": "St. George",
    "logoUrl": "...",
    "city": "Addis Ababa",
    "country": "Ethiopia",
    "league": { "id": "uuid", "name": "Ethiopian Premier League" },
    "ratingScore": 91.2,
    "ratingComputedAt": "2024-05-01T00:00:00.000Z"
  }
]
```

---

### Rating History

```
GET /api/fan/ratings/:entityType/:entityId/history
```

`entityType` must be `player` or `club`.

**Response**

```json
{
  "current": { "score": 88.5, "computedAt": "2024-05-01T00:00:00.000Z" },
  "history": [
    { "score": 88.5, "snapshotAt": "2024-05-01T00:00:00.000Z" },
    { "score": 85.1, "snapshotAt": "2024-03-01T00:00:00.000Z" }
  ]
}
```

---

## Search

### Global Search

```
GET /api/fan/search?q=:query
```

Searches across leagues, clubs, players, coaches, and matches. Returns up to 10 results per entity type.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `q` | string | **Required.** Search term |
| `type` | string | Limit to one type: `league`, `club`, `player`, `coach`, `match` |

**Example**

```
GET /api/fan/search?q=george
GET /api/fan/search?q=kebede&type=player
```

**Response**

```json
{
  "query": "george",
  "leagues": [...],
  "clubs": [
    { "id": "uuid", "name": "St. George", "logoUrl": "...", "city": "Addis Ababa" }
  ],
  "players": [...],
  "coaches": [...],
  "matches": [...]
}
```

---

## Error Responses

All errors follow this shape:

```json
{ "error": "Descriptive error message" }
```

| Status | Meaning |
|---|---|
| 400 | Bad request — invalid UUID, missing required param, invalid filter value |
| 404 | Resource not found |
| 500 | Internal server error |

---

## CORS

The following origin is whitelisted:

- `https://ethio-league-live.vercel.app`

All `/api/fan/*` routes respond to `OPTIONS` preflight requests with the appropriate headers. No `Authorization` header is needed or used.

---

## Adding More Allowed Origins

Edit `lib/fan-cors.ts` and add to the `ALLOWED_ORIGINS` array. Also update the `headers()` config in `next.config.ts`.
