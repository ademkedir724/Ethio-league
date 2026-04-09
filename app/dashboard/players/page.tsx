"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/use-permissions";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserCircle, Plus, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

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

// ─── Club Admin Players View ──────────────────────────────────────────────────

function ClubAdminPlayersView() {
  const { getClubId } = useAuth();
  const clubId = getClubId();

  // All permanent players for this club
  const { data: allPlayers, isLoading: playersLoading, error } = useSWR<Player[]>(
    "/api/players",
    authFetcher
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

  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("unassigned");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  // Players assigned to the selected season
  const { data: seasonPlayers, isLoading: seasonPlayersLoading } = useSWR<SeasonClubPlayer[]>(
    selectedSeasonId !== "unassigned" ? `/api/seasons/${selectedSeasonId}/players` : null,
    authFetcher
  );

  const permanentPlayers: Player[] = allPlayers ?? [];

  // IDs of players assigned to ANY season
  const assignedPlayerIds = useMemo(() => {
    // We don't have a cross-season list easily, so we track per-season
    return new Set((seasonPlayers ?? []).map((scp) => scp.player.id));
  }, [seasonPlayers]);

  // Unassigned = permanent players not in the selected season (or all if "unassigned" tab)
  const displayPlayers = useMemo(() => {
    if (selectedSeasonId === "unassigned") {
      return permanentPlayers;
    }
    // Show season players
    return (seasonPlayers ?? []).map((scp) => scp.player);
  }, [selectedSeasonId, permanentPlayers, seasonPlayers]);

  const filtered = useMemo(() => {
    return displayPlayers.filter((p) => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      return fullName.includes(search.toLowerCase());
    });
  }, [displayPlayers, search]);

  const openCreate = () => {
    setEditingPlayer(null);
    setForm(emptyForm);
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
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }

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
      mutate("/api/players");
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
      mutate("/api/players");
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
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Player
        </Button>
      </PageHeader>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load players.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard title="Total Players" value={permanentPlayers.length} icon={UserCircle} />
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
            data={filtered}
            isLoading={isLoading}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search players..."
            emptyMessage={
              selectedSeasonId === "unassigned"
                ? "No players yet. Add your first player."
                : "No players assigned to this season."
            }
          />
        </TabsContent>
      </Tabs>

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingPlayer ? "Edit Player" : "Add Player"}
        description={editingPlayer ? "Update player details." : "Register a new player (permanent record)."}
        submitLabel={editingPlayer ? "Update" : "Create"}
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-first">First Name *</Label>
            <Input id="p-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Abebe" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-last">Last Name *</Label>
            <Input id="p-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Bikila" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-dob">Date of Birth</Label>
            <Input id="p-dob" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-nat">Nationality</Label>
            <Input id="p-nat" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="Ethiopian" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-foot">Preferred Foot</Label>
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
            <Label htmlFor="p-height">Height (cm)</Label>
            <Input id="p-height" type="number" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} placeholder="178" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-weight">Weight (kg)</Label>
            <Input id="p-weight" type="number" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} placeholder="72" />
          </div>
        </div>
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
}

function PlayerDetailDialog({ player, open, onClose }: { player: PlayerWithHistory | null; open: boolean; onClose: () => void }) {
  const { data: detail, isLoading } = useSWR<PlayerWithHistory>(
    open && player ? `/api/players/${player.id}` : null,
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReadOnlyPlayersView() {
  const { data: players, isLoading, error } = useSWR<PlayerWithHistory[]>("/api/players", authFetcher);
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithHistory | null>(null);

  const filtered = useMemo(() => {
    return (players ?? []).filter((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [players, search]);

  const columns: Column<Player>[] = [
    {
      key: "player",
      header: "Player",
      render: (p) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
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
      <PageHeader title="Players" description="View registered players." />
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load players.
        </div>
      )}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search players..."
        emptyMessage="No players found."
      />
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
  const { isClubAdmin } = useAuth();
  if (isClubAdmin()) return <ClubAdminPlayersView />;
  return <ReadOnlyPlayersView />;
}
