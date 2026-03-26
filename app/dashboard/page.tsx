"use client";

import useSWR from "swr";
import { authFetcher } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/org-context";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Users,
  Shield,
  UserCircle,
  Calendar,
  Swords,
  Layers,
  Clock,
  Megaphone,
} from "lucide-react";

// Mock data for Super Admin
const mockSuperAdminStats = {
  organizations: 4,
  clubs: 32,
  players: 640,
  users: 85,
  seasons: 6,
  matches: 248,
};

// Mock data for Organization Admin
const mockOrgAdminStats = {
  totalLeagues: 3,
  activeLeagues: 2,
  totalClubs: 12,
  pendingClubs: 2,
  totalReferees: 8,
  totalMatchEventAdmins: 5,
  upcomingMatches: 15,
};

const mockRecentMatches = [
  {
    id: 1,
    homeClub: "Ethio Electric SC",
    awayClub: "St. George FC",
    score: "2 - 1",
    status: "completed",
    date: "2026-03-01",
  },
  {
    id: 2,
    homeClub: "Fasil Kenema FC",
    awayClub: "Hawassa Ketema FC",
    score: "0 - 0",
    status: "live",
    date: "2026-03-03",
  },
  {
    id: 3,
    homeClub: "Adama Ketema FC",
    awayClub: "Dire Dawa Ketema FC",
    score: "- vs -",
    status: "scheduled",
    date: "2026-03-06",
  },
  {
    id: 4,
    homeClub: "Wolaita Dicha FC",
    awayClub: "Sidama Bunna FC",
    score: "3 - 2",
    status: "completed",
    date: "2026-02-28",
  },
  {
    id: 5,
    homeClub: "Bahir Dar Ketema FC",
    awayClub: "Jimma Aba Jifar FC",
    score: "- vs -",
    status: "upcoming",
    date: "2026-03-08",
  },
];

const mockRecentUsers = [
  {
    id: 1,
    fullName: "Abebe Kebede",
    email: "abebe@ethioleague.com",
    role: "Organization Admin",
    status: "active",
  },
  {
    id: 2,
    fullName: "Tigist Haile",
    email: "tigist@ethioleague.com",
    role: "Club Admin",
    status: "active",
  },
  {
    id: 3,
    fullName: "Dawit Mengistu",
    email: "dawit@ethioleague.com",
    role: "League Admin",
    status: "pending",
  },
  {
    id: 4,
    fullName: "Sara Tesfaye",
    email: "sara@ethioleague.com",
    role: "Match Event Admin",
    status: "active",
  },
];

// Mock recent activity for org admin
const mockOrgAdminActivity = [
  {
    id: 1,
    type: "club_registration",
    title: "New Club Registration",
    description: "Addis Ababa FC submitted registration",
    date: "2026-03-20",
  },
  {
    id: 2,
    type: "league_created",
    title: "League Created",
    description: "Premier League 2026 has been created",
    date: "2026-03-18",
  },
  {
    id: 3,
    type: "referee_added",
    title: "Referee Added",
    description: "Referee Tesfaye Bekele has been added",
    date: "2026-03-15",
  },
];

function SuperAdminOverview() {
  const { data: stats, isLoading } = useSWR(
    "/api/dashboard/stats",
    authFetcher,
    {
      fallbackData: undefined,
    }
  );

  const displayStats = stats || {};

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard Overview"
        description="Welcome to the Ethio-League management dashboard."
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Organizations"
              value={displayStats.organizations}
              icon={Building2}
              description="Registered organizations"
            />
            <StatCard
              title="Clubs"
              value={displayStats.clubs}
              icon={Shield}
              description="Active clubs"
            />
            <StatCard
              title="Players"
              value={displayStats.players}
              icon={UserCircle}
              description="Registered players"
            />
            <StatCard
              title="Users"
              value={displayStats.users}
              icon={Users}
              description="System users"
            />
            <StatCard
              title="Seasons"
              value={displayStats.seasons}
              icon={Calendar}
              description="Total seasons"
            />
            <StatCard
              title="Matches"
              value={displayStats.matches}
              icon={Swords}
              description="Total matches"
            />
          </>
        )}
      </div>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Matches */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-card-foreground">
              Recent Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Match</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRecentMatches.map((match) => (
                  <TableRow key={match.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {match.homeClub}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          vs {match.awayClub}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-foreground">
                      {match.score}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={match.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Users */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-card-foreground">
              Recent Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRecentUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {user.fullName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.role}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={user.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OrgAdminOverview() {
  const { organization, isLoading: orgLoading } = useOrganization();

  const { data: stats, isLoading: statsLoading } = useSWR(
    organization ? `/api/dashboard/stats?organizationId=${organization.id}` : null,
    authFetcher,
    {
      fallbackData: undefined,
    }
  );

  const displayStats = stats || {};
  const isLoading = orgLoading || statsLoading;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={organization ? `${organization.name} Dashboard` : "Dashboard Overview"}
        description={
          organization
            ? `Manage leagues, clubs, and referees for ${organization.name}.`
            : "Welcome to your organization dashboard."
        }
      />

      {/* Org Admin Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Total Leagues"
              value={displayStats.totalLeagues}
              icon={Layers}
              description="Managed leagues"
            />
            <StatCard
              title="Active Leagues"
              value={displayStats.activeLeagues}
              icon={Layers}
              description="Currently running"
            />
            <StatCard
              title="Total Clubs"
              value={displayStats.totalClubs}
              icon={Shield}
              description="Registered clubs"
            />
            <StatCard
              title="Pending Clubs"
              value={displayStats.pendingClubs}
              icon={Clock}
              description="Awaiting approval"
            />
            <StatCard
              title="Referees"
              value={displayStats.totalReferees}
              icon={Megaphone}
              description="Active referees"
            />
            <StatCard
              title="Match Admins"
              value={displayStats.totalMatchEventAdmins}
              icon={Users}
              description="Event administrators"
            />
            <StatCard
              title="Upcoming Matches"
              value={displayStats.upcomingMatches}
              icon={Swords}
              description="Scheduled matches"
            />
          </>
        )}
      </div>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Matches */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-card-foreground">
              Recent Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Match</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRecentMatches.slice(0, 4).map((match) => (
                  <TableRow key={match.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {match.homeClub}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          vs {match.awayClub}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-foreground">
                      {match.score}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={match.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-card-foreground">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockOrgAdminActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    {activity.type === "club_registration" && (
                      <Shield className="h-4 w-4 text-primary" />
                    )}
                    {activity.type === "league_created" && (
                      <Layers className="h-4 w-4 text-primary" />
                    )}
                    {activity.type === "referee_added" && (
                      <Megaphone className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {activity.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.description}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activity.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ClubAdminOverview() {
  const { data: stats, isLoading, error } = useSWR(
    "/api/dashboard/stats",
    authFetcher
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Club Dashboard"
        description="Overview of your club's players, coaches, and matches."
      />
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load dashboard stats. Please try again.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Players"
              value={stats?.players ?? 0}
              icon={UserCircle}
              description="Registered players"
            />
            <StatCard
              title="Coaches"
              value={stats?.coaches ?? 0}
              icon={Users}
              description="Club coaches"
            />
            <StatCard
              title="Upcoming Matches"
              value={stats?.upcomingMatches ?? 0}
              icon={Calendar}
              description="Scheduled matches"
            />
            <StatCard
              title="Completed Matches"
              value={stats?.completedMatches ?? 0}
              icon={Swords}
              description="Finished matches"
            />
          </>
        )}
      </div>
    </div>
  );
}

function LeagueAdminOverview() {
  const { data: stats, isLoading, error } = useSWR(
    "/api/dashboard/stats",
    authFetcher
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="League Dashboard"
        description="Overview of clubs, matches, and standings in your league."
      />
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load dashboard stats. Please try again.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Clubs"
              value={stats?.clubs ?? 0}
              icon={Shield}
              description="Clubs in league"
            />
            <StatCard
              title="Total Matches"
              value={stats?.totalMatches ?? 0}
              icon={Swords}
              description="All matches"
            />
            <StatCard
              title="Completed"
              value={stats?.completedMatches ?? 0}
              icon={Calendar}
              description="Finished matches"
            />
            <StatCard
              title="Live"
              value={stats?.liveMatches ?? 0}
              icon={Megaphone}
              description="In progress"
            />
            <StatCard
              title="Upcoming"
              value={stats?.upcomingMatches ?? 0}
              icon={Clock}
              description="Scheduled matches"
            />
          </>
        )}
      </div>
    </div>
  );
}

function MEAOverview() {
  const { data: stats, isLoading, error } = useSWR(
    "/api/dashboard/stats",
    authFetcher
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Match Event Dashboard"
        description="Overview of matches pending approval and live events."
      />
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load dashboard stats. Please try again.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Pending Approval"
              value={stats?.pendingApproval ?? 0}
              icon={Clock}
              description="Matches awaiting approval"
            />
            <StatCard
              title="Live Matches"
              value={stats?.liveMatches ?? 0}
              icon={Swords}
              description="Currently in progress"
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function DashboardOverview() {
  const { isSuperAdmin, isOrgAdmin, isClubAdmin, isLeagueAdmin, isMEA } = useAuth();

  if (isOrgAdmin()) {
    return <OrgAdminOverview />;
  }

  if (isClubAdmin()) {
    return <ClubAdminOverview />;
  }

  if (isLeagueAdmin()) {
    return <LeagueAdminOverview />;
  }

  if (isMEA()) {
    return <MEAOverview />;
  }

  // Default to Super Admin view
  return <SuperAdminOverview />;
}
