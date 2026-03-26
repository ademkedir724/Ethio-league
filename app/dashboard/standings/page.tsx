"use client";

import { useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/lib/auth-context";
import { authFetcher } from "@/lib/fetch-client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Goal, BarChart3 } from "lucide-react";
import type { StandingRow } from "@/lib/standings";

interface TopScorer {
    playerId: string;
    playerName: string;
    clubName: string | null;
    goals: number;
}

interface DisciplinePlayer {
    playerId: string;
    playerName: string;
    clubName: string | null;
    yellowCards: number;
    redCards: number;
}

interface DisciplineClub {
    clubId: string;
    clubName: string;
    yellowCards: number;
    redCards: number;
}

interface DisciplineData {
    byPlayer: DisciplinePlayer[];
    byClub: DisciplineClub[];
}

function TableSkeleton({ cols, rows = 5 }: { cols: number; rows?: number }) {
    return (
        <div className="flex flex-col gap-2">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-3">
                    {Array.from({ length: cols }).map((_, j) => (
                        <Skeleton key={j} className="h-8 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

function ErrorMessage({ message }: { message: string }) {
    return (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {message}
        </div>
    );
}

export default function StandingsPage() {
    const { getLeagueId } = useAuth();
    const leagueId = getLeagueId();

    // Fetch seasons for this league so the admin can pick one
    const { data: seasons } = useSWR<{ id: string; name: string }[]>(
        leagueId ? `/api/leagues/${leagueId}/seasons` : null,
        authFetcher
    );

    const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
    const seasonId = selectedSeasonId ?? seasons?.[0]?.id ?? null;

    const {
        data: standings,
        isLoading: standingsLoading,
        error: standingsError,
    } = useSWR<StandingRow[]>(
        seasonId ? `/api/seasons/${seasonId}/standings` : null,
        authFetcher
    );

    const {
        data: topScorers,
        isLoading: scorersLoading,
        error: scorersError,
    } = useSWR<TopScorer[]>(
        seasonId ? `/api/seasons/${seasonId}/top-scorers` : null,
        authFetcher
    );

    const {
        data: discipline,
        isLoading: disciplineLoading,
        error: disciplineError,
    } = useSWR<DisciplineData>(
        seasonId ? `/api/seasons/${seasonId}/discipline` : null,
        authFetcher
    );

    // Season summary stats derived from standings
    const totalMatches = standings
        ? Math.floor(standings.reduce((sum, r) => sum + r.played, 0) / 2)
        : 0;
    const totalGoals = standings
        ? standings.reduce((sum, r) => sum + r.goalsFor, 0)
        : 0;
    const avgGoalsPerMatch =
        totalMatches > 0 ? (totalGoals / totalMatches).toFixed(2) : "0.00";

    if (!leagueId) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader title="League Standings" />
                <Card>
                    <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                        No league assigned to your account.
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="League Standings">
                {seasons && seasons.length > 1 && (
                    <select
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                        value={seasonId ?? ""}
                        onChange={(e) => setSelectedSeasonId(e.target.value)}
                    >
                        {seasons.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                )}
            </PageHeader>

            <Tabs defaultValue="standings">
                <TabsList>
                    <TabsTrigger value="standings">Standings</TabsTrigger>
                    <TabsTrigger value="top-scorers">Top Scorers</TabsTrigger>
                    <TabsTrigger value="discipline">Discipline</TabsTrigger>
                    <TabsTrigger value="summary">Season Summary</TabsTrigger>
                </TabsList>

                {/* Standings Tab */}
                <TabsContent value="standings" className="mt-4">
                    {standingsError ? (
                        <ErrorMessage message="Failed to load standings. Please try again." />
                    ) : standingsLoading ? (
                        <TableSkeleton cols={10} />
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10">#</TableHead>
                                        <TableHead>Club</TableHead>
                                        <TableHead className="text-center">P</TableHead>
                                        <TableHead className="text-center">W</TableHead>
                                        <TableHead className="text-center">D</TableHead>
                                        <TableHead className="text-center">L</TableHead>
                                        <TableHead className="text-center">GF</TableHead>
                                        <TableHead className="text-center">GA</TableHead>
                                        <TableHead className="text-center">GD</TableHead>
                                        <TableHead className="text-center font-bold">Pts</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {standings && standings.length > 0 ? (
                                        standings.map((row, index) => (
                                            <TableRow key={row.clubId}>
                                                <TableCell className="text-muted-foreground">
                                                    {index + 1}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {row.clubName}
                                                </TableCell>
                                                <TableCell className="text-center">{row.played}</TableCell>
                                                <TableCell className="text-center">{row.won}</TableCell>
                                                <TableCell className="text-center">{row.drawn}</TableCell>
                                                <TableCell className="text-center">{row.lost}</TableCell>
                                                <TableCell className="text-center">{row.goalsFor}</TableCell>
                                                <TableCell className="text-center">{row.goalsAgainst}</TableCell>
                                                <TableCell className="text-center">
                                                    {row.goalDifference > 0
                                                        ? `+${row.goalDifference}`
                                                        : row.goalDifference}
                                                </TableCell>
                                                <TableCell className="text-center font-bold">
                                                    {row.points}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell
                                                colSpan={10}
                                                className="h-24 text-center text-muted-foreground"
                                            >
                                                No standings data available.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>

                {/* Top Scorers Tab */}
                <TabsContent value="top-scorers" className="mt-4">
                    {scorersError ? (
                        <ErrorMessage message="Failed to load top scorers. Please try again." />
                    ) : scorersLoading ? (
                        <TableSkeleton cols={4} />
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10">#</TableHead>
                                        <TableHead>Player Name</TableHead>
                                        <TableHead>Club</TableHead>
                                        <TableHead className="text-center">Goals</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {topScorers && topScorers.length > 0 ? (
                                        topScorers.map((scorer, index) => (
                                            <TableRow key={scorer.playerId}>
                                                <TableCell className="text-muted-foreground">
                                                    {index + 1}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {scorer.playerName}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {scorer.clubName ?? "—"}
                                                </TableCell>
                                                <TableCell className="text-center font-bold">
                                                    {scorer.goals}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell
                                                colSpan={4}
                                                className="h-24 text-center text-muted-foreground"
                                            >
                                                No scorers data available.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>

                {/* Discipline Tab */}
                <TabsContent value="discipline" className="mt-4">
                    {disciplineError ? (
                        <ErrorMessage message="Failed to load discipline data. Please try again." />
                    ) : disciplineLoading ? (
                        <div className="flex flex-col gap-6">
                            <TableSkeleton cols={4} />
                            <TableSkeleton cols={3} />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {/* By Player */}
                            <div>
                                <h2 className="mb-3 text-sm font-semibold text-foreground">
                                    By Player
                                </h2>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Player</TableHead>
                                                <TableHead>Club</TableHead>
                                                <TableHead className="text-center">Yellow Cards</TableHead>
                                                <TableHead className="text-center">Red Cards</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {discipline?.byPlayer && discipline.byPlayer.length > 0 ? (
                                                discipline.byPlayer.map((p) => (
                                                    <TableRow key={p.playerId}>
                                                        <TableCell className="font-medium">
                                                            {p.playerName}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {p.clubName ?? "—"}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {p.yellowCards}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {p.redCards}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={4}
                                                        className="h-24 text-center text-muted-foreground"
                                                    >
                                                        No player discipline data available.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* By Club */}
                            <div>
                                <h2 className="mb-3 text-sm font-semibold text-foreground">
                                    By Club
                                </h2>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Club</TableHead>
                                                <TableHead className="text-center">Yellow Cards</TableHead>
                                                <TableHead className="text-center">Red Cards</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {discipline?.byClub && discipline.byClub.length > 0 ? (
                                                discipline.byClub.map((c) => (
                                                    <TableRow key={c.clubId}>
                                                        <TableCell className="font-medium">
                                                            {c.clubName}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {c.yellowCards}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {c.redCards}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={3}
                                                        className="h-24 text-center text-muted-foreground"
                                                    >
                                                        No club discipline data available.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* Season Summary Tab */}
                <TabsContent value="summary" className="mt-4">
                    {standingsError ? (
                        <ErrorMessage message="Failed to load season summary. Please try again." />
                    ) : standingsLoading ? (
                        <div className="grid gap-4 sm:grid-cols-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-28 w-full rounded-lg" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-3">
                            <StatCard
                                title="Total Matches Played"
                                value={totalMatches}
                                icon={Trophy}
                                description="Completed matches this season"
                            />
                            <StatCard
                                title="Total Goals"
                                value={totalGoals}
                                icon={Goal}
                                description="Goals scored across all matches"
                            />
                            <StatCard
                                title="Avg Goals / Match"
                                value={avgGoalsPerMatch}
                                icon={BarChart3}
                                description="Average goals per completed match"
                            />
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
