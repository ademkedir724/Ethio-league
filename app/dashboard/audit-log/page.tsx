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
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface AuditLogEntry {
    id: string;
    actionType: string;
    timestamp: string;
    details: Record<string, unknown> | string | null;
    user: {
        fullName: string;
        email: string;
    } | null;
}

interface AuditLogsResponse {
    total: number;
    page: number;
    limit: number;
    logs: AuditLogEntry[];
}

export default function AuditLogPage() {
    const router = useRouter();
    const { isSuperAdmin, isLoading: authLoading } = useAuth();

    const [actionType, setActionType] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    // Redirect non-super-admins
    if (!authLoading && !isSuperAdmin()) {
        router.replace("/dashboard");
        return null;
    }

    const url = useMemo(() => {
        const params = new URLSearchParams();
        if (actionType) params.set("actionType", actionType);
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);
        const qs = params.toString();
        return `/api/audit-logs${qs ? `?${qs}` : ""}`;
    }, [actionType, fromDate, toDate]);

    const { data, isLoading, error } = useSWR<AuditLogsResponse>(url, authFetcher);

    const clearFilters = () => {
        setActionType("");
        setFromDate("");
        setToDate("");
    };

    const hasFilters = actionType || fromDate || toDate;

    const formatTimestamp = (ts: string) =>
        new Date(ts).toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    const formatDetails = (details: AuditLogEntry["details"]) => {
        if (!details) return "—";
        if (typeof details === "string") return details;
        return JSON.stringify(details);
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Audit Log"
                description="View a record of all administrative actions in the system."
            />

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="action-type">Action Type</Label>
                            <Input
                                id="action-type"
                                value={actionType}
                                onChange={(e) => setActionType(e.target.value)}
                                placeholder="e.g. USER_CREATED"
                                className="w-48"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="from-date">From Date</Label>
                            <Input
                                id="from-date"
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="w-44"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="to-date">To Date</Label>
                            <Input
                                id="to-date"
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="w-44"
                            />
                        </div>
                        {hasFilters && (
                            <Button variant="outline" onClick={clearFilters}>
                                Clear Filters
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {error ? (
                        <div className="flex items-center justify-center py-12 text-sm text-destructive">
                            Failed to load audit logs. Please try again.
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Timestamp</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Action Type</TableHead>
                                        <TableHead className="hidden md:table-cell">Details</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading || authLoading ? (
                                        Array.from({ length: 8 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                                <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-48" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : !data?.logs?.length ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                                                No audit log entries found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data.logs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                    {formatTimestamp(log.timestamp)}
                                                </TableCell>
                                                <TableCell>
                                                    {log.user ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium">{log.user.fullName}</span>
                                                            <span className="text-xs text-muted-foreground">{log.user.email}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">System</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                                                        {log.actionType}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell max-w-xs truncate text-sm text-muted-foreground">
                                                    {formatDetails(log.details)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>

                            {/* Pagination info */}
                            {data && data.total > 0 && (
                                <div className="border-t px-4 py-3 text-sm text-muted-foreground">
                                    Showing {data.logs.length} of {data.total} entries
                                    {data.total > data.limit && (
                                        <span> (page {data.page} of {Math.ceil(data.total / data.limit)})</span>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
