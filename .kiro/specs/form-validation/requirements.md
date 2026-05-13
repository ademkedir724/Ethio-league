# Requirements Document

## Introduction

The Ethio-League admin dashboard currently handles form validation inconsistently across its 22 forms spanning auth pages and dashboard pages. Some forms rely solely on HTML5 attributes (`required`, `minLength`, `pattern`), others fire `toast.error()` calls in submit handlers, and only the profile/change-password form shows inline field-level error messages. This feature introduces **comprehensive, consistent client-side form validation** across all forms without adding new form libraries, using the existing React, TypeScript, Tailwind, and shadcn/ui stack.

The goal is a shared validation utility layer that provides: inline error messages rendered below each field, real-time blur-triggered validation, submit-time full-form validation that blocks submission and highlights every invalid field, and a uniform error message vocabulary across all pages.

## Glossary

- **Validator**: The shared TypeScript module (`lib/validation.ts`) that exports pure validation functions and the `useFormValidation` hook.
- **Validation_Hook**: The `useFormValidation` React hook that manages per-field error state, touched state, blur handlers, and submit-gate logic.
- **Field_Error**: A string error message associated with a single named form field, rendered as a `<p>` element with `text-xs text-destructive` styling directly below the field's `<Input>`, `<Select>`, or `<textarea>`.
- **Touched_Field**: A field the user has interacted with (blurred at least once), making it eligible for real-time error display.
- **Submit_Gate**: The logic inside a form's submit handler that runs full validation, marks all fields as touched, and aborts submission when any field is invalid.
- **Phone_Pattern**: The regular expression `^\+?[\d\s\-().]{7,20}$` used to validate phone number inputs across all forms.
- **Email_Pattern**: The standard RFC-5322-compatible email format validated via a regex equivalent to the browser's `type="email"` check.
- **Auth_Form**: Any form on the `/login`, `/forgot-password`, `/reset-password`, or `/set-password` pages.
- **Dashboard_Form**: Any form inside the `/dashboard/*` pages.
- **FormDialog**: The shared `<FormDialog>` component used by most dashboard forms; its `onSubmit` prop is the integration point for the Submit_Gate.
- **Inline_Error_Slot**: The `<p>` element rendered conditionally below a field when a Field_Error exists for that field.

---

## Requirements

### Requirement 1: Shared Validation Utility Module

**User Story:** As a developer, I want a single source of truth for all validation logic, so that error messages and rules are consistent and easy to maintain across all 22 forms.

#### Acceptance Criteria

1. THE Validator SHALL export a `validateEmail(value: string): string | null` function that returns `null` when the value matches Email_Pattern and returns `"Enter a valid email address"` otherwise.
2. THE Validator SHALL export a `validatePhone(value: string, required: boolean): string | null` function that returns `null` when the value is empty and `required` is `false`, returns `"Phone number is required"` when the value is empty and `required` is `true`, and returns `"Enter a valid phone number (e.g. +251 911 234 567)"` when the value is non-empty and does not match Phone_Pattern.
3. THE Validator SHALL export a `validateRequired(value: string, label: string): string | null` function that returns `null` when the trimmed value is non-empty and returns `"${label} is required"` otherwise.
4. THE Validator SHALL export a `validateLength(value: string, min: number, max: number, label: string): string | null` function that returns `null` when the trimmed length is within `[min, max]`, returns `"${label} must be at least ${min} characters"` when below minimum, and returns `"${label} must be at most ${max} characters"` when above maximum.
5. THE Validator SHALL export a `validatePassword(value: string): string | null` function that returns `null` when the value has at least 8 characters and returns `"Password must be at least 8 characters"` otherwise.
6. THE Validator SHALL export a `validatePasswordMatch(password: string, confirm: string): string | null` function that returns `null` when both values are identical and returns `"Passwords do not match"` otherwise.
7. THE Validator SHALL export a `validateInteger(value: string, min: number, max: number, label: string): string | null` function that returns `null` when the value is empty (field is optional), returns `"${label} must be a whole number"` when the value is non-empty but not a valid integer, and returns `"${label} must be between ${min} and ${max}"` when the parsed integer is outside `[min, max]`.
8. THE Validator SHALL export a `validateDate(value: string, label: string): string | null` function that returns `null` when the value is empty or parses to a valid date and returns `"${label} must be a valid date"` otherwise.
9. THE Validator SHALL export a `validateDateNotFuture(value: string, label: string): string | null` function that returns `null` when the value is empty or the parsed date is not after today's date and returns `"${label} cannot be in the future"` otherwise.
10. THE Validator SHALL export a `validateDateAfter(endValue: string, startValue: string, label: string): string | null` function that returns `null` when `endValue` is empty, `startValue` is empty, or the parsed end date is strictly after the parsed start date, and returns `"${label} must be after the start date"` otherwise.
11. THE Validator SHALL export a `validatePositionCode(value: string): string | null` function that returns `null` when the value matches `^[A-Z]{1,10}$` and returns `"Position code must be 1–10 uppercase letters (e.g. GK, CB)"` otherwise.
12. FOR ALL exported validator functions, THE Validator SHALL be a pure function with no side effects, accepting only primitive string or number arguments and returning either `null` or a non-empty string.

---

### Requirement 2: useFormValidation Hook

**User Story:** As a developer, I want a reusable React hook that manages field error state and touched state, so that I can integrate validation into any form component without duplicating state management logic.

#### Acceptance Criteria

1. THE Validation_Hook SHALL accept a `validate: (values: T) => Partial<Record<keyof T, string>>` function and an initial values object of type `T` and return `{ errors, touched, handleBlur, validateAll, resetValidation }`.
2. WHEN a user blurs a field, THE Validation_Hook SHALL call `validate` with the current form values, extract the error for that field, and update the `errors` state for that field only if the field is in the `touched` set.
3. WHEN `handleBlur(fieldName)` is called, THE Validation_Hook SHALL add `fieldName` to the `touched` set so that subsequent value changes trigger re-validation for that field.
4. WHEN `validateAll(currentValues)` is called, THE Validation_Hook SHALL run `validate` against `currentValues`, mark all fields as touched, update `errors` with all validation results, and return `true` if no errors exist and `false` otherwise.
5. WHEN `resetValidation()` is called, THE Validation_Hook SHALL clear all entries in `errors` and clear the `touched` set.
6. WHILE a field is not in the `touched` set, THE Validation_Hook SHALL not display an error for that field even if `validate` returns an error for it.
7. THE Validation_Hook SHALL be implemented as a generic TypeScript function so that `errors` and `touched` are typed to the keys of `T`.

---

### Requirement 3: Inline Field Error Display

**User Story:** As a user, I want to see a clear error message directly below the field that has a problem, so that I know exactly what to fix without reading a toast notification.

#### Acceptance Criteria

1. WHEN a Field_Error exists for a field, THE Inline_Error_Slot SHALL render a `<p>` element with class `text-xs text-destructive mt-1` containing the error message immediately after the field's input element in the DOM.
2. WHEN no Field_Error exists for a field, THE Inline_Error_Slot SHALL not render any element in that position.
3. THE Inline_Error_Slot SHALL be accessible: the `<Input>` (or equivalent) SHALL have an `aria-describedby` attribute pointing to the error `<p>` element's `id` when an error is present, and the `<p>` element SHALL have `role="alert"`.
4. WHEN a field transitions from invalid to valid (user corrects the input), THE Inline_Error_Slot SHALL disappear without requiring a page reload or form submission.
5. THE Inline_Error_Slot SHALL use the same Tailwind color token (`text-destructive`) as the existing inline errors on the profile change-password form, ensuring visual consistency.

---

### Requirement 4: Blur-Triggered Real-Time Validation

**User Story:** As a user, I want to see validation feedback as soon as I leave a field, so that I can fix mistakes before attempting to submit the form.

#### Acceptance Criteria

1. WHEN a user moves focus away from a required text or email field that is empty, THE Validation_Hook SHALL set a Field_Error for that field immediately.
2. WHEN a user moves focus away from a field that has a format constraint (email, phone, password length, integer range, date), THE Validation_Hook SHALL evaluate the constraint and set or clear the Field_Error for that field.
3. WHEN a user moves focus away from a confirm-password field, THE Validation_Hook SHALL compare it against the corresponding password field and set or clear the Field_Error.
4. WHEN a user moves focus away from an end-date field, THE Validation_Hook SHALL compare it against the start-date field and set or clear the Field_Error.
5. WHILE a field has not yet been blurred (not in the `touched` set), THE Validation_Hook SHALL not show any error for that field, preventing premature error display on page load.
6. WHEN a user corrects a field value after blurring, THE Validation_Hook SHALL re-evaluate on the next blur event and clear the error if the value is now valid.

---

### Requirement 5: Submit-Time Full-Form Validation

**User Story:** As a user, I want the form to prevent submission and highlight all invalid fields at once when I click Submit, so that I can see and fix all problems in one pass.

#### Acceptance Criteria

1. WHEN a user clicks the submit button on any form, THE Submit_Gate SHALL call `validateAll` before executing any API call.
2. IF `validateAll` returns `false`, THEN THE Submit_Gate SHALL abort the API call, mark all fields as touched, and ensure all Field_Errors are visible.
3. IF `validateAll` returns `false`, THEN THE Submit_Gate SHALL focus the first invalid field in DOM order so the user's attention is directed to the first problem.
4. IF `validateAll` returns `true`, THEN THE Submit_Gate SHALL proceed with the existing API call logic unchanged.
5. WHEN submit-time validation fails, THE Submit_Gate SHALL NOT show a generic toast error in place of inline errors; toast errors SHALL only be shown for server-side errors returned by the API.
6. THE Submit_Gate SHALL be integrated into the `onSubmit` prop of `<FormDialog>` components and into the `handleSubmit` / `onSubmit` functions of standalone forms (auth pages, profile page).

---

### Requirement 6: Auth Page Forms Validation

**User Story:** As a user on the login, forgot-password, reset-password, or set-password pages, I want immediate feedback on invalid inputs, so that I can correct them before the form is submitted to the server.

#### Acceptance Criteria

1. WHEN the Login form is submitted with an empty email field, THE Submit_Gate SHALL display `"Email is required"` below the email field.
2. WHEN the Login form is submitted with a non-empty but malformed email, THE Submit_Gate SHALL display `"Enter a valid email address"` below the email field.
3. WHEN the Login form is submitted with an empty password field, THE Submit_Gate SHALL display `"Password is required"` below the password field.
4. WHEN the Forgot Password form is submitted with an empty or malformed email, THE Submit_Gate SHALL display the appropriate Field_Error below the email field.
5. WHEN the Reset Password form is submitted with a password shorter than 8 characters, THE Submit_Gate SHALL display `"Password must be at least 8 characters"` below the password field.
6. WHEN the Reset Password form is submitted with a confirm field that does not match the password field, THE Submit_Gate SHALL display `"Passwords do not match"` below the confirm field.
7. WHEN the Set Password form is submitted with a password shorter than 8 characters, THE Submit_Gate SHALL display `"Password must be at least 8 characters"` below the password field.
8. WHEN the Set Password form is submitted with a confirmPassword field that does not match the password field, THE Submit_Gate SHALL display `"Passwords do not match"` below the confirmPassword field.

---

### Requirement 7: Request Organization Form Validation

**User Story:** As an applicant requesting organization access, I want inline validation on the request form, so that I can submit a complete and correctly formatted application.

#### Acceptance Criteria

1. WHEN the Request Organization form is submitted with an empty `organizationName`, THE Submit_Gate SHALL display `"Organization name is required"` below that field.
2. WHEN `organizationName` is provided but shorter than 2 characters or longer than 120 characters, THE Submit_Gate SHALL display the appropriate length error.
3. WHEN `country` or `city` is empty or outside the 2–80 character range, THE Submit_Gate SHALL display the appropriate required or length error below each respective field.
4. WHEN `description` is provided and exceeds 500 characters, THE Submit_Gate SHALL display `"Description must be at most 500 characters"` below the description field.
5. WHEN `applicantFullName` is empty or outside the 2–80 character range, THE Submit_Gate SHALL display the appropriate error below that field.
6. WHEN `email` is empty or malformed, THE Submit_Gate SHALL display the appropriate email error below the email field.
7. WHEN `phone` is provided and does not match Phone_Pattern, THE Submit_Gate SHALL display `"Enter a valid phone number (e.g. +251 911 234 567)"` below the phone field.
8. WHEN `phone` is empty, THE Submit_Gate SHALL NOT display a phone error because the field is required; THE Submit_Gate SHALL display `"Phone number is required"` below the phone field.

---

### Requirement 8: Profile Page Forms Validation

**User Story:** As a logged-in user editing my profile or changing my password, I want inline validation that matches the existing partial validation already present, so that the experience is consistent and complete.

#### Acceptance Criteria

1. WHEN the Edit Profile dialog is submitted with an empty or too-short `editFullName`, THE Submit_Gate SHALL display `"Full name must be at least 2 characters"` below the full name field.
2. WHEN `editFullName` exceeds 80 characters, THE Submit_Gate SHALL display `"Full name must be at most 80 characters"` below the full name field.
3. WHEN `editPhone` is provided and does not match Phone_Pattern, THE Submit_Gate SHALL display `"Enter a valid phone number (e.g. +251 911 234 567)"` below the phone field.
4. WHEN the Change Password form is submitted with an empty `currentPassword`, THE Submit_Gate SHALL display `"Current password is required"` below that field.
5. WHEN `newPassword` is shorter than 8 characters, THE Submit_Gate SHALL display `"Password must be at least 8 characters"` below the new password field.
6. WHEN `confirmPassword` does not match `newPassword`, THE Submit_Gate SHALL display `"Passwords do not match"` below the confirm password field.
7. WHEN the user blurs the `confirmPassword` field and it does not match `newPassword`, THE Validation_Hook SHALL immediately show `"Passwords do not match"` below that field (this behavior already exists partially; it SHALL be unified with the hook).

---

### Requirement 9: Player and Coach Form Validation

**User Story:** As a club admin adding or editing players or coaches, I want inline validation on the form fields, so that I can avoid submitting incomplete or out-of-range data.

#### Acceptance Criteria

1. WHEN the Add/Edit Player form is submitted with an empty `firstName` or `lastName`, THE Submit_Gate SHALL display `"First name is required"` or `"Last name is required"` below the respective field.
2. WHEN `firstName` or `lastName` is outside the 2–50 character range, THE Submit_Gate SHALL display the appropriate length error.
3. WHEN `dateOfBirth` is provided and is a future date, THE Submit_Gate SHALL display `"Date of birth cannot be in the future"` below the date field.
4. WHEN `nationality` is provided and exceeds 60 characters, THE Submit_Gate SHALL display `"Nationality must be at most 60 characters"`.
5. WHEN `heightCm` is provided and is not an integer in the range 100–250, THE Submit_Gate SHALL display `"Height must be between 100 and 250"`.
6. WHEN `weightKg` is provided and is not an integer in the range 30–200, THE Submit_Gate SHALL display `"Weight must be between 30 and 200"`.
7. WHEN the Add/Edit Coach form is submitted with an empty `firstName` or `lastName`, THE Submit_Gate SHALL display the appropriate required error.
8. WHEN `experienceYears` is provided and is not an integer in the range 0–60, THE Submit_Gate SHALL display `"Experience must be between 0 and 60"`.

---

### Requirement 10: Referee Form Validation

**User Story:** As an organization admin adding or editing referees, I want inline validation, so that I can ensure all required fields are filled and optional fields are within valid ranges.

#### Acceptance Criteria

1. WHEN the Add/Edit Referee form is submitted with an empty `firstName` or `lastName`, THE Submit_Gate SHALL display the appropriate required error below each field.
2. WHEN `firstName` or `lastName` is outside the 2–50 character range, THE Submit_Gate SHALL display the appropriate length error.
3. WHEN `dateOfBirth` is provided and is a future date, THE Submit_Gate SHALL display `"Date of birth cannot be in the future"`.
4. WHEN `licenseLevel` is empty (it is required for referees), THE Submit_Gate SHALL display `"License level is required"` below the license select field.
5. WHEN `experienceYears` is provided and is not an integer in the range 0–60, THE Submit_Gate SHALL display `"Experience must be between 0 and 60"`.
6. WHEN `region` is provided and exceeds 80 characters, THE Submit_Gate SHALL display `"Region must be at most 80 characters"`.

---

### Requirement 11: League Form Validation

**User Story:** As an organization admin creating or editing a league, I want inline validation on the league form, so that required fields and admin account details are always provided correctly.

#### Acceptance Criteria

1. WHEN the Create/Edit League form is submitted with an empty `name`, THE Submit_Gate SHALL display `"League name is required"` below the name field.
2. WHEN `name` is outside the 2–120 character range, THE Submit_Gate SHALL display the appropriate length error.
3. WHEN `description` is provided and exceeds 500 characters, THE Submit_Gate SHALL display `"Description must be at most 500 characters"`.
4. WHEN creating a new league and `adminFullName` is empty or outside the 2–80 character range, THE Submit_Gate SHALL display the appropriate error below the admin full name field.
5. WHEN creating a new league and `adminEmail` is empty or malformed, THE Submit_Gate SHALL display the appropriate email error below the admin email field.
6. WHEN `adminPhone` is provided and does not match Phone_Pattern, THE Submit_Gate SHALL display the phone format error below the admin phone field.
7. WHEN editing an existing league, THE Submit_Gate SHALL NOT validate `adminFullName`, `adminEmail`, or `adminPhone` because those fields are not shown in edit mode.

---

### Requirement 12: Club Form Validation

**User Story:** As a league admin creating a club, I want inline validation on the club creation form, so that the club name and admin account details are always valid before submission.

#### Acceptance Criteria

1. WHEN the Create Club form is submitted with an empty `name`, THE Submit_Gate SHALL display `"Club name is required"` below the name field.
2. WHEN `name` is outside the 2–120 character range, THE Submit_Gate SHALL display the appropriate length error.
3. WHEN `adminFullName` is empty or outside the 2–80 character range, THE Submit_Gate SHALL display the appropriate error below the admin full name field.
4. WHEN `adminEmail` is empty or malformed, THE Submit_Gate SHALL display the appropriate email error below the admin email field.
5. WHEN `adminPhone` is provided and does not match Phone_Pattern, THE Submit_Gate SHALL display the phone format error below the admin phone field.

---

### Requirement 13: Season Form Validation

**User Story:** As a league admin creating or editing a season, I want inline validation on all season fields, so that date ranges, point values, and squad size constraints are always logically consistent.

#### Acceptance Criteria

1. WHEN the Create/Edit Season form is submitted with an empty `name`, THE Submit_Gate SHALL display `"Season name is required"` below the name field.
2. WHEN `name` is outside the 2–100 character range, THE Submit_Gate SHALL display the appropriate length error.
3. WHEN creating a new season and `leagueId` is not selected, THE Submit_Gate SHALL display `"Please select a league"` below the league selector.
4. WHEN `startDate` is empty, THE Submit_Gate SHALL display `"Start date is required"` below the start date field.
5. WHEN `endDate` is empty, THE Submit_Gate SHALL display `"End date is required"` below the end date field.
6. WHEN both `startDate` and `endDate` are provided and `endDate` is not after `startDate`, THE Submit_Gate SHALL display `"End date must be after the start date"` below the end date field.
7. WHEN any of `pointsWin`, `pointsDraw`, or `pointsLoss` is not an integer in the range 0–10, THE Submit_Gate SHALL display the appropriate range error below the respective field.
8. WHEN `minSquadSize` is not an integer in the range 1–50, THE Submit_Gate SHALL display `"Min squad size must be between 1 and 50"`.
9. WHEN `minStartingPlayers` is not an integer in the range 1–25, THE Submit_Gate SHALL display `"Starting players must be between 1 and 25"`.
10. WHEN `maxBenchPlayers` is not an integer in the range 0–20, THE Submit_Gate SHALL display `"Bench players must be between 0 and 20"`.
11. WHEN `rules` is provided and exceeds 1000 characters, THE Submit_Gate SHALL display `"Rules must be at most 1000 characters"`.

---

### Requirement 14: User Management Form Validation

**User Story:** As an organization admin or super admin managing users, I want inline validation on the user creation and edit forms, so that all required fields are present and correctly formatted.

#### Acceptance Criteria

1. WHEN the Add Match Event Admin form (org admin) is submitted with an empty `fullName` or a `fullName` outside the 2–80 character range, THE Submit_Gate SHALL display the appropriate error below the full name field.
2. WHEN creating a new Match Event Admin and `email` is empty or malformed, THE Submit_Gate SHALL display the appropriate email error below the email field.
3. WHEN `phone` is provided and does not match Phone_Pattern, THE Submit_Gate SHALL display the phone format error below the phone field.
4. WHEN the Add/Edit User form (super admin) is submitted with an empty `fullName` or a `fullName` outside the 2–80 character range, THE Submit_Gate SHALL display the appropriate error.
5. WHEN creating a new user (super admin) and `email` is empty or malformed, THE Submit_Gate SHALL display the appropriate email error.
6. WHEN creating a new user (super admin) and `password` is shorter than 8 characters, THE Submit_Gate SHALL display `"Password must be at least 8 characters"` below the password field.
7. WHEN creating a new user (super admin) and `role` is not selected, THE Submit_Gate SHALL display `"Role is required"` below the role selector.

---

### Requirement 15: System Config Form Validation

**User Story:** As a super admin managing league types, event types, and positions, I want inline validation on the config forms, so that names and codes always meet the required format.

#### Acceptance Criteria

1. WHEN the League Type or Event Type form is submitted with an empty `name`, THE Submit_Gate SHALL display `"Name is required"` below the name field.
2. WHEN `name` exceeds 100 characters, THE Submit_Gate SHALL display `"Name must be at most 100 characters"`.
3. WHEN `description` is provided and exceeds 255 characters, THE Submit_Gate SHALL display `"Description must be at most 255 characters"`.
4. WHEN the Position form is submitted with an empty `code`, THE Submit_Gate SHALL display `"Code is required"` below the code field.
5. WHEN `code` does not match `^[A-Z]{1,10}$`, THE Submit_Gate SHALL display `"Position code must be 1–10 uppercase letters (e.g. GK, CB)"` below the code field.
6. WHEN the Position form is submitted with an empty `name`, THE Submit_Gate SHALL display `"Name is required"` below the name field.
7. WHEN the Position `name` exceeds 50 characters, THE Submit_Gate SHALL display `"Name must be at most 50 characters"`.

---

### Requirement 16: Match Forms Validation

**User Story:** As a league admin or match event admin editing match details or scores, I want inline validation, so that I cannot save an invalid date or an out-of-range score.

#### Acceptance Criteria

1. WHEN the Edit Match form is submitted with an empty `matchDate`, THE Submit_Gate SHALL display `"Match date is required"` below the datetime field.
2. WHEN `roundNumber` is provided and is not an integer in the range 1–100, THE Submit_Gate SHALL display `"Round number must be between 1 and 100"`.
3. WHEN the Edit Score form is submitted with an empty `homeScore` or `awayScore`, THE Submit_Gate SHALL display `"Score is required"` below the respective field.
4. WHEN `homeScore` or `awayScore` is not an integer in the range 0–99, THE Submit_Gate SHALL display `"Score must be between 0 and 99"` below the respective field.

---

### Requirement 17: Log Event Form Validation

**User Story:** As a match event admin logging a match event, I want inline validation on the event form, so that I cannot submit an event without the required fields.

#### Acceptance Criteria

1. WHEN the Log Event form is submitted with no `eventTypeId` selected, THE Submit_Gate SHALL display `"Event type is required"` below the event type selector.
2. WHEN `clubSide` is not selected, THE Submit_Gate SHALL display `"Club side is required"` below the club side selector.
3. WHEN `playerId` is not selected, THE Submit_Gate SHALL display `"Player is required"` below the player selector.
4. WHEN `minute` is provided and is not an integer in the range 0–120, THE Submit_Gate SHALL display `"Minute must be between 0 and 120"`.
5. WHEN `extraTime` is provided and is not an integer in the range 0–30, THE Submit_Gate SHALL display `"Extra time must be between 0 and 30"`.
6. WHEN `description` is provided and exceeds 255 characters, THE Submit_Gate SHALL display `"Description must be at most 255 characters"`.
7. WHEN the selected event type is a substitution event and `relatedPlayerId` is not selected, THE Submit_Gate SHALL display `"Substitute player is required for substitution events"` below the related player selector.

---

### Requirement 18: Fixture Edit Form Validation

**User Story:** As a league admin editing a fixture's date, time, and stadium, I want inline validation, so that I cannot save a fixture without a valid date and kickoff time.

#### Acceptance Criteria

1. WHEN the Edit Fixture form is submitted with an empty `matchDate`, THE Submit_Gate SHALL display `"Match date is required"` below the date field.
2. WHEN `matchTime` is not selected from the preset list, THE Submit_Gate SHALL display `"Kickoff time is required"` below the time selector.
3. WHEN both `matchDate` and `matchTime` are provided, THE Submit_Gate SHALL accept any valid combination without additional constraints.

---

### Requirement 19: Lineup Submission Form Validation

**User Story:** As a club admin submitting a lineup, I want inline validation that enforces the exact starter count and captain selection rules, so that I cannot submit an invalid lineup.

#### Acceptance Criteria

1. WHEN the Submit Lineup form is submitted with fewer than 11 starters selected, THE Submit_Gate SHALL display `"Exactly 11 starters must be selected"` in the starters section.
2. WHEN the Submit Lineup form is submitted with more than 11 starters selected, THE Submit_Gate SHALL display `"Exactly 11 starters must be selected"` in the starters section.
3. WHEN the Submit Lineup form is submitted with more than 7 substitutes selected, THE Submit_Gate SHALL display `"Maximum 7 substitutes allowed"` in the substitutes section.
4. WHEN starters are selected but no `captainId` is chosen, THE Submit_Gate SHALL display `"Captain must be selected from the starting lineup"` below the captain selector.
5. WHEN a `captainId` is selected that is not in the current starters set, THE Submit_Gate SHALL display `"Captain must be one of the selected starters"` below the captain selector.
6. WHEN all lineup constraints are satisfied, THE Submit_Gate SHALL proceed with the API call without displaying any lineup errors.

---

### Requirement 20: Validation Consistency and Error Message Standards

**User Story:** As a user navigating multiple pages of the dashboard, I want error messages to use consistent wording and styling across all forms, so that the experience feels unified and professional.

#### Acceptance Criteria

1. THE Validator SHALL use the exact error message strings specified in Requirements 6–19 for all corresponding validation failures, with no variation in wording between forms that share the same rule.
2. WHEN a field has both a required error and a format error simultaneously (e.g., empty email), THE Submit_Gate SHALL display only the required error, not the format error.
3. THE Inline_Error_Slot SHALL always use `text-xs text-destructive mt-1` Tailwind classes, matching the existing error style on the profile change-password form.
4. WHEN a form is successfully submitted and the dialog or form is reset, THE Validation_Hook SHALL call `resetValidation()` to clear all errors and touched state.
5. THE Submit_Gate SHALL preserve all existing `toast.error()` calls for server-side API errors; client-side validation errors SHALL only appear as inline Field_Errors, not as toasts.
6. WHERE a form field already has an HTML5 `required`, `minLength`, `maxLength`, `min`, `max`, or `pattern` attribute, THE Validator SHALL enforce the same constraint so that the inline error and the HTML5 constraint are always in agreement.
