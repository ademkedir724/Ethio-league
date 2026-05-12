"use client";

/**
 * PlayerBulkImportDialog
 *
 * Lets a Club Admin upload an Excel (.xlsx / .xls) or CSV file to create
 * multiple players at once.
 *
 * Flow:
 *  1. Dialog opens → shows required column format
 *  2. User uploads file → parsed client-side with `xlsx`
 *  3. Each row is validated; a preview table shows errors per row
 *  4. User clicks "Import Valid Rows" → rows are POSTed to /api/players
 *  5. Results (success / failed) are shown and onSuccess() is called
 */

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { fetchWithAuth } from "@/lib/fetch-client";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Upload,
    FileSpreadsheet,
    CheckCircle,
    XCircle,
    AlertCircle,
    Download,
} from "lucide-react";

// ─── Column spec ──────────────────────────────────────────────────────────────

export const COLUMN_SPEC = [
    { key: "firstName", label: "first_name", required: true, example: "Abebe", note: "Min 2 chars" },
    { key: "lastName", label: "last_name", required: true, example: "Bikila", note: "Min 2 chars" },
    { key: "dateOfBirth", label: "date_of_birth", required: false, example: "1995-06-15", note: "YYYY-MM-DD" },
    { key: "nationality", label: "nationality", required: false, example: "Ethiopian", note: "" },
    { key: "preferredFoot", label: "preferred_foot", required: false, example: "right", note: "right / left / both" },
    { key: "heightCm", label: "height_cm", required: false, example: "178", note: "100–250" },
    { key: "weightKg", label: "weight_kg", required: false, example: "72", note: "30–200" },
] as const;

type ColKey = typeof COLUMN_SPEC[number]["key"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawRow {
    rowIndex: number;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    nationality: string;
    preferredFoot: string;
    heightCm: string;
    weightKg: string;
}

interface ValidatedRow extends RawRow {
    errors: string[];
    isValid: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a header cell to a known column key */
function normaliseHeader(raw: string): ColKey | null {
    const s = raw.trim().toLowerCase().replace(/[\s\-]/g, "_");
    const map: Record<string, ColKey> = {
        first_name: "firstName",
        firstname: "firstName",
        last_name: "lastName",
        lastname: "lastName",
        date_of_birth: "dateOfBirth",
        dateofbirth: "dateOfBirth",
        dob: "dateOfBirth",
        nationality: "nationality",
        preferred_foot: "preferredFoot",
        preferredfoot: "preferredFoot",
        foot: "preferredFoot",
        height_cm: "heightCm",
        height: "heightCm",
        heightcm: "heightCm",
        weight_kg: "weightKg",
        weight: "weightKg",
        weightkg: "weightKg",
    };
    return map[s] ?? null;
}

/** Convert an Excel serial date or string to YYYY-MM-DD */
function parseDate(raw: unknown): string {
    if (!raw) return "";
    if (typeof raw === "number") {
        // Excel serial date
        const d = XLSX.SSF.parse_date_code(raw);
        if (!d) return "";
        const mm = String(d.m).padStart(2, "0");
        const dd = String(d.d).padStart(2, "0");
        return `${d.y}-${mm}-${dd}`;
    }
    const s = String(raw).trim();
    // Accept YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [a, b, y] = s.split("/");
        // Heuristic: if first part > 12 it must be DD/MM
        const isDD = parseInt(a) > 12;
        return isDD ? `${y}-${b}-${a}` : `${y}-${a}-${b}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return s;
}

function validateRow(row: RawRow): string[] {
    const errors: string[] = [];
    if (!row.firstName.trim()) errors.push("first_name is required");
    else if (row.firstName.trim().length < 2) errors.push("first_name must be ≥ 2 chars");
    if (!row.lastName.trim()) errors.push("last_name is required");
    else if (row.lastName.trim().length < 2) errors.push("last_name must be ≥ 2 chars");
    if (row.dateOfBirth) {
        const d = new Date(row.dateOfBirth);
        if (isNaN(d.getTime())) errors.push("date_of_birth must be a valid date (YYYY-MM-DD)");
        else if (d > new Date()) errors.push("date_of_birth cannot be in the future");
    }
    if (row.preferredFoot && !["right", "left", "both"].includes(row.preferredFoot.toLowerCase())) {
        errors.push("preferred_foot must be right, left, or both");
    }
    if (row.heightCm) {
        const h = Number(row.heightCm);
        if (isNaN(h) || h < 100 || h > 250) errors.push("height_cm must be 100–250");
    }
    if (row.weightKg) {
        const w = Number(row.weightKg);
        if (isNaN(w) || w < 30 || w > 200) errors.push("weight_kg must be 30–200");
    }
    return errors;
}

/** Parse an XLSX/XLS/CSV file into validated rows */
function parseFile(file: File): Promise<ValidatedRow[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: "array", cellDates: false });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

                if (raw.length < 2) {
                    resolve([]);
                    return;
                }

                // Map header row → column keys
                const headers = (raw[0] as string[]).map(normaliseHeader);

                const rows: ValidatedRow[] = [];
                for (let i = 1; i < raw.length; i++) {
                    const cells = raw[i] as unknown[];
                    // Skip completely empty rows
                    if (cells.every((c) => c === "" || c === null || c === undefined)) continue;

                    const get = (key: ColKey): string => {
                        const idx = headers.indexOf(key);
                        if (idx === -1) return "";
                        const val = cells[idx];
                        if (key === "dateOfBirth") return parseDate(val);
                        return String(val ?? "").trim();
                    };

                    const row: RawRow = {
                        rowIndex: i + 1, // 1-based for display (row 1 = header)
                        firstName: get("firstName"),
                        lastName: get("lastName"),
                        dateOfBirth: get("dateOfBirth"),
                        nationality: get("nationality"),
                        preferredFoot: get("preferredFoot").toLowerCase(),
                        heightCm: get("heightCm"),
                        weightKg: get("weightKg"),
                    };

                    const errors = validateRow(row);
                    rows.push({ ...row, errors, isValid: errors.length === 0 });
                }
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsArrayBuffer(file);
    });
}

/** Generate and download a sample Excel template */
function downloadTemplate() {
    const headers = COLUMN_SPEC.map((c) => c.label);
    const example = COLUMN_SPEC.map((c) => c.example);
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    // Column widths
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Players");
    XLSX.writeFile(wb, "players_import_template.xlsx");
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

type Step = "format" | "preview" | "result";

interface ImportResult {
    succeeded: number;
    failed: Array<{ rowIndex: number; name: string; error: string }>;
}

export function PlayerBulkImportDialog({ open, onOpenChange, onSuccess }: Props) {
    const [step, setStep] = useState<Step>("format");
    const [rows, setRows] = useState<ValidatedRow[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [fileName, setFileName] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reset = useCallback(() => {
        setStep("format");
        setRows([]);
        setResult(null);
        setFileName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    }, []);

    const handleClose = (open: boolean) => {
        if (!open) reset();
        onOpenChange(open);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setIsParsing(true);
        try {
            const parsed = await parseFile(file);
            if (parsed.length === 0) {
                toast.error("No data rows found. Make sure the file has a header row and at least one data row.");
                return;
            }
            setRows(parsed);
            setStep("preview");
        } catch {
            toast.error("Failed to parse file. Make sure it is a valid .xlsx, .xls, or .csv file.");
        } finally {
            setIsParsing(false);
        }
    };

    const validRows = rows.filter((r) => r.isValid);
    const invalidRows = rows.filter((r) => !r.isValid);

    const handleImport = async () => {
        if (validRows.length === 0) return;
        setIsImporting(true);
        const failed: ImportResult["failed"] = [];
        let succeeded = 0;

        for (const row of validRows) {
            try {
                const res = await fetchWithAuth("/api/players", {
                    method: "POST",
                    body: JSON.stringify({
                        firstName: row.firstName.trim(),
                        lastName: row.lastName.trim(),
                        dateOfBirth: row.dateOfBirth || null,
                        nationality: row.nationality || null,
                        preferredFoot: row.preferredFoot || null,
                        heightCm: row.heightCm ? Number(row.heightCm) : null,
                        weightKg: row.weightKg ? Number(row.weightKg) : null,
                    }),
                });
                if (res.ok) {
                    succeeded++;
                } else {
                    const d = await res.json().catch(() => ({}));
                    failed.push({
                        rowIndex: row.rowIndex,
                        name: `${row.firstName} ${row.lastName}`,
                        error: (d as { error?: string }).error ?? "Server error",
                    });
                }
            } catch {
                failed.push({
                    rowIndex: row.rowIndex,
                    name: `${row.firstName} ${row.lastName}`,
                    error: "Network error",
                });
            }
        }

        setResult({ succeeded, failed });
        setStep("result");
        setIsImporting(false);

        if (succeeded > 0) {
            toast.success(`${succeeded} player${succeeded !== 1 ? "s" : ""} imported successfully`);
            onSuccess();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        Bulk Import Players
                    </DialogTitle>
                    <DialogDescription>
                        Upload an Excel or CSV file to create multiple players at once.
                    </DialogDescription>
                </DialogHeader>

                {/* ── Step 1: Format guide ── */}
                {step === "format" && (
                    <div className="flex flex-col gap-5">
                        {/* Format table */}
                        <div className="flex flex-col gap-2">
                            <p className="text-sm font-medium">Required file format</p>
                            <p className="text-xs text-muted-foreground">
                                The first row must be a header row with the column names below (order doesn&apos;t matter, extra columns are ignored).
                            </p>
                            <div className="rounded-lg border border-border overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-muted/50 border-b border-border">
                                            <th className="px-3 py-2 text-left font-semibold text-foreground">Column name</th>
                                            <th className="px-3 py-2 text-left font-semibold text-foreground">Required</th>
                                            <th className="px-3 py-2 text-left font-semibold text-foreground">Example</th>
                                            <th className="px-3 py-2 text-left font-semibold text-foreground">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {COLUMN_SPEC.map((col, i) => (
                                            <tr key={col.key} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                                <td className="px-3 py-2 font-mono text-primary">{col.label}</td>
                                                <td className="px-3 py-2">
                                                    {col.required
                                                        ? <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">required</Badge>
                                                        : <Badge variant="outline" className="text-[10px] text-muted-foreground">optional</Badge>
                                                    }
                                                </td>
                                                <td className="px-3 py-2 text-muted-foreground">{col.example}</td>
                                                <td className="px-3 py-2 text-muted-foreground">{col.note}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Download template */}
                        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                            <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">Download template</p>
                                <p className="text-xs text-muted-foreground">Pre-formatted Excel file with the correct headers and an example row.</p>
                            </div>
                            <Button variant="outline" size="sm" type="button" onClick={downloadTemplate}>
                                Download
                            </Button>
                        </div>

                        {/* Upload area */}
                        <div
                            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 py-10 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="h-8 w-8 text-muted-foreground/60" />
                            <div className="text-center">
                                <p className="text-sm font-medium">Click to upload your file</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Supports .xlsx, .xls, .csv</p>
                            </div>
                            {isParsing && <p className="text-xs text-primary animate-pulse">Parsing file…</p>}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>
                )}

                {/* ── Step 2: Preview ── */}
                {step === "preview" && (
                    <div className="flex flex-col gap-4">
                        {/* Summary bar */}
                        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                            <span className="text-muted-foreground truncate max-w-[200px]">{fileName}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="flex items-center gap-1 text-emerald-400">
                                <CheckCircle className="h-3.5 w-3.5" />
                                {validRows.length} valid
                            </span>
                            {invalidRows.length > 0 && (
                                <span className="flex items-center gap-1 text-destructive">
                                    <XCircle className="h-3.5 w-3.5" />
                                    {invalidRows.length} with errors
                                </span>
                            )}
                        </div>

                        {invalidRows.length > 0 && (
                            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-400">
                                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                Rows with errors will be skipped. Fix them in your file and re-upload, or proceed to import only the valid rows.
                            </div>
                        )}

                        {/* Preview table */}
                        <div className="rounded-lg border border-border overflow-hidden">
                            <div className="overflow-x-auto max-h-72">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                                        <tr className="border-b border-border">
                                            <th className="px-2 py-2 text-left text-muted-foreground w-10">#</th>
                                            <th className="px-2 py-2 text-left">First Name</th>
                                            <th className="px-2 py-2 text-left">Last Name</th>
                                            <th className="px-2 py-2 text-left hidden sm:table-cell">DOB</th>
                                            <th className="px-2 py-2 text-left hidden md:table-cell">Nationality</th>
                                            <th className="px-2 py-2 text-left hidden md:table-cell">Foot</th>
                                            <th className="px-2 py-2 text-left w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr
                                                key={row.rowIndex}
                                                className={`border-b border-border last:border-0 ${row.isValid ? "" : "bg-destructive/5"}`}
                                            >
                                                <td className="px-2 py-1.5 text-muted-foreground">{row.rowIndex}</td>
                                                <td className="px-2 py-1.5 font-medium">{row.firstName || <span className="text-destructive">—</span>}</td>
                                                <td className="px-2 py-1.5 font-medium">{row.lastName || <span className="text-destructive">—</span>}</td>
                                                <td className="px-2 py-1.5 text-muted-foreground hidden sm:table-cell">{row.dateOfBirth || "—"}</td>
                                                <td className="px-2 py-1.5 text-muted-foreground hidden md:table-cell">{row.nationality || "—"}</td>
                                                <td className="px-2 py-1.5 text-muted-foreground hidden md:table-cell capitalize">{row.preferredFoot || "—"}</td>
                                                <td className="px-2 py-1.5">
                                                    {row.isValid
                                                        ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                                                        : (
                                                            <span title={row.errors.join("\n")}>
                                                                <XCircle className="h-3.5 w-3.5 text-destructive cursor-help" />
                                                            </span>
                                                        )
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Error details */}
                        {invalidRows.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                                <p className="text-xs font-semibold text-destructive">Row errors:</p>
                                {invalidRows.map((row) => (
                                    <div key={row.rowIndex} className="text-xs text-destructive/80">
                                        <span className="font-medium">Row {row.rowIndex}:</span>{" "}
                                        {row.errors.join(" · ")}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Step 3: Result ── */}
                {step === "result" && result && (
                    <div className="flex flex-col gap-4">
                        <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${result.succeeded > 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-destructive/30 bg-destructive/10"}`}>
                            {result.succeeded > 0
                                ? <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                                : <XCircle className="h-5 w-5 text-destructive shrink-0" />
                            }
                            <div>
                                <p className="text-sm font-medium">
                                    {result.succeeded > 0
                                        ? `${result.succeeded} player${result.succeeded !== 1 ? "s" : ""} imported successfully`
                                        : "No players were imported"}
                                </p>
                                {result.failed.length > 0 && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {result.failed.length} row{result.failed.length !== 1 ? "s" : ""} failed
                                    </p>
                                )}
                            </div>
                        </div>

                        {result.failed.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                                <p className="text-xs font-semibold text-destructive">Failed rows:</p>
                                {result.failed.map((f) => (
                                    <div key={f.rowIndex} className="text-xs text-destructive/80">
                                        <span className="font-medium">Row {f.rowIndex} ({f.name}):</span> {f.error}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Footer ── */}
                <DialogFooter className="flex-wrap gap-2">
                    {step === "format" && (
                        <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
                    )}

                    {step === "preview" && (
                        <>
                            <Button variant="outline" onClick={reset}>
                                Upload Different File
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={isImporting || validRows.length === 0}
                            >
                                {isImporting
                                    ? "Importing…"
                                    : `Import ${validRows.length} Valid Player${validRows.length !== 1 ? "s" : ""}`}
                            </Button>
                        </>
                    )}

                    {step === "result" && (
                        <>
                            <Button variant="outline" onClick={reset}>
                                Import Another File
                            </Button>
                            <Button onClick={() => handleClose(false)}>Done</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
