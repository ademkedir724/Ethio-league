// Feature: ethio-league, Property 6: Match approval 24-hour window
// Feature: ethio-league, Property 7: Goal event increments score
// Feature: ethio-league, Property 8: MEA event edit 10-minute window
import { describe, it } from "vitest";
import * as fc from "fast-check";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

// ─── Shared types ─────────────────────────────────────────────────────────────

type MatchStatus = "scheduled" | "upcoming" | "approved" | "live" | "completed";
type EventTypeName = "goal" | "penalty_goal" | "own_goal" | "yellow_card" | "red_card" | "substitution" | "injury" | "commentary";

interface Match {
    id: string;
    seasonId: string;
    homeClubId: string;
    awayClubId: string;
    homeScore: number;
    awayScore: number;
    status: MatchStatus;
    matchDate: Date;
}

interface MatchEvent {
    id: string;
    matchId: string;
    eventTypeName: EventTypeName;
    clubId: string;
    createdAt: Date;
}

// ─── Pure business-logic functions (mirrors API route logic) ──────────────────

/**
 * Mirrors POST /api/matches/[id]/approve validation.
 * Returns "approved" or an error string.
 */
function approveMatch(
    match: Match,
    now: Date
): { status: "approved" } | { error: string } {
    if (match.matchDate.getTime() - now.getTime() > TWENTY_FOUR_HOURS_MS) {
        return {
            error: "Match can only be approved within 24 hours of the scheduled start time",
        };
    }
    if (match.status !== "scheduled" && match.status !== "upcoming") {
        return { error: "Match cannot be approved in its current status" };
    }
    return { status: "approved" };
}

/**
 * Mirrors score increment logic in POST /api/match-events.
 * Returns updated { homeScore, awayScore }.
 */
function applyScoreIncrement(
    match: Match,
    eventTypeName: EventTypeName,
    clubId: string
): { homeScore: number; awayScore: number } {
    let { homeScore, awayScore } = match;

    if (eventTypeName === "goal" || eventTypeName === "penalty_goal") {
        if (clubId === match.homeClubId) homeScore += 1;
        else if (clubId === match.awayClubId) awayScore += 1;
    } else if (eventTypeName === "own_goal") {
        if (clubId === match.homeClubId) awayScore += 1;   // own goal by home → away scores
        else if (clubId === match.awayClubId) homeScore += 1; // own goal by away → home scores
    }

    return { homeScore, awayScore };
}

/**
 * Mirrors PATCH /api/match-events/[id] 10-minute window check for MEA.
 * Returns true if the edit is allowed.
 */
function canMEAEditEvent(event: MatchEvent, now: Date): boolean {
    const elapsed = now.getTime() - event.createdAt.getTime();
    return elapsed <= TEN_MINUTES_MS;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const uuidArb = fc.uuid();
const now = new Date();

// ─── Property 6: Match approval 24-hour window ───────────────────────────────

describe("Property 6: Match approval 24-hour window", () => {
    it("approval is rejected when matchDate is more than 24h in the future", () => {
        fc.assert(
            fc.property(
                // offset strictly > 24h (25h to 72h)
                fc.integer({ min: 25 * 60 * 60 * 1000, max: 72 * 60 * 60 * 1000 }),
                (offsetMs) => {
                    const matchDate = new Date(now.getTime() + offsetMs);
                    const match: Match = {
                        id: "m1",
                        seasonId: "s1",
                        homeClubId: "c1",
                        awayClubId: "c2",
                        homeScore: 0,
                        awayScore: 0,
                        status: "scheduled",
                        matchDate,
                    };
                    const result = approveMatch(match, now);
                    return "error" in result;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("approval succeeds when matchDate is within 24h", () => {
        fc.assert(
            fc.property(
                // offset 0 to 24h (inclusive)
                fc.integer({ min: 0, max: TWENTY_FOUR_HOURS_MS }),
                (offsetMs) => {
                    const matchDate = new Date(now.getTime() + offsetMs);
                    const match: Match = {
                        id: "m1",
                        seasonId: "s1",
                        homeClubId: "c1",
                        awayClubId: "c2",
                        homeScore: 0,
                        awayScore: 0,
                        status: "scheduled",
                        matchDate,
                    };
                    const result = approveMatch(match, now);
                    return !("error" in result);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("approval is rejected for matches not in scheduled/upcoming status", () => {
        fc.assert(
            fc.property(
                fc.constantFrom<MatchStatus>("approved", "live", "completed"),
                (status) => {
                    const matchDate = new Date(now.getTime() + 60 * 60 * 1000); // 1h away — within window
                    const match: Match = {
                        id: "m1",
                        seasonId: "s1",
                        homeClubId: "c1",
                        awayClubId: "c2",
                        homeScore: 0,
                        awayScore: 0,
                        status,
                        matchDate,
                    };
                    const result = approveMatch(match, now);
                    return "error" in result;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("approval boundary: exactly 24h away is within the window", () => {
        const matchDate = new Date(now.getTime() + TWENTY_FOUR_HOURS_MS);
        const match: Match = {
            id: "m1",
            seasonId: "s1",
            homeClubId: "c1",
            awayClubId: "c2",
            homeScore: 0,
            awayScore: 0,
            status: "scheduled",
            matchDate,
        };
        const result = approveMatch(match, now);
        // matchDate - now === 24h, which is NOT > 24h, so it should succeed
        return !("error" in result);
    });
});

// ─── Property 7: Goal event increments score ─────────────────────────────────

describe("Property 7: Goal event increments score", () => {
    it("goal by home club increments homeScore by exactly 1", () => {
        fc.assert(
            fc.property(
                uuidArb, uuidArb,
                fc.nat(10), fc.nat(10),
                (homeClubId, awayClubId, homeScore, awayScore) => {
                    fc.pre(homeClubId !== awayClubId);
                    const match: Match = {
                        id: "m1", seasonId: "s1", homeClubId, awayClubId,
                        homeScore, awayScore, status: "live", matchDate: now,
                    };
                    const result = applyScoreIncrement(match, "goal", homeClubId);
                    return result.homeScore === homeScore + 1 && result.awayScore === awayScore;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("goal by away club increments awayScore by exactly 1", () => {
        fc.assert(
            fc.property(
                uuidArb, uuidArb,
                fc.nat(10), fc.nat(10),
                (homeClubId, awayClubId, homeScore, awayScore) => {
                    fc.pre(homeClubId !== awayClubId);
                    const match: Match = {
                        id: "m1", seasonId: "s1", homeClubId, awayClubId,
                        homeScore, awayScore, status: "live", matchDate: now,
                    };
                    const result = applyScoreIncrement(match, "goal", awayClubId);
                    return result.awayScore === awayScore + 1 && result.homeScore === homeScore;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("penalty_goal by home club increments homeScore by exactly 1", () => {
        fc.assert(
            fc.property(
                uuidArb, uuidArb,
                fc.nat(10), fc.nat(10),
                (homeClubId, awayClubId, homeScore, awayScore) => {
                    fc.pre(homeClubId !== awayClubId);
                    const match: Match = {
                        id: "m1", seasonId: "s1", homeClubId, awayClubId,
                        homeScore, awayScore, status: "live", matchDate: now,
                    };
                    const result = applyScoreIncrement(match, "penalty_goal", homeClubId);
                    return result.homeScore === homeScore + 1 && result.awayScore === awayScore;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("own_goal by home club increments awayScore by exactly 1", () => {
        fc.assert(
            fc.property(
                uuidArb, uuidArb,
                fc.nat(10), fc.nat(10),
                (homeClubId, awayClubId, homeScore, awayScore) => {
                    fc.pre(homeClubId !== awayClubId);
                    const match: Match = {
                        id: "m1", seasonId: "s1", homeClubId, awayClubId,
                        homeScore, awayScore, status: "live", matchDate: now,
                    };
                    const result = applyScoreIncrement(match, "own_goal", homeClubId);
                    return result.awayScore === awayScore + 1 && result.homeScore === homeScore;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("own_goal by away club increments homeScore by exactly 1", () => {
        fc.assert(
            fc.property(
                uuidArb, uuidArb,
                fc.nat(10), fc.nat(10),
                (homeClubId, awayClubId, homeScore, awayScore) => {
                    fc.pre(homeClubId !== awayClubId);
                    const match: Match = {
                        id: "m1", seasonId: "s1", homeClubId, awayClubId,
                        homeScore, awayScore, status: "live", matchDate: now,
                    };
                    const result = applyScoreIncrement(match, "own_goal", awayClubId);
                    return result.homeScore === homeScore + 1 && result.awayScore === awayScore;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("non-scoring events (yellow_card, red_card, substitution) do not change score", () => {
        fc.assert(
            fc.property(
                uuidArb, uuidArb,
                fc.nat(10), fc.nat(10),
                fc.constantFrom<EventTypeName>("yellow_card", "red_card", "substitution", "injury", "commentary"),
                fc.boolean(),
                (homeClubId, awayClubId, homeScore, awayScore, eventType, isHome) => {
                    fc.pre(homeClubId !== awayClubId);
                    const match: Match = {
                        id: "m1", seasonId: "s1", homeClubId, awayClubId,
                        homeScore, awayScore, status: "live", matchDate: now,
                    };
                    const clubId = isHome ? homeClubId : awayClubId;
                    const result = applyScoreIncrement(match, eventType, clubId);
                    return result.homeScore === homeScore && result.awayScore === awayScore;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("score is never negative after any event", () => {
        fc.assert(
            fc.property(
                uuidArb, uuidArb,
                fc.nat(10), fc.nat(10),
                fc.constantFrom<EventTypeName>("goal", "penalty_goal", "own_goal"),
                fc.boolean(),
                (homeClubId, awayClubId, homeScore, awayScore, eventType, isHome) => {
                    fc.pre(homeClubId !== awayClubId);
                    const match: Match = {
                        id: "m1", seasonId: "s1", homeClubId, awayClubId,
                        homeScore, awayScore, status: "live", matchDate: now,
                    };
                    const clubId = isHome ? homeClubId : awayClubId;
                    const result = applyScoreIncrement(match, eventType, clubId);
                    return result.homeScore >= 0 && result.awayScore >= 0;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 8: MEA event edit 10-minute window ─────────────────────────────

describe("Property 8: MEA event edit 10-minute window", () => {
    it("edit is rejected when event was created more than 10 minutes ago", () => {
        fc.assert(
            fc.property(
                // elapsed > 10 minutes (10m+1ms to 60m)
                fc.integer({ min: TEN_MINUTES_MS + 1, max: 60 * 60 * 1000 }),
                (elapsedMs) => {
                    const createdAt = new Date(now.getTime() - elapsedMs);
                    const event: MatchEvent = {
                        id: "e1", matchId: "m1", eventTypeName: "goal",
                        clubId: "c1", createdAt,
                    };
                    return !canMEAEditEvent(event, now);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("edit is allowed when event was created within 10 minutes", () => {
        fc.assert(
            fc.property(
                // elapsed 0 to 10 minutes (inclusive)
                fc.integer({ min: 0, max: TEN_MINUTES_MS }),
                (elapsedMs) => {
                    const createdAt = new Date(now.getTime() - elapsedMs);
                    const event: MatchEvent = {
                        id: "e1", matchId: "m1", eventTypeName: "goal",
                        clubId: "c1", createdAt,
                    };
                    return canMEAEditEvent(event, now);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("edit window boundary: exactly 10 minutes is still allowed", () => {
        const createdAt = new Date(now.getTime() - TEN_MINUTES_MS);
        const event: MatchEvent = {
            id: "e1", matchId: "m1", eventTypeName: "goal",
            clubId: "c1", createdAt,
        };
        // elapsed === TEN_MINUTES_MS, which is NOT > TEN_MINUTES_MS
        return canMEAEditEvent(event, now);
    });

    it("edit window is independent of event type", () => {
        fc.assert(
            fc.property(
                fc.constantFrom<EventTypeName>(
                    "goal", "penalty_goal", "own_goal", "yellow_card",
                    "red_card", "substitution", "injury", "commentary"
                ),
                fc.integer({ min: 0, max: TEN_MINUTES_MS }),
                (eventTypeName, elapsedMs) => {
                    const createdAt = new Date(now.getTime() - elapsedMs);
                    const event: MatchEvent = {
                        id: "e1", matchId: "m1", eventTypeName,
                        clubId: "c1", createdAt,
                    };
                    return canMEAEditEvent(event, now);
                }
            ),
            { numRuns: 100 }
        );
    });
});
