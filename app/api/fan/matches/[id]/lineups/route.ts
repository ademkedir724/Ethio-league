import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// GET /api/fan/matches/[id]/lineups
// Public — no auth required
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const matchId = parseUUID(id);
        if (!matchId) return badRequest("Invalid match ID");

        const match = await prisma.match.findUnique({
            where: { id: matchId },
            select: {
                id: true,
                homeClubId: true,
                awayClubId: true,
                homeClub: { select: { id: true, name: true, logoUrl: true } },
                awayClub: { select: { id: true, name: true, logoUrl: true } },
            },
        });
        if (!match) return notFound("Match not found");

        const lineups = await prisma.matchLineup.findMany({
            where: { matchId },
            include: {
                seasonClubPlayer: {
                    include: {
                        player: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
                        seasonClub: { select: { clubId: true } },
                    },
                },
                position: { select: { id: true, name: true, code: true } },
            },
            orderBy: [{ lineupType: "asc" }, { shirtNumber: "asc" }],
        });

        type LineupEntry = {
            playerId: string;
            firstName: string;
            lastName: string;
            photoUrl: string | null;
            shirtNumber: number | null;
            position: { id: number; name: string; code: string } | null;
            isCaptain: boolean;
            lineupType: string;
        };

        const homeStarting: LineupEntry[] = [];
        const homeBench: LineupEntry[] = [];
        const awayStarting: LineupEntry[] = [];
        const awayBench: LineupEntry[] = [];

        for (const l of lineups) {
            const entry: LineupEntry = {
                playerId: l.seasonClubPlayer.playerId,
                firstName: l.seasonClubPlayer.player.firstName,
                lastName: l.seasonClubPlayer.player.lastName,
                photoUrl: l.seasonClubPlayer.player.photoUrl,
                shirtNumber: l.shirtNumber,
                position: l.position,
                isCaptain: l.isCaptain,
                lineupType: l.lineupType,
            };

            const isHome = l.seasonClubPlayer.seasonClub.clubId === match.homeClubId;
            const isStarting = l.lineupType === "starting";

            if (isHome) {
                isStarting ? homeStarting.push(entry) : homeBench.push(entry);
            } else {
                isStarting ? awayStarting.push(entry) : awayBench.push(entry);
            }
        }

        return success({
            home: {
                clubId: match.homeClubId,
                clubName: match.homeClub.name,
                clubLogo: match.homeClub.logoUrl,
                starting: homeStarting,
                bench: homeBench,
            },
            away: {
                clubId: match.awayClubId,
                clubName: match.awayClub.name,
                clubLogo: match.awayClub.logoUrl,
                starting: awayStarting,
                bench: awayBench,
            },
        });
    } catch (error) {
        return serverError(error);
    }
}

export { handleOptions as OPTIONS } from "@/lib/fan-cors";
