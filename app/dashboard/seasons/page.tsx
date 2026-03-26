"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { usePermissions } from "@/lib/use-permissions";
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
import { Calendar, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Season {
  id: string;
  name: string;
  leagueName: string;
  organization: string;
  startDate: string;
  endDate: string;
  status: string;
  clubCount: number;
  matchCount: number;
}

const emptyForm = {
  name: "",
  leagueName: "",
  organization: "",
  startDate: "",
  endDate: "",
  pointsWin: "3",
  pointsDraw: "1",
  pointsLoss: "0",
};

export default function SeasonsPage() {
  const { data, isLoading, error } = useSWR("/api/seasons", authFetcher, {
    fallbackData: undefined,
  });

  const seasons: Season[] = data || [];
  const { canManage } = usePermissions();
  const canEdit = canManage("seasons");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Season | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    return seasons.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.leagueName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [seasons, search, statusFilter]);

  const stats = useMemo(() => {
    const active = seasons.filter((s) => s.status === "active").length;
    const totalMatches = seasons.reduce((sum, s) => sum + s.matchCount, 0);
    return { total: seasons.length, active, totalMatches };
  }, [seasons]);

  const openCreate = () => {
    setEditingSeason(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (season: Season) => {
    setEditingSeason(season);
    setForm({
      name: season.name,
      leagueName: season.leagueName,
      organization: season.organization,
      startDate: season.startDate,
      endDate: season.endDate,
      pointsWin: "3",
      pointsDraw: "1",
      pointsLoss: "0",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (editingSeason) {
      const res = await fetchWithAuth(`/api/seasons/${editingSeason.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          leagueName: form.leagueName,
          organizationId: form.organization,
          startDate: form.startDate,
          endDate: form.endDate,
          pointsWin: parseInt(form.pointsWin),
          pointsDraw: parseInt(form.pointsDraw),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to update season");
        throw new Error(data.error || "Failed to update season");
      }
      toast.success("Season updated");
    } else {
      const res = await fetchWithAuth("/api/seasons", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          leagueName: form.leagueName,
          organizationId: form.organization,
          startDate: form.startDate,
          endDate: form.endDate,
          pointsWin: parseInt(form.pointsWin),
          pointsDraw: parseInt(form.pointsDraw),
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
    mutate("/api/seasons");
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
    mutate("/api/seasons");
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const columns: Column<Season>[] = [
    {
      key: "season",
      header: "Season",
      render: (s) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{s.name}</span>
          <span className="text-xs text-muted-foreground">{s.leagueName}</span>
        </div>
      ),
    },
    {
      key: "organization",
      header: "Organization",
      className: "hidden md:table-cell",
      render: (s) => (
        <span className="text-sm text-muted-foreground">{s.organization}</span>
      ),
    },
    {
      key: "period",
      header: "Period",
      className: "hidden lg:table-cell",
      render: (s) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(s.startDate)} - {formatDate(s.endDate)}
        </span>
      ),
    },
    {
      key: "clubs",
      header: "Clubs",
      className: "hidden lg:table-cell",
      render: (s) => (
        <span className="text-sm text-foreground">{s.clubCount}</span>
      ),
    },
    {
      key: "matches",
      header: "Matches",
      className: "hidden xl:table-cell",
      render: (s) => (
        <span className="text-sm text-foreground">{s.matchCount}</span>
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
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
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
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      {error && <ErrorState />}
      <PageHeader title="Seasons" description={canEdit ? "Manage league seasons and their configurations." : "View league seasons and their configurations."}>
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
        <StatCard title="Active Seasons" value={stats.active} icon={Calendar} description="Currently running" />
        <StatCard title="Total Matches" value={stats.totalMatches} icon={Calendar} description="Across all seasons" />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search seasons..."
        emptyMessage="No seasons found."
        filterSlot={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Create / Edit Dialog */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingSeason ? "Edit Season" : "Create Season"}
        description={editingSeason ? "Update season details." : "Set up a new league season."}
        submitLabel={editingSeason ? "Update" : "Create"}
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="season-name">Season Name</Label>
            <Input id="season-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="2025/26 Season" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="season-league">League Name</Label>
            <Input id="season-league" value={form.leagueName} onChange={(e) => setForm({ ...form, leagueName: e.target.value })} placeholder="Ethiopian Premier League" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="season-org">Organization</Label>
            <Input id="season-org" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} placeholder="EFF" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="season-start">Start Date</Label>
            <Input id="season-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="season-end">End Date</Label>
            <Input id="season-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="season-pw">Points for Win</Label>
            <Input id="season-pw" type="number" value={form.pointsWin} onChange={(e) => setForm({ ...form, pointsWin: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="season-pd">Points for Draw</Label>
            <Input id="season-pd" type="number" value={form.pointsDraw} onChange={(e) => setForm({ ...form, pointsDraw: e.target.value })} />
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
