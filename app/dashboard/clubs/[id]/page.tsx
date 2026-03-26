"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Globe, MapPin, Pencil, Shield } from "lucide-react";

interface Club {
    id: string;
    name: string;
    logoUrl?: string | null;
    stadium?: string | null;
    description?: string | null;
    website?: string | null;
    city?: string | null;
    country?: string | null;
    status: string;
}

interface EditForm {
    name: string;
    logoUrl: string;
    description: string;
    website: string;
    city: string;
    country: string;
}

export default function ClubProfilePage() {
    const router = useRouter();
    const { getClubId } = useAuth();
    const clubId = getClubId();

    if (!clubId) {
        router.replace("/dashboard");
        return null;
    }

    const { data: club, isLoading, error } = useSWR<Club>(
        `/api/clubs/${clubId}`,
        authFetcher
    );

    const [editOpen, setEditOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState<EditForm>({
        name: "",
        logoUrl: "",
        description: "",
        website: "",
        city: "",
        country: "",
    });

    const openEdit = () => {
        if (!club) return;
        setForm({
            name: club.name ?? "",
            logoUrl: club.logoUrl ?? "",
            description: club.description ?? "",
            website: club.website ?? "",
            city: club.city ?? "",
            country: club.country ?? "",
        });
        setEditOpen(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetchWithAuth(`/api/clubs/${clubId}`, {
                method: "PATCH",
                body: JSON.stringify(form),
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

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Club Profile"
                description="View and manage your club's profile information."
            >
                {!isLoading && !error && club && (
                    <Button onClick={openEdit}>
                        <Pencil className="h-4 w-4" />
                        Edit Profile
                    </Button>
                )}
            </PageHeader>

            {/* Pending approval notice */}
            {club?.status === "pending" && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Club pending approval — lineup submission is disabled</span>
                </div>
            )}

            {/* Loading skeleton */}
            {isLoading && (
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-5 w-40" />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Error state */}
            {error && !isLoading && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Failed to load club profile. Please try again.
                </div>
            )}

            {/* Club info card */}
            {club && !isLoading && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            {club.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={club.logoUrl}
                                    alt={`${club.name} logo`}
                                    className="h-14 w-14 rounded-full object-cover"
                                />
                            ) : (
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                                    <Shield className="h-7 w-7 text-primary" />
                                </div>
                            )}
                            <div>
                                <CardTitle className="text-xl">{club.name}</CardTitle>
                                <StatusBadge status={club.status} className="mt-1" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-6 sm:grid-cols-2">
                        {club.stadium && (
                            <InfoRow
                                icon={<Shield className="h-4 w-4" />}
                                label="Stadium"
                                value={club.stadium}
                            />
                        )}
                        {(club.city || club.country) && (
                            <InfoRow
                                icon={<MapPin className="h-4 w-4" />}
                                label="Location"
                                value={[club.city, club.country].filter(Boolean).join(", ")}
                            />
                        )}
                        {club.website && (
                            <InfoRow
                                icon={<Globe className="h-4 w-4" />}
                                label="Website"
                                value={
                                    <a
                                        href={club.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary underline-offset-4 hover:underline"
                                    >
                                        {club.website}
                                    </a>
                                }
                            />
                        )}
                        {club.logoUrl && (
                            <InfoRow
                                icon={<Shield className="h-4 w-4" />}
                                label="Logo URL"
                                value={
                                    <span className="truncate text-muted-foreground">
                                        {club.logoUrl}
                                    </span>
                                }
                            />
                        )}
                        {club.description && (
                            <div className="flex flex-col gap-1 sm:col-span-2">
                                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Description
                                </span>
                                <p className="text-sm text-foreground">{club.description}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Edit Profile Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Club Profile</DialogTitle>
                        <DialogDescription>
                            Update your club&apos;s profile information.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2 sm:grid-cols-2">
                        <div className="flex flex-col gap-2 sm:col-span-2">
                            <Label htmlFor="edit-name">Club Name</Label>
                            <Input
                                id="edit-name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="St. George FC"
                            />
                        </div>
                        <div className="flex flex-col gap-2 sm:col-span-2">
                            <Label htmlFor="edit-logo">Logo URL</Label>
                            <Input
                                id="edit-logo"
                                value={form.logoUrl}
                                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                                placeholder="https://example.com/logo.png"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="edit-city">City</Label>
                            <Input
                                id="edit-city"
                                value={form.city}
                                onChange={(e) => setForm({ ...form, city: e.target.value })}
                                placeholder="Addis Ababa"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="edit-country">Country</Label>
                            <Input
                                id="edit-country"
                                value={form.country}
                                onChange={(e) => setForm({ ...form, country: e.target.value })}
                                placeholder="Ethiopia"
                            />
                        </div>
                        <div className="flex flex-col gap-2 sm:col-span-2">
                            <Label htmlFor="edit-website">Website</Label>
                            <Input
                                id="edit-website"
                                value={form.website}
                                onChange={(e) => setForm({ ...form, website: e.target.value })}
                                placeholder="https://club.com"
                            />
                        </div>
                        <div className="flex flex-col gap-2 sm:col-span-2">
                            <Label htmlFor="edit-description">Description</Label>
                            <Textarea
                                id="edit-description"
                                value={form.description}
                                onChange={(e) =>
                                    setForm({ ...form, description: e.target.value })
                                }
                                placeholder="Brief description of the club..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function InfoRow({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {icon}
                {label}
            </div>
            <div className="text-sm text-foreground">{value}</div>
        </div>
    );
}
