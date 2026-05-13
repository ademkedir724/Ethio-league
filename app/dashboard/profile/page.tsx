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
import { useFormValidation } from "@/lib/use-form-validation";
import {
    validateRequired,
    validateLength,
    validatePhone,
    validatePassword,
    validatePasswordMatch,
} from "@/lib/validation";

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

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

type EditProfileValues = { editFullName: string; editPhone: string };
type ChangePasswordValues = {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
};

function validateEditProfile(
    values: EditProfileValues
): Partial<Record<keyof EditProfileValues, string>> {
    return {
        editFullName:
            validateRequired(values.editFullName, "Full name") ??
            validateLength(values.editFullName, 2, 80, "Full name") ??
            undefined,
        editPhone: validatePhone(values.editPhone, false) ?? undefined,
    };
}

function validateChangePassword(
    values: ChangePasswordValues
): Partial<Record<keyof ChangePasswordValues, string>> {
    return {
        currentPassword:
            validateRequired(values.currentPassword, "Current password") ?? undefined,
        newPassword: validatePassword(values.newPassword) ?? undefined,
        confirmPassword:
            validatePasswordMatch(values.newPassword, values.confirmPassword) ??
            undefined,
    };
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

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
    const [pwSaving, setPwSaving] = useState(false);

    // ---------------------------------------------------------------------------
    // Validation hooks — two separate instances, one per form
    // ---------------------------------------------------------------------------

    const {
        errors: editErrors,
        handleBlur: editHandleBlur,
        validateAll: editValidateAll,
        resetValidation: editResetValidation,
    } = useFormValidation<EditProfileValues>(validateEditProfile, {
        editFullName: "",
        editPhone: "",
    });

    const {
        errors: pwErrors,
        handleBlur: pwHandleBlur,
        validateAll: pwValidateAll,
        resetValidation: pwResetValidation,
    } = useFormValidation<ChangePasswordValues>(validateChangePassword, {
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    // ---------------------------------------------------------------------------
    // Edit profile handlers
    // ---------------------------------------------------------------------------

    function openEdit() {
        if (!profile) return;
        setEditFullName(profile.fullName);
        setEditPhone(profile.phone ?? "");
        setEditOpen(true);
    }

    function handleEditOpenChange(open: boolean) {
        setEditOpen(open);
        if (!open) {
            editResetValidation();
        }
    }

    async function handleEditSave() {
        const isValid = editValidateAll({ editFullName, editPhone });
        if (!isValid) return;

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
                editResetValidation();
                setEditOpen(false);
            }
        } catch {
            toast.error("Failed to update profile");
        } finally {
            setEditSaving(false);
        }
    }

    // ---------------------------------------------------------------------------
    // Change password handler
    // ---------------------------------------------------------------------------

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault();
        const isValid = pwValidateAll({ currentPassword, newPassword, confirmPassword });
        if (!isValid) return;

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
                pwResetValidation();
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
                                            onBlur={() =>
                                                pwHandleBlur("currentPassword", {
                                                    currentPassword,
                                                    newPassword,
                                                    confirmPassword,
                                                })
                                            }
                                            aria-invalid={!!pwErrors.currentPassword}
                                            aria-describedby={
                                                pwErrors.currentPassword
                                                    ? "currentPassword-error"
                                                    : undefined
                                            }
                                            required
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
                                        <p
                                            id="currentPassword-error"
                                            role="alert"
                                            className="text-xs text-destructive mt-1"
                                        >
                                            {pwErrors.currentPassword}
                                        </p>
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
                                            onBlur={() =>
                                                pwHandleBlur("newPassword", {
                                                    currentPassword,
                                                    newPassword,
                                                    confirmPassword,
                                                })
                                            }
                                            aria-invalid={!!pwErrors.newPassword}
                                            aria-describedby={
                                                pwErrors.newPassword ? "newPassword-error" : undefined
                                            }
                                            required
                                            minLength={8}
                                            placeholder="Minimum 8 characters"
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
                                        <p
                                            id="newPassword-error"
                                            role="alert"
                                            className="text-xs text-destructive mt-1"
                                        >
                                            {pwErrors.newPassword}
                                        </p>
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
                                            onBlur={() =>
                                                pwHandleBlur("confirmPassword", {
                                                    currentPassword,
                                                    newPassword,
                                                    confirmPassword,
                                                })
                                            }
                                            aria-invalid={!!pwErrors.confirmPassword}
                                            aria-describedby={
                                                pwErrors.confirmPassword
                                                    ? "confirmPassword-error"
                                                    : undefined
                                            }
                                            required
                                            minLength={8}
                                            placeholder="Repeat new password"
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
                                        <p
                                            id="confirmPassword-error"
                                            role="alert"
                                            className="text-xs text-destructive mt-1"
                                        >
                                            {pwErrors.confirmPassword}
                                        </p>
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
            <Dialog open={editOpen} onOpenChange={handleEditOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Profile</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-2">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="editFullName">Full Name *</Label>
                            <Input
                                id="editFullName"
                                value={editFullName}
                                onChange={(e) => setEditFullName(e.target.value)}
                                onBlur={() =>
                                    editHandleBlur("editFullName", { editFullName, editPhone })
                                }
                                aria-invalid={!!editErrors.editFullName}
                                aria-describedby={
                                    editErrors.editFullName ? "editFullName-error" : undefined
                                }
                                required
                                minLength={2}
                                maxLength={80}
                                placeholder="Abebe Kebede"
                                autoComplete="name"
                            />
                            {editErrors.editFullName && (
                                <p
                                    id="editFullName-error"
                                    role="alert"
                                    className="text-xs text-destructive mt-1"
                                >
                                    {editErrors.editFullName}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="editPhone">
                                Phone <span className="text-muted-foreground font-normal">(optional)</span>
                            </Label>
                            <Input
                                id="editPhone"
                                type="tel"
                                value={editPhone}
                                onChange={(e) => setEditPhone(e.target.value)}
                                onBlur={() =>
                                    editHandleBlur("editPhone", { editFullName, editPhone })
                                }
                                aria-invalid={!!editErrors.editPhone}
                                aria-describedby={
                                    editErrors.editPhone ? "editPhone-error" : undefined
                                }
                                placeholder="+251 911 234 567"
                                autoComplete="tel"
                            />
                            {editErrors.editPhone && (
                                <p
                                    id="editPhone-error"
                                    role="alert"
                                    className="text-xs text-destructive mt-1"
                                >
                                    {editErrors.editPhone}
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => handleEditOpenChange(false)}
                            disabled={editSaving}
                        >
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
