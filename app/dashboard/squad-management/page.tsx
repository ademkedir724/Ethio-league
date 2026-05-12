"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { authFetcher } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, ChevronRight, Users } from "lucide-react";

interface Season {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    _count: { seasonClubs: number; matches: number };
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function SquadManagementPage() {
    const router = useRouter();
    const { getLeagueId, isLeagueAdmin } = useAuth();
    const leagueId = getLeagueId();

    const { data: seasonsResponse, error, isLoading } = useSWR<{ data: Season[] }>(
        leagueId ? `/api/seasons?leagueId=${leagueId}&limit=100` : null,
        authFetcher
    );
    const seasons = seasonsResponse?.data ?? [];

    if (!isLeagueAdmin()) {
        return (
            <div className="flex flex-col gap-4 p-6">
                <p className="text-sm text-muted-foreground">Access restricted to League Admins.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col gap-4 p-6">
                <p className="text-sm text-destructive">Failed to load seasons. Please refresh.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Squad Management"
                description="Select a season to review and manage squad requests."
            />

            {isLoading ? (
                <div className="flex flex-col gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 rounded-xl" />
                    ))}
                </div>
            ) : seasons.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                    <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">No seasons found for your league.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {seasons.map((season) => (
                        <Card
                            key={season.id}
                            className="cursor-pointer hover:border-primary/40 transition-colors"
                            onClick={() => router.push(`/dashboard/seasons/${season.id}/players`)}
                        >
                            <CardContent className="flex items-center justify-between p-4">
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{season.name}</span>
                                        <StatusBadge status={season.status} />
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {formatDate(season.startDate)} — {formatDate(season.endDate)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Users className="h-3 w-3" />
                                            {season._count.seasonClubs} club{season._count.seasonClubs !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0">
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
