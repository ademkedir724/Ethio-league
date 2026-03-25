export interface MatchResult {
    homeClubId: string;
    awayClubId: string;
    homeScore: number;
    awayScore: number;
    homeClubName: string;
    awayClubName: string;
    homeClubLogoUrl?: string | null;
    awayClubLogoUrl?: string | null;
}

export interface StandingRow {
    clubId: string;
    clubName: string;
    logoUrl: string | null;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
}

export function computeStandings(
    matches: MatchResult[],
    pointsWin: number,
    pointsDraw: number
): StandingRow[] {
    const table = new Map<string, StandingRow>();

    function getOrCreate(clubId: string, clubName: string, logoUrl: string | null | undefined): StandingRow {
        if (!table.has(clubId)) {
            table.set(clubId, {
                clubId,
                clubName,
                logoUrl: logoUrl ?? null,
                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                goalDifference: 0,
                points: 0,
            });
        }
        return table.get(clubId)!;
    }

    for (const match of matches) {
        const home = getOrCreate(match.homeClubId, match.homeClubName, match.homeClubLogoUrl);
        const away = getOrCreate(match.awayClubId, match.awayClubName, match.awayClubLogoUrl);

        home.played += 1;
        away.played += 1;

        home.goalsFor += match.homeScore;
        home.goalsAgainst += match.awayScore;
        away.goalsFor += match.awayScore;
        away.goalsAgainst += match.homeScore;

        if (match.homeScore > match.awayScore) {
            home.won += 1;
            away.lost += 1;
        } else if (match.homeScore < match.awayScore) {
            away.won += 1;
            home.lost += 1;
        } else {
            home.drawn += 1;
            away.drawn += 1;
        }
    }

    for (const row of table.values()) {
        row.goalDifference = row.goalsFor - row.goalsAgainst;
        row.points = row.won * pointsWin + row.drawn * pointsDraw;
    }

    return Array.from(table.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });
}
