# Implementation Plan: Comprehensive Client-Side Form Validation

## Overview

Implement a uniform, library-free validation layer for all 22 forms in the Ethio-League admin dashboard. The work proceeds in three phases: (1) build the shared validation primitives, (2) write property-based tests, and (3) integrate validation into every form page-by-page.

## Tasks

- [x] 1. Create `lib/validation.ts` — pure validator functions and error message constants
  - Implement `validateEmail(value: string): string | null` using RFC-5322-compatible regex
  - Implement `validatePhone(value: string, required: boolean): string | null` using `^\+?[\d\s\-().]{7,20}$`
  - Implement `validateRequired(value: string, label: string): string | null` (trim check)
  - Implement `validateLength(value: string, min: number, max: number, label: string): string | null`
  - Implement `validatePassword(value: string): string | null` (min 8 chars)
  - Implement `validatePasswordMatch(password: string, confirm: string): string | null`
  - Implement `validateInteger(value: string, min: number, max: number, label: string): string | null` (empty → null for optional fields)
  - Implement `validateDate(value: string, label: string): string | null`
  - Implement `validateDateNotFuture(value: string, label: string): string | null`
  - Implement `validateDateAfter(endValue: string, startValue: string, label: string): string | null`
  - Implement `validatePositionCode(value: string): string | null` matching `^[A-Z]{1,10}$`
  - Export named error message constants: `MSG_EMAIL_INVALID`, `MSG_PHONE_INVALID`, `MSG_PHONE_REQUIRED`, `MSG_PASSWORD_MIN`, `MSG_PASSWORDS_MISMATCH`, `MSG_POSITION_CODE_INVALID`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12_

- [x] 2. Create `lib/use-form-validation.ts` — the `useFormValidation` hook
  - Define `UseFormValidationReturn<T>` interface with `errors`, `touched`, `handleBlur`, `validateAll`, `resetValidation`
  - Implement `useFormValidation<T>` using `useState` for `errors` and `touched`
  - `handleBlur(field, currentValues)`: marks field as touched, runs `validate`, updates only that field's error
  - `validateAll(currentValues)`: runs `validate`, marks all fields touched, sets all errors, returns boolean
  - `resetValidation()`: clears `errors` to `{}` and `touched` to `new Set()`
  - Ensure untouched fields never appear in `errors` (gate on `touched` set)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 3. Write property-based tests in `__tests__/form-validation.property.test.ts`
  - [ ]* 3.1 Property 1 — Valid inputs always return null
    - Use `fc.emailAddress()` → `validateEmail` returns `null`
    - Use `fc.string({ minLength: 8 })` → `validatePassword` returns `null`
    - Use `fc.integer({ min: 0, max: 10 }).map(String)` → `validateInteger("...", 0, 10, "x")` returns `null`
    - Cover all other validators with valid-input generators
    - **Property 1: Valid inputs always return null**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11**
  - [ ]* 3.2 Property 2 — Invalid inputs always return a non-null error string
    - Use `fc.string().filter(s => !isValidEmail(s))` → `validateEmail` returns non-null
    - Use `fc.string({ maxLength: 7 })` → `validatePassword` returns non-null
    - Use `fc.integer({ min: 11 }).map(String)` → `validateInteger("...", 0, 10, "x")` returns non-null
    - Cover all other validators with invalid-input generators
    - **Property 2: Invalid inputs always return a non-null error string**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11**
  - [ ]* 3.3 Property 3 — Validator determinism (purity)
    - For each validator, generate arbitrary inputs, call twice, assert `result1 === result2`
    - **Property 3: Validator determinism (purity)**
    - **Validates: Requirements 1.12**
  - [ ]* 3.4 Property 4 — Required error takes precedence over format error
    - Assert `validateRequired("", "Email")` returns the required message, not the email format message
    - Assert `validatePhone("", true)` returns `MSG_PHONE_REQUIRED`, not `MSG_PHONE_INVALID`
    - **Property 4: Required error takes precedence over format error**
    - **Validates: Requirements 20.2**
  - [ ]* 3.5 Property 5 — `validateAll` returns false iff any field has an error
    - Generate form values where all fields are valid → `validateAll` returns `true`
    - Generate form values where at least one field is invalid → `validateAll` returns `false`
    - **Property 5: validateAll returns false iff any field has an error**
    - **Validates: Requirements 2.4, 5.1, 5.2, 5.4**
  - [ ]* 3.6 Property 6 — `resetValidation` clears all state
    - Simulate arbitrary `handleBlur` sequence, call `resetValidation`, assert `errors === {}` and `touched` is empty
    - **Property 6: resetValidation clears all state**
    - **Validates: Requirements 2.5, 20.4**
  - [ ]* 3.7 Property 7 — Untouched fields never show errors
    - Initialize hook with invalid values, assert `errors` is `{}` before any `handleBlur`
    - **Property 7: Untouched fields never show errors**
    - **Validates: Requirements 2.6, 4.5**
  - [ ]* 3.8 Property 8 — Lineup constraint enforcement
    - `fc.array(fc.uuid(), { minLength: 11, maxLength: 11 })` → exactly 11 starters → no starters error
    - `fc.array(fc.uuid(), { minLength: 0, maxLength: 10 })` → fewer than 11 → starters error
    - `fc.array(fc.uuid(), { minLength: 12 })` → more than 11 → starters error
    - Captain in starters set → no captain error; captain not in starters set → captain error
    - **Property 8: Lineup constraint enforcement**
    - **Validates: Requirements 19.1, 19.2, 19.4, 19.5**

- [x] 4. Checkpoint — Validate the core library
  - Ensure all property-based tests pass, ask the user if questions arise.

- [x] 5. Integrate validation into auth pages
  - [x] 5.1 Login page (`app/(auth)/login/page.tsx`)
    - Add `validate` function for `{ email, password }` using `validateRequired` + `validateEmail`
    - Wire `useFormValidation`, add `onBlur` handlers to email and password inputs
    - Add inline error slots below each field with `aria-describedby` / `aria-invalid` / `role="alert"`
    - Add submit gate: call `validateAll` before API call; return early if invalid
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3_
  - [x] 5.2 Forgot Password page (`app/(auth)/forgot-password/page.tsx`)
    - Add `validate` function for `{ email }` using `validateRequired` + `validateEmail`
    - Wire hook, add blur handler, inline error slot, submit gate
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 6.4_
  - [x] 5.3 Reset Password page (`app/(auth)/reset-password/page.tsx`)
    - Add `validate` function for `{ password, confirmPassword }` using `validatePassword` + `validatePasswordMatch`
    - Wire hook, add blur handlers, inline error slots, submit gate
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 6.5, 6.6_
  - [x] 5.4 Set Password page (`app/(auth)/set-password/page.tsx`)
    - Add `validate` function for `{ password, confirmPassword }` using `validatePassword` + `validatePasswordMatch`
    - Wire hook, add blur handlers, inline error slots, submit gate
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 6.7, 6.8_
  - [x] 5.5 Request Organization page (`app/(auth)/request-organization/page.tsx`)
    - Add `validate` function covering `organizationName`, `country`, `city`, `description`, `applicantFullName`, `email`, `phone`
    - Use `validateRequired` + `validateLength` for text fields; `validateEmail`; `validatePhone(required=true)` for phone
    - Wire hook, add blur handlers to all text/email/phone inputs, inline error slots, submit gate
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 6. Integrate validation into profile page (`app/dashboard/profile/page.tsx`)
  - [x] 6.1 Edit Profile dialog
    - Add `validate` function for `{ editFullName, editPhone }` using `validateRequired` + `validateLength` + `validatePhone(required=false)`
    - Wire hook, add blur handlers, inline error slots, submit gate; call `resetValidation` on dialog close
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 8.1, 8.2, 8.3, 20.4_
  - [x] 6.2 Change Password form
    - Add `validate` function for `{ currentPassword, newPassword, confirmPassword }` using `validateRequired`, `validatePassword`, `validatePasswordMatch`
    - Unify with the hook (replacing any existing ad-hoc inline error logic)
    - Wire hook, add blur handlers, inline error slots, submit gate; call `resetValidation` on success
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 8.4, 8.5, 8.6, 8.7, 20.4_

- [x] 7. Integrate validation into players page (`app/dashboard/players/page.tsx`)
  - Add `validate` function for the Add/Edit Player form covering `firstName`, `lastName`, `dateOfBirth`, `nationality`, `heightCm`, `weightKg`
  - Use `validateRequired` + `validateLength` for names; `validateDateNotFuture` for DOB; `validateLength` for nationality; `validateInteger` for height/weight
  - Wire hook, add blur handlers to text/number inputs, inline error slots, submit gate; call `resetValidation` on dialog close
  - _Requirements: 5.1, 5.2, 5.4, 5.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 20.4_

- [x] 8. Integrate validation into coaches page (`app/dashboard/coaches/page.tsx`)
  - Add `validate` function for the Add/Edit Coach form covering `firstName`, `lastName`, `dateOfBirth`, `nationality`, `experienceYears`
  - Use `validateRequired` + `validateLength` for names; `validateDateNotFuture` for DOB; `validateLength` for nationality; `validateInteger(0,60)` for experience
  - Wire hook, add blur handlers, inline error slots, submit gate; call `resetValidation` on dialog close
  - _Requirements: 5.1, 5.2, 5.4, 5.5, 9.7, 9.8, 20.4_

- [x] 9. Integrate validation into referees page (`app/dashboard/referees/page.tsx`)
  - Add `validate` function for the Add/Edit Referee form covering `firstName`, `lastName`, `dateOfBirth`, `licenseLevel`, `experienceYears`, `region`
  - Use `validateRequired` + `validateLength` for names; `validateDateNotFuture` for DOB; `validateRequired` for `licenseLevel` (select); `validateInteger(0,60)` for experience; `validateLength(0,80)` for region
  - Wire hook, add blur handlers to text inputs (select fields validated at submit only), inline error slots, submit gate; call `resetValidation` on dialog close
  - _Requirements: 5.1, 5.2, 5.4, 5.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 20.4_

- [ ] 10. Checkpoint — Verify auth and people-management forms
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Integrate validation into leagues page (`app/dashboard/leagues/page.tsx`)
  - Add `validate` function for Create League form covering `name`, `description`, `adminFullName`, `adminEmail`, `adminPhone`
  - Add separate `validate` function for Edit League form covering only `name` and `description` (admin fields hidden in edit mode)
  - Use `validateRequired` + `validateLength(2,120)` for name; `validateLength(0,500)` for description; `validateRequired` + `validateLength(2,80)` for adminFullName; `validateRequired` + `validateEmail` for adminEmail; `validatePhone(required=false)` for adminPhone
  - Wire hook, add blur handlers, inline error slots, submit gate; call `resetValidation` on dialog close
  - _Requirements: 5.1, 5.2, 5.4, 5.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 20.4_

- [x] 12. Integrate validation into clubs page (`app/dashboard/clubs/page.tsx`)
  - Add `validate` function for Create Club form covering `name`, `adminFullName`, `adminEmail`, `adminPhone`
  - Use `validateRequired` + `validateLength(2,120)` for name; `validateRequired` + `validateLength(2,80)` for adminFullName; `validateRequired` + `validateEmail` for adminEmail; `validatePhone(required=false)` for adminPhone
  - Wire hook, add blur handlers, inline error slots, submit gate; call `resetValidation` on dialog close
  - _Requirements: 5.1, 5.2, 5.4, 5.5, 12.1, 12.2, 12.3, 12.4, 12.5, 20.4_

- [x] 13. Integrate validation into seasons page (`app/dashboard/seasons/page.tsx`)
  - Add `validate` function for Create/Edit Season form covering `name`, `leagueId`, `startDate`, `endDate`, `pointsWin`, `pointsDraw`, `pointsLoss`, `minSquadSize`, `minStartingPlayers`, `maxBenchPlayers`, `rules`
  - Use `validateRequired` + `validateLength(2,100)` for name; required check for `leagueId` (create only); `validateRequired` for dates; `validateDateAfter` for endDate; `validateInteger` for all numeric fields; `validateLength(0,1000)` for rules
  - Wire hook, add blur handlers to text/number inputs, inline error slots, submit gate; call `resetValidation` on dialog close
  - _Requirements: 5.1, 5.2, 5.4, 5.5, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 20.4_

- [x] 14. Integrate validation into users page (`app/dashboard/users/page.tsx`)
  - Add `validate` function for Add/Edit User form covering `fullName`, `email` (create only), `password` (create only), `role` (create only), `phone`
  - Use `validateRequired` + `validateLength(2,80)` for fullName; `validateRequired` + `validateEmail` for email; `validatePassword` for password; required check for role select; `validatePhone(required=false)` for phone
  - Wire hook, add blur handlers, inline error slots, submit gate; call `resetValidation` on dialog close
  - _Requirements: 5.1, 5.2, 5.4, 5.5, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 20.4_

- [x] 15. Integrate validation into system-config page (`app/dashboard/system-config/page.tsx`)
  - Add `validate` function for League Type / Event Type forms covering `name` and `description`
  - Add `validate` function for Position form covering `code` and `name`
  - Use `validateRequired` + `validateLength(1,100)` for type names; `validateLength(0,255)` for description; `validateRequired` + `validatePositionCode` for position code; `validateRequired` + `validateLength(1,50)` for position name
  - Wire hook, add blur handlers, inline error slots, submit gate; call `resetValidation` on dialog close
  - _Requirements: 5.1, 5.2, 5.4, 5.5, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 20.4_

- [ ] 16. Checkpoint — Verify entity management forms
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Integrate validation into matches page (`app/dashboard/matches/page.tsx`)
  - [x] 17.1 Edit Match form
    - Add `validate` function for `{ matchDate, roundNumber }` using `validateRequired` for matchDate; `validateInteger(1,100)` for roundNumber
    - Wire hook, add blur handlers, inline error slots, submit gate; call `resetValidation` on dialog close
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 16.1, 16.2, 20.4_
  - [x] 17.2 Edit Score form
    - Add `validate` function for `{ homeScore, awayScore }` using `validateRequired` + `validateInteger(0,99)` for each score field
    - Wire hook, add blur handlers, inline error slots, submit gate; call `resetValidation` on dialog close
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 16.3, 16.4, 20.4_

- [x] 18. Integrate validation into match detail page (`app/dashboard/matches/[id]/page.tsx`)
  - Add `validate` function for the Log Event form covering `eventTypeId`, `clubSide`, `playerId`, `minute`, `extraTime`, `description`, `relatedPlayerId`
  - Use required checks for select fields (`eventTypeId`, `clubSide`, `playerId`); `validateInteger(0,120)` for minute; `validateInteger(0,30)` for extraTime; `validateLength(0,255)` for description; conditional required for `relatedPlayerId` when event type is substitution
  - Wire hook, add blur handlers to text/number inputs (selects validated at submit only), inline error slots, submit gate; call `resetValidation` on dialog close
  - _Requirements: 5.1, 5.2, 5.4, 5.5, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 20.4_

- [x] 19. Integrate validation into season detail page (`app/dashboard/seasons/[id]/page.tsx`)
  - Add `validate` function for the Edit Fixture form covering `matchDate` and `matchTime`
  - Use `validateRequired` for both fields
  - Wire hook, add blur handler for matchDate (matchTime is a select), inline error slots, submit gate; call `resetValidation` on dialog close
  - _Requirements: 5.1, 5.2, 5.4, 5.5, 18.1, 18.2, 18.3, 20.4_

- [x] 20. Integrate validation into lineups page (`app/dashboard/lineups/page.tsx`)
  - Add lineup-specific validation logic for `starters` (array), `substitutes` (array), and `captainId`
  - Validate: starters count must be exactly 11; substitutes count must be ≤ 7; captainId must be non-empty and present in starters array
  - Wire submit gate: call lineup validation before API call; display errors in the starters section and below the captain selector; return early if invalid
  - _Requirements: 5.1, 5.2, 5.4, 5.5, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

- [ ] 21. Final checkpoint — Full integration verification
  - Ensure all property-based tests pass and all forms have inline error slots with correct `aria-describedby`, `aria-invalid`, and `role="alert"` attributes.
  - Verify that no client-side validation error triggers a toast (toasts remain only for server-side API errors).
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical milestones
- Property tests validate universal correctness properties across all 8 properties defined in the design
- Unit tests validate specific examples and edge cases
- Select fields (no blur event) are validated only at submit time via `validateAll`; no `onBlur` handler is needed for them
- The `??` chaining pattern in `validate` functions ensures required errors take precedence over format errors (Requirement 20.2)
- `resetValidation()` must be called both on successful submit and when a dialog is closed without submitting (Requirement 20.4)
