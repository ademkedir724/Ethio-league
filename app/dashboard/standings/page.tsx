"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "@/lib/auth-context";
import { authFetcher } from "@/lib/fetch-client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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

interface League { id: string; name: string }
interface Season { id: string; name: string; leagueId?: string }

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
    const { isSuperAdmin, isOrgAdmin, isLeagueAdmin, isClubAdmin, isMEA,
        getLeagueId, getClubId, getSeasonId } = useAuth();

    const leagueId = getLeagueId();       // league_admin
    const clubId = getClubId();           // club_admin
    const meaSeasonId = getSeasonId();    // match_event_admin

    // Determine which role path we're on
    const needsLeaguePicker = isSuperAdmin() || isOrgAdmin();
    const isLeagueAdminRole = isLeagueAdmin() && !isSuperAdmin() && !isOrgAdmin();
    const isClubAdminRole = isClubAdmin() && !isSuperAdmin() && !isOrgAdmin() && !isLeagueAdmin();
    const isMEARole = isMEA() && !isSuperAdmin() && !isOrgAdmin() && !isLeagueAdmin() && !isClubAdmin();

    // ── League picker (super_admin / org_admin) ────────────────────────────────
    const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
    const { data: leagues } = useSWR<League[]>(
        needsLeaguePicker ? "/api/leagues" : null,
        authFetcher
    );
    // Auto-select first league
    useEffect(() => {
        if (leagues && leagues.length > 0 && !selectedLeagueId) {
            setSelectedLeagueId(leagues[0].id);
        }
    }, [leagues, selectedLeagueId]);

    // ── Season picker ──────────────────────────────────────────────────────────
    const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");

    // Determine the URL to fetch seasons from
    const seasonsUrl = (() => {
        if (needsLeaguePicker && selectedLeagueId) return `/api/leagues/${selectedLeagueId}/seasons`;
        if (isLeagueAdminRole && leagueId) return `/api/leagues/${leagueId}/seasons`;
        if (isClubAdminRole && clubId) return `/api/seasons?clubId=${clubId}`;
        return null;
    })();

    const { data: seasons } = useSWR<Season[]>(seasonsUrl, authFetcher);

    // Auto-select first season when seasons load or league changes
    useEffect(() => {
        setSelectedSeasonId("");
    }, [selectedLeagueId]);
    useEffect(() => {
        if (seasons && seasons.length > 0 && !selectedSeasonId) {
            setSelectedSeasonId(seasons[0].id);
        }
    }, [seasons, selectedSeasonId]);

    // For MEA: their season is fixed from their scope
    const effectiveSeasonId = isMEARole ? (meaSeasonId ?? "") : selectedSeasonId;

    // ── Data fetching ──────────────────────────────────────────────────────────
    const { data: standings, isLoading: standingsLoading, error: standingsError } =
        useSWR<StandingRow[]>(effectiveSeasonId ? `/api/seasons/${effectiveSeasonId}/standings` : null, authFetcher);

    const { data: topScorers, isLoading: scorersLoading, error: scorersError } =
        useSWR<TopScorer[]>(effectiveSeasonId ? `/api/seasons/${effectiveSeasonId}/top-scorers` : null, authFetcher);

    const { data: discipline, isLoading: disciplineLoading, error: disciplineError } =
        useSWR<DisciplineData>(effectiveSeasonId ? `/api/seasons/${effectiveSeasonId}/discipline` : null, authFetcher);

    // Season summary stats
    const totalMatches = standings ? Math.floor(standings.reduce((s, r) => s + r.played, 0) / 2) : 0;
    const totalGoals = standings ? standings.reduce((s, r) => s + r.goalsFor, 0) : 0;
    const avgGoalsPerMatch = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(2) : "0.00";

    // ── No access ──────────────────────────────────────────────────────────────
    if (!needsLeaguePicker && !isLeagueAdminRole && !isClubAdminRole && !isMEARole) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader title="League Standings" />
                <Card>
                    <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                        No league or season assigned to your account.
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="League Standings">
                <div className="flex items-center gap-2">
                    {/* League picker — org_admin / super_admin */}
                    {needsLeaguePicker && leagues && leagues.length > 0 && (
                        <Select value={selectedLeagueId} onValueChange={(v) => setSelectedLeagueId(v)}>
                            <SelectTrigger className="w-48 h-8 text-sm">
                                <SelectValue placeholder="Select league" />
                            </SelectTrigger>
                            <SelectContent>
                                {leagues.map((l) => (
                                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {/* Season picker — all roles except MEA */}
                    {!isMEARole && seasons && seasons.length > 0 && (
                        <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                            <SelectTrigger className="w-44 h-8 text-sm">
                                <SelectValue placeholder="Select season" />
                            </SelectTrigger>
                            <SelectContent>
                                {seasons.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </PageHeader>

            {!effectiveSeasonId ? (
                <Card>
                    <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                        {needsLeaguePicker && !selectedLeagueId
                            ? "Select a league to view standings."
                            : "Select a season to view standings."}
                    </CardContent>
                </Card>
            ) : (
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
                            <ErrorMessage message="Failed to load standings." />
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
                                            standings.map((row, i) => (
                                                <TableRow key={row.clubId}>
                                                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                                    <TableCell className="font-medium">{row.clubName}</TableCell>
                                                    <TableCell className="text-center">{row.played}</TableCell>
                                                    <TableCell className="text-center">{row.won}</TableCell>
                                                    <TableCell className="text-center">{row.drawn}</TableCell>
                                                    <TableCell className="text-center">{row.lost}</TableCell>
                                                    <TableCell className="text-center">{row.goalsFor}</TableCell>
                                                    <TableCell className="text-center">{row.goalsAgainst}</TableCell>
                                                    <TableCell className="text-center">
                                                        {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold">{row.points}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
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
                            <ErrorMessage message="Failed to load top scorers." />
                        ) : scorersLoading ? (
                            <TableSkeleton cols={4} />
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-10">#</TableHead>
                                            <TableHead>Player</TableHead>
                                            <TableHead>Club</TableHead>
                                            <TableHead className="text-center">Goals</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topScorers && topScorers.length > 0 ? (
                                            topScorers.map((s, i) => (
                                                <TableRow key={s.playerId}>
                                                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                                    <TableCell className="font-medium">{s.playerName}</TableCell>
                                                    <TableCell className="text-muted-foreground">{s.clubName ?? "—"}</TableCell>
                                                    <TableCell className="text-center font-bold">{s.goals}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
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
                            <ErrorMessage message="Failed to load discipline data." />
                        ) : disciplineLoading ? (
                            <div className="flex flex-col gap-6"><TableSkeleton cols={4} /><TableSkeleton cols={3} /></div>
                        ) : (
                            <div className="flex flex-col gap-6">
                                <div>
                                    <h2 className="mb-3 text-sm font-semibold text-foreground">By Player</h2>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Player</TableHead>
                                                    <TableHead>Club</TableHead>
                                                    <TableHead className="text-center">Yellow</TableHead>
                                                    <TableHead className="text-center">Red</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {discipline?.byPlayer && discipline.byPlayer.length > 0 ? (
                                                    discipline.byPlayer.map((p) => (
                                                        <TableRow key={p.playerId}>
                                                            <TableCell className="font-medium">{p.playerName}</TableCell>
                                                            <TableCell className="text-muted-foreground">{p.clubName ?? "—"}</TableCell>
                                                            <TableCell className="text-center">{p.yellowCards}</TableCell>
                                                            <TableCell className="text-center">{p.redCards}</TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">No data.</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                                <div>
                                    <h2 className="mb-3 text-sm font-semibold text-foreground">By Club</h2>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Club</TableHead>
                                                    <TableHead className="text-center">Yellow</TableHead>
                                                    <TableHead className="text-center">Red</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {discipline?.byClub && discipline.byClub.length > 0 ? (
                                                    discipline.byClub.map((c) => (
                                                        <TableRow key={c.clubId}>
                                                            <TableCell className="font-medium">{c.clubName}</TableCell>
                                                            <TableCell className="text-center">{c.yellowCards}</TableCell>
                                                            <TableCell className="text-center">{c.redCards}</TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">No data.</TableCell>
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
                        {standingsLoading ? (
                            <div className="grid gap-4 sm:grid-cols-3">
                                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-3">
                                <StatCard title="Total Matches Played" value={totalMatches} icon={Trophy} description="Completed matches this season" />
                                <StatCard title="Total Goals" value={totalGoals} icon={Goal} description="Goals scored across all matches" />
                                <StatCard title="Avg Goals / Match" value={avgGoalsPerMatch} icon={BarChart3} description="Average goals per completed match" />
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
