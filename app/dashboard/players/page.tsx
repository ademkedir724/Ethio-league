"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { UserCircle, Plus, MoreHorizontal, Pencil, Trash2, Eye, UserX, ShieldCheck, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { ImageGallery } from "@/components/dashboard/image-gallery";
import { MediaUploadWidget } from "@/components/dashboard/media-upload-widget";
import { RatingBadge } from "@/components/dashboard/rating-badge";
import { PlayerBulkImportDialog } from "@/components/dashboard/player-bulk-import-dialog";
import { ClubPendingBanner, useClubIsActive } from "@/components/dashboard/club-pending-banner";
import { useFormValidation } from "@/lib/use-form-validation";
import { validateRequired, validateLength, validateDateNotFuture, validateInteger } from "@/lib/validation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  primaryPosition?: { id: number; name: string; code: string } | null;
  preferredFoot?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  status: string;
  photoUrl?: string | null;
}

interface SeasonClubPlayer {
  id: string;
  jerseyNumber?: number | null;
  player: Player;
  position?: { id: number; name: string; code: string } | null;
}

interface Season {
  id: string;
  name: string;
  status: string;
}

interface SeasonClub {
  season: Season;
}

interface ClubDetail {
  id: string;
  name: string;
  seasonClubs: SeasonClub[];
}

const emptyForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  nationality: "Ethiopian",
  preferredFoot: "",
  heightCm: "",
  weightKg: "",
};

function getInitials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function getAge(dob: string) {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function validatePlayerForm(values: typeof emptyForm) {
  const errors: Partial<Record<keyof typeof emptyForm, string>> = {};
  errors.firstName = validateRequired(values.firstName, "First name") ?? validateLength(values.firstName, 2, 50, "First name") ?? undefined;
  errors.lastName = validateRequired(values.lastName, "Last name") ?? validateLength(values.lastName, 2, 50, "Last name") ?? undefined;
  errors.dateOfBirth = validateDateNotFuture(values.dateOfBirth, "Date of birth") ?? undefined;
  errors.nationality = validateLength(values.nationality, 0, 60, "Nationality") ?? undefined;
  errors.preferredFoot = undefined;
  errors.heightCm = validateInteger(values.heightCm, 100, 250, "Height") ?? undefined;
  errors.weightKg = validateInteger(values.weightKg, 30, 200, "Weight") ?? undefined;
  return errors;
}

// ─── Club Admin Players View ──────────────────────────────────────────────────

function ClubAdminPlayersView() {
  const { getClubId } = useAuth();
  const clubId = getClubId();
  const { isActive: clubIsActive } = useClubIsActive();

  const [search, setSearch] = useState("");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("unassigned");

  // All permanent players for this club (paginated)
  const { items: allPlayers, pagination, setPage, setLimit, isLoading: playersLoading, error, mutate: mutatePlayers } = usePaginated<Player>(
    "/api/players",
    {
      defaultLimit: 20,
      extraParams: { search: search || undefined },
    }
  );

  // Club details to get seasons
  const { data: clubDetail } = useSWR<ClubDetail>(
    clubId ? `/api/clubs/${clubId}` : null,
    authFetcher
  );

  const seasons: Season[] = useMemo(
    () => (clubDetail?.seasonClubs ?? []).map((sc) => sc.season),
    [clubDetail]
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const { errors, handleBlur, validateAll, resetValidation } = useFormValidation(validatePlayerForm, emptyForm);

  // Players assigned to the selected season
  const { data: seasonPlayers, isLoading: seasonPlayersLoading } = useSWR<SeasonClubPlayer[]>(
    selectedSeasonId !== "unassigned" ? `/api/seasons/${selectedSeasonId}/players` : null,
    authFetcher
  );

  const permanentPlayers: Player[] = allPlayers ?? [];

  // Display players: either paginated permanent list or season-specific list
  const displayPlayers = useMemo(() => {
    if (selectedSeasonId === "unassigned") {
      return permanentPlayers;
    }
    return (seasonPlayers ?? []).map((scp) => scp.player);
  }, [selectedSeasonId, permanentPlayers, seasonPlayers]);

  const openCreate = () => {
    setEditingPlayer(null);
    setForm(emptyForm);
    resetValidation();
    setFormOpen(true);
  };

  const openEdit = (player: Player) => {
    setEditingPlayer(player);
    setForm({
      firstName: player.firstName,
      lastName: player.lastName,
      dateOfBirth: player.dateOfBirth ? player.dateOfBirth.slice(0, 10) : "",
      nationality: player.nationality ?? "Ethiopian",
      preferredFoot: player.preferredFoot ?? "",
      heightCm: player.heightCm?.toString() ?? "",
      weightKg: player.weightKg?.toString() ?? "",
    });
    resetValidation();
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!validateAll(form)) return;

    // Duplicate check
    if (!editingPlayer) {
      const isDuplicate = permanentPlayers.some(
        (p) => p.firstName === form.firstName.trim() &&
          p.lastName === form.lastName.trim() &&
          p.dateOfBirth?.slice(0, 10) === form.dateOfBirth
      );
      if (isDuplicate) toast.warning("A player with the same name and DOB already exists.");
    }

    setIsSaving(true);
    try {
      let res: Response;
      if (editingPlayer) {
        res = await fetchWithAuth(`/api/players/${editingPlayer.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            dateOfBirth: form.dateOfBirth || null,
            nationality: form.nationality || null,
            preferredFoot: form.preferredFoot || null,
            heightCm: form.heightCm ? Number(form.heightCm) : null,
            weightKg: form.weightKg ? Number(form.weightKg) : null,
          }),
        });
      } else {
        res = await fetchWithAuth("/api/players", {
          method: "POST",
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            dateOfBirth: form.dateOfBirth || null,
            nationality: form.nationality || null,
            preferredFoot: form.preferredFoot || null,
            heightCm: form.heightCm ? Number(form.heightCm) : null,
            weightKg: form.weightKg ? Number(form.weightKg) : null,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Request failed");
      }

      toast.success(editingPlayer ? "Player updated" : "Player created");
      resetValidation();
      mutatePlayers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchWithAuth(`/api/players/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      toast.success("Player deleted");
      setDeleteTarget(null);
      mutatePlayers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const columns: Column<Player>[] = [
    {
      key: "player",
      header: "Player",
      render: (p) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {p.photoUrl && <AvatarImage src={p.photoUrl} alt={`${p.firstName} ${p.lastName}`} />}
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {getInitials(p.firstName, p.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{p.firstName} {p.lastName}</span>
            {p.primaryPosition && (
              <span className="text-xs text-muted-foreground">{p.primaryPosition.name}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "age",
      header: "Age",
      className: "hidden md:table-cell",
      render: (p) => (
        <span className="text-sm text-muted-foreground">
          {p.dateOfBirth ? getAge(p.dateOfBirth) : "—"}
        </span>
      ),
    },
    {
      key: "nationality",
      header: "Nationality",
      className: "hidden lg:table-cell",
      render: (p) => <span className="text-sm text-muted-foreground">{p.nationality ?? "—"}</span>,
    },
    {
      key: "foot",
      header: "Foot",
      className: "hidden lg:table-cell",
      render: (p) => <span className="text-sm text-muted-foreground">{p.preferredFoot ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => openEdit(p)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteTarget(p)}
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

  const isLoading = playersLoading || (selectedSeasonId !== "unassigned" && seasonPlayersLoading);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Players" description="Manage your club's players.">
        <Button variant="outline" onClick={() => setBulkImportOpen(true)} disabled={!clubIsActive}>
          <FileSpreadsheet className="h-4 w-4" />
          Import Excel
        </Button>
        <Button onClick={openCreate} disabled={!clubIsActive}>
          <Plus className="h-4 w-4" />
          Add Player
        </Button>
      </PageHeader>

      <ClubPendingBanner />

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load players.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard title="Total Players" value={pagination.total} icon={UserCircle} />
        <StatCard title="Active" value={permanentPlayers.filter((p) => p.status === "active").length} icon={UserCircle} />
        <StatCard title="Seasons" value={seasons.length} icon={UserCircle} description="Participated" />
      </div>

      {/* Season tabs */}
      <Tabs value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
        <TabsList className="mb-2 flex-wrap h-auto gap-1">
          <TabsTrigger value="unassigned">All Players</TabsTrigger>
          {seasons.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>
              {s.name}
              {s.status === "active" && (
                <Badge variant="outline" className="ml-1.5 text-[9px] text-emerald-400 border-emerald-500/30">
                  active
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedSeasonId}>
          <DataTable
            columns={columns}
            data={displayPlayers}
            isLoading={isLoading}
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search players..."
            emptyMessage={
              selectedSeasonId === "unassigned"
                ? "No players yet. Add your first player."
                : "No players assigned to this season."
            }
          />
          {selectedSeasonId === "unassigned" && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={setPage}
              onLimitChange={setLimit}
            />
          )}
        </TabsContent>
      </Tabs>

      <FormDialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) resetValidation();
          setFormOpen(open);
        }}
        title={editingPlayer ? "Edit Player" : "Add Player"}
        description={editingPlayer ? "Update player details." : "Register a new player (permanent record)."}
        submitLabel={editingPlayer ? "Update" : "Create"}
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-first">First Name *</Label>
            <Input
              id="p-first"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              onBlur={() => handleBlur("firstName", form)}
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? "p-first-error" : undefined}
              placeholder="Abebe"
              required
              minLength={2}
              maxLength={50}
            />
            {errors.firstName && <p id="p-first-error" role="alert" className="text-xs text-destructive mt-1">{errors.firstName}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-last">Last Name *</Label>
            <Input
              id="p-last"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              onBlur={() => handleBlur("lastName", form)}
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? "p-last-error" : undefined}
              placeholder="Bikila"
              required
              minLength={2}
              maxLength={50}
            />
            {errors.lastName && <p id="p-last-error" role="alert" className="text-xs text-destructive mt-1">{errors.lastName}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-dob">
              Date of Birth <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="p-dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              onBlur={() => handleBlur("dateOfBirth", form)}
              aria-invalid={!!errors.dateOfBirth}
              aria-describedby={errors.dateOfBirth ? "p-dob-error" : undefined}
              max={new Date().toISOString().split("T")[0]}
            />
            {errors.dateOfBirth && <p id="p-dob-error" role="alert" className="text-xs text-destructive mt-1">{errors.dateOfBirth}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-nat">
              Nationality <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="p-nat"
              value={form.nationality}
              onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              onBlur={() => handleBlur("nationality", form)}
              aria-invalid={!!errors.nationality}
              aria-describedby={errors.nationality ? "p-nat-error" : undefined}
              placeholder="Ethiopian"
              maxLength={60}
            />
            {errors.nationality && <p id="p-nat-error" role="alert" className="text-xs text-destructive mt-1">{errors.nationality}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-foot">
              Preferred Foot <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Select value={form.preferredFoot || "none"} onValueChange={(v) => setForm({ ...form, preferredFoot: v === "none" ? "" : v })}>
              <SelectTrigger id="p-foot"><SelectValue placeholder="Select foot" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="right">Right</SelectItem>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-height">
              Height (cm) <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="p-height"
              type="number"
              value={form.heightCm}
              onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
              onBlur={() => handleBlur("heightCm", form)}
              aria-invalid={!!errors.heightCm}
              aria-describedby={errors.heightCm ? "p-height-error" : undefined}
              placeholder="178"
              min={100}
              max={250}
            />
            {errors.heightCm && <p id="p-height-error" role="alert" className="text-xs text-destructive mt-1">{errors.heightCm}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-weight">
              Weight (kg) <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="p-weight"
              type="number"
              value={form.weightKg}
              onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
              onBlur={() => handleBlur("weightKg", form)}
              aria-invalid={!!errors.weightKg}
              aria-describedby={errors.weightKg ? "p-weight-error" : undefined}
              placeholder="72"
              min={30}
              max={200}
            />
            {errors.weightKg && <p id="p-weight-error" role="alert" className="text-xs text-destructive mt-1">{errors.weightKg}</p>}
          </div>
        </div>
        {editingPlayer && (
          <div className="flex flex-col gap-2 mt-4">
            <Label>Player Photo</Label>
            <div className="flex items-center gap-3">
              {editingPlayer.photoUrl && (
                <Image
                  src={editingPlayer.photoUrl}
                  alt={`${editingPlayer.firstName} ${editingPlayer.lastName}`}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
              )}
              <MediaUploadWidget
                uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_PLAYER_PHOTO ?? "player_photo"}
                onSuccess={async (url) => {
                  try {
                    const res = await fetchWithAuth(`/api/players/${editingPlayer.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ photoUrl: url }),
                    });
                    if (!res.ok) throw new Error("Failed to update photo");
                    mutatePlayers();
                    toast.success("Photo updated");
                  } catch {
                    toast.error("Failed to save photo");
                  }
                }}
              >
                <Button type="button" variant="outline" size="sm">
                  {editingPlayer.photoUrl ? "Change Photo" : "Upload Photo"}
                </Button>
              </MediaUploadWidget>
            </div>
          </div>
        )}
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Player"
        description={`Delete "${deleteTarget?.firstName} ${deleteTarget?.lastName}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <PlayerBulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onSuccess={() => mutatePlayers()}
      />
    </div>
  );
}

// ─── Other Roles View (view-only) ─────────────────────────────────────────────

interface PlayerWithHistory extends Player {
  originClub?: { id: string; name: string } | null;
  seasonClubPlayers?: Array<{
    id: string;
    jerseyNumber: number | null;
    playerRole: string | null;
    requestStatus: string;
    position: { name: string } | null;
    seasonClub: {
      season: { id: string; name: string; status: string };
      club: { id: string; name: string };
    };
  }>;
  images?: Array<{ id: string; imageUrl: string; caption?: string | null; sortOrder: number }>;
}

function PlayerDetailDialog({ player, open, onClose }: { player: PlayerWithHistory | null; open: boolean; onClose: () => void }) {
  const { data: detail, isLoading } = useSWR<PlayerWithHistory>(
    open && player ? `/api/players/${player.id}` : null,
    authFetcher
  );
  const { data: playerImages } = useSWR<Array<{ id: string; imageUrl: string; caption?: string | null; sortOrder: number }>>(
    open && player ? `/api/players/${player.id}/images` : null,
    authFetcher
  );
  const p = detail ?? player;
  if (!p) return null;

  const currentSeason = p.seasonClubPlayers?.find((scp) => scp.seasonClub.season.status === "active");
  const pastSeasons = p.seasonClubPlayers?.filter((scp) => scp.seasonClub.season.status !== "active") ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{p.firstName} {p.lastName}</DialogTitle>
          <DialogDescription>
            {p.primaryPosition?.name ?? "No position"} · {p.nationality ?? "Unknown nationality"}
          </DialogDescription>
        </DialogHeader>

        {p.photoUrl && (
          <div className="flex justify-center">
            <Image
              src={p.photoUrl}
              alt={`${p.firstName} ${p.lastName}`}
              width={64}
              height={64}
              className="rounded-full object-cover"
            />
          </div>
        )}

        {isLoading ? <Skeleton className="h-32 w-full" /> : (
          <div className="flex flex-col gap-4">
            {/* Base info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Date of Birth</span><p className="font-medium">{p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : "—"}</p></div>
              <div><span className="text-muted-foreground">Preferred Foot</span><p className="font-medium capitalize">{p.preferredFoot ?? "—"}</p></div>
              <div><span className="text-muted-foreground">Height</span><p className="font-medium">{p.heightCm ? `${p.heightCm} cm` : "—"}</p></div>
              <div><span className="text-muted-foreground">Weight</span><p className="font-medium">{p.weightKg ? `${p.weightKg} kg` : "—"}</p></div>
              <div><span className="text-muted-foreground">Origin Club</span><p className="font-medium">{p.originClub?.name ?? "—"}</p></div>
              <div><span className="text-muted-foreground">Status</span><p className="font-medium capitalize">{p.status}</p></div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Rating</span>
                <div className="mt-1">
                  <RatingBadge entityType="player" entityId={p.id} />
                </div>
              </div>
            </div>

            {/* Current season */}
            {currentSeason && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Current Season</p>
                <div className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">{currentSeason.seasonClub.season.name} — {currentSeason.seasonClub.club.name}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Jersey #{currentSeason.jerseyNumber ?? "—"} · {currentSeason.position?.name ?? "—"} · {currentSeason.playerRole ?? "—"}
                  </p>
                </div>
              </div>
            )}

            {/* Past seasons */}
            {pastSeasons.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Season History</p>
                <div className="flex flex-col gap-2">
                  {pastSeasons.map((scp) => (
                    <div key={scp.id} className="rounded-md border border-border p-3 text-sm">
                      <p className="font-medium">{scp.seasonClub.season.name} — {scp.seasonClub.club.name}</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Jersey #{scp.jerseyNumber ?? "—"} · {scp.position?.name ?? "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photos */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Photos</p>
              <ImageGallery
                images={playerImages ?? []}
                canDelete={false}
                maxImages={3}
                emptyMessage="No photos yet."
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReadOnlyPlayersView() {
  const { isOrgAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const { items: players, pagination, setPage, setLimit, isLoading, error, mutate: mutatePlayers } = usePaginated<PlayerWithHistory>(
    "/api/players",
    { defaultLimit: 20, extraParams: { search: search || undefined } }
  );
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithHistory | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<PlayerWithHistory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlayerWithHistory | null>(null);

  // System-wide search
  const [systemInput, setSystemInput] = useState("");
  const [systemQuery, setSystemQuery] = useState("");
  const { data: systemPlayers, isLoading: systemLoading } = useSWR<PlayerWithHistory[]>(
    systemQuery.length >= 2 ? `/api/players?scope=system&search=${encodeURIComponent(systemQuery)}` : null,
    authFetcher
  );

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    const newStatus = suspendTarget.status === "active" ? "inactive" : "active";
    try {
      const res = await fetchWithAuth(`/api/players/${suspendTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed"); return; }
      toast.success(`Player ${newStatus === "active" ? "activated" : "suspended"}`);
      setSuspendTarget(null);
      mutatePlayers();
    } catch { toast.error("Something went wrong"); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchWithAuth(`/api/players/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed"); return; }
      toast.success("Player deleted");
      setDeleteTarget(null);
      mutatePlayers();
    } catch { toast.error("Something went wrong"); }
  };

  const columns: Column<Player>[] = [
    {
      key: "player",
      header: "Player",
      render: (p) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {p.photoUrl && <AvatarImage src={p.photoUrl} alt={`${p.firstName} ${p.lastName}`} />}
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {getInitials(p.firstName, p.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{p.firstName} {p.lastName}</span>
            {p.primaryPosition && <span className="text-xs text-muted-foreground">{p.primaryPosition.name}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "nationality",
      header: "Nationality",
      className: "hidden md:table-cell",
      render: (p) => <span className="text-sm text-muted-foreground">{p.nationality ?? "—"}</span>,
    },
    {
      key: "club",
      header: "Club",
      className: "hidden lg:table-cell",
      render: (p) => {
        const ph = p as PlayerWithHistory;
        const currentClub = ph.seasonClubPlayers?.find((scp) => scp.seasonClub.season.status === "active")?.seasonClub.club.name;
        return <span className="text-sm text-muted-foreground">{currentClub ?? ph.originClub?.name ?? "—"}</span>;
      },
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: "rating",
      header: "Rating",
      className: "hidden sm:table-cell",
      render: (p) => <RatingBadge entityType="player" entityId={p.id} compact />,
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (p) => {
        if (!isOrgAdmin()) {
          return (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
              onClick={() => setSelectedPlayer(p as PlayerWithHistory)}>
              <Eye className="h-4 w-4" />
            </Button>
          );
        }
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setSelectedPlayer(p as PlayerWithHistory)}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {p.status === "active" ? (
                <DropdownMenuItem onClick={() => setSuspendTarget(p as PlayerWithHistory)} className="text-amber-400 focus:text-amber-400">
                  <UserX className="mr-2 h-4 w-4" />
                  Suspend
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setSuspendTarget(p as PlayerWithHistory)} className="text-emerald-400 focus:text-emerald-400">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Activate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDeleteTarget(p as PlayerWithHistory)} className="text-destructive focus:text-destructive">
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
      <PageHeader title="Players" description="View registered players." />
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load players.
        </div>
      )}

      <Tabs defaultValue="scoped">
        <TabsList>
          <TabsTrigger value="scoped">Players</TabsTrigger>
          <TabsTrigger value="system">Search All Players</TabsTrigger>
        </TabsList>

        <TabsContent value="scoped" className="mt-4">
          <DataTable
            columns={columns}
            data={players}
            isLoading={isLoading}
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search players..."
            emptyMessage="No players found."
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

        <TabsContent value="system" className="mt-4">
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search all players by name (min 2 chars)..."
              value={systemInput}
              onChange={(e) => setSystemInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && systemInput.length >= 2) setSystemQuery(systemInput); }}
              className="max-w-sm"
            />
            <Button variant="outline" disabled={systemInput.length < 2}
              onClick={() => setSystemQuery(systemInput)}>
              Search
            </Button>
          </div>
          {systemQuery.length < 2 ? (
            <p className="text-sm text-muted-foreground">Type at least 2 characters and press Search.</p>
          ) : (
            <DataTable
              columns={columns}
              data={systemPlayers ?? []}
              isLoading={systemLoading}
              searchPlaceholder="Search players..."
              emptyMessage={`No players found for "${systemQuery}".`}
            />
          )}
        </TabsContent>
      </Tabs>

      <PlayerDetailDialog
        player={selectedPlayer}
        open={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />

      <ConfirmDialog
        open={!!suspendTarget}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
        title={suspendTarget?.status === "active" ? "Suspend Player" : "Activate Player"}
        description={
          suspendTarget?.status === "active"
            ? `Suspend "${suspendTarget?.firstName} ${suspendTarget?.lastName}"?`
            : `Activate "${suspendTarget?.firstName} ${suspendTarget?.lastName}"?`
        }
        confirmLabel={suspendTarget?.status === "active" ? "Suspend" : "Activate"}
        variant={suspendTarget?.status === "active" ? "destructive" : "default"}
        onConfirm={handleSuspend}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Player"
        description={`Permanently delete "${deleteTarget?.firstName} ${deleteTarget?.lastName}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ─── League Admin Players View ────────────────────────────────────────────────
// Tab 1: Players in this league's org | Tab 2: System-wide search

function LeagueAdminPlayersView() {
  // Org-scoped players (API already filters by leagueId for league_admin)
  const [search, setSearch] = useState("");
  const { items: leaguePlayers, pagination, setPage, setLimit, isLoading, error } = usePaginated<PlayerWithHistory>(
    "/api/players",
    { defaultLimit: 20, extraParams: { search: search || undefined } }
  );
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithHistory | null>(null);

  // System-wide search
  const [systemInput, setSystemInput] = useState("");
  const [systemQuery, setSystemQuery] = useState("");
  const { data: systemPlayers, isLoading: systemLoading } = useSWR<PlayerWithHistory[]>(
    systemQuery.length >= 2 ? `/api/players?scope=system&search=${encodeURIComponent(systemQuery)}` : null,
    authFetcher
  );

  const columns: Column<Player>[] = [
    {
      key: "player",
      header: "Player",
      render: (p) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {p.photoUrl && <AvatarImage src={p.photoUrl} alt={`${p.firstName} ${p.lastName}`} />}
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {getInitials(p.firstName, p.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{p.firstName} {p.lastName}</span>
            {p.primaryPosition && <span className="text-xs text-muted-foreground">{p.primaryPosition.name}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "nationality",
      header: "Nationality",
      className: "hidden md:table-cell",
      render: (p) => <span className="text-sm text-muted-foreground">{p.nationality ?? "—"}</span>,
    },
    {
      key: "club",
      header: "Club",
      className: "hidden lg:table-cell",
      render: (p) => {
        const ph = p as PlayerWithHistory;
        const currentClub = ph.seasonClubPlayers?.find((scp) => scp.seasonClub.season.status === "active")?.seasonClub.club.name;
        return <span className="text-sm text-muted-foreground">{currentClub ?? ph.originClub?.name ?? "—"}</span>;
      },
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: "rating",
      header: "Rating",
      className: "hidden sm:table-cell",
      render: (p) => <RatingBadge entityType="player" entityId={p.id} compact />,
    },
    {
      key: "view",
      header: "",
      className: "w-12",
      render: (p) => (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
          onClick={() => setSelectedPlayer(p as PlayerWithHistory)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Players" description="Players in your league's organization." />
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load players.
        </div>
      )}

      <Tabs defaultValue="league">
        <TabsList>
          <TabsTrigger value="league">My League Players</TabsTrigger>
          <TabsTrigger value="system">Search All Players</TabsTrigger>
        </TabsList>

        <TabsContent value="league" className="mt-4">
          <DataTable
            columns={columns}
            data={leaguePlayers}
            isLoading={isLoading}
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search players..."
            emptyMessage="No players found in your league."
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

        <TabsContent value="system" className="mt-4">
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search all players by name (min 2 chars)..."
              value={systemInput}
              onChange={(e) => setSystemInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && systemInput.length >= 2) setSystemQuery(systemInput); }}
              className="max-w-sm"
            />
            <Button variant="outline" disabled={systemInput.length < 2}
              onClick={() => setSystemQuery(systemInput)}>
              Search
            </Button>
          </div>
          {systemQuery.length < 2 ? (
            <p className="text-sm text-muted-foreground">Type at least 2 characters and press Search.</p>
          ) : (
            <DataTable
              columns={columns}
              data={systemPlayers ?? []}
              isLoading={systemLoading}
              searchPlaceholder="Search players..."
              emptyMessage={`No players found for "${systemQuery}".`}
            />
          )}
        </TabsContent>
      </Tabs>

      <PlayerDetailDialog
        player={selectedPlayer}
        open={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

export default function PlayersPage() {
  const { isClubAdmin, isLeagueAdmin } = useAuth();
  if (isClubAdmin()) return <ClubAdminPlayersView />;
  if (isLeagueAdmin()) return <LeagueAdminPlayersView />;
  return <ReadOnlyPlayersView />;
}
