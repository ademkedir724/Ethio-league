"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Globe, MapPin, Pencil, Plus, Shield, Building2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stadium {
    id: string;
    name: string;
    city?: string | null;
    country?: string | null;
    capacity?: number | null;
    surfaceType?: string | null;
    builtYear?: number | null;
    description?: string | null;
}

interface Club {
    id: string;
    name: string;
    shortName?: string | null;
    logoUrl?: string | null;
    description?: string | null;
    website?: string | null;
    city?: string | null;
    country?: string | null;
    foundedYear?: number | null;
    status: string;
    primaryStadiumId?: string | null;
    primaryStadium?: Stadium | null;
    ownedStadiums?: Stadium[];
}

const SURFACE_TYPES = ["natural_grass", "artificial_turf", "hybrid", "indoor"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClubProfilePage() {
    const router = useRouter();
    const params = useParams();
    const { getClubId, isClubAdmin } = useAuth();

    // Always use the URL param as the club to display
    const urlClubId = params?.id as string | undefined;
    const myClubId = getClubId(); // the club admin's own club
    const clubId = urlClubId; // show whatever club is in the URL

    // Only show edit controls when viewing their own club
    const canEdit = isClubAdmin() && myClubId === clubId;

    if (!clubId) {
        router.replace("/dashboard");
        return null;
    }

    const { data: club, isLoading, error } = useSWR<Club>(
        `/api/clubs/${clubId}`,
        authFetcher
    );

    // Club edit state
    const [editOpen, setEditOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [clubForm, setClubForm] = useState({
        name: "", shortName: "", city: "", country: "",
        foundedYear: "", website: "", description: "",
    });

    // Stadium state
    const [stadiumOpen, setStadiumOpen] = useState(false);
    const [stadiumSaving, setStadiumSaving] = useState(false);
    const [stadiumForm, setStadiumForm] = useState({
        name: "", city: "", country: "", capacity: "",
        surfaceType: "", builtYear: "", description: "",
    });

    const openEdit = () => {
        if (!club) return;
        setClubForm({
            name: club.name ?? "",
            shortName: club.shortName ?? "",
            city: club.city ?? "",
            country: club.country ?? "",
            foundedYear: club.foundedYear?.toString() ?? "",
            website: club.website ?? "",
            description: club.description ?? "",
        });
        setEditOpen(true);
    };

    const handleSaveClub = async () => {
        if (!clubForm.name.trim()) { toast.error("Club name is required"); return; }
        setIsSaving(true);
        try {
            const res = await fetchWithAuth(`/api/clubs/${clubId}`, {
                method: "PATCH",
                body: JSON.stringify({
                    name: clubForm.name.trim(),
                    shortName: clubForm.shortName || null,
                    city: clubForm.city || null,
                    country: clubForm.country || null,
                    foundedYear: clubForm.foundedYear ? parseInt(clubForm.foundedYear) : null,
                    website: clubForm.website || null,
                    description: clubForm.description || null,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to update club");
            }
            toast.success("Club profile updated");
            setEditOpen(false);
            mutate(`/api/clubs/${clubId}`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to update club");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateStadium = async () => {
        if (!stadiumForm.name.trim()) { toast.error("Stadium name is required"); return; }
        setStadiumSaving(true);
        try {
            // Create stadium owned by this club
            const res = await fetchWithAuth("/api/stadiums", {
                method: "POST",
                body: JSON.stringify({
                    name: stadiumForm.name.trim(),
                    city: stadiumForm.city || null,
                    country: stadiumForm.country || null,
                    capacity: stadiumForm.capacity ? parseInt(stadiumForm.capacity) : null,
                    surfaceType: stadiumForm.surfaceType || null,
                    builtYear: stadiumForm.builtYear ? parseInt(stadiumForm.builtYear) : null,
                    description: stadiumForm.description || null,
                    ownerClubId: clubId,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to create stadium");
            }
            const stadium = await res.json();

            // Link as primary stadium
            await fetchWithAuth(`/api/clubs/${clubId}`, {
                method: "PATCH",
                body: JSON.stringify({ primaryStadiumId: stadium.id }),
            });

            toast.success("Stadium created and linked to your club");
            setStadiumOpen(false);
            setStadiumForm({ name: "", city: "", country: "", capacity: "", surfaceType: "", builtYear: "", description: "" });
            mutate(`/api/clubs/${clubId}`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to create stadium");
        } finally {
            setStadiumSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title={canEdit ? "My Club" : "Club Profile"} description={canEdit ? "Manage your club's profile and stadium." : "Club information."}>
                {!isLoading && !error && club && canEdit && (
                    <Button onClick={openEdit}>
                        <Pencil className="h-4 w-4" />
                        Edit Profile
                    </Button>
                )}
            </PageHeader>

            {club?.status === "pending" && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Club pending approval — lineup submission is disabled
                </div>
            )}

            {isLoading && (
                <Card>
                    <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-5 w-40" />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {error && !isLoading && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Failed to load club profile.
                </div>
            )}

            {club && !isLoading && (
                <>
                    {/* Club Info */}
                    <Card>
                        <CardHeader className="flex flex-row items-center gap-3 pb-3">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                                <Shield className="h-7 w-7 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">{club.name}</CardTitle>
                                {club.shortName && <p className="text-sm text-muted-foreground">{club.shortName}</p>}
                                <StatusBadge status={club.status} className="mt-1" />
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            {(club.city || club.country) && (
                                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location"
                                    value={[club.city, club.country].filter(Boolean).join(", ")} />
                            )}
                            {club.foundedYear && (
                                <InfoRow icon={<Shield className="h-4 w-4" />} label="Founded" value={club.foundedYear.toString()} />
                            )}
                            {club.website && (
                                <InfoRow icon={<Globe className="h-4 w-4" />} label="Website"
                                    value={<a href={club.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{club.website}</a>} />
                            )}
                            {club.description && (
                                <div className="flex flex-col gap-1 sm:col-span-2">
                                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</span>
                                    <p className="text-sm text-foreground">{club.description}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Stadium Section */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Building2 className="h-4 w-4" />
                                Stadium
                            </CardTitle>
                            {!club.primaryStadium && canEdit && (
                                <Button size="sm" onClick={() => setStadiumOpen(true)}>
                                    <Plus className="h-4 w-4" />
                                    Add Stadium
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            {club.primaryStadium ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <InfoRow icon={<Building2 className="h-4 w-4" />} label="Name" value={club.primaryStadium.name} />
                                    {(club.primaryStadium.city || club.primaryStadium.country) && (
                                        <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location"
                                            value={[club.primaryStadium.city, club.primaryStadium.country].filter(Boolean).join(", ")} />
                                    )}
                                    {club.primaryStadium.capacity && (
                                        <InfoRow icon={<Building2 className="h-4 w-4" />} label="Capacity"
                                            value={club.primaryStadium.capacity.toLocaleString()} />
                                    )}
                                    {club.primaryStadium.surfaceType && (
                                        <InfoRow icon={<Building2 className="h-4 w-4" />} label="Surface"
                                            value={club.primaryStadium.surfaceType.replace(/_/g, " ")} />
                                    )}
                                    {club.primaryStadium.builtYear && (
                                        <InfoRow icon={<Building2 className="h-4 w-4" />} label="Built"
                                            value={club.primaryStadium.builtYear.toString()} />
                                    )}
                                    {club.primaryStadium.description && (
                                        <div className="flex flex-col gap-1 sm:col-span-2">
                                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</span>
                                            <p className="text-sm text-foreground">{club.primaryStadium.description}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <Building2 className="mb-2 h-8 w-8 text-muted-foreground/40" />
                                    <p className="text-sm text-muted-foreground">No stadium linked yet.</p>
                                    {canEdit && (
                                        <Button variant="outline" size="sm" className="mt-3" onClick={() => setStadiumOpen(true)}>
                                            <Plus className="h-4 w-4" />
                                            Add Stadium
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Edit Club Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Club Profile</DialogTitle>
                        <DialogDescription>Update your club's permanent information.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2 sm:col-span-2">
                            <Label htmlFor="c-name">Club Name *</Label>
                            <Input id="c-name" value={clubForm.name} onChange={(e) => setClubForm({ ...clubForm, name: e.target.value })} placeholder="St. George FC" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="c-short">Short Name</Label>
                            <Input id="c-short" value={clubForm.shortName} onChange={(e) => setClubForm({ ...clubForm, shortName: e.target.value })} placeholder="SGF" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="c-founded">Founded Year</Label>
                            <Input id="c-founded" type="number" value={clubForm.foundedYear} onChange={(e) => setClubForm({ ...clubForm, foundedYear: e.target.value })} placeholder="1935" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="c-city">City</Label>
                            <Input id="c-city" value={clubForm.city} onChange={(e) => setClubForm({ ...clubForm, city: e.target.value })} placeholder="Addis Ababa" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="c-country">Country</Label>
                            <Input id="c-country" value={clubForm.country} onChange={(e) => setClubForm({ ...clubForm, country: e.target.value })} placeholder="Ethiopia" />
                        </div>
                        <div className="flex flex-col gap-2 sm:col-span-2">
                            <Label htmlFor="c-website">Website</Label>
                            <Input id="c-website" value={clubForm.website} onChange={(e) => setClubForm({ ...clubForm, website: e.target.value })} placeholder="https://club.com" />
                        </div>
                        <div className="flex flex-col gap-2 sm:col-span-2">
                            <Label htmlFor="c-desc">Description</Label>
                            <Textarea id="c-desc" value={clubForm.description} onChange={(e) => setClubForm({ ...clubForm, description: e.target.value })} rows={3} placeholder="Brief description..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveClub} disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Stadium Dialog */}
            <Dialog open={stadiumOpen} onOpenChange={setStadiumOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add Stadium</DialogTitle>
                        <DialogDescription>Create a stadium and link it to your club as the home ground.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2 sm:col-span-2">
                            <Label htmlFor="s-name">Stadium Name *</Label>
                            <Input id="s-name" value={stadiumForm.name} onChange={(e) => setStadiumForm({ ...stadiumForm, name: e.target.value })} placeholder="Addis Ababa Stadium" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="s-city">City</Label>
                            <Input id="s-city" value={stadiumForm.city} onChange={(e) => setStadiumForm({ ...stadiumForm, city: e.target.value })} placeholder="Addis Ababa" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="s-country">Country</Label>
                            <Input id="s-country" value={stadiumForm.country} onChange={(e) => setStadiumForm({ ...stadiumForm, country: e.target.value })} placeholder="Ethiopia" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="s-capacity">Capacity</Label>
                            <Input id="s-capacity" type="number" value={stadiumForm.capacity} onChange={(e) => setStadiumForm({ ...stadiumForm, capacity: e.target.value })} placeholder="35000" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="s-built">Built Year</Label>
                            <Input id="s-built" type="number" value={stadiumForm.builtYear} onChange={(e) => setStadiumForm({ ...stadiumForm, builtYear: e.target.value })} placeholder="1980" />
                        </div>
                        <div className="flex flex-col gap-2 sm:col-span-2">
                            <Label htmlFor="s-surface">Surface Type</Label>
                            <Select value={stadiumForm.surfaceType || "none"} onValueChange={(v) => setStadiumForm({ ...stadiumForm, surfaceType: v === "none" ? "" : v })}>
                                <SelectTrigger id="s-surface"><SelectValue placeholder="Select surface" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {SURFACE_TYPES.map((s) => (
                                        <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2 sm:col-span-2">
                            <Label htmlFor="s-desc">Description</Label>
                            <Textarea id="s-desc" value={stadiumForm.description} onChange={(e) => setStadiumForm({ ...stadiumForm, description: e.target.value })} rows={2} placeholder="Optional description..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setStadiumOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateStadium} disabled={stadiumSaving}>{stadiumSaving ? "Creating..." : "Create & Link"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {icon}{label}
            </div>
            <div className="text-sm text-foreground">{value}</div>
        </div>
    );
}
