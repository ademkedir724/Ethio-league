"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Lock, CheckCircle, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
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

const initialValues = { password: "", confirmPassword: "" };

function SetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const { errors, handleBlur, validateAll, resetValidation } =
    useFormValidation(
      (values) => ({
        password: validatePassword(values.password) ?? undefined,
        confirmPassword:
          validatePasswordMatch(values.password, values.confirmPassword) ??
          undefined,
      }),
      initialValues
    );

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError("No token provided. Please use the link from your email.");
        setIsValidating(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/validate-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Invalid or expired token");
          setIsValid(false);
        } else {
          setIsValid(true);
        }
      } catch {
        setError("Failed to validate token. Please try again.");
      } finally {
        setIsValidating(false);
      }
    }

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formValues = { password, confirmPassword };
    if (!validateAll(formValues)) return;

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to set password");
      }

      resetValidation();
      setIsSuccess(true);
      toast.success("Password set successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to set password"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isValidating) {
    return (
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="flex flex-col items-center py-12">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-muted-foreground">Validating your link...</p>
        </CardContent>
      </Card>
    );
  }

  // Invalid token state
  if (!isValid || error) {
    return (
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-card-foreground">
            Invalid Link
          </h2>
          <p className="mb-6 max-w-sm text-muted-foreground">
            {error || "This password setup link is invalid or has expired."}
          </p>
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-card-foreground">
            Password Set Successfully
          </h2>
          <p className="mb-6 max-w-sm text-muted-foreground">
            Your password has been set. You can now log in to your account.
          </p>
          <Button asChild>
            <Link href="/login">Continue to Login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Password setup form
  return (
    <Card className="w-full max-w-md border-border bg-card">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-card-foreground">
          Set Your Password
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Create a secure password for your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => handleBlur("password", { password, confirmPassword })}
                placeholder="Enter your password"
                required
                minLength={8}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
                className="bg-input border-border pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {showPassword ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
            {errors.password ? (
              <p id="password-error" role="alert" className="text-xs text-destructive mt-1">
                {errors.password}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters long
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => handleBlur("confirmPassword", { password, confirmPassword })}
                placeholder="Confirm your password"
                required
                minLength={8}
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
                className="bg-input border-border pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {showConfirmPassword ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
            {errors.confirmPassword && (
              <p id="confirmPassword-error" role="alert" className="text-xs text-destructive mt-1">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="mt-2 w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Setting Password..." : "Set Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full max-w-md border-border bg-card">
          <CardContent className="flex flex-col items-center py-12">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      }
    >
      <SetPasswordForm />
    </Suspense>
  );
}
