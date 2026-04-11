"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle, Pencil } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Match {
    id: string;
    homeClub: { id: string; name: string; shortName?: string | null };
    awayClub: { id: string; name: string; shortName?: string | null };
    homeClubId: string;
    awayClubId: string;
    homeScore: number | null;
    awayScore: number | null;
    matchDate: string;
    stadium: { id: string; name: string } | null;
    status: string;
    season: { id: string; name: string };
    roundNumber: number | null;
    matchReferees?: Array<{
        id: string;
        role: string;
        referee: { id: string; firstName: string; lastName: string };
    }>;
    matchMEAs?: Array<{
        id: string;
        user: { id: string; fullName: string; email: string };
    }>;
}

interface EventType {
    id: string;
    name: string;
    description?: string | null;
}

interface MatchEvent {
    id: string;
    minute: number;
    extraTime?: number | null;
    description?: string | null;
    createdAt: string;
    eventType: { id: string; name: string };
    player: { id: string; firstName: string; lastName: string } | null;
    relatedPlayer: { id: string; firstName: string; lastName: string } | null;
    club: { id: string; name: string } | null;
}

interface LineupEntry {
    id: string;
    lineupType: string;
    shirtNumber?: number | null;
    isCaptain: boolean;
    seasonClubPlayer: {
        player: { id: string; firstName: string; lastName: string };
        seasonClub: { club: { id: string; name: string } };
    };
    position?: { name: string } | null;
}

const emptyEventForm = {
    eventTypeId: "",
    playerId: "",
    clubSide: "home" as "home" | "away",
    minute: "",
    extraTime: "",
    description: "",
    relatedPlayerId: "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchDetailPage() {
    const router = useRouter();
    const params = useParams();
    const matchId = params.id as string;
    const { isMEA, isLeagueAdmin, isSuperAdmin } = useAuth();

    // ── Data fetching ──────────────────────────────────────────────────────────
    const {
        data: match,
        isLoading: matchLoading,
        error: matchError,
        mutate: mutateMatch,
    } = useSWR<Match>(`/api/matches/${matchId}`, authFetcher);

    const { data: lineups = [], isLoading: lineupsLoading } = useSWR<LineupEntry[]>(
        `/api/matches/${matchId}/lineups`,
        authFetcher
    );

    const {
        data: events = [],
        mutate: mutateEvents,
    } = useSWR<MatchEvent[]>(
        `/api/match-events?matchId=${matchId}`,
        authFetcher,
        { refreshInterval: match?.status === "live" ? 10000 : 0 }
    );

    const { data: eventTypes = [] } = useSWR<EventType[]>(
        "/api/match-events/event-types",
        authFetcher
    );

    // ── State ──────────────────────────────────────────────────────────────────
    const [approving, setApproving] = useState(false);
    const [eventForm, setEventForm] = useState(emptyEventForm);
    const [submittingEvent, setSubmittingEvent] = useState(false);
    const [editingEvent, setEditingEvent] = useState<MatchEvent | null>(null);
    const [editForm, setEditForm] = useState<Partial<typeof emptyEventForm>>({});
    const [savingEdit, setSavingEdit] = useState(false);

    // ── Derived ────────────────────────────────────────────────────────────────
    const isWithin24h = match
        ? new Date(match.matchDate).getTime() - Date.now() <= 24 * 60 * 60 * 1000
        : false;

    const canApprove =
        (match?.status === "scheduled" || match?.status === "upcoming") &&
        isWithin24h &&
        isMEA();

    const canLogEvents = match?.status === "live" && (isMEA() || isLeagueAdmin() || isSuperAdmin());

    const homeLineup = lineups.filter(
        (l) => l.seasonClubPlayer.seasonClub.club.id === match?.homeClub?.id
    );
    const awayLineup = lineups.filter(
        (l) => l.seasonClubPlayer.seasonClub.club.id === match?.awayClub?.id
    );

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleApprove = async () => {
        setApproving(true);
        try {
            const res = await fetchWithAuth(`/api/matches/${matchId}/approve`, { method: "POST" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Failed to approve match");
                return;
            }
            toast.success("Match approved");
            mutateMatch();
        } catch {
            toast.error("Failed to approve match");
        } finally {
            setApproving(false);
        }
    };

    const handleLogEvent = async () => {
        if (!match) return;
        setSubmittingEvent(true);
        try {
            const clubId =
                eventForm.clubSide === "home" ? match.homeClub?.id : match.awayClub?.id;
            const res = await fetchWithAuth("/api/match-events", {
                method: "POST",
                body: JSON.stringify({
                    matchId,
                    eventTypeId: eventForm.eventTypeId,
                    playerId: eventForm.playerId,
                    relatedPlayerId: eventForm.relatedPlayerId || undefined,
                    clubId,
                    minute: Number(eventForm.minute),
                    extraTime: eventForm.extraTime ? Number(eventForm.extraTime) : undefined,
                    description: eventForm.description || undefined,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Failed to log event");
                return;
            }
            toast.success("Event logged");
            setEventForm(emptyEventForm);
            mutateEvents();
            mutateMatch();
        } catch {
            toast.error("Failed to log event");
        } finally {
            setSubmittingEvent(false);
        }
    };

    const openEditEvent = (event: MatchEvent) => {
        setEditingEvent(event);
        setEditForm({
            eventTypeId: event.eventType.id,
            playerId: event.player?.id || "",
            clubSide: event.club?.id === match?.homeClubId ? "home" : "away",
            minute: String(event.minute),
            extraTime: event.extraTime ? String(event.extraTime) : "",
            description: event.description || "",
            relatedPlayerId: event.relatedPlayer?.id || "",
        });
    };

    const handleSaveEdit = async () => {
        if (!editingEvent || !match) return;
        setSavingEdit(true);
        try {
            const clubId =
                editForm.clubSide === "home" ? match.homeClub?.id : match.awayClub?.id;
            const res = await fetchWithAuth(`/api/match-events/${editingEvent.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                    eventTypeId: editForm.eventTypeId,
                    playerId: editForm.playerId,
                    relatedPlayerId: editForm.relatedPlayerId || undefined,
                    clubId,
                    minute: editForm.minute ? Number(editForm.minute) : undefined,
                    extraTime: editForm.extraTime ? Number(editForm.extraTime) : undefined,
                    description: editForm.description || undefined,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Failed to update event");
                return;
            }
            toast.success("Event updated");
            setEditingEvent(null);
            mutateEvents();
        } catch {
            toast.error("Failed to update event");
        } finally {
            setSavingEdit(false);
        }
    };

    const canEditEvent = (event: MatchEvent) => {
        if (isLeagueAdmin() || isSuperAdmin()) return true;
        if (isMEA()) {
            const elapsed = Date.now() - new Date(event.createdAt).getTime();
            return elapsed <= 10 * 60 * 1000;
        }
        return false;
    };

    // ── Loading / Error ────────────────────────────────────────────────────────
    if (matchError) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader title="Match Detail">
                    <Button variant="outline" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                </PageHeader>
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Failed to load match. Please try again.
                </div>
            </div>
        );
    }

    if (matchLoading || !match) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader title="Match Detail">
                    <Button variant="outline" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                </PageHeader>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex flex-col gap-4">
                            <Skeleton className="h-10 w-64" />
                            <Skeleton className="h-6 w-40" />
                            <Skeleton className="h-6 w-32" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const matchTitle = `${match.homeClub?.name} vs ${match.awayClub?.name}`;
    const matchDate = new Date(match.matchDate).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <PageHeader title={matchTitle} description={`${match.season?.name ?? ""}`}>
                <Button variant="outline" size="sm" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>
            </PageHeader>

            {/* Match header card */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                        <div className="flex flex-col items-center gap-1 sm:items-start">
                            <span className="text-lg font-semibold text-foreground">{match.homeClub?.name}</span>
                            <span className="text-xs text-muted-foreground">Home</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="font-mono text-4xl font-bold text-foreground">
                                {match.homeScore !== null && match.awayScore !== null
                                    ? `${match.homeScore} – ${match.awayScore}`
                                    : "– vs –"}
                            </span>
                            <StatusBadge status={match.status} />
                            <span className="text-xs text-muted-foreground">{matchDate}</span>
                            {match.stadium && (
                                <span className="text-xs text-muted-foreground">{match.stadium?.name}</span>
                            )}
                        </div>
                        <div className="flex flex-col items-center gap-1 sm:items-end">
                            <span className="text-lg font-semibold text-foreground">{match.awayClub?.name}</span>
                            <span className="text-xs text-muted-foreground">Away</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Referees + MEA */}
            {((match.matchReferees && match.matchReferees.length > 0) || (match.matchMEAs && match.matchMEAs.length > 0)) && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Match Officials</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {match.matchReferees && match.matchReferees.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Referees</p>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {match.matchReferees.map((mr) => (
                                        <div key={mr.id} className="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2">
                                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                {mr.role.replace(/_/g, " ")}
                                            </span>
                                            <span className="text-sm font-medium">
                                                {mr.referee.firstName} {mr.referee.lastName}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {match.matchMEAs && match.matchMEAs.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Match Event Admin</p>
                                <div className="flex flex-wrap gap-2">
                                    {match.matchMEAs.map((m) => (
                                        <div key={m.id} className="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2">
                                            <span className="text-sm font-medium">{m.user.fullName}</span>
                                            <span className="text-xs text-muted-foreground">{m.user.email}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Two-column grid: events + lineups */}
            <div className="grid gap-6 lg:grid-cols-2">                {/* Event Log */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Event Log</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {events.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No events recorded yet.</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {[...events]
                                    .sort((a, b) => a.minute - b.minute)
                                    .map((event) => (
                                        <div
                                            key={event.id}
                                            className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                                        >
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                                                        {event.minute}&apos;
                                                        {event.extraTime ? `+${event.extraTime}` : ""}
                                                    </span>
                                                    <span className="font-medium capitalize text-foreground">
                                                        {event.eventType.name.replace(/_/g, " ")}
                                                    </span>
                                                </div>
                                                {event.player && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {event.player.firstName} {event.player.lastName}
                                                        {event.club ? ` · ${event.club.name}` : ""}
                                                    </span>
                                                )}
                                                {event.relatedPlayer && (
                                                    <span className="text-xs text-muted-foreground">
                                                        ↔ {event.relatedPlayer.firstName} {event.relatedPlayer.lastName}
                                                    </span>
                                                )}
                                                {event.description && (
                                                    <span className="text-xs text-muted-foreground italic">
                                                        {event.description}
                                                    </span>
                                                )}
                                            </div>
                                            {canEditEvent(event) && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 shrink-0 text-muted-foreground"
                                                    onClick={() => openEditEvent(event)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                    <span className="sr-only">Edit event</span>
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Lineups */}
                <div className="flex flex-col gap-4">
                    <LineupPanel
                        title={`${match.homeClub?.name} Lineup`}
                        entries={homeLineup}
                        isLoading={lineupsLoading}
                    />
                    <LineupPanel
                        title={`${match.awayClub?.name} Lineup`}
                        entries={awayLineup}
                        isLoading={lineupsLoading}
                    />
                </div>
            </div>

            {/* Bottom section: Approve or Event Logging */}
            {canApprove && (
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-foreground">Match Approval</p>
                                <p className="text-xs text-muted-foreground">
                                    Approve this match to confirm it is ready to proceed.
                                </p>
                            </div>
                            <Button onClick={handleApprove} disabled={approving}>
                                <CheckCircle className="h-4 w-4" />
                                {approving ? "Approving..." : "Approve Match"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {canLogEvents && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Log Event</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {/* Event Type */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="evt-type">Event Type</Label>
                                <Select
                                    value={eventForm.eventTypeId}
                                    onValueChange={(v) => setEventForm({ ...eventForm, eventTypeId: v })}
                                >
                                    <SelectTrigger id="evt-type">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {eventTypes.map((et) => (
                                            <SelectItem key={et.id} value={et.id}>
                                                {et.name.replace(/_/g, " ")}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Club */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="evt-club">Club</Label>
                                <Select
                                    value={eventForm.clubSide}
                                    onValueChange={(v) =>
                                        setEventForm({ ...eventForm, clubSide: v as "home" | "away" })
                                    }
                                >
                                    <SelectTrigger id="evt-club">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="home">{match.homeClub?.name} (Home)</SelectItem>
                                        <SelectItem value="away">{match.awayClub?.name} (Away)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Player ID */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="evt-player">Player ID</Label>
                                <Input
                                    id="evt-player"
                                    value={eventForm.playerId}
                                    onChange={(e) => setEventForm({ ...eventForm, playerId: e.target.value })}
                                    placeholder="Player UUID"
                                />
                            </div>

                            {/* Minute */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="evt-minute">Minute</Label>
                                <Input
                                    id="evt-minute"
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={eventForm.minute}
                                    onChange={(e) => setEventForm({ ...eventForm, minute: e.target.value })}
                                    placeholder="45"
                                />
                            </div>

                            {/* Extra Time */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="evt-extra">Extra Time (optional)</Label>
                                <Input
                                    id="evt-extra"
                                    type="number"
                                    min={0}
                                    value={eventForm.extraTime}
                                    onChange={(e) => setEventForm({ ...eventForm, extraTime: e.target.value })}
                                    placeholder="0"
                                />
                            </div>

                            {/* Related Player */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="evt-related">Related Player ID (optional)</Label>
                                <Input
                                    id="evt-related"
                                    value={eventForm.relatedPlayerId}
                                    onChange={(e) =>
                                        setEventForm({ ...eventForm, relatedPlayerId: e.target.value })
                                    }
                                    placeholder="For substitutions"
                                />
                            </div>

                            {/* Description */}
                            <div className="flex flex-col gap-2 sm:col-span-2">
                                <Label htmlFor="evt-desc">Description (optional)</Label>
                                <Input
                                    id="evt-desc"
                                    value={eventForm.description}
                                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                                    placeholder="Additional notes..."
                                />
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <Button
                                onClick={handleLogEvent}
                                disabled={
                                    submittingEvent ||
                                    !eventForm.eventTypeId ||
                                    !eventForm.playerId ||
                                    !eventForm.minute
                                }
                            >
                                {submittingEvent ? "Logging..." : "Log Event"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Edit Event Dialog */}
            <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Event</DialogTitle>
                        <DialogDescription>Update the match event details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <Label>Event Type</Label>
                            <Select
                                value={editForm.eventTypeId}
                                onValueChange={(v) => setEditForm({ ...editForm, eventTypeId: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {eventTypes.map((et) => (
                                        <SelectItem key={et.id} value={et.id}>
                                            {et.name.replace(/_/g, " ")}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label>Club</Label>
                            <Select
                                value={editForm.clubSide}
                                onValueChange={(v) =>
                                    setEditForm({ ...editForm, clubSide: v as "home" | "away" })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="home">{match.homeClub?.name} (Home)</SelectItem>
                                    <SelectItem value="away">{match.awayClub?.name} (Away)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label>Player ID</Label>
                            <Input
                                value={editForm.playerId}
                                onChange={(e) => setEditForm({ ...editForm, playerId: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label>Minute</Label>
                            <Input
                                type="number"
                                value={editForm.minute}
                                onChange={(e) => setEditForm({ ...editForm, minute: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label>Extra Time</Label>
                            <Input
                                type="number"
                                value={editForm.extraTime}
                                onChange={(e) => setEditForm({ ...editForm, extraTime: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label>Related Player ID</Label>
                            <Input
                                value={editForm.relatedPlayerId}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, relatedPlayerId: e.target.value })
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-2 sm:col-span-2">
                            <Label>Description</Label>
                            <Input
                                value={editForm.description}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingEvent(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={savingEdit}>
                            {savingEdit ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Lineup Panel ─────────────────────────────────────────────────────────────

function LineupPanel({
    title,
    entries,
    isLoading,
}: {
    title: string;
    entries: LineupEntry[];
    isLoading: boolean;
}) {
    const starters = entries.filter((e) => e.lineupType === "starting");
    const subs = entries.filter((e) => e.lineupType === "substitute");

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-5 w-full" />
                        ))}
                    </div>
                ) : entries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No lineup submitted.</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {starters.length > 0 && (
                            <div>
                                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Starting XI
                                </p>
                                <div className="flex flex-col gap-1">
                                    {starters.map((e) => (
                                        <PlayerRow key={e.id} entry={e} />
                                    ))}
                                </div>
                            </div>
                        )}
                        {subs.length > 0 && (
                            <div>
                                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Substitutes
                                </p>
                                <div className="flex flex-col gap-1">
                                    {subs.map((e) => (
                                        <PlayerRow key={e.id} entry={e} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function PlayerRow({ entry }: { entry: LineupEntry }) {
    const { player } = entry.seasonClubPlayer;
    return (
        <div className="flex items-center gap-2 text-sm">
            {entry.shirtNumber && (
                <span className="w-6 text-right font-mono text-xs text-muted-foreground">
                    {entry.shirtNumber}
                </span>
            )}
            <span className="text-foreground">
                {player.firstName} {player.lastName}
                {entry.isCaptain && (
                    <span className="ml-1 text-xs text-amber-400">(C)</span>
                )}
            </span>
            {entry.position && (
                <span className="ml-auto text-xs text-muted-foreground">{entry.position.name}</span>
            )}
        </div>
    );
}
