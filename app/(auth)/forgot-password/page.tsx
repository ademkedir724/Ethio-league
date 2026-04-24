"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Shield, ArrowLeft, CheckCircle } from "lucide-react";
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

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Request failed");
            }
            setSent(true);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Card className="w-full max-w-md border-border bg-card">
            <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                    <Shield className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight text-card-foreground">
                    Forgot Password
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                    Enter your email and we&apos;ll send you a reset link
                </CardDescription>
            </CardHeader>
            <CardContent>
                {sent ? (
                    <div className="flex flex-col items-center gap-4 py-4 text-center">
                        <CheckCircle className="h-10 w-10 text-emerald-400" />
                        <p className="text-sm text-foreground font-medium">Check your email</p>
                        <p className="text-sm text-muted-foreground">
                            If <strong>{email}</strong> is registered, a password reset link has been sent. Check your inbox (and spam folder).
                        </p>
                        <Link href="/login" className="text-sm text-primary hover:underline">
                            Back to login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? "Sending..." : "Send Reset Link"}
                        </Button>
                        <div className="flex justify-center pt-1">
                            <Link href="/login" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                                <ArrowLeft className="h-3 w-3" />
                                Back to login
                            </Link>
                        </div>
                    </form>
                )}
            </CardContent>
        </Card>
    );
}
