# Implementation Plan: Season Activation Readiness

## Overview

Add a validation gate to `PATCH /api/seasons/[id]` that blocks activation when readiness criteria are unmet, update the clubs endpoint to count only active players/coaches, surface per-club readiness badges on the season detail page, and display structured 422 errors in the edit dialog.

## Tasks

- [x] 1. Extract `validateActivation` pure function and add 422 helper
  - Create a pure `validateActivation(seasonId, seasonClubs, requiredClubs)` function that accepts pre-fetched club data and returns `{ details: ValidationDetail[] }` — no DB calls inside it
  - Define the `ValidationDetail` and `ActivationValidationError` TypeScript interfaces alongside the function (can live at the top of `app/api/seasons/[id]/route.ts` or in a small inline block)
  - Add a `unprocessableEntity` helper to `lib/api-helpers.ts` that returns `NextResponse.json(body, { status: 422 })`
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2_

- [x] 2. Wire activation validation into the PATCH handler
  - [x] 2.1 Add the validation block in `app/api/seasons/[id]/route.ts` PATCH handler
    - After the scope check and before `prisma.season.update`, check if `data.status === "active"`
    - If so, query all SeasonClubs with `_count: { select: { players: { where: { status: "active" } }, coaches: { where: { status: "active" } } } }` and `club: { select: { name: true } }`
    - Call `validateActivation` with the results; if `details.length > 0` return `unprocessableEntity({ code: "ACTIVATION_VALIDATION_FAILED", details })`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2_

  - [ ]* 2.2 Write property tests for `validateActivation` (Properties 1–5)
    - **Property 1: Required clubs count gates activation** — generate `(requiredClubs: number | null, clubCount: number)` pairs; assert blocking iff `requiredClubs !== null && clubCount < requiredClubs`
    - **Property 2: Minimum active players per club gates activation** — generate arrays of `{ name, activePlayers }`; assert blocking iff any entry has `activePlayers < 3`; assert `clubs` array matches exactly
    - **Property 3: Minimum active coaches per club gates activation** — generate arrays of `{ name, activeCoaches }`; assert blocking iff any entry has `activeCoaches < 1`; assert `clubs` array matches exactly
    - **Property 4: All failing criteria reported in a single response** — generate combined failing scenarios; assert `details.length` equals the number of failing criteria
    - **Property 5: Non-"active" status transitions bypass validation** — generate status values from `["upcoming", "completed", "cancelled", undefined]`; assert `validateActivation` is not called / returns no errors
    - **Validates: Requirements 1.1–1.3, 2.1–2.3, 3.1–3.3, 4.1–4.2, 5.1–5.2**
    - File: `__tests__/season-activation-readiness.property.test.ts`

- [x] 3. Update `GET /api/seasons/[id]/clubs` to count only active players and coaches
  - In `app/api/seasons/[id]/clubs/route.ts`, change the `_count` select from `{ players: true, coaches: true }` to `{ players: { where: { status: "active" } }, coaches: { where: { status: "active" } } }`
  - _Requirements: 6.5_

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add `ReadinessBadge` component and per-club readiness indicators
  - [x] 5.1 Implement `computeReadiness` pure function and `ReadinessBadge` component in `app/dashboard/seasons/[id]/page.tsx`
    - Add `computeReadiness(playerCount: number, coachCount: number): { isReady: boolean; reasons: string[] }` — `isReady = playerCount >= 3 && coachCount >= 1`; `reasons` lists each unmet sub-criterion
    - Add `ReadinessBadge` component that accepts `playerCount` and `coachCount`, calls `computeReadiness`, and renders a green "Ready" badge or a red "Not Ready" badge with inline reason text
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 5.2 Render `ReadinessBadge` in each club row inside `SeasonClubsTab`
    - In the existing per-club row in `SeasonClubsTab`, add `<ReadinessBadge playerCount={sc._count.players} coachCount={sc._count.coaches} />` next to the existing `StatusBadge`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 5.3 Write property test for `computeReadiness` (Property 6)
    - **Property 6: Readiness function is correct for all input combinations** — generate `(playerCount, coachCount)` pairs in 0–20 range; assert `computeReadiness(p, c).isReady === (p >= 3 && c >= 1)`; assert `reasons` contains exactly the unmet sub-criteria
    - **Validates: Requirements 6.2, 6.3, 6.4**
    - File: `__tests__/season-activation-readiness.property.test.ts`

- [x] 6. Display structured 422 errors in the edit dialog
  - [x] 6.1 Add `activationErrors` state and structured error section in `app/dashboard/leagues/[id]/seasons/page.tsx`
    - Add `const [activationErrors, setActivationErrors] = useState<ValidationDetail[]>([])` to the component
    - In `handleSubmit`, after a non-ok response, check `res.status === 422` and `data.code === "ACTIVATION_VALIDATION_FAILED"`; if so, call `setActivationErrors(data.details)` and return without showing a toast
    - On successful save, call `setActivationErrors([])` to clear previous errors
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 6.2 Render the activation error section inside the edit dialog
    - Above the `DialogFooter`, when `activationErrors.length > 0`, render a dedicated error section (e.g. a bordered `div` with `border-destructive/50 bg-destructive/10`) that maps each `ValidationDetail` entry to a distinct error line showing `detail.message` and, if `detail.clubs.length > 0`, the affected club names
    - Clear `activationErrors` when the dialog closes (`onOpenChange`)
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 6.3 Write property test for activation error display (Property 7)
    - **Property 7: Activation error display renders one element per detail entry** — generate random `ValidationDetail[]` arrays (1–10 entries); render the error section component in isolation; assert rendered error item count equals `details.length`
    - **Validates: Requirements 7.1**
    - File: `__tests__/season-activation-readiness.property.test.ts`

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `validateActivation` must be a pure function (no Prisma calls) so it can be unit/property tested without a DB
- The `_count` filter change in task 3 is a prerequisite for the readiness badge in task 5 to reflect the same criteria the backend validates
- Property tests live in `__tests__/season-activation-readiness.property.test.ts` and follow the tag format `// Feature: season-activation-readiness, Property N: <text>`
