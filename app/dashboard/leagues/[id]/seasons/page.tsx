"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Calendar, ChevronLeft, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

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
    _count?: { seasonClubs: number; matches: number };
}

const emptyForm = {
    name: "",
    startDate: "",
    endDate: "",
    status: "upcoming",
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

    const { user, isSuperAdmin, isOrgAdmin, isLeagueAdmin } = useAuth();

    const canEdit =
        isSuperAdmin() ||
        isOrgAdmin() ||
        isLeagueAdmin() ||
        (user?.roles.some((r) =>
            ["super_admin", "organization_admin", "league_admin"].includes(r.roleName)
        ) ?? false);

    // Fetch league details for breadcrumb/header
    const { data: league, isLoading: leagueLoading } = useSWR<League>(
        leagueId ? `/api/leagues/${leagueId}` : null,
        authFetcher
    );

    // Fetch seasons for this league
    const {
        data: seasons,
        isLoading: seasonsLoading,
        error,
    } = useSWR<Season[]>(
        leagueId ? `/api/leagues/${leagueId}/seasons` : null,
        authFetcher
    );

    const isLoading = leagueLoading || seasonsLoading;

    // Dialog state
    const [formOpen, setFormOpen] = useState(false);
    const [editingSeason, setEditingSeason] = useState<Season | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Season | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [isSaving, setIsSaving] = useState(false);

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
                    }),
                });
            }

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || (editingSeason ? "Failed to update season" : "Failed to create season"));
                return;
            }

            toast.success(editingSeason ? "Season updated" : "Season created");
            setFormOpen(false);
            mutate(`/api/leagues/${leagueId}/seasons`);
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
            mutate(`/api/leagues/${leagueId}/seasons`);
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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-40 rounded-xl" />
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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {seasons.map((season) => (
                        <SeasonCard
                            key={season.id}
                            season={season}
                            canEdit={canEdit}
                            onEdit={openEdit}
                            onDelete={setDeleteTarget}
                        />
                    ))}
                </div>
            )}

            {/* Create / Edit Dialog */}
            <Dialog open={formOpen} onOpenChange={(open) => { if (!open) setFormOpen(false); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingSeason ? "Edit Season" : "Create Season"}</DialogTitle>
                        <DialogDescription>
                            {editingSeason ? "Update season details." : "Fill in the details for the new season."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="season-name">Name *</Label>
                            <Input
                                id="season-name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="2024/25 Season"
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
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="end-date">End Date *</Label>
                                <Input
                                    id="end-date"
                                    type="date"
                                    value={form.endDate}
                                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                                />
                            </div>
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
                    </div>

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

// ─── Season Card ─────────────────────────────────────────────────────────────

interface SeasonCardProps {
    season: Season;
    canEdit: boolean;
    onEdit: (season: Season) => void;
    onDelete: (season: Season) => void;
}

function SeasonCard({ season, canEdit, onEdit, onDelete }: SeasonCardProps) {
    return (
        <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardTitle className="text-base leading-tight truncate">{season.name}</CardTitle>
                {canEdit && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(season)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => onDelete(season)}
                                className="text-destructive focus:text-destructive"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </CardHeader>

            <CardContent className="flex flex-col gap-3 flex-1">
                <div className="flex items-center justify-between">
                    <Badge
                        className={`text-[10px] border capitalize ${statusBadgeClass(season.status)}`}
                        variant="outline"
                    >
                        {season.status}
                    </Badge>
                    {season._count && (
                        <span className="text-xs text-muted-foreground">
                            {season._count.seasonClubs} club{season._count.seasonClubs !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>

                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <span>{formatDate(season.startDate)} — {formatDate(season.endDate)}</span>
                    {season._count && (
                        <span>{season._count.matches} match{season._count.matches !== 1 ? "es" : ""}</span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
