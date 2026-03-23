"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Layers } from "lucide-react";

export default function LeaguesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leagues"
        description="Manage your organization's leagues and seasons"
        icon={<Layers className="h-6 w-6" />}
      />

      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <Layers className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium">Leagues Coming Soon</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This page will be implemented in Phase 3 with full league management,
          integrated season tabs, and league admin creation.
        </p>
      </div>
    </div>
  );
}
