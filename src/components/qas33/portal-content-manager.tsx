"use client";

// QAS33 Public Website — Content Manager + Incident Reports (admin)
// ---------------------------------------------------------------------
// Generic, metadata-driven manager for the 7 portal content types
// (announcements, ticker, hotlines, alerts, news, preparedness, evacuation):
// the list table AND the create/edit form are auto-generated from the
// CONTENT_TYPES field definitions. The Incident Reports manager lists public
// submissions with status triage + admin notes.
// Content is live immediately (not part of the publish cycle).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Filter,
  LifeBuoy,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { portalApiAdmin } from "@/lib/qas33/portal-api";
import { CONTENT_TYPES, INCIDENT_TYPE_LABELS } from "@/lib/qas33/portal-types";
import type { ContentFieldDef, ContentTypeDef } from "@/lib/qas33/portal-types";
import { cn } from "@/lib/utils";
import { TemplateIcon } from "./portal-sections-builder";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function formatDateTimePH(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function toLocalInput(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const truncate = (v: unknown, n = 60) => {
  const s = v == null ? "" : String(v);
  return s.length > n ? `${s.slice(0, n - 1)}…` : s || "—";
};

/** Colored badge treatment for known enum values (priority, status, level…). */
function enumTone(value: string): string {
  switch (value) {
    case "CRITICAL":
    case "EMERGENCY":
    case "FULL":
      return "border-transparent bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300";
    case "HIGH":
    case "WARNING":
    case "DISPATCHED":
      return "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300";
    case "ADVISORY":
    case "LIMITED":
    case "DRAFT":
    case "REVIEWING":
      return "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300";
    case "PUBLISHED":
    case "OPEN":
    case "RESOLVED":
      return "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300";
    case "INFO":
    case "BEFORE":
      return "border-transparent bg-gov-blue-100 text-gov-blue dark:bg-gov-blue/20 dark:text-gov-blue-100";
    default:
      return "text-muted-foreground";
  }
}

function EnumBadge({ value }: { value: string }) {
  return (
    <Badge variant="secondary" className={cn("text-[10px] px-1.5", enumTone(value))}>
      {value === "PUBLISHED" ? "Published" : value === "DRAFT" ? "Draft" : value === "ARCHIVED" ? "Archived" : value}
    </Badge>
  );
}

function BoolBadge({ value, onLabel = "Yes", offLabel = "No" }: { value: boolean; onLabel?: string; offLabel?: string }) {
  return (
    <Badge variant="secondary" className={cn("text-[10px] px-1.5", value ? "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300" : "text-muted-foreground/60")}>
      {value ? onLabel : offLabel}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Generic content manager
// ---------------------------------------------------------------------------

type FormValue = string | number | boolean | null;
type FormState = Record<string, FormValue>;

const buildFormState = (def: ContentTypeDef, item: Record<string, unknown> | null): FormState => {
  const state: FormState = {};
  for (const f of def.fields) {
    if (item) {
      const v = item[f.name];
      if (f.type === "boolean") state[f.name] = v === true;
      else if (f.type === "datetime") state[f.name] = toLocalInput(v);
      else if (f.type === "number") state[f.name] = v == null ? "" : Number(v);
      else state[f.name] = v == null ? "" : String(v);
    } else if (f.default === "now") {
      state[f.name] = nowLocalInput();
    } else if (f.default !== undefined) {
      state[f.name] = f.default;
    } else if (f.type === "boolean") {
      state[f.name] = false;
    } else {
      state[f.name] = "";
    }
  }
  return state;
};

const validateForm = (def: ContentTypeDef, form: FormState): Record<string, string> => {
  const errors: Record<string, string> = {};
  for (const f of def.fields) {
    const v = form[f.name];
    const s = v == null ? "" : String(v).trim();
    if (f.required && (s === "")) {
      errors[f.name] = `${f.label} is required.`;
      continue;
    }
    if (f.type !== "number" && f.type !== "boolean" && f.max && s.length > f.max) {
      errors[f.name] = `Maximum ${f.max} characters (currently ${s.length}).`;
    }
    if (f.type === "number" && s !== "" && !Number.isFinite(Number(s))) {
      errors[f.name] = `${f.label} must be a number.`;
    }
  }
  return errors;
};

const serializeForm = (def: ContentTypeDef, form: FormState): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const f of def.fields) {
    const v = form[f.name];
    if (f.type === "boolean") out[f.name] = v === true;
    else if (f.type === "number") out[f.name] = v === "" || v == null ? null : Number(v);
    else if (f.type === "datetime") out[f.name] = v === "" || v == null ? null : String(v);
    else out[f.name] = v == null ? "" : String(v);
  }
  return out;
};

function ContentField({
  field,
  value,
  error,
  onChange,
}: {
  field: ContentFieldDef;
  value: FormValue;
  error?: string;
  onChange: (v: FormValue) => void;
}) {
  const id = `cf-${field.name}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {field.label}
          {field.required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {field.max && (field.type === "text" || field.type === "textarea" || field.type === "url") && (
          <span className="text-[10px] text-muted-foreground/70">
            {String(value ?? "").length}/{field.max}
          </span>
        )}
      </div>

      {field.type === "textarea" ? (
        <Textarea id={id} rows={4} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} aria-invalid={Boolean(error)} />
      ) : field.type === "select" ? (
        <Select value={String(value ?? "")} onValueChange={(v) => onChange(v)}>
          <SelectTrigger id={id} aria-invalid={Boolean(error)}>
            <SelectValue placeholder={`Choose ${field.label.toLowerCase()}…`} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "boolean" ? (
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <Switch id={id} checked={value === true} onCheckedChange={(v) => onChange(v)} aria-label={field.label} />
          <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
            {value === true ? "Yes" : "No"}
          </Label>
        </div>
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "number" : field.type === "datetime" ? "datetime-local" : field.type === "url" ? "url" : "text"}
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? (field.type === "url" ? "https://…" : undefined)}
          aria-invalid={Boolean(error)}
        />
      )}

      {error ? <p className="text-[11px] text-destructive">{error}</p> : field.help ? <p className="text-[11px] leading-snug text-muted-foreground">{field.help}</p> : null}
    </div>
  );
}

export default function PortalContentManager({ refreshKey }: { refreshKey: number }) {
  const { toast } = useToast();
  const [typeKey, setTypeKey] = useState<string>(CONTENT_TYPES[0].key);
  const def = useMemo(() => CONTENT_TYPES.find((t) => t.key === typeKey) ?? CONTENT_TYPES[0], [typeKey]);

  const [items, setItems] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const tokenRef = useRef(0);

  const load = (key: string) => {
    const token = ++tokenRef.current;
    setLoading(true);
    setError(null);
    portalApiAdmin
      .listContent(key)
      .then((res) => {
        if (token !== tokenRef.current) return;
        setItems(res.items);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (token !== tokenRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to load content");
        setLoading(false);
      });
  };

  useEffect(() => {
    load(def.key);
  }, [def.key, refreshKey]);

  const openCreate = () => {
    setForm(buildFormState(def, null));
    setFormErrors({});
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (item: Record<string, unknown>) => {
    setForm(buildFormState(def, item));
    setFormErrors({});
    setEditingId(String(item.id ?? ""));
    setFormOpen(true);
  };

  const submit = async () => {
    const errors = validateForm(def, form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast({ title: "Please fix the highlighted fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = serializeForm(def, form);
      if (editingId) {
        await portalApiAdmin.updateContent(def.key, editingId, payload);
        toast({ title: `${def.label} updated`, description: "Changes are live immediately." });
      } else {
        await portalApiAdmin.createContent(def.key, payload);
        toast({ title: `${def.label} created`, description: "It is live on the public site immediately." });
      }
      setFormOpen(false);
      load(def.key);
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await portalApiAdmin.deleteContent(def.key, String(deleteTarget.id ?? ""));
      toast({ title: `${def.label} deleted` });
      load(def.key);
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const cellFor = (fieldName: string, item: Record<string, unknown>) => {
    const field = def.fields.find((f) => f.name === fieldName);
    const value = item[fieldName];
    if (field?.type === "boolean") return <BoolBadge value={value === true} onLabel={field.label} offLabel={`No ${field.label.toLowerCase()}`} />;
    if (field?.type === "datetime") return <span className="whitespace-nowrap text-xs">{formatDateTimePH(value == null ? null : String(value))}</span>;
    if (field?.type === "select") return <EnumBadge value={String(value ?? "")} />;
    if (field?.type === "number") return <span className="tabular-nums">{value == null ? "—" : String(value)}</span>;
    return <span title={value == null ? "" : String(value)}>{truncate(value, 64)}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <Select value={typeKey} onValueChange={setTypeKey}>
            <SelectTrigger className="w-full sm:w-64" aria-label="Content type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPES.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  <span className="flex items-center gap-1.5">
                    <TemplateIcon name={t.icon} className="size-3.5" /> {t.pluralLabel}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => load(def.key)} aria-label="Refresh list">
            <RefreshCw className="size-4" />
          </Button>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> New {def.label}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {def.description} <span className="text-muted-foreground/70">— content is published live immediately (no draft cycle).</span>
      </p>

      {def.key === "hotlines" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">Verify all hotline numbers before relying on them</span> — pre-filled values are examples. Wrong numbers cost lives in an
            emergency.
          </p>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <Button variant="outline" size="sm" className="ml-2 h-7" onClick={() => load(def.key)}>
            Retry
          </Button>
        </div>
      ) : loading || !items ? (
        <div className="space-y-2 rounded-xl border p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <TemplateIcon name={def.icon} className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">No {def.pluralLabel.toLowerCase()} yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create the first one with the “New {def.label}” button.</p>
        </div>
      ) : (
        <div className="max-h-[58vh] overflow-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {def.listFields.map((f) => (
                  <TableHead key={f} className="text-xs">
                    {def.fields.find((x) => x.name === f)?.label ?? f}
                  </TableHead>
                ))}
                <TableHead className="w-20 text-right text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={String(item.id)}>
                  {def.listFields.map((f) => (
                    <TableCell key={f} className="max-w-64 truncate py-2 text-sm">
                      {cellFor(f, item)}
                    </TableCell>
                  ))}
                  <TableCell className="py-2 text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(item)} aria-label={`Edit ${def.label}`}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(item)}
                        aria-label={`Delete ${def.label}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / edit dialog ---------------------------------------------------- */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? `Edit ${def.label.toLowerCase()}` : `New ${def.label.toLowerCase()}`}
            </DialogTitle>
            <DialogDescription>
              {def.pluralLabel} · fields with <span className="text-destructive">*</span> are required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {def.fields.map((f) => (
              <div key={f.name} className={cn(f.type === "textarea" && "sm:col-span-2")}>
                <ContentField
                  field={f}
                  value={form[f.name] ?? ""}
                  error={formErrors[f.name]}
                  onChange={(v) => {
                    setForm((prev) => ({ ...prev, [f.name]: v }));
                    setFormErrors((prev) => {
                      if (!prev[f.name]) return prev;
                      const next = { ...prev };
                      delete next[f.name];
                      return next;
                    });
                  }}
                />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {editingId ? "Save changes" : `Create ${def.label.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm ------------------------------------------------------------- */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {def.label.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              “{truncate(deleteTarget?.[def.listFields[0] ?? "title"] ?? def.label, 80)}” will be removed from the public site immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={doDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incident Reports manager
// ---------------------------------------------------------------------------

interface IncidentItem {
  id: string;
  referenceNo: string;
  type: string;
  urgency: string;
  name: string | null;
  contact: string | null;
  location: string;
  barangay: string | null;
  description: string | null;
  latitude: string | null;
  longitude: string | null;
  attachmentUrl: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
}

const INCIDENT_STATUSES = ["RECEIVED", "REVIEWING", "DISPATCHED", "RESOLVED", "DISMISSED"];

const URGENCY_TONE: Record<string, string> = {
  LOW: "text-muted-foreground",
  MODERATE: "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
  HIGH: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300",
  CRITICAL: "border-transparent bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300",
};

const STATUS_TONE: Record<string, string> = {
  RECEIVED: "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
  REVIEWING: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
  DISPATCHED: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300",
  RESOLVED: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
  DISMISSED: "text-muted-foreground",
};

export function IncidentReportsManager() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [items, setItems] = useState<IncidentItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<IncidentItem | null>(null);
  const [notes, setNotes] = useState("");
  const [nextStatus, setNextStatus] = useState("RECEIVED");
  const [updating, setUpdating] = useState(false);
  const tokenRef = useRef(0);

  const load = (status: string) => {
    const token = ++tokenRef.current;
    setLoading(true);
    setError(null);
    portalApiAdmin
      .listIncidents(status === "ALL" ? undefined : status)
      .then((res) => {
        if (token !== tokenRef.current) return;
        setItems(res.items as IncidentItem[]);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (token !== tokenRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to load incident reports");
        setLoading(false);
      });
  };

  useEffect(() => {
    load(statusFilter);
  }, [statusFilter]);

  const openDetail = (item: IncidentItem) => {
    setDetail(item);
    setNotes(item.adminNotes ?? "");
    setNextStatus(item.status);
  };

  const updateIncidentFn = async () => {
    if (!detail) return;
    setUpdating(true);
    try {
      await portalApiAdmin.updateIncident(detail.id, { status: nextStatus, adminNotes: notes });
      toast({ title: "Incident updated", description: `${detail.referenceNo} → ${nextStatus}` });
      setDetail(null);
      load(statusFilter);
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="size-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56" aria-label="Filter incidents by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {INCIDENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="size-9" onClick={() => load(statusFilter)} aria-label="Refresh incidents">
          <RefreshCw className="size-4" />
        </Button>
        <p className="ml-auto text-xs text-muted-foreground">
          {items ? `${items.length} report${items.length === 1 ? "" : "s"}` : "…"} · submitted through the public Report an Incident form
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <Button variant="outline" size="sm" className="ml-2 h-7" onClick={() => load(statusFilter)}>
            Retry
          </Button>
        </div>
      ) : loading || !items ? (
        <div className="space-y-2 rounded-xl border p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <LifeBuoy className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">No incident reports yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Reports submitted on the public site will appear here for triage.</p>
        </div>
      ) : (
        <div className="max-h-[62vh] overflow-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-xs">Reference</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Urgency</TableHead>
                <TableHead className="text-xs">Location</TableHead>
                <TableHead className="text-xs">Barangay</TableHead>
                <TableHead className="text-xs">Reported</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => openDetail(item)}>
                  <TableCell className="py-2 font-mono text-xs">{item.referenceNo}</TableCell>
                  <TableCell className="py-2 text-sm">{INCIDENT_TYPE_LABELS[item.type] ?? item.type}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant="secondary" className={cn("text-[10px] px-1.5", URGENCY_TONE[item.urgency] ?? "text-muted-foreground")}>
                      {item.urgency}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-44 truncate py-2 text-sm" title={item.location}>
                    {item.location}
                  </TableCell>
                  <TableCell className="py-2 text-sm">{item.barangay ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap py-2 text-xs">{formatDateTimePH(item.createdAt)}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant="secondary" className={cn("text-[10px] px-1.5", STATUS_TONE[item.status] ?? "text-muted-foreground")}>
                      {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail dialog --------------------------------------------------------- */}
      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-base">{detail.referenceNo}</span>
                  <Badge variant="secondary" className={cn("text-[10px]", URGENCY_TONE[detail.urgency] ?? "")}>{detail.urgency}</Badge>
                  <Badge variant="secondary" className={cn("text-[10px]", STATUS_TONE[detail.status] ?? "")}>
                    {detail.status.charAt(0) + detail.status.slice(1).toLowerCase()}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {INCIDENT_TYPE_LABELS[detail.type] ?? detail.type} · reported {formatDateTimePH(detail.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Location</p>
                  <p className="text-sm">{detail.location}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Barangay</p>
                  <p className="text-sm">{detail.barangay ?? "Not specified"}</p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Provided by reporter</p>
                  <p className="text-sm">
                    {detail.name || <span className="text-muted-foreground">Anonymous</span>}
                    {detail.contact && <span className="text-muted-foreground"> · {detail.contact}</span>}
                  </p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Description</p>
                  <p className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">{detail.description || "—"}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Coordinates</p>
                  <p className="font-mono text-sm">
                    {detail.latitude && detail.longitude ? `${Number(detail.latitude).toFixed(5)}, ${Number(detail.longitude).toFixed(5)}` : "Not provided"}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Photo evidence</p>
                  <p className="flex items-center gap-1.5 text-sm">
                    {detail.attachmentUrl ? (
                      <>
                        <Check className="size-4 text-emerald-600" /> Photo evidence attached (stored securely)
                      </>
                    ) : (
                      <>
                        <MapPin className="size-4 text-muted-foreground/50" /> No photo
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inc-status" className="text-xs font-medium text-muted-foreground">
                    Status
                  </Label>
                  <Select value={nextStatus} onValueChange={setNextStatus}>
                    <SelectTrigger id="inc-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCIDENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0) + s.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inc-notes" className="text-xs font-medium text-muted-foreground">
                    Admin notes (internal)
                  </Label>
                  <Textarea id="inc-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Response actions, follow-ups, dispatch details…" />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDetail(null)} disabled={updating}>
                  Close
                </Button>
                <Button onClick={updateIncidentFn} disabled={updating}>
                  {updating ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Update Incident
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
