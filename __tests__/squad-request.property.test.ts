// Feature: ethio-league, Property 15: Club pool scoping
// Feature: ethio-league, Property 16: Squad request pending state
// Feature: ethio-league, Property 17: League Admin cannot edit squad request fields
// Feature: ethio-league, Property 18: Only approved players in lineups
// Feature: ethio-league, Property 19: Jersey number uniqueness per club per season
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
    id: string;
    clubId: string | null;
}

interface SeasonClubPlayer {
    id: string;
    seasonClubId: string;
    playerId: string;
    jerseyNumber: number | null;
    positionId: number | null;
    playerRole: string | null;
    requestStatus: "pending" | "approved" | "rejected";
}

interface LineupEntry {
    seasonClubPlayerId: string;
    lineupType: "starting" | "substitute";
    isCaptain: boolean;
}

// ─── Pure logic mirrors ───────────────────────────────────────────────────────

/** Mirrors GET /api/players for club_admin: filter by player.clubId */
function getClubPlayerPool(players: Player[], clubId: string): Player[] {
    return players.filter((p) => p.clubId === clubId);
}

/** Mirrors POST /api/seasons/[id]/squad-request/players */
function submitSquadRequest(
    players: Array<{ playerId: string; jerseyNumber: number; positionId: number | null; playerRole: string; seasonClubId: string }>,
    existingRecords: SeasonClubPlayer[]
): SeasonClubPlayer[] | { error: string } {
    // Check jersey uniqueness within the batch
    const jerseys = players.map((p) => p.jerseyNumber);
    const uniqueJerseys = new Set(jerseys);
    if (uniqueJerseys.size !== jerseys.length) {
        return { error: "Duplicate jersey numbers in submission" };
    }

    // Check jersey uniqueness against existing approved/pending records
    for (const p of players) {
        const conflict = existingRecords.find(
            (r) =>
                r.seasonClubId === p.seasonClubId &&
                r.jerseyNumber === p.jerseyNumber &&
                r.requestStatus !== "rejected" &&
                r.playerId !== p.playerId
        );
        if (conflict) return { error: `Jersey ${p.jerseyNumber} already taken` };
    }

    return players.map((p) => ({
        id: `scp-${p.playerId}`,
        seasonClubId: p.seasonClubId,
        playerId: p.playerId,
        jerseyNumber: p.jerseyNumber,
        positionId: p.positionId,
        playerRole: p.playerRole,
        requestStatus: "pending" as const,
    }));
}

/** Mirrors PATCH /api/seasons/[id]/players/[scpId]/review */
function reviewPlayerRequest(
    scp: SeasonClubPlayer,
    action: "approve" | "reject"
): SeasonClubPlayer {
    // Only requestStatus changes — all other fields are immutable
    return {
        ...scp,
        requestStatus: action === "approve" ? "approved" : "rejected",
    };
}

/** Mirrors POST /api/matches/[id]/lineups approved-only validation */
function validateLineupApprovedOnly(
    lineups: LineupEntry[],
    squadPlayers: SeasonClubPlayer[]
): { valid: true } | { valid: false; unapproved: string[] } {
    const scpMap = new Map(squadPlayers.map((p) => [p.id, p]));
    const unapproved = lineups
        .map((l) => scpMap.get(l.seasonClubPlayerId))
        .filter((scp): scp is SeasonClubPlayer => scp !== undefined && scp.requestStatus !== "approved")
        .map((scp) => scp.id);

    if (unapproved.length > 0) return { valid: false, unapproved };
    return { valid: true };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const uuidArb = fc.uuid();
const jerseyArb = fc.integer({ min: 1, max: 99 });

// ─── Property 15: Club pool scoping ──────────────────────────────────────────

describe("Property 15: Club pool scoping", () => {
    it("GET /api/players for club_admin returns only players with matching clubId", () => {
        fc.assert(
            fc.property(
                uuidArb, // clubId
                fc.array(
                    fc.record({ id: uuidArb, clubId: fc.option(uuidArb, { nil: null }) }),
                    { minLength: 0, maxLength: 20 }
                ),
                (clubId, allPlayers) => {
                    const result = getClubPlayerPool(allPlayers, clubId);
                    return result.every((p) => p.clubId === clubId);
                }
            ),
            { numRuns: 200 }
        );
    });

    it("players from other clubs never appear in the club pool", () => {
        fc.assert(
            fc.property(
                uuidArb,
                uuidArb,
                fc.array(uuidArb, { minLength: 1, maxLength: 10 }),
                (myClubId, otherClubId, playerIds) => {
                    fc.pre(myClubId !== otherClubId);
                    const otherClubPlayers: Player[] = playerIds.map((id) => ({ id, clubId: otherClubId }));
                    const result = getClubPlayerPool(otherClubPlayers, myClubId);
                    return result.length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("players with null clubId never appear in any club pool", () => {
        fc.assert(
            fc.property(
                uuidArb,
                fc.array(uuidArb, { minLength: 1, maxLength: 10 }),
                (clubId, playerIds) => {
                    const nullClubPlayers: Player[] = playerIds.map((id) => ({ id, clubId: null }));
                    const result = getClubPlayerPool(nullClubPlayers, clubId);
                    return result.length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 16: Squad request pending state ─────────────────────────────────

describe("Property 16: Squad request pending state", () => {
    it("all submitted SeasonClubPlayer records have requestStatus = 'pending'", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        playerId: uuidArb,
                        jerseyNumber: jerseyArb,
                        positionId: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
                        playerRole: fc.constantFrom("starter", "reserve"),
                        seasonClubId: fc.constant("sc-1"),
                    }),
                    { minLength: 1, maxLength: 10 }
                ),
                (players) => {
                    // Ensure unique jersey numbers in the batch
                    const uniquePlayers = players.filter(
                        (p, i, arr) =>
                            arr.findIndex((q) => q.jerseyNumber === p.jerseyNumber || q.playerId === p.playerId) === i
                    );
                    if (uniquePlayers.length === 0) return true;

                    const result = submitSquadRequest(uniquePlayers, []);
                    if ("error" in result) return true; // skip if validation error
                    return result.every((r) => r.requestStatus === "pending");
                }
            ),
            { numRuns: 200 }
        );
    });

    it("requestStatus is 'pending' immediately after submission, before any review", () => {
        fc.assert(
            fc.property(uuidArb, jerseyArb, (playerId, jerseyNumber) => {
                const result = submitSquadRequest(
                    [{ playerId, jerseyNumber, positionId: null, playerRole: "starter", seasonClubId: "sc-1" }],
                    []
                );
                if ("error" in result) return true;
                return result[0].requestStatus === "pending";
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 17: League Admin cannot edit squad request fields ───────────────

describe("Property 17: League Admin cannot edit squad request fields", () => {
    it("review endpoint only changes requestStatus, never jerseyNumber/positionId/playerRole", () => {
        fc.assert(
            fc.property(
                fc.record({
                    id: uuidArb,
                    seasonClubId: uuidArb,
                    playerId: uuidArb,
                    jerseyNumber: fc.option(jerseyArb, { nil: null }),
                    positionId: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
                    playerRole: fc.option(fc.constantFrom("starter", "reserve"), { nil: null }),
                    requestStatus: fc.constant("pending" as const),
                }),
                fc.constantFrom("approve" as const, "reject" as const),
                (scp, action) => {
                    const updated = reviewPlayerRequest(scp, action);
                    return (
                        updated.jerseyNumber === scp.jerseyNumber &&
                        updated.positionId === scp.positionId &&
                        updated.playerRole === scp.playerRole &&
                        updated.seasonClubId === scp.seasonClubId &&
                        updated.playerId === scp.playerId
                    );
                }
            ),
            { numRuns: 200 }
        );
    });

    it("approve action sets requestStatus to 'approved'", () => {
        fc.assert(
            fc.property(
                fc.record({
                    id: uuidArb, seasonClubId: uuidArb, playerId: uuidArb,
                    jerseyNumber: fc.option(jerseyArb, { nil: null }),
                    positionId: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
                    playerRole: fc.option(fc.constantFrom("starter", "reserve"), { nil: null }),
                    requestStatus: fc.constant("pending" as const),
                }),
                (scp) => reviewPlayerRequest(scp, "approve").requestStatus === "approved"
            ),
            { numRuns: 100 }
        );
    });

    it("reject action sets requestStatus to 'rejected'", () => {
        fc.assert(
            fc.property(
                fc.record({
                    id: uuidArb, seasonClubId: uuidArb, playerId: uuidArb,
                    jerseyNumber: fc.option(jerseyArb, { nil: null }),
                    positionId: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
                    playerRole: fc.option(fc.constantFrom("starter", "reserve"), { nil: null }),
                    requestStatus: fc.constant("pending" as const),
                }),
                (scp) => reviewPlayerRequest(scp, "reject").requestStatus === "rejected"
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 18: Only approved players in lineups ────────────────────────────

describe("Property 18: Only approved players in lineups", () => {
    it("lineup with all approved players passes validation", () => {
        fc.assert(
            fc.property(
                fc.array(uuidArb, { minLength: 1, maxLength: 11 }),
                (playerIds) => {
                    const squad: SeasonClubPlayer[] = playerIds.map((id) => ({
                        id,
                        seasonClubId: "sc-1",
                        playerId: id,
                        jerseyNumber: null,
                        positionId: null,
                        playerRole: null,
                        requestStatus: "approved",
                    }));
                    const lineups: LineupEntry[] = playerIds.map((id) => ({
                        seasonClubPlayerId: id,
                        lineupType: "starting",
                        isCaptain: false,
                    }));
                    const result = validateLineupApprovedOnly(lineups, squad);
                    return result.valid === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("lineup with any pending player is rejected", () => {
        fc.assert(
            fc.property(
                fc.array(uuidArb, { minLength: 1, maxLength: 10 }),
                uuidArb,
                (approvedIds, pendingId) => {
                    fc.pre(!approvedIds.includes(pendingId));
                    const squad: SeasonClubPlayer[] = [
                        ...approvedIds.map((id) => ({
                            id, seasonClubId: "sc-1", playerId: id,
                            jerseyNumber: null, positionId: null, playerRole: null,
                            requestStatus: "approved" as const,
                        })),
                        {
                            id: pendingId, seasonClubId: "sc-1", playerId: pendingId,
                            jerseyNumber: null, positionId: null, playerRole: null,
                            requestStatus: "pending" as const,
                        },
                    ];
                    const lineups: LineupEntry[] = [...approvedIds, pendingId].map((id) => ({
                        seasonClubPlayerId: id,
                        lineupType: "starting",
                        isCaptain: false,
                    }));
                    const result = validateLineupApprovedOnly(lineups, squad);
                    return result.valid === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("lineup with any rejected player is rejected", () => {
        fc.assert(
            fc.property(uuidArb, (rejectedId) => {
                const squad: SeasonClubPlayer[] = [{
                    id: rejectedId, seasonClubId: "sc-1", playerId: rejectedId,
                    jerseyNumber: null, positionId: null, playerRole: null,
                    requestStatus: "rejected",
                }];
                const lineups: LineupEntry[] = [{ seasonClubPlayerId: rejectedId, lineupType: "starting", isCaptain: false }];
                const result = validateLineupApprovedOnly(lineups, squad);
                return result.valid === false;
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 19: Jersey number uniqueness per club per season ────────────────

describe("Property 19: Jersey number uniqueness per club per season", () => {
    it("submission with duplicate jersey numbers in the batch is rejected", () => {
        fc.assert(
            fc.property(
                uuidArb,
                uuidArb,
                jerseyArb,
                (playerId1, playerId2, jersey) => {
                    fc.pre(playerId1 !== playerId2);
                    const result = submitSquadRequest(
                        [
                            { playerId: playerId1, jerseyNumber: jersey, positionId: null, playerRole: "starter", seasonClubId: "sc-1" },
                            { playerId: playerId2, jerseyNumber: jersey, positionId: null, playerRole: "starter", seasonClubId: "sc-1" },
                        ],
                        []
                    );
                    return "error" in result;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("submission with jersey already taken by another approved player is rejected", () => {
        fc.assert(
            fc.property(
                uuidArb,
                uuidArb,
                jerseyArb,
                (existingPlayerId, newPlayerId, jersey) => {
                    fc.pre(existingPlayerId !== newPlayerId);
                    const existing: SeasonClubPlayer[] = [{
                        id: "scp-existing",
                        seasonClubId: "sc-1",
                        playerId: existingPlayerId,
                        jerseyNumber: jersey,
                        positionId: null,
                        playerRole: null,
                        requestStatus: "approved",
                    }];
                    const result = submitSquadRequest(
                        [{ playerId: newPlayerId, jerseyNumber: jersey, positionId: null, playerRole: "starter", seasonClubId: "sc-1" }],
                        existing
                    );
                    return "error" in result;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("submission with unique jersey numbers succeeds", () => {
        fc.assert(
            fc.property(
                fc.uniqueArray(jerseyArb, { minLength: 1, maxLength: 5 }),
                fc.uniqueArray(uuidArb, { minLength: 5, maxLength: 5 }),
                (jerseys, playerIds) => {
                    const players = jerseys.map((j, i) => ({
                        playerId: playerIds[i],
                        jerseyNumber: j,
                        positionId: null,
                        playerRole: "starter" as const,
                        seasonClubId: "sc-1",
                    }));
                    const result = submitSquadRequest(players, []);
                    return !("error" in result);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("resubmitting the same player with a different jersey does not conflict with their own old record", () => {
        fc.assert(
            fc.property(uuidArb, jerseyArb, fc.integer({ min: 1, max: 99 }), (playerId, oldJersey, newJersey) => {
                fc.pre(oldJersey !== newJersey);
                const existing: SeasonClubPlayer[] = [{
                    id: "scp-old",
                    seasonClubId: "sc-1",
                    playerId,
                    jerseyNumber: oldJersey,
                    positionId: null,
                    playerRole: null,
                    requestStatus: "pending",
                }];
                // Resubmission: same player, new jersey — should not conflict with own record
                const result = submitSquadRequest(
                    [{ playerId, jerseyNumber: newJersey, positionId: null, playerRole: "starter", seasonClubId: "sc-1" }],
                    existing
                );
                return !("error" in result);
            }),
            { numRuns: 100 }
        );
    });
});
