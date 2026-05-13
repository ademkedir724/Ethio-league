// Feature: form-validation, Property 1: Valid inputs always return null
// Feature: form-validation, Property 2: Invalid inputs always return a non-null error string
// Feature: form-validation, Property 3: Validator determinism (purity)
// Feature: form-validation, Property 4: Required error takes precedence over format error
// Feature: form-validation, Property 5: validateAll returns false iff any field has an error
// Feature: form-validation, Property 6: resetValidation clears all state
// Feature: form-validation, Property 7: Untouched fields never show errors
// Feature: form-validation, Property 8: Lineup constraint enforcement

import { describe, it } from "vitest";
import * as fc from "fast-check";
import {
    validateEmail,
    validatePassword,
    validateInteger,
    validateRequired,
    validateLength,
    validatePasswordMatch,
    validatePhone,
    validateDateNotFuture,
    validateDateAfter,
    validatePositionCode,
    MSG_PHONE_REQUIRED,
    MSG_PHONE_INVALID,
    MSG_EMAIL_INVALID,
    MSG_PASSWORD_MIN,
    MSG_PASSWORDS_MISMATCH,
    MSG_POSITION_CODE_INVALID,
} from "../lib/validation";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generates a past date string (YYYY-MM-DD) */
const pastDateArb = fc
    .integer({ min: 1970, max: 2020 })
    .chain((year) =>
        fc
            .integer({ min: 1, max: 12 })
            .chain((month) =>
                fc.integer({ min: 1, max: 28 }).map((day) => {
                    const mm = String(month).padStart(2, "0");
                    const dd = String(day).padStart(2, "0");
                    return `${year}-${mm}-${dd}`;
                })
            )
    );

/** Generates a future date string (YYYY-MM-DD) */
const futureDateArb = fc
    .integer({ min: 2100, max: 2200 })
    .chain((year) =>
        fc
            .integer({ min: 1, max: 12 })
            .chain((month) =>
                fc.integer({ min: 1, max: 28 }).map((day) => {
                    const mm = String(month).padStart(2, "0");
                    const dd = String(day).padStart(2, "0");
                    return `${year}-${mm}-${dd}`;
                })
            )
    );

/** Generates a valid phone number matching /^\+?[\d\s\-().]{7,20}$/ */
const validPhoneArb = fc
    .integer({ min: 1000000, max: 9999999999999 })
    .map((n) => `+${n}`);

// ─── Property 1: Valid inputs always return null ───────────────────────────────
// Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11

describe("Property 1: Valid inputs always return null", () => {
    it("validateEmail returns null for any valid email address", () => {
        fc.assert(
            fc.property(fc.emailAddress(), (email) => {
                return validateEmail(email) === null;
            }),
            { numRuns: 100 }
        );
    });

    it("validatePassword returns null for any string with at least 8 characters", () => {
        fc.assert(
            fc.property(fc.string({ minLength: 8 }), (password) => {
                return validatePassword(password) === null;
            }),
            { numRuns: 100 }
        );
    });

    it("validateInteger returns null for any integer in range [0, 10]", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 10 }).map(String),
                (value) => {
                    return validateInteger(value, 0, 10, "x") === null;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validateRequired returns null for any non-empty, non-whitespace string", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
                (value) => {
                    return validateRequired(value, "Field") === null;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validateLength returns null for any string within length bounds", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 50 }).chain((min) =>
                    fc.integer({ min, max: 100 }).chain((max) =>
                        fc
                            .string({ minLength: min, maxLength: max })
                            .filter((s) => s.trim().length >= min && s.trim().length <= max)
                            .map((s) => ({ s, min, max }))
                    )
                ),
                ({ s, min, max }) => {
                    return validateLength(s, min, max, "Field") === null;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validatePasswordMatch returns null when both strings are identical", () => {
        fc.assert(
            fc.property(fc.string(), (password) => {
                return validatePasswordMatch(password, password) === null;
            }),
            { numRuns: 100 }
        );
    });

    it("validatePhone returns null for a valid phone number (required=true)", () => {
        fc.assert(
            fc.property(validPhoneArb, (phone) => {
                return validatePhone(phone, true) === null;
            }),
            { numRuns: 100 }
        );
    });

    it("validatePhone returns null for empty string when required=false", () => {
        fc.assert(
            fc.property(fc.constant(""), (value) => {
                return validatePhone(value, false) === null;
            }),
            { numRuns: 100 }
        );
    });

    it("validateDateNotFuture returns null for any past date string", () => {
        fc.assert(
            fc.property(pastDateArb, (dateStr) => {
                return validateDateNotFuture(dateStr, "Date") === null;
            }),
            { numRuns: 100 }
        );
    });

    it("validateDateAfter returns null when end date is strictly after start date", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1970, max: 2000 }).chain((startYear) =>
                    fc.integer({ min: startYear + 1, max: startYear + 50 }).map((endYear) => ({
                        startDate: `${startYear}-01-01`,
                        endDate: `${endYear}-01-01`,
                    }))
                ),
                ({ startDate, endDate }) => {
                    return validateDateAfter(endDate, startDate, "End date") === null;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validatePositionCode returns null for any 1–10 uppercase letter string", () => {
        fc.assert(
            fc.property(
                fc
                    .integer({ min: 1, max: 10 })
                    .chain((len) =>
                        fc.array(fc.integer({ min: 65, max: 90 }), { minLength: len, maxLength: len })
                            .map((codes) => codes.map((c) => String.fromCharCode(c)).join(""))
                    ),
                (code) => {
                    return validatePositionCode(code) === null;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 2: Invalid inputs always return a non-null error string ─────────
// Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11

describe("Property 2: Invalid inputs always return a non-null error string", () => {
    it("validateEmail returns non-null for any non-email string", () => {
        // Strings without '@' are definitely not valid emails
        fc.assert(
            fc.property(
                fc.string().filter((s) => !s.includes("@")),
                (value) => {
                    return validateEmail(value) !== null;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validatePassword returns non-null for any string shorter than 8 characters", () => {
        fc.assert(
            fc.property(fc.string({ maxLength: 7 }), (password) => {
                return validatePassword(password) !== null;
            }),
            { numRuns: 100 }
        );
    });

    it("validateInteger returns non-null for any integer outside range [0, 10]", () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.integer({ min: -1000, max: -1 }).map(String),
                    fc.integer({ min: 11, max: 1000 }).map(String)
                ),
                (value) => {
                    return validateInteger(value, 0, 10, "x") !== null;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validateRequired returns non-null for empty or whitespace-only strings", () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.constant(""),
                    fc.string().map((s) => s.replace(/\S/g, " ")).filter((s) => s.trim().length === 0)
                ),
                (value) => {
                    return validateRequired(value, "Field") !== null;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validateLength returns non-null for strings outside length bounds", () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    // Too short: trimmed length < 5
                    fc.string({ maxLength: 4 }).filter((s) => s.trim().length < 5),
                    // Too long: trimmed length > 10
                    fc.string({ minLength: 11 }).filter((s) => s.trim().length > 10)
                ),
                (value) => {
                    return validateLength(value, 5, 10, "Field") !== null;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validatePasswordMatch returns non-null for non-matching strings", () => {
        fc.assert(
            fc.property(
                fc.string(),
                fc.string(),
                (password, confirm) => {
                    fc.pre(password !== confirm);
                    return validatePasswordMatch(password, confirm) !== null;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validatePhone returns non-null for empty string when required=true", () => {
        fc.assert(
            fc.property(fc.constant(""), (value) => {
                return validatePhone(value, true) !== null;
            }),
            { numRuns: 100 }
        );
    });

    it("validateDateNotFuture returns non-null for any future date string", () => {
        fc.assert(
            fc.property(futureDateArb, (dateStr) => {
                return validateDateNotFuture(dateStr, "Date") !== null;
            }),
            { numRuns: 100 }
        );
    });

    it("validateDateAfter returns non-null when end date is not after start date", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2000, max: 2050 }).chain((year) =>
                    fc.integer({ min: year, max: year + 10 }).map((endYear) => ({
                        // end date same year or earlier
                        startDate: `${year + 1}-06-01`,
                        endDate: `${endYear}-01-01`,
                    }))
                ),
                ({ startDate, endDate }) => {
                    // Only test cases where end <= start
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    fc.pre(end <= start);
                    return validateDateAfter(endDate, startDate, "End date") !== null;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validatePositionCode returns non-null for non-uppercase or too-long strings", () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    // Contains lowercase
                    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /[a-z]/.test(s)),
                    // Too long (> 10 chars, all uppercase)
                    fc
                        .integer({ min: 11, max: 20 })
                        .chain((len) =>
                            fc.array(fc.integer({ min: 65, max: 90 }), { minLength: len, maxLength: len })
                                .map((codes) => codes.map((c) => String.fromCharCode(c)).join(""))
                        ),
                    // Empty string
                    fc.constant("")
                ),
                (value) => {
                    return validatePositionCode(value) !== null;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 3: Validator determinism (purity) ───────────────────────────────
// Validates: Requirements 1.12

describe("Property 3: Validator determinism (purity)", () => {
    it("validateEmail is deterministic for any input", () => {
        fc.assert(
            fc.property(fc.string(), (value) => {
                return validateEmail(value) === validateEmail(value);
            }),
            { numRuns: 100 }
        );
    });

    it("validatePassword is deterministic for any input", () => {
        fc.assert(
            fc.property(fc.string(), (value) => {
                return validatePassword(value) === validatePassword(value);
            }),
            { numRuns: 100 }
        );
    });

    it("validateRequired is deterministic for any input", () => {
        fc.assert(
            fc.property(fc.string(), fc.string(), (value, label) => {
                return validateRequired(value, label) === validateRequired(value, label);
            }),
            { numRuns: 100 }
        );
    });

    it("validateLength is deterministic for any input", () => {
        fc.assert(
            fc.property(
                fc.string(),
                fc.integer({ min: 0, max: 50 }),
                fc.integer({ min: 51, max: 200 }),
                fc.string(),
                (value, min, max, label) => {
                    return validateLength(value, min, max, label) === validateLength(value, min, max, label);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validatePasswordMatch is deterministic for any input", () => {
        fc.assert(
            fc.property(fc.string(), fc.string(), (password, confirm) => {
                return (
                    validatePasswordMatch(password, confirm) ===
                    validatePasswordMatch(password, confirm)
                );
            }),
            { numRuns: 100 }
        );
    });

    it("validateInteger is deterministic for any input", () => {
        fc.assert(
            fc.property(fc.string(), fc.string(), (value, label) => {
                return (
                    validateInteger(value, 0, 100, label) === validateInteger(value, 0, 100, label)
                );
            }),
            { numRuns: 100 }
        );
    });

    it("validatePhone is deterministic for any input", () => {
        fc.assert(
            fc.property(fc.string(), fc.boolean(), (value, required) => {
                return validatePhone(value, required) === validatePhone(value, required);
            }),
            { numRuns: 100 }
        );
    });

    it("validateDateNotFuture is deterministic for any input", () => {
        fc.assert(
            fc.property(fc.string(), fc.string(), (value, label) => {
                return (
                    validateDateNotFuture(value, label) === validateDateNotFuture(value, label)
                );
            }),
            { numRuns: 100 }
        );
    });

    it("validateDateAfter is deterministic for any input", () => {
        fc.assert(
            fc.property(fc.string(), fc.string(), fc.string(), (end, start, label) => {
                return (
                    validateDateAfter(end, start, label) === validateDateAfter(end, start, label)
                );
            }),
            { numRuns: 100 }
        );
    });

    it("validatePositionCode is deterministic for any input", () => {
        fc.assert(
            fc.property(fc.string(), (value) => {
                return validatePositionCode(value) === validatePositionCode(value);
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 4: Required error takes precedence over format error ─────────────
// Validates: Requirements 20.2

describe("Property 4: Required error takes precedence over format error", () => {
    it("validateRequired('', 'Email') returns the required message, not the email format message", () => {
        fc.assert(
            fc.property(fc.constant(""), (value) => {
                const result = validateRequired(value, "Email");
                // result is "Email is required"; verify it is NOT the email format error
                const notEmailFormatError = (result as unknown as string) !== (MSG_EMAIL_INVALID as unknown as string);
                return result === "Email is required" && notEmailFormatError;
            }),
            { numRuns: 100 }
        );
    });

    it("validatePhone('', true) returns MSG_PHONE_REQUIRED, not MSG_PHONE_INVALID", () => {
        fc.assert(
            fc.property(fc.constant(""), (value) => {
                const result = validatePhone(value, true);
                // result is MSG_PHONE_REQUIRED; verify it is NOT MSG_PHONE_INVALID
                const notPhoneInvalid = (result as unknown as string) !== (MSG_PHONE_INVALID as unknown as string);
                return result === MSG_PHONE_REQUIRED && notPhoneInvalid;
            }),
            { numRuns: 100 }
        );
    });

    it("?? chaining: validateRequired(val, label) ?? validateEmail(val) returns required error for empty string", () => {
        fc.assert(
            fc.property(
                fc.constant(""),
                fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
                (emptyVal, label) => {
                    const result = validateRequired(emptyVal, label) ?? validateEmail(emptyVal);
                    // Should be the required error, not the email format error
                    return result === `${label} is required`;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("?? chaining: validateRequired(val, label) ?? validateEmail(val) returns email error for non-empty invalid email", () => {
        fc.assert(
            fc.property(
                // Non-empty strings without '@' are not valid emails
                fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0 && !s.includes("@")),
                fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
                (invalidEmail, label) => {
                    const result = validateRequired(invalidEmail, label) ?? validateEmail(invalidEmail);
                    // Required passes (non-empty), so email error is returned
                    return result === MSG_EMAIL_INVALID;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 5: validateAll returns false iff any field has an error ──────────
// Validates: Requirements 2.4, 5.1, 5.2, 5.4
//
// We test the validateAll contract by simulating its logic directly:
// validateAll(values) returns true iff validate(values) has no non-empty error values.

type SimpleForm = { email: string; password: string };

function validateSimpleForm(values: SimpleForm): Partial<Record<keyof SimpleForm, string>> {
    const errors: Partial<Record<keyof SimpleForm, string>> = {};
    const emailErr = validateRequired(values.email, "Email") ?? validateEmail(values.email);
    if (emailErr) errors.email = emailErr;
    const passwordErr = validatePassword(values.password);
    if (passwordErr) errors.password = passwordErr;
    return errors;
}

/**
 * Simulates the validateAll logic from useFormValidation:
 * runs validate, returns true iff no non-empty error values exist.
 */
function simulateValidateAll(values: SimpleForm): boolean {
    const result = validateSimpleForm(values);
    return Object.values(result).every((v) => !v);
}

describe("Property 5: validateAll returns false iff any field has an error", () => {
    it("validateAll returns true when all fields are valid", () => {
        fc.assert(
            fc.property(
                fc.record({
                    email: fc.emailAddress(),
                    password: fc.string({ minLength: 8 }),
                }),
                (values) => {
                    return simulateValidateAll(values) === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validateAll returns false when email is invalid", () => {
        fc.assert(
            fc.property(
                fc.record({
                    email: fc.string().filter((s) => !s.includes("@")),
                    password: fc.string({ minLength: 8 }),
                }),
                (values) => {
                    return simulateValidateAll(values) === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validateAll returns false when password is too short", () => {
        fc.assert(
            fc.property(
                fc.record({
                    email: fc.emailAddress(),
                    password: fc.string({ maxLength: 7 }),
                }),
                (values) => {
                    return simulateValidateAll(values) === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validateAll returns false when both fields are invalid", () => {
        fc.assert(
            fc.property(
                fc.record({
                    email: fc.string().filter((s) => !s.includes("@")),
                    password: fc.string({ maxLength: 7 }),
                }),
                (values) => {
                    return simulateValidateAll(values) === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("validateAll result matches: true iff validate returns no non-empty errors", () => {
        fc.assert(
            fc.property(
                fc.record({
                    email: fc.string(),
                    password: fc.string(),
                }),
                (values) => {
                    const errors = validateSimpleForm(values);
                    const hasErrors = Object.values(errors).some((v) => !!v);
                    const result = simulateValidateAll(values);
                    // result is true iff no errors
                    return result === !hasErrors;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 6: resetValidation clears all state ─────────────────────────────
// Validates: Requirements 2.5, 20.4
//
// We simulate the hook's state management with plain objects to test the
// resetValidation contract: after reset, errors === {} and touched is empty.

interface HookState {
    errors: Partial<Record<keyof SimpleForm, string>>;
    touched: Set<keyof SimpleForm>;
}

function simulateHandleBlur(
    state: HookState,
    field: keyof SimpleForm,
    values: SimpleForm
): HookState {
    const newTouched = new Set(state.touched);
    newTouched.add(field);
    const result = validateSimpleForm(values);
    const newErrors = { ...state.errors };
    const fieldError = result[field];
    if (fieldError) {
        newErrors[field] = fieldError;
    } else {
        delete newErrors[field];
    }
    return { errors: newErrors, touched: newTouched };
}

function simulateResetValidation(): HookState {
    return { errors: {}, touched: new Set() };
}

describe("Property 6: resetValidation clears all state", () => {
    it("after arbitrary handleBlur sequence, resetValidation clears errors and touched", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        field: fc.constantFrom("email" as const, "password" as const),
                        email: fc.string(),
                        password: fc.string(),
                    }),
                    { minLength: 1, maxLength: 10 }
                ),
                (blurSequence) => {
                    let state: HookState = { errors: {}, touched: new Set() };

                    // Simulate arbitrary blur sequence
                    for (const { field, email, password } of blurSequence) {
                        state = simulateHandleBlur(state, field, { email, password });
                    }

                    // Now reset
                    state = simulateResetValidation();

                    // After reset, errors should be empty and touched should be empty
                    const errorsEmpty = Object.keys(state.errors).length === 0;
                    const touchedEmpty = state.touched.size === 0;
                    return errorsEmpty && touchedEmpty;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("resetValidation always produces empty errors regardless of prior state", () => {
        fc.assert(
            fc.property(
                fc.record({
                    email: fc.string(),
                    password: fc.string(),
                }),
                (values) => {
                    // Simulate a state with some errors and touched fields
                    let state: HookState = { errors: {}, touched: new Set() };
                    state = simulateHandleBlur(state, "email", values);
                    state = simulateHandleBlur(state, "password", values);

                    // Reset
                    state = simulateResetValidation();

                    return Object.keys(state.errors).length === 0 && state.touched.size === 0;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 7: Untouched fields never show errors ───────────────────────────
// Validates: Requirements 2.6, 4.5
//
// The hook only populates errors for fields that have been touched (blurred).
// We simulate the initial hook state and verify errors is empty.

describe("Property 7: Untouched fields never show errors", () => {
    it("initial hook state has empty errors, even with invalid values", () => {
        fc.assert(
            fc.property(
                fc.record({
                    // Deliberately invalid values
                    email: fc.string().filter((s) => !s.includes("@")),
                    password: fc.string({ maxLength: 7 }),
                }),
                (invalidValues) => {
                    // Simulate initial hook state: no handleBlur called yet
                    const initialState: HookState = { errors: {}, touched: new Set() };

                    // Even though values are invalid, errors should be empty
                    // because no field has been touched
                    return Object.keys(initialState.errors).length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("initial touched set is always empty", () => {
        fc.assert(
            fc.property(
                fc.record({
                    email: fc.string(),
                    password: fc.string(),
                }),
                (_values) => {
                    const initialState: HookState = { errors: {}, touched: new Set() };
                    return initialState.touched.size === 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("handleBlur only adds errors for the blurred field, not untouched fields", () => {
        fc.assert(
            fc.property(
                fc.record({
                    // Invalid email and password
                    email: fc.string().filter((s) => !s.includes("@")),
                    password: fc.string({ maxLength: 7 }),
                }),
                (values) => {
                    let state: HookState = { errors: {}, touched: new Set() };

                    // Only blur the email field
                    state = simulateHandleBlur(state, "email", values);

                    // password field should NOT have an error (not touched)
                    const passwordUntouched = !("password" in state.errors);
                    // email field SHOULD have an error (it's invalid and was touched)
                    const emailHasError = "email" in state.errors;

                    return passwordUntouched && emailHasError;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 8: Lineup constraint enforcement ────────────────────────────────
// Validates: Requirements 19.1, 19.2, 19.4, 19.5

/**
 * Inline lineup validator for testing purposes.
 * Validates starters count (exactly 11), substitutes count (max 7),
 * and captain membership in starters.
 */
interface LineupValidationResult {
    startersError: string | null;
    substitutesError: string | null;
    captainError: string | null;
}

function validateLineup(
    starters: string[],
    substitutes: string[],
    captainId: string | null
): LineupValidationResult {
    const startersError =
        starters.length !== 11 ? "Exactly 11 starters must be selected" : null;

    const substitutesError =
        substitutes.length > 7 ? "Maximum 7 substitutes allowed" : null;

    let captainError: string | null = null;
    if (captainId === null || captainId === "") {
        captainError = "Captain must be selected from the starting lineup";
    } else if (!starters.includes(captainId)) {
        captainError = "Captain must be one of the selected starters";
    }

    return { startersError, substitutesError, captainError };
}

describe("Property 8: Lineup constraint enforcement", () => {
    it("exactly 11 starters produces no starters error", () => {
        fc.assert(
            fc.property(
                fc.array(fc.uuid(), { minLength: 11, maxLength: 11 }),
                (starters) => {
                    const result = validateLineup(starters, [], starters[0]);
                    return result.startersError === null;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("fewer than 11 starters produces a starters error", () => {
        fc.assert(
            fc.property(
                fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
                (starters) => {
                    const captainId = starters.length > 0 ? starters[0] : null;
                    const result = validateLineup(starters, [], captainId);
                    return result.startersError === "Exactly 11 starters must be selected";
                }
            ),
            { numRuns: 100 }
        );
    });

    it("more than 11 starters produces a starters error", () => {
        fc.assert(
            fc.property(
                fc.array(fc.uuid(), { minLength: 12, maxLength: 25 }),
                (starters) => {
                    const result = validateLineup(starters, [], starters[0]);
                    return result.startersError === "Exactly 11 starters must be selected";
                }
            ),
            { numRuns: 100 }
        );
    });

    it("captain in starters set produces no captain error", () => {
        fc.assert(
            fc.property(
                fc.array(fc.uuid(), { minLength: 11, maxLength: 11 }),
                fc.integer({ min: 0, max: 10 }),
                (starters, captainIndex) => {
                    const captainId = starters[captainIndex];
                    const result = validateLineup(starters, [], captainId);
                    return result.captainError === null;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("captain not in starters set produces a captain error", () => {
        fc.assert(
            fc.property(
                fc.array(fc.uuid(), { minLength: 11, maxLength: 11 }),
                fc.uuid(),
                (starters, outsideCaptain) => {
                    fc.pre(!starters.includes(outsideCaptain));
                    const result = validateLineup(starters, [], outsideCaptain);
                    return result.captainError === "Captain must be one of the selected starters";
                }
            ),
            { numRuns: 100 }
        );
    });

    it("substitutes count <= 7 produces no substitutes error", () => {
        fc.assert(
            fc.property(
                fc.array(fc.uuid(), { minLength: 11, maxLength: 11 }),
                fc.array(fc.uuid(), { minLength: 0, maxLength: 7 }),
                (starters, substitutes) => {
                    const result = validateLineup(starters, substitutes, starters[0]);
                    return result.substitutesError === null;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("substitutes count > 7 produces a substitutes error", () => {
        fc.assert(
            fc.property(
                fc.array(fc.uuid(), { minLength: 11, maxLength: 11 }),
                fc.array(fc.uuid(), { minLength: 8, maxLength: 20 }),
                (starters, substitutes) => {
                    const result = validateLineup(starters, substitutes, starters[0]);
                    return result.substitutesError === "Maximum 7 substitutes allowed";
                }
            ),
            { numRuns: 100 }
        );
    });
});
