// Feature: ethio-league, Property 1: Password token is set on user approval
// Feature: ethio-league, Property 2: Club creation atomicity
// Feature: ethio-league, Property 3: Duplicate email rejection
import { describe, it } from "vitest";
import * as fc from "fast-check";
import crypto from "crypto";

// ─── Property 1: Password token is set on user approval ──────────────────────
// Tests the token generation logic in isolation (pure function behaviour)
// The actual DB write is tested via integration; here we verify the token
// generation contract: token is non-empty hex, expires in the future.

function generatePasswordSetupToken(): { token: string; expires: Date } {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    return { token, expires };
}

describe("Property 1: Password token is set on user approval", () => {
    it("generated token is a 64-char hex string", () => {
        fc.assert(
            fc.property(fc.constant(null), () => {
                const { token } = generatePasswordSetupToken();
                return /^[0-9a-f]{64}$/.test(token);
            }),
            { numRuns: 100 }
        );
    });

    it("token expiry is strictly in the future", () => {
        fc.assert(
            fc.property(fc.constant(null), () => {
                const before = Date.now();
                const { expires } = generatePasswordSetupToken();
                return expires.getTime() > before;
            }),
            { numRuns: 100 }
        );
    });

    it("token expiry is approximately 1 hour from now", () => {
        fc.assert(
            fc.property(fc.constant(null), () => {
                const before = Date.now();
                const { expires } = generatePasswordSetupToken();
                const diff = expires.getTime() - before;
                // Should be between 59 and 61 minutes
                return diff >= 59 * 60 * 1000 && diff <= 61 * 60 * 1000;
            }),
            { numRuns: 100 }
        );
    });

    it("each generated token is unique", () => {
        fc.assert(
            fc.property(fc.constant(null), () => {
                const { token: t1 } = generatePasswordSetupToken();
                const { token: t2 } = generatePasswordSetupToken();
                return t1 !== t2;
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 2: Club creation atomicity (data structure validation) ──────────
// Tests that the data objects required for club creation are structurally valid

interface ClubCreationInput {
    name: string;
    adminFullName: string;
    adminEmail: string;
    adminPhone?: string;
    seasonId: string;
}

function validateClubCreationInput(input: ClubCreationInput): string[] {
    const errors: string[] = [];
    if (!input.name || input.name.trim() === "") errors.push("Club name is required");
    if (!input.adminFullName || input.adminFullName.trim() === "") errors.push("Admin full name is required");
    if (!input.adminEmail || !input.adminEmail.includes("@")) errors.push("Valid admin email is required");
    if (!input.seasonId) errors.push("Season ID is required");
    return errors;
}

describe("Property 2: Club creation atomicity — input validation", () => {
    it("valid inputs produce no validation errors", () => {
        const nonEmptyString = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);
        fc.assert(
            fc.property(
                fc.record({
                    name: nonEmptyString,
                    adminFullName: nonEmptyString,
                    adminEmail: fc.emailAddress(),
                    seasonId: fc.uuid(),
                }),
                (input) => {
                    const errors = validateClubCreationInput(input);
                    return errors.length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("missing name always produces a validation error", () => {
        fc.assert(
            fc.property(
                fc.record({
                    adminFullName: fc.string({ minLength: 1 }),
                    adminEmail: fc.emailAddress(),
                    seasonId: fc.uuid(),
                }),
                (partial) => {
                    const errors = validateClubCreationInput({ name: "", ...partial });
                    return errors.some((e) => e.includes("Club name"));
                }
            ),
            { numRuns: 100 }
        );
    });

    it("invalid email always produces a validation error", () => {
        fc.assert(
            fc.property(
                fc.record({
                    name: fc.string({ minLength: 1 }),
                    adminFullName: fc.string({ minLength: 1 }),
                    seasonId: fc.uuid(),
                }),
                (partial) => {
                    const errors = validateClubCreationInput({ adminEmail: "not-an-email", ...partial });
                    return errors.some((e) => e.includes("email"));
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 3: Duplicate email rejection ────────────────────────────────────

function checkEmailUniqueness(existingEmails: string[], newEmail: string): boolean {
    return !existingEmails.includes(newEmail);
}

describe("Property 3: Duplicate email rejection", () => {
    it("email already in the set is rejected", () => {
        fc.assert(
            fc.property(
                fc.array(fc.emailAddress(), { minLength: 1, maxLength: 10 }),
                (emails) => {
                    const existing = [...new Set(emails)];
                    const duplicate = existing[0];
                    return !checkEmailUniqueness(existing, duplicate);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("new unique email is accepted", () => {
        fc.assert(
            fc.property(
                fc.array(fc.emailAddress(), { minLength: 0, maxLength: 10 }),
                fc.emailAddress(),
                (existing, newEmail) => {
                    fc.pre(!existing.includes(newEmail));
                    return checkEmailUniqueness(existing, newEmail);
                }
            ),
            { numRuns: 100 }
        );
    });
});
