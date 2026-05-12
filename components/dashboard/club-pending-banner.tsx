"use client";

/**
 * ClubPendingBanner
 *
 * Fetches the current club's status and renders a prominent warning banner
 * when the club is not yet active (pending / rejected / suspended).
 *
 * Usage: drop it at the top of any Club Admin page that has write actions.
 */

import useSWR from "swr";
import { authFetcher } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { AlertTriangle } from "lucide-react";

interface ClubDetail {
    id: string;
    name: string;
    status: string;
}

const STATUS_MESSAGES: Record<string, string> = {
    pending: "Your club is pending approval by the organization admin. You cannot create players or submit squad requests until your club is approved.",
    rejected: "Your club registration has been rejected. Please contact your league administrator.",
    suspended: "Your club has been suspended. Please contact your league administrator.",
    inactive: "Your club is inactive. Please contact your league administrator.",
};

const STATUS_COLORS: Record<string, string> = {
    pending: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    rejected: "border-destructive/40 bg-destructive/10 text-destructive",
    suspended: "border-destructive/40 bg-destructive/10 text-destructive",
    inactive: "border-amber-500/40 bg-amber-500/10 text-amber-400",
};

interface Props {
    /** If true, also renders when status is active (for debugging). Default false. */
    showWhenActive?: boolean;
}

export function ClubPendingBanner({ showWhenActive = false }: Props) {
    const { isClubAdmin, getClubId } = useAuth();
    const clubId = getClubId();

    const { data: club } = useSWR<ClubDetail>(
        isClubAdmin() && clubId ? `/api/clubs/${clubId}` : null,
        authFetcher
    );

    if (!club) return null;
    if (club.status === "active" && !showWhenActive) return null;

    const message = STATUS_MESSAGES[club.status] ?? `Club status: ${club.status}`;
    const colorClass = STATUS_COLORS[club.status] ?? "border-amber-500/40 bg-amber-500/10 text-amber-400";

    return (
        <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${colorClass}`}>
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex flex-col gap-0.5">
                <span className="font-semibold capitalize">{club.status} — {club.name}</span>
                <span className="text-xs opacity-90">{message}</span>
            </div>
        </div>
    );
}

/**
 * useClubIsActive — returns true only when the club admin's club status is "active".
 * Use this to disable write buttons in the UI.
 */
export function useClubIsActive(): { isActive: boolean; isLoading: boolean; status: string | null } {
    const { isClubAdmin, getClubId } = useAuth();
    const clubId = getClubId();

    const { data: club, isLoading } = useSWR<ClubDetail>(
        isClubAdmin() && clubId ? `/api/clubs/${clubId}` : null,
        authFetcher
    );

    if (!isClubAdmin()) return { isActive: true, isLoading: false, status: null };
    if (isLoading || !club) return { isActive: false, isLoading: true, status: null };

    return { isActive: club.status === "active", isLoading: false, status: club.status };
}
