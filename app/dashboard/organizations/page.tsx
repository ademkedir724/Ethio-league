"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { format } from "date-fns";

interface Organization {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  description: string | null;
  status: string;
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

export default function OrganizationsPage() {
  const { data, isLoading } = useSWR<Organization[]>(
    "/api/organizations",
    authFetcher
  );

  const organizations: Organization[] = data || [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewingOrg, setViewingOrg] = useState<Organization | null>(null);
  const [approveTarget, setApproveTarget] = useState<Organization | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Organization | null>(null);
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

  const filtered = useMemo(() => {
    return organizations.filter((org) => {
      const matchesSearch =
        org.name.toLowerCase().includes(search.toLowerCase()) ||
        org.city?.toLowerCase().includes(search.toLowerCase()) ||
        org.country?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || org.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [organizations, search, statusFilter]);

  const stats = useMemo(() => {
    const active = organizations.filter(
      (o) => o.status === "approved" || o.status === "active"
    ).length;
    const pending = organizations.filter((o) => o.status === "pending").length;
    const rejected = organizations.filter(
      (o) => o.status === "rejected"
    ).length;
    return { total: organizations.length, active, pending, rejected };
  }, [organizations]);

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

      // If there's a password setup link, show it
      if (data.passwordSetupLink) {
        setPasswordSetupLink(data.passwordSetupLink);
      }

      toast.success(`Organization "${approveTarget.name}" has been approved`);
      mutate("/api/organizations");
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
      mutate("/api/organizations");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reject organization"
      );
    } finally {
      setIsProcessing(false);
      setRejectTarget(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copied to clipboard");
  };

  const columns: Column<Organization>[] = [
    {
      key: "name",
      header: "Organization",
      render: (org) => (
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
            data={filtered}
            isLoading={isLoading}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search organizations..."
            emptyMessage="No organizations found."
            filterSlot={
              <Select value={statusFilter} onValueChange={setStatusFilter}>
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

      {/* Password Setup Link Dialog (for demo purposes) */}
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
              The organization has been approved. In production, the following
              password setup link would be sent via email to the applicant.
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
                  {passwordSetupLink}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  onClick={() =>
                    copyToClipboard(window.location.origin + passwordSetupLink)
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This link will expire in 1 hour. The user must set their password
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
