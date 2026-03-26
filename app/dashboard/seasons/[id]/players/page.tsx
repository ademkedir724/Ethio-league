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
import { Plus, Trash2, Users } from "lucide-react";
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
    id: string;
    name: string;
}

interface SeasonClubPlayer {
    id: string;
    seasonClubId: string;
    playerId: string;
    jerseyNumber: number | null;
    positionId: string | null;
    player: Player;
    position: Position | null;
    seasonClub: {
        club: { id: string; name: string };
    };
}

const emptyForm = {
    playerId: "",
    jerseyNumber: "",
    positionId: "",
};

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

    const { data: allPlayers } = useSWR<Player[]>(
        open ? "/api/players" : null,
        authFetcher
    );

    const { data: positions } = useSWR<Position[]>(
        open ? "/api/players/positions" : null,
        authFetcher
    );

    // Filter players that belong to this club and aren't already assigned
    const availablePlayers = (allPlayers || []).filter(
        (p) => !assignedPlayerIds.has(p.id)
    );

    const isClubInactive = seasonClub.status !== "active";

    const handleSubmit = async () => {
        if (isClubInactive) {
            throw new Error("Club must be active in the season to assign players");
        }
        if (!form.playerId) {
            throw new Error("Please select a player");
        }

        const body: Record<string, unknown> = {
            clubId: seasonClub.clubId,
            playerId: form.playerId,
        };
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
                <Plus className="h-3.5 w-3.5" />
                Assign Player
            </Button>

            <FormDialog
                open={open}
                onOpenChange={(val) => {
                    setOpen(val);
                    if (!val) setForm(emptyForm);
                }}
                title={`Assign Player — ${seasonClub.club.name}`}
                description="Select a player and optionally set their jersey number and position for this season."
                submitLabel="Assign"
                onSubmit={handleSubmit}
            >
                {isClubInactive && (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        This club is not active in the season. Activate the club first.
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="assign-player">Player</Label>
                        <Select
                            value={form.playerId}
                            onValueChange={(val) => setForm({ ...form, playerId: val })}
                        >
                            <SelectTrigger id="assign-player">
                                <SelectValue placeholder="Select a player" />
                            </SelectTrigger>
                            <SelectContent>
                                {availablePlayers.length === 0 ? (
                                    <SelectItem value="_none" disabled>
                                        No available players
                                    </SelectItem>
                                ) : (
                                    availablePlayers.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.firstName} {p.lastName}
                                            {p.position ? ` — ${p.position}` : ""}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="assign-jersey">Jersey Number</Label>
                        <Input
                            id="assign-jersey"
                            type="number"
                            min={1}
                            max={99}
                            value={form.jerseyNumber}
                            onChange={(e) => setForm({ ...form, jerseyNumber: e.target.value })}
                            placeholder="e.g. 10"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="assign-position">Position</Label>
                        <Select
                            value={form.positionId}
                            onValueChange={(val) => setForm({ ...form, positionId: val })}
                        >
                            <SelectTrigger id="assign-position">
                                <SelectValue placeholder="Select position (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                {(positions || []).map((pos) => (
                                    <SelectItem key={pos.id} value={pos.id}>
                                        {pos.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </FormDialog>
        </>
    );
}

function ClubPlayerCard({
    seasonId,
    seasonClub,
    assignedPlayers,
    onMutate,
}: {
    seasonId: string;
    seasonClub: SeasonClub;
    assignedPlayers: SeasonClubPlayer[];
    onMutate: () => void;
}) {
    const [removing, setRemoving] = useState<string | null>(null);

    const assignedPlayerIds = new Set(assignedPlayers.map((scp) => scp.playerId));

    const handleRemove = async (scpId: string, playerName: string) => {
        setRemoving(scpId);
        try {
            const res = await fetchWithAuth(
                `/api/seasons/${seasonId}/players/${scpId}`,
                { method: "DELETE" }
            );
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to remove player");
            }
            toast.success(`${playerName} removed from season.`);
            onMutate();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Something went wrong.";
            toast.error(message);
        } finally {
            setRemoving(null);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
                <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{seasonClub.club.name}</CardTitle>
                    <StatusBadge status={seasonClub.status} />
                </div>
                <AssignPlayerDialog
                    seasonId={seasonId}
                    seasonClub={seasonClub}
                    assignedPlayerIds={assignedPlayerIds}
                    onSuccess={onMutate}
                />
            </CardHeader>
            <CardContent>
                {assignedPlayers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                        No players assigned yet.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">#</TableHead>
                                <TableHead>Player</TableHead>
                                <TableHead className="hidden sm:table-cell">Position</TableHead>
                                <TableHead className="w-16" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {assignedPlayers.map((scp) => (
                                <TableRow key={scp.id}>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {scp.jerseyNumber ?? "—"}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium">
                                        {scp.player.firstName} {scp.player.lastName}
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                                        {scp.position?.name ?? scp.player.position ?? "—"}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            disabled={removing === scp.id}
                                            onClick={() =>
                                                handleRemove(
                                                    scp.id,
                                                    `${scp.player.firstName} ${scp.player.lastName}`
                                                )
                                            }
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            <span className="sr-only">Remove</span>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

export default function SeasonPlayersPage() {
    const params = useParams();
    const seasonId = params.id as string;

    const {
        data: seasonClubs,
        isLoading: clubsLoading,
        error: clubsError,
    } = useSWR<SeasonClub[]>(
        seasonId ? `/api/seasons/${seasonId}/clubs` : null,
        authFetcher
    );

    const {
        data: seasonPlayers,
        isLoading: playersLoading,
        error: playersError,
    } = useSWR<SeasonClubPlayer[]>(
        seasonId ? `/api/seasons/${seasonId}/players` : null,
        authFetcher
    );

    const isLoading = clubsLoading || playersLoading;
    const error = clubsError || playersError;

    const handleMutate = () => {
        mutate(`/api/seasons/${seasonId}/players`);
    };

    // Group assigned players by seasonClubId
    const playersByClub = (seasonPlayers || []).reduce<
        Record<string, SeasonClubPlayer[]>
    >((acc, scp) => {
        const key = scp.seasonClubId;
        if (!acc[key]) acc[key] = [];
        acc[key].push(scp);
        return acc;
    }, {});

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Season Player Assignment"
                description="Assign players to clubs for this season."
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
                            <CardHeader className="pb-3">
                                <Skeleton className="h-5 w-48" />
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
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
                            assignedPlayers={playersByClub[sc.id] || []}
                            onMutate={handleMutate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
