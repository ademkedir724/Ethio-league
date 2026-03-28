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
import { ChevronLeft, Plus, Shield, Users, Check, X, UserCircle } from "lucide-react";

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
                    <p className="text-xs text-muted-foreground mb-1">Format</p>
                    <p className="text-sm font-medium capitalize">{season.roundRobinType ?? "double"} round-robin</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Round Gap</p>
                    <p className="text-sm font-medium">{season.daysBetweenRounds ? `${season.daysBetweenRounds} days` : "—"}</p>
                </CardContent></Card>
            </div>

            {/* Role-specific tabs */}
            {isLeagueAdmin() && <LeagueAdminSeasonTabs seasonId={seasonId} season={season} />}
            {isClubAdmin() && <ClubAdminSeasonView seasonId={seasonId} clubId={getClubId() ?? ""} />}
        </div>
    );
}

// ─── League Admin Tabs ────────────────────────────────────────────────────────

function LeagueAdminSeasonTabs({ seasonId, season }: { seasonId: string; season: Season }) {
    return (
        <Tabs defaultValue="clubs">
            <TabsList>
                <TabsTrigger value="clubs">Clubs</TabsTrigger>
                <TabsTrigger value="players">Players</TabsTrigger>
            </TabsList>
            <TabsContent value="clubs">
                <SeasonClubsTab seasonId={seasonId} season={season} />
            </TabsContent>
            <TabsContent value="players">
                <SeasonPlayersTab seasonId={seasonId} />
            </TabsContent>
        </Tabs>
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
    const { data: allClubs } = useSWR<Club[]>("/api/clubs", authFetcher);

    const [addOpen, setAddOpen] = useState(false);
    const [selectedClubId, setSelectedClubId] = useState("");
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

    const handleAdd = async () => {
        if (!selectedClubId) { toast.error("Select a club"); return; }
        setIsSaving(true);
        try {
            const res = await fetchWithAuth(`/api/seasons/${seasonId}/clubs`, {
                method: "POST",
                body: JSON.stringify({ clubId: selectedClubId }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                toast.error(d.error || "Failed to add club");
                return;
            }
            toast.success("Club added to season");
            setAddOpen(false);
            setSelectedClubId("");
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
                <Button size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Add Club
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
                                <div>
                                    <p className="text-sm font-medium">{sc.club.name}</p>
                                    <p className="text-xs text-muted-foreground">{sc._count.players} players</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge status={sc.status} />
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

            {/* Add Club Dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Add Club to Season</DialogTitle>
                        <DialogDescription>Select a club from your league to add to this season.</DialogDescription>
                    </DialogHeader>
                    <Select value={selectedClubId || "none"} onValueChange={(v) => setSelectedClubId(v === "none" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Select a club" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Select a club</SelectItem>
                            {availableClubs.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {availableClubs.length === 0 && (
                        <p className="text-xs text-muted-foreground">All clubs are already assigned to this season.</p>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleAdd} disabled={isSaving || !selectedClubId}>
                            {isSaving ? "Adding..." : "Add Club"}
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

// ─── Club Admin Season View ───────────────────────────────────────────────────

function ClubAdminSeasonView({ seasonId, clubId }: { seasonId: string; clubId: string }) {
    const { data: allPlayers } = useSWR<Array<{ id: string; firstName: string; lastName: string; primaryPosition?: { id: number; name: string } | null }>>("/api/players", authFetcher);
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
