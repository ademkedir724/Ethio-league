"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { FormDialog } from "@/components/dashboard/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Plus, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";

interface Club {
    id: string;
    name: string;
    shortName: string;
    status: string;
}

interface SeasonClub {
    id: string;
    seasonId: string;
    clubId: string;
    status: string;
    club: Club;
}

interface Player {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    nationality: string;
}

interface Position {
    id: number;
    name: string;
}

interface SeasonClubPlayer {
    id: string;
    seasonClubId: string;
    playerId: string;
    jerseyNumber: number | null;
    positionId: number | null;
    playerRole: string | null;
    requestStatus: string;
    player: Player;
    position: Position | null;
    seasonClub: { club: { id: string; name: string } };
}

// ── Direct-assign dialog (League Admin adds player without a club request) ──
const emptyForm = { playerId: "", jerseyNumber: "", positionId: "" };

function AssignPlayerDialog({
    seasonId,
    seasonClub,
    assignedPlayerIds,
    onSuccess,
}: {
    seasonId: string;
    seasonClub: SeasonClub;
    assignedPlayerIds: Set<string>;
    onSuccess: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const { data: allPlayers } = useSWR<Player[]>(open ? "/api/players" : null, authFetcher);
    const { data: positions } = useSWR<Position[]>(open ? "/api/players/positions" : null, authFetcher);

    const availablePlayers = (allPlayers || []).filter((p) => !assignedPlayerIds.has(p.id));
    const isClubInactive = seasonClub.status !== "active";

    const handleSubmit = async () => {
        if (isClubInactive) throw new Error("Club must be active in the season to assign players");
        if (!form.playerId) throw new Error("Please select a player");

        const body: Record<string, unknown> = { clubId: seasonClub.clubId, playerId: form.playerId };
        if (form.jerseyNumber) body.jerseyNumber = parseInt(form.jerseyNumber);
        if (form.positionId) body.positionId = form.positionId;

        const res = await fetchWithAuth(`/api/seasons/${seasonId}/players`, {
            method: "POST",
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to assign player");
        }
        toast.success("Player assigned successfully.");
        setForm(emptyForm);
        onSuccess();
    };

    return (
        <>
            <Button
                size="sm"
                variant="outline"
                onClick={() => setOpen(true)}
                disabled={isClubInactive}
                title={isClubInactive ? "Club must be active to assign players" : undefined}
            >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Direct Assign
            </Button>
            <FormDialog
                open={open}
                onOpenChange={(val) => { setOpen(val); if (!val) setForm(emptyForm); }}
                title={`Direct Assign — ${seasonClub.club.name}`}
                description="Assign a player directly (bypasses squad request flow)."
                submitLabel="Assign"
                onSubmit={handleSubmit}
            >
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <Label>Player</Label>
                        <Select value={form.playerId} onValueChange={(val) => setForm({ ...form, playerId: val })}>
                            <SelectTrigger><SelectValue placeholder="Select a player" /></SelectTrigger>
                            <SelectContent>
                                {availablePlayers.length === 0
                                    ? <SelectItem value="_none" disabled>No available players</SelectItem>
                                    : availablePlayers.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label>Jersey Number</Label>
                        <Input type="number" min={1} max={99} value={form.jerseyNumber}
                            onChange={(e) => setForm({ ...form, jerseyNumber: e.target.value })} placeholder="e.g. 10" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label>Position</Label>
                        <Select value={form.positionId} onValueChange={(val) => setForm({ ...form, positionId: val })}>
                            <SelectTrigger><SelectValue placeholder="Select position (optional)" /></SelectTrigger>
                            <SelectContent>
                                {(positions || []).map((pos) => (
                                    <SelectItem key={pos.id} value={String(pos.id)}>{pos.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </FormDialog>
        </>
    );
}

// ── Request status badge ──
function RequestBadge({ status }: { status: string }) {
    if (status === "approved") return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
    if (status === "rejected") return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
}

// ── Per-club card showing pending / approved / rejected players ──
function ClubPlayerCard({
    seasonId,
    seasonClub,
    allPlayers,
    onMutate,
}: {
    seasonId: string;
    seasonClub: SeasonClub;
    allPlayers: SeasonClubPlayer[];
    onMutate: () => void;
}) {
    const [acting, setActing] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);

    const assignedPlayerIds = new Set(allPlayers.map((p) => p.playerId));
    const pending = allPlayers.filter((p) => p.requestStatus === "pending");
    const approved = allPlayers.filter((p) => p.requestStatus === "approved");
    const rejected = allPlayers.filter((p) => p.requestStatus === "rejected");

    const handleReview = async (scpId: string, action: "approve" | "reject") => {
        setActing(scpId);
        try {
            const res = await fetchWithAuth(`/api/seasons/${seasonId}/players/${scpId}/review`, {
                method: "PATCH",
                body: JSON.stringify({ action }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to update request");
            }
            toast.success(`Player request ${action === "approve" ? "approved" : "rejected"}.`);
            onMutate();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setActing(null);
        }
    };

    const handleRemove = async (scpId: string) => {
        setRemoving(scpId);
        try {
            const res = await fetchWithAuth(`/api/seasons/${seasonId}/players/${scpId}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to remove player");
            }
            toast.success("Player removed from season.");
            onMutate();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setRemoving(null);
        }
    };

    const PlayerRow = ({ scp, showActions }: { scp: SeasonClubPlayer; showActions: boolean }) => (
        <TableRow key={scp.id}>
            <TableCell className="text-muted-foreground text-sm w-10">{scp.jerseyNumber ?? "—"}</TableCell>
            <TableCell className="text-sm font-medium">
                {scp.player.firstName} {scp.player.lastName}
            </TableCell>
            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                {scp.position?.name ?? "—"}
            </TableCell>
            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground capitalize">
                {scp.playerRole ?? "—"}
            </TableCell>
            <TableCell><RequestBadge status={scp.requestStatus} /></TableCell>
            <TableCell>
                <div className="flex items-center gap-1">
                    {showActions && (
                        <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700"
                                disabled={acting === scp.id} onClick={() => handleReview(scp.id, "approve")}
                                title="Approve">
                                <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600"
                                disabled={acting === scp.id} onClick={() => handleReview(scp.id, "reject")}
                                title="Reject">
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={removing === scp.id} onClick={() => handleRemove(scp.id)} title="Remove">
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );

    const PlayerTable = ({ players, showActions }: { players: SeasonClubPlayer[]; showActions: boolean }) => (
        players.length === 0
            ? <p className="text-sm text-muted-foreground py-2">None.</p>
            : <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead className="hidden sm:table-cell">Position</TableHead>
                        <TableHead className="hidden sm:table-cell">Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-24" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {players.map((scp) => <PlayerRow key={scp.id} scp={scp} showActions={showActions} />)}
                </TableBody>
            </Table>
    );

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
                <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{seasonClub.club.name}</CardTitle>
                    <StatusBadge status={seasonClub.status} />
                    {pending.length > 0 && (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">{pending.length} pending</Badge>
                    )}
                </div>
                <AssignPlayerDialog
                    seasonId={seasonId}
                    seasonClub={seasonClub}
                    assignedPlayerIds={assignedPlayerIds}
                    onSuccess={onMutate}
                />
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="pending">
                    <TabsList className="mb-3">
                        <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
                        <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
                        <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pending"><PlayerTable players={pending} showActions={true} /></TabsContent>
                    <TabsContent value="approved"><PlayerTable players={approved} showActions={false} /></TabsContent>
                    <TabsContent value="rejected"><PlayerTable players={rejected} showActions={true} /></TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

export default function SeasonPlayersPage() {
    const params = useParams();
    const seasonId = params.id as string;

    const { data: seasonClubs, isLoading: clubsLoading, error: clubsError } =
        useSWR<SeasonClub[]>(seasonId ? `/api/seasons/${seasonId}/clubs` : null, authFetcher);

    const { data: seasonPlayers, isLoading: playersLoading, error: playersError } =
        useSWR<SeasonClubPlayer[]>(seasonId ? `/api/seasons/${seasonId}/players` : null, authFetcher);

    const isLoading = clubsLoading || playersLoading;
    const error = clubsError || playersError;

    const handleMutate = () => mutate(`/api/seasons/${seasonId}/players`);

    const playersByClub = (seasonPlayers || []).reduce<Record<string, SeasonClubPlayer[]>>((acc, scp) => {
        const key = scp.seasonClubId;
        if (!acc[key]) acc[key] = [];
        acc[key].push(scp);
        return acc;
    }, {});

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Season Squad Management"
                description="Review pending squad requests and manage approved players per club."
            />

            {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Failed to load data. Please refresh.
                </div>
            )}

            {isLoading ? (
                <div className="flex flex-col gap-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <CardHeader className="pb-3"><Skeleton className="h-5 w-48" /></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : !seasonClubs || seasonClubs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                    <Users className="h-10 w-10 opacity-30" />
                    <p className="text-sm">No clubs registered in this season yet.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {seasonClubs.map((sc) => (
                        <ClubPlayerCard
                            key={sc.id}
                            seasonId={seasonId}
                            seasonClub={sc}
                            allPlayers={playersByClub[sc.id] || []}
                            onMutate={handleMutate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
