// Feature: ethio-league, Property 9: Lineup validity invariants
import { describe, it } from "vitest";
import * as fc from "fast-check";

// ─── Types ────────────────────────────────────────────────────────────────────

type LineupType = "starting" | "substitute";

interface LineupEntry {
    seasonClubPlayerId: string;
    lineupType: LineupType;
    isCaptain: boolean;
    positionId?: string | null;
    shirtNumber?: number | null;
}

interface ValidationResult {
    valid: boolean;
    errors: string[];
}

// ─── Pure validation logic (mirrors POST /api/matches/[id]/lineups) ───────────

function validateLineup(
    lineups: LineupEntry[],
    validSeasonClubPlayerIds: Set<string>
): ValidationResult {
    const errors: string[] = [];

    const starters = lineups.filter((l) => l.lineupType === "starting");
    const substitutes = lineups.filter((l) => l.lineupType === "substitute");

    // Rule 1: exactly 11 starters
    if (starters.length !== 11) {
        errors.push(`Lineup must have exactly 11 starters, got ${starters.length}`);
    }

    // Rule 2: exactly 1 captain
    const captains = lineups.filter((l) => l.isCaptain === true);
    if (captains.length !== 1) {
        errors.push(`Lineup must have exactly 1 captain, got ${captains.length}`);
    }

    // Rule 3: no player in both starters and substitutes
    const starterIds = new Set(starters.map((l) => l.seasonClubPlayerId));
    const overlap = substitutes.filter((l) => starterIds.has(l.seasonClubPlayerId));
    if (overlap.length > 0) {
        errors.push("A player cannot appear in both starters and substitutes");
    }

    // Rule 4: all player IDs must belong to the club's season squad
    const invalidIds = lineups
        .map((l) => l.seasonClubPlayerId)
        .filter((id) => !validSeasonClubPlayerIds.has(id));
    if (invalidIds.length > 0) {
        errors.push(`Some players do not belong to this club's season squad: ${invalidIds.join(", ")}`);
    }

    return { valid: errors.length === 0, errors };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const uuidArb = fc.uuid();

/** Generate a pool of N unique player IDs */
const playerPoolArb = (n: number) =>
    fc.array(uuidArb, { minLength: n, maxLength: n + 10 })
        .map((ids) => [...new Set(ids)])
        .filter((ids) => ids.length >= n);

/** Build a valid lineup from a pool of player IDs */
function buildValidLineup(playerIds: string[]): LineupEntry[] {
    const starters: LineupEntry[] = playerIds.slice(0, 11).map((id, i) => ({
        seasonClubPlayerId: id,
        lineupType: "starting",
        isCaptain: i === 0, // first player is captain
    }));
    const subs: LineupEntry[] = playerIds.slice(11).map((id) => ({
        seasonClubPlayerId: id,
        lineupType: "substitute",
        isCaptain: false,
    }));
    return [...starters, ...subs];
}

// ─── Property 9: Lineup validity invariants ───────────────────────────────────

describe("Property 9: Lineup validity invariants", () => {
    // ── Valid lineups ──────────────────────────────────────────────────────────

    it("valid lineup (11 starters, 1 captain, no overlap, all valid IDs) is accepted", () => {
        fc.assert(
            fc.property(
                playerPoolArb(14), // 11 starters + up to 3 subs
                (playerIds) => {
                    const lineup = buildValidLineup(playerIds);
                    const validIds = new Set(playerIds);
                    const result = validateLineup(lineup, validIds);
                    return result.valid;
                }
            ),
            { numRuns: 100 }
        );
    });

    // ── Rule 1: exactly 11 starters ───────────────────────────────────────────

    it("lineup with fewer than 11 starters is rejected", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 10 }),
                playerPoolArb(15),
                (starterCount, playerIds) => {
                    const starters: LineupEntry[] = playerIds.slice(0, starterCount).map((id, i) => ({
                        seasonClubPlayerId: id,
                        lineupType: "starting",
                        isCaptain: i === 0,
                    }));
                    const subs: LineupEntry[] = playerIds.slice(starterCount, starterCount + 3).map((id) => ({
                        seasonClubPlayerId: id,
                        lineupType: "substitute",
                        isCaptain: false,
                    }));
                    const lineup = [...starters, ...subs];
                    const validIds = new Set(playerIds);
                    const result = validateLineup(lineup, validIds);
                    return !result.valid && result.errors.some((e) => e.includes("starters"));
                }
            ),
            { numRuns: 100 }
        );
    });

    it("lineup with more than 11 starters is rejected", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 12, max: 18 }),
                playerPoolArb(20),
                (starterCount, playerIds) => {
                    const starters: LineupEntry[] = playerIds.slice(0, starterCount).map((id, i) => ({
                        seasonClubPlayerId: id,
                        lineupType: "starting",
                        isCaptain: i === 0,
                    }));
                    const validIds = new Set(playerIds);
                    const result = validateLineup(starters, validIds);
                    return !result.valid && result.errors.some((e) => e.includes("starters"));
                }
            ),
            { numRuns: 100 }
        );
    });

    // ── Rule 2: exactly 1 captain ─────────────────────────────────────────────

    it("lineup with no captain is rejected", () => {
        fc.assert(
            fc.property(
                playerPoolArb(11),
                (playerIds) => {
                    const lineup: LineupEntry[] = playerIds.slice(0, 11).map((id) => ({
                        seasonClubPlayerId: id,
                        lineupType: "starting",
                        isCaptain: false, // no captain
                    }));
                    const validIds = new Set(playerIds);
                    const result = validateLineup(lineup, validIds);
                    return !result.valid && result.errors.some((e) => e.includes("captain"));
                }
            ),
            { numRuns: 100 }
        );
    });

    it("lineup with more than 1 captain is rejected", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 11 }),
                playerPoolArb(11),
                (captainCount, playerIds) => {
                    const lineup: LineupEntry[] = playerIds.slice(0, 11).map((id, i) => ({
                        seasonClubPlayerId: id,
                        lineupType: "starting",
                        isCaptain: i < captainCount,
                    }));
                    const validIds = new Set(playerIds);
                    const result = validateLineup(lineup, validIds);
                    return !result.valid && result.errors.some((e) => e.includes("captain"));
                }
            ),
            { numRuns: 100 }
        );
    });

    // ── Rule 3: no player in both starters and substitutes ────────────────────

    it("lineup with a player in both starters and substitutes is rejected", () => {
        fc.assert(
            fc.property(
                playerPoolArb(12),
                (playerIds) => {
                    const duplicateId = playerIds[0];
                    const starters: LineupEntry[] = playerIds.slice(0, 11).map((id, i) => ({
                        seasonClubPlayerId: id,
                        lineupType: "starting",
                        isCaptain: i === 0,
                    }));
                    // Put the first starter also in substitutes
                    const subs: LineupEntry[] = [
                        { seasonClubPlayerId: duplicateId, lineupType: "substitute", isCaptain: false },
                    ];
                    const lineup = [...starters, ...subs];
                    const validIds = new Set(playerIds);
                    const result = validateLineup(lineup, validIds);
                    return !result.valid && result.errors.some((e) => e.includes("both"));
                }
            ),
            { numRuns: 100 }
        );
    });

    // ── Rule 4: all player IDs must be in the season squad ────────────────────

    it("lineup with out-of-squad player IDs is rejected", () => {
        fc.assert(
            fc.property(
                playerPoolArb(11),
                uuidArb, // an ID not in the squad
                (playerIds, outsiderId) => {
                    fc.pre(!playerIds.includes(outsiderId));
                    // Replace one starter with an outsider
                    const lineup: LineupEntry[] = [
                        ...playerIds.slice(0, 10).map((id, i) => ({
                            seasonClubPlayerId: id,
                            lineupType: "starting" as LineupType,
                            isCaptain: i === 0,
                        })),
                        { seasonClubPlayerId: outsiderId, lineupType: "starting", isCaptain: false },
                    ];
                    const validIds = new Set(playerIds); // outsiderId NOT in validIds
                    const result = validateLineup(lineup, validIds);
                    return !result.valid && result.errors.some((e) => e.includes("season squad"));
                }
            ),
            { numRuns: 100 }
        );
    });

    // ── Multiple violations ───────────────────────────────────────────────────

    it("lineup with multiple violations reports all errors", () => {
        fc.assert(
            fc.property(
                playerPoolArb(11),
                (playerIds) => {
                    // Only 10 starters, no captain, and an outsider
                    const lineup: LineupEntry[] = playerIds.slice(0, 10).map((id) => ({
                        seasonClubPlayerId: id,
                        lineupType: "starting" as LineupType,
                        isCaptain: false,
                    }));
                    const validIds = new Set(playerIds);
                    const result = validateLineup(lineup, validIds);
                    // Should have at least 2 errors: starters count + captain count
                    return !result.valid && result.errors.length >= 2;
                }
            ),
            { numRuns: 100 }
        );
    });

    // ── Idempotency: same valid lineup validates consistently ─────────────────

    it("validation result is deterministic for the same input", () => {
        fc.assert(
            fc.property(
                playerPoolArb(14),
                (playerIds) => {
                    const lineup = buildValidLineup(playerIds);
                    const validIds = new Set(playerIds);
                    const r1 = validateLineup(lineup, validIds);
                    const r2 = validateLineup(lineup, validIds);
                    return r1.valid === r2.valid && r1.errors.length === r2.errors.length;
                }
            ),
            { numRuns: 100 }
        );
    });
});
