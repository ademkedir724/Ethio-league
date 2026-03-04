"use client";

import useSWR from "swr";
import { authFetcher } from "@/lib/fetch-client";
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
} from "lucide-react";

// Mock data to display when API is not yet connected
const mockStats = {
  organizations: 4,
  clubs: 32,
  players: 640,
  users: 85,
  seasons: 6,
  matches: 248,
};

const mockRecentMatches = [
  { id: 1, homeClub: "Ethio Electric SC", awayClub: "St. George FC", score: "2 - 1", status: "completed", date: "2026-03-01" },
  { id: 2, homeClub: "Fasil Kenema FC", awayClub: "Hawassa Ketema FC", score: "0 - 0", status: "live", date: "2026-03-03" },
  { id: 3, homeClub: "Adama Ketema FC", awayClub: "Dire Dawa Ketema FC", score: "- vs -", status: "scheduled", date: "2026-03-06" },
  { id: 4, homeClub: "Wolaita Dicha FC", awayClub: "Sidama Bunna FC", score: "3 - 2", status: "completed", date: "2026-02-28" },
  { id: 5, homeClub: "Bahir Dar Ketema FC", awayClub: "Jimma Aba Jifar FC", score: "- vs -", status: "upcoming", date: "2026-03-08" },
];

const mockRecentUsers = [
  { id: 1, fullName: "Abebe Kebede", email: "abebe@ethioleague.com", role: "Organization Admin", status: "active" },
  { id: 2, fullName: "Tigist Haile", email: "tigist@ethioleague.com", role: "Club Admin", status: "active" },
  { id: 3, fullName: "Dawit Mengistu", email: "dawit@ethioleague.com", role: "League Admin", status: "pending" },
  { id: 4, fullName: "Sara Tesfaye", email: "sara@ethioleague.com", role: "Match Event Admin", status: "active" },
];

export default function DashboardOverview() {
  const { data: stats, isLoading } = useSWR("/api/dashboard/stats", authFetcher, {
    fallbackData: mockStats,
    onError: () => {},
  });

  const displayStats = stats || mockStats;

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
