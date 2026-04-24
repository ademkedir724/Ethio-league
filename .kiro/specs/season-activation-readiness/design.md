# Design Document: Season Activation Readiness

## Overview

Season Activation Readiness adds a validation gate to the `PATCH /api/seasons/[id]` endpoint that prevents a season from transitioning to `"active"` unless all readiness criteria are satisfied. It also surfaces per-club readiness badges on the season detail page so league admins can identify and resolve gaps before attempting activation.

The feature touches four files:

| File | Change |
|---|---|
| `app/api/seasons/[id]/route.ts` | Add activation validation block in PATCH handler |
| `app/api/seasons/[id]/clubs/route.ts` | Filter `_count` to active-only players and coaches |
| `app/dashboard/seasons/[id]/page.tsx` | Add per-club readiness badges in clubs tab |
| `app/dashboard/leagues/[id]/seasons/page.tsx` | Show structured 422 errors in edit dialog |

---

## Architecture

The feature follows the existing layered pattern of the codebase:

```
Client (Next.js page)
  │  PATCH /api/seasons/:id  { status: "active" }
  ▼
API Route Handler (app/api/seasons/[id]/route.ts)
  │  1. Auth + scope check (existing)
  │  2. [NEW] Activation_Validator — runs only when status → "active"
  │     a. Query all SeasonClubs with active _count
  │     b. Evaluate required_clubs, min_players, min_coaches
  │     c. If any fail → return 422 ACTIVATION_VALIDATION_FAILED
  │  3. prisma.season.update (existing)
  ▼
Database (PostgreSQL via Prisma)
```

The readiness indicator on the frontend is purely derived from data already fetched by `GET /api/seasons/[id]/clubs`. No new API endpoints are needed.

```
SeasonClubsTab (existing)
  │  useSWR → GET /api/seasons/:id/clubs
  │  [UPDATED] _count now filters status="active"
  ▼
  Per-club row
    └── [NEW] ReadinessBadge component
          isReady = _count.players >= 3 && _count.coaches >= 1
```

---

## Components and Interfaces

### Backend: Activation Validator

A self-contained validation block inside the existing PATCH handler. It runs only when `data.status === "active"`.

**Error response shape (HTTP 422):**

```typescript
interface ActivationValidationError {
  code: "ACTIVATION_VALIDATION_FAILED";
  details: ValidationDetail[];
}

interface ValidationDetail {
  criterion: "required_clubs" | "min_players" | "min_coaches";
  message: string;
  clubs: string[]; // club names; empty array for required_clubs criterion
}
```

**Example 422 body:**

```json
{
  "code": "ACTIVATION_VALIDATION_FAILED",
  "details": [
    {
      "criterion": "min_players",
      "message": "2 club(s) have fewer than 3 active players",
      "clubs": ["FC Alpha", "United SC"]
    },
    {
      "criterion": "min_coaches",
      "message": "1 club(s) have no active coach",
      "clubs": ["United SC"]
    }
  ]
}
```

### Backend: Updated `_count` Query in Clubs Route

The GET handler for `/api/seasons/[id]/clubs` currently counts all players and coaches regardless of status. It must be updated to count only `status = "active"` records so the frontend readiness indicator reflects the same criteria the backend validates.

**Before:**
```typescript
_count: { select: { players: true, coaches: true } }
```

**After:**
```typescript
_count: {
  select: {
    players: { where: { status: "active" } },
    coaches: { where: { status: "active" } },
  }
}
```

### Frontend: `ReadinessBadge` Component

A small inline component rendered per club row in `SeasonClubsTab`.

```typescript
interface ReadinessBadgeProps {
  playerCount: number;
  coachCount: number;
}
```

Logic:
- `isReady = playerCount >= 3 && coachCount >= 1`
- Ready → green "Ready" badge
- Not Ready → red "Not Ready" badge + inline text listing which sub-criteria fail

### Frontend: Activation Error Section in Edit Dialog

In `app/dashboard/leagues/[id]/seasons/page.tsx`, the `handleSubmit` function currently shows a generic toast on any error. When the response is HTTP 422 with `code === "ACTIVATION_VALIDATION_FAILED"`, it instead stores the `details` array in component state and renders a dedicated error section inside the dialog above the footer buttons.

---

## Data Models

No schema changes are required. The feature uses existing models:

```
Season
  ├── requiredClubs: Int?          — optional minimum club count
  └── status: String               — "upcoming" | "active" | "completed" | "cancelled"

SeasonClub
  ├── players: SeasonClubPlayer[]
  │     └── status: String         — "active" | "pending" | "rejected"
  └── coaches: SeasonClubCoach[]
        └── status: String         — "active" | "pending" | "rejected"
```

The validation logic queries:

```typescript
prisma.seasonClub.findMany({
  where: { seasonId: id },
  include: {
    club: { select: { name: true } },
    _count: {
      select: {
        players: { where: { status: "active" } },
        coaches: { where: { status: "active" } },
      }
    }
  }
})
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Required clubs count gates activation

*For any* season with a non-null `requiredClubs` value, the activation validator SHALL block activation (return a `required_clubs` detail entry) if and only if the number of assigned SeasonClub records is strictly less than `requiredClubs`.

**Validates: Requirements 1.1, 1.2, 1.3**

---

### Property 2: Minimum active players per club gates activation

*For any* set of SeasonClub records, the activation validator SHALL block activation with a `min_players` detail entry if and only if at least one club has fewer than 3 SeasonClubPlayer records with `status = "active"`. The `clubs` array in the detail entry SHALL contain exactly the names of the non-compliant clubs.

**Validates: Requirements 2.1, 2.2, 2.3**

---

### Property 3: Minimum active coaches per club gates activation

*For any* set of SeasonClub records, the activation validator SHALL block activation with a `min_coaches` detail entry if and only if at least one club has zero SeasonClubCoach records with `status = "active"`. The `clubs` array SHALL contain exactly the names of the non-compliant clubs.

**Validates: Requirements 3.1, 3.2, 3.3**

---

### Property 4: All failing criteria are reported in a single response

*For any* combination of failing criteria (required_clubs, min_players, min_coaches), the activation validator SHALL return a single HTTP 422 response whose `details` array contains one entry per failing criterion — never a partial list.

**Validates: Requirements 4.1, 4.2**

---

### Property 5: Non-"active" status transitions bypass validation

*For any* PATCH request where `status` is absent or is any value other than `"active"`, the activation validator SHALL not execute and the update SHALL succeed regardless of club, player, or coach counts.

**Validates: Requirements 5.1, 5.2**

---

### Property 6: Readiness function is correct for all input combinations

*For any* non-negative integer pair `(playerCount, coachCount)`, the readiness function SHALL return `true` if and only if `playerCount >= 3 AND coachCount >= 1`. The set of reported failure reasons SHALL be exactly the set of sub-criteria that are individually unmet.

**Validates: Requirements 6.2, 6.3, 6.4**

---

### Property 7: Activation error display renders one element per detail entry

*For any* `details` array returned in a 422 ACTIVATION_VALIDATION_FAILED response, the edit dialog error section SHALL render exactly one visible error element per entry in the array.

**Validates: Requirements 7.1**

---

## Error Handling

| Scenario | Response |
|---|---|
| `status → "active"`, one or more criteria fail | HTTP 422 `{ code: "ACTIVATION_VALIDATION_FAILED", details: [...] }` |
| `status → "active"`, all criteria pass | HTTP 200 with updated season |
| `status` is any other value or absent | HTTP 200 (existing behavior, no change) |
| Season not found | HTTP 404 (existing) |
| Auth / scope failure | HTTP 401 / 403 (existing) |
| Unexpected DB error | HTTP 500 (existing) |

On the frontend:
- A 422 with `ACTIVATION_VALIDATION_FAILED` stores `details` in state and renders a structured error section inside the dialog. The toast is suppressed for this case.
- Any other non-OK response falls through to the existing generic toast error.
- On successful save, `activationErrors` state is cleared.

---

## Testing Strategy

### Unit / Property Tests

Use **fast-check** (already present in the codebase based on existing property test files) for property-based tests. Each property test runs a minimum of 100 iterations.

**Validation logic tests** (`__tests__/season-activation-readiness.property.test.ts`):

- Property 1 — generate `(requiredClubs: number | null, clubCount: number)` pairs; call the extracted `validateActivation` pure function; assert blocking iff `requiredClubs !== null && clubCount < requiredClubs`.
- Property 2 — generate arrays of `{ name: string, activePlayers: number }` objects; assert blocking iff any entry has `activePlayers < 3`; assert `clubs` array matches exactly.
- Property 3 — generate arrays of `{ name: string, activeCoaches: number }` objects; assert blocking iff any entry has `activeCoaches < 1`; assert `clubs` array matches exactly.
- Property 4 — generate combined scenarios where multiple criteria fail; assert `details.length` equals the number of failing criteria.
- Property 5 — generate status values from `["upcoming", "completed", "cancelled", undefined]`; assert `validateActivation` returns no errors.

**Readiness function tests**:

- Property 6 — generate `(playerCount: number, coachCount: number)` pairs (0–20 range); assert `computeReadiness(p, c).isReady === (p >= 3 && c >= 1)`; assert failure reasons match exactly.

**Frontend error display tests**:

- Property 7 — generate random `ValidationDetail[]` arrays (1–10 entries); render the error section component; assert rendered error item count equals `details.length`.

### Example-Based Tests

- Requirement 7.3 (error cleared on success): render dialog with pre-populated `activationErrors`, simulate a successful PATCH response, assert `activationErrors` is empty.
- Happy path: all criteria met → HTTP 200, season updated.
- Edge case: season has no clubs at all → `min_players` and `min_coaches` details both present (empty clubs list is vacuously compliant for required_clubs when `requiredClubs` is null).

### Integration Tests

- End-to-end: PATCH a real season in a test DB with insufficient clubs/players/coaches → verify 422 response shape.
- End-to-end: PATCH with all criteria met → verify 200 and `status === "active"` in DB.

### Tag Format

Each property test is tagged with a comment:

```
// Feature: season-activation-readiness, Property N: <property_text>
```
