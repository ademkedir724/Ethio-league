"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { authFetcher } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Layers, Calendar } from "lucide-react";

interface League {
    id: string;
    name: string;
    status: string;
    _count: { seasons: number };
}

interface Season {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    requiredClubs: number | null;
}

function statusBadgeClass(status: string) {
    switch (status) {
        case "active": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
        case "upcoming": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
        case "completed": return "bg-muted text-muted-foreground border-border";
        default: return "bg-muted text-muted-foreground border-border";
    }
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function SeasonList({ leagueId }: { leagueId: string }) {
    const router = useRouter();
    const { data: seasons, isLoading } = useSWR<Season[]>(
        `/api/leagues/${leagueId}/seasons`,
        authFetcher
    );

    if (isLoading) {
        return (
            <div className="flex flex-col gap-2 mt-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
        );
    }

    if (!seasons || seasons.length === 0) {
        return <p className="text-sm text-muted-foreground mt-3 px-1">No seasons found for this league.</p>;
    }

    return (
        <div className="flex flex-col gap-2 mt-3">
            {seasons.map((season) => (
                <button
                    key={season.id}
                    onClick={() => router.push(`/dashboard/seasons/${season.id}/assignments`)}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-left hover:border-primary/40 hover:bg-muted/30 transition-colors group"
                >
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">{season.name}</span>
                        <span className="text-xs text-muted-foreground">
                            {formatDate(season.startDate)} — {formatDate(season.endDate)}
                            {season.requiredClubs ? ` · ${season.requiredClubs} clubs` : ""}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge
                            className={`text-[10px] border capitalize ${statusBadgeClass(season.status)}`}
                            variant="outline"
                        >
                            {season.status}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                </button>
            ))}
        </div>
    );
}

export default function SeasonAssignmentsPage() {
    const { isOrgAdmin } = useAuth();
    const [expandedLeagueId, setExpandedLeagueId] = useState<string | null>(null);

    const { data: leagues, isLoading, error } = useSWR<League[]>(
        isOrgAdmin() ? "/api/leagues" : null,
        authFetcher
    );

    if (!isOrgAdmin()) {
        return (
            <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">Access restricted to Org Admins.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Season Assignments"
                description="Select a league and season to manage MEA and referee assignments."
            />

            {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Failed to load leagues. Please refresh.
                </div>
            )}

            {isLoading ? (
                <div className="flex flex-col gap-4">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
            ) : !leagues || leagues.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                    <Layers className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">No leagues found</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {leagues.map((league) => {
                        const isExpanded = expandedLeagueId === league.id;
                        return (
                            <Card key={league.id} className={isExpanded ? "border-primary/40" : ""}>
                                <CardHeader
                                    className="flex flex-row items-center justify-between gap-4 pb-3 cursor-pointer select-none"
                                    onClick={() => setExpandedLeagueId(isExpanded ? null : league.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div>
                                            <CardTitle className="text-base">{league.name}</CardTitle>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {league._count.seasons} season{league._count.seasons !== 1 ? "s" : ""}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight
                                        className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                    />
                                </CardHeader>

                                {isExpanded && (
                                    <CardContent className="pt-0">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                            <Calendar className="h-3 w-3" />
                                            <span>Select a season to manage assignments</span>
                                        </div>
                                        <SeasonList leagueId={league.id} />
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
