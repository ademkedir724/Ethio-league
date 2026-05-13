"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Shield, CheckCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useFormValidation } from "@/lib/use-form-validation";
import { validatePassword, validatePasswordMatch } from "@/lib/validation";

const initialValues = { password: "", confirm: "" };

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [done, setDone] = useState(false);

    const { errors, handleBlur, validateAll, resetValidation } =
        useFormValidation(
            (values) => ({
                password: validatePassword(values.password) ?? undefined,
                confirm: validatePasswordMatch(values.password, values.confirm) ?? undefined,
            }),
            initialValues
        );

    if (!token) {
        return (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
                <p className="text-sm text-destructive">Invalid or missing reset token.</p>
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                    Request a new reset link
                </Link>
            </div>
        );
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const formValues = { password, confirm };
        if (!validateAll(formValues)) return;

        setIsLoading(true);
        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Reset failed");
            resetValidation();
            setDone(true);
            setTimeout(() => router.push("/login"), 2500);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setIsLoading(false);
        }
    }

    return done ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-400" />
            <p className="text-sm font-medium text-foreground">Password reset successfully</p>
            <p className="text-sm text-muted-foreground">Redirecting you to login...</p>
        </div>
    ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                    <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Minimum 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => handleBlur("password", { password, confirm })}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        aria-invalid={!!errors.password}
                        aria-describedby={errors.password ? "password-error" : undefined}
                        className="pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
                {errors.password && (
                    <p id="password-error" role="alert" className="text-xs text-destructive mt-1">
                        {errors.password}
                    </p>
                )}
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <div className="relative">
                    <Input
                        id="confirm"
                        type={showConfirm ? "text" : "password"}
                        placeholder="Repeat your password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        onBlur={() => handleBlur("confirm", { password, confirm })}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        aria-invalid={!!errors.confirm}
                        aria-describedby={errors.confirm ? "confirm-error" : undefined}
                        className="pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
                {errors.confirm && (
                    <p id="confirm-error" role="alert" className="text-xs text-destructive mt-1">
                        {errors.confirm}
                    </p>
                )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Resetting..." : "Reset Password"}
            </Button>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <Card className="w-full max-w-md border-border bg-card">
            <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                    <Shield className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight text-card-foreground">
                    Reset Password
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                    Enter your new password below
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-muted" />}>
                    <ResetPasswordForm />
                </Suspense>
            </CardContent>
        </Card>
    );
}
