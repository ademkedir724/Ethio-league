// Feature: ethio-league, Property 10: Standings computation correctness
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { computeStandings, type MatchResult } from "@/lib/standings";

const clubArb = fc.uuid();

const matchResultArb = (clubIds: string[]) =>
    fc.record({
        homeClubId: fc.constantFrom(...clubIds),
        awayClubId: fc.constantFrom(...clubIds),
        homeScore: fc.nat(10),
        awayScore: fc.nat(10),
        homeClubName: fc.string({ minLength: 1, maxLength: 20 }),
        awayClubName: fc.string({ minLength: 1, maxLength: 20 }),
    }).filter((m) => m.homeClubId !== m.awayClubId);

describe("Property 10: Standings computation correctness", () => {
    it("every participating club appears in standings", () => {
        fc.assert(
            fc.property(
                fc.array(clubArb, { minLength: 2, maxLength: 8 }).map((ids) => [...new Set(ids)]).filter((ids) => ids.length >= 2),
                fc.integer({ min: 1, max: 3 }),
                fc.integer({ min: 0, max: 1 }),
                (clubIds, pointsWin, pointsDraw) => {
                    const matches: MatchResult[] = Array.from({ length: clubIds.length * 2 }, (_, i) => {
                        const home = clubIds[i % clubIds.length];
                        const away = clubIds[(i + 1) % clubIds.length];
                        if (home === away) return null;
                        return {
                            homeClubId: home,
                            awayClubId: away,
                            homeScore: Math.floor(Math.random() * 4),
                            awayScore: Math.floor(Math.random() * 4),
                            homeClubName: `Club ${home.slice(0, 4)}`,
                            awayClubName: `Club ${away.slice(0, 4)}`,
                        };
                    }).filter(Boolean) as MatchResult[];

                    if (matches.length === 0) return true;

                    const standings = computeStandings(matches, pointsWin, pointsDraw);
                    const participatingClubs = new Set([
                        ...matches.map((m) => m.homeClubId),
                        ...matches.map((m) => m.awayClubId),
                    ]);

                    for (const clubId of participatingClubs) {
                        const row = standings.find((r) => r.clubId === clubId);
                        if (!row) return false;
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("played = won + drawn + lost for every club", () => {
        fc.assert(
            fc.property(
                fc.array(clubArb, { minLength: 2, maxLength: 6 }).map((ids) => [...new Set(ids)]).filter((ids) => ids.length >= 2),
                (clubIds) => {
                    const matches: MatchResult[] = [];
                    for (let i = 0; i < clubIds.length - 1; i++) {
                        matches.push({
                            homeClubId: clubIds[i],
                            awayClubId: clubIds[i + 1],
                            homeScore: i % 3,
                            awayScore: (i + 1) % 3,
                            homeClubName: `Club ${i}`,
                            awayClubName: `Club ${i + 1}`,
                        });
                    }

                    const standings = computeStandings(matches, 3, 1);
                    return standings.every((r) => r.played === r.won + r.drawn + r.lost);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("goalDifference = goalsFor - goalsAgainst", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        homeClubId: fc.constantFrom("A", "B", "C"),
                        awayClubId: fc.constantFrom("A", "B", "C"),
                        homeScore: fc.nat(5),
                        awayScore: fc.nat(5),
                    }).filter((m) => m.homeClubId !== m.awayClubId),
                    { minLength: 1, maxLength: 10 }
                ),
                (rawMatches) => {
                    const matches: MatchResult[] = rawMatches.map((m) => ({
                        ...m,
                        homeClubName: m.homeClubId,
                        awayClubName: m.awayClubId,
                    }));
                    const standings = computeStandings(matches, 3, 1);
                    return standings.every(
                        (r) => r.goalDifference === r.goalsFor - r.goalsAgainst
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("points = won * pointsWin + drawn * pointsDraw", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        homeClubId: fc.constantFrom("A", "B", "C"),
                        awayClubId: fc.constantFrom("A", "B", "C"),
                        homeScore: fc.nat(5),
                        awayScore: fc.nat(5),
                    }).filter((m) => m.homeClubId !== m.awayClubId),
                    { minLength: 1, maxLength: 10 }
                ),
                fc.integer({ min: 1, max: 5 }),
                fc.integer({ min: 0, max: 2 }),
                (rawMatches, pointsWin, pointsDraw) => {
                    const matches: MatchResult[] = rawMatches.map((m) => ({
                        ...m,
                        homeClubName: m.homeClubId,
                        awayClubName: m.awayClubId,
                    }));
                    const standings = computeStandings(matches, pointsWin, pointsDraw);
                    return standings.every(
                        (r) => r.points === r.won * pointsWin + r.drawn * pointsDraw
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("rows are sorted by points DESC then goalDifference DESC", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        homeClubId: fc.constantFrom("A", "B", "C", "D"),
                        awayClubId: fc.constantFrom("A", "B", "C", "D"),
                        homeScore: fc.nat(5),
                        awayScore: fc.nat(5),
                    }).filter((m) => m.homeClubId !== m.awayClubId),
                    { minLength: 2, maxLength: 12 }
                ),
                (rawMatches) => {
                    const matches: MatchResult[] = rawMatches.map((m) => ({
                        ...m,
                        homeClubName: m.homeClubId,
                        awayClubName: m.awayClubId,
                    }));
                    const standings = computeStandings(matches, 3, 1);
                    for (let i = 0; i < standings.length - 1; i++) {
                        const a = standings[i];
                        const b = standings[i + 1];
                        if (a.points < b.points) return false;
                        if (a.points === b.points && a.goalDifference < b.goalDifference) return false;
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
