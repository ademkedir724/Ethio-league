"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import useSWR from "swr";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/use-permissions";
import { usePaginated } from "@/lib/use-paginated";
import { Pagination } from "@/components/dashboard/pagination";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { FormDialog } from "@/components/dashboard/form-dialog";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { StatCard } from "@/components/dashboard/stat-card";
import { ErrorState } from "@/components/dashboard/error-state";
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
import { Calendar, Eye, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface League {
  id: string;
  name: string;
}

interface Season {
  id: string;
  name: string;
  leagueId: string;
  league: { id: string; name: string; organization: { id: string; name: string } };
  startDate: string;
  endDate: string;
  status: string;
  _count: { seasonClubs: number; matches: number };
}

const emptyForm = {
  name: "",
  leagueId: "",
  startDate: "",
  endDate: "",
  pointsWin: "3",
  pointsDraw: "1",
  pointsLoss: "0",
  minSquadSize: "14",
  minStartingPlayers: "11",
  maxBenchPlayers: "7",
  rules: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SeasonsPage() {
  const { isLeagueAdmin, getLeagueId } = useAuth();
  const { canManage } = usePermissions();
  const router = useRouter();
  const canEdit = canManage("seasons");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { items: seasons, pagination, setPage, setLimit, isLoading, error, mutate: mutateSeasonsData } = usePaginated<Season>(
    "/api/seasons",
    {
      defaultLimit: 20,
      extraParams: {
        search: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      },
    }
  );

  // Fetch leagues for the create form (league selector)
  const { data: leaguesData } = useSWR<League[]>(
    canEdit ? "/api/leagues?limit=100" : null,
    authFetcher
  );

  const leagues: League[] = leaguesData ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Season | null>(null);
  const [form, setForm] = useState(emptyForm);

  const stats = useMemo(() => {
    const active = seasons.filter((s) => s.status === "active").length;
    const totalMatches = seasons.reduce((sum, s) => sum + (s._count?.matches ?? 0), 0);
    return { total: pagination.total, active, totalMatches };
  }, [seasons, pagination.total]);

  const openCreate = () => {
    setEditingSeason(null);
    // Pre-select league for league_admin
    const defaultLeagueId = isLeagueAdmin() ? (getLeagueId() ?? "") : "";
    setForm({ ...emptyForm, leagueId: defaultLeagueId });
    setFormOpen(true);
  };

  const openEdit = (season: Season) => {
    setEditingSeason(season);
    setForm({
      name: season.name,
      leagueId: season.leagueId,
      startDate: season.startDate ? season.startDate.slice(0, 10) : "",
      endDate: season.endDate ? season.endDate.slice(0, 10) : "",
      pointsWin: "3",
      pointsDraw: "1",
      pointsLoss: "0",
      minSquadSize: String((season as any).minSquadSize ?? 14),
      minStartingPlayers: String((season as any).minStartingPlayers ?? 11),
      maxBenchPlayers: String((season as any).maxBenchPlayers ?? 7),
      rules: (season as any).rules ?? "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Season name is required");
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast.error("Start and end dates are required");
      return;
    }

    if (editingSeason) {
      const res = await fetchWithAuth(`/api/seasons/${editingSeason.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          startDate: form.startDate,
          endDate: form.endDate,
          pointsWin: parseInt(form.pointsWin),
          pointsDraw: parseInt(form.pointsDraw),
          pointsLoss: parseInt(form.pointsLoss),
          minSquadSize: parseInt(form.minSquadSize),
          minStartingPlayers: parseInt(form.minStartingPlayers),
          maxBenchPlayers: parseInt(form.maxBenchPlayers),
          rules: form.rules || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to update season");
        throw new Error(data.error || "Failed to update season");
      }
      toast.success("Season updated");
    } else {
      if (!form.leagueId) {
        toast.error("Please select a league");
        return;
      }
      const res = await fetchWithAuth("/api/seasons", {
        method: "POST",
        body: JSON.stringify({
          leagueId: form.leagueId,
          name: form.name,
          startDate: form.startDate,
          endDate: form.endDate,
          pointsWin: parseInt(form.pointsWin),
          pointsDraw: parseInt(form.pointsDraw),
          pointsLoss: parseInt(form.pointsLoss),
          minSquadSize: parseInt(form.minSquadSize),
          minStartingPlayers: parseInt(form.minStartingPlayers),
          maxBenchPlayers: parseInt(form.maxBenchPlayers),
          rules: form.rules || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to create season");
        throw new Error(data.error || "Failed to create season");
      }
      toast.success("Season created");
    }
    setFormOpen(false);
    mutateSeasonsData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetchWithAuth(`/api/seasons/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to delete season");
      return;
    }
    toast.success("Season deleted");
    setDeleteTarget(null);
    mutateSeasonsData();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const columns: Column<Season>[] = [
    {
      key: "season",
      header: "Season",
      render: (s) => (
        <div className="flex flex-col cursor-pointer" onClick={() => router.push(`/dashboard/seasons/${s.id}`)}>
          <span className="text-sm font-medium text-foreground hover:text-primary transition-colors">{s.name}</span>
          <span className="text-xs text-muted-foreground">{s.league?.name}</span>
        </div>
      ),
    },
    {
      key: "organization",
      header: "Organization",
      className: "hidden md:table-cell",
      render: (s) => (
        <span className="text-sm text-muted-foreground">
          {s.league?.organization?.name}
        </span>
      ),
    },
    {
      key: "period",
      header: "Period",
      className: "hidden lg:table-cell",
      render: (s) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(s.startDate)} – {formatDate(s.endDate)}
        </span>
      ),
    },
    {
      key: "clubs",
      header: "Clubs",
      className: "hidden lg:table-cell",
      render: (s) => (
        <span className="text-sm text-foreground">{s._count?.seasonClubs ?? 0}</span>
      ),
    },
    {
      key: "matches",
      header: "Matches",
      className: "hidden xl:table-cell",
      render: (s) => (
        <span className="text-sm text-foreground">{s._count?.matches ?? 0}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (s) => <StatusBadge status={s.status} />,
    },
    ...(canEdit
      ? [
        {
          key: "actions",
          header: "",
          className: "w-12",
          render: (s: Season) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => router.push(`/dashboard/seasons/${s.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Manage
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEdit(s)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteTarget(s)}
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
        {
          key: "actions",
          header: "",
          className: "w-12",
          render: (s: Season) => (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => router.push(`/dashboard/seasons/${s.id}`)}
            >
              <Eye className="h-4 w-4" />
              <span className="sr-only">View</span>
            </Button>
          ),
        },
      ]),
  ];

  return (
    <div className="flex flex-col gap-6">
      {error && <ErrorState />}
      <PageHeader
        title="Seasons"
        description={
          canEdit
            ? "Manage league seasons and their configurations."
            : "View league seasons and their configurations."
        }
      >
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Season
          </Button>
        )}
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Seasons" value={stats.total} icon={Calendar} />
        <StatCard
          title="Active Seasons"
          value={stats.active}
          icon={Calendar}
          description="Currently running"
        />
        <StatCard
          title="Total Matches"
          value={stats.totalMatches}
          icon={Calendar}
          description="Across all seasons"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={seasons}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search seasons..."
        emptyMessage="No seasons found."
        filterSlot={
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
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

      {/* Create / Edit Dialog */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingSeason ? "Edit Season" : "Create Season"}
        description={
          editingSeason ? "Update season details." : "Set up a new league season."
        }
        submitLabel={editingSeason ? "Update" : "Create"}
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="season-name">Season Name *</Label>
            <Input
              id="season-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="2025/26 Season"
            />
          </div>

          {/* League selector — shown for create; hidden for edit (league can't change) */}
          {!editingSeason && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="season-league">League *</Label>
              <Select
                value={form.leagueId || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, leagueId: v === "none" ? "" : v })
                }
              >
                <SelectTrigger id="season-league">
                  <SelectValue placeholder="Select a league" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select a league</SelectItem>
                  {leagues.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="season-start">Start Date *</Label>
            <Input
              id="season-start"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="season-end">End Date *</Label>
            <Input
              id="season-end"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="season-pw">Points for Win</Label>
            <Input
              id="season-pw"
              type="number"
              value={form.pointsWin}
              onChange={(e) => setForm({ ...form, pointsWin: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="season-pd">Points for Draw</Label>
            <Input
              id="season-pd"
              type="number"
              value={form.pointsDraw}
              onChange={(e) => setForm({ ...form, pointsDraw: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="season-squad">Min Squad Size</Label>
            <Input
              id="season-squad"
              type="number"
              min={1}
              value={form.minSquadSize}
              onChange={(e) => setForm({ ...form, minSquadSize: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="season-starters">Starting Players</Label>
            <Input
              id="season-starters"
              type="number"
              min={1}
              value={form.minStartingPlayers}
              onChange={(e) => setForm({ ...form, minStartingPlayers: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="season-bench">Max Bench Players</Label>
            <Input
              id="season-bench"
              type="number"
              min={0}
              value={form.maxBenchPlayers}
              onChange={(e) => setForm({ ...form, maxBenchPlayers: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="season-rules">League Rules</Label>
            <textarea
              id="season-rules"
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Max 3 foreign players per lineup. Yellow card accumulation: 3 cards = 1 match ban."
              value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
            />
          </div>
        </div>
      </FormDialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Season"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? All associated matches will also be removed.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
