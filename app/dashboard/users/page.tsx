"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/org-context";
import { getRoleLabel } from "@/lib/role-labels";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Plus, MoreHorizontal, Pencil, Trash2, ShieldCheck, UserX, Link as LinkIcon, Copy } from "lucide-react";

interface UserRoleScope {
  id: string;
  role: { name: string };
  organizationId?: string | null;
  seasonId?: string | null;
  clubId?: string | null;
}

interface ApiUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  status: string;
  createdAt: string;
  userRoleScopes: UserRoleScope[];
}

interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  photoUrl: string | null;
  roles: string[];
  status: string;
  createdAt: string;
}

function mapApiUser(u: ApiUser): User {
  return {
    ...u,
    phone: u.phone ?? "",
    roles: u.userRoleScopes.map((s) => s.role.name.toUpperCase()),
  };
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-primary/15 text-primary border-primary/20",
  ORGANIZATION_ADMIN: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  LEAGUE_ADMIN: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  CLUB_ADMIN: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  MATCH_EVENT_ADMIN: "bg-violet-500/15 text-violet-400 border-violet-500/20",
};

const emptyForm = { fullName: "", email: "", phone: "", password: "", role: "" };

// ─── Organization Admin View ─────────────────────────────────────────────────
// View users in their organization and create Match Event Admins only

function OrgAdminUsersView() {
  const { organization, isLoading: orgLoading } = useOrganization();
  const { getOrganizationId } = useAuth();
  const orgId = getOrganizationId();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { items: rawItems, pagination, setPage, setLimit, isLoading: usersLoading, mutate: mutateUsers } = usePaginated<ApiUser>(
    "/api/users",
    {
      defaultLimit: 20,
      extraParams: { search: search || undefined },
    }
  );

  const users: User[] = useMemo(() => rawItems.map(mapApiUser), [rawItems]);
  const isLoading = orgLoading || usersLoading;
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [passwordSetupLink, setPasswordSetupLink] = useState<string | null>(null);

  // Filter users that belong to this organization
  const orgUsers = useMemo(() => {
    return users.filter((u) =>
      ["ORGANIZATION_ADMIN", "LEAGUE_ADMIN", "CLUB_ADMIN", "MATCH_EVENT_ADMIN"].some((r) =>
        u.roles?.includes(r)
      )
    );
  }, [users]);

  const filtered = useMemo(() => {
    return orgUsers.filter((u) => {
      const matchesRole = roleFilter === "all" || u.roles?.includes(roleFilter);
      const matchesStatus = statusFilter === "all" || u.status === statusFilter;
      return matchesRole && matchesStatus;
    });
  }, [orgUsers, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const orgAdmins = orgUsers.filter((u) => u.roles?.includes("ORGANIZATION_ADMIN")).length;
    const leagueAdmins = orgUsers.filter((u) => u.roles?.includes("LEAGUE_ADMIN")).length;
    const clubAdmins = orgUsers.filter((u) => u.roles?.includes("CLUB_ADMIN")).length;
    const matchEventAdmins = orgUsers.filter((u) => u.roles?.includes("MATCH_EVENT_ADMIN")).length;
    return { total: pagination.total, orgAdmins, leagueAdmins, clubAdmins, matchEventAdmins };
  }, [orgUsers, pagination.total]);

  const openCreateMatchEventAdmin = () => {
    setEditingUser(null);
    setForm({ fullName: "", email: "", phone: "" });
    setFormOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      if (editingUser) {
        // Update existing user
        const response = await fetchWithAuth(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: form.fullName,
            phone: form.phone,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update user");
        }

        toast.success("User updated successfully");
      } else {
        // Create new Match Event Admin
        const response = await fetchWithAuth("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: form.fullName,
            email: form.email,
            phone: form.phone,
            role: "MATCH_EVENT_ADMIN",
            organizationId: orgId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create user");
        }

        const data = await response.json();
        if (data.passwordSetupLink) {
          setPasswordSetupLink(data.passwordSetupLink);
        }
        toast.success("Match Event Admin created successfully");
      }

      setFormOpen(false);
      mutateUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = user.status === "active" ? "inactive" : "active";
      const response = await fetchWithAuth(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update user status");
      }

      toast.success(`User ${newStatus === "active" ? "activated" : "deactivated"}`);
      mutateUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed");
    }
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    const newStatus = suspendTarget.status === "active" ? "suspended" : "active";
    try {
      const response = await fetchWithAuth(`/api/users/${suspendTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update status");
      }
      toast.success(`User ${newStatus === "active" ? "activated" : "suspended"}`);
      setSuspendTarget(null);
      mutateUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetchWithAuth(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete user");
      }
      toast.success("User deleted");
      setDeleteTarget(null);
      mutateUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copied to clipboard");
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const columns: Column<User>[] = [
    {
      key: "user",
      header: "User",
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {u.photoUrl && <AvatarImage src={u.photoUrl} alt={u.fullName} />}
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {getInitials(u.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{u.fullName}</span>
            <span className="text-xs text-muted-foreground">{u.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Role",
      className: "hidden md:table-cell",
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles?.map((role) => (
            <Badge key={role} variant="outline" className={`text-[10px] capitalize ${roleColors[role] || ""}`}>
              {getRoleLabel(role)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      className: "hidden lg:table-cell",
      render: (u) => <span className="text-sm text-muted-foreground">{u.phone || "N/A"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (u) => {
        // Org admin can manage league_admin, club_admin, and match_event_admin
        const isOrgAdminSelf = u.roles?.includes("ORGANIZATION_ADMIN");
        if (isOrgAdminSelf) return null; // can't manage other org admins

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => openEdit(u)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {u.status === "active" ? (
                <DropdownMenuItem
                  onClick={() => setSuspendTarget(u)}
                  className="text-amber-400 focus:text-amber-400"
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Suspend
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => setSuspendTarget(u)}
                  className="text-emerald-400 focus:text-emerald-400"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Activate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteTarget(u)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={organization ? `${organization.name} - Users` : "Users"}
        description="View users in your organization and manage Match Event Admins."
      >
        <Button onClick={openCreateMatchEventAdmin}>
          <Plus className="h-4 w-4" />
          Add Match Event Admin
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard title="Total Users" value={stats.total} icon={Users} />
        <StatCard title="Org Admins" value={stats.orgAdmins} icon={Users} />
        <StatCard title="League Admins" value={stats.leagueAdmins} icon={Users} />
        <StatCard title="Club Managers" value={stats.clubAdmins} icon={Users} />
        <StatCard title="Match Recorders" value={stats.matchEventAdmins} icon={Users} />
      </div>

      {/* Tabs by Role */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Users</TabsTrigger>
          <TabsTrigger value="ORGANIZATION_ADMIN">Federation Admins</TabsTrigger>
          <TabsTrigger value="LEAGUE_ADMIN">League Managers</TabsTrigger>
          <TabsTrigger value="CLUB_ADMIN">Club Managers</TabsTrigger>
          <TabsTrigger value="MATCH_EVENT_ADMIN">Match Recorders</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <DataTable
            columns={columns}
            data={filtered}
            isLoading={isLoading}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search users..."
            emptyMessage="No users found in your organization."
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
        </TabsContent>

        {["ORGANIZATION_ADMIN", "LEAGUE_ADMIN", "CLUB_ADMIN", "MATCH_EVENT_ADMIN"].map((role) => (
          <TabsContent key={role} value={role}>
            <DataTable
              columns={columns}
              data={orgUsers.filter((u) => u.roles?.includes(role))}
              isLoading={isLoading}
              searchPlaceholder="Search users..."
              emptyMessage={`No ${getRoleLabel(role)}s found.`}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Create / Edit Match Event Admin Dialog */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingUser ? "Edit User" : "Add Match Recorder"}
        description={
          editingUser
            ? "Update user details."
            : "Create a new Match Recorder for your organization. They will receive an email to set their password."
        }
        submitLabel={isSaving ? "Saving..." : editingUser ? "Update" : "Create"}
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="me-name">Full Name *</Label>
            <Input
              id="me-name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="Abebe Kebede"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
            />
          </div>
          {!editingUser && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="me-email">Email *</Label>
              <Input
                id="me-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="abebe@ethioleague.com"
                required
                autoComplete="email"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="me-phone">
              Phone <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="me-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+251 911 234 567"
              pattern="^\+?[\d\s\-().]{7,20}$"
              title="Enter a valid phone number (e.g. +251 911 234 567)"
              autoComplete="tel"
            />
          </div>
          {!editingUser && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              The user will be assigned the <strong>Match Event Admin</strong> role and linked to your organization. A password setup email will be sent.
            </div>
          )}
        </div>
      </FormDialog>

      {/* Password Setup Link Dialog */}
      <Dialog open={!!passwordSetupLink} onOpenChange={() => setPasswordSetupLink(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
              User Created
            </DialogTitle>
            <DialogDescription>
              The Match Event Admin has been created. In production, the following password setup link would be sent via email.
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
                  onClick={() => copyToClipboard(window.location.origin + passwordSetupLink)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This link will expire in 1 hour.
            </p>
            <Button className="w-full" onClick={() => setPasswordSetupLink(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suspend / Activate Confirmation */}
      <ConfirmDialog
        open={!!suspendTarget}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
        title={suspendTarget?.status === "active" ? "Suspend User" : "Activate User"}
        description={
          suspendTarget?.status === "active"
            ? `Suspend "${suspendTarget?.fullName}"? They will lose access until reactivated.`
            : `Activate "${suspendTarget?.fullName}"? They will regain access.`
        }
        confirmLabel={suspendTarget?.status === "active" ? "Suspend" : "Activate"}
        variant={suspendTarget?.status === "active" ? "destructive" : "default"}
        onConfirm={handleSuspend}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete User"
        description={`Permanently delete "${deleteTarget?.fullName}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ─── Super Admin View ────────────────────────────────────────────────────────
// Full user management across all organizations

function SuperAdminUsersView() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { items: rawItems, pagination, setPage, setLimit, isLoading, mutate: mutateUsers } = usePaginated<ApiUser>(
    "/api/users",
    {
      defaultLimit: 20,
      extraParams: {
        search: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      },
    }
  );

  const users: User[] = useMemo(() => rawItems.map(mapApiUser), [rawItems]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = roleFilter === "all" || u.roles.includes(roleFilter);
      return matchesRole;
    });
  }, [users, roleFilter]);

  const stats = useMemo(() => {
    const active = pagination.total;
    const pending = users.filter((u) => u.status === "pending").length;
    return { total: pagination.total, active, pending };
  }, [users, pagination.total]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      password: "",
      role: user.roles[0] || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (editingUser) {
      try {
        const res = await fetchWithAuth(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          body: JSON.stringify({ fullName: form.fullName, phone: form.phone }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          toast.error(d.error || "Failed to update user");
          return;
        }
        toast.success("User updated");
        setFormOpen(false);
        mutateUsers();
      } catch {
        toast.error("Something went wrong");
      }
    } else {
      // Create new user
      if (!form.fullName || !form.email || !form.password || !form.role) {
        toast.error("Full name, email, password, and role are required");
        return;
      }
      try {
        const res = await fetchWithAuth("/api/users", {
          method: "POST",
          body: JSON.stringify({
            fullName: form.fullName,
            email: form.email,
            phone: form.phone || undefined,
            password: form.password,
            role: form.role,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          toast.error(d.error || "Failed to create user");
          return;
        }
        toast.success("User created");
        setFormOpen(false);
        mutateUsers();
      } catch {
        toast.error("Something went wrong");
      }
    }
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    const u = suspendTarget;
    const newStatus = u.status === "active" ? "suspended" : "active";
    try {
      const res = await fetchWithAuth(`/api/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Failed to update status");
        return;
      }
      toast.success(`User ${newStatus === "active" ? "activated" : "suspended"}`);
      setSuspendTarget(null);
      mutateUsers();
    } catch {
      toast.error("Something went wrong");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchWithAuth(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Failed to delete user");
        return;
      }
      toast.success("User deleted");
      setDeleteTarget(null);
      mutateUsers();
    } catch {
      toast.error("Something went wrong");
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const columns: Column<User>[] = [
    {
      key: "user",
      header: "User",
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {u.photoUrl && <AvatarImage src={u.photoUrl} alt={u.fullName} />}
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {getInitials(u.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{u.fullName}</span>
            <span className="text-xs text-muted-foreground">{u.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Roles",
      className: "hidden md:table-cell",
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles?.map((role) => (
            <Badge key={role} variant="outline" className={`text-[10px] capitalize ${roleColors[role] || ""}`}>
              {getRoleLabel(role)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "lastLogin",
      header: "Created",
      className: "hidden lg:table-cell",
      render: (u) => (
        <span className="text-sm text-muted-foreground">
          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (u) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => openEdit(u)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            {u.status === "pending" && (
              <DropdownMenuItem className="text-emerald-400 focus:text-emerald-400" onClick={() => setSuspendTarget(u)}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Activate
              </DropdownMenuItem>
            )}
            {u.status === "active" && (
              <DropdownMenuItem className="text-amber-400 focus:text-amber-400" onClick={() => setSuspendTarget(u)}>
                <UserX className="mr-2 h-4 w-4" />
                Suspend
              </DropdownMenuItem>
            )}
            {(u.status === "inactive" || u.status === "suspended") && (
              <DropdownMenuItem className="text-emerald-400 focus:text-emerald-400" onClick={() => setSuspendTarget(u)}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Activate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteTarget(u)}
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
      <PageHeader title="Users" description="Manage system users and their role assignments.">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Users" value={stats.total} icon={Users} />
        <StatCard title="Active Users" value={stats.active} icon={Users} description="Currently active" />
        <StatCard title="Pending Approval" value={stats.pending} icon={Users} description="Awaiting review" />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search users..."
        emptyMessage="No users found."
        filterSlot={
          <div className="flex items-center gap-2">
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="SUPER_ADMIN">Platform Admin</SelectItem>
                <SelectItem value="ORGANIZATION_ADMIN">Federation Admin</SelectItem>
                <SelectItem value="LEAGUE_ADMIN">League Manager</SelectItem>
                <SelectItem value="CLUB_ADMIN">Club Manager</SelectItem>
                <SelectItem value="MATCH_EVENT_ADMIN">Match Recorder</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
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

      {/* Create / Edit Dialog */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingUser ? "Edit User" : "Create User"}
        description={editingUser ? "Update user details and role." : "Add a new system user."}
        submitLabel={editingUser ? "Update" : "Create"}
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="user-name">Full Name *</Label>
            <Input id="user-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Abebe Kebede" required minLength={2} maxLength={80} autoComplete="name" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-email">Email *</Label>
            <Input id="user-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="abebe@ethioleague.com" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-phone">
              Phone <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="user-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+251 911 234 567" pattern="^\+?[\d\s\-().]{7,20}$" title="Enter a valid phone number" autoComplete="tel" />
          </div>
          {!editingUser && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="user-pass">Password *</Label>
              <Input id="user-pass" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimum 8 characters" required minLength={8} autoComplete="new-password" />
            </div>
          )}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="user-role">Role</Label>
            <Select value={form.role} onValueChange={(val) => setForm({ ...form, role: val })}>
              <SelectTrigger id="user-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUPER_ADMIN">Platform Admin</SelectItem>
                <SelectItem value="ORGANIZATION_ADMIN">Federation Admin</SelectItem>
                <SelectItem value="LEAGUE_ADMIN">League Manager</SelectItem>
                <SelectItem value="CLUB_ADMIN">Club Manager</SelectItem>
                <SelectItem value="MATCH_EVENT_ADMIN">Match Recorder</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>

      {/* Suspend / Activate Confirmation */}
      <ConfirmDialog
        open={!!suspendTarget}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
        title={suspendTarget?.status === "active" ? "Suspend User" : "Activate User"}
        description={
          suspendTarget?.status === "active"
            ? `Suspend "${suspendTarget?.fullName}"? They will lose access until reactivated.`
            : `Activate "${suspendTarget?.fullName}"? They will regain access to the platform.`
        }
        confirmLabel={suspendTarget?.status === "active" ? "Suspend" : "Activate"}
        variant={suspendTarget?.status === "active" ? "destructive" : "default"}
        onConfirm={handleSuspend}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete User"
        description={`Are you sure you want to delete "${deleteTarget?.fullName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ─── League Admin View ────────────────────────────────────────────────────────
// Shows league admins, club admins, and match event admins in the same org

function LeagueAdminUsersView() {
  const { data: rawData, isLoading } = useSWR("/api/users", authFetcher);
  const users: User[] = useMemo(() => ((rawData?.data ?? rawData) ?? []).map(mapApiUser), [rawData]);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || u.roles.includes(roleFilter);
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => {
    const leagueAdmins = users.filter((u) => u.roles.includes("LEAGUE_ADMIN")).length;
    const clubAdmins = users.filter((u) => u.roles.includes("CLUB_ADMIN")).length;
    const matchAdmins = users.filter((u) => u.roles.includes("MATCH_EVENT_ADMIN")).length;
    return { total: users.length, leagueAdmins, clubAdmins, matchAdmins };
  }, [users]);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const columns: Column<User>[] = [
    {
      key: "user",
      header: "User",
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {u.photoUrl && <AvatarImage src={u.photoUrl} alt={u.fullName} />}
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {getInitials(u.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{u.fullName}</span>
            <span className="text-xs text-muted-foreground">{u.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Role",
      className: "hidden md:table-cell",
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles?.map((role) => (
            <Badge key={role} variant="outline" className={`text-[10px] capitalize ${roleColors[role] || ""}`}>
              {getRoleLabel(role)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      className: "hidden lg:table-cell",
      render: (u) => <span className="text-sm text-muted-foreground">{u.phone || "N/A"}</span>,
    },
    {
      key: "created",
      header: "Created",
      className: "hidden lg:table-cell",
      render: (u) => <span className="text-sm text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (u) => <StatusBadge status={u.status} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Users" description="Users in your organization." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Total" value={stats.total} icon={Users} />
        <StatCard title="League Admins" value={stats.leagueAdmins} icon={Users} />
        <StatCard title="Club Admins" value={stats.clubAdmins} icon={Users} />
        <StatCard title="Match Admins" value={stats.matchAdmins} icon={Users} />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search users..."
        emptyMessage="No users found."
        filterSlot={
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="LEAGUE_ADMIN">League Manager</SelectItem>
              <SelectItem value="CLUB_ADMIN">Club Manager</SelectItem>
              <SelectItem value="MATCH_EVENT_ADMIN">Match Recorder</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
}

// ─── Page Entry Point ────────────────────────────────────────────────────────

export default function UsersPage() {
  const { isSuperAdmin, isOrgAdmin, isLeagueAdmin } = useAuth();

  if (isSuperAdmin()) return <SuperAdminUsersView />;
  if (isOrgAdmin()) return <OrgAdminUsersView />;
  if (isLeagueAdmin()) return <LeagueAdminUsersView />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Users" description="You do not have permission to view this page." />
    </div>
  );
}
