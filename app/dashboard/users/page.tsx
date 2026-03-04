"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { authFetcher } from "@/lib/fetch-client";
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
import { Users, Plus, MoreHorizontal, Pencil, Trash2, ShieldCheck, UserX } from "lucide-react";

interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roles: string[];
  status: string;
  lastLogin: string;
  createdAt: string;
}

const mockUsers: User[] = [
  { id: "1", fullName: "Abebe Kebede", email: "abebe@ethioleague.com", phone: "+251911234567", roles: ["SUPER_ADMIN"], status: "active", lastLogin: "2026-03-03", createdAt: "2024-01-01" },
  { id: "2", fullName: "Tigist Haile", email: "tigist@ethioleague.com", phone: "+251922345678", roles: ["ORGANIZATION_ADMIN"], status: "active", lastLogin: "2026-03-02", createdAt: "2024-03-15" },
  { id: "3", fullName: "Dawit Mengistu", email: "dawit@ethioleague.com", phone: "+251933456789", roles: ["LEAGUE_ADMIN"], status: "pending", lastLogin: "Never", createdAt: "2026-02-20" },
  { id: "4", fullName: "Sara Tesfaye", email: "sara@ethioleague.com", phone: "+251944567890", roles: ["CLUB_ADMIN"], status: "active", lastLogin: "2026-03-01", createdAt: "2024-06-10" },
  { id: "5", fullName: "Yohannes Alemu", email: "yohannes@ethioleague.com", phone: "+251955678901", roles: ["MATCH_EVENT_ADMIN"], status: "active", lastLogin: "2026-02-28", createdAt: "2025-01-05" },
  { id: "6", fullName: "Hana Bekele", email: "hana@ethioleague.com", phone: "+251966789012", roles: ["CLUB_ADMIN", "MATCH_EVENT_ADMIN"], status: "active", lastLogin: "2026-03-03", createdAt: "2025-04-12" },
  { id: "7", fullName: "Fitsum Girma", email: "fitsum@ethioleague.com", phone: "+251977890123", roles: ["ORGANIZATION_ADMIN"], status: "suspended", lastLogin: "2025-12-01", createdAt: "2024-08-20" },
  { id: "8", fullName: "Meron Tadesse", email: "meron@ethioleague.com", phone: "+251988901234", roles: ["LEAGUE_ADMIN"], status: "pending", lastLogin: "Never", createdAt: "2026-03-01" },
];

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-primary/15 text-primary border-primary/20",
  ORGANIZATION_ADMIN: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  LEAGUE_ADMIN: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  CLUB_ADMIN: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  MATCH_EVENT_ADMIN: "bg-violet-500/15 text-violet-400 border-violet-500/20",
};

const emptyForm = { fullName: "", email: "", phone: "", password: "", role: "" };

export default function UsersPage() {
  const { data, isLoading } = useSWR("/api/users", authFetcher, {
    fallbackData: mockUsers,
    onError: () => {},
  });

  const users: User[] = data || mockUsers;

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || u.roles.includes(roleFilter);
      const matchesStatus = statusFilter === "all" || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = users.filter((u) => u.status === "active").length;
    const pending = users.filter((u) => u.status === "pending").length;
    return { total: users.length, active, pending };
  }, [users]);

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
    await new Promise((r) => setTimeout(r, 500));
  };

  const handleDelete = async () => {
    await new Promise((r) => setTimeout(r, 500));
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
          {u.roles.map((role) => (
            <Badge key={role} variant="outline" className={`text-[10px] capitalize ${roleColors[role] || ""}`}>
              {role.replace(/_/g, " ").toLowerCase()}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "lastLogin",
      header: "Last Login",
      className: "hidden lg:table-cell",
      render: (u) => (
        <span className="text-sm text-muted-foreground">{u.lastLogin}</span>
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
              <DropdownMenuItem className="text-emerald-400 focus:text-emerald-400">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Approve
              </DropdownMenuItem>
            )}
            {u.status === "active" && (
              <DropdownMenuItem className="text-amber-400 focus:text-amber-400">
                <UserX className="mr-2 h-4 w-4" />
                Suspend
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
        onSearchChange={setSearch}
        searchPlaceholder="Search users..."
        emptyMessage="No users found."
        filterSlot={
          <div className="flex items-center gap-2">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                <SelectItem value="ORGANIZATION_ADMIN">Org Admin</SelectItem>
                <SelectItem value="LEAGUE_ADMIN">League Admin</SelectItem>
                <SelectItem value="CLUB_ADMIN">Club Admin</SelectItem>
                <SelectItem value="MATCH_EVENT_ADMIN">Match Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
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
            <Label htmlFor="user-name">Full Name</Label>
            <Input id="user-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Abebe Kebede" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="abebe@ethioleague.com" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-phone">Phone</Label>
            <Input id="user-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+251 911 234 567" />
          </div>
          {!editingUser && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="user-pass">Password</Label>
              <Input id="user-pass" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimum 8 characters" />
            </div>
          )}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="user-role">Role</Label>
            <Select value={form.role} onValueChange={(val) => setForm({ ...form, role: val })}>
              <SelectTrigger id="user-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                <SelectItem value="ORGANIZATION_ADMIN">Organization Admin</SelectItem>
                <SelectItem value="LEAGUE_ADMIN">League Admin</SelectItem>
                <SelectItem value="CLUB_ADMIN">Club Admin</SelectItem>
                <SelectItem value="MATCH_EVENT_ADMIN">Match Event Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>

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
