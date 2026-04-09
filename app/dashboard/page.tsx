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


function SuperAdminOverview() {
  const { data: stats, isLoading } = useSWR("/api/dashboard/stats", authFetcher, { fallbackData: undefined });
  const { data: recentMatches, isLoading: matchesLoading } = useSWR("/api/matches?limit=5", authFetcher);
  const { data: recentUsers, isLoading: usersLoading } = useSWR("/api/users?limit=5", authFetcher);
  const { data: leagues, isLoading: leaguesLoading } = useSWR("/api/leagues", authFetcher);

  const displayStats = stats || {};
  const matches = (recentMatches || []).slice(0, 5);
  const users = (recentUsers || []).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard Overview" description="Welcome to the Ethio-League management dashboard." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border bg-card"><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard title="Organizations" value={displayStats.organizations} icon={Building2} description="Registered organizations" />
            <StatCard title="Clubs" value={displayStats.clubs} icon={Shield} description="Active clubs" />
            <StatCard title="Players" value={displayStats.players} icon={UserCircle} description="Registered players" />
            <StatCard title="Users" value={displayStats.users} icon={Users} description="System users" />
            <StatCard title="Seasons" value={displayStats.seasons} icon={Calendar} description="Total seasons" />
            <StatCard title="Matches" value={displayStats.matches} icon={Swords} description="Total matches" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Leagues */}
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-base font-semibold">Leagues</CardTitle></CardHeader>
          <CardContent>
            {leaguesLoading ? <Skeleton className="h-32 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>League</TableHead>
                    <TableHead>Seasons</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(leagues || []).slice(0, 5).map((l: { id: string; name: string; status: string; _count: { seasons: number } }) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-sm font-medium">{l.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l._count?.seasons ?? 0}</TableCell>
                      <TableCell><StatusBadge status={l.status} /></TableCell>
                    </TableRow>
                  ))}
                  {(!leagues || leagues.length === 0) && (
                    <TableRow><TableCell colSpan={3} className="text-sm text-muted-foreground">No leagues yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Matches */}
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-base font-semibold">Recent Matches</CardTitle></CardHeader>
          <CardContent>
            {matchesLoading ? <Skeleton className="h-32 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Match</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((m: { id: string; homeClub: { name: string }; awayClub: { name: string }; homeScore: number | null; awayScore: number | null; status: string }) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{m.homeClub?.name}</span>
                          <span className="text-xs text-muted-foreground">vs {m.awayClub?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {m.homeScore != null && m.awayScore != null ? `${m.homeScore} - ${m.awayScore}` : "- vs -"}
                      </TableCell>
                      <TableCell><StatusBadge status={m.status} /></TableCell>
                    </TableRow>
                  ))}
                  {matches.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-sm text-muted-foreground">No matches yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Users */}
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-base font-semibold">Recent Users</CardTitle></CardHeader>
          <CardContent>
            {usersLoading ? <Skeleton className="h-32 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u: { id: string; fullName: string; email: string; status: string; userRoleScopes: Array<{ role: { name: string } }> }) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{u.fullName}</span>
                          <span className="text-xs text-muted-foreground">{u.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">
                        {u.userRoleScopes?.[0]?.role?.name?.replace(/_/g, " ") ?? "—"}
                      </TableCell>
                      <TableCell><StatusBadge status={u.status} /></TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-sm text-muted-foreground">No users yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OrgAdminOverview() {
  const { organization, isLoading: orgLoading } = useOrganization();

  const { data: stats, isLoading: statsLoading } = useSWR(
    "/api/dashboard/stats",
    authFetcher
  );

  const { data: leagues, isLoading: leaguesLoading } = useSWR(
    "/api/leagues",
    authFetcher
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
              value={displayStats.totalLeagues ?? 0}
              icon={Layers}
              description="Managed leagues"
            />
            <StatCard
              title="Active Leagues"
              value={displayStats.activeLeagues ?? 0}
              icon={Layers}
              description="Currently running"
            />
            <StatCard
              title="Total Clubs"
              value={displayStats.totalClubs ?? 0}
              icon={Shield}
              description="Registered clubs"
            />
            <StatCard
              title="Pending Clubs"
              value={displayStats.pendingClubs ?? 0}
              icon={Clock}
              description="Awaiting approval"
            />
            <StatCard
              title="Referees"
              value={displayStats.totalReferees ?? 0}
              icon={Megaphone}
              description="Active referees"
            />
            <StatCard
              title="Match Admins"
              value={displayStats.totalMatchEventAdmins ?? 0}
              icon={Users}
              description="Event administrators"
            />
            <StatCard
              title="Upcoming Matches"
              value={displayStats.upcomingMatches ?? 0}
              icon={Swords}
              description="Scheduled matches"
            />
          </>
        )}
      </div>

      {/* Leagues with season counts */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-card-foreground">
            Leagues
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaguesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : leagues && leagues.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>League</TableHead>
                  <TableHead>Seasons</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leagues.map((league: { id: string; name: string; status: string; _count: { seasons: number } }) => (
                  <TableRow key={league.id}>
                    <TableCell className="font-medium text-foreground">
                      {league.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {league._count.seasons}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={league.status ?? "inactive"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No leagues found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClubAdminOverview() {
  const { getClubId } = useAuth();
  const clubId = getClubId();

  const { data: stats, isLoading: statsLoading, error } = useSWR(
    "/api/dashboard/stats",
    authFetcher
  );

  // Fetch club details to get league/org context
  const { data: club, isLoading: clubLoading } = useSWR(
    clubId ? `/api/clubs/${clubId}` : null,
    authFetcher
  );

  // Seasons come from the club's seasonClubs relation
  const isLoading = statsLoading || clubLoading;
  const seasonClubs: Array<{ season: { id: string; name: string; status: string; league: { id: string; name: string; organization: { name: string } } } }> = club?.seasonClubs ?? [];
  const currentSeason = seasonClubs.find((sc) => sc.season.status === "active")?.season
    ?? seasonClubs[seasonClubs.length - 1]?.season
    ?? null;
  const league = currentSeason?.league ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={club ? `${club.name}` : "My Club Dashboard"}
        description={league ? `${league.organization?.name} · ${league.name}` : "Overview of your club's players, coaches, and matches."}
      />
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load dashboard stats. Please try again.
        </div>
      )}

      {/* Context cards */}
      {!clubLoading && (league || currentSeason) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {league?.organization?.name && (
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Organization</p>
                <p className="text-sm font-medium text-foreground">{league.organization.name}</p>
              </CardContent>
            </Card>
          )}
          {league?.name && (
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">League</p>
                <p className="text-sm font-medium text-foreground">{league.name}</p>
              </CardContent>
            </Card>
          )}
          {currentSeason && (
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Season</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{currentSeason.name}</p>
                  <StatusBadge status={currentSeason.status} />
                </div>
              </CardContent>
            </Card>
          )}
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
  const { getLeagueId } = useAuth();
  const leagueId = getLeagueId();

  const { data: stats, isLoading: statsLoading, error: statsError } = useSWR(
    "/api/dashboard/stats",
    authFetcher
  );

  const { data: league, isLoading: leagueLoading } = useSWR(
    leagueId ? `/api/leagues/${leagueId}` : null,
    authFetcher
  );

  const { data: seasons, isLoading: seasonsLoading } = useSWR(
    leagueId ? `/api/leagues/${leagueId}/seasons` : null,
    authFetcher
  );

  const isLoading = statsLoading || leagueLoading || seasonsLoading;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={league ? league.name : "League Dashboard"}
        description={
          league
            ? `Overview of clubs, matches, and standings in ${league.name}.`
            : "Overview of clubs, matches, and standings in your league."
        }
      />
      {statsError && (
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
              title="Total Seasons"
              value={stats?.totalSeasons ?? 0}
              icon={Calendar}
              description="Seasons in league"
            />
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

      {/* Seasons list */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-card-foreground">
            Seasons
          </CardTitle>
        </CardHeader>
        <CardContent>
          {seasonsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : seasons && seasons.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Season</TableHead>
                  <TableHead>Clubs</TableHead>
                  <TableHead>Matches</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasons.map((season: { id: string; name: string; status: string; _count: { seasonClubs: number; matches: number } }) => (
                  <TableRow key={season.id}>
                    <TableCell className="font-medium text-foreground">
                      {season.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {season._count.seasonClubs}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {season._count.matches}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={season.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No seasons found for this league.</p>
          )}
        </CardContent>
      </Card>
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
