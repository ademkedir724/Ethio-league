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
import { Whistle, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface Referee {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  licenseLevel: string;
  experienceYears: number;
  matchesOfficiated: number;
  region: string;
}

const licenseLevelColors: Record<string, string> = {
  "FIFA": "bg-primary/15 text-primary border-primary/20",
  "CAF Elite": "bg-red-500/15 text-red-400 border-red-500/20",
  "CAF A": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "CAF B": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "National": "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

const mockReferees: Referee[] = [
  { id: "1", firstName: "Bamlak", lastName: "Tessema", dateOfBirth: "1980-04-10", nationality: "Ethiopian", licenseLevel: "FIFA", experienceYears: 18, matchesOfficiated: 342, region: "Addis Ababa" },
  { id: "2", firstName: "Keneni", lastName: "Gurmessa", dateOfBirth: "1983-08-22", nationality: "Ethiopian", licenseLevel: "CAF A", experienceYears: 14, matchesOfficiated: 256, region: "Oromia" },
  { id: "3", firstName: "Melaku", lastName: "Terefe", dateOfBirth: "1985-12-05", nationality: "Ethiopian", licenseLevel: "CAF Elite", experienceYears: 12, matchesOfficiated: 198, region: "Amhara" },
  { id: "4", firstName: "Dereje", lastName: "Ayalew", dateOfBirth: "1990-02-18", nationality: "Ethiopian", licenseLevel: "CAF B", experienceYears: 7, matchesOfficiated: 112, region: "SNNPR" },
  { id: "5", firstName: "Habtamu", lastName: "Lemma", dateOfBirth: "1987-06-30", nationality: "Ethiopian", licenseLevel: "CAF A", experienceYears: 10, matchesOfficiated: 178, region: "Addis Ababa" },
  { id: "6", firstName: "Yitbarek", lastName: "Kebede", dateOfBirth: "1992-10-15", nationality: "Ethiopian", licenseLevel: "National", experienceYears: 4, matchesOfficiated: 65, region: "Tigray" },
  { id: "7", firstName: "Amanuel", lastName: "Girma", dateOfBirth: "1988-03-27", nationality: "Ethiopian", licenseLevel: "CAF A", experienceYears: 9, matchesOfficiated: 145, region: "Dire Dawa" },
  { id: "8", firstName: "Tadesse", lastName: "Wolde", dateOfBirth: "1995-11-08", nationality: "Ethiopian", licenseLevel: "National", experienceYears: 2, matchesOfficiated: 28, region: "Harari" },
];

const emptyForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  nationality: "Ethiopian",
  licenseLevel: "",
  experienceYears: "",
  region: "",
};

export default function RefereesPage() {
  const { data, isLoading } = useSWR("/api/referees", authFetcher, {
    fallbackData: mockReferees,
    onError: () => {},
  });

  const referees: Referee[] = data || mockReferees;

  const [search, setSearch] = useState("");
  const [licenseFilter, setLicenseFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<Referee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Referee | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    return referees.filter((r) => {
      const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
      const matchesSearch =
        fullName.includes(search.toLowerCase()) ||
        r.region.toLowerCase().includes(search.toLowerCase());
      const matchesLicense = licenseFilter === "all" || r.licenseLevel === licenseFilter;
      return matchesSearch && matchesLicense;
    });
  }, [referees, search, licenseFilter]);

  const stats = useMemo(() => {
    const fifa = referees.filter((r) => r.licenseLevel === "FIFA").length;
    const totalMatches = referees.reduce((s, r) => s + r.matchesOfficiated, 0);
    return { total: referees.length, fifa, totalMatches };
  }, [referees]);

  const openCreate = () => {
    setEditingRef(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (ref: Referee) => {
    setEditingRef(ref);
    setForm({
      firstName: ref.firstName,
      lastName: ref.lastName,
      dateOfBirth: ref.dateOfBirth,
      nationality: ref.nationality,
      licenseLevel: ref.licenseLevel,
      experienceYears: ref.experienceYears.toString(),
      region: ref.region,
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

  const columns: Column<Referee>[] = [
    {
      key: "referee",
      header: "Referee",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {getInitials(r.firstName, r.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {r.firstName} {r.lastName}
            </span>
            <span className="text-xs text-muted-foreground">{r.region}</span>
          </div>
        </div>
      ),
    },
    {
      key: "license",
      header: "License",
      className: "hidden md:table-cell",
      render: (r) => (
        <Badge variant="outline" className={`text-[10px] ${licenseLevelColors[r.licenseLevel] || ""}`}>
          {r.licenseLevel}
        </Badge>
      ),
    },
    {
      key: "experience",
      header: "Experience",
      className: "hidden lg:table-cell",
      render: (r) => (
        <span className="text-sm text-muted-foreground">{r.experienceYears} years</span>
      ),
    },
    {
      key: "matches",
      header: "Matches",
      className: "hidden lg:table-cell",
      render: (r) => (
        <span className="text-sm text-foreground">{r.matchesOfficiated}</span>
      ),
    },
    {
      key: "nationality",
      header: "Nationality",
      className: "hidden xl:table-cell",
      render: (r) => (
        <span className="text-sm text-muted-foreground">{r.nationality}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => openEdit(r)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteTarget(r)}
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
      <PageHeader title="Referees" description="Manage match officials and their certifications.">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Referee
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Referees" value={stats.total} icon={Whistle} />
        <StatCard title="FIFA Licensed" value={stats.fifa} icon={Whistle} description="International grade" />
        <StatCard title="Total Matches" value={stats.totalMatches} icon={Whistle} description="Officiated across all" />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search referees..."
        emptyMessage="No referees found."
        filterSlot={
          <Select value={licenseFilter} onValueChange={setLicenseFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="License" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Licenses</SelectItem>
              <SelectItem value="FIFA">FIFA</SelectItem>
              <SelectItem value="CAF Elite">CAF Elite</SelectItem>
              <SelectItem value="CAF A">CAF A</SelectItem>
              <SelectItem value="CAF B">CAF B</SelectItem>
              <SelectItem value="National">National</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Create / Edit Dialog */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingRef ? "Edit Referee" : "Add Referee"}
        description={editingRef ? "Update referee details." : "Register a new match official."}
        submitLabel={editingRef ? "Update" : "Create"}
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ref-first">First Name</Label>
            <Input id="ref-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Bamlak" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ref-last">Last Name</Label>
            <Input id="ref-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Tessema" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ref-dob">Date of Birth</Label>
            <Input id="ref-dob" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ref-nat">Nationality</Label>
            <Input id="ref-nat" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="Ethiopian" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ref-license">License Level</Label>
            <Select value={form.licenseLevel} onValueChange={(val) => setForm({ ...form, licenseLevel: val })}>
              <SelectTrigger id="ref-license">
                <SelectValue placeholder="Select license" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIFA">FIFA</SelectItem>
                <SelectItem value="CAF Elite">CAF Elite</SelectItem>
                <SelectItem value="CAF A">CAF A</SelectItem>
                <SelectItem value="CAF B">CAF B</SelectItem>
                <SelectItem value="National">National</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ref-exp">Experience (Years)</Label>
            <Input id="ref-exp" type="number" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} placeholder="10" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="ref-region">Region</Label>
            <Input id="ref-region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Addis Ababa" />
          </div>
        </div>
      </FormDialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Referee"
        description={`Are you sure you want to delete "${deleteTarget?.firstName} ${deleteTarget?.lastName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
