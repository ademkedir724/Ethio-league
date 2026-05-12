/**
 * lib/form-validation.ts
 * Shared client-side validation helpers used across all dashboard forms.
 */

// ─── Regex patterns ───────────────────────────────────────────────────────────

/** E.164-ish phone: optional +, then 7–15 digits (spaces/dashes allowed) */
export const PHONE_PATTERN = /^\+?[\d\s\-().]{7,20}$/;

/** Basic email pattern (HTML5 type="email" handles most, this is extra) */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Full name: at least 2 chars, letters + spaces + hyphens */
export const FULL_NAME_PATTERN = /^[\p{L}\s'\-]{2,80}$/u;

// ─── Individual validators ────────────────────────────────────────────────────

export function validateEmail(value: string): string | null {
    if (!value.trim()) return "Email is required";
    if (!EMAIL_PATTERN.test(value.trim())) return "Enter a valid email address";
    return null;
}

export function validatePhone(value: string, required = false): string | null {
    if (!value.trim()) return required ? "Phone number is required" : null;
    if (!PHONE_PATTERN.test(value.trim())) return "Enter a valid phone number (e.g. +251 911 234 567)";
    return null;
}

export function validateFullName(value: string, label = "Full name"): string | null {
    if (!value.trim()) return `${label} is required`;
    if (value.trim().length < 2) return `${label} must be at least 2 characters`;
    if (value.trim().length > 80) return `${label} must be 80 characters or fewer`;
    return null;
}

export function validatePassword(value: string): string | null {
    if (!value) return "Password is required";
    if (value.length < 8) return "Password must be at least 8 characters";
    if (value.length > 128) return "Password must be 128 characters or fewer";
    return null;
}

export function validatePasswordConfirm(password: string, confirm: string): string | null {
    if (!confirm) return "Please confirm your password";
    if (password !== confirm) return "Passwords do not match";
    return null;
}

export function validateRequired(value: string, label: string): string | null {
    if (!value.trim()) return `${label} is required`;
    return null;
}

export function validatePositiveInt(value: string, label: string, min = 0, max?: number): string | null {
    if (!value.trim()) return null; // optional by default
    const n = parseInt(value, 10);
    if (isNaN(n) || !Number.isInteger(n)) return `${label} must be a whole number`;
    if (n < min) return `${label} must be at least ${min}`;
    if (max !== undefined && n > max) return `${label} must be at most ${max}`;
    return null;
}

export function validateDate(value: string, label: string, required = false): string | null {
    if (!value) return required ? `${label} is required` : null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return `${label} must be a valid date`;
    return null;
}

export function validateDateRange(start: string, end: string): string | null {
    if (!start || !end) return null;
    if (new Date(start) >= new Date(end)) return "End date must be after start date";
    return null;
}

export function validateUrl(value: string, label = "URL"): string | null {
    if (!value.trim()) return null;
    try { new URL(value.trim()); return null; } catch { return `${label} must be a valid URL`; }
}

// ─── Collect errors helper ────────────────────────────────────────────────────

/** Returns the first non-null error from a list of validators, or null. */
export function firstError(...errors: (string | null)[]): string | null {
    return errors.find((e) => e !== null) ?? null;
}

/** Returns true if all validators pass (all null). */
export function allValid(...errors: (string | null)[]): boolean {
    return errors.every((e) => e === null);
}
