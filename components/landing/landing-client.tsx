"use client";

import Link from "next/link";
import {
    Shield,
    Trophy,
    Users,
    BarChart3,
    Calendar,
    Star,
    ArrowRight,
    CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
    {
        icon: Users,
        title: "Club & Player Management",
        description:
            "Register clubs, manage rosters, track player profiles, and handle squad requests all in one place.",
    },
    {
        icon: Trophy,
        title: "Seasons & Standings",
        description:
            "Create seasons, schedule matches, record results, and automatically compute league standings.",
    },
    {
        icon: Calendar,
        title: "Match Operations",
        description:
            "Assign referees, log match events, manage lineups, and approve results with a full audit trail.",
    },
    {
        icon: BarChart3,
        title: "Stats & Analytics",
        description:
            "Top scorers, discipline records, player ratings, and league-wide statistics at a glance.",
    },
    {
        icon: Star,
        title: "Player Ratings",
        description:
            "Rate players per match, track rating history, and surface performance trends over time.",
    },
    {
        icon: Shield,
        title: "Role-Based Access",
        description:
            "Granular permissions for admins, coaches, referees, and organization managers.",
    },
];

const highlights = [
    "Multi-league support",
    "Real-time standings calculation",
    "Media upload for clubs & coaches",
    "Full audit logging",
    "Referee assignment workflow",
    "Season activation readiness checks",
];

export function LandingClient() {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            {/* ── Nav ── */}
            <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">Ethio-League</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/request-organization">
                            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                                Request Access
                            </Button>
                        </Link>
                        <Link href="/login">
                            <Button size="sm">Sign In</Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1">
                {/* ── Hero ── */}
                <section className="relative overflow-hidden px-6 py-24 text-center sm:py-32">
                    {/* subtle radial glow */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    >
                        <div className="h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
                    </div>

                    <div className="relative mx-auto max-w-3xl">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                            <Trophy className="h-10 w-10 text-primary" />
                        </div>

                        <h1 className="mb-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                            Ethiopian Football League{" "}
                            <span className="text-primary">Management</span>
                        </h1>

                        <p className="mx-auto mb-10 max-w-xl text-lg text-muted-foreground">
                            The all-in-one admin platform for managing Ethiopian football
                            leagues — from club registration to final standings.
                        </p>

                        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                            <Link href="/login">
                                <Button size="lg" className="gap-2">
                                    Go to Dashboard <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                            <Link href="/request-organization">
                                <Button size="lg" variant="outline">
                                    Request Organization Access
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── Highlights strip ── */}
                <section className="border-y border-border bg-muted/40 px-6 py-6">
                    <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                        {highlights.map((item) => (
                            <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </section>

                {/* ── Features grid ── */}
                <section className="px-6 py-20">
                    <div className="mx-auto max-w-6xl">
                        <div className="mb-12 text-center">
                            <h2 className="mb-3 text-3xl font-bold tracking-tight">
                                Everything you need to run a league
                            </h2>
                            <p className="text-muted-foreground">
                                Built for federation admins, club managers, and referees.
                            </p>
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {features.map(({ icon: Icon, title, description }) => (
                                <div
                                    key={title}
                                    className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
                                >
                                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                        <Icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <h3 className="mb-2 font-semibold text-card-foreground">{title}</h3>
                                    <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── CTA banner ── */}
                <section className="px-6 pb-20">
                    <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
                        <h2 className="mb-3 text-2xl font-bold tracking-tight">
                            Ready to get started?
                        </h2>
                        <p className="mb-7 text-muted-foreground">
                            Sign in to your admin account or request access for your
                            organization.
                        </p>
                        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                            <Link href="/login">
                                <Button size="lg" className="gap-2">
                                    Sign In <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                            <Link href="/request-organization">
                                <Button size="lg" variant="outline">
                                    Request Access
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* ── Footer ── */}
            <footer className="border-t border-border px-6 py-5 text-center text-sm text-muted-foreground">
                © {new Date().getFullYear()} Ethio-League. All rights reserved.
            </footer>
        </div>
    );
}
