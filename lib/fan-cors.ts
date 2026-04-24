/**
 * CORS helper for Fan API routes.
 *
 * Usage in any /api/fan/** route handler:
 *
 *   import { fanCorsHeaders, handleOptions } from "@/lib/fan-cors";
 *
 *   export function OPTIONS() {
 *     return handleOptions();
 *   }
 *
 *   export async function GET(req: NextRequest, ...) {
 *     const res = await buildResponse(...);
 *     return withCors(res);
 *   }
 */

import { NextResponse } from "next/server";

export const ALLOWED_ORIGINS = [
    "https://ethio-league-live.vercel.app",
];

export const fanCorsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.join(","),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
};

/**
 * Returns a 204 No Content response for OPTIONS preflight requests.
 */
export function handleOptions(): NextResponse {
    return new NextResponse(null, { status: 204, headers: fanCorsHeaders });
}

/**
 * Clones a NextResponse and injects CORS headers.
 * Use this when you need per-request CORS header injection
 * (next.config.ts headers() handles the common case automatically).
 */
export function withCors(response: NextResponse): NextResponse {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(fanCorsHeaders)) {
        headers.set(key, value);
    }
    return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}
