"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Layers, Plus, MoreHorizontal, Pencil, Trash2, Calendar, Link as LinkIcon, Copy, ShieldCheck, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MediaUploadWidget } from "@/components/dashboard/media-upload-widget";

// ─── Constants ────────────────────────────────────────────────────────────────

const AGE_CATEGORIES = ["Senior", "U21", "U20", "U18", "U17", "U15", "U14", "U13", "Youth"];
const DIVISION_LEVELS = [1, 2, 3, 4, 5];
const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "mixed", label: "Mixed" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeagueType {
  id: number;
  name: string;
}

interface League {
  id: string;
  name: string;
  organizationId: string;
  leagueTypeId: number | null;
  leagueType: { id: number; name: string } | null;
  genderCategory: string | null;
  ageCategory: string | null;
  divisionLevel: number | null;
  logoUrl: string | null;
  description: string | null;
  status: string;
  _count: { seasons: number };
}

const emptyForm = {
  name: "",
  leagueTypeId: "",
  genderCategory: "",
  ageCategory: "",
  divisionLevel: "",
  description: "",
  // League Admin fields
  adminFullName: "",
  adminEmail: "",
  adminPhone: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeaguesPage() {
  const router = useRouter();
  const { isOrgAdmin, getOrganizationId, isClubAdmin, getClubId } = useAuth();

  const canEdit = isOrgAdmin();
  const orgId = getOrganizationId();

  // Club admin gets their own view
  if (isClubAdmin()) {
    return <ClubAdminLeaguesView />;
  }

  const { data: leaguesData, isLoading, error } = useSWR<League[]>("/api/leagues", authFetcher);
  const { data: leagueTypesData } = useSWR<LeagueType[]>("/api/seasons/league-types", authFetcher);

  const leagues: League[] = leaguesData ?? [];
  const leagueTypes: LeagueType[] = leagueTypesData ?? [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLeague, setEditingLeague] = useState<League | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<League | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [setupLink, setSetupLink] = useState<string | null>(null);
  const [setupLinkEmail, setSetupLinkEmail] = useState<string>("");

  const filtered = useMemo(() => {
    return leagues.filter((l) => {
      const matchesSearch = l.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leagues, search, statusFilter]);

  const openCreate = () => {
    setEditingLeague(null);
    setForm(emptyForm);
    setLogoUrl("");
    setFormOpen(true);
  };

  const openEdit = (league: League) => {
    setEditingLeague(league);
    setForm({
      name: league.name,
      leagueTypeId: league.leagueTypeId?.toString() ?? "",
      genderCategory: league.genderCategory ?? "",
      ageCategory: league.ageCategory ?? "",
      divisionLevel: league.divisionLevel?.toString() ?? "",
      description: league.description ?? "",
      adminFullName: "",
      adminEmail: "",
      adminPhone: "",
    });
    setLogoUrl(league.logoUrl ?? "");
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("League name is required"); return; }

    // League admin is mandatory on create
    if (!editingLeague) {
      if (!form.adminFullName.trim()) { toast.error("League Admin full name is required"); return; }
      if (!form.adminEmail.trim()) { toast.error("League Admin email is required"); return; }
    }

    setIsSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        leagueTypeId: form.leagueTypeId ? parseInt(form.leagueTypeId) : null,
        genderCategory: form.genderCategory || null,
        ageCategory: form.ageCategory || null,
        divisionLevel: form.divisionLevel ? parseInt(form.divisionLevel) : null,
        description: form.description || null,
        logoUrl: logoUrl || null,
      };

      let res: Response;
      if (editingLeague) {
        res = await fetchWithAuth(`/api/leagues/${editingLeague.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        if (!orgId) { toast.error("No organization found for your account"); return; }
        const createBody: Record<string, unknown> = {
          ...body,
          organizationId: orgId,
          adminFullName: form.adminFullName.trim(),
          adminEmail: form.adminEmail.trim(),
          adminPhone: form.adminPhone.trim() || null,
        };
        res = await fetchWithAuth("/api/leagues", {
          method: "POST",
          body: JSON.stringify(createBody),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || (editingLeague ? "Failed to update league" : "Failed to create league"));
        return;
      }

      const result = await res.json();

      // Set setup link BEFORE closing form so state update is batched correctly
      const link = result.adminSetupLink ?? result.data?.adminSetupLink ?? null;
      if (link) {
        setSetupLinkEmail(form.adminEmail.trim());
        setSetupLink(link);
      }

      toast.success(editingLeague ? "League updated" : "League created");
      setFormOpen(false);
      mutate("/api/leagues");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchWithAuth(`/api/leagues/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete league");
        return;
      }
      toast.success("League deleted");
      setDeleteTarget(null);
      mutate("/api/leagues");
    } catch {
      toast.error("Failed to delete league");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Leagues" description="Manage your organization's leagues.">
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create League
          </Button>
        )}
      </PageHeader>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load leagues. Please try again.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search leagues..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* League Cards */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Layers className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No leagues found</p>
          {canEdit && (
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create your first league
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground -mt-2">
            {filtered.length} league{filtered.length !== 1 ? "s" : ""}
            {" · "}
            {filtered.filter((l) => l.status === "active").length} active
          </p>
          <div className="flex flex-col gap-3">
            {filtered.map((league) => (
              <LeagueCard
                key={league.id}
                league={league}
                canEdit={canEdit}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onViewSeasons={() => router.push(`/dashboard/leagues/${league.id}/seasons`)}
              />
            ))}
          </div>
        </>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) setFormOpen(false); }} modal={false}>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editingLeague ? "Edit League" : "Create League"}</DialogTitle>
            <DialogDescription>
              {editingLeague ? "Update league details." : "Fill in the details for the new league."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {/* League Name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="league-name">Name *</Label>
              <Input
                id="league-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ethiopian Premier League"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* League Type */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="league-type">League Type</Label>
                <Select
                  value={form.leagueTypeId || "none"}
                  onValueChange={(v) => setForm({ ...form, leagueTypeId: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="league-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {leagueTypes.map((lt) => {
                      const isRoundRobin = lt.name.toLowerCase().replace(/[^a-z]/g, "").includes("roundrobin") ||
                        lt.name.toLowerCase().includes("round");
                      return (
                        <SelectItem
                          key={lt.id}
                          value={lt.id.toString()}
                          disabled={!isRoundRobin}
                        >
                          {lt.name}{!isRoundRobin ? " (coming soon)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Gender */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={form.genderCategory || "none"}
                  onValueChange={(v) => setForm({ ...form, genderCategory: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {GENDER_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Age Category */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="age-category">Age Category</Label>
                <Select
                  value={form.ageCategory || "none"}
                  onValueChange={(v) => setForm({ ...form, ageCategory: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="age-category">
                    <SelectValue placeholder="Select age group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {AGE_CATEGORIES.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Division Level */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="division">Division Level</Label>
                <Select
                  value={form.divisionLevel || "none"}
                  onValueChange={(v) => setForm({ ...form, divisionLevel: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="division">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {DIVISION_LEVELS.map((d) => (
                      <SelectItem key={d} value={d.toString()}>Division {d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Logo */}
            <div className="flex flex-col gap-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <MediaUploadWidget
                  uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_LEAGUE_LOGO ?? "league_logo"}
                  onSuccess={(url) => setLogoUrl(url)}
                >
                  <Button variant="outline" size="sm" type="button">Upload Logo</Button>
                </MediaUploadWidget>
                {logoUrl && (
                  <Image src={logoUrl} alt="League logo preview" width={32} height={32} className="rounded object-cover" />
                )}
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            {/* League Admin section — only on create */}
            {!editingLeague && (
              <>
                <Separator />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">League Admin *</p>
                  <p className="text-xs text-muted-foreground">
                    A League Admin must be created with each new league. They will receive a password setup link.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="admin-name">Full Name *</Label>
                  <Input
                    id="admin-name"
                    value={form.adminFullName}
                    onChange={(e) => setForm({ ...form, adminFullName: e.target.value })}
                    placeholder="Abebe Kebede"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="admin-email">Email *</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={form.adminEmail}
                      onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                      placeholder="admin@example.com"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="admin-phone">Phone</Label>
                    <Input
                      id="admin-phone"
                      value={form.adminPhone}
                      onChange={(e) => setForm({ ...form, adminPhone: e.target.value })}
                      placeholder="+251 911 234 567"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Saving..." : editingLeague ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Setup Link Dialog */}
      <Dialog open={!!setupLink} onOpenChange={(open) => { if (!open) { setSetupLink(null); setSetupLinkEmail(""); } }}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
              League Admin Created
            </DialogTitle>
            <DialogDescription>
              The League Admin account for <strong>{setupLinkEmail}</strong> has been created.
              In production, the following password setup link would be sent via email.
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
                  {setupLink}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin + (setupLink ?? ""));
                    toast.success("Link copied to clipboard");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">This link will expire in 1 hour.</p>
            <Button className="w-full" onClick={() => { setSetupLink(null); setSetupLinkEmail(""); }}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete League"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? Leagues with seasons cannot be deleted.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ─── Club Admin Leagues View ──────────────────────────────────────────────────
// Shows the club's league → seasons → fixtures in a drill-down

function ClubAdminLeaguesView() {
  const router = useRouter();
  const { getClubId } = useAuth();
  const clubId = getClubId();

  // Fetch seasons this club participates in
  const { data: seasons, isLoading: seasonsLoading } = useSWR(
    clubId ? `/api/seasons?clubId=${clubId}` : null,
    authFetcher
  );

  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  // Fetch fixtures for selected season
  const { data: fixtures, isLoading: fixturesLoading } = useSWR(
    selectedSeasonId ? `/api/matches?seasonId=${selectedSeasonId}` : null,
    authFetcher
  );

  const formatDate = (d: string) =>
    new Date(d).toLocaleString(undefined, {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const selectedSeason = (seasons ?? []).find((s: { id: string }) => s.id === selectedSeasonId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My League" description="View your league, seasons, and scheduled fixtures." />

      {seasonsLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : !seasons || seasons.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Layers className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Your club is not registered in any season yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* League info from first season */}
          {seasons[0]?.league && (
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{seasons[0].league.name}</p>
                  <p className="text-xs text-muted-foreground">{seasons[0].league.organization?.name}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seasons list */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Seasons</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {seasons.map((season: { id: string; name: string; status: string; startDate: string; endDate: string; _count?: { matches: number } }) => (
                <Card
                  key={season.id}
                  className={`cursor-pointer transition-colors hover:border-primary/40 ${selectedSeasonId === season.id ? "border-primary/60 bg-primary/5" : ""}`}
                  onClick={() => setSelectedSeasonId(selectedSeasonId === season.id ? null : season.id)}
                >
                  <CardContent className="p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{season.name}</p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${season.status === "active" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "text-muted-foreground"}`}
                      >
                        {season.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(season.startDate).toLocaleDateString()} — {new Date(season.endDate).toLocaleDateString()}
                    </p>
                    {season._count && (
                      <p className="text-xs text-muted-foreground">{season._count.matches} fixture{season._count.matches !== 1 ? "s" : ""}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Fixtures for selected season */}
          {selectedSeasonId && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Fixtures — {selectedSeason?.name}
              </p>
              {fixturesLoading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : !fixtures || fixtures.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
                  <Calendar className="mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No fixtures generated for this season yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {fixtures.map((m: { id: string; matchDate: string; roundNumber: number | null; status: string; homeScore: number | null; awayScore: number | null; homeClub: { name: string }; awayClub: { name: string }; stadium: { name: string } | null }) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border border-border px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => router.push(`/dashboard/matches/${m.id}`)}
                    >
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-medium">
                          {m.homeClub?.name} <span className="text-muted-foreground font-normal">vs</span> {m.awayClub?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(m.matchDate)}
                          {m.stadium && ` · ${m.stadium.name}`}
                          {m.roundNumber && ` · Round ${m.roundNumber}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-semibold">
                          {m.homeScore !== null && m.awayScore !== null ? `${m.homeScore} - ${m.awayScore}` : "- vs -"}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${m.status === "live" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : m.status === "completed" ? "text-muted-foreground" : "text-amber-400 border-amber-500/30 bg-amber-500/10"}`}
                        >
                          {m.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── League Card ──────────────────────────────────────────────────────────────

interface LeagueCardProps {
  league: League;
  canEdit: boolean;
  onEdit: (league: League) => void;
  onDelete: (league: League) => void;
  onViewSeasons: () => void;
}

function LeagueCard({ league, canEdit, onEdit, onDelete, onViewSeasons }: LeagueCardProps) {
  const isActive = league.status === "active";
  const borderAccent = isActive ? "border-l-emerald-500" : "border-l-border";
  const statusColor = isActive
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : "bg-muted text-muted-foreground border-border";

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border border-border border-l-4 ${borderAccent} bg-card hover:bg-muted/30 transition-colors`}
    >
      {/* Logo */}
      {league.logoUrl ? (
        <Image
          src={league.logoUrl}
          alt={`${league.name} logo`}
          width={48}
          height={48}
          className="h-12 w-12 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-muted to-muted/60">
          <Layers className="h-5 w-5 text-muted-foreground" />
        </div>
      )}

      {/* Center info */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg font-semibold leading-tight truncate">{league.name}</span>
          {league.leagueType && (
            <Badge variant="outline" className="text-[10px] capitalize shrink-0">
              {league.leagueType.name}
            </Badge>
          )}
        </div>
        {(league.genderCategory || league.ageCategory || league.divisionLevel != null) && (
          <div className="flex flex-wrap gap-1.5">
            {league.genderCategory && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
                {league.genderCategory}
              </span>
            )}
            {league.ageCategory && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {league.ageCategory}
              </span>
            )}
            {league.divisionLevel != null && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Div {league.divisionLevel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex flex-col items-end gap-0.5">
          <span className="text-sm font-semibold tabular-nums">{league._count.seasons}</span>
          <span className="text-[10px] text-muted-foreground">season{league._count.seasons !== 1 ? "s" : ""}</span>
        </div>

        <Badge className={`text-[10px] border capitalize hidden sm:inline-flex ${statusColor}`} variant="outline">
          {league.status}
        </Badge>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={onViewSeasons}>
          View Seasons
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(league)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(league)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
