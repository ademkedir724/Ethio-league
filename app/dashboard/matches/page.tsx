"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { authFetcher } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/org-context";
import { usePermissions } from "@/lib/use-permissions";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { FormDialog } from "@/components/dashboard/form-dialog";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Swords, Plus, MoreHorizontal, Pencil, Trash2, Play, CheckCircle, Eye } from "lucide-react";

interface Match {
  id: string;
  homeClub: string;
  awayClub: string;
  homeScore: number | null;
  awayScore: number | null;
  matchDate: string;
  stadium: string;
  season: string;
  league: string;
  roundNumber: number | null;
  status: string;
}

const mockMatches: Match[] = [
  { id: "1", homeClub: "St. George FC", awayClub: "Ethio Electric SC", homeScore: 2, awayScore: 1, matchDate: "2026-03-01T15:00:00", stadium: "Addis Ababa Stadium", season: "2025/26 Season", league: "Ethiopian Premier League", roundNumber: 18, status: "completed" },
  { id: "2", homeClub: "Fasil Kenema FC", awayClub: "Hawassa Ketema FC", homeScore: 0, awayScore: 0, matchDate: "2026-03-03T14:00:00", stadium: "Fasil Kenema Stadium", season: "2025/26 Season", league: "Ethiopian Premier League", roundNumber: 18, status: "live" },
  { id: "3", homeClub: "Adama Ketema FC", awayClub: "Dire Dawa Ketema FC", homeScore: null, awayScore: null, matchDate: "2026-03-06T15:00:00", stadium: "Adama Stadium", season: "2025/26 Season", league: "Ethiopian Premier League", roundNumber: 19, status: "scheduled" },
  { id: "4", homeClub: "Wolaita Dicha FC", awayClub: "Sidama Bunna FC", homeScore: 3, awayScore: 2, matchDate: "2026-02-28T16:00:00", stadium: "Wolaita Stadium", season: "2025/26 Season", league: "Ethiopian Premier League", roundNumber: 17, status: "completed" },
  { id: "5", homeClub: "Bahir Dar Ketema FC", awayClub: "Jimma Aba Jifar FC", homeScore: null, awayScore: null, matchDate: "2026-03-08T15:00:00", stadium: "Bahir Dar Stadium", season: "2025/26 Season", league: "Ethiopian Premier League", roundNumber: 19, status: "upcoming" },
  { id: "6", homeClub: "Ethio Electric SC", awayClub: "Fasil Kenema FC", homeScore: 1, awayScore: 1, matchDate: "2026-02-25T14:00:00", stadium: "Addis Ababa Stadium", season: "2025/26 Season", league: "Ethiopian Premier League", roundNumber: 17, status: "completed" },
  { id: "7", homeClub: "Dire Dawa Ketema FC", awayClub: "St. George FC", homeScore: null, awayScore: null, matchDate: "2026-03-10T15:00:00", stadium: "Dire Dawa Stadium", season: "2025/26 Season", league: "Ethiopian Premier League", roundNumber: 20, status: "upcoming" },
  { id: "8", homeClub: "Hawassa Ketema FC", awayClub: "Adama Ketema FC", homeScore: null, awayScore: null, matchDate: "2026-03-06T16:00:00", stadium: "Hawassa Stadium", season: "2025/26 Season", league: "Ethiopian Premier League", roundNumber: 19, status: "scheduled" },
  { id: "9", homeClub: "Sidama Bunna FC", awayClub: "Bahir Dar Ketema FC", homeScore: null, awayScore: null, matchDate: "2026-03-12T14:00:00", stadium: "Hawassa Stadium", season: "2025/26 Season", league: "Ethiopian Premier League", roundNumber: 20, status: "upcoming" },
  { id: "10", homeClub: "Jimma Aba Jifar FC", awayClub: "Wolaita Dicha FC", homeScore: 0, awayScore: 1, matchDate: "2026-03-01T14:00:00", stadium: "Jimma Stadium", season: "2025/26 Season", league: "Ethiopian Premier League", roundNumber: 18, status: "completed" },
];

const emptyForm = {
  homeClub: "",
  awayClub: "",
  matchDate: "",
  stadium: "",
  season: "",
  roundNumber: "",
};

export default function MatchesPage() {
  const { organization, isLoading: orgLoading } = useOrganization();
  const { getOrganizationId, isOrgAdmin, isSuperAdmin } = useAuth();
  const { canManage, isViewOnly } = usePermissions();
  const orgId = getOrganizationId();

  // Org admins see matches from their organization's leagues, super admins see all
  const apiUrl = isOrgAdmin() && orgId
    ? `/api/matches?organizationId=${orgId}`
    : "/api/matches";

  const { data, isLoading: matchesLoading } = useSWR(apiUrl, authFetcher, {
    fallbackData: mockMatches,
    onError: () => {},
  });

  const matches: Match[] = data || mockMatches;
  const isLoading = orgLoading || matchesLoading;

  // Org admin is strictly view-only for matches
  // Only league admin and match event admin can manage matches
  const canEdit = canManage("matches") && !isOrgAdmin();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Match | null>(null);
  const [form, setForm] = useState(emptyForm);

  const leagues = useMemo(() => {
    const set = new Set(matches.map((m) => m.league));
    return Array.from(set).sort();
  }, [matches]);

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      const matchesSearch =
        m.homeClub.toLowerCase().includes(search.toLowerCase()) ||
        m.awayClub.toLowerCase().includes(search.toLowerCase()) ||
        m.stadium.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || m.status === statusFilter;
      const matchesLeague = leagueFilter === "all" || m.league === leagueFilter;
      return matchesSearch && matchesStatus && matchesLeague;
    });
  }, [matches, search, statusFilter, leagueFilter]);

  const stats = useMemo(() => {
    const completed = matches.filter((m) => m.status === "completed").length;
    const live = matches.filter((m) => m.status === "live").length;
    const upcoming = matches.filter((m) => m.status === "upcoming" || m.status === "scheduled").length;
    return { total: matches.length, completed, live, upcoming };
  }, [matches]);

  const openCreate = () => {
    setEditingMatch(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (match: Match) => {
    setEditingMatch(match);
    setForm({
      homeClub: match.homeClub,
      awayClub: match.awayClub,
      matchDate: match.matchDate.slice(0, 16),
      stadium: match.stadium,
      season: match.season,
      roundNumber: match.roundNumber?.toString() || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    await new Promise((r) => setTimeout(r, 500));
  };

  const handleDelete = async () => {
    await new Promise((r) => setTimeout(r, 500));
  };

  const formatDateTime = (d: string) => {
    const date = new Date(d);
    return {
      date: date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const columns: Column<Match>[] = [
    {
      key: "match",
      header: "Match",
      render: (m) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{m.homeClub}</span>
          <span className="text-xs text-muted-foreground">vs {m.awayClub}</span>
        </div>
      ),
    },
    {
      key: "score",
      header: "Score",
      render: (m) => (
        <span className="font-mono text-sm font-semibold text-foreground">
          {m.homeScore !== null && m.awayScore !== null
            ? `${m.homeScore} - ${m.awayScore}`
            : "- vs -"}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date / Time",
      className: "hidden md:table-cell",
      render: (m) => {
        const { date, time } = formatDateTime(m.matchDate);
        return (
          <div className="flex flex-col">
            <span className="text-sm text-foreground">{date}</span>
            <span className="text-xs text-muted-foreground">{time}</span>
          </div>
        );
      },
    },
    {
      key: "league",
      header: "League",
      className: "hidden lg:table-cell",
      render: (m) => (
        <span className="text-sm text-muted-foreground line-clamp-1">{m.league}</span>
      ),
    },
    {
      key: "round",
      header: "Round",
      className: "hidden lg:table-cell",
      render: (m) => (
        <span className="text-sm text-muted-foreground">
          {m.roundNumber ? `Round ${m.roundNumber}` : "N/A"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (m) => <StatusBadge status={m.status} />,
    },
    // Actions column
    ...(canEdit
      ? [
          {
            key: "actions",
            header: "",
            className: "w-12",
            render: (m: Match) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => openEdit(m)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  {(m.status === "scheduled" || m.status === "upcoming") && (
                    <DropdownMenuItem className="text-emerald-400 focus:text-emerald-400">
                      <Play className="mr-2 h-4 w-4" />
                      Start Match
                    </DropdownMenuItem>
                  )}
                  {m.status === "live" && (
                    <DropdownMenuItem className="text-blue-400 focus:text-blue-400">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      End Match
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteTarget(m)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]
      : [
          // View-only action for org admin / super admin
          {
            key: "actions",
            header: "",
            className: "w-12",
            render: (m: Match) => (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span className="sr-only">View</span>
              </Button>
            ),
          },
        ]),
  ];

  const pageTitle = isOrgAdmin() && organization
    ? `${organization.name} - Matches`
    : "Matches";

  const pageDescription = isOrgAdmin()
    ? "View match fixtures, scores, and results for your organization's leagues."
    : canEdit
    ? "Manage match fixtures, scores, and results."
    : "View match fixtures, scores, and results.";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={pageTitle} description={pageDescription}>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Match
          </Button>
        )}
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Total Matches" value={stats.total} icon={Swords} />
        <StatCard title="Completed" value={stats.completed} icon={Swords} description="Finished matches" />
        <StatCard title="Live" value={stats.live} icon={Swords} description="Currently playing" />
        <StatCard title="Upcoming" value={stats.upcoming} icon={Swords} description="Scheduled fixtures" />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search matches..."
        emptyMessage="No matches found."
        filterSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={leagueFilter} onValueChange={setLeagueFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="League" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leagues</SelectItem>
                {leagues.map((league) => (
                  <SelectItem key={league} value={league}>
                    {league}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="postponed">Postponed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Create / Edit Dialog (only shown if canEdit) */}
      {canEdit && (
        <>
          <FormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            title={editingMatch ? "Edit Match" : "Schedule Match"}
            description={editingMatch ? "Update match details." : "Schedule a new match fixture."}
            submitLabel={editingMatch ? "Update" : "Schedule"}
            onSubmit={handleSubmit}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="match-home">Home Club</Label>
                <Input id="match-home" value={form.homeClub} onChange={(e) => setForm({ ...form, homeClub: e.target.value })} placeholder="St. George FC" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="match-away">Away Club</Label>
                <Input id="match-away" value={form.awayClub} onChange={(e) => setForm({ ...form, awayClub: e.target.value })} placeholder="Ethio Electric SC" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="match-date">Match Date & Time</Label>
                <Input id="match-date" type="datetime-local" value={form.matchDate} onChange={(e) => setForm({ ...form, matchDate: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="match-round">Round Number</Label>
                <Input id="match-round" type="number" value={form.roundNumber} onChange={(e) => setForm({ ...form, roundNumber: e.target.value })} placeholder="1" />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="match-stadium">Stadium</Label>
                <Input id="match-stadium" value={form.stadium} onChange={(e) => setForm({ ...form, stadium: e.target.value })} placeholder="Addis Ababa Stadium" />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="match-season">Season</Label>
                <Input id="match-season" value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} placeholder="2025/26 Season" />
              </div>
            </div>
          </FormDialog>

          {/* Delete Confirmation */}
          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(open) => !open && setDeleteTarget(null)}
            title="Delete Match"
            description={`Are you sure you want to delete "${deleteTarget?.homeClub} vs ${deleteTarget?.awayClub}"? This action cannot be undone.`}
            confirmLabel="Delete"
            variant="destructive"
            onConfirm={handleDelete}
          />
        </>
      )}
    </div>
  );
}
