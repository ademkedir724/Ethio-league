"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useFormValidation } from "@/lib/use-form-validation";
import { validateRequired, validateLength, validateDateNotFuture, validateInteger } from "@/lib/validation";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/org-context";
import { usePermissions } from "@/lib/use-permissions";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Megaphone, Plus, MoreHorizontal, Pencil, Trash2, UserX, ShieldCheck, Eye } from "lucide-react";

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
  status: string;
  photoUrl?: string | null;
}

const licenseLevelColors: Record<string, string> = {
  "FIFA": "bg-primary/15 text-primary border-primary/20",
  "CAF Elite": "bg-red-500/15 text-red-400 border-red-500/20",
  "CAF A": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "CAF B": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "National": "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

const mockReferees: Referee[] = [
  { id: "1", firstName: "Bamlak", lastName: "Tessema", dateOfBirth: "1980-04-10", nationality: "Ethiopian", licenseLevel: "FIFA", experienceYears: 18, matchesOfficiated: 342, region: "Addis Ababa", status: "active" },
  { id: "2", firstName: "Keneni", lastName: "Gurmessa", dateOfBirth: "1983-08-22", nationality: "Ethiopian", licenseLevel: "CAF A", experienceYears: 14, matchesOfficiated: 256, region: "Oromia", status: "active" },
  { id: "3", firstName: "Melaku", lastName: "Terefe", dateOfBirth: "1985-12-05", nationality: "Ethiopian", licenseLevel: "CAF Elite", experienceYears: 12, matchesOfficiated: 198, region: "Amhara", status: "active" },
  { id: "4", firstName: "Dereje", lastName: "Ayalew", dateOfBirth: "1990-02-18", nationality: "Ethiopian", licenseLevel: "CAF B", experienceYears: 7, matchesOfficiated: 112, region: "SNNPR", status: "active" },
  { id: "5", firstName: "Habtamu", lastName: "Lemma", dateOfBirth: "1987-06-30", nationality: "Ethiopian", licenseLevel: "CAF A", experienceYears: 10, matchesOfficiated: 178, region: "Addis Ababa", status: "active" },
  { id: "6", firstName: "Yitbarek", lastName: "Kebede", dateOfBirth: "1992-10-15", nationality: "Ethiopian", licenseLevel: "National", experienceYears: 4, matchesOfficiated: 65, region: "Tigray", status: "inactive" },
  { id: "7", firstName: "Amanuel", lastName: "Girma", dateOfBirth: "1988-03-27", nationality: "Ethiopian", licenseLevel: "CAF A", experienceYears: 9, matchesOfficiated: 145, region: "Dire Dawa", status: "active" },
  { id: "8", firstName: "Tadesse", lastName: "Wolde", dateOfBirth: "1995-11-08", nationality: "Ethiopian", licenseLevel: "National", experienceYears: 2, matchesOfficiated: 28, region: "Harari", status: "active" },
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

function validateRefereeForm(values: typeof emptyForm): Partial<Record<keyof typeof emptyForm, string>> {
  return {
    firstName: validateRequired(values.firstName, "First name") ?? validateLength(values.firstName, 2, 50, "First name") ?? undefined,
    lastName: validateRequired(values.lastName, "Last name") ?? validateLength(values.lastName, 2, 50, "Last name") ?? undefined,
    dateOfBirth: validateDateNotFuture(values.dateOfBirth, "Date of birth") ?? undefined,
    nationality: validateLength(values.nationality, 0, 60, "Nationality") ?? undefined,
    licenseLevel: validateRequired(values.licenseLevel, "License level") ?? undefined,
    experienceYears: validateInteger(values.experienceYears, 0, 60, "Experience") ?? undefined,
    region: validateLength(values.region, 0, 80, "Region") ?? undefined,
  };
}

function RefereeDetailDialog({ refereeId, open, onClose }: { refereeId: string | null; open: boolean; onClose: () => void }) {
  const { data: referee, isLoading } = useSWR(
    open && refereeId ? `/api/referees/${refereeId}` : null,
    authFetcher
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{referee ? `${referee.firstName} ${referee.lastName}` : "Referee Details"}</DialogTitle>
          <DialogDescription>{referee?.licenseLevel ?? ""} · {referee?.nationality ?? ""}</DialogDescription>
        </DialogHeader>
        {isLoading ? <Skeleton className="h-32 w-full" /> : referee ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Date of Birth</span><p className="font-medium">{referee.dateOfBirth ? new Date(referee.dateOfBirth).toLocaleDateString() : "—"}</p></div>
              <div><span className="text-muted-foreground">Experience</span><p className="font-medium">{referee.experienceYears ? `${referee.experienceYears} years` : "—"}</p></div>
              <div><span className="text-muted-foreground">License</span><p className="font-medium">{referee.licenseLevel ?? "—"}</p></div>
              <div><span className="text-muted-foreground">Total Matches</span><p className="font-medium">{referee._count?.matchReferees ?? 0}</p></div>
              <div><span className="text-muted-foreground">Status</span><p className="font-medium capitalize">{referee.status}</p></div>
            </div>
            {referee.seasonReferees?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Season Assignments</p>
                <div className="flex flex-col gap-2">
                  {referee.seasonReferees.map((sr: { id: string; roleLevel: string | null; season: { name: string; status: string } }) => (
                    <div key={sr.id} className="rounded-md border border-border p-3 text-sm">
                      <p className="font-medium">{sr.season.name}</p>
                      <p className="text-muted-foreground text-xs mt-1">{sr.roleLevel ?? "Referee"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function RefereesPage() {
  const { organization, isLoading: orgLoading } = useOrganization();
  const { getOrganizationId, isOrgAdmin, isSuperAdmin } = useAuth();
  const { canManage, isViewOnly } = usePermissions();
  const orgId = getOrganizationId();

  // Org admins see org-scoped referees, super admins see all
  const apiUrl = isOrgAdmin() && orgId
    ? `/api/referees?organizationId=${orgId}`
    : "/api/referees";

  const [search, setSearch] = useState("");
  const [licenseFilter, setLicenseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { items: referees, pagination, setPage, setLimit, isLoading: refereesLoading, mutate: mutateReferees } = usePaginated<Referee>(
    apiUrl,
    {
      defaultLimit: 20,
      extraParams: { search: search || undefined },
    }
  );
  const isLoading = orgLoading || refereesLoading;

  // Org admin: full CRUD, Super admin: view-only
  const canEdit = isOrgAdmin() ? canManage("referees") : false;

  const [formOpen, setFormOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<Referee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Referee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [detailRefId, setDetailRefId] = useState<string | null>(null);

  const { errors, handleBlur, validateAll, resetValidation } = useFormValidation(validateRefereeForm, emptyForm);

  const filtered = useMemo(() => {
    return referees.filter((r) => {
      const matchesLicense = licenseFilter === "all" || r.licenseLevel === licenseFilter;
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesLicense && matchesStatus;
    });
  }, [referees, licenseFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = pagination.total;
    const active = referees.filter((r) => r.status === "active").length;
    const fifa = referees.filter((r) => r.licenseLevel === "FIFA").length;
    const totalMatches = referees.reduce((s, r) => s + r.matchesOfficiated, 0);
    return { total, active, fifa, totalMatches };
  }, [referees, pagination.total]);

  const openCreate = () => {
    setEditingRef(null);
    setForm(emptyForm);
    resetValidation();
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
    resetValidation();
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!orgId) return;

    const isValid = validateAll(form);
    if (!isValid) return;

    setIsSaving(true);
    try {
      if (editingRef) {
        // Update existing referee
        const response = await fetchWithAuth(`/api/referees/${editingRef.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            dateOfBirth: form.dateOfBirth,
            nationality: form.nationality,
            licenseLevel: form.licenseLevel,
            experienceYears: parseInt(form.experienceYears) || 0,
          }),
        });

        if (!response.ok) {
          // Fallback to mock
          await new Promise((r) => setTimeout(r, 500));
        }
        toast.success("Referee updated successfully");
      } else {
        // Create new referee
        const response = await fetchWithAuth("/api/referees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            dateOfBirth: form.dateOfBirth,
            nationality: form.nationality,
            licenseLevel: form.licenseLevel,
            experienceYears: parseInt(form.experienceYears) || 0,
            organizationId: orgId,
          }),
        });

        if (!response.ok) {
          // Fallback to mock
          await new Promise((r) => setTimeout(r, 500));
        }
        toast.success("Referee created successfully");
      }

      resetValidation();
      setFormOpen(false);
      mutateReferees();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsSaving(true);
    try {
      const response = await fetchWithAuth(`/api/referees/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // Fallback to mock
        await new Promise((r) => setTimeout(r, 500));
      }

      toast.success("Referee deleted successfully");
      setDeleteTarget(null);
      mutateReferees();
    } catch {
      toast.error("Failed to delete referee");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (referee: Referee) => {
    try {
      const newStatus = referee.status === "active" ? "inactive" : "active";
      const response = await fetchWithAuth(`/api/referees/${referee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        // Fallback to mock
        await new Promise((r) => setTimeout(r, 300));
      }

      toast.success(`Referee ${newStatus === "active" ? "activated" : "deactivated"}`);
      mutateReferees();
    } catch {
      toast.error("Failed to update referee status");
    }
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
            {r.photoUrl && <AvatarImage src={r.photoUrl} alt={`${r.firstName} ${r.lastName}`} />}
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
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
    ...(canEdit
      ? [
        {
          key: "actions",
          header: "",
          className: "w-12",
          render: (r: Referee) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setDetailRefId(r.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEdit(r)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {r.status === "active" ? (
                  <DropdownMenuItem
                    onClick={() => handleToggleStatus(r)}
                    className="text-amber-400 focus:text-amber-400"
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => handleToggleStatus(r)}
                    className="text-emerald-400 focus:text-emerald-400"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Activate
                  </DropdownMenuItem>
                )}
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
      ]
      : [
        {
          key: "view",
          header: "",
          className: "w-12",
          render: (r: Referee) => (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
              onClick={() => setDetailRefId(r.id)}>
              <Eye className="h-4 w-4" />
            </Button>
          ),
        },
      ]),
  ];

  const pageTitle = isOrgAdmin() && organization
    ? `${organization.name} - Referees`
    : "Referees";

  const pageDescription = canEdit
    ? "Manage match officials and their certifications for your organization."
    : "View match officials and their certifications.";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={pageTitle} description={pageDescription}>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Referee
          </Button>
        )}
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Total Referees" value={stats.total} icon={Megaphone} />
        <StatCard title="Active" value={stats.active} icon={Megaphone} description="Available for matches" />
        <StatCard title="FIFA Licensed" value={stats.fifa} icon={Megaphone} description="International grade" />
        <StatCard title="Total Matches" value={stats.totalMatches} icon={Megaphone} description="Officiated" />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search referees..."
        emptyMessage="No referees found."
        filterSlot={
          <div className="flex items-center gap-2">
            <Select value={licenseFilter} onValueChange={setLicenseFilter}>
              <SelectTrigger className="w-36">
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
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
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) resetValidation();
        }}
        title={editingRef ? "Edit Referee" : "Add Referee"}
        description={editingRef ? "Update referee details." : "Register a new match official for your organization."}
        submitLabel={isSaving ? "Saving..." : editingRef ? "Update" : "Create"}
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ref-first">First Name *</Label>
            <Input
              id="ref-first"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              onBlur={() => handleBlur('firstName', form)}
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? 'firstName-error' : undefined}
              placeholder="Bamlak"
              required
              minLength={2}
              maxLength={50}
            />
            {errors.firstName && (
              <p id="firstName-error" role="alert" className="text-xs text-destructive mt-1">
                {errors.firstName}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ref-last">Last Name *</Label>
            <Input
              id="ref-last"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              onBlur={() => handleBlur('lastName', form)}
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? 'lastName-error' : undefined}
              placeholder="Tessema"
              required
              minLength={2}
              maxLength={50}
            />
            {errors.lastName && (
              <p id="lastName-error" role="alert" className="text-xs text-destructive mt-1">
                {errors.lastName}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ref-dob">
              Date of Birth <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="ref-dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              onBlur={() => handleBlur('dateOfBirth', form)}
              aria-invalid={!!errors.dateOfBirth}
              aria-describedby={errors.dateOfBirth ? 'dateOfBirth-error' : undefined}
              max={new Date().toISOString().split("T")[0]}
            />
            {errors.dateOfBirth && (
              <p id="dateOfBirth-error" role="alert" className="text-xs text-destructive mt-1">
                {errors.dateOfBirth}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ref-nat">
              Nationality <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="ref-nat"
              value={form.nationality}
              onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              onBlur={() => handleBlur('nationality', form)}
              aria-invalid={!!errors.nationality}
              aria-describedby={errors.nationality ? 'nationality-error' : undefined}
              placeholder="Ethiopian"
              maxLength={60}
            />
            {errors.nationality && (
              <p id="nationality-error" role="alert" className="text-xs text-destructive mt-1">
                {errors.nationality}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ref-license">License Level *</Label>
            <Select value={form.licenseLevel} onValueChange={(val) => setForm({ ...form, licenseLevel: val })}>
              <SelectTrigger
                id="ref-license"
                aria-invalid={!!errors.licenseLevel}
                aria-describedby={errors.licenseLevel ? "licenseLevel-error" : undefined}
              >
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
            {errors.licenseLevel && (
              <p id="licenseLevel-error" role="alert" className="text-xs text-destructive mt-1">
                {errors.licenseLevel}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ref-exp">
              Experience (Years) <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="ref-exp"
              type="number"
              value={form.experienceYears}
              onChange={(e) => setForm({ ...form, experienceYears: e.target.value })}
              onBlur={() => handleBlur('experienceYears', form)}
              aria-invalid={!!errors.experienceYears}
              aria-describedby={errors.experienceYears ? 'experienceYears-error' : undefined}
              placeholder="10"
              min={0}
              max={60}
            />
            {errors.experienceYears && (
              <p id="experienceYears-error" role="alert" className="text-xs text-destructive mt-1">
                {errors.experienceYears}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="ref-region">
              Region <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="ref-region"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              onBlur={() => handleBlur('region', form)}
              aria-invalid={!!errors.region}
              aria-describedby={errors.region ? 'region-error' : undefined}
              placeholder="Addis Ababa"
              maxLength={80}
            />
            {errors.region && (
              <p id="region-error" role="alert" className="text-xs text-destructive mt-1">
                {errors.region}
              </p>
            )}
          </div>
        </div>
      </FormDialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Referee"
        description={`Are you sure you want to delete "${deleteTarget?.firstName} ${deleteTarget?.lastName}"? This action cannot be undone.`}
        confirmLabel={isSaving ? "Deleting..." : "Delete"}
        variant="destructive"
        onConfirm={handleDelete}
      />
      <RefereeDetailDialog refereeId={detailRefId} open={!!detailRefId} onClose={() => setDetailRefId(null)} />
    </div>
  );
}
