"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, Plus, Shield, Users, Check, X, UserCircle, Swords, Pencil } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Season {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    requiredClubs?: number | null;
    roundRobinType?: string | null;
    daysBetweenRounds?: number | null;
    minSquadSize?: number | null;
    minStartingPlayers?: number | null;
    maxBenchPlayers?: number | null;
    rules?: string | null;
    league: { id: string; name: string; organization: { name: string } };
    _count: { seasonClubs: number; matches: number };
}

interface Club {
    id: string;
    name: string;
    shortName?: string | null;
    status: string;
}

interface SeasonClub {
    id: string;
    clubId: string;
    status: string;
    club: Club;
    _count: { players: number; coaches: number };
}

interface SeasonClubPlayer {
    id: string;
    jerseyNumber?: number | null;
    status: string;
    player: { id: string; firstName: string; lastName: string };
    seasonClub: { club: { id: string; name: string } };
    position?: { name: string } | null;
}

// ─── Readiness Helpers ────────────────────────────────────────────────────────

function computeReadiness(playerCount: number, coachCount: number, minSquad = 14): { isReady: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (playerCount < minSquad) reasons.push(`${playerCount}/${minSquad} players`);
    if (coachCount < 1) reasons.push("no coach");
    return { isReady: reasons.length === 0, reasons };
}

function ReadinessBadge({ playerCount, coachCount, minSquad = 14 }: { playerCount: number; coachCount: number; minSquad?: number }) {
    const { isReady, reasons } = computeReadiness(playerCount, coachCount, minSquad);
    if (isReady) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Ready
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/25">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            {reasons.join(" · ")}
        </span>
    );
}

function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SeasonDetailPage() {
    const params = useParams();
    const router = useRouter();
    const seasonId = params.id as string;
    const { isLeagueAdmin, isClubAdmin, getClubId } = useAuth();

    const { data: season, isLoading: seasonLoading } = useSWR<Season>(
        seasonId ? `/api/seasons/${seasonId}` : null,
        authFetcher
    );

    if (seasonLoading) {
        return (
            <div className="flex flex-col gap-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }

    if (!season) return null;

    return (
        <div className="flex flex-col gap-6">
            <button
                onClick={() => router.back()}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
            >
                <ChevronLeft className="h-4 w-4" />
                Back
            </button>

            {isLeagueAdmin() && (
                <LeagueAdminSeasonSelector
                    currentSeasonId={seasonId}
                    leagueId={season.league.id}
                />
            )}

            <PageHeader
                title={season.name}
                description={`${season.league.organization.name} · ${season.league.name}`}
            >
                <StatusBadge status={season.status} />
            </PageHeader>

            {/* Season meta */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card><CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Period</p>
                    <p className="text-sm font-medium">{formatDate(season.startDate)} — {formatDate(season.endDate)}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Clubs</p>
                    <p className="text-sm font-medium">{season._count.seasonClubs}{season.requiredClubs ? ` / ${season.requiredClubs}` : ""}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Fixtures</p>
                    <p className="text-sm font-medium">{season._count.matches}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Format</p>
                    <p className="text-sm font-medium capitalize">{season.roundRobinType ?? "double"} round-robin</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Round Gap</p>
                    <p className="text-sm font-medium">{season.daysBetweenRounds ? `${season.daysBetweenRounds} days` : "—"}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Min Squad</p>
                    <p className="text-sm font-medium">{season.minSquadSize ?? 14} players</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Lineup</p>
                    <p className="text-sm font-medium">{season.minStartingPlayers ?? 11} starters + {season.maxBenchPlayers ?? 7} bench</p>
                </CardContent></Card>
            </div>

            {/* League rules */}
            {season.rules && (
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">League Rules</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{season.rules}</p>
                    </CardContent>
                </Card>
            )}

            {/* Role-specific tabs */}
            {isLeagueAdmin() && <LeagueAdminSeasonTabs seasonId={seasonId} season={season} />}
            {isClubAdmin() && <ClubAdminSeasonView seasonId={seasonId} clubId={getClubId() ?? ""} />}
            {/* Fixtures visible to all roles */}
            {!isLeagueAdmin() && !isClubAdmin() && <SeasonFixturesTab seasonId={seasonId} />}
        </div>
    );
}

// ─── Fixtures Tab (all roles) ─────────────────────────────────────────────────

interface FixtureMatch {
    id: string;
    matchDate: string;
    roundNumber: number | null;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    homeClub: { id: string; name: string };
    awayClub: { id: string; name: string };
    stadium: { id: string; name: string } | null;
}

function SeasonFixturesTab({ seasonId }: { seasonId: string }) {
    const router = useRouter();
    const { isLeagueAdmin } = useAuth();
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateErrors, setGenerateErrors] = useState<Array<{ criterion: string; message: string; clubs?: string[] }>>([]);
    const [editingMatch, setEditingMatch] = useState<FixtureMatch | null>(null);
    const [editForm, setEditForm] = useState({ matchDate: "", matchTime: "", stadiumId: "" });
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const { data: fixtures, isLoading, mutate: mutateFixtures } = useSWR<FixtureMatch[]>(
        `/api/matches?seasonId=${seasonId}`,
        authFetcher
    );

    // Fetch season assignments for MEA/referee pickers in edit dialog
    const { data: seasonAssignments } = useSWR<{
        referees: Array<{ id: string; firstName: string; lastName: string; licenseLevel?: string | null }>;
        matchEventAdmins: Array<{ id: string; fullName: string; email: string }>;
    }>(
        editingMatch ? `/api/seasons/${seasonId}/assignments` : null,
        authFetcher
    );

    // Fetch stadiums for the season's clubs
    const { data: stadiums } = useSWR<Array<{ id: string; name: string; city?: string | null; ownerClub?: { name: string } | null }>>(
        editingMatch ? `/api/stadiums?seasonId=${seasonId}` : null,
        authFetcher
    );

    const handleGenerate = async (force = false) => {
        setIsGenerating(true);
        setGenerateErrors([]);
        try {
            const res = await fetchWithAuth("/api/matches/fixtures", {
                method: "POST",
                body: JSON.stringify({ seasonId, force }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 201) {
                toast.success(`Generated ${data.matchesCreated} fixture(s) across ${data.rounds} round(s).`);
                mutateFixtures();
                mutate(`/api/seasons/${seasonId}`);
            } else if (res.status === 422 && data.code === "FIXTURE_PRECONDITION_FAILED") {
                setGenerateErrors(data.details ?? []);
            } else {
                toast.error(data.error || "Failed to generate fixtures");
            }
        } catch {
            toast.error("Something went wrong");
        } finally {
            setIsGenerating(false);
        }
    };

    const openEdit = (m: FixtureMatch, e: React.MouseEvent) => {
        e.stopPropagation();
        const d = new Date(m.matchDate);
        setEditForm({
            matchDate: d.toISOString().slice(0, 10),
            matchTime: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
            stadiumId: m.stadium?.id ?? "",
        });
        setEditingMatch(m);
    };

    const handleSaveEdit = async () => {
        if (!editingMatch) return;
        setIsSavingEdit(true);
        try {
            const [h, min] = editForm.matchTime.split(":").map(Number);
            const matchDate = new Date(editForm.matchDate);
            matchDate.setHours(h, min, 0, 0);

            const res = await fetchWithAuth(`/api/matches/${editingMatch.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                    matchDate: matchDate.toISOString(),
                    stadiumId: editForm.stadiumId || null,
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                toast.error(d.error || "Failed to update match");
                return;
            }
            toast.success("Match updated");
            setEditingMatch(null);
            mutateFixtures();
        } catch {
            toast.error("Something went wrong");
        } finally {
            setIsSavingEdit(false);
        }
    };

    const formatMatchDate = (d: string) =>
        new Date(d).toLocaleString(undefined, {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });

    const byRound = (fixtures ?? []).reduce<Record<string, FixtureMatch[]>>((acc, m) => {
        const key = m.roundNumber ? `Round ${m.roundNumber}` : "Unscheduled";
        if (!acc[key]) acc[key] = [];
        acc[key].push(m);
        return acc;
    }, {});

    const rounds = Object.keys(byRound).sort((a, b) => {
        const na = parseInt(a.replace("Round ", "")) || 999;
        const nb = parseInt(b.replace("Round ", "")) || 999;
        return na - nb;
    });

    const canEdit = isLeagueAdmin();

    return (
        <div className="flex flex-col gap-4 mt-4">
            {/* Generate errors */}
            {generateErrors.length > 0 && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-destructive/10 border-b border-destructive/20">
                        <p className="text-sm font-semibold text-destructive">Cannot generate fixtures</p>
                    </div>
                    <div className="flex flex-col divide-y divide-destructive/10">
                        {generateErrors.map((d) => (
                            <div key={d.criterion} className="px-4 py-2.5 flex flex-col gap-1">
                                <p className="text-xs font-medium text-foreground">{d.message}</p>
                                {d.clubs && d.clubs.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {d.clubs.map((c) => (
                                            <span key={c} className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-destructive/10 text-destructive/80 border border-destructive/20">{c}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
            ) : fixtures && fixtures.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center gap-3">
                    <Swords className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No fixtures generated yet.</p>
                    {canEdit && (
                        <Button size="sm" onClick={() => handleGenerate(false)} disabled={isGenerating}>
                            <Swords className="h-3.5 w-3.5 mr-1" />
                            {isGenerating ? "Generating..." : "Generate Fixtures"}
                        </Button>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {canEdit && (
                        <div className="flex justify-end">
                            <Button size="sm" variant="outline" onClick={() => handleGenerate(true)} disabled={isGenerating}>
                                <Swords className="h-3.5 w-3.5 mr-1" />
                                {isGenerating ? "Regenerating..." : "Regenerate Fixtures"}
                            </Button>
                        </div>
                    )}
                    {rounds.map((round) => (
                        <div key={round}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{round}</p>
                            <Card>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Match</TableHead>
                                                <TableHead className="hidden sm:table-cell">Date</TableHead>
                                                <TableHead className="hidden md:table-cell">Stadium</TableHead>
                                                <TableHead>Score</TableHead>
                                                <TableHead>Status</TableHead>
                                                {canEdit && <TableHead className="w-10" />}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {byRound[round].map((m) => (
                                                <TableRow
                                                    key={m.id}
                                                    className="cursor-pointer hover:bg-muted/30"
                                                    onClick={() => router.push(`/dashboard/matches/${m.id}`)}
                                                >
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium">{m.homeClub.name}</span>
                                                            <span className="text-xs text-muted-foreground">vs {m.awayClub.name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                                                        {formatMatchDate(m.matchDate)}
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                                        {m.stadium?.name ?? "—"}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm font-semibold">
                                                        {m.homeScore !== null && m.awayScore !== null
                                                            ? `${m.homeScore} - ${m.awayScore}`
                                                            : "- vs -"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <StatusBadge status={m.status} />
                                                    </TableCell>
                                                    {canEdit && (
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost" size="icon"
                                                                className="h-7 w-7 text-muted-foreground"
                                                                onClick={(e) => openEdit(m, e)}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    ))}
                </div>
            )}

            {/* Match Edit Dialog */}
            <Dialog open={!!editingMatch} onOpenChange={(open) => !open && setEditingMatch(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Match</DialogTitle>
                        <DialogDescription>
                            {editingMatch ? `${editingMatch.homeClub.name} vs ${editingMatch.awayClub.name}` : ""}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Date</label>
                                <input
                                    type="date"
                                    value={editForm.matchDate}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, matchDate: e.target.value })}
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Kickoff Time</label>
                                <Select
                                    value={editForm.matchTime}
                                    onValueChange={(v) => setEditForm({ ...editForm, matchTime: v })}
                                >
                                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="15:00">15:00</SelectItem>
                                        <SelectItem value="17:00">17:00</SelectItem>
                                        <SelectItem value="19:00">19:00</SelectItem>
                                        <SelectItem value="20:00">20:00</SelectItem>
                                        <SelectItem value="20:45">20:45</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Stadium</label>
                            <Select
                                value={editForm.stadiumId || "none"}
                                onValueChange={(v) => setEditForm({ ...editForm, stadiumId: v === "none" ? "" : v })}
                            >
                                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="No stadium" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No stadium</SelectItem>
                                    {(stadiums ?? []).map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name}{s.ownerClub ? ` (${s.ownerClub.name})` : ""}{s.city ? ` · ${s.city}` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {stadiums && stadiums.length === 0 && (
                                <p className="text-xs text-muted-foreground">No stadiums found for clubs in this season.</p>
                            )}
                        </div>
                        {seasonAssignments && (
                            <div className="flex flex-col gap-1.5">
                                <p className="text-xs font-medium text-muted-foreground">
                                    To edit referees or MEA, go to the{" "}
                                    <button
                                        className="text-primary underline"
                                        onClick={() => { setEditingMatch(null); router.push(`/dashboard/matches/${editingMatch?.id}`); }}
                                    >
                                        match detail page
                                    </button>
                                </p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingMatch(null)}>Cancel</Button>
                        <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
                            {isSavingEdit ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Season Selector (League Admin) ──────────────────────────────────────────

interface SeasonOption {
    id: string;
    name: string;
    status: string;
}

function LeagueAdminSeasonSelector({ currentSeasonId, leagueId }: { currentSeasonId: string; leagueId: string }) {
    const router = useRouter();
    const { data: seasons } = useSWR<SeasonOption[]>(
        leagueId ? `/api/seasons?leagueId=${leagueId}` : null,
        authFetcher
    );

    if (!seasons || seasons.length <= 1) return null;

    return (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Season:</span>
            <Select
                value={currentSeasonId}
                onValueChange={(id) => router.push(`/dashboard/seasons/${id}`)}
            >
                <SelectTrigger className="h-7 border-0 bg-transparent p-0 text-sm font-medium shadow-none focus:ring-0 w-auto gap-1">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {seasons.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                                {s.name}
                                <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${s.status === "active" ? "bg-emerald-500/15 text-emerald-400" :
                                    s.status === "upcoming" ? "bg-amber-500/15 text-amber-400" :
                                        "bg-muted text-muted-foreground"
                                    }`}>{s.status}</span>
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}



function LeagueAdminSeasonTabs({ seasonId, season }: { seasonId: string; season: Season }) {
    return (
        <Tabs defaultValue="clubs">
            <TabsList>
                <TabsTrigger value="clubs">Clubs</TabsTrigger>
                <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
                <TabsTrigger value="players">Players</TabsTrigger>
                <TabsTrigger value="coaches">Coaches</TabsTrigger>
                <TabsTrigger value="assignments">Assignments</TabsTrigger>
            </TabsList>
            <TabsContent value="clubs">
                <SeasonClubsTab seasonId={seasonId} season={season} />
            </TabsContent>
            <TabsContent value="fixtures">
                <SeasonFixturesTab seasonId={seasonId} />
            </TabsContent>
            <TabsContent value="players">
                <SeasonPlayersTab seasonId={seasonId} />
            </TabsContent>
            <TabsContent value="coaches">
                <SeasonCoachesTab seasonId={seasonId} />
            </TabsContent>
            <TabsContent value="assignments">
                <SeasonAssignmentsTab seasonId={seasonId} />
            </TabsContent>
        </Tabs>
    );
}

// ─── Assignments Tab (League Admin — read-only view) ─────────────────────────

interface AssignmentResponse {
    referees: Array<{ id: string; firstName: string; lastName: string; licenseLevel?: string | null; nationality?: string | null; roleLevel?: string | null }>;
    matchEventAdmins: Array<{ id: string; fullName: string; email: string; status: string }>;
}

function SeasonAssignmentsTab({ seasonId }: { seasonId: string }) {
    const { data, isLoading } = useSWR<AssignmentResponse>(
        `/api/seasons/${seasonId}/assignments`,
        authFetcher
    );

    if (isLoading) {
        return (
            <div className="flex flex-col gap-3 mt-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
        );
    }

    const referees = data?.referees ?? [];
    const meas = data?.matchEventAdmins ?? [];

    return (
        <div className="flex flex-col gap-6 mt-4">
            {/* Match Event Admins */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Match Event Admins</CardTitle>
                        <Badge variant="outline" className="text-xs">{meas.length} assigned</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {meas.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No match event admins assigned yet.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {meas.map((mea) => (
                                    <TableRow key={mea.id}>
                                        <TableCell className="text-sm font-medium">{mea.fullName}</TableCell>
                                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{mea.email}</TableCell>
                                        <TableCell><StatusBadge status={mea.status} /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Referees */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Referees</CardTitle>
                        <Badge variant="outline" className="text-xs">{referees.length} assigned</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {referees.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No referees assigned yet.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="hidden sm:table-cell">License</TableHead>
                                    <TableHead className="hidden md:table-cell">Nationality</TableHead>
                                    <TableHead className="hidden md:table-cell">Role</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {referees.map((ref) => (
                                    <TableRow key={ref.id}>
                                        <TableCell className="text-sm font-medium">{ref.firstName} {ref.lastName}</TableCell>
                                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{ref.licenseLevel ?? "—"}</TableCell>
                                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{ref.nationality ?? "—"}</TableCell>
                                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground capitalize">{ref.roleLevel?.replace(/_/g, " ") ?? "—"}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Clubs Tab ────────────────────────────────────────────────────────────────

function SeasonClubsTab({ seasonId, season }: { seasonId: string; season: Season }) {
    const { getLeagueId } = useAuth();
    const leagueId = getLeagueId();

    const { data: seasonClubs, isLoading } = useSWR<SeasonClub[]>(
        `/api/seasons/${seasonId}/clubs`,
        authFetcher
    );

    // All clubs in this league (to pick from)
    const { data: allClubsRaw } = useSWR("/api/clubs", authFetcher);
    const allClubs: Club[] = allClubsRaw?.data ?? allClubsRaw ?? [];

    const [addOpen, setAddOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<SeasonClub | null>(null);

    const assignedClubIds = useMemo(
        () => new Set((seasonClubs ?? []).map((sc) => sc.clubId)),
        [seasonClubs]
    );

    const availableClubs = useMemo(
        () => (allClubs ?? []).filter((c) => !assignedClubIds.has(c.id)),
        [allClubs, assignedClubIds]
    );

    const filteredClubs = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return availableClubs;
        return availableClubs.filter((c) => c.name.toLowerCase().includes(q));
    }, [availableClubs, search]);

    const toggleClub = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredClubs.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredClubs.map((c) => c.id)));
        }
    };

    const handleAdd = async () => {
        if (selectedIds.size === 0) { toast.error("Select at least one club"); return; }
        setIsSaving(true);
        try {
            const res = await fetchWithAuth(`/api/seasons/${seasonId}/clubs`, {
                method: "POST",
                body: JSON.stringify({ clubIds: Array.from(selectedIds) }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error || "Failed to add clubs");
                return;
            }
            const added = data.added ?? 1;
            const skipped = data.skipped ?? 0;
            toast.success(
                skipped > 0
                    ? `${added} club${added !== 1 ? "s" : ""} added (${skipped} already in season)`
                    : `${added} club${added !== 1 ? "s" : ""} added to season`
            );
            setAddOpen(false);
            setSelectedIds(new Set());
            setSearch("");
            mutate(`/api/seasons/${seasonId}/clubs`);
            mutate(`/api/seasons/${seasonId}`);
        } catch { toast.error("Something went wrong"); }
        finally { setIsSaving(false); }
    };

    const handleRemove = async () => {
        if (!removeTarget) return;
        try {
            const res = await fetchWithAuth(`/api/seasons/${seasonId}/clubs`, {
                method: "DELETE",
                body: JSON.stringify({ clubId: removeTarget.clubId }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                toast.error(d.error || "Failed to remove club");
                return;
            }
            toast.success("Club removed from season");
            setRemoveTarget(null);
            mutate(`/api/seasons/${seasonId}/clubs`);
            mutate(`/api/seasons/${seasonId}`);
        } catch { toast.error("Something went wrong"); }
    };

    const readyCount = (seasonClubs ?? []).filter((sc) => sc.status === "active").length;
    const required = season.requiredClubs;

    return (
        <div className="flex flex-col gap-4 mt-4">
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    {readyCount} active{required ? ` / ${required} required` : ""}
                    {required && readyCount >= required && (
                        <Badge className="ml-2 text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30" variant="outline">
                            Ready
                        </Badge>
                    )}
                </div>
                <Button size="sm" onClick={() => { setSelectedIds(new Set()); setSearch(""); setAddOpen(true); }}>
                    <Plus className="h-4 w-4" />
                    Add Clubs
                </Button>
            </div>

            {isLoading ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
                </div>
            ) : !seasonClubs || seasonClubs.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
                    <Shield className="mb-2 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No clubs assigned yet.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {seasonClubs.map((sc) => (
                        <div key={sc.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-primary/10 text-xs text-primary">
                                        {getInitials(sc.club.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium">{sc.club.name}</p>
                                        <StatusBadge status={sc.status} />
                                    </div>
                                    <p className="text-xs text-muted-foreground">{sc._count.players} players · {sc._count.coaches} coach{sc._count.coaches !== 1 ? "es" : ""}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <ReadinessBadge playerCount={sc._count.players} coachCount={sc._count.coaches} minSquad={season.minSquadSize ?? 14} />
                                <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                    onClick={() => setRemoveTarget(sc)}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Add Clubs Dialog (multi-select) ── */}
            <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) { setSelectedIds(new Set()); setSearch(""); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Clubs to Season</DialogTitle>
                        <DialogDescription>
                            Select one or more clubs from your league to add to this season.
                        </DialogDescription>
                    </DialogHeader>

                    {availableClubs.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2 text-center">All clubs are already assigned to this season.</p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {/* Search */}
                            <input
                                type="text"
                                placeholder="Search clubs..."
                                value={search}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            />

                            {/* Select all / count */}
                            <div className="flex items-center justify-between px-1">
                                <button
                                    type="button"
                                    onClick={toggleAll}
                                    className="text-xs text-primary hover:underline"
                                >
                                    {selectedIds.size === filteredClubs.length && filteredClubs.length > 0
                                        ? "Deselect all"
                                        : "Select all"}
                                </button>
                                <span className="text-xs text-muted-foreground">
                                    {selectedIds.size} selected
                                </span>
                            </div>

                            {/* Club list */}
                            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
                                {filteredClubs.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">No clubs match your search.</p>
                                ) : (
                                    filteredClubs.map((c) => {
                                        const checked = selectedIds.has(c.id);
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => toggleClub(c.id)}
                                                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${checked
                                                    ? "border-primary/40 bg-primary/5"
                                                    : "border-border hover:bg-muted/40"
                                                    }`}
                                            >
                                                {/* Checkbox indicator */}
                                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-muted-foreground/40"
                                                    }`}>
                                                    {checked && <Check className="h-3 w-3" />}
                                                </span>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-medium truncate">{c.name}</span>
                                                    {c.shortName && (
                                                        <span className="text-xs text-muted-foreground">{c.shortName}</span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleAdd}
                            disabled={isSaving || selectedIds.size === 0}
                        >
                            {isSaving
                                ? "Adding..."
                                : selectedIds.size > 0
                                    ? `Add ${selectedIds.size} Club${selectedIds.size !== 1 ? "s" : ""}`
                                    : "Add Clubs"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!removeTarget}
                onOpenChange={(open) => !open && setRemoveTarget(null)}
                title="Remove Club"
                description={`Remove "${removeTarget?.club.name}" from this season?`}
                confirmLabel="Remove"
                variant="destructive"
                onConfirm={handleRemove}
            />
        </div>
    );
}

// ─── Players Tab (League Admin) ───────────────────────────────────────────────

function SeasonPlayersTab({ seasonId }: { seasonId: string }) {
    const { data: players, isLoading } = useSWR<SeasonClubPlayer[]>(
        `/api/seasons/${seasonId}/players`,
        authFetcher
    );

    const handleApprove = async (scpId: string) => {
        try {
            const res = await fetchWithAuth(`/api/seasons/${seasonId}/players/${scpId}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "active" }),
            });
            if (!res.ok) { toast.error("Failed to approve player"); return; }
            toast.success("Player approved");
            mutate(`/api/seasons/${seasonId}/players`);
        } catch { toast.error("Something went wrong"); }
    };

    const handleReject = async (scpId: string) => {
        try {
            const res = await fetchWithAuth(`/api/seasons/${seasonId}/players/${scpId}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "rejected" }),
            });
            if (!res.ok) { toast.error("Failed to reject player"); return; }
            toast.success("Player rejected");
            mutate(`/api/seasons/${seasonId}/players`);
        } catch { toast.error("Something went wrong"); }
    };

    const pending = (players ?? []).filter((p) => p.status === "pending");
    const approved = (players ?? []).filter((p) => p.status === "active");

    return (
        <div className="flex flex-col gap-4 mt-4">
            {isLoading ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
            ) : (
                <>
                    {pending.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <p className="text-sm font-medium text-amber-400">Pending Approval ({pending.length})</p>
                            {pending.map((scp) => (
                                <div key={scp.id} className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
                                    <div>
                                        <p className="text-sm font-medium">{scp.player.firstName} {scp.player.lastName}</p>
                                        <p className="text-xs text-muted-foreground">{scp.seasonClub.club.name} · #{scp.jerseyNumber ?? "—"} · {scp.position?.name ?? "—"}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400 hover:bg-emerald-400/10" onClick={() => handleApprove(scp.id)}>
                                            <Check className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleReject(scp.id)}>
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {approved.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <p className="text-sm font-medium text-muted-foreground">Approved ({approved.length})</p>
                            {approved.map((scp) => (
                                <div key={scp.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
                                    <div>
                                        <p className="text-sm font-medium">{scp.player.firstName} {scp.player.lastName}</p>
                                        <p className="text-xs text-muted-foreground">{scp.seasonClub.club.name} · #{scp.jerseyNumber ?? "—"} · {scp.position?.name ?? "—"}</p>
                                    </div>
                                    <StatusBadge status={scp.status} />
                                </div>
                            ))}
                        </div>
                    )}

                    {pending.length === 0 && approved.length === 0 && (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
                            <UserCircle className="mb-2 h-8 w-8 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">No players submitted yet.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Coaches Tab (League Admin) ──────────────────────────────────────────────

interface SeasonCoachRecord {
    id: string;
    coachId: string;
    role: string;
    status: string;
    requestStatus: string;
    coach: { id: string; firstName: string; lastName: string; licenseLevel?: string | null; nationality?: string | null };
    seasonClub: { club: { id: string; name: string } };
}

function SeasonCoachesTab({ seasonId }: { seasonId: string }) {
    const { data: coaches, isLoading } = useSWR<SeasonCoachRecord[]>(
        `/api/seasons/${seasonId}/coaches`,
        authFetcher
    );

    const handleReview = async (sccId: string, action: "approve" | "reject") => {
        try {
            const res = await fetchWithAuth(`/api/seasons/${seasonId}/coaches/${sccId}/review`, {
                method: "PATCH",
                body: JSON.stringify({ action }),
            });
            if (!res.ok) { toast.error(`Failed to ${action} coach`); return; }
            toast.success(`Coach ${action === "approve" ? "approved" : "rejected"}`);
            mutate(`/api/seasons/${seasonId}/coaches`);
        } catch { toast.error("Something went wrong"); }
    };

    const pending = (coaches ?? []).filter((c) => c.requestStatus === "pending");
    const approved = (coaches ?? []).filter((c) => c.requestStatus === "approved");
    const rejected = (coaches ?? []).filter((c) => c.requestStatus === "rejected");

    return (
        <div className="flex flex-col gap-4 mt-4">
            {isLoading ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
            ) : (
                <>
                    {pending.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <p className="text-sm font-medium text-amber-400">Pending Approval ({pending.length})</p>
                            {pending.map((scc) => (
                                <div key={scc.id} className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
                                    <div>
                                        <p className="text-sm font-medium">{scc.coach.firstName} {scc.coach.lastName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {scc.seasonClub.club.name} · {scc.role.replace(/_/g, " ")}
                                            {scc.coach.licenseLevel && ` · ${scc.coach.licenseLevel}`}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400 hover:bg-emerald-400/10" onClick={() => handleReview(scc.id, "approve")}>
                                            <Check className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleReview(scc.id, "reject")}>
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {approved.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <p className="text-sm font-medium text-muted-foreground">Approved ({approved.length})</p>
                            {approved.map((scc) => (
                                <div key={scc.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
                                    <div>
                                        <p className="text-sm font-medium">{scc.coach.firstName} {scc.coach.lastName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {scc.seasonClub.club.name} · {scc.role.replace(/_/g, " ")}
                                            {scc.coach.licenseLevel && ` · ${scc.coach.licenseLevel}`}
                                        </p>
                                    </div>
                                    <StatusBadge status={scc.status} />
                                </div>
                            ))}
                        </div>
                    )}

                    {rejected.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <p className="text-sm font-medium text-red-400/70">Rejected ({rejected.length})</p>
                            {rejected.map((scc) => (
                                <div key={scc.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 opacity-60">
                                    <div>
                                        <p className="text-sm font-medium">{scc.coach.firstName} {scc.coach.lastName}</p>
                                        <p className="text-xs text-muted-foreground">{scc.seasonClub.club.name} · {scc.role.replace(/_/g, " ")}</p>
                                    </div>
                                    <StatusBadge status="rejected" />
                                </div>
                            ))}
                        </div>
                    )}

                    {pending.length === 0 && approved.length === 0 && rejected.length === 0 && (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
                            <UserCircle className="mb-2 h-8 w-8 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">No coach requests submitted yet.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Club Admin Season View ───────────────────────────────────────────────────

function ClubAdminSeasonView({ seasonId, clubId }: { seasonId: string; clubId: string }) {
    const { data: allPlayersRaw } = useSWR("/api/players", authFetcher);
    const allPlayers = allPlayersRaw?.data ?? allPlayersRaw ?? [];
    const { data: seasonPlayers, isLoading } = useSWR<SeasonClubPlayer[]>(`/api/seasons/${seasonId}/players`, authFetcher);
    const { data: positions } = useSWR<Array<{ id: number; name: string; code: string }>>("/api/players/positions", authFetcher);

    const [batchOpen, setBatchOpen] = useState(false);
    const [selected, setSelected] = useState<Record<string, { jerseyNumber: string; positionId: string }>>({});
    const [isSaving, setIsSaving] = useState(false);

    const submittedPlayerIds = useMemo(
        () => new Set((seasonPlayers ?? []).map((scp) => scp.player.id)),
        [seasonPlayers]
    );

    const unsubmittedPlayers = useMemo(
        () => (allPlayers ?? []).filter((p) => !submittedPlayerIds.has(p.id)),
        [allPlayers, submittedPlayerIds]
    );

    const togglePlayer = (playerId: string) => {
        setSelected((prev) => {
            const next = { ...prev };
            if (next[playerId]) {
                delete next[playerId];
            } else {
                next[playerId] = { jerseyNumber: "", positionId: "" };
            }
            return next;
        });
    };

    const handleBatchSubmit = async () => {
        const entries = Object.entries(selected);
        if (entries.length === 0) { toast.error("Select at least one player"); return; }

        setIsSaving(true);
        let successCount = 0;
        let failCount = 0;

        for (const [playerId, { jerseyNumber, positionId }] of entries) {
            try {
                const res = await fetchWithAuth(`/api/seasons/${seasonId}/players`, {
                    method: "POST",
                    body: JSON.stringify({
                        clubId,
                        playerId,
                        jerseyNumber: jerseyNumber ? parseInt(jerseyNumber) : null,
                        positionId: positionId ? parseInt(positionId) : null,
                    }),
                });
                if (res.ok) successCount++;
                else failCount++;
            } catch { failCount++; }
        }

        if (successCount > 0) toast.success(`${successCount} player${successCount > 1 ? "s" : ""} submitted for approval`);
        if (failCount > 0) toast.error(`${failCount} player${failCount > 1 ? "s" : ""} failed`);

        setBatchOpen(false);
        setSelected({});
        mutate(`/api/seasons/${seasonId}/players`);
        setIsSaving(false);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {(seasonPlayers ?? []).length} player{(seasonPlayers ?? []).length !== 1 ? "s" : ""} submitted
                </p>
                <Button size="sm" onClick={() => setBatchOpen(true)} disabled={unsubmittedPlayers.length === 0}>
                    <Plus className="h-4 w-4" />
                    Submit Players
                </Button>
            </div>

            {isLoading ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
            ) : (seasonPlayers ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
                    <Users className="mb-2 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No players submitted for this season yet.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {(seasonPlayers ?? []).map((scp) => (
                        <div key={scp.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
                            <div>
                                <p className="text-sm font-medium">{scp.player.firstName} {scp.player.lastName}</p>
                                <p className="text-xs text-muted-foreground">#{scp.jerseyNumber ?? "—"} · {scp.position?.name ?? "—"}</p>
                            </div>
                            <StatusBadge status={scp.status} />
                        </div>
                    ))}
                </div>
            )}

            {/* Batch Submit Dialog */}
            <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Submit Players for Season</DialogTitle>
                        <DialogDescription>
                            Select players from your roster and assign jersey numbers and positions.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-2">
                        {unsubmittedPlayers.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">All players are already submitted.</p>
                        ) : (
                            unsubmittedPlayers.map((p) => {
                                const isSelected = !!selected[p.id];
                                return (
                                    <div key={p.id} className={`rounded-lg border px-3 py-2 transition-colors ${isSelected ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => togglePlayer(p.id)}
                                                className="h-4 w-4 accent-primary"
                                            />
                                            <span className="flex-1 text-sm font-medium">{p.firstName} {p.lastName}</span>
                                        </div>
                                        {isSelected && (
                                            <div className="mt-2 grid grid-cols-2 gap-2 pl-7">
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-xs text-muted-foreground">Jersey #</label>
                                                    <input
                                                        type="number"
                                                        className="h-7 rounded border border-border bg-background px-2 text-xs"
                                                        value={selected[p.id].jerseyNumber}
                                                        onChange={(e) => setSelected((prev) => ({ ...prev, [p.id]: { ...prev[p.id], jerseyNumber: e.target.value } }))}
                                                        placeholder="e.g. 10"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-xs text-muted-foreground">Position</label>
                                                    <select
                                                        className="h-7 rounded border border-border bg-background px-2 text-xs"
                                                        value={selected[p.id].positionId}
                                                        onChange={(e) => setSelected((prev) => ({ ...prev, [p.id]: { ...prev[p.id], positionId: e.target.value } }))}
                                                    >
                                                        <option value="">None</option>
                                                        {(positions ?? []).map((pos) => (
                                                            <option key={pos.id} value={pos.id}>{pos.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBatchOpen(false)}>Cancel</Button>
                        <Button onClick={handleBatchSubmit} disabled={isSaving || Object.keys(selected).length === 0}>
                            {isSaving ? "Submitting..." : `Submit ${Object.keys(selected).length > 0 ? `(${Object.keys(selected).length})` : ""}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
