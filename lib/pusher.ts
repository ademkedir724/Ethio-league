/**
 * lib/pusher.ts
 *
 * Server-side Pusher client singleton.
 * Used to broadcast real-time match events to the fan site.
 *
 * Required env vars:
 *   PUSHER_APP_ID
 *   PUSHER_KEY        (also set as NEXT_PUBLIC_PUSHER_KEY for the fan site)
 *   PUSHER_SECRET
 *   PUSHER_CLUSTER    (e.g. "mt1", "eu", "ap2")
 */

import Pusher from "pusher";

let _pusher: Pusher | null = null;

export function getPusher(): Pusher {
    if (_pusher) return _pusher;

    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.PUSHER_CLUSTER;

    if (!appId || !key || !secret || !cluster) {
        throw new Error(
            "Pusher env vars missing: PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER"
        );
    }

    _pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
    return _pusher;
}

// ─── Channel / event naming helpers ──────────────────────────────────────────

/** Channel name for a specific match. Fan site subscribes to this. */
export function matchChannel(matchId: string): string {
    return `match-${matchId}`;
}

/** Pusher event names */
export const PUSHER_EVENTS = {
    EVENT_CREATED: "match-event.created",
    EVENT_UPDATED: "match-event.updated",
    EVENT_DELETED: "match-event.deleted",
    SCORE_UPDATED: "match.score-updated",
    STATUS_CHANGED: "match.status-changed",
} as const;

// ─── Broadcast helpers ────────────────────────────────────────────────────────

export interface MatchEventPayload {
    id: string;
    matchId: string;
    minute: number;
    extraTime?: number | null;
    description?: string | null;
    eventType: { id: string | number; name: string };
    player: { id: string; firstName: string; lastName: string } | null;
    relatedPlayer: { id: string; firstName: string; lastName: string } | null;
    club: { id: string; name: string } | null;
    createdAt?: string;
}

export interface ScorePayload {
    matchId: string;
    homeScore: number;
    awayScore: number;
}

export interface StatusPayload {
    matchId: string;
    status: string;
    liveStartedAt?: string | null;
}

/**
 * Broadcast a match event mutation to the fan channel.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function broadcastMatchEvent(
    eventName: string,
    matchId: string,
    payload: MatchEventPayload | ScorePayload | StatusPayload
): Promise<void> {
    try {
        const pusher = getPusher();
        await pusher.trigger(matchChannel(matchId), eventName, payload);
    } catch (err) {
        console.error(`[pusher] broadcast failed (${eventName}):`, err);
    }
}
