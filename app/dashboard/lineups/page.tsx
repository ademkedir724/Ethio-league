"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AlertTriangle, Calendar, Users } from "lucide-react";

interface Club { id: string; name: string; shortName?: string }
interface Season { id: string; name: string; status: string }

interface Match {
    id: string;
    matchDate: string;
    status: string;
    roundNumber?: number;
    homeClub: Club;
    awayClub: Club;
    season?: { id: string; name: string };
    seasonId?: string;
}

interface SeasonClubPlayer {
    id: string;
    player: { id: string; firstName: string; lastName: string };
    position?: { id: number; name: string } | null;
    jerseyNumber?: number | null;
    seasonClub: { club: Club };
    requestStatus: string;
}

interface LineupEntry {
    seasonClubPlayerId: string;
    lineupType: "starting" | "substitute";
    isCaptain: boolean;
    positionId?: number;
}

const POSITIONS = [
    { id: 1, name: "GK" }, { id: 2, name: "CB" }, { id: 3, name: "LB" },
    { id: 4, name: "RB" }, { id: 5, name: "CDM" }, { id: 6, name: "CM" },
    { id: 7, name: "CAM" }, { id: 8, name: "LW" }, { id: 9, name: "RW" },
    { id: 10, name: "ST" }, { id: 11, name: "CF" },
];

export default function LineupsPage() {
    const { getClubId } = useAuth();
    const clubId = getClubId();

    // Season selector
    const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");

    // Dialog state
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [starters, setStarters] = useState<Set<string>>(new Set());
    const [substitutes, setSubstitutes] = useState<Set<string>>(new Set());
    const [positions, setPositions] = useState<Record<string, number>>({});
    const [captainId, setCaptainId] = useState<string>("");
    const [submitting, setSubmitting] = useState(false);
    const [apiErrors, setApiErrors] = useState<string[]>([]);

    // Fetch all seasons for this club
    const { data: seasonsRaw } = useSWR(
        clubId ? `/api/seasons?clubId=${clubId}` : null,
        authFetcher
    );
    const seasons: Season[] = seasonsRaw?.data ?? seasonsRaw ?? [];

    // Auto-select active season on first load
    useMemo(() => {
        if (!selectedSeasonId && seasons.length > 0) {
            const active = seasons.find((s) => s.status === "active") ?? seasons[0];
            if (active) setSelectedSeasonId(active.id);
        }
    }, [seasons, selectedSeasonId]);

    // Fetch matches for selected season + club
    const { data: matchesData, isLoading: matchesLoading, error: matchesError } = useSWR(
        clubId && selectedSeasonId ? `/api/matches?clubId=${clubId}&seasonId=${selectedSeasonId}` : null,
        authFetcher
    );

    // Fetch players for the selected season (club-scoped by the API)
    const { data: playersData, isLoading: playersLoading } = useSWR<SeasonClubPlayer[]>(
        selectedSeasonId ? `/api/seasons/${selectedSeasonId}/players` : null,
        authFetcher
    );

    const { data: clubData } = useSWR(
        clubId ? `/api/clubs/${clubId}` : null,
        authFetcher
    );

    const isPending = (clubData as { status?: string } | undefined)?.status === "pending";

    const allMatches: Match[] = matchesData?.data ?? matchesData ?? [];
    const upcomingMatches = useMemo(
        () => allMatches.filter((m) => m.status === "scheduled" || m.status === "upcoming"),
        [allMatches]
    );

    // Only approved players from this club
    const clubPlayers = useMemo(
        () => (playersData ?? []).filter(
            (p) => p.seasonClub?.club?.id === clubId && p.requestStatus === "approved"
        ),
        [playersData, clubId]
    );

    const openDialog = (match: Match) => {
        setSelectedMatch(match);
        setStarters(new Set());
        setSubstitutes(new Set());
        setPositions({});
        setCaptainId("");
        setApiErrors([]);
    };

    const closeDialog = () => {
        setSelectedMatch(null);
        setApiErrors([]);
    };

    const toggleStarter = (scpId: string) => {
        setStarters((prev) => {
            const next = new Set(prev);
            if (next.has(scpId)) {
                next.delete(scpId);
                if (captainId === scpId) setCaptainId("");
            } else {
                next.add(scpId);
                setSubstitutes((s) => { const ns = new Set(s); ns.delete(scpId); return ns; });
            }
            return next;
        });
    };

    const toggleSubstitute = (scpId: string) => {
        setSubstitutes((prev) => {
            const next = new Set(prev);
            if (next.has(scpId)) {
                next.delete(scpId);
            } else {
                next.add(scpId);
                setStarters((s) => { const ns = new Set(s); ns.delete(scpId); return ns; });
                if (captainId === scpId) setCaptainId("");
            }
            return next;
        });
    };

    const handleSubmit = async () => {
        if (!selectedMatch || !clubId) return;
        setApiErrors([]);

        const lineups: LineupEntry[] = [
            ...Array.from(starters).map((id) => ({
                seasonClubPlayerId: id,
                lineupType: "starting" as const,
                isCaptain: id === captainId,
                positionId: positions[id],
            })),
            ...Array.from(substitutes).map((id) => ({
                seasonClubPlayerId: id,
                lineupType: "substitute" as const,
                isCaptain: false,
                positionId: positions[id],
            })),
        ];

        setSubmitting(true);
        try {
            const res = await fetchWithAuth(`/api/matches/${selectedMatch.id}/lineups`, {
                method: "POST",
                body: JSON.stringify({ clubId, lineups }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (data.details && Array.isArray(data.details)) {
                    setApiErrors(data.details);
                } else {
                    setApiErrors([data.error || "Submission failed"]);
                }
                return;
            }

            toast.success("Lineup submitted successfully.");
            closeDialog();
        } catch {
            setApiErrors(["An unexpected error occurred."]);
        } finally {
            setSubmitting(false);
        }
    };

    const startersList = clubPlayers.filter((p) => starters.has(p.id));

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Lineup Submission"
                description="Submit your club's lineup for upcoming matches."
            />

            {isPending && (
                <div className="flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Club is pending approval. Lineup submission is disabled.
                </div>
            )}

            {/* Season selector */}
            {seasons.length > 0 && (
                <div className="flex items-center gap-3">
                    <Label className="text-sm shrink-0">Season</Label>
                    <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                        <SelectTrigger className="w-56">
                            <SelectValue placeholder="Select a season" />
                        </SelectTrigger>
                        <SelectContent>
                            {seasons.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                    {s.status === "active" && (
                                        <span className="ml-2 text-xs text-emerald-400">(active)</span>
                                    )}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {matchesError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Failed to load matches. Please try again.
                </div>
            )}

            {!selectedSeasonId ? (
                <Card>
                    <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                        Select a season to view matches.
                    </CardContent>
                </Card>
            ) : matchesLoading ? (
                <div className="flex flex-col gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-lg" />
                    ))}
                </div>
            ) : upcomingMatches.length === 0 ? (
                <Card>
                    <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                        No upcoming matches found for this season.
                    </CardContent>
                </Card>
            ) : (
                <div className="flex flex-col gap-3">
                    {upcomingMatches.map((match) => (
                        <Card key={match.id}>
                            <CardHeader className="pb-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex flex-col gap-1">
                                        <CardTitle className="text-base">
                                            {match.homeClub.name} vs {match.awayClub.name}
                                        </CardTitle>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(match.matchDate).toLocaleDateString(undefined, {
                                                    weekday: "short", year: "numeric", month: "short", day: "numeric",
                                                })}
                                            </span>
                                            <Badge variant="outline" className="text-[10px]">{match.status}</Badge>
                                            {match.roundNumber && <span>Round {match.roundNumber}</span>}
                                        </div>
                                    </div>
                                    <Button size="sm" disabled={isPending} onClick={() => openDialog(match)}>
                                        <Users className="mr-2 h-4 w-4" />
                                        Submit Lineup
                                    </Button>
                                </div>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            )}

            {/* Lineup Dialog */}
            <Dialog open={!!selectedMatch} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            Submit Lineup —{" "}
                            {selectedMatch ? `${selectedMatch.homeClub.name} vs ${selectedMatch.awayClub.name}` : ""}
                        </DialogTitle>
                    </DialogHeader>

                    {playersLoading ? (
                        <div className="flex flex-col gap-2 py-4">
                            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                        </div>
                    ) : clubPlayers.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            No approved players found for your club in this season.
                            Make sure players have been approved via the squad request flow.
                        </div>
                    ) : (
                        <ScrollArea className="max-h-[60vh] pr-2">
                            <div className="flex flex-col gap-6 py-2">
                                {/* Starters */}
                                <div>
                                    <p className="mb-2 text-sm font-semibold">Starters ({starters.size}/11)</p>
                                    <div className="flex flex-col gap-2">
                                        {clubPlayers.map((scp) => {
                                            const isStarter = starters.has(scp.id);
                                            const isSub = substitutes.has(scp.id);
                                            return (
                                                <div key={scp.id} className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${isStarter ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                                                    <input
                                                        type="checkbox"
                                                        id={`starter-${scp.id}`}
                                                        checked={isStarter}
                                                        disabled={!isStarter && starters.size >= 11}
                                                        onChange={() => toggleStarter(scp.id)}
                                                        className="h-4 w-4 accent-primary"
                                                    />
                                                    <label htmlFor={`starter-${scp.id}`} className="flex-1 cursor-pointer">
                                                        {scp.player.firstName} {scp.player.lastName}
                                                        {scp.jerseyNumber && <span className="ml-2 text-xs text-muted-foreground">#{scp.jerseyNumber}</span>}
                                                    </label>
                                                    {isStarter && (
                                                        <Select
                                                            value={positions[scp.id]?.toString() ?? ""}
                                                            onValueChange={(val) => setPositions((p) => ({ ...p, [scp.id]: parseInt(val) }))}
                                                        >
                                                            <SelectTrigger className="h-7 w-24 text-xs"><SelectValue placeholder="Position" /></SelectTrigger>
                                                            <SelectContent>
                                                                {POSITIONS.map((pos) => (
                                                                    <SelectItem key={pos.id} value={pos.id.toString()}>{pos.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                    {isSub && <Badge variant="secondary" className="text-[10px]">Sub</Badge>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Substitutes */}
                                <div>
                                    <p className="mb-2 text-sm font-semibold">Substitutes ({substitutes.size})</p>
                                    <div className="flex flex-col gap-2">
                                        {clubPlayers.filter((p) => !starters.has(p.id)).map((scp) => {
                                            const isSub = substitutes.has(scp.id);
                                            return (
                                                <div key={scp.id} className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${isSub ? "border-blue-500/40 bg-blue-500/5" : "border-border"}`}>
                                                    <input
                                                        type="checkbox"
                                                        id={`sub-${scp.id}`}
                                                        checked={isSub}
                                                        onChange={() => toggleSubstitute(scp.id)}
                                                        className="h-4 w-4 accent-primary"
                                                    />
                                                    <label htmlFor={`sub-${scp.id}`} className="flex-1 cursor-pointer">
                                                        {scp.player.firstName} {scp.player.lastName}
                                                        {scp.jerseyNumber && <span className="ml-2 text-xs text-muted-foreground">#{scp.jerseyNumber}</span>}
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Captain */}
                                {starters.size > 0 && (
                                    <div>
                                        <p className="mb-2 text-sm font-semibold">Captain</p>
                                        <Select value={captainId} onValueChange={setCaptainId}>
                                            <SelectTrigger><SelectValue placeholder="Select captain from starters" /></SelectTrigger>
                                            <SelectContent>
                                                {startersList.map((scp) => (
                                                    <SelectItem key={scp.id} value={scp.id}>
                                                        {scp.player.firstName} {scp.player.lastName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Errors */}
                                {apiErrors.length > 0 && (
                                    <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                        <p className="mb-1 font-medium">Validation errors:</p>
                                        <ul className="list-inside list-disc space-y-1">
                                            {apiErrors.map((err, i) => <li key={i}>{err}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog} disabled={submitting}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={submitting || playersLoading || clubPlayers.length === 0}>
                            {submitting ? "Submitting..." : "Submit Lineup"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
