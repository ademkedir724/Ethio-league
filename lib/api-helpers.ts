import { NextResponse } from "next/server";

export function success(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function created(data: unknown) {
  return NextResponse.json(data, { status: 201 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(error: unknown) {
  console.error(error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

export function parseId(params: { id: string }): number | null {
  const id = Number(params.id);
  return Number.isNaN(id) ? null : id;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function parseUUID(params: { id?: string } | string): string | null {
  const raw = typeof params === "string" ? params : params.id;
  if (!raw) return null;
  return UUID_RE.test(raw) ? raw : null;
}

export function unprocessableEntity(body: unknown) {
  return NextResponse.json(body, { status: 422 });
}

// ─── Pagination helpers ───────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Parses ?page= and ?limit= from a URL's searchParams.
 * Clamps limit between min and max (default 10–25).
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaultLimit = 20,
  minLimit = 10,
  maxLimit = 25
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    maxLimit,
    Math.max(minLimit, parseInt(searchParams.get("limit") ?? String(defaultLimit), 10))
  );
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Wraps paginated data in a standard envelope.
 */
export function paginated(
  data: unknown[],
  total: number,
  page: number,
  limit: number
) {
  return success({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
