"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/org-context";
import { usePermissions } from "@/lib/use-permissions";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Layers,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  Users,
  Trophy,
  ChevronRight,
  ArrowLeft,
  Copy,
  Link as LinkIcon,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Season {
  id: string;
  name: string;
  leagueName: string;
  startDate: string;
  endDate: string;
  status: string;
  genderCategory: string | null;
  ageCategory: string | null;
  leagueType?: { id: number; name: string } | null;
  _count?: { seasonClubs: number; matches: number };
}

interface League {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  genderCategory: string | null;
  ageCategory: string | null;
  type: string | null;
  status: string;
  seasonCount: number;
  activeSeasonCount: number;
  totalClubs: number;
  totalMatches: number;
  seasons: Season[];
}

interface Referee {
  id: string;
  firstName: string;
  lastName: string;
  licenseLevel: string;
  status: string;
}

interface MatchEventAdmin {
  id: string;
  fullName: string;
  email: string;
  status: string;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const mockLeagues: League[] = [
  {
    id: "1",
    name: "Ethiopian Premier League",
    organizationId: "org-1",
    organizationName: "Ethiopian Football Federation",
    genderCategory: "male",
    ageCategory: "senior",
    type: "round_robin",
    status: "active",
    seasonCount: 3,
    activeSeasonCount: 1,
    totalClubs: 16,
    totalMatches: 240,
    seasons: [
      { id: "s1", name: "2025/26 Season", leagueName: "Ethiopian Premier League", startDate: "2025-09-01", endDate: "2026-06-30", status: "active", genderCategory: "male", ageCategory: "senior", _count: { seasonClubs: 16, matches: 120 } },
      { id: "s2", name: "2024/25 Season", leagueName: "Ethiopian Premier League", startDate: "2024-09-01", endDate: "2025-06-30", status: "completed", genderCategory: "male", ageCategory: "senior", _count: { seasonClubs: 16, matches: 120 } },
    ],
  },
  {
    id: "2",
    name: "Ethiopian Women's League",
    organizationId: "org-1",
    organizationName: "Ethiopian Football Federation",
    genderCategory: "female",
    ageCategory: "senior",
    type: "round_robin",
    status: "active",
    seasonCount: 2,
    activeSeasonCount: 1,
    totalClubs: 12,
    totalMatches: 132,
    seasons: [
      { id: "s3", name: "2025/26 Season", leagueName: "Ethiopian Women's League", startDate: "2025-09-01", endDate: "2026-05-31", status: "active", genderCategory: "female", ageCategory: "senior", _count: { seasonClubs: 12, matches: 66 } },
    ],
  },
  {
    id: "3",
    name: "Ethiopian Youth League U-21",
    organizationId: "org-1",
    organizationName: "Ethiopian Football Federation",
    genderCategory: "male",
    ageCategory: "u21",
    type: "hybrid",
    status: "draft",
    seasonCount: 1,
    activeSeasonCount: 0,
    totalClubs: 0,
    totalMatches: 0,
    seasons: [
      { id: "s4", name: "2025/26 Season", leagueName: "Ethiopian Youth League U-21", startDate: "2025-10-01", endDate: "2026-04-30", status: "upcoming", genderCategory: "male", ageCategory: "u21", _count: { seasonClubs: 0, matches: 0 } },
    ],
  },
];

const mockReferees: Referee[] = [
  { id: "r1", firstName: "Bamlak", lastName: "Tessema", licenseLevel: "FIFA", status: "active" },
  { id: "r2", firstName: "Keneni", lastName: "Gurmessa", licenseLevel: "CAF A", status: "active" },
  { id: "r3", firstName: "Melaku", lastName: "Terefe", licenseLevel: "CAF Elite", status: "active" },
];

const mockMatchEventAdmins: MatchEventAdmin[] = [
  { id: "mea1", fullName: "Yohannes Alemu", email: "yohannes@ethioleague.com", status: "active" },
  { id: "mea2", fullName: "Hana Bekele", email: "hana@ethioleague.com", status: "active" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function LeaguesPage() {
  const { organization, isLoading: orgLoading } = useOrganization();
  const { getOrganizationId, isOrgAdmin, isSuperAdmin } = useAuth();
  const { canManage, isViewOnly } = usePermissions();
  const orgId = getOrganizationId();

  const { data: leaguesData, isLoading: leaguesLoading } = useSWR<League[]>(
    orgId ? `/api/leagues?organizationId=${orgId}` : null,
    authFetcher,
    {
      fallbackData: mockLeagues,
      onError: () => {},
    }
  );

  const { data: refereesData } = useSWR<Referee[]>(
    orgId ? `/api/referees?organizationId=${orgId}` : null,
    authFetcher,
    {
      fallbackData: mockReferees,
      onError: () => {},
    }
  );

  const { data: usersData } = useSWR<MatchEventAdmin[]>(
    orgId ? `/api/users?organizationId=${orgId}` : null,
    authFetcher,
    {
      fallbackData: mockMatchEventAdmins,
      onError: () => {},
    }
  );

  const leagues = leaguesData || mockLeagues;
  const referees = refereesData || mockReferees;
  const matchEventAdmins = usersData || mockMatchEventAdmins;
  const isLoading = orgLoading || leaguesLoading;
  const canEdit = canManage("leagues");

  // State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [seasonFormOpen, setSeasonFormOpen] = useState(false);
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordSetupLink, setPasswordSetupLink] = useState<string | null>(null);

  // League creation form
  const [leagueForm, setLeagueForm] = useState({
    leagueName: "",
    genderCategory: "male",
    ageCategory: "senior",
    leagueTypeId: "",
    description: "",
    seasonName: "",
    startDate: "",
    endDate: "",
    adminFullName: "",
    adminEmail: "",
    adminPhone: "",
  });

  // Season creation form
  const [seasonForm, setSeasonForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    status: "upcoming",
  });

  // Assignments form
  const [selectedReferees, setSelectedReferees] = useState<string[]>([]);
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);

  // Filter leagues
  const filtered = useMemo(() => {
    return leagues.filter((league) => {
      const matchesSearch =
        league.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || league.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leagues, search, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = leagues.length;
    const active = leagues.filter((l) => l.activeSeasonCount > 0).length;
    const draft = leagues.filter((l) => l.status === "draft").length;
    const totalSeasons = leagues.reduce((sum, l) => sum + l.seasonCount, 0);
    return { total, active, draft, totalSeasons };
  }, [leagues]);

  // Handlers
  const resetLeagueForm = () => {
    setLeagueForm({
      leagueName: "",
      genderCategory: "male",
      ageCategory: "senior",
      leagueTypeId: "",
      description: "",
      seasonName: "",
      startDate: "",
      endDate: "",
      adminFullName: "",
      adminEmail: "",
      adminPhone: "",
    });
    setCreateStep(1);
  };

  const handleCreateLeague = async () => {
    if (!orgId) return;

    setIsSaving(true);
    try {
      const response = await fetchWithAuth("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          leagueName: leagueForm.leagueName,
          genderCategory: leagueForm.genderCategory,
          ageCategory: leagueForm.ageCategory,
          leagueTypeId: leagueForm.leagueTypeId ? parseInt(leagueForm.leagueTypeId) : null,
          description: leagueForm.description,
          seasonName: leagueForm.seasonName,
          startDate: leagueForm.startDate,
          endDate: leagueForm.endDate,
          adminFullName: leagueForm.adminFullName,
          adminEmail: leagueForm.adminEmail,
          adminPhone: leagueForm.adminPhone,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create league");
      }

      const data = await response.json();
      if (data.passwordSetupLink) {
        setPasswordSetupLink(data.passwordSetupLink);
      }

      toast.success("League created successfully");
      setCreateOpen(false);
      resetLeagueForm();
      mutate(orgId ? `/api/leagues?organizationId=${orgId}` : null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create league");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSeason = async () => {
    if (!selectedLeague || !selectedLeague.seasons[0]) return;

    setIsSaving(true);
    try {
      const response = await fetchWithAuth(
        `/api/leagues/${selectedLeague.seasons[0].id}/seasons`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(seasonForm),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create season");
      }

      toast.success("Season created successfully");
      setSeasonFormOpen(false);
      setSeasonForm({ name: "", startDate: "", endDate: "", status: "upcoming" });
      mutate(orgId ? `/api/leagues?organizationId=${orgId}` : null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create season");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAssignments = async () => {
    if (!selectedSeason) return;

    setIsSaving(true);
    try {
      const response = await fetchWithAuth(
        `/api/seasons/${selectedSeason.id}/assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refereeIds: selectedReferees,
            matchEventAdminIds: selectedAdmins,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save assignments");
      }

      toast.success("Assignments saved successfully");
      setAssignmentsOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save assignments");
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copied to clipboard");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getCategoryLabel = (gender: string | null, age: string | null) => {
    const parts = [];
    if (gender) parts.push(gender.charAt(0).toUpperCase() + gender.slice(1));
    if (age) parts.push(age.toUpperCase());
    return parts.join(" / ") || "General";
  };

  // ─── League List View ──────────────────────────────────────────────────────

  if (!selectedLeague) {
    const columns: Column<League>[] = [
      {
        key: "league",
        header: "League",
        render: (league) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{league.name}</span>
            <span className="text-xs text-muted-foreground">
              {getCategoryLabel(league.genderCategory, league.ageCategory)}
            </span>
          </div>
        ),
      },
      {
        key: "type",
        header: "Type",
        className: "hidden md:table-cell",
        render: (league) => (
          <Badge variant="outline" className="text-[10px] capitalize">
            {league.type?.replace(/_/g, " ") || "Standard"}
          </Badge>
        ),
      },
      {
        key: "seasons",
        header: "Seasons",
        className: "hidden md:table-cell",
        render: (league) => (
          <div className="flex flex-col">
            <span className="text-sm text-foreground">{league.seasonCount}</span>
            <span className="text-xs text-muted-foreground">
              {league.activeSeasonCount} active
            </span>
          </div>
        ),
      },
      {
        key: "clubs",
        header: "Clubs",
        className: "hidden lg:table-cell",
        render: (league) => (
          <span className="text-sm text-muted-foreground">{league.totalClubs}</span>
        ),
      },
      {
        key: "matches",
        header: "Matches",
        className: "hidden lg:table-cell",
        render: (league) => (
          <span className="text-sm text-muted-foreground">{league.totalMatches}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (league) => (
          <StatusBadge status={league.activeSeasonCount > 0 ? "active" : league.status} />
        ),
      },
      {
        key: "actions",
        header: "",
        className: "w-12",
        render: (league) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setSelectedLeague(league)}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">View</span>
          </Button>
        ),
      },
    ];

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={organization ? `${organization.name} - Leagues` : "Leagues"}
          description="Manage your organization's leagues and seasons."
        >
          {canEdit && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create League
            </Button>
          )}
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard title="Total Leagues" value={stats.total} icon={Layers} />
          <StatCard title="Active Leagues" value={stats.active} icon={Trophy} />
          <StatCard title="Draft Leagues" value={stats.draft} icon={Layers} />
          <StatCard title="Total Seasons" value={stats.totalSeasons} icon={Calendar} />
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search leagues..."
          emptyMessage="No leagues found. Create your first league to get started."
          filterSlot={
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          }
        />

        {/* Create League Dialog - Multi-Step */}
        <Dialog open={createOpen} onOpenChange={(open) => {
          if (!open) resetLeagueForm();
          setCreateOpen(open);
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {createStep === 1 ? "Create League - Details" : "Create League - League Admin"}
              </DialogTitle>
              <DialogDescription>
                {createStep === 1
                  ? "Enter the league details and first season information."
                  : "Create a League Admin who will manage this league."}
              </DialogDescription>
            </DialogHeader>

            {createStep === 1 ? (
              <div className="grid gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="league-name">League Name</Label>
                  <Input
                    id="league-name"
                    value={leagueForm.leagueName}
                    onChange={(e) => setLeagueForm({ ...leagueForm, leagueName: e.target.value })}
                    placeholder="Ethiopian Premier League"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="gender">Gender Category</Label>
                    <Select
                      value={leagueForm.genderCategory}
                      onValueChange={(v) => setLeagueForm({ ...leagueForm, genderCategory: v })}
                    >
                      <SelectTrigger id="gender">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="age">Age Category</Label>
                    <Select
                      value={leagueForm.ageCategory}
                      onValueChange={(v) => setLeagueForm({ ...leagueForm, ageCategory: v })}
                    >
                      <SelectTrigger id="age">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="senior">Senior</SelectItem>
                        <SelectItem value="u21">U-21</SelectItem>
                        <SelectItem value="u17">U-17</SelectItem>
                        <SelectItem value="youth">Youth</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="season-name">First Season Name</Label>
                  <Input
                    id="season-name"
                    value={leagueForm.seasonName}
                    onChange={(e) => setLeagueForm({ ...leagueForm, seasonName: e.target.value })}
                    placeholder="2025/26 Season"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={leagueForm.startDate}
                      onChange={(e) => setLeagueForm({ ...leagueForm, startDate: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={leagueForm.endDate}
                      onChange={(e) => setLeagueForm({ ...leagueForm, endDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  A League Admin will be created to manage this league. They will receive an email to set their password.
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="admin-name">Full Name</Label>
                  <Input
                    id="admin-name"
                    value={leagueForm.adminFullName}
                    onChange={(e) => setLeagueForm({ ...leagueForm, adminFullName: e.target.value })}
                    placeholder="Dawit Mengistu"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={leagueForm.adminEmail}
                    onChange={(e) => setLeagueForm({ ...leagueForm, adminEmail: e.target.value })}
                    placeholder="dawit@ethioleague.com"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="admin-phone">Phone (Optional)</Label>
                  <Input
                    id="admin-phone"
                    value={leagueForm.adminPhone}
                    onChange={(e) => setLeagueForm({ ...leagueForm, adminPhone: e.target.value })}
                    placeholder="+251 911 234 567"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              {createStep === 2 && (
                <Button variant="outline" onClick={() => setCreateStep(1)}>
                  Back
                </Button>
              )}
              {createStep === 1 ? (
                <Button
                  onClick={() => setCreateStep(2)}
                  disabled={!leagueForm.leagueName || !leagueForm.seasonName || !leagueForm.startDate || !leagueForm.endDate}
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleCreateLeague}
                  disabled={isSaving || !leagueForm.adminFullName || !leagueForm.adminEmail}
                >
                  {isSaving ? "Creating..." : "Create League"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Password Setup Link Dialog */}
        <Dialog open={!!passwordSetupLink} onOpenChange={() => setPasswordSetupLink(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
                League Created
              </DialogTitle>
              <DialogDescription>
                The League and League Admin have been created. Share this password setup link with the admin.
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
      </div>
    );
  }

  // ─── League Detail View ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Header with Back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedLeague(null)}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{selectedLeague.name}</h1>
          <p className="text-sm text-muted-foreground">
            {getCategoryLabel(selectedLeague.genderCategory, selectedLeague.ageCategory)} -{" "}
            {selectedLeague.organizationName}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setSeasonFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Season
          </Button>
        )}
      </div>

      {/* League Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Seasons" value={selectedLeague.seasonCount} icon={Calendar} />
        <StatCard title="Active" value={selectedLeague.activeSeasonCount} icon={Trophy} />
        <StatCard title="Total Clubs" value={selectedLeague.totalClubs} icon={Users} />
        <StatCard title="Total Matches" value={selectedLeague.totalMatches} icon={Layers} />
      </div>

      {/* Seasons List */}
      <Card>
        <CardHeader>
          <CardTitle>Seasons</CardTitle>
          <CardDescription>Manage seasons and assignments for this league.</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedLeague.seasons.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No seasons"
              description="Create your first season to start managing this league."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {selectedLeague.seasons.map((season) => (
                <div
                  key={season.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{season.name}</span>
                      <StatusBadge status={season.status} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(season.startDate)} - {formatDate(season.endDate)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {season._count?.seasonClubs || 0} clubs, {season._count?.matches || 0} matches
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedSeason(season);
                          setSelectedReferees([]);
                          setSelectedAdmins([]);
                          setAssignmentsOpen(true);
                        }}
                      >
                        <UserPlus className="mr-1 h-3 w-3" />
                        Assignments
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Season
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Season
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Season Dialog */}
      <Dialog open={seasonFormOpen} onOpenChange={setSeasonFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Season</DialogTitle>
            <DialogDescription>
              Create a new season for {selectedLeague.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-season-name">Season Name</Label>
              <Input
                id="new-season-name"
                value={seasonForm.name}
                onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                placeholder="2026/27 Season"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-start-date">Start Date</Label>
                <Input
                  id="new-start-date"
                  type="date"
                  value={seasonForm.startDate}
                  onChange={(e) => setSeasonForm({ ...seasonForm, startDate: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-end-date">End Date</Label>
                <Input
                  id="new-end-date"
                  type="date"
                  value={seasonForm.endDate}
                  onChange={(e) => setSeasonForm({ ...seasonForm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-status">Status</Label>
              <Select
                value={seasonForm.status}
                onValueChange={(v) => setSeasonForm({ ...seasonForm, status: v })}
              >
                <SelectTrigger id="new-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeasonFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSeason}
              disabled={isSaving || !seasonForm.name || !seasonForm.startDate || !seasonForm.endDate}
            >
              {isSaving ? "Creating..." : "Create Season"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignments Sheet */}
      <Sheet open={assignmentsOpen} onOpenChange={setAssignmentsOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Season Assignments</SheetTitle>
            <SheetDescription>
              Assign referees and match event admins to {selectedSeason?.name}.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-6">
            {/* Referees */}
            <div className="flex flex-col gap-3">
              <Label>Referees</Label>
              <ScrollArea className="h-48 rounded-lg border border-border p-2">
                {referees.map((referee) => (
                  <label
                    key={referee.id}
                    className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedReferees.includes(referee.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedReferees([...selectedReferees, referee.id]);
                        } else {
                          setSelectedReferees(selectedReferees.filter((id) => id !== referee.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-border"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {referee.firstName} {referee.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {referee.licenseLevel}
                      </span>
                    </div>
                  </label>
                ))}
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {selectedReferees.length} referee(s) selected
              </p>
            </div>

            {/* Match Event Admins */}
            <div className="flex flex-col gap-3">
              <Label>Match Event Admins</Label>
              <ScrollArea className="h-48 rounded-lg border border-border p-2">
                {matchEventAdmins.map((admin) => (
                  <label
                    key={admin.id}
                    className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAdmins.includes(admin.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAdmins([...selectedAdmins, admin.id]);
                        } else {
                          setSelectedAdmins(selectedAdmins.filter((id) => id !== admin.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-border"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{admin.fullName}</span>
                      <span className="text-xs text-muted-foreground">{admin.email}</span>
                    </div>
                  </label>
                ))}
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {selectedAdmins.length} admin(s) selected
              </p>
            </div>

            <Button onClick={handleSaveAssignments} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Assignments"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
