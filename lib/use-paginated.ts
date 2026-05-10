"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { authFetcher } from "@/lib/fetch-client";

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface UsePaginatedOptions {
    defaultLimit?: number;
    extraParams?: Record<string, string | number | undefined | null>;
}

/**
 * Drop-in replacement for useSWR on paginated list endpoints.
 *
 * Usage:
 *   const { items, pagination, setPage, setLimit, isLoading } =
 *     usePaginated<Club>("/api/clubs", { defaultLimit: 20 });
 */
export function usePaginated<T>(
    baseUrl: string | null,
    options: UsePaginatedOptions = {}
) {
    const { defaultLimit = 20, extraParams = {} } = options;

    const [page, setPageState] = useState(1);
    const [limit, setLimitState] = useState(defaultLimit);

    const setPage = useCallback((p: number) => setPageState(p), []);
    const setLimit = useCallback((l: number) => {
        setLimitState(l);
        setPageState(1);
    }, []);

    // Build URL with pagination + extra params
    const url = (() => {
        if (!baseUrl) return null;
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        for (const [k, v] of Object.entries(extraParams)) {
            if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
        }
        const qs = params.toString();
        return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${qs}`;
    })();

    const { data, isLoading, error, mutate } = useSWR<PaginatedResponse<T>>(
        url,
        authFetcher
    );

    return {
        items: data?.data ?? [],
        pagination: {
            page: data?.page ?? page,
            limit: data?.limit ?? limit,
            total: data?.total ?? 0,
            totalPages: data?.totalPages ?? 0,
        },
        setPage,
        setLimit,
        isLoading,
        error,
        mutate,
        url,
    };
}
