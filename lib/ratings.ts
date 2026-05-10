/**
 * lib/ratings.ts — Rating Engine (pure computation layer)
 *
 * This file contains all type definitions and pure computation functions for
 * the Player Rating System. No Prisma imports here — all functions accept
 * pre-fetched data structs and return numeric scores.
 *
 * DB-integrated helpers (computeAndPersist*, trigger helpers, backfill) will
 * be added in tasks 3–5.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** All configurable weights and parameters for the rating formulas. */
export interface RatingConfigValues {
    /** Points per goal scored. Default: 3.0 */
    goalWeight: number;
    /** Points per assist. Default: 2.0 */
    assistWeight: number;
    /** Points deducted per yellow card. Default: 1.5 */
    yellowCardPenalty: number;
    /** Points deducted per red card. Default: 4.0 */
    redCardPenalty: number;
    /** Points per appearance. Default: 0.5 */
    appearanceWeight: number;
    /** Points per clean sheet (goalkeeper). Default: 2.0 */
    cleanSheetWeight: number;
    /** Multiplier for win rate contribution (up to this many points). Default: 40.0 */
    winRateWeight: number;
    /** Normalization ceiling for goal difference per match. Default: 2.0 */
    goalDiffNormMax: number;
    /** Normalization ceiling for points per match. Default: 3.0 */
    pointsPerMatchNormMax: number;
    /** Decay applied per prior season (weight = 1 - index * rate). Default: 0.15 */
    seasonDecayRate: number;
    /** Minimum season weight floor. Default: 0.1 */
    seasonMinWeight: number;
    /** Normalization ceiling for distinct seasons (referee). Default: 10.0 */
    maxSeasonsNorm: number;
    /** Normalization ceiling for average goals per match (league). Default: 4.0 */
    leagueGoalsNormMax: number;
}

/** Hardcoded defaults matching the RatingConfig Prisma model defaults. */
export const DEFAULT_RATING_CONFIG: RatingConfigValues = {
    goalWeight: 3.0,
    assistWeight: 2.0,
    yellowCardPenalty: 1.5,
    redCardPenalty: 4.0,
    appearanceWeight: 0.5,
    cleanSheetWeight: 2.0,
    winRateWeight: 40.0,
    goalDiffNormMax: 2.0,
    pointsPerMatchNormMax: 3.0,
    seasonDecayRate: 0.15,
    seasonMinWeight: 0.1,
    maxSeasonsNorm: 10.0,
    leagueGoalsNormMax: 4.0,
};

// ---------------------------------------------------------------------------
// Entity types
// ---------------------------------------------------------------------------

export type EntityType = "player" | "club" | "league" | "coach" | "referee";

export interface RatingResult {
    entityType: EntityType;
    entityId: string;
    /** Computed score in [0, 100], two decimal places. */
    score: number;
    computedAt: Date;
}

// ---------------------------------------------------------------------------
// Input data interfaces (pre-fetched, DB-free)
// ---------------------------------------------------------------------------

/** Per-season statistics for a single player. */
export interface PlayerSeasonData {
    /** 0 = most recent season, 1 = one season prior, etc. */
    seasonIndex: number;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    /** Distinct matches where the player appeared (event or lineup entry). */
    appearances: number;
    /** Goalkeeper only — matches where the player's club conceded 0 goals and the player appeared. */
    cleanSheets: number;
}

export interface PlayerRatingData {
    seasons: PlayerSeasonData[];
}

/** Per-season statistics for a single club. */
export interface ClubSeasonData {
    /** 0 = most recent season, 1 = one season prior, etc. */
    seasonIndex: number;
    wins: number;
    matchesPlayed: number;
    goalDifference: number;
    points: number;
    /** Total yellow cards issued to all club players in this season. */
    yellowCards: number;
    /** Total red cards issued to all club players in this season. */
    redCards: number;
}

export interface ClubRatingData {
    seasons: ClubSeasonData[];
}

/** Per-season statistics for a league (equal weight — no decay). */
export interface LeagueSeasonData {
    isCompleted: boolean;
    totalMatches: number;
    approvedMatches: number;
    totalGoals: number;
    /** Number of matches used in the goals average (to avoid division by zero). */
    matchesWithGoals: number;
}

export interface LeagueRatingData {
    seasons: LeagueSeasonData[];
    /** Pre-computed average of all current club ratings in this league. */
    avgClubRating: number;
}

/** Per-season statistics for a coach. */
export interface CoachSeasonData {
    /** 0 = most recent season, 1 = one season prior, etc. */
    seasonIndex: number;
    /** The club's current EntityRating score for this season. */
    clubRating: number;
    wins: number;
    matchesPlayed: number;
    yellowCards: number;
    redCards: number;
}

export interface CoachRatingData {
    seasons: CoachSeasonData[];
}

/** Aggregate statistics for a referee (no per-season decay). */
export interface RefereeRatingData {
    totalMatchesAssigned: number;
    totalMatchesInSeasons: number;
    distinctSeasons: number;
    /** Array of cards-per-match values across all assigned matches (for stddev). */
    cardsPerMatch: number[];
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Clamp a value to the closed interval [min, max]. */
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Task 2.2 — Season weight
// ---------------------------------------------------------------------------

/**
 * Returns the decay weight for a given season index.
 *
 * - seasonIndex 0 (most recent) → 1.0
 * - Each prior season reduces weight by `config.seasonDecayRate`
 * - Floored at `config.seasonMinWeight`
 */
export function getSeasonWeight(
    index: number,
    config: RatingConfigValues
): number {
    return Math.max(config.seasonMinWeight, 1.0 - index * config.seasonDecayRate);
}

// ---------------------------------------------------------------------------
// Task 2.3 — Player rating
// ---------------------------------------------------------------------------

/**
 * Computes a player's rating from pre-fetched season data.
 *
 * Formula per season:
 *   seasonScore = min(goals * goalWeight, 30)
 *               + min(assists * assistWeight, 20)
 *               + min(appearances * appearanceWeight, 15)
 *               + min(cleanSheets * cleanSheetWeight, 10)
 *               - yellowCards * yellowCardPenalty
 *               - redCards * redCardPenalty
 *
 * rawScore = Σ weight(i) * seasonScore(i)
 * normalizedScore = rawScore / 100 * 100  (baseline max = 100)
 * result = clamp(normalizedScore, 0, 100)
 *
 * Returns 0 when the player has no season data.
 */
export function computePlayerRatingFromData(
    data: PlayerRatingData,
    config: RatingConfigValues
): number {
    if (data.seasons.length === 0) return 0;

    let rawScore = 0;

    for (const season of data.seasons) {
        const weight = getSeasonWeight(season.seasonIndex, config);

        const seasonScore =
            Math.min(season.goals * config.goalWeight, 30) +
            Math.min(season.assists * config.assistWeight, 20) +
            Math.min(season.appearances * config.appearanceWeight, 15) +
            Math.min(season.cleanSheets * config.cleanSheetWeight, 10) -
            season.yellowCards * config.yellowCardPenalty -
            season.redCards * config.redCardPenalty;

        rawScore += weight * seasonScore;
    }

    // baselineMax = 100; normalizedScore = rawScore / 100 * 100 = rawScore
    const normalizedScore = rawScore;
    return clamp(normalizedScore, 0, 100);
}

// ---------------------------------------------------------------------------
// Task 2.5 — Club rating
// ---------------------------------------------------------------------------

/**
 * Computes a club's rating from pre-fetched season data.
 *
 * Formula per season:
 *   winRate = wins / matchesPlayed  (0 if matchesPlayed = 0)
 *   goalDiffPerMatch = goalDifference / matchesPlayed  (0 if matchesPlayed = 0)
 *   pointsPerMatch = points / matchesPlayed  (0 if matchesPlayed = 0)
 *   disciplinePenalty = min(yellowCards * 0.5 + redCards * 2.0, 15)
 *   seasonScore = winRate * winRateWeight
 *               + clamp(goalDiffPerMatch / goalDiffNormMax, -1, 1) * 20
 *               + min(pointsPerMatch / pointsPerMatchNormMax, 1) * 25
 *               - disciplinePenalty
 *
 * rawScore = Σ weight(i) * seasonScore(i)
 * result = clamp(rawScore, 0, 100)
 *
 * Returns 0 when the club has no season data.
 */
export function computeClubRatingFromData(
    data: ClubRatingData,
    config: RatingConfigValues
): number {
    if (data.seasons.length === 0) return 0;

    let rawScore = 0;

    for (const season of data.seasons) {
        const weight = getSeasonWeight(season.seasonIndex, config);

        const winRate =
            season.matchesPlayed > 0 ? season.wins / season.matchesPlayed : 0;
        const goalDiffPerMatch =
            season.matchesPlayed > 0
                ? season.goalDifference / season.matchesPlayed
                : 0;
        const pointsPerMatch =
            season.matchesPlayed > 0 ? season.points / season.matchesPlayed : 0;

        const disciplinePenalty = Math.min(
            season.yellowCards * 0.5 + season.redCards * 2.0,
            15
        );

        const seasonScore =
            winRate * config.winRateWeight +
            clamp(goalDiffPerMatch / config.goalDiffNormMax, -1, 1) * 20 +
            Math.min(pointsPerMatch / config.pointsPerMatchNormMax, 1) * 25 -
            disciplinePenalty;

        rawScore += weight * seasonScore;
    }

    return clamp(rawScore, 0, 100);
}

// ---------------------------------------------------------------------------
// Task 2.7 — League rating
// ---------------------------------------------------------------------------

/**
 * Computes a league's rating from pre-fetched season data.
 *
 * Equal weight across all seasons (no decay).
 *
 * Formula:
 *   completionRate = completedSeasons.length / seasons.length
 *   avgGoalsPerMatch = totalGoals / totalMatchesWithGoals  (0 if 0)
 *   matchActivityRate = totalApproved / totalScheduled  (0 if 0)
 *   score = completionRate * 20
 *         + min(avgGoalsPerMatch / leagueGoalsNormMax, 1) * 20
 *         + avgClubRating * 0.4
 *         + matchActivityRate * 20
 *   result = clamp(score, 0, 100)
 *
 * Returns 0 when there are no seasons or no completed matches.
 */
export function computeLeagueRatingFromData(
    data: LeagueRatingData,
    config: RatingConfigValues
): number {
    if (data.seasons.length === 0) return 0;

    const completedSeasons = data.seasons.filter((s) => s.isCompleted);
    if (completedSeasons.length === 0) return 0;

    const completionRate = completedSeasons.length / data.seasons.length;

    const totalGoals = completedSeasons.reduce((sum, s) => sum + s.totalGoals, 0);
    const totalMatchesWithGoals = completedSeasons.reduce(
        (sum, s) => sum + s.matchesWithGoals,
        0
    );
    const avgGoalsPerMatch =
        totalMatchesWithGoals > 0 ? totalGoals / totalMatchesWithGoals : 0;

    const totalApproved = data.seasons.reduce(
        (sum, s) => sum + s.approvedMatches,
        0
    );
    const totalScheduled = data.seasons.reduce(
        (sum, s) => sum + s.totalMatches,
        0
    );
    const matchActivityRate =
        totalScheduled > 0 ? totalApproved / totalScheduled : 0;

    const score =
        completionRate * 20 +
        Math.min(avgGoalsPerMatch / config.leagueGoalsNormMax, 1) * 20 +
        data.avgClubRating * 0.4 +
        matchActivityRate * 20;

    return clamp(score, 0, 100);
}

// ---------------------------------------------------------------------------
// Task 2.8 — Coach rating
// ---------------------------------------------------------------------------

/**
 * Computes a coach's rating from pre-fetched season data.
 *
 * Formula per season:
 *   disciplinePenalty = min(yellowCards * 0.5 + redCards * 2.0, 15)
 *   disciplineScore = max(0, 10 - disciplinePenalty)
 *   winRate = wins / matchesPlayed  (0 if matchesPlayed = 0)
 *   seasonScore = clubRating * 0.6 + winRate * 30 + disciplineScore
 *
 * rawScore = Σ weight(i) * seasonScore(i)
 * result = clamp(rawScore, 0, 100)
 *
 * Returns 0 when the coach has no season data.
 */
export function computeCoachRatingFromData(
    data: CoachRatingData,
    config: RatingConfigValues
): number {
    if (data.seasons.length === 0) return 0;

    let rawScore = 0;

    for (const season of data.seasons) {
        const weight = getSeasonWeight(season.seasonIndex, config);

        const disciplinePenalty = Math.min(
            season.yellowCards * 0.5 + season.redCards * 2.0,
            15
        );
        const disciplineScore = Math.max(0, 10 - disciplinePenalty);

        const winRate =
            season.matchesPlayed > 0 ? season.wins / season.matchesPlayed : 0;

        const seasonScore =
            season.clubRating * 0.6 + winRate * 30 + disciplineScore;

        rawScore += weight * seasonScore;
    }

    return clamp(rawScore, 0, 100);
}

// ---------------------------------------------------------------------------
// Task 2.9 — Referee activity score
// ---------------------------------------------------------------------------

/**
 * Computes a referee's activity score from pre-fetched aggregate data.
 *
 * Formula:
 *   matchAssignmentRate = totalMatchesAssigned / totalMatchesInSeasons  (0 if 0)
 *   seasonsScore = min(distinctSeasons / maxSeasonsNorm, 1) * 30
 *   consistencyScore:
 *     - if cardsPerMatch.length < 2 → 1.0
 *     - else: stddev of cardsPerMatch; consistency = max(0, 1 - stddev / 5); clamp to [0, 1]
 *   score = matchAssignmentRate * 50 + seasonsScore + consistencyScore * 20
 *   result = clamp(score, 0, 100)
 *
 * Returns 0 when the referee has no match assignments.
 */
export function computeRefereeActivityScoreFromData(
    data: RefereeRatingData,
    config: RatingConfigValues
): number {
    if (data.totalMatchesAssigned === 0) return 0;

    const matchAssignmentRate =
        data.totalMatchesInSeasons > 0
            ? data.totalMatchesAssigned / data.totalMatchesInSeasons
            : 0;

    const seasonsScore =
        Math.min(data.distinctSeasons / config.maxSeasonsNorm, 1) * 30;

    let consistencyScore: number;
    if (data.cardsPerMatch.length < 2) {
        consistencyScore = 1.0;
    } else {
        const n = data.cardsPerMatch.length;
        const mean = data.cardsPerMatch.reduce((sum, v) => sum + v, 0) / n;
        const variance =
            data.cardsPerMatch.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
        const stddev = Math.sqrt(variance);
        consistencyScore = clamp(Math.max(0, 1 - stddev / 5), 0, 1);
    }

    const score = matchAssignmentRate * 50 + seasonsScore + consistencyScore * 20;
    return clamp(score, 0, 100);
}

// ---------------------------------------------------------------------------
// Tier helper
// ---------------------------------------------------------------------------

/**
 * Maps a numeric score to a human-readable tier label.
 *
 * | Score  | Tier       |
 * |--------|------------|
 * | 80–100 | Elite      |
 * | 60–79  | High       |
 * | 40–59  | Medium     |
 * | 20–39  | Low        |
 * | 0–19   | Developing |
 */
export function getTier(score: number): string {
    if (score >= 80) return "Elite";
    if (score >= 60) return "High";
    if (score >= 40) return "Medium";
    if (score >= 20) return "Low";
    return "Developing";
}

// ---------------------------------------------------------------------------
// Task 3.1 — DB integration: getActiveConfig
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";

/**
 * Fetches the active RatingConfig from the database.
 * Falls back to DEFAULT_RATING_CONFIG if no active config exists.
 */
export async function getActiveConfig(prisma: PrismaClient): Promise<RatingConfigValues> {
    const config = await prisma.ratingConfig.findFirst({ where: { isActive: true } });
    if (!config) {
        console.warn("[ratings] No active RatingConfig found — using defaults");
        return DEFAULT_RATING_CONFIG;
    }
    return {
        goalWeight: config.goalWeight,
        assistWeight: config.assistWeight,
        yellowCardPenalty: config.yellowCardPenalty,
        redCardPenalty: config.redCardPenalty,
        appearanceWeight: config.appearanceWeight,
        cleanSheetWeight: config.cleanSheetWeight,
        winRateWeight: config.winRateWeight,
        goalDiffNormMax: config.goalDiffNormMax,
        pointsPerMatchNormMax: config.pointsPerMatchNormMax,
        seasonDecayRate: config.seasonDecayRate,
        seasonMinWeight: config.seasonMinWeight,
        maxSeasonsNorm: config.maxSeasonsNorm,
        leagueGoalsNormMax: config.leagueGoalsNormMax,
    };
}

// ---------------------------------------------------------------------------
// Task 3.2 — DB integration: persistRating
// ---------------------------------------------------------------------------

/**
 * Persists a computed rating score for an entity.
 *
 * Within a transaction:
 * - If an EntityRating already exists: insert a RatingSnapshot with the OLD score,
 *   then update EntityRating with the new score.
 * - If no EntityRating exists: create a new EntityRating record.
 */
export async function persistRating(
    entityType: EntityType,
    entityId: string,
    score: number,
    prisma: PrismaClient
): Promise<void> {
    await prisma.$transaction(async (tx) => {
        const existing = await tx.entityRating.findUnique({
            where: { entityType_entityId: { entityType, entityId } },
        });

        if (existing) {
            // Snapshot the old value before overwriting
            await tx.ratingSnapshot.create({
                data: {
                    entityType,
                    entityId,
                    score: existing.score,
                    snapshotAt: existing.computedAt,
                },
            });
            await tx.entityRating.update({
                where: { entityType_entityId: { entityType, entityId } },
                data: { score, computedAt: new Date() },
            });
        } else {
            await tx.entityRating.create({
                data: { entityType, entityId, score },
            });
        }
    });
}

// ---------------------------------------------------------------------------
// Task 4.1 — computeAndPersistPlayerRating
// ---------------------------------------------------------------------------

/**
 * Fetches all season data for a player, builds PlayerRatingData, computes the
 * rating, and persists it.
 *
 * Only considers SeasonClubPlayer records where:
 *   - requestStatus = "approved"
 *   - status = "active"
 *
 * Seasons are sorted by startDate desc so the most recent gets seasonIndex 0.
 */
export async function computeAndPersistPlayerRating(
    playerId: string,
    prisma: PrismaClient
): Promise<void> {
    const config = await getActiveConfig(prisma);

    // Fetch all approved, active season participations for this player
    const seasonClubPlayers = await prisma.seasonClubPlayer.findMany({
        where: {
            playerId,
            requestStatus: "approved",
            status: "active",
        },
        include: {
            seasonClub: {
                include: {
                    season: true,
                    club: true,
                },
            },
            position: true,
            matchLineups: {
                include: {
                    match: true,
                },
            },
        },
    });

    if (seasonClubPlayers.length === 0) {
        await persistRating("player", playerId, 0, prisma);
        return;
    }

    // Sort by season startDate desc to assign seasonIndex
    const sorted = [...seasonClubPlayers].sort(
        (a, b) =>
            b.seasonClub.season.startDate.getTime() -
            a.seasonClub.season.startDate.getTime()
    );

    // Determine if the player is a goalkeeper (position code "GK")
    // Use the position from the SeasonClubPlayer record (most specific)
    const isGoalkeeper = sorted.some(
        (scp) => scp.position?.code === "GK"
    );

    // Fetch all match events for this player in one query
    const allMatchEvents = await prisma.matchEvent.findMany({
        where: {
            OR: [
                { playerId },
                { relatedPlayerId: playerId },
            ],
        },
        include: {
            eventType: true,
            match: {
                include: {
                    homeClub: true,
                    awayClub: true,
                },
            },
        },
    });

    const seasons: PlayerSeasonData[] = sorted.map((scp, index) => {
        const seasonId = scp.seasonClub.seasonId;
        const clubId = scp.seasonClub.clubId;

        // Filter events that belong to this season's matches
        const seasonEvents = allMatchEvents.filter(
            (e) => e.match.seasonId === seasonId
        );

        const goals = seasonEvents.filter(
            (e) =>
                e.playerId === playerId &&
                (e.eventType.name === "goal" || e.eventType.name === "penalty_goal")
        ).length;

        const assists = seasonEvents.filter(
            (e) =>
                e.relatedPlayerId === playerId &&
                (e.eventType.name === "goal" || e.eventType.name === "penalty_goal")
        ).length;

        const yellowCards = seasonEvents.filter(
            (e) => e.playerId === playerId && e.eventType.name === "yellow_card"
        ).length;

        const redCards = seasonEvents.filter(
            (e) => e.playerId === playerId && e.eventType.name === "red_card"
        ).length;

        // Appearances: distinct matchIds from events OR lineups in this season
        const matchIdsFromEvents = new Set(
            seasonEvents
                .filter((e) => e.playerId === playerId)
                .map((e) => e.matchId)
        );
        const matchIdsFromLineups = new Set(
            scp.matchLineups
                .filter((l) => l.match.seasonId === seasonId)
                .map((l) => l.matchId)
        );
        const allMatchIds = new Set([
            ...matchIdsFromEvents,
            ...matchIdsFromLineups,
        ]);
        const appearances = allMatchIds.size;

        // Clean sheets: only for goalkeepers
        let cleanSheets = 0;
        if (isGoalkeeper && appearances > 0) {
            for (const matchId of allMatchIds) {
                // Find the match from lineups or events
                const matchFromLineup = scp.matchLineups.find(
                    (l) => l.matchId === matchId
                );
                const matchFromEvent = seasonEvents.find(
                    (e) => e.matchId === matchId
                );
                const match =
                    matchFromLineup?.match ?? matchFromEvent?.match;
                if (!match) continue;

                // Determine if player's club conceded 0 goals
                const isHomeClub = match.homeClubId === clubId;
                const conceded = isHomeClub ? match.awayScore : match.homeScore;
                if (conceded === 0) cleanSheets++;
            }
        }

        return {
            seasonIndex: index,
            goals,
            assists,
            yellowCards,
            redCards,
            appearances,
            cleanSheets,
        };
    });

    const ratingData: PlayerRatingData = { seasons };
    const score = computePlayerRatingFromData(ratingData, config);
    await persistRating("player", playerId, score, prisma);
}

// ---------------------------------------------------------------------------
// Task 4.2 — computeAndPersistClubRating
// ---------------------------------------------------------------------------

/**
 * Fetches all season data for a club, builds ClubRatingData, computes the
 * rating, and persists it.
 *
 * Only considers SeasonClub records where status = "active".
 * Only counts matches where status = "approved".
 */
export async function computeAndPersistClubRating(
    clubId: string,
    prisma: PrismaClient
): Promise<void> {
    const config = await getActiveConfig(prisma);

    const seasonClubs = await prisma.seasonClub.findMany({
        where: {
            clubId,
            status: "active",
        },
        include: {
            season: true,
        },
    });

    if (seasonClubs.length === 0) {
        await persistRating("club", clubId, 0, prisma);
        return;
    }

    // Sort by season startDate desc
    const sorted = [...seasonClubs].sort(
        (a, b) =>
            b.season.startDate.getTime() - a.season.startDate.getTime()
    );

    const seasons: ClubSeasonData[] = await Promise.all(
        sorted.map(async (sc, index) => {
            const seasonId = sc.seasonId;

            // Fetch approved matches for this club in this season
            const matches = await prisma.match.findMany({
                where: {
                    seasonId,
                    status: "approved",
                    OR: [{ homeClubId: clubId }, { awayClubId: clubId }],
                },
            });

            const matchesPlayed = matches.length;
            let wins = 0;
            let draws = 0;
            let losses = 0;
            let goalDifference = 0;

            for (const match of matches) {
                const isHome = match.homeClubId === clubId;
                const goalsFor = isHome ? match.homeScore : match.awayScore;
                const goalsAgainst = isHome ? match.awayScore : match.homeScore;
                goalDifference += goalsFor - goalsAgainst;

                if (goalsFor > goalsAgainst) wins++;
                else if (goalsFor === goalsAgainst) draws++;
                else losses++;
            }

            const points =
                wins * sc.season.pointsWin +
                draws * sc.season.pointsDraw +
                losses * sc.season.pointsLoss;

            // Discipline: cards from MatchEvent for all club players in this season
            const disciplineEvents = await prisma.matchEvent.findMany({
                where: {
                    clubId,
                    match: { seasonId, status: "approved" },
                    eventType: {
                        name: { in: ["yellow_card", "red_card"] },
                    },
                },
                include: { eventType: true },
            });

            const yellowCards = disciplineEvents.filter(
                (e) => e.eventType.name === "yellow_card"
            ).length;
            const redCards = disciplineEvents.filter(
                (e) => e.eventType.name === "red_card"
            ).length;

            return {
                seasonIndex: index,
                wins,
                matchesPlayed,
                goalDifference,
                points,
                yellowCards,
                redCards,
            };
        })
    );

    const ratingData: ClubRatingData = { seasons };
    const score = computeClubRatingFromData(ratingData, config);
    await persistRating("club", clubId, score, prisma);
}

// ---------------------------------------------------------------------------
// Task 4.3 — computeAndPersistLeagueRating
// ---------------------------------------------------------------------------

/**
 * Fetches all seasons for a league, builds LeagueRatingData, computes the
 * rating, and persists it.
 *
 * avgClubRating is the average EntityRating score of all clubs that have
 * participated in this league (via SeasonClub records).
 */
export async function computeAndPersistLeagueRating(
    leagueId: string,
    prisma: PrismaClient
): Promise<void> {
    const config = await getActiveConfig(prisma);

    const dbSeasons = await prisma.season.findMany({
        where: { leagueId },
        include: {
            matches: true,
        },
    });

    if (dbSeasons.length === 0) {
        await persistRating("league", leagueId, 0, prisma);
        return;
    }

    const leagueSeasons: LeagueSeasonData[] = dbSeasons.map((season) => {
        const isCompleted = season.status === "completed";
        const totalMatches = season.matches.length;
        const approvedMatches = season.matches.filter(
            (m) => m.status === "approved"
        );
        const totalGoals = approvedMatches.reduce(
            (sum, m) => sum + m.homeScore + m.awayScore,
            0
        );
        const matchesWithGoals = approvedMatches.length;

        return {
            isCompleted,
            totalMatches,
            approvedMatches: approvedMatches.length,
            totalGoals,
            matchesWithGoals,
        };
    });

    // Compute avgClubRating: average EntityRating for all clubs in this league
    const seasonIds = dbSeasons.map((s) => s.id);
    const seasonClubs = await prisma.seasonClub.findMany({
        where: { seasonId: { in: seasonIds } },
        select: { clubId: true },
    });
    const uniqueClubIds = [...new Set(seasonClubs.map((sc) => sc.clubId))];

    let avgClubRating = 0;
    if (uniqueClubIds.length > 0) {
        const clubRatings = await prisma.entityRating.findMany({
            where: {
                entityType: "club",
                entityId: { in: uniqueClubIds },
            },
            select: { score: true },
        });
        if (clubRatings.length > 0) {
            avgClubRating =
                clubRatings.reduce((sum, r) => sum + r.score, 0) /
                clubRatings.length;
        }
    }

    const ratingData: LeagueRatingData = {
        seasons: leagueSeasons,
        avgClubRating,
    };
    const score = computeLeagueRatingFromData(ratingData, config);
    await persistRating("league", leagueId, score, prisma);
}

// ---------------------------------------------------------------------------
// Task 4.4 — computeAndPersistCoachRating
// ---------------------------------------------------------------------------

/**
 * Fetches all season data for a coach, builds CoachRatingData, computes the
 * rating, and persists it.
 *
 * Only considers SeasonClubCoach records where:
 *   - status IN ["active", "approved"]
 *   - requestStatus = "approved"
 *
 * Seasons are sorted by startDate desc so the most recent gets seasonIndex 0.
 */
export async function computeAndPersistCoachRating(
    coachId: string,
    prisma: PrismaClient
): Promise<void> {
    const config = await getActiveConfig(prisma);

    const seasonClubCoaches = await prisma.seasonClubCoach.findMany({
        where: {
            coachId,
            requestStatus: "approved",
            status: { in: ["active", "approved"] },
        },
        include: {
            seasonClub: {
                include: {
                    season: true,
                    club: true,
                },
            },
        },
    });

    if (seasonClubCoaches.length === 0) {
        await persistRating("coach", coachId, 0, prisma);
        return;
    }

    // Sort by season startDate desc
    const sorted = [...seasonClubCoaches].sort(
        (a, b) =>
            b.seasonClub.season.startDate.getTime() -
            a.seasonClub.season.startDate.getTime()
    );

    const seasons: CoachSeasonData[] = await Promise.all(
        sorted.map(async (scc, index) => {
            const seasonId = scc.seasonClub.seasonId;
            const clubId = scc.seasonClub.clubId;

            // Fetch club's current EntityRating
            const clubRatingRecord = await prisma.entityRating.findUnique({
                where: {
                    entityType_entityId: { entityType: "club", entityId: clubId },
                },
            });
            const clubRating = clubRatingRecord?.score ?? 0;

            // Fetch approved matches for this club in this season
            const matches = await prisma.match.findMany({
                where: {
                    seasonId,
                    status: "approved",
                    OR: [{ homeClubId: clubId }, { awayClubId: clubId }],
                },
            });

            const matchesPlayed = matches.length;
            let wins = 0;
            for (const match of matches) {
                const isHome = match.homeClubId === clubId;
                const goalsFor = isHome ? match.homeScore : match.awayScore;
                const goalsAgainst = isHome ? match.awayScore : match.homeScore;
                if (goalsFor > goalsAgainst) wins++;
            }

            // Discipline: cards for all club players in this season
            const disciplineEvents = await prisma.matchEvent.findMany({
                where: {
                    clubId,
                    match: { seasonId, status: "approved" },
                    eventType: {
                        name: { in: ["yellow_card", "red_card"] },
                    },
                },
                include: { eventType: true },
            });

            const yellowCards = disciplineEvents.filter(
                (e) => e.eventType.name === "yellow_card"
            ).length;
            const redCards = disciplineEvents.filter(
                (e) => e.eventType.name === "red_card"
            ).length;

            return {
                seasonIndex: index,
                clubRating,
                wins,
                matchesPlayed,
                yellowCards,
                redCards,
            };
        })
    );

    const ratingData: CoachRatingData = { seasons };
    const score = computeCoachRatingFromData(ratingData, config);
    await persistRating("coach", coachId, score, prisma);
}

// ---------------------------------------------------------------------------
// Task 4.5 — computeAndPersistRefereeRating
// ---------------------------------------------------------------------------

/**
 * Fetches all match and season assignment data for a referee, builds
 * RefereeRatingData, computes the rating, and persists it.
 *
 * - totalMatchesAssigned: count of MatchReferee records
 * - distinctSeasons: count of distinct seasonIds from SeasonReferee
 * - totalMatchesInSeasons: count of all matches in those seasons
 * - cardsPerMatch: for each assigned match, total cards (yellow + red) from MatchEvent
 */
export async function computeAndPersistRefereeRating(
    refereeId: string,
    prisma: PrismaClient
): Promise<void> {
    const config = await getActiveConfig(prisma);

    // All match assignments
    const matchReferees = await prisma.matchReferee.findMany({
        where: { refereeId },
        include: {
            match: {
                include: {
                    matchEvents: {
                        include: { eventType: true },
                    },
                },
            },
        },
    });

    const totalMatchesAssigned = matchReferees.length;

    // All season assignments
    const seasonReferees = await prisma.seasonReferee.findMany({
        where: { refereeId },
        select: { seasonId: true },
    });

    const distinctSeasonIds = [...new Set(seasonReferees.map((sr) => sr.seasonId))];
    const distinctSeasons = distinctSeasonIds.length;

    // Total matches in those seasons
    let totalMatchesInSeasons = 0;
    if (distinctSeasonIds.length > 0) {
        totalMatchesInSeasons = await prisma.match.count({
            where: { seasonId: { in: distinctSeasonIds } },
        });
    }

    // Cards per match for each assigned match
    const cardsPerMatch = matchReferees.map((mr) => {
        const cards = mr.match.matchEvents.filter(
            (e) =>
                e.eventType.name === "yellow_card" ||
                e.eventType.name === "red_card"
        ).length;
        return cards;
    });

    const ratingData: RefereeRatingData = {
        totalMatchesAssigned,
        totalMatchesInSeasons,
        distinctSeasons,
        cardsPerMatch,
    };

    const score = computeRefereeActivityScoreFromData(ratingData, config);
    await persistRating("referee", refereeId, score, prisma);
}

// ---------------------------------------------------------------------------
// Tasks 5.1–5.5 — Trigger helpers & full recompute
// ---------------------------------------------------------------------------

import prisma from "./prisma";

// ---------------------------------------------------------------------------
// Task 5.1 — recomputeMatchRatings
// ---------------------------------------------------------------------------

export async function recomputeMatchRatings(matchId: string): Promise<void> {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            season: { include: { league: true } },
            matchLineups: {
                include: {
                    seasonClubPlayer: { include: { player: true } },
                },
            },
            matchEvents: { include: { player: true } },
            matchReferees: true,
        },
    });
    if (!match) return;

    const playerIds = new Set<string>();
    match.matchLineups.forEach((l) => playerIds.add(l.seasonClubPlayer.playerId));
    match.matchEvents.forEach((e) => playerIds.add(e.playerId));

    for (const playerId of playerIds) {
        await computeAndPersistPlayerRating(playerId, prisma).catch((err) =>
            console.error(`[ratings] compute failed: player ${playerId}`, err)
        );
    }

    for (const clubId of [match.homeClubId, match.awayClubId]) {
        await computeAndPersistClubRating(clubId, prisma).catch((err) =>
            console.error(`[ratings] compute failed: club ${clubId}`, err)
        );
    }

    await computeAndPersistLeagueRating(match.season.leagueId, prisma).catch((err) =>
        console.error(`[ratings] compute failed: league ${match.season.leagueId}`, err)
    );

    const coaches = await prisma.seasonClubCoach.findMany({
        where: {
            seasonClub: {
                seasonId: match.seasonId,
                clubId: { in: [match.homeClubId, match.awayClubId] },
            },
            status: { in: ["active", "approved"] },
        },
    });
    for (const coach of coaches) {
        await computeAndPersistCoachRating(coach.coachId, prisma).catch((err) =>
            console.error(`[ratings] compute failed: coach ${coach.coachId}`, err)
        );
    }

    for (const mr of match.matchReferees) {
        await computeAndPersistRefereeRating(mr.refereeId, prisma).catch((err) =>
            console.error(`[ratings] compute failed: referee ${mr.refereeId}`, err)
        );
    }
}

// ---------------------------------------------------------------------------
// Task 5.2 — recomputeEventRatings
// ---------------------------------------------------------------------------

export async function recomputeEventRatings(matchEventId: string): Promise<void> {
    const event = await prisma.matchEvent.findUnique({
        where: { id: matchEventId },
        include: { match: true },
    });
    if (!event) return;

    await computeAndPersistPlayerRating(event.playerId, prisma).catch((err) =>
        console.error(`[ratings] compute failed: player ${event.playerId}`, err)
    );

    if (event.clubId) {
        await computeAndPersistClubRating(event.clubId, prisma).catch((err) =>
            console.error(`[ratings] compute failed: club ${event.clubId}`, err)
        );
    }
}

// ---------------------------------------------------------------------------
// Task 5.3 — recomputeSeasonRatings
// ---------------------------------------------------------------------------

export async function recomputeSeasonRatings(seasonId: string): Promise<void> {
    const season = await prisma.season.findUnique({
        where: { id: seasonId },
        include: {
            seasonClubs: {
                include: {
                    players: true,
                    coaches: true,
                },
            },
        },
    });
    if (!season) return;

    const playerIds = new Set<string>();
    season.seasonClubs.forEach((sc) => sc.players.forEach((p) => playerIds.add(p.playerId)));
    for (const playerId of playerIds) {
        await computeAndPersistPlayerRating(playerId, prisma).catch((err) =>
            console.error(`[ratings] compute failed: player ${playerId}`, err)
        );
    }

    for (const sc of season.seasonClubs) {
        await computeAndPersistClubRating(sc.clubId, prisma).catch((err) =>
            console.error(`[ratings] compute failed: club ${sc.clubId}`, err)
        );
    }

    const coachIds = new Set<string>();
    season.seasonClubs.forEach((sc) => sc.coaches.forEach((c) => coachIds.add(c.coachId)));
    for (const coachId of coachIds) {
        await computeAndPersistCoachRating(coachId, prisma).catch((err) =>
            console.error(`[ratings] compute failed: coach ${coachId}`, err)
        );
    }

    await computeAndPersistLeagueRating(season.leagueId, prisma).catch((err) =>
        console.error(`[ratings] compute failed: league ${season.leagueId}`, err)
    );
}

// ---------------------------------------------------------------------------
// Task 5.4 — runFullRecompute
// ---------------------------------------------------------------------------

export async function runFullRecompute(): Promise<void> {
    console.log("[ratings] Starting full recompute...");
    let processed = 0;
    let failures = 0;

    const players = await prisma.player.findMany({ select: { id: true } });
    for (const p of players) {
        await computeAndPersistPlayerRating(p.id, prisma)
            .then(() => processed++)
            .catch((err) => { failures++; console.error(`[ratings] compute failed: player ${p.id}`, err); });
    }

    const clubs = await prisma.club.findMany({ select: { id: true } });
    for (const c of clubs) {
        await computeAndPersistClubRating(c.id, prisma)
            .then(() => processed++)
            .catch((err) => { failures++; console.error(`[ratings] compute failed: club ${c.id}`, err); });
    }

    const coaches = await prisma.coach.findMany({ select: { id: true } });
    for (const c of coaches) {
        await computeAndPersistCoachRating(c.id, prisma)
            .then(() => processed++)
            .catch((err) => { failures++; console.error(`[ratings] compute failed: coach ${c.id}`, err); });
    }

    const referees = await prisma.referee.findMany({ select: { id: true } });
    for (const r of referees) {
        await computeAndPersistRefereeRating(r.id, prisma)
            .then(() => processed++)
            .catch((err) => { failures++; console.error(`[ratings] compute failed: referee ${r.id}`, err); });
    }

    const leagues = await prisma.league.findMany({ select: { id: true } });
    for (const l of leagues) {
        await computeAndPersistLeagueRating(l.id, prisma)
            .then(() => processed++)
            .catch((err) => { failures++; console.error(`[ratings] compute failed: league ${l.id}`, err); });
    }

    console.log(`[ratings] Full recompute complete. Processed: ${processed}, Failures: ${failures}`);
}

// ---------------------------------------------------------------------------
// Task 5.5 — runBackfillIfNeeded
// ---------------------------------------------------------------------------

export async function runBackfillIfNeeded(): Promise<void> {
    const count = await prisma.entityRating.count();
    if (count > 0) return;

    console.log("[ratings] No ratings found — starting first-run backfill...");
    runFullRecompute().catch((err) =>
        console.error("[ratings] First-run backfill failed", err)
    );
}
