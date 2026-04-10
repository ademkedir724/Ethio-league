"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Player {
    id: string;
    firstName: string;
    lastName: string;
    clubId: string | null;
    primaryPosition?: { id: number; code: string; name: string } | null;
    originClub?: { id: string; name: string } | null;
}

interface Coach {
    id: string;
    firstName: string;
    lastName: string;
    clubId: string | null;
    licenseLevel?: string | null;
}

interface Position { id: number; code: string; name: string; }
interface SeasonClub { id: string; seasonId: string; clubId: string; status: string; }

interface SeasonClubPlayer {
    id: string;
    playerId: string;
    jerseyNumber: number | null;
    positionId: number | null;
    playerRole: string | null;
    requestStatus: string;
    player: Player;
    position: Position | null;
}

interface SeasonClubCoach {
    id: string;
    coachId: string;
    role: string;
    status: string;
    requestStatus: string;
    coach: Coach;
}

interface PlayerDraft {
    playerId: string;
    playerName: string;
    jerseyNumber: string;
    positionId: string;
    playerRole: string;
}

interface CoachDraft {
    coachId: string;
    coachName: string;
    role: string;
    status: string;
}

function RequestStatusBadge({ status }: { status: string }) {
    if (status === "approved") return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
    if (status === "rejected") return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
}

export default function SquadRequestPage() {
    const { getClubId } = useAuth();
    const clubId = getClubId();

    const { data: seasons } = useSWR<Array<{
        id: string; status: string;
        seasonClubs: Array<{ id: string; clubId: string; status: string }>;
    }>>(
        clubId ? `/api/seasons?clubId=${clubId}` : null, authFetcher
    );
    // Find the active (or first) season and the club's SeasonClub record within it
    const activeSeason = seasons?.find((s) => s.status === "active") ?? seasons?.[0];
    const seasonId = activeSeason?.id;
    const seasonClubId = activeSeason?.seasonClubs?.find((sc) => sc.clubId === clubId)?.id;

    // Club pool (players/coaches with clubId = this club)
    const { data: clubPlayers } = useSWR<Player[]>(clubId ? "/api/players" : null, authFetcher);
    const { data: clubCoaches } = useSWR<Coach[]>(clubId ? "/api/coaches" : null, authFetcher);
    const { data: positions } = useSWR<Position[]>("/api/players/positions", authFetcher);

    // Current season squad
    const { data: currentSquad } = useSWR<SeasonClubPlayer[]>(
        seasonId ? `/api/seasons/${seasonId}/players` : null, authFetcher
    );
    const { data: currentCoachSquad } = useSWR<SeasonClubCoach[]>(
        seasonId ? `/api/seasons/${seasonId}/coaches` : null, authFetcher
    );

    // Draft state
    const [playerDrafts, setPlayerDrafts] = useState<PlayerDraft[]>([]);
    const [coachDrafts, setCoachDrafts] = useState<CoachDraft[]>([]);
    const [submitting, setSubmitting] = useState(false);

    // Club pool search
    const [playerSearch, setPlayerSearch] = useState("");
    const [coachSearch, setCoachSearch] = useState("");

    // System-wide search (separate state — fires on demand)
    const [systemSearchInput, setSystemSearchInput] = useState("");
    const [systemSearchQuery, setSystemSearchQuery] = useState("");
    const { data: systemPlayers, isLoading: systemSearchLoading } = useSWR<Player[]>(
        systemSearchQuery.length >= 2
            ? `/api/players?scope=system&search=${encodeURIComponent(systemSearchQuery)}`
            : null,
        authFetcher
    );

    const alreadyRequestedPlayerIds = new Set(
        (currentSquad || []).filter((p) => p.requestStatus !== "rejected").map((p) => p.playerId)
    );
    const alreadyRequestedCoachIds = new Set(
        (currentCoachSquad || []).filter((c) => c.requestStatus !== "rejected").map((c) => c.coachId)
    );

    const addPlayerToDraft = (player: Player) => {
        if (playerDrafts.some((d) => d.playerId === player.id)) return toast.error("Already in draft");
        if (alreadyRequestedPlayerIds.has(player.id)) return toast.error("Already submitted or approved");
        setPlayerDrafts((prev) => [...prev, {
            playerId: player.id,
            playerName: `${player.firstName} ${player.lastName}`,
            jerseyNumber: "",
            positionId: player.primaryPosition ? String(player.primaryPosition.id) : "",
            playerRole: "starter",
        }]);
    };

    const addCoachToDraft = (coach: Coach) => {
        if (coachDrafts.some((d) => d.coachId === coach.id)) return toast.error("Already in draft");
        if (alreadyRequestedCoachIds.has(coach.id)) return toast.error("Already submitted or approved");
        setCoachDrafts((prev) => [...prev, {
            coachId: coach.id,
            coachName: `${coach.firstName} ${coach.lastName}`,
            role: "head_coach",
            status: "active",
        }]);
    };

    const updatePlayerDraft = (playerId: string, field: keyof PlayerDraft, value: string) =>
        setPlayerDrafts((prev) => prev.map((d) => d.playerId === playerId ? { ...d, [field]: value } : d));

    const updateCoachDraft = (coachId: string, field: keyof CoachDraft, value: string) =>
        setCoachDrafts((prev) => prev.map((d) => d.coachId === coachId ? { ...d, [field]: value } : d));

    const submitPlayerRequest = async () => {
        if (!seasonId || !seasonClubId) return toast.error("No active season found");
        if (playerDrafts.length === 0) return toast.error("No players in draft");
        for (const d of playerDrafts) {
            if (!d.jerseyNumber) return toast.error(`Jersey number required for ${d.playerName}`);
        }
        setSubmitting(true);
        try {
            const res = await fetchWithAuth(`/api/seasons/${seasonId}/squad-request/players`, {
                method: "POST",
                body: JSON.stringify({
                    players: playerDrafts.map((d) => ({
                        playerId: d.playerId,
                        jerseyNumber: parseInt(d.jerseyNumber),
                        positionId: d.positionId ? parseInt(d.positionId) : undefined,
                        playerRole: d.playerRole,
                        seasonClubId,
                    })),
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Submission failed");
            }
            toast.success(`${playerDrafts.length} player(s) submitted for review.`);
            setPlayerDrafts([]);
            mutate(`/api/seasons/${seasonId}/players`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    };

    const submitCoachRequest = async () => {
        if (!seasonId || !seasonClubId) return toast.error("No active season found");
        if (coachDrafts.length === 0) return toast.error("No coaches in draft");
        setSubmitting(true);
        try {
            const res = await fetchWithAuth(`/api/seasons/${seasonId}/squad-request/coaches`, {
                method: "POST",
                body: JSON.stringify({
                    coaches: coachDrafts.map((d) => ({
                        coachId: d.coachId,
                        role: d.role,
                        status: d.status,
                        seasonClubId,
                    })),
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Submission failed");
            }
            toast.success(`${coachDrafts.length} coach(es) submitted for review.`);
            setCoachDrafts([]);
            mutate(`/api/seasons/${seasonId}/coaches`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    };

    const filteredClubPlayers = (clubPlayers || []).filter((p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(playerSearch.toLowerCase())
    );
    const filteredClubCoaches = (clubCoaches || []).filter((c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(coachSearch.toLowerCase())
    );

    if (!clubId) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader title="Squad Request" description="Submit your season squad for League Admin approval." />
                <p className="text-sm text-muted-foreground">No club assigned to your account.</p>
            </div>
        );
    }

    const PlayerRow = ({ p }: { p: Player }) => (
        <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50">
            <span className="text-sm">
                {p.firstName} {p.lastName}
                {p.primaryPosition && <span className="text-muted-foreground ml-1">({p.primaryPosition.code})</span>}
                {p.originClub && <span className="text-muted-foreground ml-1 text-xs">— {p.originClub.name}</span>}
            </span>
            <Button size="sm" variant="ghost" className="h-6 px-2"
                disabled={alreadyRequestedPlayerIds.has(p.id) || playerDrafts.some((d) => d.playerId === p.id)}
                onClick={() => addPlayerToDraft(p)}>
                <Plus className="h-3 w-3" />
            </Button>
        </div>
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Squad Request" description="Build and submit your season squad for League Admin approval." />

            <Tabs defaultValue="players">
                <TabsList>
                    <TabsTrigger value="players">Players</TabsTrigger>
                    <TabsTrigger value="coaches">Coaches</TabsTrigger>
                </TabsList>

                {/* ── PLAYERS TAB ── */}
                <TabsContent value="players" className="flex flex-col gap-4 mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                        {/* Left: Player picker */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Select Players</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Tabs defaultValue="pool">
                                    <TabsList className="mb-3">
                                        <TabsTrigger value="pool">My Club Pool</TabsTrigger>
                                        <TabsTrigger value="last">Last Season</TabsTrigger>
                                        <TabsTrigger value="search">Search System</TabsTrigger>
                                    </TabsList>

                                    {/* My Club Pool */}
                                    <TabsContent value="pool">
                                        <Input placeholder="Filter by name..." value={playerSearch}
                                            onChange={(e) => setPlayerSearch(e.target.value)} className="mb-2" />
                                        <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
                                            {filteredClubPlayers.length === 0
                                                ? <p className="text-sm text-muted-foreground py-2">No players in your club pool.</p>
                                                : filteredClubPlayers.map((p) => <PlayerRow key={p.id} p={p} />)}
                                        </div>
                                    </TabsContent>

                                    {/* Last Season */}
                                    <TabsContent value="last">
                                        <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
                                            {(currentSquad || []).filter((scp) => scp.requestStatus === "approved").length === 0
                                                ? <p className="text-sm text-muted-foreground py-2">No approved players from last season.</p>
                                                : (currentSquad || [])
                                                    .filter((scp) => scp.requestStatus === "approved")
                                                    .map((scp) => <PlayerRow key={scp.id} p={scp.player} />)}
                                        </div>
                                    </TabsContent>

                                    {/* Search System — searches ALL players system-wide */}
                                    <TabsContent value="search">
                                        <div className="flex gap-2 mb-2">
                                            <Input
                                                placeholder="Search all players by name..."
                                                value={systemSearchInput}
                                                onChange={(e) => setSystemSearchInput(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === "Enter" && systemSearchInput.length >= 2) setSystemSearchQuery(systemSearchInput); }}
                                            />
                                            <Button size="sm" variant="outline"
                                                disabled={systemSearchInput.length < 2}
                                                onClick={() => setSystemSearchQuery(systemSearchInput)}>
                                                Search
                                            </Button>
                                        </div>
                                        {systemSearchQuery.length < 2 ? (
                                            <p className="text-sm text-muted-foreground py-2">Type at least 2 characters and press Search.</p>
                                        ) : systemSearchLoading ? (
                                            <p className="text-sm text-muted-foreground py-2">Searching...</p>
                                        ) : !systemPlayers || systemPlayers.length === 0 ? (
                                            <p className="text-sm text-muted-foreground py-2">No players found for "{systemSearchQuery}".</p>
                                        ) : (
                                            <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
                                                {systemPlayers.map((p) => <PlayerRow key={p.id} p={p} />)}
                                            </div>
                                        )}
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>

                        {/* Right: Draft list */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <CardTitle className="text-base">Draft ({playerDrafts.length})</CardTitle>
                                <Button size="sm" disabled={playerDrafts.length === 0 || submitting} onClick={submitPlayerRequest}>
                                    <Send className="h-3.5 w-3.5 mr-1" />
                                    Submit to League Admin
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {playerDrafts.length === 0
                                    ? <p className="text-sm text-muted-foreground py-2">Add players from the left panel.</p>
                                    : <div className="flex flex-col gap-3">
                                        {playerDrafts.map((d) => (
                                            <div key={d.playerId} className="border rounded-md p-3 flex flex-col gap-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium">{d.playerName}</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                        onClick={() => setPlayerDrafts((prev) => prev.filter((x) => x.playerId !== d.playerId))}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <Label className="text-xs">Jersey #</Label>
                                                        <Input type="number" min={1} max={99} value={d.jerseyNumber}
                                                            onChange={(e) => updatePlayerDraft(d.playerId, "jerseyNumber", e.target.value)}
                                                            placeholder="e.g. 10" className="h-7 text-xs" />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Position</Label>
                                                        <Select value={d.positionId} onValueChange={(v) => updatePlayerDraft(d.playerId, "positionId", v)}>
                                                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Pos" /></SelectTrigger>
                                                            <SelectContent>
                                                                {(positions || []).map((pos) => (
                                                                    <SelectItem key={pos.id} value={String(pos.id)}>{pos.code}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Role</Label>
                                                        <Select value={d.playerRole} onValueChange={(v) => updatePlayerDraft(d.playerId, "playerRole", v)}>
                                                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="starter">Starter</SelectItem>
                                                                <SelectItem value="reserve">Reserve</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Current squad status */}
                    {currentSquad && currentSquad.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Current Season Squad Status</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-10">#</TableHead>
                                            <TableHead>Player</TableHead>
                                            <TableHead className="hidden sm:table-cell">Position</TableHead>
                                            <TableHead className="hidden sm:table-cell">Role</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentSquad.map((scp) => (
                                            <TableRow key={scp.id}>
                                                <TableCell className="text-muted-foreground text-sm">{scp.jerseyNumber ?? "—"}</TableCell>
                                                <TableCell className="text-sm font-medium">{scp.player.firstName} {scp.player.lastName}</TableCell>
                                                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{scp.position?.name ?? "—"}</TableCell>
                                                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground capitalize">{scp.playerRole ?? "—"}</TableCell>
                                                <TableCell><RequestStatusBadge status={scp.requestStatus} /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ── COACHES TAB ── */}
                <TabsContent value="coaches" className="flex flex-col gap-4 mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Select Coaches</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Input placeholder="Filter by name..." value={coachSearch}
                                    onChange={(e) => setCoachSearch(e.target.value)} className="mb-2" />
                                <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
                                    {filteredClubCoaches.length === 0
                                        ? <p className="text-sm text-muted-foreground py-2">No coaches in your club pool.</p>
                                        : filteredClubCoaches.map((c) => (
                                            <div key={c.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50">
                                                <span className="text-sm">
                                                    {c.firstName} {c.lastName}
                                                    {c.licenseLevel && <span className="text-muted-foreground ml-1">({c.licenseLevel})</span>}
                                                </span>
                                                <Button size="sm" variant="ghost" className="h-6 px-2"
                                                    disabled={alreadyRequestedCoachIds.has(c.id) || coachDrafts.some((d) => d.coachId === c.id)}
                                                    onClick={() => addCoachToDraft(c)}>
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <CardTitle className="text-base">Draft ({coachDrafts.length})</CardTitle>
                                <Button size="sm" disabled={coachDrafts.length === 0 || submitting} onClick={submitCoachRequest}>
                                    <Send className="h-3.5 w-3.5 mr-1" />
                                    Submit to League Admin
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {coachDrafts.length === 0
                                    ? <p className="text-sm text-muted-foreground py-2">Add coaches from the left panel.</p>
                                    : <div className="flex flex-col gap-3">
                                        {coachDrafts.map((d) => (
                                            <div key={d.coachId} className="border rounded-md p-3 flex flex-col gap-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium">{d.coachName}</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                        onClick={() => setCoachDrafts((prev) => prev.filter((x) => x.coachId !== d.coachId))}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <Label className="text-xs">Season Role</Label>
                                                        <Select value={d.role} onValueChange={(v) => updateCoachDraft(d.coachId, "role", v)}>
                                                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="head_coach">Head Coach</SelectItem>
                                                                <SelectItem value="assistant_coach">Assistant Coach</SelectItem>
                                                                <SelectItem value="goalkeeping_coach">Goalkeeping Coach</SelectItem>
                                                                <SelectItem value="fitness_coach">Fitness Coach</SelectItem>
                                                                <SelectItem value="medical_staff">Medical Staff</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Status</Label>
                                                        <Select value={d.status} onValueChange={(v) => updateCoachDraft(d.coachId, "status", v)}>
                                                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="active">Active</SelectItem>
                                                                <SelectItem value="reserve">Reserve</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Current coach squad status */}
                    {currentCoachSquad && currentCoachSquad.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Current Season Coach Squad Status</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Coach</TableHead>
                                            <TableHead className="hidden sm:table-cell">Role</TableHead>
                                            <TableHead className="hidden sm:table-cell">Status</TableHead>
                                            <TableHead>Request</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentCoachSquad.map((scc) => (
                                            <TableRow key={scc.id}>
                                                <TableCell className="text-sm font-medium">{scc.coach.firstName} {scc.coach.lastName}</TableCell>
                                                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground capitalize">{scc.role.replace(/_/g, " ")}</TableCell>
                                                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground capitalize">{scc.status}</TableCell>
                                                <TableCell><RequestStatusBadge status={scc.requestStatus} /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div >
    );
}
