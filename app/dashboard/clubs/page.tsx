"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Shield, Plus, MoreHorizontal, Check, X, Eye,
  MapPin, ShieldCheck, Link as LinkIcon, Copy,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Season {
  id: string;
  name: string;
  status: string;
}

interface Club {
  id: string;
  name: string;
  shortName?: string | null;
  city?: string | null;
  country?: string | null;
  foundedYear?: number | null;
  status: string;
  primaryStadium?: { id: string; name: string } | null;
  _count?: { seasonClubs: number };
}

const emptyCreateForm = {
  name: "",
  adminFullName: "",
  adminEmail: "",
  adminPhone: "",
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── League Admin View ────────────────────────────────────────────────────────

function LeagueAdminClubsView() {
  const { getLeagueId } = useAuth();
  const leagueId = getLeagueId();

  const { data: clubsData, isLoading: clubsLoading, error } = useSWR<Club[]>(
    "/api/clubs",
    authFetcher
  );

  // Fetch seasons for this league to populate the season selector
  const { data: seasonsData } = useSWR<Season[]>(
    leagueId ? `/api/leagues/${leagueId}/seasons` : null,
    authFetcher
  );

  const clubs: Club[] = clubsData ?? [];
  const seasons: Season[] = seasonsData ?? [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyCreateForm);
  const [isSaving, setIsSaving] = useState(false);
  const [setupLink, setSetupLink] = useState<string | null>(null);
  const [setupEmail, setSetupEmail] = useState("");

  const filtered = useMemo(() => {
    return clubs.filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [clubs, search, statusFilter]);

  const stats = useMemo(() => ({
    total: clubs.length,
    active: clubs.filter((c) => c.status === "active").length,
    pending: clubs.filter((c) => c.status === "pending").length,
  }), [clubs]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Club name is required"); return; }
    if (!form.adminFullName.trim()) { toast.error("Club Admin full name is required"); return; }
    if (!form.adminEmail.trim()) { toast.error("Club Admin email is required"); return; }

    setIsSaving(true);
    try {
      const res = await fetchWithAuth("/api/clubs", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          adminFullName: form.adminFullName.trim(),
          adminEmail: form.adminEmail.trim(),
          adminPhone: form.adminPhone.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to create club");
        return;
      }

      const result = await res.json();
      const link: string | null = result.adminSetupLink ?? null;

      setSetupEmail(form.adminEmail.trim());
      if (link) setSetupLink(link);

      toast.success("Club created");
      setCreateOpen(false);
      setForm(emptyCreateForm);
      mutate("/api/clubs");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => { /* removed — org admin only */ };
  const handleReject = async () => { /* removed — org admin only */ };

  const columns: Column<Club>[] = [
    {
      key: "name",
      header: "Club",
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {getInitials(c.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{c.name}</span>
            {c.shortName && <span className="text-xs text-muted-foreground">{c.shortName}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "city",
      header: "City",
      className: "hidden md:table-cell",
      render: (c) => c.city ? (
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{c.city}</span>
        </div>
      ) : <span className="text-sm text-muted-foreground">—</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      render: (c) => (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clubs" description="Manage clubs in your league.">
        <Button onClick={() => { setForm(emptyCreateForm); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" />
          Create Club
        </Button>
      </PageHeader>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load clubs. Please try again.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Total Clubs" value={stats.total} icon={Shield} />
        <StatCard title="Active" value={stats.active} icon={Shield} description="Approved" />
        <StatCard title="Pending" value={stats.pending} icon={Shield} description="Awaiting approval" />
      </div>

      {clubsLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={false}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search clubs..."
          emptyMessage="No clubs found."
          filterSlot={
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      )}

      {/* Create Club Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) setCreateOpen(false); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Club</DialogTitle>
            <DialogDescription>
              Create a new club and its Club Admin account. The admin will receive a password setup link.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="club-name">Club Name *</Label>
              <Input
                id="club-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="St. George FC"
              />
            </div>

            <Separator />

            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Club Admin *</p>
              <p className="text-xs text-muted-foreground">
                A Club Admin account will be created and linked to this club.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-name">Full Name *</Label>
              <Input
                id="admin-name"
                value={form.adminFullName}
                onChange={(e) => setForm({ ...form, adminFullName: e.target.value })}
                placeholder="Abebe Kebede"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-email">Email *</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                  placeholder="admin@club.com"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-phone">Phone</Label>
                <Input
                  id="admin-phone"
                  value={form.adminPhone}
                  onChange={(e) => setForm({ ...form, adminPhone: e.target.value })}
                  placeholder="+251 911 234 567"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? "Creating..." : "Create Club"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Setup Link Dialog */}
      <Dialog open={!!setupLink} onOpenChange={(open) => { if (!open) { setSetupLink(null); setSetupEmail(""); } }}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
              Club Admin Created
            </DialogTitle>
            <DialogDescription>
              The Club Admin account for <strong>{setupEmail}</strong> has been created.
              In production, the following password setup link would be sent via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <LinkIcon className="h-4 w-4" />
                Password Setup Link
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-2 py-1 text-xs text-muted-foreground break-all">
                  {setupLink}
                </code>
                <Button
                  size="icon" variant="outline" className="h-8 w-8 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin + (setupLink ?? ""));
                    toast.success("Link copied to clipboard");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">This link will expire in 1 hour.</p>
            <Button className="w-full" onClick={() => { setSetupLink(null); setSetupEmail(""); }}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Org Admin / Super Admin View ─────────────────────────────────────────────

function OrgAdminClubsView() {
  const { getOrganizationId, isOrgAdmin } = useAuth();
  const orgId = getOrganizationId();

  const apiUrl = isOrgAdmin() && orgId ? `/api/clubs?organizationId=${orgId}` : "/api/clubs";
  const { data: clubsData, isLoading, error } = useSWR<Club[]>(apiUrl, authFetcher);
  const clubs: Club[] = clubsData ?? [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [approveTarget, setApproveTarget] = useState<Club | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Club | null>(null);

  const filtered = useMemo(() => clubs.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [clubs, search, statusFilter]);

  const stats = useMemo(() => ({
    total: clubs.length,
    active: clubs.filter((c) => c.status === "active").length,
    pending: clubs.filter((c) => c.status === "pending").length,
  }), [clubs]);

  const handleApprove = async () => {
    if (!approveTarget) return;
    try {
      const res = await fetchWithAuth(`/api/clubs/${approveTarget.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed"); return; }
      toast.success(`${approveTarget.name} approved`);
      setApproveTarget(null);
      mutate(apiUrl);
    } catch { toast.error("Failed to approve club"); }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      const res = await fetchWithAuth(`/api/clubs/${rejectTarget.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ action: "reject" }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed"); return; }
      toast.success(`${rejectTarget.name} rejected`);
      setRejectTarget(null);
      mutate(apiUrl);
    } catch { toast.error("Failed to reject club"); }
  };

  const columns: Column<Club>[] = [
    {
      key: "name",
      header: "Club",
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-xs text-primary">{getInitials(c.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{c.name}</span>
            {c.shortName && <span className="text-xs text-muted-foreground">{c.shortName}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "city",
      header: "City",
      className: "hidden md:table-cell",
      render: (c) => c.city ? (
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{c.city}</span>
        </div>
      ) : <span className="text-sm text-muted-foreground">—</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      render: (c) => {
        if (isOrgAdmin() && c.status === "pending") {
          return (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-400 hover:bg-emerald-400/10" onClick={() => setApproveTarget(c)}>
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setRejectTarget(c)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        }
        return <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Eye className="h-4 w-4" /></Button>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clubs" description={isOrgAdmin() ? "View clubs and manage pending registrations." : "View all registered clubs."} />

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load clubs.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Total Clubs" value={stats.total} icon={Shield} />
        <StatCard title="Active" value={stats.active} icon={Shield} />
        <StatCard title="Pending" value={stats.pending} icon={Shield} />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search clubs..."
        emptyMessage="No clubs found."
        filterSlot={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <ConfirmDialog
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve Club"
        description={`Approve "${approveTarget?.name}"?`}
        confirmLabel="Approve"
        variant="default"
        onConfirm={handleApprove}
      />
      <ConfirmDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Reject Club"
        description={`Reject "${rejectTarget?.name}"?`}
        confirmLabel="Reject"
        variant="destructive"
        onConfirm={handleReject}
      />
    </div>
  );
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

export default function ClubsPage() {
  const { isLeagueAdmin, isClubAdmin } = useAuth();
  if (isLeagueAdmin()) return <LeagueAdminClubsView />;
  if (isClubAdmin()) return <ClubAdminReadOnlyView />;
  return <OrgAdminClubsView />;
}

// ─── Club Admin Read-Only View ────────────────────────────────────────────────

function ClubAdminReadOnlyView() {
  const { data: clubsData, isLoading, error } = useSWR<Club[]>("/api/clubs", authFetcher);
  const clubs: Club[] = clubsData ?? [];
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => clubs.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  ), [clubs, search]);

  const columns: Column<Club>[] = [
    {
      key: "name",
      header: "Club",
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-xs text-primary">{getInitials(c.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{c.name}</span>
            {c.shortName && <span className="text-xs text-muted-foreground">{c.shortName}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "city",
      header: "City",
      className: "hidden md:table-cell",
      render: (c) => c.city ? (
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{c.city}</span>
        </div>
      ) : <span className="text-sm text-muted-foreground">—</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "view",
      header: "",
      className: "w-12",
      render: () => <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Eye className="h-4 w-4" /></Button>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clubs" description="View all clubs in your league." />
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load clubs.
        </div>
      )}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search clubs..."
        emptyMessage="No clubs found in your league."
      />
    </div>
  );
}
