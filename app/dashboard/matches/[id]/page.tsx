"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { useFormValidation } from "@/lib/use-form-validation";
import { validateRequired, validateInteger, validateLength } from "@/lib/validation";
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
import { ArrowLeft, CheckCircle, Pencil, Play, Square, Goal, ArrowLeftRight, CircleAlert, Video, X, Trash2 } from "lucide-react";
import { ImageGallery } from "@/components/dashboard/image-gallery";
import { MediaUploadWidget } from "@/components/dashboard/media-upload-widget";

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
    liveStartedAt?: string | null;
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

interface MatchMedia {
    id: string;
    mediaUrl: string;
    mediaType: "image" | "video";
    caption?: string | null;
    sortOrder: number;
}

// Determine what fields an event type needs
function getEventCategory(typeName: string): "goal" | "substitution" | "card" | "simple" {
    const n = typeName.toLowerCase();
    if (n.includes("goal") || n.includes("penalty")) return "goal";
    if (n.includes("substitut")) return "substitution";
    if (n.includes("card")) return "card";
    return "simple";
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

// ─── Validation functions ──────────────────────────────────────────────────────

function validateEventForm(values: typeof emptyEventForm, eventCategory: string) {
    const errors: Partial<Record<keyof typeof emptyEventForm, string>> = {};
    errors.eventTypeId = validateRequired(values.eventTypeId, "Event type") ?? undefined;
    errors.clubSide = validateRequired(values.clubSide, "Club side") ?? undefined;
    errors.playerId = validateRequired(values.playerId, "Player") ?? undefined;
    errors.minute = validateInteger(values.minute, 0, 120, "Minute") ?? undefined;
    errors.extraTime = validateInteger(values.extraTime, 0, 30, "Extra time") ?? undefined;
    errors.description = validateLength(values.description, 0, 255, "Description") ?? undefined;
    if (eventCategory === "substitution") {
        errors.relatedPlayerId = validateRequired(values.relatedPlayerId, "Substitute player") ?? undefined;
    }
    return errors;
}

function validateScoreForm(values: { homeScore: string; awayScore: string }) {
    return {
        homeScore: validateRequired(values.homeScore, "Home score") ?? validateInteger(values.homeScore, 0, 99, "Home score") ?? undefined,
        awayScore: validateRequired(values.awayScore, "Away score") ?? validateInteger(values.awayScore, 0, 99, "Away score") ?? undefined,
    };
}

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

    const {
        data: matchMedia = [],
        mutate: mutateMedia,
    } = useSWR<MatchMedia[]>(`/api/matches/${matchId}/media`, authFetcher);

    // ── State ──────────────────────────────────────────────────────────────────
    const [approving, setApproving] = useState(false);
    const [eventForm, setEventForm] = useState(emptyEventForm);
    const [submittingEvent, setSubmittingEvent] = useState(false);
    const [editingEvent, setEditingEvent] = useState<MatchEvent | null>(null);
    const [editForm, setEditForm] = useState<Partial<typeof emptyEventForm>>({});
    const [savingEdit, setSavingEdit] = useState(false);
    const [deletingEvent, setDeletingEvent] = useState(false);
    const [editingScore, setEditingScore] = useState(false);
    const [scoreForm, setScoreForm] = useState({ homeScore: "", awayScore: "" });
    const [savingScore, setSavingScore] = useState(false);
    const [startingGame, setStartingGame] = useState(false);
    const [elapsedMinutes, setElapsedMinutes] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Live timer — updates every second for accurate minute display ──────────
    useEffect(() => {
        if (match?.status === "live" && match.liveStartedAt) {
            const update = () => {
                const elapsed = Math.floor((Date.now() - new Date(match.liveStartedAt!).getTime()) / 60000);
                setElapsedMinutes(elapsed);
            };
            update();
            timerRef.current = setInterval(update, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [match?.status, match?.liveStartedAt]);

    // ── Derived ────────────────────────────────────────────────────────────────
    // State machine: scheduled/upcoming → MEA can approve (if lineups submitted)
    const canApprove = (match?.status === "scheduled" || match?.status === "upcoming") && isMEA();
    // approved → MEA can start
    const canStart = match?.status === "approved" && isMEA();
    // live → MEA can log events
    const canLogEvents = match?.status === "live" && isMEA();
    // live → MEA can end
    const canEnd = match?.status === "live" && isMEA();

    const homeLineup = lineups.filter(
        (l) => l.seasonClubPlayer.seasonClub.club.id === match?.homeClub?.id
    );
    const awayLineup = lineups.filter(
        (l) => l.seasonClubPlayer.seasonClub.club.id === match?.awayClub?.id
    );

    // Feature 3: players from lineup for selected club side
    const clubLineupForEvent = eventForm.clubSide === "home" ? homeLineup : awayLineup;
    const editClubLineup = editForm.clubSide === "home" ? homeLineup : awayLineup;

    // Feature 2: event type category
    const selectedEventType = eventTypes.find((et) => et.id === eventForm.eventTypeId);
    const eventCategory = selectedEventType ? getEventCategory(selectedEventType.name) : "simple";

    // Edit dialog event category
    const editEventType = eventTypes.find((et) => et.id === editForm.eventTypeId);
    const editEventCategory = editEventType ? getEventCategory(editEventType.name) : "simple";

    // ── Validation hooks ───────────────────────────────────────────────────────
    const { errors: eventErrors, handleBlur: eventHandleBlur, validateAll: eventValidateAll, resetValidation: eventResetValidation } = useFormValidation(
        (values) => validateEventForm(values, eventCategory),
        emptyEventForm
    );
    const { errors: scoreErrors, handleBlur: scoreHandleBlur, validateAll: scoreValidateAll, resetValidation: scoreResetValidation } = useFormValidation(validateScoreForm, { homeScore: "", awayScore: "" });

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
        if (!eventValidateAll(eventForm)) return;
        setSubmittingEvent(true);
        try {
            const clubId =
                eventForm.clubSide === "home" ? match.homeClub?.id : match.awayClub?.id;
            // Use elapsed minutes as default if minute field is empty
            const effectiveMinute = eventForm.minute !== "" ? Number(eventForm.minute) : elapsedMinutes;

            const eventsToLog: Array<{ matchId: string; eventTypeId: string; playerId: string; relatedPlayerId?: string; clubId?: string; minute: number; extraTime?: number; description?: string }> = [];

            // Primary event
            eventsToLog.push({
                matchId,
                eventTypeId: eventForm.eventTypeId,
                playerId: eventForm.playerId,
                relatedPlayerId: eventForm.relatedPlayerId || undefined,
                clubId,
                minute: effectiveMinute,
                extraTime: eventForm.extraTime ? Number(eventForm.extraTime) : undefined,
                description: eventForm.description || undefined,
            });

            // For goal: if assist player provided, also log an assist event
            if (eventCategory === "goal" && eventForm.relatedPlayerId) {
                const assistType = eventTypes.find((et) => et.name.toLowerCase() === "assist");
                if (assistType) {
                    eventsToLog.push({
                        matchId,
                        eventTypeId: assistType.id,
                        playerId: eventForm.relatedPlayerId,
                        clubId,
                        minute: effectiveMinute,
                        extraTime: eventForm.extraTime ? Number(eventForm.extraTime) : undefined,
                    });
                }
            }

            for (const evt of eventsToLog) {
                const res = await fetchWithAuth("/api/match-events", {
                    method: "POST",
                    body: JSON.stringify(evt),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    toast.error(data.error || "Failed to log event");
                    return;
                }
            }

            toast.success(eventsToLog.length > 1 ? "Goal + assist logged" : "Event logged");
            setEventForm({ ...emptyEventForm });
            eventResetValidation();
            mutateEvents();
            mutateMatch();
        } catch {
            toast.error("Failed to log event");
        } finally {
            setSubmittingEvent(false);
        }
    };

    const handleStartGame = async () => {
        setStartingGame(true);
        try {
            const res = await fetchWithAuth(`/api/matches/${matchId}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "live", liveStartedAt: new Date().toISOString() }),
            });
            if (!res.ok) { toast.error("Failed to start match"); return; }
            toast.success("Match started");
            mutateMatch();
        } catch { toast.error("Failed to start match"); }
        finally { setStartingGame(false); }
    };

    const handleEndGame = async () => {
        setStartingGame(true);
        try {
            const res = await fetchWithAuth(`/api/matches/${matchId}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "completed" }),
            });
            if (!res.ok) { toast.error("Failed to end match"); return; }
            toast.success("Match ended");
            mutateMatch();
        } catch { toast.error("Failed to end match"); }
        finally { setStartingGame(false); }
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

    const handleDeleteEvent = async () => {
        if (!editingEvent) return;
        setDeletingEvent(true);
        try {
            const res = await fetchWithAuth(`/api/match-events/${editingEvent.id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Failed to delete event");
                return;
            }
            toast.success("Event deleted");
            setEditingEvent(null);
            mutateEvents();
            mutateMatch();
        } catch {
            toast.error("Failed to delete event");
        } finally {
            setDeletingEvent(false);
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

    const handleDeleteMedia = async (mediaId: string) => {
        await fetchWithAuth(`/api/matches/${matchId}/media/${mediaId}`, { method: "DELETE" });
        mutateMedia();
    };

    const handleSaveScore = async () => {
        if (!scoreValidateAll(scoreForm)) return;
        setSavingScore(true);
        try {
            const res = await fetchWithAuth(`/api/matches/${matchId}`, {
                method: "PATCH",
                body: JSON.stringify({
                    homeScore: Number(scoreForm.homeScore),
                    awayScore: Number(scoreForm.awayScore),
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Failed to update score");
                return;
            }
            toast.success("Score updated");
            setEditingScore(false);
            scoreResetValidation();
            mutateMatch();
        } catch {
            toast.error("Failed to update score");
        } finally {
            setSavingScore(false);
        }
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
                            {/* Live timer */}
                            {match.status === "live" && match.liveStartedAt && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-400 border border-emerald-500/30">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                    {elapsedMinutes}&apos;
                                </span>
                            )}
                            <span className="text-xs text-muted-foreground">{matchDate}</span>
                            {match.stadium && (
                                <span className="text-xs text-muted-foreground">{match.stadium?.name}</span>
                            )}
                            {/* League admin: edit score */}
                            {(isLeagueAdmin() || isSuperAdmin()) && !editingScore && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="mt-1 h-7 text-xs text-muted-foreground"
                                    onClick={() => {
                                        setScoreForm({
                                            homeScore: String(match.homeScore ?? 0),
                                            awayScore: String(match.awayScore ?? 0),
                                        });
                                        setEditingScore(true);
                                    }}
                                >
                                    <Pencil className="h-3 w-3 mr-1" />
                                    Edit Score
                                </Button>
                            )}
                            {editingScore && (
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="flex flex-col gap-1">
                                        <Input
                                            id="score-home"
                                            type="number"
                                            min={0}
                                            className="h-8 w-14 text-center font-mono text-sm"
                                            value={scoreForm.homeScore}
                                            onChange={(e) => setScoreForm({ ...scoreForm, homeScore: e.target.value })}
                                            onBlur={() => scoreHandleBlur("homeScore", scoreForm)}
                                            aria-invalid={!!scoreErrors.homeScore}
                                            aria-describedby={scoreErrors.homeScore ? "score-home-error" : undefined}
                                        />
                                        {scoreErrors.homeScore && (
                                            <p id="score-home-error" role="alert" className="text-xs text-destructive mt-1">
                                                {scoreErrors.homeScore}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-muted-foreground font-bold">–</span>
                                    <div className="flex flex-col gap-1">
                                        <Input
                                            id="score-away"
                                            type="number"
                                            min={0}
                                            className="h-8 w-14 text-center font-mono text-sm"
                                            value={scoreForm.awayScore}
                                            onChange={(e) => setScoreForm({ ...scoreForm, awayScore: e.target.value })}
                                            onBlur={() => scoreHandleBlur("awayScore", scoreForm)}
                                            aria-invalid={!!scoreErrors.awayScore}
                                            aria-describedby={scoreErrors.awayScore ? "score-away-error" : undefined}
                                        />
                                        {scoreErrors.awayScore && (
                                            <p id="score-away-error" role="alert" className="text-xs text-destructive mt-1">
                                                {scoreErrors.awayScore}
                                            </p>
                                        )}
                                    </div>
                                    <Button size="sm" className="h-8" onClick={handleSaveScore} disabled={savingScore}>
                                        {savingScore ? "..." : "Save"}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8" onClick={() => { setEditingScore(false); scoreResetValidation(); }}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            )}
                            {/* Start/End game buttons for MEA */}
                            {canStart && (
                                <Button size="sm" onClick={handleStartGame} disabled={startingGame} className="mt-1">
                                    <Play className="h-3.5 w-3.5 mr-1" />
                                    {startingGame ? "Starting..." : "Start Match"}
                                </Button>
                            )}
                            {canEnd && (
                                <Button size="sm" variant="destructive" onClick={handleEndGame} disabled={startingGame} className="mt-1">
                                    <Square className="h-3.5 w-3.5 mr-1" />
                                    {startingGame ? "Ending..." : "End Match"}
                                </Button>
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
                            <div className="flex flex-col gap-1">
                                {[...events]
                                    .sort((a, b) => a.minute - b.minute)
                                    .map((event) => (
                                        <EventRow
                                            key={event.id}
                                            event={event}
                                            match={match}
                                            canEdit={canEditEvent(event)}
                                            onEdit={openEditEvent}
                                        />
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
                        events={events}
                        isLoading={lineupsLoading}
                    />
                    <LineupPanel
                        title={`${match.awayClub?.name} Lineup`}
                        entries={awayLineup}
                        events={events}
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
                                    onValueChange={(v) => setEventForm({
                                        ...eventForm,
                                        eventTypeId: v,
                                        playerId: "",
                                        relatedPlayerId: "",
                                        minute: eventForm.minute || String(elapsedMinutes),
                                    })}
                                >
                                    <SelectTrigger id="evt-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                                    <SelectContent>
                                        {eventTypes.map((et) => (
                                            <SelectItem key={et.id} value={et.id}>{et.name.replace(/_/g, " ")}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {eventErrors.eventTypeId && (
                                    <p id="evt-type-error" role="alert" className="text-xs text-destructive mt-1">
                                        {eventErrors.eventTypeId}
                                    </p>
                                )}
                            </div>

                            {/* Club side */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="evt-club">Club</Label>
                                <Select
                                    value={eventForm.clubSide}
                                    onValueChange={(v) => setEventForm({ ...eventForm, clubSide: v as "home" | "away", playerId: "", relatedPlayerId: "" })}
                                >
                                    <SelectTrigger id="evt-club"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="home">{match.homeClub?.name} (Home)</SelectItem>
                                        <SelectItem value="away">{match.awayClub?.name} (Away)</SelectItem>
                                    </SelectContent>
                                </Select>
                                {eventErrors.clubSide && (
                                    <p id="evt-club-error" role="alert" className="text-xs text-destructive mt-1">
                                        {eventErrors.clubSide}
                                    </p>
                                )}
                            </div>

                            {/* Feature 3: Player from lineup */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="evt-player">
                                    {eventCategory === "substitution" ? "Player Out" : "Player"}
                                </Label>
                                <Select
                                    value={eventForm.playerId}
                                    onValueChange={(v) => setEventForm({ ...eventForm, playerId: v })}
                                >
                                    <SelectTrigger id="evt-player"><SelectValue placeholder="Select player" /></SelectTrigger>
                                    <SelectContent>
                                        {clubLineupForEvent.length === 0 && (
                                            <SelectItem value="_none" disabled>No lineup submitted</SelectItem>
                                        )}
                                        {clubLineupForEvent.map((l) => (
                                            <SelectItem key={l.seasonClubPlayer.player.id} value={l.seasonClubPlayer.player.id}>
                                                {l.seasonClubPlayer.player.firstName} {l.seasonClubPlayer.player.lastName}
                                                {l.shirtNumber ? ` #${l.shirtNumber}` : ""}
                                                {l.position ? ` (${l.position.name})` : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {eventErrors.playerId && (
                                    <p id="evt-player-error" role="alert" className="text-xs text-destructive mt-1">
                                        {eventErrors.playerId}
                                    </p>
                                )}
                            </div>

                            {/* Feature 2: Smart related player field */}
                            {eventCategory === "goal" && (
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="evt-assist">Assist (optional)</Label>
                                    <Select
                                        value={eventForm.relatedPlayerId}
                                        onValueChange={(v) => setEventForm({ ...eventForm, relatedPlayerId: v === "_none" ? "" : v })}
                                    >
                                        <SelectTrigger id="evt-assist"><SelectValue placeholder="Select assister (optional)" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="_none">No assist</SelectItem>
                                            {clubLineupForEvent
                                                .filter((l) => l.seasonClubPlayer.player.id !== eventForm.playerId)
                                                .map((l) => (
                                                    <SelectItem key={l.seasonClubPlayer.player.id} value={l.seasonClubPlayer.player.id}>
                                                        {l.seasonClubPlayer.player.firstName} {l.seasonClubPlayer.player.lastName}
                                                        {l.shirtNumber ? ` #${l.shirtNumber}` : ""}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {eventCategory === "substitution" && (
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="evt-in">Player In</Label>
                                    <Select
                                        value={eventForm.relatedPlayerId}
                                        onValueChange={(v) => setEventForm({ ...eventForm, relatedPlayerId: v })}
                                    >
                                        <SelectTrigger id="evt-in"><SelectValue placeholder="Select player coming on" /></SelectTrigger>
                                        <SelectContent>
                                            {clubLineupForEvent
                                                .filter((l) => l.seasonClubPlayer.player.id !== eventForm.playerId)
                                                .map((l) => (
                                                    <SelectItem key={l.seasonClubPlayer.player.id} value={l.seasonClubPlayer.player.id}>
                                                        {l.seasonClubPlayer.player.firstName} {l.seasonClubPlayer.player.lastName}
                                                        {l.shirtNumber ? ` #${l.shirtNumber}` : ""}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    {eventErrors.relatedPlayerId && (
                                        <p id="evt-in-error" role="alert" className="text-xs text-destructive mt-1">
                                            {eventErrors.relatedPlayerId}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Minute auto-filled from elapsed time */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="evt-minute">Minute</Label>
                                <Input
                                    id="evt-minute"
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={eventForm.minute !== "" ? eventForm.minute : String(elapsedMinutes)}
                                    onChange={(e) => setEventForm({ ...eventForm, minute: e.target.value })}
                                    onBlur={() => eventHandleBlur("minute", eventForm)}
                                    aria-invalid={!!eventErrors.minute}
                                    aria-describedby={eventErrors.minute ? "evt-minute-error" : undefined}
                                />
                                {eventErrors.minute && (
                                    <p id="evt-minute-error" role="alert" className="text-xs text-destructive mt-1">
                                        {eventErrors.minute}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="evt-extra">Extra Time (optional)</Label>
                                <Input
                                    id="evt-extra"
                                    type="number"
                                    min={0}
                                    value={eventForm.extraTime}
                                    onChange={(e) => setEventForm({ ...eventForm, extraTime: e.target.value })}
                                    onBlur={() => eventHandleBlur("extraTime", eventForm)}
                                    aria-invalid={!!eventErrors.extraTime}
                                    aria-describedby={eventErrors.extraTime ? "evt-extra-error" : undefined}
                                    placeholder="0"
                                />
                                {eventErrors.extraTime && (
                                    <p id="evt-extra-error" role="alert" className="text-xs text-destructive mt-1">
                                        {eventErrors.extraTime}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-col gap-2 sm:col-span-2">
                                <Label htmlFor="evt-desc">Description (optional)</Label>
                                <Input
                                    id="evt-desc"
                                    value={eventForm.description}
                                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                                    onBlur={() => eventHandleBlur("description", eventForm)}
                                    aria-invalid={!!eventErrors.description}
                                    aria-describedby={eventErrors.description ? "evt-desc-error" : undefined}
                                    placeholder="Additional notes..."
                                />
                                {eventErrors.description && (
                                    <p id="evt-desc-error" role="alert" className="text-xs text-destructive mt-1">
                                        {eventErrors.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <Button
                                onClick={handleLogEvent}
                                disabled={submittingEvent}
                            >
                                {submittingEvent ? "Logging..." : "Log Event"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Match Media */}
            {(() => {
                const canDelete = isMEA() || isLeagueAdmin() || isSuperAdmin();
                const canUpload = isMEA() || isLeagueAdmin() || isSuperAdmin();
                const images = matchMedia.filter((m) => m.mediaType === "image");
                const videos = matchMedia.filter((m) => m.mediaType === "video");
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Match Media</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-6">
                            {/* Images */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Photos</p>
                                    {canUpload && (
                                        <MediaUploadWidget
                                            uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_MATCH_MEDIA ?? "match_media"}
                                            accept="image"
                                            onSuccess={async (url) => {
                                                await fetchWithAuth(`/api/matches/${matchId}/media`, {
                                                    method: "POST",
                                                    body: JSON.stringify({ url, mediaType: "image" }),
                                                });
                                                mutateMedia();
                                            }}
                                        >
                                            <Button size="sm" variant="outline" type="button">Add Photo</Button>
                                        </MediaUploadWidget>
                                    )}
                                </div>
                                <ImageGallery
                                    images={images.map((m) => ({ id: m.id, imageUrl: m.mediaUrl, caption: m.caption, sortOrder: m.sortOrder }))}
                                    onDelete={canDelete ? handleDeleteMedia : undefined}
                                    canDelete={canDelete}
                                    emptyMessage="No photos yet."
                                    maxImages={20}
                                />
                            </div>

                            {/* Videos */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Video Highlights</p>
                                    {canUpload && (
                                        <MediaUploadWidget
                                            uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_MATCH_MEDIA ?? "match_media"}
                                            accept="image+video"
                                            onSuccess={async (url) => {
                                                await fetchWithAuth(`/api/matches/${matchId}/media`, {
                                                    method: "POST",
                                                    body: JSON.stringify({ url, mediaType: "video" }),
                                                });
                                                mutateMedia();
                                            }}
                                        >
                                            <Button size="sm" variant="outline" type="button">
                                                <Video className="h-3.5 w-3.5 mr-1" />
                                                Add Video
                                            </Button>
                                        </MediaUploadWidget>
                                    )}
                                </div>
                                {videos.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">No videos yet.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {videos.map((media) => (
                                            <div key={media.id} className="relative group">
                                                <video src={media.mediaUrl} controls className="w-full rounded-lg" />
                                                {canDelete && (
                                                    <Button
                                                        variant="destructive"
                                                        size="icon"
                                                        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => handleDeleteMedia(media.id)}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                );
            })()}

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
                                onValueChange={(v) => setEditForm({ ...editForm, eventTypeId: v, playerId: "", relatedPlayerId: "" })}
                            >
                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent>
                                    {eventTypes.map((et) => (
                                        <SelectItem key={et.id} value={et.id}>{et.name.replace(/_/g, " ")}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label>Club</Label>
                            <Select
                                value={editForm.clubSide}
                                onValueChange={(v) => setEditForm({ ...editForm, clubSide: v as "home" | "away", playerId: "", relatedPlayerId: "" })}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="home">{match.homeClub?.name} (Home)</SelectItem>
                                    <SelectItem value="away">{match.awayClub?.name} (Away)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label>{editEventCategory === "substitution" ? "Player Out" : "Player"}</Label>
                            <Select
                                value={editForm.playerId}
                                onValueChange={(v) => setEditForm({ ...editForm, playerId: v })}
                            >
                                <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
                                <SelectContent>
                                    {editClubLineup.length === 0 && (
                                        <SelectItem value="_none" disabled>No lineup submitted</SelectItem>
                                    )}
                                    {editClubLineup.map((l) => (
                                        <SelectItem key={l.seasonClubPlayer.player.id} value={l.seasonClubPlayer.player.id}>
                                            {l.seasonClubPlayer.player.firstName} {l.seasonClubPlayer.player.lastName}
                                            {l.shirtNumber ? ` #${l.shirtNumber}` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {editEventCategory === "goal" && (
                            <div className="flex flex-col gap-2">
                                <Label>Assist (optional)</Label>
                                <Select
                                    value={editForm.relatedPlayerId || "_none"}
                                    onValueChange={(v) => setEditForm({ ...editForm, relatedPlayerId: v === "_none" ? "" : v })}
                                >
                                    <SelectTrigger><SelectValue placeholder="No assist" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">No assist</SelectItem>
                                        {editClubLineup
                                            .filter((l) => l.seasonClubPlayer.player.id !== editForm.playerId)
                                            .map((l) => (
                                                <SelectItem key={l.seasonClubPlayer.player.id} value={l.seasonClubPlayer.player.id}>
                                                    {l.seasonClubPlayer.player.firstName} {l.seasonClubPlayer.player.lastName}
                                                    {l.shirtNumber ? ` #${l.shirtNumber}` : ""}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {editEventCategory === "substitution" && (
                            <div className="flex flex-col gap-2">
                                <Label>Player In</Label>
                                <Select
                                    value={editForm.relatedPlayerId}
                                    onValueChange={(v) => setEditForm({ ...editForm, relatedPlayerId: v })}
                                >
                                    <SelectTrigger><SelectValue placeholder="Select player coming on" /></SelectTrigger>
                                    <SelectContent>
                                        {editClubLineup
                                            .filter((l) => l.seasonClubPlayer.player.id !== editForm.playerId)
                                            .map((l) => (
                                                <SelectItem key={l.seasonClubPlayer.player.id} value={l.seasonClubPlayer.player.id}>
                                                    {l.seasonClubPlayer.player.firstName} {l.seasonClubPlayer.player.lastName}
                                                    {l.shirtNumber ? ` #${l.shirtNumber}` : ""}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="flex flex-col gap-2">
                            <Label>Minute</Label>
                            <Input
                                type="number"
                                min={1}
                                max={120}
                                value={editForm.minute}
                                onChange={(e) => setEditForm({ ...editForm, minute: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label>Extra Time</Label>
                            <Input
                                type="number"
                                min={0}
                                value={editForm.extraTime}
                                onChange={(e) => setEditForm({ ...editForm, extraTime: e.target.value })}
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
                        <Button variant="outline" onClick={() => setEditingEvent(null)}>Cancel</Button>
                        {(isLeagueAdmin() || isSuperAdmin()) && (
                            <Button
                                variant="destructive"
                                onClick={handleDeleteEvent}
                                disabled={deletingEvent || savingEdit}
                            >
                                <Trash2 className="h-4 w-4 mr-1" />
                                {deletingEvent ? "Deleting..." : "Delete"}
                            </Button>
                        )}
                        <Button onClick={handleSaveEdit} disabled={savingEdit || deletingEvent}>
                            {savingEdit ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Event Row ────────────────────────────────────────────────────────────────

function getEventMeta(typeName: string): {
    icon: React.ReactNode;
    label: string;
    iconBg: string;
} {
    const n = typeName.toLowerCase();
    if (n === "goal" || n === "penalty_goal") {
        return {
            icon: <Goal className="h-3.5 w-3.5 text-emerald-400" />,
            label: n === "penalty_goal" ? "Penalty Goal" : "Goal",
            iconBg: "bg-emerald-500/15 border-emerald-500/30",
        };
    }
    if (n === "own_goal") {
        return {
            icon: <Goal className="h-3.5 w-3.5 text-orange-400" />,
            label: "Own Goal",
            iconBg: "bg-orange-500/15 border-orange-500/30",
        };
    }
    if (n === "assist") {
        return {
            icon: <span className="text-[11px] font-bold text-sky-400">A</span>,
            label: "Assist",
            iconBg: "bg-sky-500/15 border-sky-500/30",
        };
    }
    if (n === "yellow_card") {
        return {
            icon: <span className="block h-3.5 w-2.5 rounded-[2px] bg-yellow-400" />,
            label: "Yellow Card",
            iconBg: "bg-yellow-500/15 border-yellow-500/30",
        };
    }
    if (n === "red_card") {
        return {
            icon: <span className="block h-3.5 w-2.5 rounded-[2px] bg-red-500" />,
            label: "Red Card",
            iconBg: "bg-red-500/15 border-red-500/30",
        };
    }
    if (n === "substitution") {
        return {
            icon: <ArrowLeftRight className="h-3.5 w-3.5 text-violet-400" />,
            label: "Substitution",
            iconBg: "bg-violet-500/15 border-violet-500/30",
        };
    }
    if (n === "injury") {
        return {
            icon: <CircleAlert className="h-3.5 w-3.5 text-rose-400" />,
            label: "Injury",
            iconBg: "bg-rose-500/15 border-rose-500/30",
        };
    }
    return {
        icon: <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />,
        label: typeName.replace(/_/g, " "),
        iconBg: "bg-muted border-border",
    };
}

function EventRow({
    event,
    match,
    canEdit,
    onEdit,
}: {
    event: MatchEvent;
    match: Match;
    canEdit: boolean;
    onEdit: (e: MatchEvent) => void;
}) {
    const { icon, label, iconBg } = getEventMeta(event.eventType.name);
    const n = event.eventType.name.toLowerCase();
    const isGoal = n === "goal" || n === "penalty_goal" || n === "own_goal";
    const isSub = n === "substitution";
    const isCard = n === "yellow_card" || n === "red_card";

    const playerName = event.player
        ? `${event.player.firstName} ${event.player.lastName}`
        : null;
    const relatedName = event.relatedPlayer
        ? `${event.relatedPlayer.firstName} ${event.relatedPlayer.lastName}`
        : null;

    // Determine which side this event belongs to
    const isHome = event.club?.id === match.homeClubId;
    const clubShort = event.club
        ? (isHome ? match.homeClub?.shortName || match.homeClub?.name : match.awayClub?.shortName || match.awayClub?.name)
        : null;

    return (
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40 transition-colors group">
            {/* Minute */}
            <span className="w-9 shrink-0 text-right font-mono text-xs font-semibold text-muted-foreground">
                {event.minute}&apos;{event.extraTime ? `+${event.extraTime}` : ""}
            </span>

            {/* Icon badge */}
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${iconBg}`}>
                {icon}
            </span>

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col gap-0">
                {isGoal && playerName && (
                    <span className="font-semibold text-foreground truncate">
                        {playerName}
                        {clubShort && <span className="ml-1 text-xs font-normal text-muted-foreground">({clubShort})</span>}
                        {n === "own_goal" && <span className="ml-1 text-xs text-orange-400">(OG)</span>}
                        {n === "penalty_goal" && <span className="ml-1 text-xs text-emerald-400">(P)</span>}
                    </span>
                )}
                {isGoal && relatedName && (
                    <span className="text-xs text-muted-foreground">
                        <span className="text-sky-400">A:</span> {relatedName}
                    </span>
                )}
                {isSub && (
                    <span className="text-xs text-foreground">
                        {relatedName && (
                            <span className="text-emerald-400">▲ {relatedName}</span>
                        )}
                        {playerName && relatedName && <span className="text-muted-foreground mx-1">/</span>}
                        {playerName && (
                            <span className="text-red-400">▼ {playerName}</span>
                        )}
                        {clubShort && <span className="ml-1 text-muted-foreground">({clubShort})</span>}
                    </span>
                )}
                {isCard && playerName && (
                    <span className="font-medium text-foreground truncate">
                        {playerName}
                        {clubShort && <span className="ml-1 text-xs font-normal text-muted-foreground">({clubShort})</span>}
                    </span>
                )}
                {!isGoal && !isSub && !isCard && (
                    <span className="text-foreground truncate">
                        {playerName || label}
                        {clubShort && playerName && <span className="ml-1 text-xs text-muted-foreground">({clubShort})</span>}
                    </span>
                )}
                {event.description && (
                    <span className="text-xs text-muted-foreground italic truncate">{event.description}</span>
                )}
            </div>

            {/* Label tag */}
            <span className="hidden sm:inline-flex shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                {label}
            </span>

            {/* Edit button */}
            {canEdit && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                    onClick={() => onEdit(event)}
                >
                    <Pencil className="h-3 w-3" />
                    <span className="sr-only">Edit</span>
                </Button>
            )}
        </div>
    );
}

// ─── Lineup Panel ─────────────────────────────────────────────────────────────

function LineupPanel({
    title,
    entries,
    events,
    isLoading,
}: {
    title: string;
    entries: LineupEntry[];
    events: MatchEvent[];
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
                                        <PlayerRow key={e.id} entry={e} events={events} />
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
                                        <PlayerRow key={e.id} entry={e} events={events} />
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

function PlayerRow({ entry, events }: { entry: LineupEntry; events: MatchEvent[] }) {
    const { player } = entry.seasonClubPlayer;

    // Derive card status for this player from events
    const playerEvents = events.filter((e) => e.player?.id === player.id);
    const yellowCards = playerEvents.filter((e) => e.eventType.name.toLowerCase() === "yellow_card").length;
    const hasRed = playerEvents.some((e) => e.eventType.name.toLowerCase() === "red_card");
    // Two yellows = red
    const isRedCarded = hasRed || yellowCards >= 2;
    const isYellowCarded = !isRedCarded && yellowCards === 1;

    return (
        <div className="flex items-center gap-2 text-sm">
            {entry.shirtNumber && (
                <span className="w-6 text-right font-mono text-xs text-muted-foreground">
                    {entry.shirtNumber}
                </span>
            )}
            <span className={`text-foreground ${isRedCarded ? "line-through text-muted-foreground" : ""}`}>
                {player.firstName} {player.lastName}
                {entry.isCaptain && (
                    <span className="ml-1 text-xs text-amber-400">(C)</span>
                )}
            </span>
            {/* Card indicators */}
            {isYellowCarded && (
                <span className="ml-1 inline-block h-3 w-2 rounded-[2px] bg-yellow-400 shrink-0" title="Yellow card" />
            )}
            {isRedCarded && (
                <span className="ml-1 inline-block h-3 w-2 rounded-[2px] bg-red-500 shrink-0" title="Red card" />
            )}
            {entry.position && (
                <span className="ml-auto text-xs text-muted-foreground">{entry.position.name}</span>
            )}
        </div>
    );
}
