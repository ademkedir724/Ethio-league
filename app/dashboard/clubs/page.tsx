"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Shield, Plus, MoreHorizontal, Pencil, Trash2, MapPin, Check, X, Eye } from "lucide-react";

interface Club {
  id: string;
  name: string;
  shortName: string;
  city: string;
  country: string;
  foundedYear: number | null;
  stadium: string;
  playerCount: number;
  coachCount: number;
  status: string;
}

const mockClubs: Club[] = [
  { id: "1", name: "St. George FC", shortName: "SGF", city: "Addis Ababa", country: "Ethiopia", foundedYear: 1935, stadium: "Addis Ababa Stadium", playerCount: 28, coachCount: 4, status: "active" },
  { id: "2", name: "Ethio Electric SC", shortName: "EES", city: "Addis Ababa", country: "Ethiopia", foundedYear: 2011, stadium: "Addis Ababa Stadium", playerCount: 25, coachCount: 3, status: "active" },
  { id: "3", name: "Fasil Kenema FC", shortName: "FKF", city: "Gondar", country: "Ethiopia", foundedYear: 1962, stadium: "Fasil Kenema Stadium", playerCount: 26, coachCount: 3, status: "active" },
  { id: "4", name: "Hawassa Ketema FC", shortName: "HKF", city: "Hawassa", country: "Ethiopia", foundedYear: 2006, stadium: "Hawassa Stadium", playerCount: 24, coachCount: 3, status: "active" },
  { id: "5", name: "Adama Ketema FC", shortName: "AKF", city: "Adama", country: "Ethiopia", foundedYear: 1998, stadium: "Adama Stadium", playerCount: 23, coachCount: 3, status: "pending" },
  { id: "6", name: "Dire Dawa Ketema FC", shortName: "DDK", city: "Dire Dawa", country: "Ethiopia", foundedYear: 1945, stadium: "Dire Dawa Stadium", playerCount: 27, coachCount: 4, status: "pending" },
  { id: "7", name: "Wolaita Dicha FC", shortName: "WDF", city: "Sodo", country: "Ethiopia", foundedYear: 2003, stadium: "Wolaita Stadium", playerCount: 22, coachCount: 2, status: "active" },
  { id: "8", name: "Sidama Bunna FC", shortName: "SBF", city: "Hawassa", country: "Ethiopia", foundedYear: 1998, stadium: "Hawassa Stadium", playerCount: 25, coachCount: 3, status: "rejected" },
];

const emptyForm = {
  name: "",
  shortName: "",
  city: "",
  country: "Ethiopia",
  foundedYear: "",
  website: "",
  description: "",
};

export default function ClubsPage() {
  const { organization, isLoading: orgLoading } = useOrganization();
  const { getOrganizationId, isOrgAdmin, isSuperAdmin } = useAuth();
  const { canManage, isViewOnly } = usePermissions();
  const orgId = getOrganizationId();

  // Org admins see org-scoped clubs, super admins see all
  const apiUrl = isOrgAdmin() && orgId
    ? `/api/clubs?organizationId=${orgId}`
    : "/api/clubs";

  const { data, isLoading: clubsLoading } = useSWR(apiUrl, authFetcher, {
    fallbackData: mockClubs,
    onError: () => {},
  });

  const clubs: Club[] = data || mockClubs;
  const isLoading = orgLoading || clubsLoading;

  // Super admin: view-only, Org admin: can approve/reject pending clubs
  const canApprove = isOrgAdmin();
  const canEdit = canManage("clubs") && !isOrgAdmin(); // Org admin cannot create clubs, only approve

  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [currentTab, setCurrentTab] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Club | null>(null);
  const [approveTarget, setApproveTarget] = useState<Club | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Club | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const cities = useMemo(() => {
    const set = new Set(clubs.map((c) => c.city));
    return Array.from(set).sort();
  }, [clubs]);

  // Filter by tab and search
  const filtered = useMemo(() => {
    return clubs.filter((club) => {
      const matchesSearch =
        club.name.toLowerCase().includes(search.toLowerCase()) ||
        club.shortName.toLowerCase().includes(search.toLowerCase()) ||
        club.city.toLowerCase().includes(search.toLowerCase());
      const matchesCity = cityFilter === "all" || club.city === cityFilter;
      const matchesTab =
        currentTab === "all" ||
        (currentTab === "pending" && club.status === "pending") ||
        (currentTab === "approved" && club.status === "active") ||
        (currentTab === "rejected" && club.status === "rejected");
      return matchesSearch && matchesCity && matchesTab;
    });
  }, [clubs, search, cityFilter, currentTab]);

  const stats = useMemo(() => {
    const total = clubs.length;
    const active = clubs.filter((c) => c.status === "active").length;
    const pending = clubs.filter((c) => c.status === "pending").length;
    const totalPlayers = clubs.reduce((sum, c) => sum + c.playerCount, 0);
    return { total, active, pending, totalPlayers };
  }, [clubs]);

  const openCreate = () => {
    setEditingClub(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (club: Club) => {
    setEditingClub(club);
    setForm({
      name: club.name,
      shortName: club.shortName,
      city: club.city,
      country: club.country,
      foundedYear: club.foundedYear?.toString() || "",
      website: "",
      description: "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      // Mock save - in production this would call the API
      await new Promise((r) => setTimeout(r, 500));
      toast.success(editingClub ? "Club updated" : "Club created");
      setFormOpen(false);
      mutate(apiUrl);
    } catch {
      toast.error("Operation failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      toast.success("Club deleted");
      setDeleteTarget(null);
      mutate(apiUrl);
    } catch {
      toast.error("Failed to delete club");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    setIsSaving(true);
    try {
      const response = await fetchWithAuth(`/api/clubs/${approveTarget.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      if (!response.ok) {
        // Fallback to mock for demo
        await new Promise((r) => setTimeout(r, 500));
      }

      toast.success(`${approveTarget.name} has been approved`);
      setApproveTarget(null);
      mutate(apiUrl);
    } catch {
      toast.error("Failed to approve club");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setIsSaving(true);
    try {
      const response = await fetchWithAuth(`/api/clubs/${rejectTarget.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      if (!response.ok) {
        // Fallback to mock for demo
        await new Promise((r) => setTimeout(r, 500));
      }

      toast.success(`${rejectTarget.name} has been rejected`);
      setRejectTarget(null);
      mutate(apiUrl);
    } catch {
      toast.error("Failed to reject club");
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const columns: Column<Club>[] = [
    {
      key: "name",
      header: "Club",
      render: (club) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {getInitials(club.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{club.name}</span>
            <span className="text-xs text-muted-foreground">{club.shortName}</span>
          </div>
        </div>
      ),
    },
    {
      key: "city",
      header: "City",
      className: "hidden md:table-cell",
      render: (club) => (
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{club.city}</span>
        </div>
      ),
    },
    {
      key: "founded",
      header: "Founded",
      className: "hidden lg:table-cell",
      render: (club) => (
        <span className="text-sm text-muted-foreground">
          {club.foundedYear || "N/A"}
        </span>
      ),
    },
    {
      key: "players",
      header: "Players",
      className: "hidden lg:table-cell",
      render: (club) => (
        <span className="text-sm text-foreground">{club.playerCount}</span>
      ),
    },
    {
      key: "coaches",
      header: "Coaches",
      className: "hidden xl:table-cell",
      render: (club) => (
        <span className="text-sm text-foreground">{club.coachCount}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (club) => <StatusBadge status={club.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (club) => {
        // For org admins, show approve/reject for pending clubs
        if (canApprove && club.status === "pending") {
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-emerald-400 hover:text-emerald-400 hover:bg-emerald-400/10"
                onClick={() => setApproveTarget(club)}
              >
                <Check className="h-4 w-4" />
                <span className="sr-only">Approve</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setRejectTarget(club)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Reject</span>
              </Button>
            </div>
          );
        }

        // For super admin, show view-only actions (or full edit if canEdit)
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              {canEdit && (
                <>
                  <DropdownMenuItem onClick={() => openEdit(club)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteTarget(club)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const pageTitle = isOrgAdmin() && organization
    ? `${organization.name} - Clubs`
    : "Clubs";

  const pageDescription = isOrgAdmin()
    ? "View clubs and manage pending registrations for your organization."
    : "View registered football clubs and their details.";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={pageTitle} description={pageDescription}>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Club
          </Button>
        )}
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Total Clubs" value={stats.total} icon={Shield} />
        <StatCard title="Active" value={stats.active} icon={Shield} description="Approved clubs" />
        <StatCard title="Pending" value={stats.pending} icon={Shield} description="Awaiting approval" />
        <StatCard title="Total Players" value={stats.totalPlayers} icon={Shield} description="Across all clubs" />
      </div>

      {/* Tabs for org admin */}
      {isOrgAdmin() ? (
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Clubs</TabsTrigger>
            <TabsTrigger value="pending">
              Pending
              {stats.pending > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">
                  {stats.pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value={currentTab}>
            <DataTable
              columns={columns}
              data={filtered}
              isLoading={isLoading}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search clubs..."
              emptyMessage={
                currentTab === "pending"
                  ? "No pending club registrations."
                  : "No clubs found."
              }
              filterSlot={
                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="City" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    {cities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
          </TabsContent>
        </Tabs>
      ) : (
        // Super admin view - simple table
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search clubs..."
          emptyMessage="No clubs found."
          filterSlot={
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      )}

      {/* Create / Edit Dialog */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingClub ? "Edit Club" : "Create Club"}
        description={editingClub ? "Update club details." : "Register a new football club."}
        submitLabel={isSaving ? "Saving..." : editingClub ? "Update" : "Create"}
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="club-name">Club Name</Label>
            <Input id="club-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="St. George FC" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="club-short">Short Name</Label>
            <Input id="club-short" value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} placeholder="SGF" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="club-city">City</Label>
            <Input id="club-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Addis Ababa" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="club-country">Country</Label>
            <Input id="club-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Ethiopia" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="club-founded">Founded Year</Label>
            <Input id="club-founded" type="number" value={form.foundedYear} onChange={(e) => setForm({ ...form, foundedYear: e.target.value })} placeholder="1935" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="club-website">Website</Label>
            <Input id="club-website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://club.com" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="club-desc">Description</Label>
            <Textarea id="club-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the club..." rows={3} />
          </div>
        </div>
      </FormDialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Club"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel={isSaving ? "Deleting..." : "Delete"}
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* Approve Confirmation */}
      <ConfirmDialog
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve Club Registration"
        description={`Are you sure you want to approve "${approveTarget?.name}"? They will be able to participate in leagues.`}
        confirmLabel={isSaving ? "Approving..." : "Approve"}
        variant="default"
        onConfirm={handleApprove}
      />

      {/* Reject Confirmation */}
      <ConfirmDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Reject Club Registration"
        description={`Are you sure you want to reject "${rejectTarget?.name}"? They will be notified of this decision.`}
        confirmLabel={isSaving ? "Rejecting..." : "Reject"}
        variant="destructive"
        onConfirm={handleReject}
      />
    </div>
  );
}
