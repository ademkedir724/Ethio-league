"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/org-context";
import { usePaginated } from "@/lib/use-paginated";
import { Pagination } from "@/components/dashboard/pagination";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { StatCard } from "@/components/dashboard/stat-card";
import { MediaUploadWidget } from "@/components/dashboard/media-upload-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  MapPin,
  Mail,
  Phone,
  User,
  Calendar,
  Link as LinkIcon,
  Copy,
  Pencil,
  Globe,
  Trash2,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { format } from "date-fns";

interface Organization {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  description: string | null;
  status: string;
  logoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined data from UserRoleScope
  applicant?: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  };
}

// ─── Organization Admin View ─────────────────────────────────────────────────
// Shows only the current user's organization with edit capability

function OrgAdminOrganizationsView() {
  const { organization, isLoading, refetch } = useOrganization();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    country: "",
    city: "",
    description: "",
  });

  const openEditDialog = () => {
    if (organization) {
      setEditForm({
        name: organization.name || "",
        country: organization.country || "",
        city: organization.city || "",
        description: organization.description || "",
      });
      setIsEditOpen(true);
    }
  };

  const handleSave = async () => {
    if (!organization) return;
    setIsSaving(true);

    try {
      const response = await fetchWithAuth(`/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update organization");
      }

      toast.success("Organization updated successfully");
      setIsEditOpen(false);
      refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update organization"
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="My Organization"
          description="View and manage your organization details."
        />
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="My Organization"
          description="View and manage your organization details."
        />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-1 text-lg font-medium text-foreground">
              No organization found
            </h3>
            <p className="text-sm text-muted-foreground">
              You are not associated with any organization.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Organization"
        description="View and manage your organization details."
      />

      {/* Organization Details Card */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-3">
            {organization.logoUrl ? (
              <Image
                src={organization.logoUrl}
                alt={`${organization.name} logo`}
                width={48}
                height={48}
                className="rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <CardTitle className="text-xl font-semibold">
              {organization.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={organization.status} />
            <Button
              variant="outline"
              size="sm"
              onClick={openEditDialog}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left Column - Details */}
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="mb-3 text-sm font-medium text-foreground">
                  Organization Information
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{organization.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {organization.city || "N/A"}, {organization.country || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{organization.country || "N/A"}</span>
                  </div>
                </div>
              </div>

              {organization.description && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <h4 className="mb-2 text-sm font-medium text-foreground">
                    Description
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {organization.description}
                  </p>
                </div>
              )}
            </div>

            {/* Right Column - Meta Info */}
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="mb-3 text-sm font-medium text-foreground">
                  Account Details
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <StatusBadge status={organization.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Created</span>
                    <span className="text-sm">
                      {format(new Date(organization.createdAt), "PPP")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last Updated</span>
                    <span className="text-sm">
                      {format(new Date(organization.updatedAt), "PPP")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Organization Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen} modal={false}>
        <DialogContent
          className="max-w-md"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update your organization details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Organization Logo</Label>
              <div className="flex items-center gap-3">
                {organization.logoUrl && (
                  <Image
                    src={organization.logoUrl}
                    alt="Current logo"
                    width={40}
                    height={40}
                    className="rounded-md object-cover"
                  />
                )}
                <MediaUploadWidget
                  uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_ORG_LOGO ?? "org_logo"}
                  onSuccess={async (url) => {
                    try {
                      const res = await fetchWithAuth(`/api/organizations/${organization.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ logoUrl: url }),
                      });
                      if (!res.ok) {
                        const d = await res.json();
                        throw new Error(d.error || "Failed to update logo");
                      }
                      toast.success("Logo updated");
                      refetch();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to update logo");
                    }
                  }}
                >
                  <Button type="button" variant="outline" size="sm">
                    Upload Logo
                  </Button>
                </MediaUploadWidget>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder="Enter organization name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={editForm.country}
                  onChange={(e) =>
                    setEditForm({ ...editForm, country: e.target.value })
                  }
                  placeholder="Country"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={editForm.city}
                  onChange={(e) =>
                    setEditForm({ ...editForm, city: e.target.value })
                  }
                  placeholder="City"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
                placeholder="Describe your organization..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Super Admin View ────────────────────────────────────────────────────────
// Full organizations management with approve/reject capabilities

function SuperAdminOrganizationsView() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { items: organizations, pagination, setPage, setLimit, isLoading, mutate: mutateOrgs } = usePaginated<Organization>(
    "/api/organizations",
    {
      defaultLimit: 15,
      extraParams: {
        search: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      },
    }
  );
  const [viewingOrg, setViewingOrg] = useState<Organization | null>(null);
  const [approveTarget, setApproveTarget] = useState<Organization | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Organization | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Organization | null>(null);
  const [activateTarget, setActivateTarget] = useState<Organization | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [passwordSetupLink, setPasswordSetupLink] = useState<string | null>(
    null
  );

  const pendingOrgs = useMemo(
    () => organizations.filter((o) => o.status === "pending"),
    [organizations]
  );

  const approvedOrgs = useMemo(
    () => organizations.filter((o) => o.status === "approved"),
    [organizations]
  );

  const filtered = organizations;

  const stats = useMemo(() => {
    const active = organizations.filter(
      (o) => o.status === "approved" || o.status === "active"
    ).length;
    const pending = organizations.filter((o) => o.status === "pending").length;
    const rejected = organizations.filter(
      (o) => o.status === "rejected"
    ).length;
    return { total: pagination.total, active, pending, rejected };
  }, [organizations, pagination.total]);

  const handleApprove = async () => {
    if (!approveTarget) return;
    setIsProcessing(true);

    try {
      const response = await fetchWithAuth("/api/organizations/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: approveTarget.id,
          status: "approved",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to approve organization");
      }

      const data = await response.json();

      // Always show the password setup link popup
      if (data.passwordSetupLink) {
        setPasswordSetupLink(data.passwordSetupLink);
      }

      toast.success(`Organization "${approveTarget.name}" has been approved`);
      mutateOrgs();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to approve organization"
      );
    } finally {
      setIsProcessing(false);
      setApproveTarget(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setIsProcessing(true);

    try {
      const response = await fetchWithAuth("/api/organizations/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: rejectTarget.id,
          status: "rejected",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reject organization");
      }

      toast.success(`Organization "${rejectTarget.name}" has been rejected`);
      mutateOrgs();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reject organization"
      );
    } finally {
      setIsProcessing(false);
      setRejectTarget(null);
    }
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    setIsProcessing(true);
    try {
      const response = await fetchWithAuth(`/api/organizations/${suspendTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "suspended" }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to suspend organization");
      }
      toast.success(`Organization "${suspendTarget.name}" has been suspended`);
      mutateOrgs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to suspend organization");
    } finally {
      setIsProcessing(false);
      setSuspendTarget(null);
    }
  };

  const handleActivate = async () => {
    if (!activateTarget) return;
    setIsProcessing(true);
    try {
      const response = await fetchWithAuth(`/api/organizations/${activateTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to activate organization");
      }
      toast.success(`Organization "${activateTarget.name}" has been activated`);
      mutateOrgs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to activate organization");
    } finally {
      setIsProcessing(false);
      setActivateTarget(null);
    }
  };

  const handleDeleteOrg = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);
    try {
      const response = await fetchWithAuth(`/api/organizations/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete organization");
      }
      toast.success(`Organization "${deleteTarget.name}" has been deleted`);
      mutateOrgs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete organization");
    } finally {
      setIsProcessing(false);
      setDeleteTarget(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    // Try modern clipboard API first (works on HTTPS)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Link copied to clipboard");
        return;
      } catch {
        // fall through to legacy method
      }
    }

    // Legacy fallback — create input inside the dialog to avoid focus-trap issues
    const input = document.createElement("input");
    input.value = text;
    input.style.position = "fixed";
    input.style.top = "50%";
    input.style.left = "50%";
    input.style.opacity = "0.01";
    input.style.zIndex = "9999";
    input.setAttribute("readonly", "");
    document.body.appendChild(input);
    input.focus();
    input.select();
    input.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(input);
    if (ok) {
      toast.success("Link copied to clipboard");
    } else {
      toast.error("Copy failed — please select and copy the link manually");
    }
  };

  const columns: Column<Organization>[] = [
    {
      key: "name",
      header: "Organization",
      render: (org) => (
        <div className="flex items-center gap-3">
          {org.logoUrl ? (
            <Image src={org.logoUrl} alt={org.name} width={32} height={32} className="h-8 w-8 rounded-md object-cover shrink-0" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {org.name}
            </span>
            {org.city && org.country && (
              <span className="text-xs text-muted-foreground">
                {org.city}, {org.country}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "location",
      header: "Location",
      className: "hidden md:table-cell",
      render: (org) => (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {org.city || "N/A"}, {org.country || "N/A"}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Requested",
      className: "hidden lg:table-cell",
      render: (org) => (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {format(new Date(org.createdAt), "MMM d, yyyy")}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (org) => <StatusBadge status={org.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (org) => (
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
            <DropdownMenuItem onClick={() => setViewingOrg(org)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            {org.status === "pending" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setApproveTarget(org)}
                  className="text-emerald-400 focus:text-emerald-400"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setRejectTarget(org)}
                  className="text-destructive focus:text-destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </DropdownMenuItem>
              </>
            )}
            {(org.status === "approved" || org.status === "active") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setSuspendTarget(org)}
                  className="text-amber-400 focus:text-amber-400"
                >
                  <PauseCircle className="mr-2 h-4 w-4" />
                  Suspend
                </DropdownMenuItem>
              </>
            )}
            {org.status === "suspended" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setActivateTarget(org)}
                  className="text-emerald-400 focus:text-emerald-400"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Activate
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteTarget(org)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Organizations"
        description="Manage organization requests and approvals."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          title="Total Organizations"
          value={stats.total}
          icon={Building2}
        />
        <StatCard
          title="Approved"
          value={stats.active}
          icon={CheckCircle}
          description="Active organizations"
        />
        <StatCard
          title="Pending Approval"
          value={stats.pending}
          icon={Clock}
          description="Awaiting review"
        />
        <StatCard
          title="Rejected"
          value={stats.rejected}
          icon={XCircle}
          description="Declined requests"
        />
      </div>

      {/* Tabbed View */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Organizations</TabsTrigger>
          <TabsTrigger value="pending">
            Pending Requests
            {pendingOrgs.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                {pendingOrgs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <DataTable
            columns={columns}
            data={organizations}
            isLoading={isLoading}
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search organizations..."
            emptyMessage="No organizations found."
            filterSlot={
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
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
        </TabsContent>

        <TabsContent value="pending">
          {pendingOrgs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-1 text-lg font-medium text-foreground">
                  No pending requests
                </h3>
                <p className="text-sm text-muted-foreground">
                  All organization requests have been processed.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingOrgs.map((org) => (
                <Card key={org.id} className="border-amber-500/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{org.name}</CardTitle>
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {org.city}, {org.country}
                        </p>
                      </div>
                      <StatusBadge status="pending" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {org.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {org.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Requested {format(new Date(org.createdAt), "MMM d, yyyy")}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setViewingOrg(org)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => setApproveTarget(org)}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => setRejectTarget(org)}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved">
          <DataTable
            columns={columns}
            data={approvedOrgs}
            isLoading={isLoading}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search approved organizations..."
            emptyMessage="No approved organizations found."
          />
        </TabsContent>
      </Tabs>

      {/* View Details Dialog */}
      <Dialog open={!!viewingOrg} onOpenChange={() => setViewingOrg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Organization Details</DialogTitle>
            <DialogDescription>
              Review the organization request details.
            </DialogDescription>
          </DialogHeader>
          {viewingOrg && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="mb-3 text-sm font-medium text-foreground">
                  Organization Information
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{viewingOrg.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {viewingOrg.city}, {viewingOrg.country}
                    </span>
                  </div>
                  {viewingOrg.description && (
                    <p className="text-sm text-muted-foreground">
                      {viewingOrg.description}
                    </p>
                  )}
                </div>
              </div>

              {viewingOrg.applicant && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <h4 className="mb-3 text-sm font-medium text-foreground">
                    Applicant Information
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {viewingOrg.applicant.fullName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {viewingOrg.applicant.email}
                      </span>
                    </div>
                    {viewingOrg.applicant.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {viewingOrg.applicant.phone}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <StatusBadge status={viewingOrg.status} />
                </div>
                <span className="text-xs text-muted-foreground">
                  Created {format(new Date(viewingOrg.createdAt), "PPP")}
                </span>
              </div>

              {viewingOrg.status === "pending" && (
                <div className="flex gap-2 border-t border-border pt-4">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      setViewingOrg(null);
                      setApproveTarget(viewingOrg);
                    }}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setViewingOrg(null);
                      setRejectTarget(viewingOrg);
                    }}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation */}
      <ConfirmDialog
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve Organization"
        description={`Are you sure you want to approve "${approveTarget?.name}"? The applicant will receive an email with instructions to set up their password.`}
        confirmLabel={isProcessing ? "Approving..." : "Approve"}
        variant="default"
        onConfirm={handleApprove}
      />

      {/* Reject Confirmation */}
      <ConfirmDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Reject Organization"
        description={`Are you sure you want to reject "${rejectTarget?.name}"? This action can be reversed later if needed.`}
        confirmLabel={isProcessing ? "Rejecting..." : "Reject"}
        variant="destructive"
        onConfirm={handleReject}
      />

      {/* Suspend Confirmation */}
      <ConfirmDialog
        open={!!suspendTarget}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
        title="Suspend Organization"
        description={`Suspend "${suspendTarget?.name}"? Their access will be restricted until reactivated.`}
        confirmLabel={isProcessing ? "Suspending..." : "Suspend"}
        variant="destructive"
        onConfirm={handleSuspend}
      />

      {/* Activate Confirmation */}
      <ConfirmDialog
        open={!!activateTarget}
        onOpenChange={(open) => !open && setActivateTarget(null)}
        title="Activate Organization"
        description={`Reactivate "${activateTarget?.name}"? They will regain full access.`}
        confirmLabel={isProcessing ? "Activating..." : "Activate"}
        variant="default"
        onConfirm={handleActivate}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Organization"
        description={`Permanently delete "${deleteTarget?.name}"? This cannot be undone and will remove all associated data.`}
        confirmLabel={isProcessing ? "Deleting..." : "Delete"}
        variant="destructive"
        onConfirm={handleDeleteOrg}
      />

      {/* Password Setup Link Dialog */}
      <Dialog
        open={!!passwordSetupLink}
        onOpenChange={() => setPasswordSetupLink(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="h-5 w-5" />
              Organization Approved
            </DialogTitle>
            <DialogDescription>
              The organization has been approved. Share the link below with the
              applicant so they can set their password. A setup email has also
              been sent if email is configured.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <LinkIcon className="h-4 w-4" />
                Password Setup Link
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={passwordSetupLink ?? ""}
                  className="flex-1 rounded bg-background px-2 py-1 text-xs text-muted-foreground border border-border cursor-text select-all"
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    copyToClipboard(passwordSetupLink!);
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This link expires in 1 hour. The user must set their password
              before they can log in.
            </p>
            <Button
              className="w-full"
              onClick={() => setPasswordSetupLink(null)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page Router ────────────────────────────────────────────────────────
// Routes to appropriate view based on user role

// ─── League Admin View ────────────────────────────────────────────────────────
// Shows the organization this league admin belongs to (read-only)

function LeagueAdminOrganizationView() {
  const { getLeagueId } = useAuth();
  const leagueId = getLeagueId();

  const { data: league, isLoading } = useSWR(
    leagueId ? `/api/leagues/${leagueId}` : null,
    authFetcher
  );

  const org = league?.organization;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My Organization" description="Organization this league belongs to." />
        <Card className="border-border bg-card">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My Organization" description="Organization this league belongs to." />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No organization found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My Organization" description="Organization this league belongs to." />
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold">{org.name}</CardTitle>
          <StatusBadge status={league.status ?? "active"} />
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="mb-3 text-sm font-medium text-foreground">Organization Information</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{org.name}</span>
                  </div>
                  {(org.city || org.country) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{[org.city, org.country].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                </div>
              </div>
              {league.name && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <h4 className="mb-2 text-sm font-medium text-foreground">My League</h4>
                  <p className="text-sm text-foreground">{league.name}</p>
                  {league.leagueType && (
                    <p className="text-xs text-muted-foreground mt-1">{league.leagueType.name}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OrganizationsPage() {
  const { isOrgAdmin, isLeagueAdmin } = useAuth();

  if (isOrgAdmin()) {
    return <OrgAdminOrganizationsView />;
  }

  if (isLeagueAdmin()) {
    return <LeagueAdminOrganizationView />;
  }

  return <SuperAdminOrganizationsView />;
}
