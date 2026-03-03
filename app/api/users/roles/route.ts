import { success } from "@/lib/api-helpers";

const ROLES = [
  "SUPER_ADMIN",
  "LEAGUE_ADMIN",
  "CLUB_ADMIN",
  "REFEREE",
  "PLAYER",
  "COACH",
  "FAN",
];

// GET /api/users/roles — list all available roles
export async function GET() {
  return success(ROLES);
}
