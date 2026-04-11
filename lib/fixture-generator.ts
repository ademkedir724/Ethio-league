/**
 * Pure fixture generation logic — no DB calls.
 * Generates a round-robin schedule and assigns referees/MEAs per match.
 */

export interface FixtureSlot {
    homeClubId: string;
    awayClubId: string;
    roundNumber: number;
    matchDate: Date;
}

export interface RefereeAssignment {
    refereeId: string;
    role: "main_referee" | "side_referee_1" | "side_referee_2" | "fourth_referee";
}

export interface MEAAssignment {
    userId: string;
}

export interface GeneratedMatch {
    fixture: FixtureSlot;
    referees: RefereeAssignment[];
    mea: MEAAssignment | null;
}

const REFEREE_ROLES: RefereeAssignment["role"][] = [
    "main_referee",
    "side_referee_1",
    "side_referee_2",
    "fourth_referee",
];

/**
 * Generate round-robin fixtures for a list of club IDs.
 *
 * Algorithm: fix the first team, rotate the rest clockwise each round.
 * For odd number of clubs, a BYE placeholder is added — matches involving
 * BYE are skipped.
 *
 * @param clubIds     Ordered list of club IDs participating in the season
 * @param type        "single" (n-1 rounds) or "double" (2*(n-1) rounds)
 * @param startDate   First match date
 * @param daysBetweenRounds  Days between consecutive rounds (default 7)
 * @param refereeIds  Pool of referee IDs assigned to the season (must be 4*matchCount)
 * @param meaUserIds  Pool of MEA user IDs assigned to the season (must be matchCount)
 */
export function generateFixtures(
    clubIds: string[],
    type: "single" | "double",
    startDate: Date,
    daysBetweenRounds: number,
    refereeIds: string[],
    meaUserIds: string[]
): GeneratedMatch[] {
    const BYE = "__BYE__";
    const teams = [...clubIds];

    // Pad to even number with a BYE
    if (teams.length % 2 !== 0) teams.push(BYE);

    const n = teams.length;
    const numRounds = n - 1;
    const matchesPerRound = n / 2;

    const firstLeg: FixtureSlot[] = [];

    for (let round = 0; round < numRounds; round++) {
        const matchDate = new Date(startDate);
        matchDate.setDate(matchDate.getDate() + round * daysBetweenRounds);

        for (let i = 0; i < matchesPerRound; i++) {
            const home = teams[i];
            const away = teams[n - 1 - i];
            if (home === BYE || away === BYE) continue;

            firstLeg.push({
                homeClubId: home,
                awayClubId: away,
                roundNumber: round + 1,
                matchDate: new Date(matchDate),
            });
        }

        // Rotate: keep teams[0] fixed, rotate the rest
        const last = teams.pop()!;
        teams.splice(1, 0, last);
    }

    const allFixtures: FixtureSlot[] =
        type === "double"
            ? [
                ...firstLeg,
                ...firstLeg.map((f) => ({
                    homeClubId: f.awayClubId,
                    awayClubId: f.homeClubId,
                    roundNumber: f.roundNumber + numRounds,
                    matchDate: new Date(
                        f.matchDate.getTime() + numRounds * daysBetweenRounds * 86_400_000
                    ),
                })),
            ]
            : firstLeg;

    // Assign referees (4 per match, cycling through the pool)
    // Assign MEAs (1 per match, cycling through the pool)
    const result: GeneratedMatch[] = allFixtures.map((fixture, idx) => {
        const referees: RefereeAssignment[] = REFEREE_ROLES.map((role, roleIdx) => ({
            refereeId: refereeIds[(idx * 4 + roleIdx) % refereeIds.length],
            role,
        }));

        const mea: MEAAssignment | null =
            meaUserIds.length > 0
                ? { userId: meaUserIds[idx % meaUserIds.length] }
                : null;

        return { fixture, referees, mea };
    });

    return result;
}
