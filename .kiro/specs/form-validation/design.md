# Design Document: Comprehensive Client-Side Form Validation

## Overview

The Ethio-League admin dashboard has 22 forms spread across auth pages and dashboard pages. Currently, validation is inconsistent: some forms rely on HTML5 attributes alone, others fire `toast.error()` calls in submit handlers, and only the profile change-password form shows inline field-level errors. This feature introduces a uniform, library-free validation layer that provides:

- **Inline error messages** rendered directly below each field
- **Blur-triggered real-time validation** (errors appear when the user leaves a field)
- **Submit-time full-form validation** that blocks submission and highlights every invalid field simultaneously
- **Consistent error message vocabulary** across all 22 forms

The implementation uses only the existing stack: React, TypeScript, Tailwind CSS, and shadcn/ui. No new form libraries (React Hook Form, Zod, Yup, etc.) are introduced.

---

## Architecture

The validation layer is a thin, three-part addition to the existing codebase:

```
┌─────────────────────────────────────────────────────────────────┐
│  lib/validation.ts  (Pure Validator Functions)                  │
│                                                                  │
│  validateEmail()   validatePhone()   validateRequired()         │
│  validateLength()  validatePassword() validatePasswordMatch()   │
│  validateInteger() validateDate()    validateDateNotFuture()    │
│  validateDateAfter() validatePositionCode()                     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ imported by
┌──────────────────────────────▼──────────────────────────────────┐
│  lib/use-form-validation.ts  (useFormValidation Hook)           │
│                                                                  │
│  useFormValidation<T>(validate, initialValues)                  │
│  → { errors, touched, handleBlur, validateAll, resetValidation }│
└──────────────────────────────┬──────────────────────────────────┘
                               │ used by
┌──────────────────────────────▼──────────────────────────────────┐
│  Form Components  (22 forms across the dashboard)               │
│                                                                  │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐  │
│  │  FormDialog-based forms │  │  Standalone forms            │  │
│  │  (seasons, players,     │  │  (login, forgot-password,    │  │
│  │   leagues, clubs, etc.) │  │   profile, request-org, etc.)│  │
│  └─────────────────────────┘  └──────────────────────────────┘  │
│                                                                  │
│  Each field renders an Inline_Error_Slot below it:              │
│  {errors.fieldName && (                                         │
│    <p id="field-error" role="alert"                             │
│       className="text-xs text-destructive mt-1">               │
│      {errors.fieldName}                                         │
│    </p>                                                         │
│  )}                                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

**No new libraries.** The validator functions are pure TypeScript. The hook is a standard `useState`/`useCallback` hook. This keeps the bundle size unchanged and avoids dependency churn.

**Pure functions in `lib/validation.ts`.** All validation logic lives in one file as pure functions. This makes them trivially testable with property-based tests and ensures a single source of truth for error messages.

**Hook in `lib/use-form-validation.ts`.** The hook is a separate file from the validators so it can be imported independently. It is generic over the form's value type `T`, giving full TypeScript inference on field names.

**Inline error slot as a pattern, not a component.** Rather than a dedicated `<FieldError>` component, the error slot is a simple JSX pattern (a conditional `<p>` element) that each form renders inline. This avoids prop-drilling complexity and keeps each form self-contained. The pattern is documented and consistent.

**Integration via `onSubmit` prop of `<FormDialog>`.** The existing `<FormDialog>` component already accepts an `onSubmit: () => Promise<void>` prop. The submit gate is implemented inside each form's `handleSubmit` function before the API call, which is exactly where the existing toast-based validation already lives. No changes to `<FormDialog>` itself are required.

**Blur handler wiring.** Each `<Input>` (and equivalent) receives an `onBlur={() => handleBlur('fieldName')}` prop. The hook's `handleBlur` marks the field as touched and re-runs validation for that field.

---

## Components and Interfaces

### `lib/validation.ts` — Pure Validator Functions

```typescript
/**
 * Returns null if valid, or an error message string if invalid.
 * All functions are pure with no side effects.
 */

/** RFC-5322-compatible email check */
export function validateEmail(value: string): string | null;

/**
 * Phone validation with optional/required branching.
 * Pattern: /^\+?[\d\s\-().]{7,20}$/
 */
export function validatePhone(value: string, required: boolean): string | null;

/** Non-empty (after trim) check */
export function validateRequired(value: string, label: string): string | null;

/** Trimmed length within [min, max] */
export function validateLength(
  value: string,
  min: number,
  max: number,
  label: string
): string | null;

/** Minimum 8 characters */
export function validatePassword(value: string): string | null;

/** Exact string equality */
export function validatePasswordMatch(
  password: string,
  confirm: string
): string | null;

/**
 * Optional integer in [min, max].
 * Empty string → null (field is optional).
 */
export function validateInteger(
  value: string,
  min: number,
  max: number,
  label: string
): string | null;

/** Empty or valid date string */
export function validateDate(value: string, label: string): string | null;

/** Empty, or date is not after today */
export function validateDateNotFuture(
  value: string,
  label: string
): string | null;

/** Empty end/start, or end is strictly after start */
export function validateDateAfter(
  endValue: string,
  startValue: string,
  label: string
): string | null;

/** Matches /^[A-Z]{1,10}$/ */
export function validatePositionCode(value: string): string | null;
```

**Error message constants** are co-located in `lib/validation.ts` as named exports so they can be referenced in tests:

```typescript
export const MSG_EMAIL_INVALID = "Enter a valid email address";
export const MSG_PHONE_INVALID = "Enter a valid phone number (e.g. +251 911 234 567)";
export const MSG_PHONE_REQUIRED = "Phone number is required";
export const MSG_PASSWORD_MIN = "Password must be at least 8 characters";
export const MSG_PASSWORDS_MISMATCH = "Passwords do not match";
export const MSG_POSITION_CODE_INVALID =
  "Position code must be 1–10 uppercase letters (e.g. GK, CB)";
```

### `lib/use-form-validation.ts` — Hook

```typescript
export interface UseFormValidationReturn<T> {
  /** Current field errors. Only populated for touched fields. */
  errors: Partial<Record<keyof T, string>>;
  /** Set of field names the user has blurred at least once. */
  touched: Set<keyof T>;
  /**
   * Call on a field's onBlur event.
   * Marks the field as touched and re-runs validation for that field.
   */
  handleBlur: (field: keyof T, currentValues: T) => void;
  /**
   * Runs full validation, marks all fields as touched, updates errors.
   * Returns true if no errors, false otherwise.
   */
  validateAll: (currentValues: T) => boolean;
  /** Clears all errors and touched state. Call after successful submit. */
  resetValidation: () => void;
}

export function useFormValidation<T extends Record<string, unknown>>(
  validate: (values: T) => Partial<Record<keyof T, string>>,
  initialValues: T
): UseFormValidationReturn<T>;
```

**Implementation notes:**
- `errors` is stored in `useState<Partial<Record<keyof T, string>>>({})`.
- `touched` is stored in `useState<Set<keyof T>>(new Set())`.
- `handleBlur` calls `validate(currentValues)`, extracts the error for the blurred field, and calls `setErrors` only for that field. It also adds the field to `touched`.
- `validateAll` calls `validate(currentValues)`, sets all errors at once, marks all keys of `T` as touched, and returns `Object.values(result).every(v => !v)`.
- `resetValidation` calls `setErrors({})` and `setTouched(new Set())`.

### Inline Error Slot Pattern

Each form field follows this pattern:

```tsx
<div className="flex flex-col gap-2">
  <Label htmlFor="field-id">Field Label *</Label>
  <Input
    id="field-id"
    value={form.fieldName}
    onChange={(e) => setForm({ ...form, fieldName: e.target.value })}
    onBlur={() => handleBlur("fieldName", form)}
    aria-describedby={errors.fieldName ? "field-id-error" : undefined}
  />
  {errors.fieldName && (
    <p id="field-id-error" role="alert" className="text-xs text-destructive mt-1">
      {errors.fieldName}
    </p>
  )}
</div>
```

The `aria-describedby` / `id` pairing and `role="alert"` satisfy WCAG 1.3.1 (Info and Relationships) and ensure screen readers announce the error when it appears.

### `<FormDialog>` Integration

The existing `<FormDialog>` component requires no changes. The submit gate lives in each form's `handleSubmit` function:

```typescript
const handleSubmit = async () => {
  // Submit gate: run full validation before any API call
  const isValid = validateAll(form);
  if (!isValid) {
    // Focus the first invalid field in DOM order
    const firstErrorField = document.querySelector("[aria-invalid='true']") as HTMLElement;
    firstErrorField?.focus();
    return; // abort — no toast, errors are shown inline
  }

  // Existing API call logic unchanged
  setIsSaving(true);
  try {
    const res = await fetchWithAuth(/* ... */);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to save"); // server errors still use toast
      return;
    }
    toast.success("Saved");
    resetValidation();
    setFormOpen(false);
  } catch {
    toast.error("Something went wrong");
  } finally {
    setIsSaving(false);
  }
};
```

For the `aria-invalid` focus trick to work, each `<Input>` also receives `aria-invalid={!!errors.fieldName}` when an error is present.

### Per-Form `validate` Function

Each form defines its own `validate` function that composes the pure validators:

```typescript
// Example: Season form
function validateSeasonForm(values: typeof emptyForm) {
  const errors: Partial<Record<keyof typeof emptyForm, string>> = {};

  errors.name =
    validateRequired(values.name, "Season name") ??
    validateLength(values.name, 2, 100, "Season name") ??
    undefined;

  if (!values.leagueId) {
    errors.leagueId = "Please select a league";
  }

  errors.startDate = validateRequired(values.startDate, "Start date") ?? undefined;
  errors.endDate =
    validateRequired(values.endDate, "End date") ??
    validateDateAfter(values.endDate, values.startDate, "End date") ??
    undefined;

  errors.pointsWin = validateInteger(values.pointsWin, 0, 10, "Points for win") ?? undefined;
  // ... etc.

  return errors;
}
```

The `??` chaining implements the "required error takes precedence over format error" rule from Requirement 20.2: if `validateRequired` returns an error, the format validator is never called.

---

## Data Models

This feature introduces no new database models or API routes. All state is ephemeral React component state.

### Form State Shape (per form)

Each form continues to use its existing `useState` shape (e.g., `emptyForm` objects). The validation hook adds two parallel state slices:

| State | Type | Description |
|-------|------|-------------|
| `errors` | `Partial<Record<keyof T, string>>` | Current field errors (only for touched fields) |
| `touched` | `Set<keyof T>` | Fields the user has blurred at least once |

### Validation Rule Registry

The following table maps each form field to its validator chain. This serves as the authoritative reference for implementation:

| Form | Field | Validators |
|------|-------|-----------|
| Login | email | required, email |
| Login | password | required |
| Forgot Password | email | required, email |
| Reset/Set Password | password | password (min 8) |
| Reset/Set Password | confirmPassword | passwordMatch |
| Request Org | organizationName | required, length(2,120) |
| Request Org | country | required, length(2,80) |
| Request Org | city | required, length(2,80) |
| Request Org | description | length(0,500) optional |
| Request Org | applicantFullName | required, length(2,80) |
| Request Org | email | required, email |
| Request Org | phone | phone(required=true) |
| Profile Edit | editFullName | required, length(2,80) |
| Profile Edit | editPhone | phone(required=false) |
| Change Password | currentPassword | required |
| Change Password | newPassword | password |
| Change Password | confirmPassword | passwordMatch |
| Player/Coach | firstName | required, length(2,50) |
| Player/Coach | lastName | required, length(2,50) |
| Player/Coach | dateOfBirth | dateNotFuture (optional) |
| Player/Coach | nationality | length(0,60) optional |
| Player | heightCm | integer(100,250) optional |
| Player | weightKg | integer(30,200) optional |
| Coach | experienceYears | integer(0,60) optional |
| Referee | firstName | required, length(2,50) |
| Referee | lastName | required, length(2,50) |
| Referee | dateOfBirth | dateNotFuture (optional) |
| Referee | licenseLevel | required |
| Referee | experienceYears | integer(0,60) optional |
| Referee | region | length(0,80) optional |
| League | name | required, length(2,120) |
| League | description | length(0,500) optional |
| League (create) | adminFullName | required, length(2,80) |
| League (create) | adminEmail | required, email |
| League (create) | adminPhone | phone(required=false) |
| Club | name | required, length(2,120) |
| Club | adminFullName | required, length(2,80) |
| Club | adminEmail | required, email |
| Club | adminPhone | phone(required=false) |
| Season | name | required, length(2,100) |
| Season (create) | leagueId | required (select) |
| Season | startDate | required |
| Season | endDate | required, dateAfter(startDate) |
| Season | pointsWin/Draw/Loss | integer(0,10) |
| Season | minSquadSize | integer(1,50) |
| Season | minStartingPlayers | integer(1,25) |
| Season | maxBenchPlayers | integer(0,20) |
| Season | rules | length(0,1000) optional |
| Users | fullName | required, length(2,80) |
| Users (create) | email | required, email |
| Users (create) | password | password |
| Users (create) | role | required (select) |
| Users | phone | phone(required=false) |
| System Config | name | required, length(1,100) |
| System Config | description | length(0,255) optional |
| Position | code | required, positionCode |
| Position | name | required, length(1,50) |
| Match Edit | matchDate | required |
| Match Edit | roundNumber | integer(1,100) optional |
| Score Edit | homeScore | required, integer(0,99) |
| Score Edit | awayScore | required, integer(0,99) |
| Log Event | eventTypeId | required (select) |
| Log Event | clubSide | required (select) |
| Log Event | playerId | required (select) |
| Log Event | minute | integer(0,120) optional |
| Log Event | extraTime | integer(0,30) optional |
| Log Event | description | length(0,255) optional |
| Log Event | relatedPlayerId | required if substitution |
| Fixture Edit | matchDate | required |
| Fixture Edit | matchTime | required (select) |
| Lineup | starters | exactly 11 |
| Lineup | substitutes | max 7 |
| Lineup | captainId | required, must be in starters |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The validator functions in `lib/validation.ts` are pure functions, making them ideal candidates for property-based testing with `fast-check`. The following properties are derived from the acceptance criteria.

### Property 1: Valid inputs always return null

*For any* valid input to any validator function (valid email string, phone matching the pattern, non-empty string for required, string within length bounds, password ≥ 8 chars, matching password pair, integer in range, valid date string, past date, end date after start date, uppercase position code), the validator SHALL return `null`.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11**

### Property 2: Invalid inputs always return a non-null error string

*For any* invalid input to any validator function (malformed email, non-matching phone, empty/whitespace string for required, string outside length bounds, password < 8 chars, mismatched password pair, non-integer or out-of-range integer, invalid date string, future date, end date not after start date, non-uppercase or too-long position code), the validator SHALL return a non-empty string.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11**

### Property 3: Validator determinism (purity)

*For any* fixed set of arguments, calling any validator function twice SHALL return identical results. This verifies the pure-function contract (no hidden state, no side effects).

**Validates: Requirements 1.12**

### Property 4: Required error takes precedence over format error

*For any* empty string passed to a combined required+format validator chain (e.g., email, phone with required=true), the result SHALL be the required error message, not the format error message.

**Validates: Requirements 20.2**

### Property 5: validateAll returns false iff any field has an error

*For any* form values object and any validate function, `validateAll(values)` SHALL return `true` if and only if `validate(values)` returns an object with no non-empty string values.

**Validates: Requirements 2.4, 5.1, 5.2, 5.4**

### Property 6: resetValidation clears all state

*For any* sequence of `handleBlur` calls followed by `resetValidation`, the `errors` object SHALL be empty and the `touched` set SHALL be empty after the reset.

**Validates: Requirements 2.5, 20.4**

### Property 7: Untouched fields never show errors

*For any* form values (including invalid ones), before any `handleBlur` call, the `errors` object returned by the hook SHALL have no entries.

**Validates: Requirements 2.6, 4.5**

### Property 8: Lineup constraint enforcement

*For any* set of selected starter IDs, the lineup validator SHALL return an error if and only if the count is not exactly 11. *For any* captain ID and set of starter IDs, the lineup validator SHALL return an error if and only if the captain ID is not a member of the starters set.

**Validates: Requirements 19.1, 19.2, 19.4, 19.5**

---

## Error Handling

### Client-Side Validation Errors

Client-side validation errors are **never** shown as toasts. They appear only as inline `Field_Error` elements below the relevant field. This is a hard rule enforced by the submit gate pattern: if `validateAll` returns `false`, the function returns early before any `toast.error()` call.

### Server-Side API Errors

All existing `toast.error()` calls for API errors are preserved unchanged. The submit gate only intercepts the path before the API call.

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Form reset after successful submit | `resetValidation()` is called, clearing all errors and touched state |
| Dialog closed without submitting | `resetValidation()` is called in the `onOpenChange` handler |
| Field with both required and format errors | `??` chaining ensures required error is shown first |
| Select fields (no blur event) | Validated only at submit time via `validateAll`; no blur handler needed |
| Optional fields with no value | Validators return `null` for empty optional fields (e.g., `validateInteger` with empty string) |
| Date comparison with one empty date | `validateDateAfter` returns `null` when either date is empty |
| Lineup captain not yet selected | Error shown only after submit attempt (captain is a select, not a text input) |

---

## Testing Strategy

### Unit Tests (example-based)

Located in `__tests__/form-validation.test.ts` (or alongside the source files).

**Validator function examples:**
- `validateEmail("")` → `"Email is required"` (when used with required chain)
- `validateEmail("not-an-email")` → `"Enter a valid email address"`
- `validateEmail("user@example.com")` → `null`
- `validatePhone("", false)` → `null`
- `validatePhone("", true)` → `"Phone number is required"`
- `validatePhone("+251911234567", true)` → `null`
- `validatePhone("abc", true)` → `"Enter a valid phone number (e.g. +251 911 234 567)"`
- `validateLength("ab", 2, 50, "Name")` → `null`
- `validateLength("a", 2, 50, "Name")` → `"Name must be at least 2 characters"`
- `validateInteger("", 0, 10, "Points")` → `null` (optional)
- `validateInteger("abc", 0, 10, "Points")` → `"Points must be a whole number"`
- `validateInteger("11", 0, 10, "Points")` → `"Points must be between 0 and 10"`
- `validateDateAfter("2025-01-01", "2025-06-01", "End date")` → `"End date must be after the start date"`
- `validateDateAfter("2025-12-31", "2025-01-01", "End date")` → `null`

**Hook behavior examples:**
- Before any blur: `errors` is `{}`
- After blurring an invalid field: `errors.fieldName` is set
- After `validateAll` with invalid values: returns `false`, all errors populated
- After `validateAll` with valid values: returns `true`, no errors
- After `resetValidation`: `errors` is `{}`, `touched` is empty

**Inline error slot examples:**
- With error: renders `<p role="alert" className="text-xs text-destructive mt-1">`
- Without error: renders nothing
- With error: `<Input>` has `aria-describedby` pointing to error `<p>` id

### Property-Based Tests (fast-check, minimum 100 iterations each)

Located in `__tests__/form-validation.property.test.ts`.

Uses the existing `fast-check` library (already in `devDependencies`).

```typescript
// Feature: form-validation, Property 1: Valid inputs always return null
// Feature: form-validation, Property 2: Invalid inputs always return a non-null error string
// Feature: form-validation, Property 3: Validator determinism (purity)
// Feature: form-validation, Property 4: Required error takes precedence over format error
// Feature: form-validation, Property 5: validateAll returns false iff any field has an error
// Feature: form-validation, Property 6: resetValidation clears all state
// Feature: form-validation, Property 7: Untouched fields never show errors
// Feature: form-validation, Property 8: Lineup constraint enforcement
```

**Property 1 & 2 — Valid/invalid inputs:**
- `fc.emailAddress()` → `validateEmail` returns `null`
- `fc.string().filter(s => !isValidEmail(s))` → `validateEmail` returns non-null
- `fc.string({ minLength: 8 })` → `validatePassword` returns `null`
- `fc.string({ maxLength: 7 })` → `validatePassword` returns non-null
- `fc.integer({ min: 0, max: 10 }).map(String)` → `validateInteger("...", 0, 10, "x")` returns `null`
- `fc.integer({ min: 11 }).map(String)` → `validateInteger("...", 0, 10, "x")` returns non-null

**Property 3 — Determinism:**
- For each validator, generate arbitrary inputs, call twice, verify `result1 === result2`

**Property 4 — Required precedence:**
- `validateRequired("", "Email")` returns `"Email is required"`, not `validateEmail("")`

**Property 5 — validateAll correctness:**
- Generate form values where all fields are valid → `validateAll` returns `true`
- Generate form values where at least one field is invalid → `validateAll` returns `false`

**Property 6 — resetValidation:**
- Simulate arbitrary blur sequence, call `resetValidation`, verify empty state

**Property 7 — Untouched fields:**
- Initialize hook, verify `errors` is `{}` before any `handleBlur`

**Property 8 — Lineup constraints:**
- `fc.array(fc.uuid(), { minLength: 11, maxLength: 11 })` → exactly 11 starters → no error
- `fc.array(fc.uuid(), { minLength: 0, maxLength: 10 })` → fewer than 11 → error
- `fc.array(fc.uuid(), { minLength: 12 })` → more than 11 → error
- Captain in starters set → no captain error
- Captain not in starters set → captain error

### Integration Tests

- Login form: submit with empty email shows inline error, no toast
- Login form: submit with valid credentials proceeds to API call
- Season form: submit with end date before start date shows inline error on end date field
- Profile change-password: blur confirm field with mismatch shows inline error immediately
- FormDialog: successful submit calls `resetValidation`, errors cleared on reopen
- Any form: server 400 response still shows toast error (not inline)

### Accessibility Verification

- Each `<Input>` with an active error has `aria-invalid="true"` and `aria-describedby` pointing to the error `<p>` id
- Each error `<p>` has `role="alert"` so screen readers announce it on appearance
- Full WCAG compliance requires manual testing with assistive technologies
