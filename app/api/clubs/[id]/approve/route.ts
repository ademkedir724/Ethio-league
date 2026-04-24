import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isAuthError, hasRole, hasOrgRole } from "@/lib/auth";
import { success, badRequest, notFound, serverError, parseUUID } from "@/lib/api-helpers";

// POST /api/clubs/[id]/approve — approve or reject a club registration
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const clubId = parseUUID(id);
    if (!clubId) {
      return badRequest("Invalid club ID");
    }

    const body = await req.json();
    const { action } = body; // "approve" or "reject"

    if (!action || !["approve", "reject"].includes(action)) {
      return badRequest("action must be 'approve' or 'reject'");
    }

    // Get the club to check organization
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: {
        league: { select: { organizationId: true } },
      },
    });

    if (!club) return notFound("Club not found");

    // Derive org from club.leagueId (new flow) or fall back to seasonClubs (legacy)
    const organizationId = club.league?.organizationId;

    // Auth check: org_admin only (not league_admin, not super_admin)
    const isOrgAdmin = organizationId
      ? hasOrgRole(auth, "organization_admin", organizationId)
      : false;

    if (!isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const newStatus = action === "approve" ? "active" : "rejected";

    const updated = await prisma.club.update({
      where: { id: clubId },
      data: { status: newStatus },
    });

    // TODO: Send notification to club admin about the decision

    return success({
      message: `Club ${action === "approve" ? "approved" : "rejected"} successfully`,
      club: updated,
    });
  } catch (error) {
    return serverError(error);
  }
}
