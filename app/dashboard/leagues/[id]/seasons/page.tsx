"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { usePaginated } from "@/lib/use-paginated";
import { Pagination } from "@/components/dashboard/pagination";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { AlertCircle, Calendar, ChevronLeft, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface League {
    id: string;
    name: string;
    status: string;
}

interface Season {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    leagueId: string;
    requiredClubs?: number | null;
    roundRobinType?: string | null;
    daysBetweenRounds?: number | null;
    minSquadSize?: number | null;
    minStartingPlayers?: number | null;
    maxBenchPlayers?: number | null;
    rules?: string | null;
    _count?: { seasonClubs: number; matches: number };
}

interface ValidationDetail {
    criterion: "required_clubs" | "min_players" | "min_coaches";
    message: string;
    clubs: string[];
}

const emptyForm = {
    name: "",
    startDate: "",
    endDate: "",
    status: "upcoming",
    requiredClubs: "",
    roundRobinType: "double",
    daysBetweenRounds: "",
    minSquadSize: "14",
    minStartingPlayers: "11",
    maxBenchPlayers: "7",
    rules: "",
};

const STATUS_OPTIONS = ["upcoming", "active", "completed", "cancelled"] as const;

function statusBadgeClass(status: string) {
    switch (status) {
        case "active":
            return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
        case "upcoming":
            return "bg-blue-500/15 text-blue-400 border-blue-500/30";
        case "completed":
            return "bg-muted text-muted-foreground border-border";
        case "cancelled":
            return "bg-red-500/15 text-red-400 border-red-500/30";
        default:
            return "bg-muted text-muted-foreground border-border";
    }
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LeagueSeasonsPage() {
    const params = useParams();
    const router = useRouter();
    const leagueId = params.id as string;

    const { isLeagueAdmin } = useAuth();

    // Only league_admin can create/edit/delete seasons
    const canEdit = isLeagueAdmin();

    // Fetch league details for breadcrumb/header
    const { data: league, isLoading: leagueLoading } = useSWR<League>(
        leagueId ? `/api/leagues/${leagueId}` : null,
        authFetcher
    );

    // Fetch seasons for this league (paginated)
    const {
        items: seasons,
        pagination,
        setPage,
        setLimit,
        isLoading: seasonsLoading,
        error,
        mutate: mutateSeasons,
    } = usePaginated<Season>(
        leagueId ? `/api/leagues/${leagueId}/seasons` : null,
        { defaultLimit: 20 }
    );

    const isLoading = leagueLoading || seasonsLoading;

    // Dialog state
    const [formOpen, setFormOpen] = useState(false);
    const [editingSeason, setEditingSeason] = useState<Season | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Season | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [isSaving, setIsSaving] = useState(false);
    const [activationErrors, setActivationErrors] = useState<ValidationDetail[]>([]);

    const openCreate = () => {
        setEditingSeason(null);
        setForm(emptyForm);
        setFormOpen(true);
    };

    const openEdit = (season: Season) => {
        setEditingSeason(season);
        setForm({
            name: season.name,
            startDate: season.startDate.slice(0, 10),
            endDate: season.endDate.slice(0, 10),
            status: season.status,
            requiredClubs: season.requiredClubs?.toString() ?? "",
            roundRobinType: season.roundRobinType ?? "double",
            daysBetweenRounds: season.daysBetweenRounds?.toString() ?? "",
            minSquadSize: (season.minSquadSize ?? 14).toString(),
            minStartingPlayers: (season.minStartingPlayers ?? 11).toString(),
            maxBenchPlayers: (season.maxBenchPlayers ?? 7).toString(),
            rules: season.rules ?? "",
        });
        setFormOpen(true);
    };

    const handleSubmit = async () => {
        if (!form.name.trim()) {
            toast.error("Season name is required");
            return;
        }
        if (!form.startDate || !form.endDate) {
            toast.error("Start date and end date are required");
            return;
        }

        setIsSaving(true);
        try {
            let res: Response;
            if (editingSeason) {
                res = await fetchWithAuth(`/api/seasons/${editingSeason.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        name: form.name.trim(),
                        startDate: form.startDate,
                        endDate: form.endDate,
                        status: form.status,
                        requiredClubs: form.requiredClubs ? parseInt(form.requiredClubs) : null,
                        roundRobinType: form.roundRobinType || "double",
                        daysBetweenRounds: form.daysBetweenRounds ? parseInt(form.daysBetweenRounds) : null,
                        minSquadSize: parseInt(form.minSquadSize) || 14,
                        minStartingPlayers: parseInt(form.minStartingPlayers) || 11,
                        maxBenchPlayers: parseInt(form.maxBenchPlayers) || 7,
                        rules: form.rules || null,
                    }),
                });
            } else {
                res = await fetchWithAuth("/api/seasons", {
                    method: "POST",
                    body: JSON.stringify({
                        leagueId,
                        name: form.name.trim(),
                        startDate: form.startDate,
                        endDate: form.endDate,
                        requiredClubs: form.requiredClubs ? parseInt(form.requiredClubs) : null,
                        roundRobinType: form.roundRobinType || "double",
                        daysBetweenRounds: form.daysBetweenRounds ? parseInt(form.daysBetweenRounds) : null,
                        minSquadSize: parseInt(form.minSquadSize) || 14,
                        minStartingPlayers: parseInt(form.minStartingPlayers) || 11,
                        maxBenchPlayers: parseInt(form.maxBenchPlayers) || 7,
                        rules: form.rules || null,
                    }),
                });
            }

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 422 && data.code === "ACTIVATION_VALIDATION_FAILED") {
                    setActivationErrors(data.details ?? []);
                    return;
                }
                toast.error(data.error || (editingSeason ? "Failed to update season" : "Failed to create season"));
                return;
            }

            toast.success(editingSeason ? "Season updated" : "Season created");
            setActivationErrors([]);
            setFormOpen(false);
            mutateSeasons();
        } catch {
            toast.error("Something went wrong");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await fetchWithAuth(`/api/seasons/${deleteTarget.id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Failed to delete season");
                return;
            }
            toast.success("Season deleted");
            setDeleteTarget(null);
            mutateSeasons();
        } catch {
            toast.error("Failed to delete season");
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Back link */}
            <button
                onClick={() => router.push("/dashboard/leagues")}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
            >
                <ChevronLeft className="h-4 w-4" />
                Back to Leagues
            </button>

            <PageHeader
                title={league ? `${league.name} — Seasons` : "Seasons"}
                description="Manage seasons for this league."
            >
                {canEdit && (
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4" />
                        Create Season
                    </Button>
                )}
            </PageHeader>

            {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Failed to load seasons. Please try again.
                </div>
            )}

            {/* Season list */}
            {isLoading ? (
                <div className="flex flex-col gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 rounded-xl" />
                    ))}
                </div>
            ) : !seasons || seasons.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                    <Calendar className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">No seasons yet</p>
                    {canEdit && (
                        <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                            <Plus className="h-4 w-4" />
                            Create first season
                        </Button>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-0 relative">
                    {seasons.map((season, index) => (
                        <SeasonCard
                            key={season.id}
                            season={season}
                            canEdit={canEdit}
                            onEdit={openEdit}
                            onDelete={setDeleteTarget}
                            isLast={index === seasons.length - 1}
                        />
                    ))}
                    <Pagination
                        page={pagination.page}
                        totalPages={pagination.totalPages}
                        total={pagination.total}
                        limit={pagination.limit}
                        onPageChange={setPage}
                        onLimitChange={setLimit}
                    />
                </div>
            )}

            {/* Create / Edit Dialog */}
            <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); setActivationErrors([]); } }}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingSeason ? "Edit Season" : "Create Season"}</DialogTitle>
                        <DialogDescription>
                            {editingSeason ? "Update season details." : "Fill in the details for the new season."}
                        </DialogDescription>
                    </DialogHeader>

                    <SeasonFormFields form={form} setForm={setForm} editingSeason={editingSeason} />

                    {activationErrors.length > 0 && (
                        <div className="rounded-lg border border-destructive/40 bg-destructive/5 overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-destructive/10 border-b border-destructive/20">
                                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                                <p className="text-sm font-semibold text-destructive">Season cannot be activated</p>
                            </div>
                            <div className="flex flex-col divide-y divide-destructive/10">
                                {activationErrors.map((detail) => (
                                    <div key={detail.criterion} className="px-4 py-2.5 flex flex-col gap-1">
                                        <p className="text-xs font-medium text-foreground">{detail.message}</p>
                                        {detail.clubs.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                {detail.clubs.map((club) => (
                                                    <span key={club} className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-destructive/10 text-destructive/80 border border-destructive/20">
                                                        {club}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFormOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={isSaving}>
                            {isSaving ? "Saving..." : editingSeason ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Delete Season"
                description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                variant="destructive"
                onConfirm={handleDelete}
            />
        </div>
    );
}

// ─── Season Form Fields ───────────────────────────────────────────────────────

interface SeasonFormType {
    name: string;
    startDate: string;
    endDate: string;
    status: string;
    requiredClubs: string;
    roundRobinType: string;
    daysBetweenRounds: string;
    minSquadSize: string;
    minStartingPlayers: string;
    maxBenchPlayers: string;
    rules: string;
}

function SeasonFormFields({
    form,
    setForm,
    editingSeason,
}: {
    form: SeasonFormType;
    setForm: (f: SeasonFormType) => void;
    editingSeason: Season | null;
}) {
    // Calculate recommended days between rounds
    const recommendation = useMemo(() => {
        if (!form.startDate || !form.endDate || !form.requiredClubs) return null;
        const clubs = parseInt(form.requiredClubs);
        if (isNaN(clubs) || clubs < 2) return null;

        const start = new Date(form.startDate);
        const end = new Date(form.endDate);
        const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (totalDays <= 0) return null;

        // Number of rounds: single = n-1, double = 2*(n-1)
        const rounds = form.roundRobinType === "single" ? clubs - 1 : 2 * (clubs - 1);
        if (rounds <= 0) return null;

        const recommended = Math.floor(totalDays / rounds);
        return { rounds, totalDays, recommended };
    }, [form.startDate, form.endDate, form.requiredClubs, form.roundRobinType]);

    return (
        <div className="grid gap-4">
            <div className="flex flex-col gap-2">
                <Label htmlFor="season-name">Name *</Label>
                <Input
                    id="season-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="2024/25 Season"
                    required
                    minLength={2}
                    maxLength={100}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                    <Label htmlFor="start-date">Start Date *</Label>
                    <Input
                        id="start-date"
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                        required
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="end-date">End Date *</Label>
                    <Input
                        id="end-date"
                        type="date"
                        value={form.endDate}
                        onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                        required
                        min={form.startDate || undefined}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                    <Label htmlFor="required-clubs">
                        Required Clubs <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                        id="required-clubs"
                        type="number"
                        min={2}
                        max={50}
                        value={form.requiredClubs}
                        onChange={(e) => setForm({ ...form, requiredClubs: e.target.value })}
                        placeholder="e.g. 10"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="rr-type">Round Robin Type</Label>
                    <Select
                        value={form.roundRobinType}
                        onValueChange={(v) => setForm({ ...form, roundRobinType: v })}
                    >
                        <SelectTrigger id="rr-type">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="single">Single (home only)</SelectItem>
                            <SelectItem value="double">Double (home + away)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Smart recommendation */}
            {recommendation && (
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-400">
                    <p className="font-medium mb-0.5">Schedule recommendation</p>
                    <p>
                        {recommendation.rounds} rounds × {recommendation.recommended} days = {recommendation.rounds * recommendation.recommended} days
                        {" "}(season is {recommendation.totalDays} days).
                        Recommended: <strong>{recommendation.recommended} days between rounds</strong>.
                    </p>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <Label htmlFor="days-between">
                    Days Between Rounds <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                    id="days-between"
                    type="number"
                    min={1}
                    max={365}
                    value={form.daysBetweenRounds}
                    onChange={(e) => setForm({ ...form, daysBetweenRounds: e.target.value })}
                    placeholder={recommendation ? `Recommended: ${recommendation.recommended}` : "e.g. 7"}
                />
                {recommendation && !form.daysBetweenRounds && (
                    <button
                        type="button"
                        className="text-xs text-blue-400 hover:underline text-left"
                        onClick={() => setForm({ ...form, daysBetweenRounds: recommendation.recommended.toString() })}
                    >
                        Use recommended ({recommendation.recommended} days)
                    </button>
                )}
            </div>

            {editingSeason && (
                <div className="flex flex-col gap-2">
                    <Label htmlFor="season-status">Status</Label>
                    <Select
                        value={form.status}
                        onValueChange={(v) => setForm({ ...form, status: v })}
                    >
                        <SelectTrigger id="season-status">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s} className="capitalize">
                                    {s}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* ── League Rules ─────────────────────────────────────────── */}
            <div className="border-t border-border pt-4 flex flex-col gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">League Rules</p>

                <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="min-squad">Min Squad</Label>
                        <Input
                            id="min-squad"
                            type="number"
                            min={1}
                            max={50}
                            value={form.minSquadSize}
                            onChange={(e) => setForm({ ...form, minSquadSize: e.target.value })}
                            placeholder="14"
                        />
                        <p className="text-[10px] text-muted-foreground">Players per club</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="min-starters">Starters</Label>
                        <Input
                            id="min-starters"
                            type="number"
                            min={1}
                            max={25}
                            value={form.minStartingPlayers}
                            onChange={(e) => setForm({ ...form, minStartingPlayers: e.target.value })}
                            placeholder="11"
                        />
                        <p className="text-[10px] text-muted-foreground">In lineup</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="max-bench">Max Bench</Label>
                        <Input
                            id="max-bench"
                            type="number"
                            min={0}
                            max={20}
                            value={form.maxBenchPlayers}
                            onChange={(e) => setForm({ ...form, maxBenchPlayers: e.target.value })}
                            placeholder="7"
                        />
                        <p className="text-[10px] text-muted-foreground">Substitutes</p>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <Label htmlFor="rules">Additional Rules</Label>
                    <textarea
                        id="rules"
                        rows={3}
                        className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="e.g. Max 3 foreign players per lineup. 3 yellow cards = 1 match ban."
                        value={form.rules}
                        onChange={(e) => setForm({ ...form, rules: e.target.value })}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Season Card ─────────────────────────────────────────────────────────────

interface SeasonCardProps {
    season: Season;
    canEdit: boolean;
    onEdit: (season: Season) => void;
    onDelete: (season: Season) => void;
    isLast?: boolean;
}

function seasonDotColor(status: string): string {
    switch (status) {
        case "active": return "border-emerald-500 text-emerald-500";
        case "upcoming": return "border-blue-500 text-blue-500";
        case "completed": return "border-muted-foreground text-muted-foreground";
        case "cancelled": return "border-red-500 text-red-500";
        default: return "border-muted-foreground text-muted-foreground";
    }
}

function SeasonCard({ season, canEdit, onEdit, onDelete, isLast }: SeasonCardProps) {
    const router = useRouter();
    const dotColor = seasonDotColor(season.status);

    return (
        <div className="relative flex items-start gap-3 pb-3">
            {/* Vertical timeline line */}
            {!isLast && (
                <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
            )}

            {/* Status dot */}
            <div
                className={`mt-1 h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center ${dotColor}`}
            >
                <div className="h-2 w-2 rounded-full bg-current" />
            </div>

            {/* Card content */}
            <div
                className="flex-1 flex items-center gap-4 px-4 py-4 rounded-xl border border-border hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/seasons/${season.id}`)}
            >
                {/* Season name + date */}
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-sm font-semibold truncate">{season.name}</span>
                    <span className="text-xs text-muted-foreground">
                        {formatDate(season.startDate)} — {formatDate(season.endDate)}
                    </span>
                </div>

                {/* Stats + status + menu */}
                <div className="flex items-center gap-2 shrink-0">
                    {season._count && (
                        <>
                            <span className="hidden sm:inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                {season._count.seasonClubs} club{season._count.seasonClubs !== 1 ? "s" : ""}
                            </span>
                            <span className="hidden sm:inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                {season._count.matches} match{season._count.matches !== 1 ? "es" : ""}
                            </span>
                        </>
                    )}

                    <Badge
                        className={`text-[10px] border capitalize ${statusBadgeClass(season.status)}`}
                        variant="outline"
                    >
                        {season.status}
                    </Badge>

                    {canEdit && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-muted-foreground"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(season); }}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); onDelete(season); }}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>
        </div>
    );
}
