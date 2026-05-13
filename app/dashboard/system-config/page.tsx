"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { useAuth } from "@/lib/auth-context";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { PageHeader } from "@/components/dashboard/page-header";
import { FormDialog } from "@/components/dashboard/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useFormValidation } from "@/lib/use-form-validation";
import { validateRequired, validateLength, validatePositionCode } from "@/lib/validation";

const LT_URL = "/api/seasons/league-types";
const ET_URL = "/api/match-events/event-types";
const POS_URL = "/api/players/positions";

interface NamedItem { id: string; name: string; description?: string | null }
interface Position { id: string; code: string; name: string; description?: string | null }

type NamedItemForm = { name: string; description: string };

function validateNamedItemForm(values: NamedItemForm): Partial<Record<keyof NamedItemForm, string>> {
  return {
    name: validateRequired(values.name, "Name") ?? validateLength(values.name, 1, 100, "Name") ?? undefined,
    description: validateLength(values.description, 0, 255, "Description") ?? undefined,
  };
}

function NamedItemTab({ url, label }: { url: string; label: string }) {
  const { data, isLoading, error } = useSWR<NamedItem[]>(url, authFetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NamedItem | null>(null);
  const [form, setForm] = useState<NamedItemForm>({ name: "", description: "" });
  const { errors, handleBlur, validateAll, resetValidation } = useFormValidation(validateNamedItemForm, { name: "", description: "" });

  const openCreate = () => { setEditing(null); setForm({ name: "", description: "" }); resetValidation(); setOpen(true); };
  const openEdit = (item: NamedItem) => { setEditing(item); setForm({ name: item.name, description: item.description ?? "" }); resetValidation(); setOpen(true); };

  const handleSubmit = async () => {
    if (!validateAll(form)) return;
    const body = JSON.stringify({ name: form.name, description: form.description || undefined });
    const res = editing
      ? await fetchWithAuth(`${url}/${editing.id}`, { method: "PATCH", body })
      : await fetchWithAuth(url, { method: "POST", body });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      const msg = (d as { error?: string }).error || "Request failed";
      toast.error(msg); throw new Error(msg);
    }
    toast.success(editing ? `${label} updated.` : `${label} created.`);
    mutate(url);
  };

  const handleDelete = async (item: NamedItem) => {
    const res = await fetchWithAuth(`${url}/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error((d as { error?: string }).error || "Request failed"); return;
    }
    toast.success(`${label} deleted.`); mutate(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add {label}</Button>
      </div>
      {error ? (
        <p className="py-8 text-center text-sm text-destructive">Failed to load {label.toLowerCase()}s.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell />
                </TableRow>
              )) : !data?.length ? (
                <TableRow><TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">No {label.toLowerCase()}s found.</TableCell></TableRow>
              ) : data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{item.description ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /><span className="sr-only">Edit</span></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(item)}><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <FormDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetValidation(); }} title={editing ? `Edit ${label}` : `Add ${label}`} submitLabel={editing ? "Update" : "Create"} onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ni-name">Name *</Label>
            <Input
              id="ni-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={() => handleBlur("name", form)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "ni-name-error" : undefined}
              placeholder={`e.g. ${label}`}
            />
            {errors.name && (
              <p id="ni-name-error" role="alert" className="text-xs text-destructive mt-1">{errors.name}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ni-desc">Description</Label>
            <Input
              id="ni-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              onBlur={() => handleBlur("description", form)}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? "ni-desc-error" : undefined}
              placeholder="Optional description"
            />
            {errors.description && (
              <p id="ni-desc-error" role="alert" className="text-xs text-destructive mt-1">{errors.description}</p>
            )}
          </div>
        </div>
      </FormDialog>
    </div>
  );
}

type PositionForm = { code: string; name: string; description: string };

function validatePositionForm(values: PositionForm): Partial<Record<keyof PositionForm, string>> {
  return {
    code: validateRequired(values.code, "Code") ?? validatePositionCode(values.code) ?? undefined,
    name: validateRequired(values.name, "Name") ?? validateLength(values.name, 1, 50, "Name") ?? undefined,
    description: validateLength(values.description, 0, 255, "Description") ?? undefined,
  };
}

function PositionsTab() {
  const { data, isLoading, error } = useSWR<Position[]>(POS_URL, authFetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [form, setForm] = useState<PositionForm>({ code: "", name: "", description: "" });
  const { errors, handleBlur, validateAll, resetValidation } = useFormValidation(validatePositionForm, { code: "", name: "", description: "" });

  const openCreate = () => { setEditing(null); setForm({ code: "", name: "", description: "" }); resetValidation(); setOpen(true); };
  const openEdit = (item: Position) => { setEditing(item); setForm({ code: item.code, name: item.name, description: item.description ?? "" }); resetValidation(); setOpen(true); };

  const handleSubmit = async () => {
    if (!validateAll(form)) return;
    const body = JSON.stringify({ code: form.code, name: form.name, description: form.description || undefined });
    const res = editing
      ? await fetchWithAuth(`${POS_URL}/${editing.id}`, { method: "PATCH", body })
      : await fetchWithAuth(POS_URL, { method: "POST", body });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      const msg = (d as { error?: string }).error || "Request failed";
      toast.error(msg); throw new Error(msg);
    }
    toast.success(editing ? "Position updated." : "Position created."); mutate(POS_URL);
  };

  const handleDelete = async (item: Position) => {
    const res = await fetchWithAuth(`${POS_URL}/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error((d as { error?: string }).error || "Request failed"); return;
    }
    toast.success("Position deleted."); mutate(POS_URL);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add Position</Button>
      </div>
      {error ? (
        <p className="py-8 text-center text-sm text-destructive">Failed to load positions.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell />
                </TableRow>
              )) : !data?.length ? (
                <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">No positions found.</TableCell></TableRow>
              ) : data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell><span className="rounded bg-muted px-2 py-0.5 text-xs font-mono">{item.code}</span></TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{item.description ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /><span className="sr-only">Edit</span></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(item)}><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <FormDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetValidation(); }} title={editing ? "Edit Position" : "Add Position"} submitLabel={editing ? "Update" : "Create"} onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pos-code">Code *</Label>
            <Input
              id="pos-code"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              onBlur={() => handleBlur("code", form)}
              aria-invalid={!!errors.code}
              aria-describedby={errors.code ? "pos-code-error" : undefined}
              placeholder="e.g. GK"
            />
            {errors.code && (
              <p id="pos-code-error" role="alert" className="text-xs text-destructive mt-1">{errors.code}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pos-name">Name *</Label>
            <Input
              id="pos-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={() => handleBlur("name", form)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "pos-name-error" : undefined}
              placeholder="e.g. Goalkeeper"
            />
            {errors.name && (
              <p id="pos-name-error" role="alert" className="text-xs text-destructive mt-1">{errors.name}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pos-desc">Description</Label>
            <Input
              id="pos-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              onBlur={() => handleBlur("description", form)}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? "pos-desc-error" : undefined}
              placeholder="Optional description"
            />
            {errors.description && (
              <p id="pos-desc-error" role="alert" className="text-xs text-destructive mt-1">{errors.description}</p>
            )}
          </div>
        </div>
      </FormDialog>
    </div>
  );
}

export default function SystemConfigPage() {
  const router = useRouter();
  const { isSuperAdmin, isLoading: authLoading } = useAuth();

  if (!authLoading && !isSuperAdmin()) {
    router.replace("/dashboard");
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="System Configuration" description="Manage league types, event types, and player positions." />
      <Tabs defaultValue="league-types">
        <TabsList>
          <TabsTrigger value="league-types">League Types</TabsTrigger>
          <TabsTrigger value="event-types">Event Types</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
        </TabsList>
        <TabsContent value="league-types" className="mt-4">
          <NamedItemTab url={LT_URL} label="League Type" />
        </TabsContent>
        <TabsContent value="event-types" className="mt-4">
          <NamedItemTab url={ET_URL} label="Event Type" />
        </TabsContent>
        <TabsContent value="positions" className="mt-4">
          <PositionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
