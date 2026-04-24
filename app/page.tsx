import Link from "next/link";
import {
  Trophy,
  BarChart3,
  Calendar,
  Users,
  Shield,
  Zap,
  ArrowRight,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Trophy,
    title: "League Management",
    description:
      "Create and manage multiple leagues with customizable rules, point systems, and division structures.",
  },
  {
    icon: Calendar,
    title: "Match Scheduling",
    description:
      "Schedule matches, track fixtures, and manage game days with an intuitive calendar interface.",
  },
  {
    icon: BarChart3,
    title: "Live Statistics",
    description:
      "Real-time match tracking with goals, cards, substitutions, and comprehensive player statistics.",
  },
  {
    icon: Users,
    title: "Player Registry",
    description:
      "Complete player management with profiles, transfer history, and performance analytics.",
  },
  {
    icon: Shield,
    title: "Club Administration",
    description:
      "Manage clubs, coaching staff, stadiums, and season registrations all in one place.",
  },
  {
    icon: Zap,
    title: "Instant Notifications",
    description:
      "Keep everyone informed with real-time updates on match results, schedule changes, and announcements.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Trophy className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">
              Ethio-League
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/request-organization">
                <Building2 className="mr-2 h-4 w-4" />
                Request Organization
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32 lg:py-40">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Ethiopian Premier League Management Platform
            </div>
            <h1 className="max-w-4xl text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Professional Football League Management System
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
              A comprehensive platform for managing Ethiopian football leagues,
              clubs, players, matches, and seasons. Built for federations,
              associations, and league administrators.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/request-organization">
                  Request Organization Access
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Sign In to Dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-border bg-card/50 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything You Need to Manage Your League
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              From match scheduling to player statistics, our platform provides
              all the tools you need to run a professional football league.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-8 sm:p-12 lg:p-16">
            <div className="flex flex-col items-center text-center">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Ready to Get Started?
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground">
                Request organization access today and start managing your
                football league with our professional platform. Our team will
                review your application within 24 hours.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
                <Button size="lg" asChild>
                  <Link href="/request-organization">
                    <Building2 className="mr-2 h-4 w-4" />
                    Request Organization
                  </Link>
                </Button>
                <Button size="lg" variant="ghost" asChild>
                  <Link href="/login">Already have access? Sign In</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Trophy className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Ethio-League
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Professional Football League Management Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
