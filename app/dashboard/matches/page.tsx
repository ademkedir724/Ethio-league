"use client";

import { useState, useMemo, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/org-context";
import { usePermissions } from "@/lib/use-permissions";
import { usePaginated } from "@/lib/use-paginated";
import { Pagination } from "@/components/dashboard/pagination";
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
import { Swords, Plus, MoreHorizontal, Pencil, Trash2, Play, CheckCircle, Eye, Shuffle, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Match {
  id: string;
  homeClub: { id: string; name: string; shortName?: string | null; logoUrl?: string | null };
  awayClub: { id: string; name: string; shortName?: string | null; logoUrl?: string | null };
  homeScore: number | null;
  awayScore: number | null;
  matchDate: string;
  liveStartedAt?: string | null;
  stadium: { id: string; name: string } | null;
  season: { id: string; name: string; leagueId: string };
  roundNumber: number | null;
  status: string;
}

const emptyForm = {
  homeClub: "",
  awayClub: "",
  matchDate: "",
  stadium: "",
  season: "",
  roundNumber: "",
};

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [minutes, setMinutes] = useState(() =>
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
  );
  useEffect(() => {
    const id = setInterval(() => {
      setMinutes(Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
    }, 30000);
    return () => clearInterval(id);
  }, [startedAt]);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
      {minutes}&apos;
    </span>
  );
}

export default function MatchesPage() {
  const router = useRouter();
  const { organization, isLoading: orgLoading } = useOrganization();
  const { getOrganizationId, isOrgAdmin, isSuperAdmin, isLeagueAdmin, getLeagueId } = useAuth();
  const { canManage, isViewOnly } = usePermissions();
  const orgId = getOrganizationId();

  const leagueId = getLeagueId();

  // Build API URL based on role — matches API filters by role server-side
  const apiUrl = "/api/matches";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState("all");

  const { items: matches, pagination, setPage, setLimit, isLoading: matchesLoading, error, mutate: mutateMatches } = usePaginated<Match>(
    apiUrl,
    {
      defaultLimit: 20,
      extraParams: {
        search: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      },
    }
  );
  const isLoading = orgLoading || matchesLoading;

  // Org admin is strictly view-only for matches
  // Only league admin and match event admin can manage matches
  const canEdit = canManage("matches") && !isOrgAdmin();

  const [formOpen, setFormOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Match | null>(null);
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const leagues = useMemo(() => {
    const set = new Set(matches.map((m) => m.season?.name ?? ""));
    return Array.from(set).filter(Boolean).sort();
  }, [matches]);

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      const matchesLeague = leagueFilter === "all" || (m.season?.name ?? "") === leagueFilter;
      return matchesLeague;
    });
  }, [matches, leagueFilter]);

  const stats = useMemo(() => {
    const completed = matches.filter((m) => m.status === "completed").length;
    const live = matches.filter((m) => m.status === "live").length;
    const upcoming = matches.filter((m) => m.status === "upcoming" || m.status === "scheduled").length;
    return { total: pagination.total, completed, live, upcoming };
  }, [matches, pagination.total]);

  const openCreate = () => {
    setEditingMatch(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (match: Match) => {
    setEditingMatch(match);
    setForm({
      homeClub: match.homeClub?.name ?? "",
      awayClub: match.awayClub?.name ?? "",
      matchDate: match.matchDate.slice(0, 16),
      stadium: match.stadium?.name ?? "",
      season: match.season?.name ?? "",
      roundNumber: match.roundNumber?.toString() ?? "",
    });
    setFormOpen(true);
  };

  const handleGenerateFixtures = () => {
    setGenerateConfirmOpen(true);
  };

  const doGenerateFixtures = async () => {
    if (!leagueId) return;
    try {
      // Find active/upcoming season for this league
      const seasonsRes = await fetchWithAuth(`/api/leagues/${leagueId}/seasons`);
      const seasonsData = await seasonsRes.json();
      const activeSeason = (seasonsData.data || seasonsData || []).find(
        (s: { status: string; id: string }) => s.status === "upcoming" || s.status === "active"
      );
      if (!activeSeason) {
        toast.error("No active or upcoming season found for this league.");
        return;
      }
      const res = await fetchWithAuth("/api/matches/fixtures", {
        method: "POST",
        body: JSON.stringify({ seasonId: activeSeason.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to generate fixtures");
        return;
      }
      toast.success("Fixtures generated successfully");
      mutateMatches();
    } catch {
      toast.error("Failed to generate fixtures");
    }
  };

  const handleStartMatch = async (m: Match) => {
    try {
      const res = await fetchWithAuth(`/api/matches/${m.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "live" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to start match");
        return;
      }
      toast.success("Match started");
      mutateMatches();
    } catch {
      toast.error("Failed to start match");
    }
  };

  const handleEndMatch = async (m: Match) => {
    try {
      const res = await fetchWithAuth(`/api/matches/${m.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to end match");
        return;
      }
      toast.success("Match ended");
      mutateMatches();
    } catch {
      toast.error("Failed to end match");
    }
  };

  const handleSubmit = async () => {
    if (!editingMatch) return;
    try {
      const res = await fetchWithAuth(`/api/matches/${editingMatch.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          matchDate: form.matchDate,
          roundNumber: form.roundNumber ? Number(form.roundNumber) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to update match");
        return;
      }
      toast.success("Match updated");
      mutateMatches();
    } catch {
      toast.error("Failed to update match");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchWithAuth(`/api/matches/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete match");
        return;
      }
      toast.success("Match deleted");
      mutateMatches();
    } catch {
      toast.error("Failed to delete match");
    }
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
        <div
          className="flex flex-col gap-1 cursor-pointer hover:opacity-80"
          onClick={() => router.push(`/dashboard/matches/${m.id}`)}
        >
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              {m.homeClub?.logoUrl && <AvatarImage src={m.homeClub.logoUrl} alt={m.homeClub.name} />}
              <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                {m.homeClub?.name?.[0] ?? "H"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground">{m.homeClub?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              {m.awayClub?.logoUrl && <AvatarImage src={m.awayClub.logoUrl} alt={m.awayClub.name} />}
              <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                {m.awayClub?.name?.[0] ?? "A"}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">{m.awayClub?.name}</span>
          </div>
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
      header: "Season",
      className: "hidden lg:table-cell",
      render: (m) => (
        <span className="text-sm text-muted-foreground line-clamp-1">{m.season?.name}</span>
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
      render: (m) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={m.status} />
          {m.status === "live" && m.liveStartedAt && (
            <LiveTimer startedAt={m.liveStartedAt} />
          )}
        </div>
      ),
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
                <DropdownMenuItem onClick={() => router.push(`/dashboard/matches/${m.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEdit(m)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {(m.status === "scheduled" || m.status === "upcoming") && (
                  <DropdownMenuItem
                    className="text-emerald-400 focus:text-emerald-400"
                    onClick={() => handleStartMatch(m)}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start Match
                  </DropdownMenuItem>
                )}
                {m.status === "live" && (
                  <DropdownMenuItem
                    className="text-blue-400 focus:text-blue-400"
                    onClick={() => handleEndMatch(m)}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    End Match
                  </DropdownMenuItem>
                )}
                {isLeagueAdmin() && (
                  <DropdownMenuItem
                    onClick={() => toast.info("Official assignment coming soon")}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Assign Officials
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => router.push(`/dashboard/matches/${m.id}`)}
            >
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
        {isLeagueAdmin() && (
          <Button variant="outline" onClick={handleGenerateFixtures}>
            <Shuffle className="h-4 w-4" />
            Generate Fixtures
          </Button>
        )}
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Match
          </Button>
        )}
      </PageHeader>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load matches. Please try again.
        </div>
      )}

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
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search matches..."
        emptyMessage="No matches found."
        filterSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={leagueFilter} onValueChange={(v) => { setLeagueFilter(v); setPage(1); }}>
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
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        limit={pagination.limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
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
                <Label htmlFor="match-home">Home Club *</Label>
                <Input id="match-home" value={form.homeClub} onChange={(e) => setForm({ ...form, homeClub: e.target.value })} placeholder="St. George FC" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="match-away">Away Club *</Label>
                <Input id="match-away" value={form.awayClub} onChange={(e) => setForm({ ...form, awayClub: e.target.value })} placeholder="Ethio Electric SC" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="match-date">Match Date & Time *</Label>
                <Input id="match-date" type="datetime-local" value={form.matchDate} onChange={(e) => setForm({ ...form, matchDate: e.target.value })} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="match-round">
                  Round Number <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input id="match-round" type="number" value={form.roundNumber} onChange={(e) => setForm({ ...form, roundNumber: e.target.value })} placeholder="1" min={1} max={100} />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="match-stadium">
                  Stadium <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input id="match-stadium" value={form.stadium} onChange={(e) => setForm({ ...form, stadium: e.target.value })} placeholder="Addis Ababa Stadium" />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="match-season">Season *</Label>
                <Input id="match-season" value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} placeholder="2025/26 Season" required />
              </div>
            </div>
          </FormDialog>

          {/* Delete Confirmation */}
          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(open) => !open && setDeleteTarget(null)}
            title="Delete Match"
            description={`Are you sure you want to delete "${deleteTarget?.homeClub?.name} vs ${deleteTarget?.awayClub?.name}"? This action cannot be undone.`}
            confirmLabel="Delete"
            variant="destructive"
            onConfirm={handleDelete}
          />
        </>
      )}

      {/* Generate Fixtures Confirmation */}
      {isLeagueAdmin() && (
        <ConfirmDialog
          open={generateConfirmOpen}
          onOpenChange={setGenerateConfirmOpen}
          title="Generate Fixtures"
          description="This will delete all existing fixtures. Continue?"
          confirmLabel="Generate"
          variant="destructive"
          onConfirm={doGenerateFixtures}
        />
      )}
    </div>
  );
}
