"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { authFetcher } from "@/lib/fetch-client";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
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
import { Trophy, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  licenseLevel: string;
  experienceYears: number;
  club: string;
  role: string;
}

const licenseLevelColors: Record<string, string> = {
  "CAF A": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "CAF B": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "CAF C": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "CAF Pro": "bg-primary/15 text-primary border-primary/20",
  "FIFA Pro": "bg-red-500/15 text-red-400 border-red-500/20",
};

const mockCoaches: Coach[] = [
  { id: "1", firstName: "Wubetu", lastName: "Abate", dateOfBirth: "1978-03-15", nationality: "Ethiopian", licenseLevel: "CAF A", experienceYears: 15, club: "St. George FC", role: "Head Coach" },
  { id: "2", firstName: "Abraham", lastName: "Mebratu", dateOfBirth: "1980-07-22", nationality: "Ethiopian", licenseLevel: "CAF B", experienceYears: 12, club: "Ethio Electric SC", role: "Head Coach" },
  { id: "3", firstName: "Gebremedhin", lastName: "Haile", dateOfBirth: "1975-11-08", nationality: "Ethiopian", licenseLevel: "CAF Pro", experienceYears: 20, club: "Fasil Kenema FC", role: "Head Coach" },
  { id: "4", firstName: "Tilahun", lastName: "Bekele", dateOfBirth: "1985-05-30", nationality: "Ethiopian", licenseLevel: "CAF B", experienceYears: 8, club: "Hawassa Ketema FC", role: "Assistant Coach" },
  { id: "5", firstName: "Solomon", lastName: "Birhan", dateOfBirth: "1982-09-12", nationality: "Ethiopian", licenseLevel: "CAF A", experienceYears: 14, club: "Adama Ketema FC", role: "Head Coach" },
  { id: "6", firstName: "Yonas", lastName: "Tesfu", dateOfBirth: "1988-01-25", nationality: "Ethiopian", licenseLevel: "CAF C", experienceYears: 5, club: "Dire Dawa Ketema FC", role: "Goalkeeping Coach" },
  { id: "7", firstName: "Mulugeta", lastName: "Ashenafi", dateOfBirth: "1976-04-18", nationality: "Ethiopian", licenseLevel: "CAF A", experienceYears: 18, club: "Wolaita Dicha FC", role: "Head Coach" },
  { id: "8", firstName: "Tesfaye", lastName: "Dagne", dateOfBirth: "1990-08-03", nationality: "Ethiopian", licenseLevel: "CAF C", experienceYears: 3, club: "Sidama Bunna FC", role: "Fitness Coach" },
];

const emptyForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  nationality: "Ethiopian",
  licenseLevel: "",
  experienceYears: "",
  role: "",
};

export default function CoachesPage() {
  const { data, isLoading } = useSWR("/api/coaches", authFetcher, {
    fallbackData: mockCoaches,
    onError: () => {},
  });

  const coaches: Coach[] = data || mockCoaches;

  const [search, setSearch] = useState("");
  const [licenseFilter, setLicenseFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coach | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    return coaches.filter((c) => {
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      const matchesSearch =
        fullName.includes(search.toLowerCase()) ||
        c.club.toLowerCase().includes(search.toLowerCase());
      const matchesLicense = licenseFilter === "all" || c.licenseLevel === licenseFilter;
      return matchesSearch && matchesLicense;
    });
  }, [coaches, search, licenseFilter]);

  const stats = useMemo(() => {
    const headCoaches = coaches.filter((c) => c.role === "Head Coach").length;
    const avgExperience = coaches.length
      ? Math.round(coaches.reduce((s, c) => s + c.experienceYears, 0) / coaches.length)
      : 0;
    return { total: coaches.length, headCoaches, avgExperience };
  }, [coaches]);

  const openCreate = () => {
    setEditingCoach(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (coach: Coach) => {
    setEditingCoach(coach);
    setForm({
      firstName: coach.firstName,
      lastName: coach.lastName,
      dateOfBirth: coach.dateOfBirth,
      nationality: coach.nationality,
      licenseLevel: coach.licenseLevel,
      experienceYears: coach.experienceYears.toString(),
      role: coach.role,
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    await new Promise((r) => setTimeout(r, 500));
  };

  const handleDelete = async () => {
    await new Promise((r) => setTimeout(r, 500));
  };

  const getInitials = (first: string, last: string) =>
    `${first[0]}${last[0]}`.toUpperCase();

  const columns: Column<Coach>[] = [
    {
      key: "coach",
      header: "Coach",
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {getInitials(c.firstName, c.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {c.firstName} {c.lastName}
            </span>
            <span className="text-xs text-muted-foreground">{c.club}</span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      className: "hidden md:table-cell",
      render: (c) => (
        <span className="text-sm text-muted-foreground">{c.role}</span>
      ),
    },
    {
      key: "license",
      header: "License",
      className: "hidden md:table-cell",
      render: (c) => (
        <Badge variant="outline" className={`text-[10px] ${licenseLevelColors[c.licenseLevel] || ""}`}>
          {c.licenseLevel}
        </Badge>
      ),
    },
    {
      key: "experience",
      header: "Experience",
      className: "hidden lg:table-cell",
      render: (c) => (
        <span className="text-sm text-muted-foreground">{c.experienceYears} years</span>
      ),
    },
    {
      key: "nationality",
      header: "Nationality",
      className: "hidden xl:table-cell",
      render: (c) => (
        <span className="text-sm text-muted-foreground">{c.nationality}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => openEdit(c)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteTarget(c)}
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
      <PageHeader title="Coaches" description="Manage coaching staff across all clubs.">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Coach
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Coaches" value={stats.total} icon={Trophy} />
        <StatCard title="Head Coaches" value={stats.headCoaches} icon={Trophy} description="Leading their clubs" />
        <StatCard title="Avg. Experience" value={`${stats.avgExperience} yrs`} icon={Trophy} description="Years of coaching" />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search coaches..."
        emptyMessage="No coaches found."
        filterSlot={
          <Select value={licenseFilter} onValueChange={setLicenseFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="License" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Licenses</SelectItem>
              <SelectItem value="FIFA Pro">FIFA Pro</SelectItem>
              <SelectItem value="CAF Pro">CAF Pro</SelectItem>
              <SelectItem value="CAF A">CAF A</SelectItem>
              <SelectItem value="CAF B">CAF B</SelectItem>
              <SelectItem value="CAF C">CAF C</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Create / Edit Dialog */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingCoach ? "Edit Coach" : "Add Coach"}
        description={editingCoach ? "Update coach details." : "Register a new coach."}
        submitLabel={editingCoach ? "Update" : "Create"}
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="coach-first">First Name</Label>
            <Input id="coach-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Wubetu" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="coach-last">Last Name</Label>
            <Input id="coach-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Abate" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="coach-dob">Date of Birth</Label>
            <Input id="coach-dob" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="coach-nat">Nationality</Label>
            <Input id="coach-nat" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="Ethiopian" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="coach-license">License Level</Label>
            <Select value={form.licenseLevel} onValueChange={(val) => setForm({ ...form, licenseLevel: val })}>
              <SelectTrigger id="coach-license">
                <SelectValue placeholder="Select license" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIFA Pro">FIFA Pro</SelectItem>
                <SelectItem value="CAF Pro">CAF Pro</SelectItem>
                <SelectItem value="CAF A">CAF A</SelectItem>
                <SelectItem value="CAF B">CAF B</SelectItem>
                <SelectItem value="CAF C">CAF C</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="coach-exp">Experience (Years)</Label>
            <Input id="coach-exp" type="number" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} placeholder="10" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="coach-role">Coaching Role</Label>
            <Select value={form.role} onValueChange={(val) => setForm({ ...form, role: val })}>
              <SelectTrigger id="coach-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Head Coach">Head Coach</SelectItem>
                <SelectItem value="Assistant Coach">Assistant Coach</SelectItem>
                <SelectItem value="Goalkeeping Coach">Goalkeeping Coach</SelectItem>
                <SelectItem value="Fitness Coach">Fitness Coach</SelectItem>
                <SelectItem value="Youth Coach">Youth Coach</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Coach"
        description={`Are you sure you want to delete "${deleteTarget?.firstName} ${deleteTarget?.lastName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
