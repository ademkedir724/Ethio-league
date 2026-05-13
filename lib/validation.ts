/**
 * lib/validation.ts
 *
 * Pure validator functions and error message constants for the Ethio-League
 * admin dashboard. All functions are pure with no side effects.
 *
 * Each function returns null when the value is valid, or a non-empty error
 * message string when the value is invalid.
 */

// ---------------------------------------------------------------------------
// Error message constants
// ---------------------------------------------------------------------------

export const MSG_EMAIL_INVALID = "Enter a valid email address";
export const MSG_PHONE_INVALID =
    "Enter a valid phone number (e.g. +251 911 234 567)";
export const MSG_PHONE_REQUIRED = "Phone number is required";
export const MSG_PASSWORD_MIN = "Password must be at least 8 characters";
export const MSG_PASSWORDS_MISMATCH = "Passwords do not match";
export const MSG_POSITION_CODE_INVALID =
    "Position code must be 1\u201310 uppercase letters (e.g. GK, CB)";

// ---------------------------------------------------------------------------
// Internal patterns
// ---------------------------------------------------------------------------

/**
 * RFC-5322-compatible email regex.
 * Equivalent to the browser's built-in type="email" validation.
 */
const EMAIL_PATTERN =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * Phone_Pattern: /^\+?[\d\s\-().]{7,20}$/
 */
const PHONE_PATTERN = /^\+?[\d\s\-().]{7,20}$/;

/**
 * Position code: 1–10 uppercase ASCII letters only.
 */
const POSITION_CODE_PATTERN = /^[A-Z]{1,10}$/;

// ---------------------------------------------------------------------------
// Validator functions
// ---------------------------------------------------------------------------

/**
 * Validates an email address against an RFC-5322-compatible pattern.
 *
 * @returns null when valid, MSG_EMAIL_INVALID otherwise.
 */
export function validateEmail(value: string): string | null {
    if (EMAIL_PATTERN.test(value)) {
        return null;
    }
    return MSG_EMAIL_INVALID;
}

/**
 * Validates a phone number with optional/required branching.
 *
 * - Empty + required=false → null (field is optional)
 * - Empty + required=true  → MSG_PHONE_REQUIRED
 * - Non-empty, matches PHONE_PATTERN → null
 * - Non-empty, does not match → MSG_PHONE_INVALID
 *
 * @returns null when valid, an error message string otherwise.
 */
export function validatePhone(
    value: string,
    required: boolean
): string | null {
    const v = String(value ?? "");
    if (v === "" || v.trim() === "") {
        return required ? MSG_PHONE_REQUIRED : null;
    }
    if (PHONE_PATTERN.test(v)) {
        return null;
    }
    return MSG_PHONE_INVALID;
}

/**
 * Validates that a value is non-empty after trimming.
 *
 * @returns null when the trimmed value is non-empty, "${label} is required" otherwise.
 */
export function validateRequired(
    value: string,
    label: string
): string | null {
    if (String(value ?? "").trim().length > 0) {
        return null;
    }
    return `${label} is required`;
}

/**
 * Validates that the trimmed length of a string is within [min, max].
 *
 * @returns null when within bounds, an error message string otherwise.
 */
export function validateLength(
    value: string,
    min: number,
    max: number,
    label: string
): string | null {
    const len = String(value ?? "").trim().length;
    if (len < min) {
        return `${label} must be at least ${min} characters`;
    }
    if (len > max) {
        return `${label} must be at most ${max} characters`;
    }
    return null;
}

/**
 * Validates that a password has at least 8 characters.
 *
 * @returns null when valid, MSG_PASSWORD_MIN otherwise.
 */
export function validatePassword(value: string): string | null {
    if (value.length >= 8) {
        return null;
    }
    return MSG_PASSWORD_MIN;
}

/**
 * Validates that two password strings are identical.
 *
 * @returns null when they match, MSG_PASSWORDS_MISMATCH otherwise.
 */
export function validatePasswordMatch(
    password: string,
    confirm: string
): string | null {
    if (password === confirm) {
        return null;
    }
    return MSG_PASSWORDS_MISMATCH;
}

/**
 * Validates an optional integer field within [min, max].
 *
 * - Empty string → null (field is optional)
 * - Non-empty, not a valid integer → "${label} must be a whole number"
 * - Parsed integer outside [min, max] → "${label} must be between ${min} and ${max}"
 * - Otherwise → null
 *
 * @returns null when valid or empty, an error message string otherwise.
 */
export function validateInteger(
    value: string,
    min: number,
    max: number,
    label: string
): string | null {
    if (value === "" || value.trim() === "") {
        return null;
    }
    // Must be a whole number: no decimal point, no exponent notation
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) {
        return `${label} must be a whole number`;
    }
    const parsed = parseInt(trimmed, 10);
    if (parsed < min || parsed > max) {
        return `${label} must be between ${min} and ${max}`;
    }
    return null;
}

/**
 * Validates an optional date string.
 *
 * - Empty string → null (field is optional)
 * - Parses to a valid date → null
 * - Otherwise → "${label} must be a valid date"
 *
 * @returns null when valid or empty, an error message string otherwise.
 */
export function validateDate(value: string, label: string): string | null {
    if (value === "" || value.trim() === "") {
        return null;
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
        return `${label} must be a valid date`;
    }
    return null;
}

/**
 * Validates that an optional date is not in the future.
 *
 * - Empty string → null (field is optional)
 * - Parsed date is today or in the past → null
 * - Parsed date is after today → "${label} cannot be in the future"
 * - Invalid date string → "${label} must be a valid date" (delegates to validateDate)
 *
 * @returns null when valid or empty, an error message string otherwise.
 */
export function validateDateNotFuture(
    value: string,
    label: string
): string | null {
    if (value === "" || value.trim() === "") {
        return null;
    }
    const dateError = validateDate(value, label);
    if (dateError !== null) {
        return dateError;
    }
    const date = new Date(value);
    // Compare against the start of today (midnight local time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
        return `${label} cannot be in the future`;
    }
    return null;
}

/**
 * Validates that an end date is strictly after a start date (both optional).
 *
 * - endValue is empty → null
 * - startValue is empty → null
 * - Either value is an invalid date → null (date validity is checked separately)
 * - Parsed end date is strictly after parsed start date → null
 * - Otherwise → "${label} must be after the start date"
 *
 * @returns null when valid or either date is empty/invalid, an error message string otherwise.
 */
export function validateDateAfter(
    endValue: string,
    startValue: string,
    label: string
): string | null {
    if (
        endValue === "" ||
        endValue.trim() === "" ||
        startValue === "" ||
        startValue.trim() === ""
    ) {
        return null;
    }
    const endDate = new Date(endValue);
    const startDate = new Date(startValue);
    // If either date is invalid, skip the comparison (validateDate handles that)
    if (isNaN(endDate.getTime()) || isNaN(startDate.getTime())) {
        return null;
    }
    if (endDate > startDate) {
        return null;
    }
    return `${label} must be after the start date`;
}

/**
 * Validates a position code against /^[A-Z]{1,10}$/.
 *
 * @returns null when valid, MSG_POSITION_CODE_INVALID otherwise.
 */
export function validatePositionCode(value: string): string | null {
    if (POSITION_CODE_PATTERN.test(value)) {
        return null;
    }
    return MSG_POSITION_CODE_INVALID;
}
