"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFormValidation } from "@/lib/use-form-validation";
import {
  validateRequired,
  validateLength,
  validateEmail,
  validatePhone,
} from "@/lib/validation";

interface OrgRequestForm {
  organizationName: string;
  country: string;
  city: string;
  description: string;
  applicantFullName: string;
  email: string;
  phone: string;
  [key: string]: string;
}

const initialForm: OrgRequestForm = {
  organizationName: "",
  country: "",
  city: "",
  description: "",
  applicantFullName: "",
  email: "",
  phone: "",
};

export default function RequestOrganizationPage() {
  const [form, setForm] = useState<OrgRequestForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const { errors, handleBlur, validateAll, resetValidation } =
    useFormValidation(
      (values) => ({
        organizationName:
          validateRequired(values.organizationName, "Organization name") ??
          validateLength(values.organizationName, 2, 120, "Organization name") ??
          undefined,
        country:
          validateRequired(values.country, "Country") ??
          validateLength(values.country, 2, 80, "Country") ??
          undefined,
        city:
          validateRequired(values.city, "City") ??
          validateLength(values.city, 2, 80, "City") ??
          undefined,
        description:
          validateLength(values.description, 0, 500, "Description") ??
          undefined,
        applicantFullName:
          validateRequired(values.applicantFullName, "Full name") ??
          validateLength(values.applicantFullName, 2, 80, "Full name") ??
          undefined,
        email:
          validateRequired(values.email, "Email") ??
          validateEmail(values.email) ??
          undefined,
        phone: validatePhone(values.phone, true) ?? undefined,
      }),
      initialForm
    );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateAll(form)) return;

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/organizations/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      resetValidation();
      setIsSuccess(true);
      toast.success("Organization request submitted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit request"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="w-full max-w-lg border-border bg-card">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-card-foreground">
            Request Submitted
          </h2>
          <p className="mb-6 max-w-sm text-muted-foreground">
            Your organization request has been submitted successfully. Our team
            will review your application and you will receive an email once your
            organization is approved.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
            <Button asChild>
              <Link href="/login">Go to Login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg border-border bg-card">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-card-foreground">
          Request Organization
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Submit a request to register your organization on Ethio-League
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Organization Details */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="mb-4 text-sm font-medium text-foreground">
              Organization Details
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="organizationName">Organization Name *</Label>
                <Input
                  id="organizationName"
                  name="organizationName"
                  value={form.organizationName}
                  onChange={handleChange}
                  onBlur={() => handleBlur("organizationName", form)}
                  placeholder="Ethiopian Football Federation"
                  required
                  aria-invalid={!!errors.organizationName}
                  aria-describedby={errors.organizationName ? "organizationName-error" : undefined}
                  className="bg-input border-border"
                />
                {errors.organizationName && (
                  <p id="organizationName-error" role="alert" className="text-xs text-destructive mt-1">
                    {errors.organizationName}
                  </p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    onBlur={() => handleBlur("country", form)}
                    placeholder="Ethiopia"
                    required
                    aria-invalid={!!errors.country}
                    aria-describedby={errors.country ? "country-error" : undefined}
                    className="bg-input border-border"
                  />
                  {errors.country && (
                    <p id="country-error" role="alert" className="text-xs text-destructive mt-1">
                      {errors.country}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    onBlur={() => handleBlur("city", form)}
                    placeholder="Addis Ababa"
                    required
                    aria-invalid={!!errors.city}
                    aria-describedby={errors.city ? "city-error" : undefined}
                    className="bg-input border-border"
                  />
                  {errors.city && (
                    <p id="city-error" role="alert" className="text-xs text-destructive mt-1">
                      {errors.city}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">
                  Description <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  onBlur={() => handleBlur("description", form)}
                  placeholder="Brief description of your organization..."
                  rows={3}
                  maxLength={500}
                  aria-invalid={!!errors.description}
                  aria-describedby={errors.description ? "description-error" : undefined}
                  className="bg-input border-border resize-none"
                />
                {errors.description && (
                  <p id="description-error" role="alert" className="text-xs text-destructive mt-1">
                    {errors.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Applicant Details */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="mb-4 text-sm font-medium text-foreground">
              Applicant Details
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="applicantFullName">Full Name *</Label>
                <Input
                  id="applicantFullName"
                  name="applicantFullName"
                  value={form.applicantFullName}
                  onChange={handleChange}
                  onBlur={() => handleBlur("applicantFullName", form)}
                  placeholder="Abebe Kebede"
                  required
                  aria-invalid={!!errors.applicantFullName}
                  aria-describedby={errors.applicantFullName ? "applicantFullName-error" : undefined}
                  className="bg-input border-border"
                />
                {errors.applicantFullName && (
                  <p id="applicantFullName-error" role="alert" className="text-xs text-destructive mt-1">
                    {errors.applicantFullName}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  onBlur={() => handleBlur("email", form)}
                  placeholder="abebe@organization.com"
                  required
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className="bg-input border-border"
                />
                {errors.email && (
                  <p id="email-error" role="alert" className="text-xs text-destructive mt-1">
                    {errors.email}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  onBlur={() => handleBlur("phone", form)}
                  placeholder="+251 911 234 567"
                  required
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                  className="bg-input border-border"
                />
                {errors.phone && (
                  <p id="phone-error" role="alert" className="text-xs text-destructive mt-1">
                    {errors.phone}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
