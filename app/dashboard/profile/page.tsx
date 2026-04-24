"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorState } from "@/components/dashboard/error-state";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Eye, EyeOff } from "lucide-react";
import { MediaUploadWidget } from "@/components/dashboard/media-upload-widget";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

interface RoleScope {
    id: string;
    role: { name: string };
    organizationId?: string | null;
    seasonId?: string | null;
    clubId?: string | null;
    organization?: { name: string } | null;
    season?: { name: string } | null;
    club?: { name: string } | null;
}

interface UserProfile {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
    photoUrl?: string | null;
    status: string;
    roles: RoleScope[];
}

function ProfileSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-16 w-16 rounded-full" />
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="h-4 w-28" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        </div>
    );
}

function getScopeLabel(role: RoleScope): string | null {
    if (role.organization?.name) return role.organization.name;
    if (role.season?.name) return role.season.name;
    if (role.club?.name) return role.club.name;
    return null;
}

function formatRoleName(name: string) {
    return name
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

function getInitials(name: string) {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

export default function ProfilePage() {
    const { data: profile, isLoading, error } = useSWR<UserProfile>(
        "/api/users/me",
        authFetcher
    );

    // Edit profile dialog state
    const [editOpen, setEditOpen] = useState(false);
    const [editFullName, setEditFullName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    // Change password state
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
    const [pwSaving, setPwSaving] = useState(false);

    function openEdit() {
        if (!profile) return;
        setEditFullName(profile.fullName);
        setEditPhone(profile.phone ?? "");
        setEditOpen(true);
    }

    async function handleEditSave() {
        setEditSaving(true);
        try {
            const res = await fetchWithAuth("/api/users/me", {
                method: "PATCH",
                body: JSON.stringify({ fullName: editFullName, phone: editPhone }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Failed to update profile");
            } else {
                toast.success("Profile updated");
                mutate("/api/users/me");
                setEditOpen(false);
            }
        } catch {
            toast.error("Failed to update profile");
        } finally {
            setEditSaving(false);
        }
    }

    function validatePassword() {
        const errors: Record<string, string> = {};
        if (!currentPassword) errors.currentPassword = "Current password is required";
        if (newPassword.length < 8)
            errors.newPassword = "New password must be at least 8 characters";
        if (newPassword !== confirmPassword)
            errors.confirmPassword = "Passwords do not match";
        return errors;
    }

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault();
        const errors = validatePassword();
        if (Object.keys(errors).length > 0) {
            setPwErrors(errors);
            return;
        }
        setPwErrors({});
        setPwSaving(true);
        try {
            const res = await fetchWithAuth("/api/users/me/change-password", {
                method: "POST",
                body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Failed to change password");
            } else {
                toast.success("Password changed successfully");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            }
        } catch {
            toast.error("Failed to change password");
        } finally {
            setPwSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="My Profile" />

            {error && (
                <ErrorState
                    message="Failed to load profile. Please try again."
                    onRetry={() => mutate("/api/users/me")}
                />
            )}

            {isLoading && !error && <ProfileSkeleton />}

            {profile && !isLoading && (
                <>
                    {/* Profile display card */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Profile Information</CardTitle>
                            <Button variant="outline" size="sm" onClick={openEdit}>
                                Edit Profile
                            </Button>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-center gap-2">
                                    <Avatar className="h-16 w-16">
                                        {profile.photoUrl && (
                                            <AvatarImage src={profile.photoUrl} alt={profile.fullName} />
                                        )}
                                        <AvatarFallback className="text-lg">
                                            {getInitials(profile.fullName)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <MediaUploadWidget
                                        uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_USER_PROFILE ?? "user_profile"}
                                        onSuccess={async (url) => {
                                            try {
                                                const res = await fetchWithAuth("/api/users/me", {
                                                    method: "PATCH",
                                                    body: JSON.stringify({ photoUrl: url }),
                                                });
                                                if (res.ok) {
                                                    mutate("/api/users/me");
                                                    toast.success("Photo updated");
                                                } else {
                                                    toast.error("Failed to update photo");
                                                }
                                            } catch {
                                                toast.error("Failed to update photo");
                                            }
                                        }}
                                    >
                                        <Button variant="outline" size="sm" type="button">
                                            <Camera className="h-4 w-4 mr-1" />
                                            Change Photo
                                        </Button>
                                    </MediaUploadWidget>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <p className="text-lg font-semibold">{profile.fullName}</p>
                                    <p className="text-sm text-muted-foreground">{profile.email}</p>
                                    {profile.phone && (
                                        <p className="text-sm text-muted-foreground">{profile.phone}</p>
                                    )}
                                </div>
                            </div>

                            {profile.roles.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm font-medium">Roles</p>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.roles.map((r) => {
                                            const scope = getScopeLabel(r);
                                            return (
                                                <div key={r.id} className="flex items-center gap-1">
                                                    <Badge variant="secondary">
                                                        {formatRoleName(r.role.name)}
                                                    </Badge>
                                                    {scope && (
                                                        <span className="text-xs text-muted-foreground">
                                                            ({scope})
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Change password card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Change Password</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleChangePassword} className="flex flex-col gap-4 max-w-sm">
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="currentPassword">Current Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="currentPassword"
                                            type={showCurrentPassword ? "text" : "password"}
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            autoComplete="current-password"
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                                        >
                                            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    {pwErrors.currentPassword && (
                                        <p className="text-xs text-destructive">{pwErrors.currentPassword}</p>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="newPassword">New Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="newPassword"
                                            type={showNewPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            autoComplete="new-password"
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            aria-label={showNewPassword ? "Hide password" : "Show password"}
                                        >
                                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    {pwErrors.newPassword && (
                                        <p className="text-xs text-destructive">{pwErrors.newPassword}</p>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            autoComplete="new-password"
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                        >
                                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    {pwErrors.confirmPassword && (
                                        <p className="text-xs text-destructive">{pwErrors.confirmPassword}</p>
                                    )}
                                </div>
                                <Button type="submit" disabled={pwSaving} className="self-start">
                                    {pwSaving ? "Saving..." : "Change Password"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Edit Profile Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Profile</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-2">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="editFullName">Full Name</Label>
                            <Input
                                id="editFullName"
                                value={editFullName}
                                onChange={(e) => setEditFullName(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="editPhone">Phone</Label>
                            <Input
                                id="editPhone"
                                value={editPhone}
                                onChange={(e) => setEditPhone(e.target.value)}
                                placeholder="Optional"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
                            Cancel
                        </Button>
                        <Button onClick={handleEditSave} disabled={editSaving}>
                            {editSaving ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
