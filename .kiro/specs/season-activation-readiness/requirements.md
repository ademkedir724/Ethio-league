# Requirements Document

## Introduction

The Season Activation Readiness feature ensures that a league season can only be transitioned from "upcoming" to "active" when all prerequisite conditions are met. This protects data integrity by preventing activation of incomplete seasons. It also surfaces per-club readiness indicators on the season detail page so league admins can identify and resolve gaps before attempting activation.

The feature has two parts:
1. **Backend validation** — the `PATCH /api/seasons/[id]` endpoint rejects status transitions to "active" when readiness criteria are not met, returning structured error details.
2. **Frontend readiness indicators** — the season detail clubs tab shows per-club badges indicating whether each club satisfies the player and coach minimums.

## Glossary

- **Season**: A time-bounded edition of a League, represented by the `Season` model. Has a `status` field (`upcoming`, `active`, `completed`, `cancelled`) and an optional `requiredClubs` count.
- **SeasonClub**: A join record linking a `Club` to a `Season`. Has `players` (SeasonClubPlayer[]) and `coaches` (SeasonClubCoach[]) relations.
- **SeasonClubPlayer**: A player registered to a club within a specific season. Has a `status` field.
- **SeasonClubCoach**: A coach registered to a club within a specific season. Has a `status` field.
- **Activation_Validator**: The server-side logic within `PATCH /api/seasons/[id]` responsible for evaluating readiness criteria before allowing a status change to "active".
- **Readiness_Indicator**: A per-club UI element on the season detail page that shows whether a club meets the minimum player and coach requirements.
- **League_Admin**: A user with the `league_admin` role scoped to the relevant league, authorized to manage seasons and clubs.
- **Active_Player**: A `SeasonClubPlayer` record with `status = "active"`.
- **Active_Coach**: A `SeasonClubCoach` record with `status = "active"`.

## Requirements

### Requirement 1: Activation Pre-condition — Required Clubs Count

**User Story:** As a league admin, I want the system to prevent season activation when the required number of clubs has not been met, so that seasons do not start with an incomplete field.

#### Acceptance Criteria

1. WHEN a `PATCH /api/seasons/[id]` request sets `status` to `"active"` and the season's `requiredClubs` is not null, THE Activation_Validator SHALL verify that the count of SeasonClub records for that season equals or exceeds `requiredClubs`.
2. IF the count of assigned clubs is less than `requiredClubs`, THEN THE Activation_Validator SHALL return HTTP 422 with an error body containing a `code` of `"ACTIVATION_VALIDATION_FAILED"` and a `details` array listing each unmet criterion.
3. WHEN a `PATCH /api/seasons/[id]` request sets `status` to `"active"` and the season's `requiredClubs` is null, THE Activation_Validator SHALL skip the clubs-count check and proceed to evaluate remaining criteria.

---

### Requirement 2: Activation Pre-condition — Minimum Players Per Club

**User Story:** As a league admin, I want the system to prevent season activation when any assigned club has fewer than 3 active players registered, so that all clubs can field a valid squad.

#### Acceptance Criteria

1. WHEN a `PATCH /api/seasons/[id]` request sets `status` to `"active"`, THE Activation_Validator SHALL verify that every SeasonClub for that season has at least 3 SeasonClubPlayer records with `status = "active"`.
2. IF any SeasonClub has fewer than 3 active players, THEN THE Activation_Validator SHALL return HTTP 422 with an error body containing a `code` of `"ACTIVATION_VALIDATION_FAILED"` and a `details` array that identifies each non-compliant club by name and its current active player count.
3. WHEN all SeasonClub records have 3 or more active players, THE Activation_Validator SHALL consider the player criterion satisfied and proceed to evaluate remaining criteria.

---

### Requirement 3: Activation Pre-condition — Minimum Coaches Per Club

**User Story:** As a league admin, I want the system to prevent season activation when any assigned club has no active coach registered, so that every club has at least one coaching staff member for the season.

#### Acceptance Criteria

1. WHEN a `PATCH /api/seasons/[id]` request sets `status` to `"active"`, THE Activation_Validator SHALL verify that every SeasonClub for that season has at least 1 SeasonClubCoach record with `status = "active"`.
2. IF any SeasonClub has zero active coaches, THEN THE Activation_Validator SHALL return HTTP 422 with an error body containing a `code` of `"ACTIVATION_VALIDATION_FAILED"` and a `details` array that identifies each non-compliant club by name.
3. WHEN all SeasonClub records have 1 or more active coaches, THE Activation_Validator SHALL consider the coach criterion satisfied and proceed to allow the status update.

---

### Requirement 4: Aggregated Validation Error Response

**User Story:** As a league admin, I want to receive a single response that lists all unmet readiness criteria at once, so that I can address all issues without making repeated activation attempts.

#### Acceptance Criteria

1. WHEN multiple readiness criteria are unmet simultaneously, THE Activation_Validator SHALL evaluate all criteria before responding and SHALL return a single HTTP 422 response that includes all unmet criteria in the `details` array.
2. THE Activation_Validator SHALL structure each entry in the `details` array with a `criterion` field (one of `"required_clubs"`, `"min_players"`, `"min_coaches"`), a human-readable `message` field, and where applicable a `clubs` array listing affected club names.
3. WHEN all readiness criteria are satisfied, THE Activation_Validator SHALL allow the status update to proceed and SHALL return HTTP 200 with the updated season object.

---

### Requirement 5: Validation Applies Only to "active" Transition

**User Story:** As a league admin, I want other status changes (e.g., to "completed" or "cancelled") to remain unaffected by activation readiness checks, so that season management is not unnecessarily restricted.

#### Acceptance Criteria

1. WHEN a `PATCH /api/seasons/[id]` request sets `status` to any value other than `"active"`, THE Activation_Validator SHALL skip all readiness checks and apply the update directly.
2. WHEN a `PATCH /api/seasons/[id]` request does not include a `status` field, THE Activation_Validator SHALL skip all readiness checks and apply the update directly.

---

### Requirement 6: Per-Club Readiness Indicator on Season Detail Page

**User Story:** As a league admin, I want to see a readiness indicator next to each club on the season detail page, so that I can quickly identify which clubs are blocking activation.

#### Acceptance Criteria

1. THE Readiness_Indicator SHALL display for each SeasonClub in the clubs tab of the season detail page (`/dashboard/seasons/[id]`).
2. THE Readiness_Indicator SHALL show a "Ready" state when the club has at least 3 active players AND at least 1 active coach.
3. THE Readiness_Indicator SHALL show a "Not Ready" state when the club has fewer than 3 active players OR fewer than 1 active coach.
4. WHEN a club is in "Not Ready" state, THE Readiness_Indicator SHALL display which specific sub-criteria are unmet (players below minimum, coaches below minimum, or both).
5. THE Readiness_Indicator SHALL derive its state from the `_count` data already returned by `GET /api/seasons/[id]/clubs` (which includes `_count.players` and `_count.coaches`), requiring no additional API calls.

---

### Requirement 7: Activation Error Display on Frontend

**User Story:** As a league admin, I want to see clear error messages when season activation fails validation, so that I know exactly what needs to be fixed.

#### Acceptance Criteria

1. WHEN the `PATCH /api/seasons/[id]` response returns HTTP 422 with `code = "ACTIVATION_VALIDATION_FAILED"`, THE Season_Detail_Page SHALL display each entry from the `details` array as a distinct error message to the league admin.
2. THE Season_Detail_Page SHALL present activation validation errors in a way that is visually distinct from generic network errors (e.g., using a dedicated error section rather than a toast-only notification).
3. WHEN the season status update succeeds, THE Season_Detail_Page SHALL clear any previously displayed activation validation errors.
