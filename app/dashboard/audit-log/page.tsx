"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/lib/auth-context";
import { authFetcher } from "@/lib/fetch-client";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Eye } from "lucide-react";

interface AuditLogEntry {
    id: string;
    actionType: string;
    timestamp: string;
    details: string | null;
    user: { fullName: string; email: string } | null;
}

interface AuditLogsResponse {
    total: number;
    page: number;
    limit: number;
    logs: AuditLogEntry[];
}

// Human-readable action type labels
const actionLabels: Record<string, string> = {
    organization_approved: "Approved Organization",
    organization_rejected: "Rejected Organization",
    club_created: "Created Club",
    club_approved: "Approved Club",
    club_rejected: "Rejected Club",
    league_created: "Created League",
    season_created: "Created Season",
    season_updated: "Updated Season",
    season_deleted: "Deleted Season",
    match_approved: "Approved Match",
    match_event_created: "Logged Match Event",
    match_event_edited: "Edited Match Event",
    lineup_submitted: "Submitted Lineup",
    profile_updated: "Updated Profile",
    email_failure: "Email Delivery Failed",
    user_created: "Created User",
    user_updated: "Updated User",
    user_deleted: "Deleted User",
};

const actionColors: Record<string, string> = {
    organization_approved: "bg-green-500/15 text-green-400 border-green-500/20",
    organization_rejected: "bg-red-500/15 text-red-400 border-red-500/20",
    club_created: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    club_approved: "bg-green-500/15 text-green-400 border-green-500/20",
    club_rejected: "bg-red-500/15 text-red-400 border-red-500/20",
    match_approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    match_event_created: "bg-violet-500/15 text-violet-400 border-violet-500/20",
    lineup_submitted: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    email_failure: "bg-red-500/15 text-red-400 border-red-500/20",
};

function formatReadableDetail(log: AuditLogEntry): string {
    const actor = log.user?.fullName ?? "System";
    const label = actionLabels[log.actionType] ?? log.actionType.replace(/_/g, " ");
    const detail = log.details ?? "";
    return `${actor} — ${label}${detail ? `: ${detail}` : ""}`;
}

export default function AuditLogPage() {
    const router = useRouter();
    const { isSuperAdmin, isLoading: authLoading } = useAuth();

    const [actionType, setActionType] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
    const [page, setPage] = useState(1);

    if (!authLoading && !isSuperAdmin()) {
        router.replace("/dashboard");
        return null;
    }

    const url = useMemo(() => {
        const params = new URLSearchParams();
        if (actionType) params.set("actionType", actionType);
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);
        params.set("page", String(page));
        params.set("limit", "50");
        return `/api/audit-logs?${params.toString()}`;
    }, [actionType, fromDate, toDate, page]);

    const { data, isLoading, error } = useSWR<AuditLogsResponse>(url, authFetcher);

    const clearFilters = () => { setActionType(""); setFromDate(""); setToDate(""); setPage(1); };
    const hasFilters = actionType || fromDate || toDate;

    const formatTimestamp = (ts: string) =>
        new Date(ts).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

    const totalPages = data ? Math.ceil(data.total / (data.limit || 50)) : 1;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Audit Log" description="Complete record of all administrative actions in the system." />

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="action-type">Action Type</Label>
                            <Input id="action-type" value={actionType} onChange={(e) => { setActionType(e.target.value); setPage(1); }}
                                placeholder="e.g. club_created" className="w-48" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="from-date">From</Label>
                            <Input id="from-date" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="w-44" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="to-date">To</Label>
                            <Input id="to-date" type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="w-44" />
                        </div>
                        {hasFilters && <Button variant="outline" onClick={clearFilters}>Clear</Button>}
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {error ? (
                        <div className="py-12 text-center text-sm text-destructive">Failed to load audit logs.</div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-40">Timestamp</TableHead>
                                        <TableHead>Who</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead className="hidden md:table-cell">Description</TableHead>
                                        <TableHead className="w-10" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading || authLoading ? (
                                        Array.from({ length: 8 }).map((_, i) => (
                                            <TableRow key={i}>
                                                {Array.from({ length: 4 }).map((_, j) => (
                                                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : !data?.logs?.length ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                                                No audit log entries found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data.logs.map((log) => (
                                            <TableRow key={log.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedLog(log)}>
                                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {formatTimestamp(log.timestamp)}
                                                </TableCell>
                                                <TableCell>
                                                    {log.user ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium">{log.user.fullName}</span>
                                                            <span className="text-xs text-muted-foreground">{log.user.email}</span>
                                                        </div>
                                                    ) : <span className="text-sm text-muted-foreground">System</span>}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={`text-[10px] font-mono ${actionColors[log.actionType] ?? ""}`}>
                                                        {actionLabels[log.actionType] ?? log.actionType}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell max-w-xs truncate text-sm text-muted-foreground">
                                                    {log.details ?? "—"}
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            {data && data.total > 0 && (
                                <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
                                    <span>Showing {data.logs.length} of {data.total} entries</span>
                                    {totalPages > 1 && (
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                                            <span>Page {page} of {totalPages}</span>
                                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={!!selectedLog} onOpenChange={(v) => !v && setSelectedLog(null)}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedLog ? (actionLabels[selectedLog.actionType] ?? selectedLog.actionType) : ""}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="flex flex-col gap-4 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-muted-foreground">Performed by</span>
                                    <p className="font-medium">{selectedLog.user?.fullName ?? "System"}</p>
                                    <p className="text-xs text-muted-foreground">{selectedLog.user?.email ?? ""}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Timestamp</span>
                                    <p className="font-medium">{formatTimestamp(selectedLog.timestamp)}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-muted-foreground">Action</span>
                                    <p className="font-medium">{actionLabels[selectedLog.actionType] ?? selectedLog.actionType}</p>
                                </div>
                            </div>
                            {selectedLog.details && (
                                <div>
                                    <span className="text-muted-foreground block mb-1">Details</span>
                                    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm font-mono break-all overflow-y-auto max-h-96 whitespace-pre-wrap">
                                        {selectedLog.details}
                                    </div>
                                </div>
                            )}
                            <div className="rounded-md border border-border bg-muted/10 p-3 text-sm text-muted-foreground break-all">
                                {formatReadableDetail(selectedLog)}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
