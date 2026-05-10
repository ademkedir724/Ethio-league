"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface PaginationProps {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
    onPageChange: (page: number) => void;
    onLimitChange?: (limit: number) => void;
    limitOptions?: number[];
}

export function Pagination({
    page,
    totalPages,
    total,
    limit,
    onPageChange,
    onLimitChange,
    limitOptions = [10, 15, 20, 25],
}: PaginationProps) {
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    return (
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
            {/* Count info */}
            <p className="text-xs text-muted-foreground whitespace-nowrap">
                {total === 0 ? "No results" : `${from}–${to} of ${total}`}
            </p>

            <div className="flex items-center gap-3">
                {/* Per-page selector */}
                {onLimitChange && (
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Per page</span>
                        <Select
                            value={String(limit)}
                            onValueChange={(v) => { onLimitChange(Number(v)); onPageChange(1); }}
                        >
                            <SelectTrigger className="h-7 w-16 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {limitOptions.map((n) => (
                                    <SelectItem key={n} value={String(n)} className="text-xs">
                                        {n}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Page navigation */}
                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onPageChange(page - 1)}
                        disabled={page <= 1}
                        aria-label="Previous page"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>

                    <span className="text-xs text-muted-foreground px-1 min-w-[4rem] text-center">
                        {totalPages === 0 ? "—" : `${page} / ${totalPages}`}
                    </span>

                    <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= totalPages}
                        aria-label="Next page"
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
