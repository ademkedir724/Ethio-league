import "dotenv/config";
import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding enum tables...");

  // ─── Roles ──────────────────────────────────────────────
  const roles = [
    { name: "super_admin", description: "Full system access" },
    { name: "organization_admin", description: "Manages an organization and its leagues" },
    { name: "league_admin", description: "Manages a specific league/season" },
    { name: "club_admin", description: "Manages a specific club" },
    { name: "match_event_admin", description: "Logs live match events" },
    { name: "fan", description: "Public user / fan" },
  ];
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  // ─── League Types ──────────────────────────────────────
  const leagueTypes = [
    { name: "round_robin", description: "Each team plays every other team" },
    { name: "knockout", description: "Single elimination tournament" },
    { name: "hybrid", description: "Group stage + knockout rounds" },
  ];
  for (const lt of leagueTypes) {
    await prisma.leagueType.upsert({
      where: { name: lt.name },
      update: {},
      create: lt,
    });
  }

  // ─── Event Types ───────────────────────────────────────
  const eventTypes = [
    { name: "goal", description: "Goal scored" },
    { name: "assist", description: "Assist on a goal" },
    { name: "yellow_card", description: "Yellow card shown" },
    { name: "red_card", description: "Red card shown" },
    { name: "own_goal", description: "Own goal" },
    { name: "penalty_goal", description: "Goal from penalty" },
    { name: "substitution", description: "Player substitution" },
    { name: "injury", description: "Player injury" },
  ];
  for (const et of eventTypes) {
    await prisma.eventType.upsert({
      where: { name: et.name },
      update: {},
      create: et,
    });
  }

  // ─── Positions ─────────────────────────────────────────
  const positions = [
    { code: "GK", name: "Goalkeeper", description: "Goalkeeper" },
    { code: "CB", name: "Center Back", description: "Central defender" },
    { code: "RB", name: "Right Back", description: "Right-side defender" },
    { code: "LB", name: "Left Back", description: "Left-side defender" },
    { code: "CDM", name: "Defensive Midfielder", description: "Central defensive midfielder" },
    { code: "CM", name: "Central Midfielder", description: "Central midfielder" },
    { code: "CAM", name: "Attacking Midfielder", description: "Central attacking midfielder" },
    { code: "LW", name: "Left Winger", description: "Left wing forward" },
    { code: "RW", name: "Right Winger", description: "Right wing forward" },
    { code: "ST", name: "Striker", description: "Center forward / striker" },
    { code: "CF", name: "Center Forward", description: "Center forward" },
  ];
  for (const pos of positions) {
    await prisma.position.upsert({
      where: { code: pos.code },
      update: {},
      create: pos,
    });
  }

  // ─── Super Admin User ─────────────────────────────────
  const superAdminEmail = "admin@ethioleague.com";
  const existingAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("password", 12);
    const admin = await prisma.user.create({
      data: {
        fullName: "System Admin",
        email: superAdminEmail,
        passwordHash,
        phone: "+251900000000",
        status: "active",
      },
    });

    const superAdminRole = await prisma.role.findUnique({
      where: { name: "super_admin" },
    });

    if (superAdminRole) {
      await prisma.userRoleScope.create({
        data: {
          userId: admin.id,
          roleId: superAdminRole.id,
        },
      });
    }

    console.log(`Created super admin: ${superAdminEmail}`);
  }

  console.log("Seed complete.");
}

main();
