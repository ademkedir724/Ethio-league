"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { useAuth } from "@/lib/auth-context";
import { authFetcher } from "@/lib/fetch-client";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Settings2, Info, Star } from "lucide-react";
import { toast } from "sonner";

const CONFIG_URL = "/api/ratings/config";

interface RatingConfig {
    id: string;
    isActive: boolean;
    goalWeight: number;
    assistWeight: number;
    yellowCardPenalty: number;
    redCardPenalty: number;
    appearanceWeight: number;
    cleanSheetWeight: number;
    winRateWeight: number;
    goalDiffNormMax: number;
    pointsPerMatchNormMax: number;
    seasonDecayRate: number;
    seasonMinWeight: number;
    maxSeasonsNorm: number;
    leagueGoalsNormMax: number;
    updatedAt: string;
}

// ─── Formula Rules Reference ──────────────────────────────────────────────────

function FormulaRulesTab({ config, isLoading }: { config: RatingConfig | undefined; isLoading: boolean }) {
    const c = config;

    const FormulaCard = ({
        title,
        description,
        factors,
    }: {
        title: string;
        description: string;
        factors: { label: string; value: string; note?: string }[];
    }) => (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" />
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-2">
                    {factors.map((f) => (
                        <div key={f.label} className="flex items-start justify-between gap-4 py-1.5 border-b border-border last:border-0">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium">{f.label}</span>
                                {f.note && <span className="text-xs text-muted-foreground">{f.note}</span>}
                            </div>
                            <span className="text-sm font-mono text-primary shrink-0">{f.value}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );

    if (isLoading || !c) {
        return (
            <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-400">
                <Info className="h-4 w-4 shrink-0" />
                All ratings are on a 0–100 scale and are clamped — they can never exceed 100 or go below 0. Recent seasons are weighted more than older ones (decay applies to players, clubs, and coaches only).
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <FormulaCard
                    title="Player Rating"
                    description="Based on match events per season, weighted by recency."
                    factors={[
                        { label: "Goal scored", value: `+${c.goalWeight} pts`, note: "Capped at 30 pts total" },
                        { label: "Assist", value: `+${c.assistWeight} pts`, note: "Capped at 20 pts total" },
                        { label: "Appearance", value: `+${c.appearanceWeight} pts`, note: "Capped at 15 pts total" },
                        { label: "Clean sheet (GK)", value: `+${c.cleanSheetWeight} pts`, note: "Capped at 10 pts total" },
                        { label: "Yellow card", value: `−${c.yellowCardPenalty} pts` },
                        { label: "Red card", value: `−${c.redCardPenalty} pts` },
                    ]}
                />

                <FormulaCard
                    title="Club Rating"
                    description="Based on season standings, weighted by recency."
                    factors={[
                        { label: "Win rate", value: `× ${c.winRateWeight}`, note: "Up to 40 pts" },
                        { label: "Goal diff / match", value: `÷ ${c.goalDiffNormMax} × 20`, note: "Up to 20 pts" },
                        { label: "Points / match", value: `÷ ${c.pointsPerMatchNormMax} × 25`, note: "Up to 25 pts" },
                        { label: "Yellow card (discipline)", value: "−0.5 pts each", note: "Deduction capped at 15 pts" },
                        { label: "Red card (discipline)", value: "−2.0 pts each", note: "Deduction capped at 15 pts" },
                    ]}
                />

                <FormulaCard
                    title="League Rating"
                    description="Equal weight across all seasons — no recency decay."
                    factors={[
                        { label: "Season completion rate", value: "× 20", note: "Completed ÷ total seasons" },
                        { label: "Avg goals / match", value: `÷ ${c.leagueGoalsNormMax} × 20` },
                        { label: "Avg club rating", value: "× 0.4", note: "Up to 40 pts" },
                        { label: "Match activity rate", value: "× 20", note: "Approved ÷ scheduled matches" },
                    ]}
                />

                <FormulaCard
                    title="Coach Rating"
                    description="Based on managed club performance, weighted by recency."
                    factors={[
                        { label: "Club rating (managed)", value: "× 0.6", note: "Up to 60 pts" },
                        { label: "Win rate during tenure", value: "× 30", note: "Up to 30 pts" },
                        { label: "Discipline (inverse)", value: "up to 10 pts", note: "Lower cards = higher score" },
                    ]}
                />

                <FormulaCard
                    title="Referee Activity Score"
                    description="Measures activity and consistency — not match quality."
                    factors={[
                        { label: "Match assignment rate", value: "× 50", note: "Assigned ÷ total in seasons" },
                        { label: "Distinct seasons", value: `÷ ${c.maxSeasonsNorm} × 30` },
                        { label: "Consistency score", value: "× 20", note: "Low card variance = high score" },
                    ]}
                />
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Season Decay (Players, Clubs, Coaches)</CardTitle>
                    <CardDescription>Recent seasons contribute more to the rating than older ones.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between py-1.5 border-b border-border text-sm">
                            <span className="font-medium">Most recent season</span>
                            <span className="font-mono text-primary">weight = 1.0</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border text-sm">
                            <span className="font-medium">Each prior season</span>
                            <span className="font-mono text-primary">−{c.seasonDecayRate} per season back</span>
                        </div>
                        <div className="flex justify-between py-1.5 text-sm">
                            <span className="font-medium">Minimum weight floor</span>
                            <span className="font-mono text-primary">{c.seasonMinWeight}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Rating Tiers</CardTitle>
                    <CardDescription>How scores map to tier labels shown in the UI.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: "Elite", range: "80–100", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
                            { label: "High", range: "60–79", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
                            { label: "Medium", range: "40–59", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
                            { label: "Low", range: "20–39", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
                            { label: "Developing", range: "0–19", cls: "bg-muted text-muted-foreground border-border" },
                        ].map((t) => (
                            <div key={t.label} className="flex items-center gap-2">
                                <Badge variant="outline" className={`text-xs ${t.cls}`}>★ {t.label}</Badge>
                                <span className="text-xs text-muted-foreground">{t.range}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Config Editor Tab ────────────────────────────────────────────────────────

function ConfigTab({ config, isLoading, onSaved }: { config: RatingConfig | undefined; isLoading: boolean; onSaved: () => void }) {
    const [form, setForm] = useState<Partial<RatingConfig> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const current = form ?? config ?? null;

    const handleEdit = () => {
        if (config) setForm({ ...config });
    };

    const handleCancel = () => setForm(null);

    const handleSave = async () => {
        if (!form) return;
        setIsSaving(true);
        try {
            const res = await fetchWithAuth(CONFIG_URL, {
                method: "PUT",
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                const fields = (data as { fields?: Record<string, string> }).fields;
                if (fields) {
                    const firstError = Object.values(fields)[0];
                    toast.error(firstError);
                } else {
                    toast.error((data as { error?: string }).error || "Failed to save config");
                }
                return;
            }
            toast.success("Rating config saved. Full recompute started in background.");
            setForm(null);
            onSaved();
        } catch {
            toast.error("Something went wrong");
        } finally {
            setIsSaving(false);
        }
    };

    const field = (
        key: keyof RatingConfig,
        label: string,
        note?: string
    ) => (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={key} className="text-xs">{label}</Label>
            {note && <p className="text-[11px] text-muted-foreground -mt-0.5">{note}</p>}
            <Input
                id={key}
                type="number"
                step="0.01"
                value={current?.[key] as number ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                disabled={!form}
                className="h-8 text-sm"
            />
        </div>
    );

    if (isLoading || !config) return <Skeleton className="h-64 w-full rounded-xl" />;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-muted-foreground">
                        Last updated: {new Date(config.updatedAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Saving new values triggers a full recompute of all entity ratings.
                    </p>
                </div>
                {!form ? (
                    <Button size="sm" onClick={handleEdit}>
                        <Settings2 className="h-4 w-4" />
                        Edit Weights
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleCancel}>Cancel</Button>
                        <Button size="sm" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save & Recompute"}
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Player Weights</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                        {field("goalWeight", "Goal weight", "pts per goal")}
                        {field("assistWeight", "Assist weight", "pts per assist")}
                        {field("appearanceWeight", "Appearance weight", "pts per match")}
                        {field("cleanSheetWeight", "Clean sheet weight", "GK only")}
                        {field("yellowCardPenalty", "Yellow card penalty", "pts deducted")}
                        {field("redCardPenalty", "Red card penalty", "pts deducted")}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Club Weights</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                        {field("winRateWeight", "Win rate weight", "multiplier (max 40)")}
                        {field("goalDiffNormMax", "Goal diff norm max", "normalization ceiling")}
                        {field("pointsPerMatchNormMax", "Points/match norm max", "normalization ceiling")}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">League Weights</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                        {field("leagueGoalsNormMax", "Goals/match norm max", "normalization ceiling")}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Referee Weights</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                        {field("maxSeasonsNorm", "Max seasons norm", "normalization ceiling")}
                    </CardContent>
                </Card>

                <Card className="sm:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Season Decay (Players, Clubs, Coaches)</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                        {field("seasonDecayRate", "Decay rate", "reduction per prior season (0–1)")}
                        {field("seasonMinWeight", "Min weight floor", "minimum season weight (0–1)")}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ─── Recompute Tab ────────────────────────────────────────────────────────────

interface PhaseProgress {
    total: number;
    done: number;
    failed: number;
    complete?: boolean;
}

interface RecomputeProgress {
    players?: PhaseProgress;
    clubs?: PhaseProgress;
    coaches?: PhaseProgress;
    referees?: PhaseProgress;
    leagues?: PhaseProgress;
    currentPhase?: string;
    isDone?: boolean;
    isError?: boolean;
    errorMessage?: string;
    totalProcessed?: number;
    totalFailed?: number;
}

const PHASE_LABELS: Record<string, string> = {
    players: "Players",
    clubs: "Clubs",
    coaches: "Coaches",
    referees: "Referees",
    leagues: "Leagues",
};

const PHASE_ORDER = ["players", "clubs", "coaches", "referees", "leagues"];

function ProgressBar({ done, total, failed }: { done: number; total: number; failed: number }) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{done} / {total}</span>
                <span className="flex items-center gap-2">
                    {failed > 0 && <span className="text-destructive">{failed} failed</span>}
                    <span>{pct}%</span>
                </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function RecomputeTab() {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState<RecomputeProgress | null>(null);

    const handleRecompute = async () => {
        setIsRunning(true);
        setProgress({});

        try {
            const token = localStorage.getItem("accessToken");
            const res = await fetch("/api/ratings/recompute", {
                method: "GET",
                headers: {
                    "Accept": "text/event-stream",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
            });

            if (!res.ok || !res.body) {
                const data = await res.json().catch(() => ({}));
                toast.error((data as { error?: string }).error || "Failed to start recompute");
                setIsRunning(false);
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    try {
                        const event = JSON.parse(line.slice(6));

                        if (event.phase === "done") {
                            setProgress((prev) => ({
                                ...prev,
                                isDone: true,
                                totalProcessed: event.totalProcessed,
                                totalFailed: event.totalFailed,
                                currentPhase: undefined,
                                // Ensure all phases show complete
                                ...(event.summary && {
                                    players: { ...event.summary.players, complete: true },
                                    clubs: { ...event.summary.clubs, complete: true },
                                    coaches: { ...event.summary.coaches, complete: true },
                                    referees: { ...event.summary.referees, complete: true },
                                    leagues: { ...event.summary.leagues, complete: true },
                                }),
                            }));
                            toast.success(`Recompute complete — ${event.totalProcessed} entities updated${event.totalFailed > 0 ? `, ${event.totalFailed} failed` : ""}`);
                        } else if (event.phase === "error") {
                            setProgress((prev) => ({ ...prev, isError: true, errorMessage: event.message }));
                            toast.error("Recompute failed: " + event.message);
                        } else if (PHASE_ORDER.includes(event.phase)) {
                            setProgress((prev) => ({
                                ...prev,
                                currentPhase: event.complete ? undefined : event.phase,
                                [event.phase]: {
                                    total: event.total,
                                    done: event.done,
                                    failed: event.failed,
                                    complete: event.complete ?? false,
                                },
                            }));
                        }
                    } catch {
                        // malformed SSE line — skip
                    }
                }
            }
        } catch (err) {
            toast.error("Connection error during recompute");
            console.error(err);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">On-Demand Full Recompute</CardTitle>
                    <CardDescription>
                        Recalculates ratings for all players, clubs, coaches, referees, and leagues using the current formula weights and all available match data.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                        This processes every entity in the system. On large datasets it may take a few minutes. Progress is shown live below.
                    </div>
                    <div>
                        <Button onClick={handleRecompute} disabled={isRunning} className="gap-2">
                            <RefreshCw className={`h-4 w-4 ${isRunning ? "animate-spin" : ""}`} />
                            {isRunning ? "Running..." : "Run Full Recompute"}
                        </Button>
                    </div>

                    {/* Live progress */}
                    {progress && (
                        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
                            <p className="text-sm font-medium text-foreground">
                                {progress.isDone
                                    ? `✓ Complete — ${progress.totalProcessed} entities updated${(progress.totalFailed ?? 0) > 0 ? `, ${progress.totalFailed} failed` : ""}`
                                    : progress.isError
                                        ? "✗ Error during recompute"
                                        : progress.currentPhase
                                            ? `Processing ${PHASE_LABELS[progress.currentPhase]}...`
                                            : "Starting..."}
                            </p>

                            <div className="flex flex-col gap-3">
                                {PHASE_ORDER.map((phase) => {
                                    const p = progress[phase as keyof RecomputeProgress] as PhaseProgress | undefined;
                                    if (!p) return null;
                                    const isActive = progress.currentPhase === phase;
                                    const isDone = p.complete;
                                    return (
                                        <div key={phase} className={`flex flex-col gap-1.5 rounded-lg border p-3 transition-colors ${isDone
                                            ? "border-emerald-500/20 bg-emerald-500/5"
                                            : isActive
                                                ? "border-primary/30 bg-primary/5"
                                                : "border-border"
                                            }`}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium flex items-center gap-2">
                                                    {isDone ? (
                                                        <span className="text-emerald-400">✓</span>
                                                    ) : isActive ? (
                                                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                                                    ) : (
                                                        <span className="h-3.5 w-3.5 rounded-full border border-border inline-block" />
                                                    )}
                                                    {PHASE_LABELS[phase]}
                                                </span>
                                                {p.failed > 0 && (
                                                    <span className="text-xs text-destructive">{p.failed} failed</span>
                                                )}
                                            </div>
                                            <ProgressBar done={p.done} total={p.total} failed={p.failed} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">When ratings update automatically</CardTitle>
                    <CardDescription>These events trigger a background recompute without any manual action.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-2 text-sm">
                        {[
                            { trigger: "Match approved", updates: "Players in match, both clubs, league, coaches, referee" },
                            { trigger: "Match event created", updates: "Player in event, club in event" },
                            { trigger: "Match event deleted", updates: "Player in event, club in event" },
                            { trigger: "Season marked completed", updates: "All players, clubs, coaches in season + league" },
                            { trigger: "Rating config saved", updates: "All entities (full recompute)" },
                            { trigger: "First server startup (no ratings)", updates: "All entities (backfill)" },
                        ].map((row) => (
                            <div key={row.trigger} className="flex flex-col gap-0.5 py-2 border-b border-border last:border-0">
                                <span className="font-medium">{row.trigger}</span>
                                <span className="text-muted-foreground text-xs">{row.updates}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RatingsPage() {
    const router = useRouter();
    const { isSuperAdmin, isLoading: authLoading } = useAuth();

    const { data: config, isLoading: configLoading } = useSWR<RatingConfig>(
        CONFIG_URL,
        authFetcher
    );

    if (!authLoading && !isSuperAdmin()) {
        router.replace("/dashboard");
        return null;
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Rating System"
                description="View formula rules, adjust weights, and trigger recomputes."
            />

            <Tabs defaultValue="rules">
                <TabsList>
                    <TabsTrigger value="rules">Formula Rules</TabsTrigger>
                    <TabsTrigger value="config">Weights & Config</TabsTrigger>
                    <TabsTrigger value="recompute">Recompute</TabsTrigger>
                </TabsList>

                <TabsContent value="rules" className="mt-4">
                    <FormulaRulesTab config={config} isLoading={configLoading} />
                </TabsContent>

                <TabsContent value="config" className="mt-4">
                    <ConfigTab
                        config={config}
                        isLoading={configLoading}
                        onSaved={() => mutate(CONFIG_URL)}
                    />
                </TabsContent>

                <TabsContent value="recompute" className="mt-4">
                    <RecomputeTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
