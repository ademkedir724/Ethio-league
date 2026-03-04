"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
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
import { Building2, Plus, MoreHorizontal, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  shortName: string;
  contactEmail: string;
  status: string;
  leagueCount: number;
  clubCount: number;
  createdAt: string;
}

const mockOrganizations: Organization[] = [
  { id: "1", name: "Ethiopian Football Federation", shortName: "EFF", contactEmail: "info@eff.et", status: "active", leagueCount: 3, clubCount: 16, createdAt: "2024-01-15" },
  { id: "2", name: "Addis Ababa Football Association", shortName: "AAFA", contactEmail: "info@aafa.et", status: "active", leagueCount: 2, clubCount: 12, createdAt: "2024-03-10" },
  { id: "3", name: "Oromia Football Federation", shortName: "OFF", contactEmail: "contact@off.et", status: "pending", leagueCount: 1, clubCount: 8, createdAt: "2025-06-22" },
  { id: "4", name: "Amhara Region Football Association", shortName: "ARFA", contactEmail: "admin@arfa.et", status: "active", leagueCount: 2, clubCount: 10, createdAt: "2024-09-05" },
  { id: "5", name: "SNNPR Football Federation", shortName: "SNNPF", contactEmail: "info@snnpf.et", status: "inactive", leagueCount: 0, clubCount: 4, createdAt: "2025-01-18" },
  { id: "6", name: "Tigray Football Association", shortName: "TFA", contactEmail: "contact@tfa.et", status: "pending", leagueCount: 0, clubCount: 0, createdAt: "2026-02-01" },
];

const emptyForm = { name: "", shortName: "", contactEmail: "", contactPhone: "", address: "", description: "" };

export default function OrganizationsPage() {
  const { data, isLoading } = useSWR("/api/organizations", authFetcher, {
    fallbackData: mockOrganizations,
    onError: () => {},
  });

  const organizations: Organization[] = data || mockOrganizations;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    return organizations.filter((org) => {
      const matchesSearch =
        org.name.toLowerCase().includes(search.toLowerCase()) ||
        org.shortName.toLowerCase().includes(search.toLowerCase()) ||
        org.contactEmail.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || org.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [organizations, search, statusFilter]);

  const stats = useMemo(() => {
    const active = organizations.filter((o) => o.status === "active").length;
    const pending = organizations.filter((o) => o.status === "pending").length;
    return { total: organizations.length, active, pending };
  }, [organizations]);

  const openCreate = () => {
    setEditingOrg(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (org: Organization) => {
    setEditingOrg(org);
    setForm({
      name: org.name,
      shortName: org.shortName,
      contactEmail: org.contactEmail,
      contactPhone: "",
      address: "",
      description: "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    // Will connect to real API later
    await new Promise((r) => setTimeout(r, 500));
  };

  const handleDelete = async () => {
    await new Promise((r) => setTimeout(r, 500));
  };

  const columns: Column<Organization>[] = [
    {
      key: "name",
      header: "Organization",
      render: (org) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{org.name}</span>
          <span className="text-xs text-muted-foreground">{org.shortName}</span>
        </div>
      ),
    },
    {
      key: "email",
      header: "Contact",
      className: "hidden md:table-cell",
      render: (org) => (
        <span className="text-sm text-muted-foreground">{org.contactEmail}</span>
      ),
    },
    {
      key: "leagues",
      header: "Leagues",
      className: "hidden lg:table-cell",
      render: (org) => (
        <span className="text-sm text-foreground">{org.leagueCount}</span>
      ),
    },
    {
      key: "clubs",
      header: "Clubs",
      className: "hidden lg:table-cell",
      render: (org) => (
        <span className="text-sm text-foreground">{org.clubCount}</span>
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
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => openEdit(org)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            {org.status === "pending" && (
              <>
                <DropdownMenuItem className="text-emerald-400 focus:text-emerald-400">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
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
      <PageHeader title="Organizations" description="Manage registered organizations and their approval status.">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Organization
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Organizations" value={stats.total} icon={Building2} />
        <StatCard title="Active" value={stats.active} icon={Building2} description="Approved organizations" />
        <StatCard title="Pending Approval" value={stats.pending} icon={Building2} description="Awaiting review" />
      </div>

      {/* Table */}
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
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Create / Edit Dialog */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingOrg ? "Edit Organization" : "Create Organization"}
        description={editingOrg ? "Update organization details." : "Register a new organization."}
        submitLabel={editingOrg ? "Update" : "Create"}
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input id="org-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ethiopian Football Federation" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-short">Short Name</Label>
            <Input id="org-short" value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} placeholder="EFF" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-email">Contact Email</Label>
            <Input id="org-email" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="info@eff.et" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-phone">Contact Phone</Label>
            <Input id="org-phone" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="+251 911 234 567" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-address">Address</Label>
            <Input id="org-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Addis Ababa, Ethiopia" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="org-desc">Description</Label>
            <Textarea id="org-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the organization..." rows={3} />
          </div>
        </div>
      </FormDialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Organization"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
