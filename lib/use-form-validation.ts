/**
 * lib/use-form-validation.ts
 *
 * Generic React hook for client-side form validation.
 * Works with any form shape T and a caller-supplied validate function.
 */

import { useCallback, useState } from "react";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface UseFormValidationReturn<T> {
    /** Current field errors. Only populated for touched fields. */
    errors: Partial<Record<keyof T, string>>;
    /** Set of field names the user has blurred at least once. */
    touched: Set<keyof T>;
    /**
     * Call on a field's onBlur event.
     * Marks the field as touched and re-runs validation for that field only.
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

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * useFormValidation<T>
 *
 * @param validate   - Pure function that receives the current form values and
 *                     returns a partial record of field → error message.
 *                     Return an empty string or omit the key to indicate no error.
 * @param initialValues - The initial form values (used only to infer the type T).
 *
 * @returns { errors, touched, handleBlur, validateAll, resetValidation }
 */
export function useFormValidation<T extends Record<string, unknown>>(
    validate: (values: T) => Partial<Record<keyof T, string>>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _initialValues: T
): UseFormValidationReturn<T> {
    const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
    const [touched, setTouched] = useState<Set<keyof T>>(new Set());

    /**
     * handleBlur — called when a field loses focus.
     *
     * 1. Adds the field to the touched set.
     * 2. Runs the full validate function against the current values.
     * 3. Extracts only the error for the blurred field and merges it into errors.
     *    If the field has no error, the key is removed from errors.
     */
    const handleBlur = useCallback(
        (field: keyof T, currentValues: T) => {
            setTouched((prev) => {
                const next = new Set(prev);
                next.add(field);
                return next;
            });

            const result = validate(currentValues);
            const fieldError = result[field];

            setErrors((prev) => {
                const next = { ...prev };
                if (fieldError) {
                    next[field] = fieldError;
                } else {
                    delete next[field];
                }
                return next;
            });
        },
        [validate]
    );

    /**
     * validateAll — called on form submit.
     *
     * 1. Runs the full validate function.
     * 2. Marks every key of T as touched.
     * 3. Sets all errors at once (only non-empty error strings are stored).
     * 4. Returns true when there are no non-empty error values.
     */
    const validateAll = useCallback(
        (currentValues: T): boolean => {
            const result = validate(currentValues);

            // Mark all keys as touched
            const allKeys = Object.keys(currentValues) as Array<keyof T>;
            setTouched(new Set(allKeys));

            // Store only non-empty error strings
            const nextErrors: Partial<Record<keyof T, string>> = {};
            for (const key of allKeys) {
                const err = result[key];
                if (err) {
                    nextErrors[key] = err;
                }
            }
            setErrors(nextErrors);

            return Object.values(result).every((v) => !v);
        },
        [validate]
    );

    /**
     * resetValidation — clears all errors and touched state.
     * Call after a successful submit or when the form dialog is closed.
     */
    const resetValidation = useCallback(() => {
        setErrors({});
        setTouched(new Set());
    }, []);

    return { errors, touched, handleBlur, validateAll, resetValidation };
}
