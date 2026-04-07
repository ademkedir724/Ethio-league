"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { authFetcher } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";

interface Season {
    id: string;
    name: string;
    status: string;
}

/**
 * Squad Management entry point for League Admin.
 * Fetches the league's seasons and redirects to the active (or most recent) season's
 * squad review page at /dashboard/seasons/[id]/players.
 */
export default function SquadManagementPage() {
    const router = useRouter();
    const { getLeagueId, isLeagueAdmin } = useAuth();
    const leagueId = getLeagueId();

    const { data: seasons, error } = useSWR<Season[]>(
        leagueId ? `/api/seasons?leagueId=${leagueId}` : null,
        authFetcher
    );

    useEffect(() => {
        if (!seasons || seasons.length === 0) return;
        // Prefer active season, then upcoming, then most recent
        const target =
            seasons.find((s) => s.status === "active") ??
            seasons.find((s) => s.status === "upcoming") ??
            seasons[0];
        if (target) {
            router.replace(`/dashboard/seasons/${target.id}/players`);
        }
    }, [seasons, router]);

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

    if (seasons && seasons.length === 0) {
        return (
            <div className="flex flex-col gap-4 p-6">
                <p className="text-sm text-muted-foreground">No seasons found for your league.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-56" />
        </div>
    );
}
