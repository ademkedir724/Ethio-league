"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { ChevronLeft, Plus, X, Users, Shield } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Season {
    id: string;
    name: string;
    status: string;
    requiredClubs: number | null;
    league: { id: string; name: string; organization: { id: string; name: string } };
    _count: { seasonClubs: number; matches: number };
}

interface Referee {
    id: string;
    firstName: string;
    lastName: string;
    licenseLevel: string | null;
    nationality: string | null;
    status: string;
}

interface MEAUser {
    id: string;
    fullName: string;
    email: string;
    status: string;
    userRoleScopes: Array<{ role: { name: string } }>;
}

interface AssignmentResponse {
    referees: Referee[];
    matchEventAdmins: MEAUser[];
}

// ── Quota badge helper ─────────────────────────────────────────────────────────

export function getQuotaBadgeVariant(
    count: number,
    limit: number | null
): "default" | "amber" | "red" | null {
    if (limit === null) return null;
    if (count >= limit) return "red";
    if (count / limit >= 0.8) return "amber";
    return "default";
}

function QuotaBadge({ count, limit }: { count: number; limit: number | null }) {
    const variant = getQuotaBadgeVariant(count, limit);
    const label = limit !== null ? `${count} / ${limit} assigned` : `${count} assigned`;

    if (variant === null) {
        return <span className="text-sm text-muted-foreground">{label}</span>;
    }
    if (variant === "red") {
        return (
            <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                {label}
            </Badge>
        );
    }
    if (variant === "amber") {
        return (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                {label}
            </Badge>
        );
    }
    return (
        <Badge variant="secondary">{label}</Badge>
    );
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    if (status === "active") {
        return <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400">active</Badge>;
    }
    if (status === "upcoming") {
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">upcoming</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
}

// ── Picker Dialog ──────────────────────────────────────────────────────────────

interface PickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    items: Array<{ id: string; label: string; sublabel?: string }>;
    onSelect: (id: string) => void;
}

function PickerDialog({ open, onOpenChange, title, description, items, onSelect }: PickerDialogProps) {
    const [search, setSearch] = useState("");

    const filtered = items.filter((item) =>
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        (item.sublabel?.toLowerCase().includes(search.toLowerCase()) ?? false)
    );

    const handleSelect = (id: string) => {
        onSelect(id);
        setSearch("");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) setSearch(""); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mb-2"
                />
                <div className="max-h-72 overflow-y-auto flex flex-col gap-1">
                    {filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No results found.</p>
                    ) : (
                        filtered.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleSelect(item.id)}
                                className="flex flex-col items-start rounded-md px-3 py-2 text-left hover:bg-muted transition-colors"
                            >
                                <span className="text-sm font-medium">{item.label}</span>
                                {item.sublabel && (
                                    <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SeasonAssignmentsPage() {
    const params = useParams();
    const router = useRouter();
    const seasonId = params.id as string;

    // ── Data fetching ──
    const { data: season, isLoading: seasonLoading } = useSWR<Season>(
        seasonId ? `/api/seasons/${seasonId}` : null,
        authFetcher
    );

    const { data: assignments, isLoading: assignmentsLoading } = useSWR<AssignmentResponse>(
        seasonId ? `/api/seasons/${seasonId}/assignments` : null,
        authFetcher
    );

    const { data: allReferees, isLoading: refereesLoading } = useSWR<Referee[]>(
        "/api/referees",
        authFetcher
    );

    const { data: allUsers, isLoading: usersLoading } = useSWR<MEAUser[]>(
        "/api/users",
        authFetcher
    );

    // ── Local state ──
    const [pendingRefereeIds, setPendingRefereeIds] = useState<string[]>([]);
    const [pendingMEAIds, setPendingMEAIds] = useState<string[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [pickerOpen, setPickerOpen] = useState<"referees" | "meas" | null>(null);

    // ── Initialize pending state from assignments ──
    useEffect(() => {
        if (!assignments) return;
        const savedRefereeIds = assignments.referees.map((r) => r.id);
        const savedMEAIds = assignments.matchEventAdmins.map((m) => m.id);
        setPendingRefereeIds(savedRefereeIds);
        setPendingMEAIds(savedMEAIds);
        setIsDirty(false);
    }, [assignments]);

    // ── Compute isDirty ──
    useEffect(() => {
        if (!assignments) return;
        const savedRefereeIds = [...assignments.referees.map((r) => r.id)].sort();
        const savedMEAIds = [...assignments.matchEventAdmins.map((m) => m.id)].sort();
        const currentRefereeIds = [...pendingRefereeIds].sort();
        const currentMEAIds = [...pendingMEAIds].sort();
        const dirty =
            JSON.stringify(currentRefereeIds) !== JSON.stringify(savedRefereeIds) ||
            JSON.stringify(currentMEAIds) !== JSON.stringify(savedMEAIds);
        setIsDirty(dirty);
    }, [pendingRefereeIds, pendingMEAIds, assignments]);

    // ── Derived data ──
    const meaUsers = (allUsers ?? []).filter((u) =>
        u.userRoleScopes.some((s) => s.role.name === "match_event_admin")
    );

    const assignedRefereeMap = new Map(
        (allReferees ?? []).filter((r) => pendingRefereeIds.includes(r.id)).map((r) => [r.id, r])
    );

    const assignedMEAMap = new Map(
        meaUsers.filter((u) => pendingMEAIds.includes(u.id)).map((u) => [u.id, u])
    );

    const availableReferees = (allReferees ?? []).filter((r) => !pendingRefereeIds.includes(r.id));
    const availableMEAs = meaUsers.filter((u) => !pendingMEAIds.includes(u.id));

    const refereeLimit = season?.requiredClubs != null ? 4 * season.requiredClubs : null;
    const meaLimit = season?.requiredClubs ?? null;

    // ── Handlers ──
    const handleRemoveReferee = (id: string) => {
        setPendingRefereeIds((prev) => prev.filter((rid) => rid !== id));
    };

    const handleRemoveMEA = (id: string) => {
        setPendingMEAIds((prev) => prev.filter((mid) => mid !== id));
    };

    const handleAddReferee = (id: string) => {
        setPendingRefereeIds((prev) => [...prev, id]);
    };

    const handleAddMEA = (id: string) => {
        setPendingMEAIds((prev) => [...prev, id]);
    };

    const handleSave = async () => {
        if (!season) return;
        setIsSaving(true);
        try {
            const res = await fetchWithAuth(`/api/seasons/${seasonId}/assignments`, {
                method: "POST",
                body: JSON.stringify({
                    refereeIds: pendingRefereeIds,
                    matchEventAdminIds: pendingMEAIds,
                }),
            });

            if (res.status === 201) {
                await mutate(`/api/seasons/${seasonId}/assignments`);
                setIsDirty(false);
                toast.success("Assignments saved successfully.");
                return;
            }

            const data = await res.json().catch(() => ({}));
            if (res.status === 422) {
                const code = data.code as string | undefined;
                if (code === "QUOTA_EXCEEDED_REFEREES" || code === "QUOTA_EXCEEDED_MEAS") {
                    toast.error(`Max ${data.limit} allowed, you selected ${data.requested}.`);
                } else if (code === "SEASON_NOT_ACTIVE") {
                    toast.error(data.error || "Assignments can only be made to active seasons.");
                } else if (code === "OUT_OF_SCOPE_MEA") {
                    toast.error(data.error || "One or more MEAs do not belong to this organization.");
                } else {
                    toast.error(data.error || "Failed to save assignments.");
                }
            } else {
                toast.error(data.error || "Failed to save assignments.");
            }
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    // ── Loading state ──
    const isLoading = seasonLoading || assignmentsLoading || refereesLoading || usersLoading;

    if (isLoading) {
        return (
            <div className="flex flex-col gap-6">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-64 rounded-xl" />
                    <Skeleton className="h-64 rounded-xl" />
                </div>
            </div>
        );
    }

    if (!season) return null;

    const isSeasonActive = season.status === "active";

    return (
        <div className="flex flex-col gap-6">
            {/* Back button */}
            <button
                onClick={() => router.back()}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
            >
                <ChevronLeft className="h-4 w-4" />
                Back
            </button>

            {/* Page header */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-semibold">{season.name}</h1>
                    <StatusBadge status={season.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                    {season.league.organization.name} · {season.league.name}
                </p>
            </div>

            {/* Warning banner when season is not active */}
            {!isSeasonActive && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    Assignments can only be made to active seasons.
                </div>
            )}

            {/* Two-panel layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left panel: Match Event Admins */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-base">Match Event Admins</CardTitle>
                        </div>
                        <QuotaBadge count={pendingMEAIds.length} limit={meaLimit} />
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {pendingMEAIds.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">No MEAs assigned yet.</p>
                        ) : (
                            pendingMEAIds.map((id) => {
                                const mea = assignedMEAMap.get(id);
                                if (!mea) return null;
                                return (
                                    <div
                                        key={id}
                                        className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{mea.fullName}</span>
                                            <span className="text-xs text-muted-foreground">{mea.email}</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleRemoveMEA(id)}
                                            disabled={!isSeasonActive}
                                            aria-label={`Remove ${mea.fullName}`}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                );
                            })
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full"
                            onClick={() => setPickerOpen("meas")}
                            disabled={!isSeasonActive}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add MEA
                        </Button>
                    </CardContent>
                </Card>

                {/* Right panel: Referees */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
                        <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-base">Referees</CardTitle>
                        </div>
                        <QuotaBadge count={pendingRefereeIds.length} limit={refereeLimit} />
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {pendingRefereeIds.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">No referees assigned yet.</p>
                        ) : (
                            pendingRefereeIds.map((id) => {
                                const referee = assignedRefereeMap.get(id);
                                if (!referee) return null;
                                return (
                                    <div
                                        key={id}
                                        className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">
                                                {referee.firstName} {referee.lastName}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {[referee.licenseLevel, referee.nationality]
                                                    .filter(Boolean)
                                                    .join(" · ") || "—"}
                                            </span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleRemoveReferee(id)}
                                            disabled={!isSeasonActive}
                                            aria-label={`Remove ${referee.firstName} ${referee.lastName}`}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                );
                            })
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full"
                            onClick={() => setPickerOpen("referees")}
                            disabled={!isSeasonActive}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add Referee
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Save button */}
            <div className="flex justify-end">
                <Button
                    onClick={handleSave}
                    disabled={!isDirty || isSaving || !isSeasonActive}
                >
                    {isSaving ? "Saving..." : "Save Changes"}
                </Button>
            </div>

            {/* MEA Picker Dialog */}
            <PickerDialog
                open={pickerOpen === "meas"}
                onOpenChange={(open) => setPickerOpen(open ? "meas" : null)}
                title="Add Match Event Admin"
                description="Select a Match Event Admin to assign to this season."
                items={availableMEAs.map((u) => ({
                    id: u.id,
                    label: u.fullName,
                    sublabel: u.email,
                }))}
                onSelect={handleAddMEA}
            />

            {/* Referee Picker Dialog */}
            <PickerDialog
                open={pickerOpen === "referees"}
                onOpenChange={(open) => setPickerOpen(open ? "referees" : null)}
                title="Add Referee"
                description="Select a referee to assign to this season."
                items={availableReferees.map((r) => ({
                    id: r.id,
                    label: `${r.firstName} ${r.lastName}`,
                    sublabel: [r.licenseLevel, r.nationality].filter(Boolean).join(" · ") || undefined,
                }))}
                onSelect={handleAddReferee}
            />
        </div>
    );
}
