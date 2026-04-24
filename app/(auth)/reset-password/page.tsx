"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Shield, CheckCircle } from "lucide-react";
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

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [done, setDone] = useState(false);

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
        if (password !== confirm) { toast.error("Passwords do not match"); return; }
        if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }

        setIsLoading(true);
        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Reset failed");
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
                <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                />
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input
                    id="confirm"
                    type="password"
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                />
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
