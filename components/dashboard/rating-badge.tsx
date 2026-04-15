"use client";

import useSWR from "swr";
import { authFetcher } from "@/lib/fetch-client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface RatingData {
    score: number;
    tier: string;
    computedAt: string;
}

const tierStyles: Record<string, string> = {
    Elite: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    High: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    Medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    Low: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    Developing: "bg-muted text-muted-foreground border-border",
};

interface RatingBadgeProps {
    entityType: "player" | "club" | "league" | "coach" | "referee";
    entityId: string;
    className?: string;
    /** If true, shows a compact inline badge. If false (default), shows score + tier label */
    compact?: boolean;
}

export function RatingBadge({ entityType, entityId, className, compact = false }: RatingBadgeProps) {
    const { data, isLoading } = useSWR<RatingData>(
        entityId ? `/api/ratings/${entityType}/${entityId}` : null,
        authFetcher,
        { revalidateOnFocus: false }
    );

    if (isLoading) return <Skeleton className={cn("h-5 w-14 rounded-full", className)} />;
    if (!data) return null;

    const tierClass = tierStyles[data.tier] ?? tierStyles.Developing;

    if (compact) {
        return (
            <span
                className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    tierClass,
                    className
                )}
                title={`${data.tier} · ${data.score.toFixed(1)}/100`}
            >
                ★ {data.score.toFixed(1)}
            </span>
        );
    }

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <span
                className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    tierClass
                )}
            >
                ★ {data.score.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">{data.tier}</span>
        </div>
    );
}
