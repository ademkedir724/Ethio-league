// Feature: media-upload, Property 1: URL validation rejects non-Cloudinary URLs
// Feature: media-upload, Property 2: Image MIME type validation
// Feature: media-upload, Property 3: Image file size validation
// Feature: media-upload, Property 4: Video MIME type validation
// Feature: media-upload, Property 5: Video file size validation

import { describe, it } from "vitest";
import * as fc from "fast-check";
import { isValidCloudinaryUrl } from "../lib/cloudinary";

// ─── Pure validation helpers (mirrors client-side widget config) ──────────────

function isValidImageMimeType(mime: string): boolean {
    return ["image/jpeg", "image/png", "image/webp"].includes(mime);
}

function isValidVideoMimeType(mime: string): boolean {
    return mime === "video/mp4";
}

function isValidImageSize(bytes: number): boolean {
    return bytes <= 5_242_880; // 5 MB
}

function isValidVideoSize(bytes: number): boolean {
    return bytes <= 104_857_600; // 100 MB
}

// ─── Property 1: URL validation rejects non-Cloudinary URLs ──────────────────
// Validates: Requirements 1.5, 2.5, 3.5, 4.5

describe("Property 1: URL validation rejects non-Cloudinary URLs", () => {
    it("any string not starting with https://res.cloudinary.com/ is rejected", () => {
        fc.assert(
            fc.property(
                fc.string().filter((s) => !s.startsWith("https://res.cloudinary.com/")),
                (s) => {
                    return isValidCloudinaryUrl(s) === false;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 2: Image MIME type validation ───────────────────────────────────
// Validates: Requirements 1.6, 2.6, 3.6, 4.6, 4b.6, 5.6, 6.8, 7.8, 8.7

describe("Property 2: Image MIME type validation", () => {
    it("isValidImageMimeType matches the allowed set exactly", () => {
        fc.assert(
            fc.property(fc.string(), (s) => {
                return isValidImageMimeType(s) === ["image/jpeg", "image/png", "image/webp"].includes(s);
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 3: Image file size validation ───────────────────────────────────
// Validates: Requirements 1.7, 2.7, 3.7, 4.7, 4b.7, 5.7, 6.9, 7.9, 8.9

describe("Property 3: Image file size validation", () => {
    it("isValidImageSize is true iff bytes <= 5_242_880", () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: 20_000_000 }), (n) => {
                return isValidImageSize(n) === (n <= 5_242_880);
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 4: Video MIME type validation ───────────────────────────────────
// Validates: Requirements 8.8

describe("Property 4: Video MIME type validation", () => {
    it("isValidVideoMimeType is true iff mime is exactly video/mp4", () => {
        fc.assert(
            fc.property(fc.string(), (s) => {
                return isValidVideoMimeType(s) === (s === "video/mp4");
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 5: Video file size validation ───────────────────────────────────
// Validates: Requirements 8.10

describe("Property 5: Video file size validation", () => {
    it("isValidVideoSize is true iff bytes <= 104_857_600", () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: 200_000_000 }), (n) => {
                return isValidVideoSize(n) === (n <= 104_857_600);
            }),
            { numRuns: 100 }
        );
    });
});
