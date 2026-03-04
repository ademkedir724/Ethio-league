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
import { UserCircle, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  position: string;
  preferredFoot: string;
  heightCm: number | null;
  weightKg: number | null;
  club: string;
  status: string;
}

const mockPlayers: Player[] = [
  { id: "1", firstName: "Abebe", lastName: "Bikila", dateOfBirth: "1998-05-12", nationality: "Ethiopian", position: "Forward", preferredFoot: "Right", heightCm: 178, weightKg: 72, club: "St. George FC", status: "active" },
  { id: "2", firstName: "Getaneh", lastName: "Kebede", dateOfBirth: "1996-03-08", nationality: "Ethiopian", position: "Forward", preferredFoot: "Right", heightCm: 175, weightKg: 70, club: "Ethio Electric SC", status: "active" },
  { id: "3", firstName: "Shimelis", lastName: "Bekele", dateOfBirth: "2000-11-22", nationality: "Ethiopian", position: "Midfielder", preferredFoot: "Left", heightCm: 172, weightKg: 68, club: "Fasil Kenema FC", status: "active" },
  { id: "4", firstName: "Dawit", lastName: "Estifanos", dateOfBirth: "1997-07-15", nationality: "Ethiopian", position: "Defender", preferredFoot: "Right", heightCm: 183, weightKg: 78, club: "Hawassa Ketema FC", status: "active" },
  { id: "5", firstName: "Yared", lastName: "Zeleke", dateOfBirth: "2001-01-30", nationality: "Ethiopian", position: "Goalkeeper", preferredFoot: "Right", heightCm: 188, weightKg: 82, club: "St. George FC", status: "active" },
  { id: "6", firstName: "Samuel", lastName: "Teshome", dateOfBirth: "1999-09-18", nationality: "Ethiopian", position: "Midfielder", preferredFoot: "Right", heightCm: 176, weightKg: 71, club: "Adama Ketema FC", status: "inactive" },
  { id: "7", firstName: "Henok", lastName: "Goitom", dateOfBirth: "2002-04-05", nationality: "Ethiopian", position: "Forward", preferredFoot: "Left", heightCm: 180, weightKg: 74, club: "Dire Dawa Ketema FC", status: "active" },
  { id: "8", firstName: "Biniyam", lastName: "Getnet", dateOfBirth: "1995-12-10", nationality: "Ethiopian", position: "Defender", preferredFoot: "Right", heightCm: 185, weightKg: 80, club: "Sidama Bunna FC", status: "active" },
  { id: "9", firstName: "Tewodros", lastName: "Mengistu", dateOfBirth: "2003-06-28", nationality: "Ethiopian", position: "Midfielder", preferredFoot: "Right", heightCm: 174, weightKg: 69, club: "Wolaita Dicha FC", status: "pending" },
  { id: "10", firstName: "Kidus", lastName: "Admasu", dateOfBirth: "2000-02-14", nationality: "Ethiopian", position: "Goalkeeper", preferredFoot: "Right", heightCm: 190, weightKg: 85, club: "Fasil Kenema FC", status: "active" },
];

const positionColors: Record<string, string> = {
  Forward: "bg-red-500/15 text-red-400 border-red-500/20",
  Midfielder: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  Defender: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Goalkeeper: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

const emptyForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  nationality: "Ethiopian",
  position: "",
  preferredFoot: "",
  heightCm: "",
  weightKg: "",
};

export default function PlayersPage() {
  const { data, isLoading } = useSWR("/api/players", authFetcher, {
    fallbackData: mockPlayers,
    onError: () => {},
  });

  const players: Player[] = data || mockPlayers;

  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    return players.filter((p) => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      const matchesSearch =
        fullName.includes(search.toLowerCase()) ||
        p.club.toLowerCase().includes(search.toLowerCase());
      const matchesPosition = positionFilter === "all" || p.position === positionFilter;
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesPosition && matchesStatus;
    });
  }, [players, search, positionFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = players.filter((p) => p.status === "active").length;
    const forwards = players.filter((p) => p.position === "Forward").length;
    return { total: players.length, active, forwards };
  }, [players]);

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
      dateOfBirth: player.dateOfBirth,
      nationality: player.nationality,
      position: player.position,
      preferredFoot: player.preferredFoot,
      heightCm: player.heightCm?.toString() || "",
      weightKg: player.weightKg?.toString() || "",
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

  const getAge = (dob: string) => {
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
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
            <span className="text-sm font-medium text-foreground">
              {p.firstName} {p.lastName}
            </span>
            <span className="text-xs text-muted-foreground">{p.club}</span>
          </div>
        </div>
      ),
    },
    {
      key: "position",
      header: "Position",
      className: "hidden md:table-cell",
      render: (p) => (
        <Badge variant="outline" className={`text-[10px] ${positionColors[p.position] || ""}`}>
          {p.position}
        </Badge>
      ),
    },
    {
      key: "age",
      header: "Age",
      className: "hidden md:table-cell",
      render: (p) => (
        <span className="text-sm text-muted-foreground">{getAge(p.dateOfBirth)}</span>
      ),
    },
    {
      key: "foot",
      header: "Foot",
      className: "hidden lg:table-cell",
      render: (p) => (
        <span className="text-sm text-muted-foreground">{p.preferredFoot}</span>
      ),
    },
    {
      key: "physical",
      header: "Height / Weight",
      className: "hidden xl:table-cell",
      render: (p) => (
        <span className="text-sm text-muted-foreground">
          {p.heightCm ? `${p.heightCm} cm` : "N/A"} / {p.weightKg ? `${p.weightKg} kg` : "N/A"}
        </span>
      ),
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
              <span className="sr-only">Actions</span>
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Players" description="Manage registered players across all clubs.">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Player
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Players" value={stats.total} icon={UserCircle} />
        <StatCard title="Active Players" value={stats.active} icon={UserCircle} description="Currently active" />
        <StatCard title="Forwards" value={stats.forwards} icon={UserCircle} description="Attack position" />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search players..."
        emptyMessage="No players found."
        filterSlot={
          <div className="flex items-center gap-2">
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                <SelectItem value="Forward">Forward</SelectItem>
                <SelectItem value="Midfielder">Midfielder</SelectItem>
                <SelectItem value="Defender">Defender</SelectItem>
                <SelectItem value="Goalkeeper">Goalkeeper</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Create / Edit Dialog */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingPlayer ? "Edit Player" : "Add Player"}
        description={editingPlayer ? "Update player details." : "Register a new player."}
        submitLabel={editingPlayer ? "Update" : "Create"}
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="player-first">First Name</Label>
            <Input id="player-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Abebe" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="player-last">Last Name</Label>
            <Input id="player-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Bikila" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="player-dob">Date of Birth</Label>
            <Input id="player-dob" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="player-nat">Nationality</Label>
            <Input id="player-nat" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="Ethiopian" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="player-pos">Position</Label>
            <Select value={form.position} onValueChange={(val) => setForm({ ...form, position: val })}>
              <SelectTrigger id="player-pos">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Forward">Forward</SelectItem>
                <SelectItem value="Midfielder">Midfielder</SelectItem>
                <SelectItem value="Defender">Defender</SelectItem>
                <SelectItem value="Goalkeeper">Goalkeeper</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="player-foot">Preferred Foot</Label>
            <Select value={form.preferredFoot} onValueChange={(val) => setForm({ ...form, preferredFoot: val })}>
              <SelectTrigger id="player-foot">
                <SelectValue placeholder="Select foot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Right">Right</SelectItem>
                <SelectItem value="Left">Left</SelectItem>
                <SelectItem value="Both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="player-height">Height (cm)</Label>
            <Input id="player-height" type="number" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} placeholder="178" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="player-weight">Weight (kg)</Label>
            <Input id="player-weight" type="number" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} placeholder="72" />
          </div>
        </div>
      </FormDialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Player"
        description={`Are you sure you want to delete "${deleteTarget?.firstName} ${deleteTarget?.lastName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
