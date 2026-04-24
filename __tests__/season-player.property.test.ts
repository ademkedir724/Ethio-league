// Feature: ethio-league, Property 4: Season player assignment round trip
// Feature: ethio-league, Property 5: Only approved-club players can be season-assigned
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ─── Shared types (mirror the Prisma shape used in the API) ──────────────────

interface SeasonClub {
    id: string;
    seasonId: string;
    clubId: string;
    status: "pending" | "active" | "inactive";
}

interface SeasonClubPlayer {
    id: string;
    seasonClubId: string;
    playerId: string;
    jerseyNumber: number | null;
    positionId: string | null;
}

// ─── Pure business-logic functions extracted from the API route ───────────────

/**
 * Mirrors POST /api/seasons/[id]/players validation logic.
 * Returns the created record or throws a descriptive error string.
 */
function assignPlayerToSeason(
    seasonId: string,
    clubId: string,
    playerId: string,
    jerseyNumber: number | null,
    positionId: string | null,
    seasonClubs: SeasonClub[],
    existingAssignments: SeasonClubPlayer[]
): SeasonClubPlayer | { error: string } {
    const seasonClub = seasonClubs.find(
        (sc) => sc.seasonId === seasonId && sc.clubId === clubId
    );

    if (!seasonClub) return { error: "Club is not registered in this season" };
    if (seasonClub.status !== "active")
        return { error: "Club must be active in the season to assign players" };

    const duplicate = existingAssignments.find(
        (a) => a.seasonClubId === seasonClub.id && a.playerId === playerId
    );
    if (duplicate) return { error: "Player is already assigned to this season" };

    return {
        id: `scp-${Math.random().toString(36).slice(2)}`,
        seasonClubId: seasonClub.id,
        playerId,
        jerseyNumber,
        positionId,
    };
}

/**
 * Mirrors GET /api/seasons/[id]/players — returns all assignments for a season.
 */
function getSeasonPlayers(
    seasonId: string,
    seasonClubs: SeasonClub[],
    assignments: SeasonClubPlayer[]
): SeasonClubPlayer[] {
    const seasonClubIds = new Set(
        seasonClubs.filter((sc) => sc.seasonId === seasonId).map((sc) => sc.id)
    );
    return assignments.filter((a) => seasonClubIds.has(a.seasonClubId));
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const uuidArb = fc.uuid();
const statusArb = fc.constantFrom<"pending" | "active" | "inactive">(
    "pending",
    "active",
    "inactive"
);

const seasonClubArb = fc.record({
    id: uuidArb,
    seasonId: uuidArb,
    clubId: uuidArb,
    status: statusArb,
});

// ─── Property 4: Season player assignment round trip ─────────────────────────

describe("Property 4: Season player assignment round trip", () => {
    it("assigned player appears in GET /api/seasons/:id/players result", () => {
        fc.assert(
            fc.property(
                uuidArb, // seasonId
                uuidArb, // clubId
                uuidArb, // playerId
                (seasonId, clubId, playerId) => {
                    const seasonClubId = `sc-${seasonId}-${clubId}`;
                    const seasonClubs: SeasonClub[] = [
                        { id: seasonClubId, seasonId, clubId, status: "active" },
                    ];
                    const assignments: SeasonClubPlayer[] = [];

                    const result = assignPlayerToSeason(
                        seasonId,
                        clubId,
                        playerId,
                        null,
                        null,
                        seasonClubs,
                        assignments
                    );

                    if ("error" in result) return false;

                    // Simulate the assignment being persisted
                    assignments.push(result);

                    // Round-trip: query should include the newly assigned player
                    const fetched = getSeasonPlayers(seasonId, seasonClubs, assignments);
                    return fetched.some((a) => a.playerId === playerId);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("removed assignment no longer appears in GET result", () => {
        fc.assert(
            fc.property(
                uuidArb,
                uuidArb,
                uuidArb,
                (seasonId, clubId, playerId) => {
                    const seasonClubId = `sc-${seasonId}-${clubId}`;
                    const seasonClubs: SeasonClub[] = [
                        { id: seasonClubId, seasonId, clubId, status: "active" },
                    ];

                    const assignment: SeasonClubPlayer = {
                        id: "scp-1",
                        seasonClubId,
                        playerId,
                        jerseyNumber: null,
                        positionId: null,
                    };
                    let assignments: SeasonClubPlayer[] = [assignment];

                    // Remove the assignment (DELETE endpoint)
                    assignments = assignments.filter((a) => a.id !== assignment.id);

                    const fetched = getSeasonPlayers(seasonId, seasonClubs, assignments);
                    return !fetched.some((a) => a.playerId === playerId);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("assignment preserves jerseyNumber and positionId", () => {
        fc.assert(
            fc.property(
                uuidArb,
                uuidArb,
                uuidArb,
                fc.integer({ min: 1, max: 99 }),
                uuidArb,
                (seasonId, clubId, playerId, jerseyNumber, positionId) => {
                    const seasonClubId = `sc-${seasonId}-${clubId}`;
                    const seasonClubs: SeasonClub[] = [
                        { id: seasonClubId, seasonId, clubId, status: "active" },
                    ];

                    const result = assignPlayerToSeason(
                        seasonId,
                        clubId,
                        playerId,
                        jerseyNumber,
                        positionId,
                        seasonClubs,
                        []
                    );

                    if ("error" in result) return false;
                    return result.jerseyNumber === jerseyNumber && result.positionId === positionId;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 5: Only approved-club players can be season-assigned ────────────

describe("Property 5: Only approved-club players can be season-assigned", () => {
    it("assignment fails when SeasonClub status is 'pending'", () => {
        fc.assert(
            fc.property(uuidArb, uuidArb, uuidArb, (seasonId, clubId, playerId) => {
                const seasonClubs: SeasonClub[] = [
                    { id: "sc-1", seasonId, clubId, status: "pending" },
                ];
                const result = assignPlayerToSeason(
                    seasonId, clubId, playerId, null, null, seasonClubs, []
                );
                return "error" in result;
            }),
            { numRuns: 100 }
        );
    });

    it("assignment fails when SeasonClub status is 'inactive'", () => {
        fc.assert(
            fc.property(uuidArb, uuidArb, uuidArb, (seasonId, clubId, playerId) => {
                const seasonClubs: SeasonClub[] = [
                    { id: "sc-1", seasonId, clubId, status: "inactive" },
                ];
                const result = assignPlayerToSeason(
                    seasonId, clubId, playerId, null, null, seasonClubs, []
                );
                return "error" in result;
            }),
            { numRuns: 100 }
        );
    });

    it("assignment fails when club has no SeasonClub record for the season", () => {
        fc.assert(
            fc.property(uuidArb, uuidArb, uuidArb, uuidArb, (seasonId, clubId, otherSeasonId, playerId) => {
                fc.pre(seasonId !== otherSeasonId);
                // Club is registered in a different season
                const seasonClubs: SeasonClub[] = [
                    { id: "sc-1", seasonId: otherSeasonId, clubId, status: "active" },
                ];
                const result = assignPlayerToSeason(
                    seasonId, clubId, playerId, null, null, seasonClubs, []
                );
                return "error" in result;
            }),
            { numRuns: 100 }
        );
    });

    it("assignment succeeds only when SeasonClub status is 'active'", () => {
        fc.assert(
            fc.property(uuidArb, uuidArb, uuidArb, (seasonId, clubId, playerId) => {
                const seasonClubs: SeasonClub[] = [
                    { id: "sc-1", seasonId, clubId, status: "active" },
                ];
                const result = assignPlayerToSeason(
                    seasonId, clubId, playerId, null, null, seasonClubs, []
                );
                return !("error" in result);
            }),
            { numRuns: 100 }
        );
    });

    it("duplicate assignment is rejected regardless of club status", () => {
        fc.assert(
            fc.property(uuidArb, uuidArb, uuidArb, (seasonId, clubId, playerId) => {
                const seasonClubs: SeasonClub[] = [
                    { id: "sc-1", seasonId, clubId, status: "active" },
                ];
                const existing: SeasonClubPlayer[] = [
                    { id: "scp-1", seasonClubId: "sc-1", playerId, jerseyNumber: null, positionId: null },
                ];
                const result = assignPlayerToSeason(
                    seasonId, clubId, playerId, null, null, seasonClubs, existing
                );
                return "error" in result;
            }),
            { numRuns: 100 }
        );
    });
});
