"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import useSWR, { mutate } from "swr";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/org-context";
import { usePermissions } from "@/lib/use-permissions";
import { usePaginated } from "@/lib/use-paginated";
import { Pagination } from "@/components/dashboard/pagination";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { FormDialog } from "@/components/dashboard/form-dialog";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { StatCard } from "@/components/dashboard/stat-card";
import { ImageGallery } from "@/components/dashboard/image-gallery";
import { MediaUploadWidget } from "@/components/dashboard/media-upload-widget";
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
import { Trophy, Plus, MoreHorizontal, Pencil, Trash2, Eye, UserX } from "lucide-react";
import { toast } from "sonner";
import { RatingBadge } from "@/components/dashboard/rating-badge";

interface CoachImage {
  id: string;
  imageUrl: string;
  caption?: string | null;
  sortOrder: number;
}

interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  licenseLevel: string;
  experienceYears: number;
  status: string;
  photoUrl?: string | null;
  clubId?: string | null;
  currentClub?: string | null;
  currentClubId?: string | null;
  coachingRole?: string | null;
  originClub?: { id: string; name: string } | null;
  seasonClubCoaches?: Array<{
    id: string;
    role: string;
    status: string;
    requestStatus: string;
    seasonClub: {
      season: { id: string; name: string; status: string };
      club: { id: string; name: string };
    };
  }>;
}

function CoachDetailDialog({ coachId, open, onClose }: { coachId: string | null; open: boolean; onClose: () => void }) {
  const { data: coach, isLoading } = useSWR<Coach>(
    open && coachId ? `/api/coaches/${coachId}` : null,
    authFetcher
  );
  const { data: coachImages } = useSWR<CoachImage[]>(
    open && coachId ? `/api/coaches/${coachId}/images` : null,
    authFetcher
  );

  const currentSeason = coach?.seasonClubCoaches?.find((scc) => scc.seasonClub.season.status === "active");
  const pastSeasons = coach?.seasonClubCoaches?.filter((scc) => scc.seasonClub.season.status !== "active") ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{coach ? `${coach.firstName} ${coach.lastName}` : "Coach Details"}</DialogTitle>
          <DialogDescription>{coach?.licenseLevel ?? ""} · {coach?.nationality ?? ""}</DialogDescription>
        </DialogHeader>
        {isLoading ? <Skeleton className="h-32 w-full" /> : coach ? (
          <div className="flex flex-col gap-4">
            {coach.photoUrl && (
              <div className="flex justify-center">
                <Image
                  src={coach.photoUrl}
                  alt={`${coach.firstName} ${coach.lastName}`}
                  width={64}
                  height={64}
                  className="rounded-full object-cover"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Date of Birth</span><p className="font-medium">{coach.dateOfBirth ? new Date(coach.dateOfBirth).toLocaleDateString() : "—"}</p></div>
              <div><span className="text-muted-foreground">Experience</span><p className="font-medium">{coach.experienceYears ? `${coach.experienceYears} years` : "—"}</p></div>
              <div><span className="text-muted-foreground">License</span><p className="font-medium">{coach.licenseLevel ?? "—"}</p></div>
              <div><span className="text-muted-foreground">Origin Club</span><p className="font-medium">{coach.originClub?.name ?? "—"}</p></div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Rating</span>
                <div className="mt-1">
                  {coach && <RatingBadge entityType="coach" entityId={coach.id} />}
                </div>
              </div>
            </div>
            {currentSeason && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Current Season</p>
                <div className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">{currentSeason.seasonClub.season.name} — {currentSeason.seasonClub.club.name}</p>
                  <p className="text-muted-foreground text-xs mt-1 capitalize">{currentSeason.role.replace(/_/g, " ")} · {currentSeason.status}</p>
                </div>
              </div>
            )}
            {pastSeasons.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Season History</p>
                <div className="flex flex-col gap-2">
                  {pastSeasons.map((scc) => (
                    <div key={scc.id} className="rounded-md border border-border p-3 text-sm">
                      <p className="font-medium">{scc.seasonClub.season.name} — {scc.seasonClub.club.name}</p>
                      <p className="text-muted-foreground text-xs mt-1 capitalize">{scc.role.replace(/_/g, " ")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Photos</p>
              <ImageGallery
                images={coachImages ?? []}
                canDelete={false}
                maxImages={3}
              />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const licenseLevelColors: Record<string, string> = {
  "CAF A": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "CAF B": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "CAF C": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "CAF Pro": "bg-primary/15 text-primary border-primary/20",
  "FIFA Pro": "bg-red-500/15 text-red-400 border-red-500/20",
};

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
  const { organization, isLoading: orgLoading } = useOrganization();
  const { getOrganizationId, isOrgAdmin, isSuperAdmin, isLeagueAdmin } = useAuth();
  const { canManage, isViewOnly } = usePermissions();
  const orgId = getOrganizationId();

  // Scope the API URL by role — league_admin scoping is handled server-side
  const apiUrl = "/api/coaches";

  const [search, setSearch] = useState("");
  const [licenseFilter, setLicenseFilter] = useState("all");
  const [clubFilter, setClubFilter] = useState("all");

  const { items: coaches, pagination, setPage, setLimit, isLoading: coachesLoading, error, mutate: mutateCoaches } = usePaginated<Coach>(
    apiUrl,
    {
      defaultLimit: 20,
      extraParams: { search: search || undefined },
    }
  );
  const isLoading = orgLoading || coachesLoading;

  // Both org admin and super admin are view-only for coaches
  // Only club admins can manage coaches
  const canEdit = canManage("coaches");

  const [formOpen, setFormOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coach | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formPhotoUrl, setFormPhotoUrl] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [detailCoachId, setDetailCoachId] = useState<string | null>(null);

  const clubs = useMemo(() => {
    const set = new Set(coaches.map((c) => c.currentClub).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [coaches]);

  const filtered = useMemo(() => {
    return coaches.filter((c) => {
      const clubName = (c.currentClub ?? "").toLowerCase();
      const matchesLicense = licenseFilter === "all" || c.licenseLevel === licenseFilter;
      const matchesClub = clubFilter === "all" || c.currentClub === clubFilter;
      return matchesLicense && matchesClub;
    });
  }, [coaches, licenseFilter, clubFilter]);

  const stats = useMemo(() => {
    const headCoaches = coaches.filter((c) =>
      c.coachingRole?.toLowerCase().includes("head")
    ).length;
    const avgExperience = coaches.length
      ? Math.round(coaches.reduce((s, c) => s + (c.experienceYears || 0), 0) / coaches.length)
      : 0;
    const proCertified = coaches.filter((c) =>
      c.licenseLevel === "CAF Pro" || c.licenseLevel === "FIFA Pro"
    ).length;
    return { total: pagination.total, headCoaches, avgExperience, proCertified };
  }, [coaches, pagination.total]);

  const openCreate = () => {
    setEditingCoach(null);
    setForm(emptyForm);
    setFormPhotoUrl("");
    setFormOpen(true);
  };

  const openEdit = (coach: Coach) => {
    setEditingCoach(coach);
    setForm({
      firstName: coach.firstName,
      lastName: coach.lastName,
      dateOfBirth: coach.dateOfBirth ? coach.dateOfBirth.slice(0, 10) : "",
      nationality: coach.nationality,
      licenseLevel: coach.licenseLevel,
      experienceYears: coach.experienceYears?.toString() ?? "",
      role: coach.coachingRole ?? "",
    });
    setFormPhotoUrl(coach.photoUrl ?? "");
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const body = JSON.stringify({
      firstName: form.firstName,
      lastName: form.lastName,
      dateOfBirth: form.dateOfBirth || null,
      nationality: form.nationality || null,
      licenseLevel: form.licenseLevel || null,
      experienceYears: parseInt(form.experienceYears) || 0,
      ...(formPhotoUrl && { photoUrl: formPhotoUrl }),
    });

    let res: Response;
    if (editingCoach) {
      res = await fetchWithAuth(`/api/coaches/${editingCoach.id}`, {
        method: "PATCH",
        body,
      });
    } else {
      res = await fetchWithAuth("/api/coaches", {
        method: "POST",
        body,
      });
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data.error || "Request failed";
      toast.error(msg);
      throw new Error(msg);
    }

    toast.success(editingCoach ? "Coach updated successfully." : "Coach created successfully.");
    mutateCoaches();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchWithAuth(`/api/coaches/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Request failed");
      }

      toast.success(`${deleteTarget.firstName} ${deleteTarget.lastName} deleted.`);
      setDeleteTarget(null);
      mutateCoaches();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    }
  };

  const handleDeactivate = async (coach: Coach) => {
    try {
      const res = await fetchWithAuth(`/api/coaches/${coach.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "inactive" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Request failed");
      }

      toast.success(`${coach.firstName} ${coach.lastName} deactivated.`);
      mutateCoaches();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    }
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
            {c.photoUrl && (
              <AvatarImage src={c.photoUrl} alt={`${c.firstName} ${c.lastName}`} />
            )}
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {getInitials(c.firstName, c.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {c.firstName} {c.lastName}
            </span>
            <span className="text-xs text-muted-foreground">{c.nationality ?? "—"}</span>
          </div>
        </div>
      ),
    },
    {
      key: "club",
      header: "Club",
      className: "hidden sm:table-cell",
      render: (c) => (
        <span className="text-sm text-muted-foreground">{c.currentClub ?? "—"}</span>
      ),
    },
    {
      key: "coachingRole",
      header: "Coaching Role",
      className: "hidden md:table-cell",
      render: (c) => (
        <span className="text-sm text-muted-foreground capitalize">
          {c.coachingRole ? c.coachingRole.replace(/_/g, " ") : "—"}
        </span>
      ),
    },
    {
      key: "license",
      header: "License",
      className: "hidden md:table-cell",
      render: (c) => (
        <Badge variant="outline" className={`text-[10px] ${licenseLevelColors[c.licenseLevel] || ""}`}>
          {c.licenseLevel || "—"}
        </Badge>
      ),
    },
    {
      key: "experience",
      header: "Experience",
      className: "hidden lg:table-cell",
      render: (c) => (
        <span className="text-sm text-muted-foreground">
          {c.experienceYears ? `${c.experienceYears} yrs` : "—"}
        </span>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      className: "hidden sm:table-cell",
      render: (c: Coach) => <RatingBadge entityType="coach" entityId={c.id} compact />,
    },
    // Actions column
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (c: Coach) => {
        if (canEdit) {
          return (
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
                <DropdownMenuItem onClick={() => handleDeactivate(c)}>
                  <UserX className="mr-2 h-4 w-4" />
                  Deactivate
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
          );
        }
        return (
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setDetailCoachId(c.id)}
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">View</span>
          </Button>
        );
      },
    },
  ];

  const pageTitle = isOrgAdmin() && organization
    ? `${organization.name} - Coaches`
    : "Coaches";

  const pageDescription = isOrgAdmin()
    ? "View coaching staff from clubs in your organization."
    : isLeagueAdmin()
      ? "View coaching staff in your league."
      : canEdit
        ? "Manage coaching staff across all clubs."
        : "View coaching staff across all clubs.";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={pageTitle} description={pageDescription}>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Coach
          </Button>
        )}
      </PageHeader>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load coaches. Please try again.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Total Coaches" value={stats.total} icon={Trophy} />
        <StatCard title="Head Coaches" value={stats.headCoaches} icon={Trophy} description="Leading their clubs" />
        <StatCard title="Avg. Experience" value={`${stats.avgExperience} yrs`} icon={Trophy} description="Years of coaching" />
        <StatCard title="Pro Certified" value={stats.proCertified} icon={Trophy} description="CAF/FIFA Pro" />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={coaches}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search coaches..."
        emptyMessage="No coaches found."
        filterSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={clubFilter} onValueChange={setClubFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Club" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clubs</SelectItem>
                {clubs.map((club) => (
                  <SelectItem key={club} value={club}>
                    {club}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={licenseFilter} onValueChange={setLicenseFilter}>
              <SelectTrigger className="w-32">
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

      {/* Create / Edit Dialog (only shown if canEdit) */}
      {canEdit && (
        <>
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
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label>Coach Photo</Label>
                <div className="flex items-center gap-3">
                  {formPhotoUrl && (
                    <Image
                      src={formPhotoUrl}
                      alt="Coach photo"
                      width={40}
                      height={40}
                      className="rounded-full object-cover"
                    />
                  )}
                  <MediaUploadWidget
                    uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_COACH_PHOTO ?? "coach_photo"}
                    onSuccess={(url) => setFormPhotoUrl(url)}
                  >
                    <Button type="button" variant="outline" size="sm">
                      {formPhotoUrl ? "Change Photo" : "Upload Photo"}
                    </Button>
                  </MediaUploadWidget>
                </div>
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
        </>
      )}
      <CoachDetailDialog coachId={detailCoachId} open={!!detailCoachId} onClose={() => setDetailCoachId(null)} />
    </div>
  );
}
