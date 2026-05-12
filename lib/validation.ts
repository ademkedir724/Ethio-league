/**
 * lib/validation.ts — Shared client-side validation utilities
 *
 * All validators return null on success or an error string on failure.
 * Use validateForm() to run multiple validators at once.
 */

// ─── Individual validators ────────────────────────────────────────────────────

export function validateRequired(value: string, label: string): string | null {
    if (!value || !value.trim()) return `${label} is required`;
    return null;
}

export function validateEmail(value: string): string | null {
    if (!value || !value.trim()) return "Email is required";
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(value.trim())) return "Enter a valid email address";
    return null;
}

export function validatePhone(value: string, required = false): string | null {
    if (!value || !value.trim()) {
        return required ? "Phone number is required" : null;
    }
    // Allow +, digits, spaces, dashes, parentheses — min 7 digits
    const digits = value.replace(/\D/g, "");
    if (digits.length < 7) return "Phone number is too short";
    if (digits.length > 15) return "Phone number is too long";
    const re = /^\+?[\d\s\-().]{7,20}$/;
    if (!re.test(value.trim())) return "Enter a valid phone number (e.g. +251 911 234 567)";
    return null;
}

export function validatePassword(value: string): string | null {
    if (!value) return "Password is required";
    if (value.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(value)) return "Password must contain at least one uppercase letter";
    if (!/[a-z]/.test(value)) return "Password must contain at least one lowercase letter";
    if (!/\d/.test(value)) return "Password must contain at least one number";
    return null;
}

export function validatePasswordMatch(password: string, confirm: string): string | null {
    if (!confirm) return "Please confirm your password";
    if (password !== confirm) return "Passwords do not match";
    return null;
}

export function validateMinLength(value: string, min: number, label: string): string | null {
    if (value && value.trim().length < min) return `${label} must be at least ${min} characters`;
    return null;
}

export function validateMaxLength(value: string, max: number, label: string): string | null {
    if (value && value.trim().length > max) return `${label} must be at most ${max} characters`;
    return null;
}

export function validateNumberRange(
    value: string | number,
    min: number,
    max: number,
    label: string,
    required = false
): string | null {
    const str = String(value).trim();
    if (!str) return required ? `${label} is required` : null;
    const n = Number(str);
    if (isNaN(n)) return `${label} must be a number`;
    if (n < min) return `${label} must be at least ${min}`;
    if (n > max) return `${label} must be at most ${max}`;
    return null;
}

export function validateDate(value: string, label: string, required = false): string | null {
    if (!value) return required ? `${label} is required` : null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return `${label} must be a valid date`;
    return null;
}

export function validateDateNotFuture(value: string, label: string): string | null {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return `${label} must be a valid date`;
    if (d > new Date()) return `${label} cannot be in the future`;
    return null;
}

export function validateDateAfter(
    startValue: string,
    endValue: string,
    startLabel = "Start date",
    endLabel = "End date"
): string | null {
    if (!startValue || !endValue) return null;
    const start = new Date(startValue);
    const end = new Date(endValue);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    if (end <= start) return `${endLabel} must be after ${startLabel}`;
    return null;
}

export function validateUrl(value: string, label: string, required = false): string | null {
    if (!value || !value.trim()) return required ? `${label} is required` : null;
    try {
        new URL(value);
        return null;
    } catch {
        return `${label} must be a valid URL (e.g. https://example.com)`;
    }
}

// ─── Batch validator ──────────────────────────────────────────────────────────

/**
 * Run multiple validators and return the first error found, or null if all pass.
 * Usage: const err = validateForm([validateRequired(name, "Name"), validateEmail(email)])
 */
export function validateForm(results: (string | null)[]): string | null {
    for (const r of results) {
        if (r !== null) return r;
    }
    return null;
}

/**
 * Run multiple validators and return ALL errors as a record.
 * Usage: const errors = validateFields({ name: validateRequired(name, "Name"), email: validateEmail(email) })
 */
export function validateFields(
    checks: Record<string, string | null>
): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const [key, err] of Object.entries(checks)) {
        if (err !== null) errors[key] = err;
    }
    return errors;
}

// ─── Password strength helper ─────────────────────────────────────────────────

export interface PasswordStrength {
    score: number; // 0-4
    label: "Weak" | "Fair" | "Good" | "Strong";
    color: string;
    checks: {
        length: boolean;
        uppercase: boolean;
        lowercase: boolean;
        number: boolean;
        special: boolean;
    };
}

export function getPasswordStrength(password: string): PasswordStrength {
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
    const score = Object.values(checks).filter(Boolean).length;
    const labels: PasswordStrength["label"][] = ["Weak", "Weak", "Fair", "Good", "Strong"];
    const colors = [
        "bg-destructive",
        "bg-destructive",
        "bg-amber-500",
        "bg-yellow-400",
        "bg-emerald-500",
    ];
    return { score, label: labels[score], color: colors[score], checks };
}
