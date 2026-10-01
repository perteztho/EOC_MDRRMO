"use client";

// QAS33 Admin Console — Evacuation Management module (panels).
// Sibling of evacuation-manager.tsx / -parts.tsx holding the three heavier data
// panels: mission-control OpsPanel (quick occupancy + status updates),
// AnnouncementsPanel (advisory composer + list) and ReportsPanel (recharts
// timeline, rollups, CSV export). The Leaflet map lives in -parts.tsx.

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  BarChart3,
  BedDouble,
  CalendarClock,
  Copy,
  Download,
  Eye,
  FileText,
  Gauge,
  History,
  Loader2,
  MapPin,
  Megaphone,
  Minus,
  Plus,
  RefreshCw,
  SquarePen,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  CartesianGrid,
  Legend as RLegend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/qas33/api";
import { capacityLevelFromPct, EVAC_CAPACITY_META, EVAC_STATUS_META } from "@/lib/qas33/emergency-types";
import type {
  EvacAnnouncementDTO,
  EvacAnnouncementPriority,
  EvacCenterDTO,
  EvacCenterStatus,
  OccupancyLogDTO,
} from "@/lib/qas33/emergency-types";
import { evacApi, evacNum, timeAgo } from "@/lib/qas33/evac-api";
import type { EvacPerCenterReport, EvacReportsResponse } from "@/lib/qas33/evac-api";
import { cn } from "@/lib/utils";
import { ErrorAlert, useLoad } from "./mdrrmo-shared";
import { EmptyState, ToneBadge, type BadgeTone } from "./ui-kit";
import { EVAC_STATUSES, EvacCapacityBar, EvacStatCard, EvacStatusBadge } from "./evacuation-manager-parts";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong — please try again.";
}

// ---------------------------------------------------------------------------
// Announcement display metadata
// ---------------------------------------------------------------------------

const ANN_STATUS_META: Record<string, { label: string; badge: string; tone: BadgeTone }> = {
  PUBLISHED: { label: "Published", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", tone: "normal" },
  SCHEDULED: { label: "Scheduled", badge: "bg-amber-50 text-amber-700 border-amber-200", tone: "pending" },
  DRAFT: { label: "Draft", badge: "bg-slate-100 text-slate-600 border-slate-300", tone: "neutral" },
  EXPIRED: { label: "Expired", badge: "bg-slate-100 text-slate-500 border-slate-200", tone: "offline" },
  CANCELLED: { label: "Cancelled", badge: "bg-rose-50 text-rose-700 border-rose-200", tone: "critical" },
};
// Priority escalation on ToneBadge tones: NORMAL neutral → HIGH pending →
// URGENT warning (orange) → CRITICAL critical (red). Labels always ride along.
const ANN_PRIORITY_META: Record<string, { label: string; badge: string; bar: string; tone: BadgeTone }> = {
  NORMAL: { label: "Normal", badge: "bg-slate-100 text-slate-700 border-slate-300", bar: "border-l-slate-300", tone: "neutral" },
  HIGH: { label: "High", badge: "bg-amber-50 text-amber-800 border-amber-300", bar: "border-l-amber-500", tone: "pending" },
  URGENT: { label: "Urgent", badge: "bg-orange-50 text-orange-800 border-orange-300", bar: "border-l-orange-500", tone: "warning" },
  CRITICAL: { label: "Critical", badge: "bg-red-50 text-red-700 border-red-300", bar: "border-l-red-600", tone: "critical" },
};

// ---------------------------------------------------------------------------
// OPS PANEL — mission-control quick updates
// ---------------------------------------------------------------------------

export function OpsPanel({
  centers,
  recentLogs,
  canManage,
  busy,
  sweepMode,
  onSweepModeChange,
  onQuickOccupancy,
  onRequestStatus,
  onOpenLog,
}: {
  centers: EvacCenterDTO[];
  recentLogs: OccupancyLogDTO[];
  canManage: boolean;
  busy: boolean;
  sweepMode: boolean;
  onSweepModeChange: (on: boolean) => void;
  onQuickOccupancy: (c: EvacCenterDTO, occupants: number) => void;
  onRequestStatus: (c: EvacCenterDTO, status: EvacCenterStatus) => void;
  onOpenLog: (c: EvacCenterDTO) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const active = centers.filter((c) => c.visible);

  const clearDraft = (id: string) =>
    setDrafts((d) => {
      if (!(id in d)) return d;
      const next = { ...d };
      delete next[id];
      return next;
    });

  const commit = (c: EvacCenterDTO) => {
    const raw = drafts[c.id];
    if (raw === undefined) return;
    const n = parseInt(raw, 10);
    clearDraft(c.id);
    if (Number.isNaN(n) || n < 0) return;
    if (n === c.currentOccupants) return;
    onQuickOccupancy(c, n);
  };

  const step = (c: EvacCenterDTO, delta: number) => {
    if (!canManage || busy) return;
    const next = Math.max(0, c.currentOccupants + delta);
    if (next === c.currentOccupants) return;
    onQuickOccupancy(c, next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Quick Update Console</h2>
          <p className="text-sm text-muted-foreground">
            Adjust occupancy with the steppers or type a value — every change is logged, timestamped and audited.
          </p>
        </div>
        <label className="flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5">
          <div>
            <p className="text-sm font-medium leading-none">Sweep mode</p>
            <p className="mt-1 text-[11px] text-muted-foreground">After each log, auto-open the next active center</p>
          </div>
          <Switch checked={sweepMode} onCheckedChange={onSweepModeChange} disabled={!canManage} aria-label="Toggle sweep mode" />
        </label>
      </div>

      {!canManage && (
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertDescription>Read-only view — MDRRMO Staff can monitor live occupancy but not record updates.</AlertDescription>
        </Alert>
      )}

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0 pb-2">
          <div className="max-h-[58vh] overflow-auto console-scroll">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
                <TableRow className="text-[11px] uppercase tracking-wide">
                  <TableHead className="pl-4">Center</TableHead>
                  <TableHead>Occupants</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead className="min-w-36">Occupancy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last update</TableHead>
                  <TableHead className="pr-4 text-right">Log</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-4">
                      <EmptyState
                        title="No active evacuation centers"
                        description="Centers appear here once they are activated in the Centers tab."
                        className="border-dashed"
                      />
                    </TableCell>
                  </TableRow>
                )}
                {active.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-4">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.barangay}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button type="button" size="icon" variant="outline" className="size-7" aria-label={`Decrease occupants for ${c.name}`} disabled={!canManage || busy || c.currentOccupants <= 0} onClick={() => step(c, -1)}>
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-20 text-center tabular-nums"
                          value={drafts[c.id] ?? String(c.currentOccupants)}
                          aria-label={`Occupants for ${c.name}`}
                          disabled={!canManage}
                          onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                          onBlur={() => commit(c)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                        <Button type="button" size="icon" variant="outline" className="size-7" aria-label={`Increase occupants for ${c.name}`} disabled={!canManage || busy} onClick={() => step(c, 1)}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">{evacNum(c.capacity)}</TableCell>
                    <TableCell>
                      <EvacCapacityBar center={c} />
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select value={c.status} onValueChange={(v) => onRequestStatus(c, v as EvacCenterStatus)}>
                          <SelectTrigger className="h-8 w-36 text-xs" aria-label={`Status for ${c.name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EVAC_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {EVAC_STATUS_META[s].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <EvacStatusBadge status={c.status} />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" title={formatDateTime(c.lastUpdated)}>
                      {timeAgo(c.lastUpdated)}
                      {c.lastUpdatedBy && <span className="block text-[10px]">by {c.lastUpdatedBy}</span>}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => onOpenLog(c)} disabled={!canManage}>
                        <SquarePen className="h-3.5 w-3.5" aria-hidden="true" /> Log
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile stacked cards */}
      <div className="space-y-3 md:hidden">
        {active.length === 0 && (
          <EmptyState
            title="No active evacuation centers"
            description="Centers appear here once they are activated in the Centers tab."
          />
        )}
        {active.map((c) => (
          <Card key={c.id} className="gap-3 rounded-2xl py-4">
            <CardContent className="space-y-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium leading-tight">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.barangay}</p>
                </div>
                <EvacStatusBadge status={c.status} />
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="icon" variant="outline" className="size-8" aria-label={`Decrease occupants for ${c.name}`} disabled={!canManage || busy || c.currentOccupants <= 0} onClick={() => step(c, -1)}>
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={0}
                  className="h-9 w-24 text-center tabular-nums"
                  value={drafts[c.id] ?? String(c.currentOccupants)}
                  aria-label={`Occupants for ${c.name}`}
                  disabled={!canManage}
                  onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                  onBlur={() => commit(c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
                <Button type="button" size="icon" variant="outline" className="size-8" aria-label={`Increase occupants for ${c.name}`} disabled={!canManage || busy} onClick={() => step(c, 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">of {evacNum(c.capacity)} cap.</span>
              </div>
              <EvacCapacityBar center={c} />
              <div className="flex items-center justify-between gap-2">
                {canManage ? (
                  <Select value={c.status} onValueChange={(v) => onRequestStatus(c, v as EvacCenterStatus)}>
                    <SelectTrigger className="h-9 w-40 text-xs" aria-label={`Status for ${c.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVAC_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {EVAC_STATUS_META[s].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground" title={formatDateTime(c.lastUpdated)}>
                    Updated {timeAgo(c.lastUpdated)}
                  </span>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => onOpenLog(c)} disabled={!canManage}>
                  <SquarePen className="h-3.5 w-3.5" aria-hidden="true" /> Log
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" aria-hidden="true" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <EmptyState icon={History} title="No occupancy updates recorded yet" description="Quick updates and logs will appear here in chronological order." className="border-dashed" />
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto console-scroll pr-1">
              {recentLogs.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl border bg-card px-3 py-2 text-xs">
                  <span className="font-medium">{l.centerName}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-semibold tabular-nums">{evacNum(l.occupants)} evacuees</span>
                  {l.note && <span className="min-w-0 flex-1 truncate text-muted-foreground" title={l.note}>{l.note}</span>}
                  <span className="ml-auto text-muted-foreground">
                    {l.recordedByName ? `${l.recordedByName} · ` : ""}
                    {timeAgo(l.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ANNOUNCEMENTS PANEL
// ---------------------------------------------------------------------------

const ANN_FILTERS = ["ALL", "PUBLISHED", "SCHEDULED", "DRAFT", "CANCELLED", "EXPIRED"] as const;

interface AnnFormState {
  title: string;
  message: string;
  priority: EvacAnnouncementPriority;
  barangays: string[];
  centerIds: string[];
  mode: "now" | "schedule" | "draft";
  publishAt: string;
  expiresAt: string;
}

function AnnFormDialog({
  open,
  barangays,
  centers,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  barangays: Array<{ code: string; name: string }>;
  centers: EvacCenterDTO[];
  onOpenChange: (open: boolean) => void;
  onCreated: (a: EvacAnnouncementDTO) => void;
}) {
  const [f, setF] = useState<AnnFormState>({ title: "", message: "", priority: "NORMAL", barangays: [], centerIds: [], mode: "now", publishAt: "", expiresAt: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [criticalConfirm, setCriticalConfirm] = useState(false);

  const set = <K extends keyof AnnFormState>(key: K, value: AnnFormState[K]) => setF((s) => ({ ...s, [key]: value }));
  const toggleIn = (key: "barangays" | "centerIds", value: string) =>
    setF((s) => ({ ...s, [key]: s[key].includes(value) ? s[key].filter((v) => v !== value) : [...s[key], value] }));

  const scheduleInvalid = f.mode === "schedule" && (f.publishAt === "" || Number.isNaN(new Date(f.publishAt).getTime()) || new Date(f.publishAt).getTime() <= Date.now());
  const valid = f.title.trim() !== "" && f.message.trim() !== "" && !scheduleInvalid;

  const doSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await evacApi.createAnnouncement({
        title: f.title.trim(),
        message: f.message.trim(),
        priority: f.priority,
        status: f.mode === "now" ? "PUBLISHED" : f.mode === "schedule" ? "SCHEDULED" : "DRAFT",
        targetBarangays: f.barangays,
        targetCenterIds: f.centerIds,
        publishAt: f.mode === "schedule" ? new Date(f.publishAt).toISOString() : undefined,
        expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null,
      });
      onCreated(res.announcement);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
      setCriticalConfirm(false);
    }
  };

  const submit = () => {
    if (!valid) return;
    if (f.priority === "CRITICAL" && f.mode !== "draft") {
      setCriticalConfirm(true);
      return;
    }
    void doSave();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" aria-hidden="true" /> New Evacuation Announcement
            </DialogTitle>
            <DialogDescription>Shown on the public evacuation page and center cards once published.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1">
              <Label htmlFor="ann-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input id="ann-title" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={200} placeholder="e.g. Pre-emptive evacuation for coastal barangays" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="ann-message">
                Message <span className="text-destructive">*</span>
              </Label>
              <Textarea id="ann-message" rows={4} value={f.message} onChange={(e) => set("message", e.target.value)} placeholder="Clear, actionable instruction for residents…" />
            </div>

            <div className="space-y-1">
              <Label>Priority</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["NORMAL", "HIGH", "URGENT", "CRITICAL"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set("priority", p)}
                    aria-pressed={f.priority === p}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-semibold transition-colors",
                      f.priority === p ? cn(ANN_PRIORITY_META[p].badge, "ring-2 ring-offset-1 ring-ring/40") : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {ANN_PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target barangays */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Target barangays</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" size="sm" variant="outline">
                      Select barangays {f.barangays.length > 0 && <Badge className="ml-1 h-4 px-1.5 text-[10px]">{f.barangays.length}</Badge>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="flex items-center justify-between border-b px-3 py-2">
                      <p className="text-xs text-muted-foreground">Blank = all barangays</p>
                      <Button type="button" size="sm" variant="ghost" className="h-6 text-xs" onClick={() => set("barangays", [])}>
                        Clear
                      </Button>
                    </div>
                    <div className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto p-2">
                      {barangays.map((b) => (
                        <label key={b.code} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted">
                          <Checkbox checked={f.barangays.includes(b.name)} onCheckedChange={() => toggleIn("barangays", b.name)} aria-label={b.name} />
                          <span className="truncate">{b.name}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {f.barangays.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">All barangays (blank) — announcement is municipal-wide.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {f.barangays.map((b) => (
                    <button key={b} type="button" className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/70" onClick={() => toggleIn("barangays", b)} aria-label={`Remove ${b}`}>
                      {b} <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Target centers */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Target evacuation centers</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" size="sm" variant="outline">
                      Select centers {f.centerIds.length > 0 && <Badge className="ml-1 h-4 px-1.5 text-[10px]">{f.centerIds.length}</Badge>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="flex items-center justify-between border-b px-3 py-2">
                      <p className="text-xs text-muted-foreground">Blank = all centers</p>
                      <Button type="button" size="sm" variant="ghost" className="h-6 text-xs" onClick={() => set("centerIds", [])}>
                        Clear
                      </Button>
                    </div>
                    <div className="max-h-64 space-y-0.5 overflow-y-auto p-2">
                      {centers.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted">
                          <Checkbox checked={f.centerIds.includes(c.id)} onCheckedChange={() => toggleIn("centerIds", c.id)} aria-label={c.name} />
                          <span className="min-w-0 flex-1 truncate">{c.name}</span>
                          <span className="text-[10px] text-muted-foreground">{c.barangay}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {f.centerIds.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">All evacuation centers (blank).</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {f.centerIds.length} center{f.centerIds.length === 1 ? "" : "s"}:{" "}
                  {f.centerIds.map((id) => centers.find((c) => c.id === id)?.name ?? id).join(", ")}
                </p>
              )}
            </div>

            {/* Publish mode */}
            <div className="space-y-1.5">
              <Label>Publish</Label>
              <RadioGroup value={f.mode} onValueChange={(v) => set("mode", v as AnnFormState["mode"])} className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["now", "Publish now"],
                    ["schedule", "Schedule"],
                    ["draft", "Save as draft"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-colors",
                      f.mode === value ? "border-primary bg-primary/5 text-foreground" : "text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <RadioGroupItem value={value} />
                    {label}
                  </label>
                ))}
              </RadioGroup>
              {f.mode === "schedule" && (
                <div className="space-y-1">
                  <Label htmlFor="ann-publish-at">Publish at *</Label>
                  <Input id="ann-publish-at" type="datetime-local" value={f.publishAt} onChange={(e) => set("publishAt", e.target.value)} aria-invalid={scheduleInvalid} />
                  {scheduleInvalid && <p className="text-xs text-destructive">Pick a valid future date and time.</p>}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="ann-expires">Expiration (optional)</Label>
              <Input id="ann-expires" type="datetime-local" value={f.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
              <p className="text-[11px] text-muted-foreground">After this time the announcement no longer shows to the public.</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={!valid || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Megaphone className="h-4 w-4" aria-hidden="true" />}
              {f.mode === "draft" ? "Save Draft" : f.mode === "schedule" ? "Schedule" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CRITICAL priority confirmation */}
      <AlertDialog open={criticalConfirm} onOpenChange={setCriticalConfirm}>
        <AlertDialogContent className="border-red-300 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" /> Confirm CRITICAL announcement
            </AlertDialogTitle>
            <AlertDialogDescription>
              CRITICAL announcements are surfaced as the highest-priority advisory on the public evacuation page. Please
              verify the information is accurate and authorized before publishing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border bg-muted/50 p-3 text-sm">
            <p className="font-semibold">{f.title || "Untitled announcement"}</p>
            <p className="mt-1 line-clamp-3 text-muted-foreground">{f.message}</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Review again</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" disabled={saving} onClick={(e) => { e.preventDefault(); void doSave(); }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null} Publish CRITICAL
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AnnouncementsPanel({
  centers,
  barangays,
  canManage,
  canHardDelete,
  openNewToken,
}: {
  centers: EvacCenterDTO[];
  barangays: Array<{ code: string; name: string }>;
  canManage: boolean;
  canHardDelete: boolean;
  openNewToken: number;
}) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<(typeof ANN_FILTERS)[number]>("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<EvacAnnouncementDTO | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EvacAnnouncementDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useLoad(() => evacApi.announcements(), String(openNewToken));

  useEffect(() => {
    if (openNewToken > 0) setFormOpen(true);
  }, [openNewToken]);

  const rows = (data?.announcements ?? []).filter((a) => filter === "ALL" || a.status === filter);

  const runAction = async (fn: () => Promise<unknown>, title: string, description: string) => {
    setBusy(true);
    try {
      await fn();
      toast({ title, description });
      reload();
    } catch (e) {
      toast({ title: "Action failed", description: errMsg(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const cancelAnn = (a: EvacAnnouncementDTO) => runAction(() => evacApi.updateAnnouncement(a.id, { status: "CANCELLED" }), "Announcement cancelled", a.title);
  const duplicateAnn = (a: EvacAnnouncementDTO) =>
    runAction(
      () =>
        evacApi.createAnnouncement({
          title: `${a.title} (copy)`,
          message: a.message,
          priority: a.priority,
          status: "DRAFT",
          targetBarangays: a.targetBarangays,
          targetCenterIds: a.targetCenterIds,
        }),
      "Duplicated as draft",
      `${a.title} (copy)`
    );
  const deleteAnn = (a: EvacAnnouncementDTO) => runAction(() => evacApi.deleteAnnouncement(a.id, true), "Announcement deleted", a.title);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Evacuation Announcements</h2>
          <p className="text-sm text-muted-foreground">Advisories shown on the public evacuation page and center cards.</p>
        </div>
        {canManage && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> New Announcement
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter announcements by status">
        {ANN_FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {key === "ALL" ? "All" : ANN_STATUS_META[key]?.label ?? key}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorAlert message={error} onRetry={reload} />
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={`No announcements${filter !== "ALL" ? ` in “${ANN_STATUS_META[filter]?.label ?? filter}”` : ""}`}
          description={
            canManage
              ? "Create one to inform residents about evacuation procedures and center openings."
              : "Published advisories will appear here."
          }
          action={
            canManage ? (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" /> New Announcement
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((a) => {
            const prio = ANN_PRIORITY_META[a.priority] ?? ANN_PRIORITY_META.NORMAL;
            const stat = ANN_STATUS_META[a.status] ?? ANN_STATUS_META.DRAFT;
            return (
              <li key={a.id} className={cn("rounded-2xl border border-l-4 bg-card p-4 shadow-sm", prio.bar)}>
                <div className="flex flex-wrap items-center gap-2">
                  <ToneBadge tone={prio.tone}>{prio.label}</ToneBadge>
                  <ToneBadge tone={stat.tone}>{stat.label}</ToneBadge>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{a.title}</p>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{a.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" aria-hidden="true" />
                    {a.targetBarangays.length ? `${a.targetBarangays.length} barangay${a.targetBarangays.length === 1 ? "" : "s"}` : "All barangays"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {a.targetCenterIds.length
                      ? `${a.targetCenterIds.length} center${a.targetCenterIds.length === 1 ? "" : "s"}`
                      : "All centers"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" aria-hidden="true" />
                    {a.status === "SCHEDULED" ? `Publishes ${formatDateTime(a.publishAt)}` : `Published ${formatDateTime(a.publishAt)}`}
                  </span>
                  {a.expiresAt && <span>Expires {formatDateTime(a.expiresAt)}</span>}
                  <span>
                    {a.createdByName ?? "—"} · {timeAgo(a.createdAt)}
                  </span>
                  {canManage && (
                    <span className="ml-auto flex items-center gap-1">
                      {(a.status === "PUBLISHED" || a.status === "SCHEDULED") && (
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => setConfirmCancel(a)}>
                          Cancel
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => void duplicateAnn(a)}>
                        <Copy className="h-3 w-3" aria-hidden="true" /> Duplicate
                      </Button>
                      {canHardDelete && (
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700" disabled={busy} onClick={() => setConfirmDelete(a)}>
                          <Trash2 className="h-3 w-3" aria-hidden="true" /> Delete
                        </Button>
                      )}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {formOpen && (
        <AnnFormDialog
          key={openNewToken}
          open={formOpen}
          barangays={barangays}
          centers={centers}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) reload();
          }}
          onCreated={(a) => {
            setFormOpen(false);
            toast({
              title: a.status === "DRAFT" ? "Draft saved" : a.status === "SCHEDULED" ? "Announcement scheduled" : "Announcement published",
              description: a.title,
            });
            reload();
          }}
        />
      )}

      <AlertDialog open={!!confirmCancel} onOpenChange={(o) => !o && setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              “{confirmCancel?.title}” will be withdrawn from the public evacuation page. This cannot be re-published —
              duplicate it instead if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); if (confirmCancel) void cancelAnn(confirmCancel); setConfirmCancel(null); }}>
              Cancel announcement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">Permanently delete this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              “{confirmDelete?.title}” will be removed from the database entirely, including its audit references. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={busy}
              onClick={(e) => { e.preventDefault(); if (confirmDelete) void deleteAnn(confirmDelete); setConfirmDelete(null); }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// REPORTS PANEL
// ---------------------------------------------------------------------------

const REPORT_PRESETS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
] as const;
type PresetKey = (typeof REPORT_PRESETS)[number]["key"];

const SERIES_COLORS = ["#059669", "#d97706", "#dc2626", "#7c3aed", "#0d9488", "#ea580c", "#db2777", "#65a30d"];

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ReportsPanel() {
  const [preset, setPreset] = useState<PresetKey>("7d");
  const [customFrom, setCustomFrom] = useState(toDateInput(new Date(Date.now() - 6 * 86400000)));
  const [customTo, setCustomTo] = useState(toDateInput(new Date()));
  const [selectionOverride, setSelectionOverride] = useState<string[] | null>(null);

  const range = useMemo((): { from: Date; to: Date } => {
    const startToday = () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    };
    const endToday = () => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d;
    };
    if (preset === "today") return { from: startToday(), to: endToday() };
    if (preset === "7d" || preset === "30d") {
      const d = startToday();
      d.setDate(d.getDate() - (preset === "7d" ? 6 : 29));
      return { from: d, to: endToday() };
    }
    const from = customFrom ? new Date(`${customFrom}T00:00:00`) : startToday();
    const to = customTo ? new Date(`${customTo}T23:59:59.999`) : endToday();
    return { from: Number.isNaN(from.getTime()) ? startToday() : from, to: Number.isNaN(to.getTime()) ? endToday() : to };
  }, [preset, customFrom, customTo]);

  const { data, loading, error, reload } = useLoad<EvacReportsResponse>(
    () => evacApi.reports(range.from.toISOString(), range.to.toISOString()),
    `${range.from.toISOString()}|${range.to.toISOString()}`
  );

  const withLogs = useMemo(() => (data?.perCenter ?? []).filter((c) => c.logs.length > 0), [data]);
  const defaultIds = useMemo(
    () => [...withLogs].sort((a, b) => b.currentOccupants - a.currentOccupants).slice(0, 5).map((c) => c.centerId),
    [withLogs]
  );
  const selectedIds = selectionOverride ?? defaultIds;
  const selected = withLogs.filter((c) => selectedIds.includes(c.centerId));

  const chartData = useMemo(() => {
    const times = Array.from(new Set(selected.flatMap((c) => c.logs.map((l) => l.createdAt)))).sort();
    return times.map((t) => {
      const row: Record<string, string | number> = { t };
      for (const c of selected) {
        const logsAsc = [...c.logs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        let v: number | null = null;
        for (const l of logsAsc) {
          if (l.createdAt <= t) v = l.occupants;
          else break;
        }
        if (v !== null) row[c.centerId] = v;
      }
      return row;
    });
  }, [selected]);

  const allStatusHistory = useMemo(
    () =>
      (data?.perCenter ?? [])
        .flatMap((c) => c.statusHistory.map((h) => ({ ...h, centerName: h.centerName || c.name })))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data]
  );
  const totalLogs = useMemo(() => (data?.perCenter ?? []).reduce((n, c) => n + c.logs.length, 0), [data]);

  const exportCsv = () => {
    if (!data) return;
    const header = ["Center", "Barangay", "Recorded At", "Occupants", "Male", "Female", "Children", "Seniors", "PWD", "Pregnant", "Other Vulnerable", "Note", "Recorded By"];
    const rows: Array<Array<string | number>> = data.perCenter
      .flatMap((c: EvacPerCenterReport) =>
        c.logs.map((l) => [
          c.name,
          c.barangay,
          formatDateTime(l.createdAt),
          l.occupants,
          l.male,
          l.female,
          l.children,
          l.seniors,
          l.pwd,
          l.pregnant,
          l.otherVulnerable,
          l.note ?? "",
          l.recordedByName ?? "",
        ])
      )
      .sort((a, b) => String(b[2]).localeCompare(String(a[2])));
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evacuation-occupancy-logs_${format(range.from, "yyyy-MM-dd")}_to_${format(range.to, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = data?.totals;

  return (
    <div className="space-y-4">
      {/* Range controls */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Range:</span>
            {REPORT_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={preset === p.key}
                onClick={() => setPreset(p.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  preset === p.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
            <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => reload()} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden="true" /> Refresh
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv} disabled={!data || totalLogs === 0}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Export CSV ({totalLogs})
            </Button>
          </div>
          {preset === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="space-y-1">
                <Label htmlFor="rep-from" className="text-xs">From</Label>
                <Input id="rep-from" type="date" className="h-8 w-44" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rep-to" className="text-xs">To</Label>
                <Input id="rep-to" type="date" className="h-8 w-44" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {loading && !data ? "Loading report…" : data ? `${formatDateTime(data.from)} → ${formatDateTime(data.to)}` : ""}
          </p>
        </CardContent>
      </Card>

      {error ? (
        <ErrorAlert message={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : !data ? null : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <EvacStatCard icon={MapPin} label="Centers" value={evacNum(totals?.totalCenters ?? 0)} note={`${totals?.openCenters ?? 0} open`} />
            <EvacStatCard icon={BedDouble} label="Capacity" value={evacNum(totals?.totalCapacity ?? 0)} note="persons" />
            <EvacStatCard icon={Users} label="Evacuees" value={evacNum(totals?.currentEvacuees ?? 0)} note={`vulnerable ${evacNum(totals?.vulnerable.total ?? 0)}`} tone="amber" />
            <EvacStatCard icon={BarChart3} label="Available" value={evacNum(totals?.availableSpaces ?? 0)} note="spaces" tone={(totals?.availableSpaces ?? 0) > 0 ? "emerald" : "red"} />
            <EvacStatCard icon={Gauge} label="Occupancy" value={`${totals?.occupancyPct ?? 0}%`} note="municipal-wide" />
            <EvacStatCard icon={FileText} label="Log entries" value={evacNum(totalLogs)} note={`${allStatusHistory.length} status changes`} tone="slate" />
          </div>

          {/* Occupancy timeline chart */}
          <Card>
            <CardHeader className="gap-2 pb-2">
              <CardTitle className="text-base">Per-Center Occupancy Timeline</CardTitle>
              {withLogs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {withLogs.map((c) => {
                    const on = selectedIds.includes(c.centerId);
                    return (
                      <button
                        key={c.centerId}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setSelectionOverride((prev) => {
                            const base = prev ?? defaultIds;
                            return on ? base.filter((id) => id !== c.centerId) : [...base, c.centerId];
                          })
                        }
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                          on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                        )}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {withLogs.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No occupancy logs in this range"
                  description="Record updates from the Occupancy & Status tab to build the timeline."
                  className="border-dashed"
                />
              ) : selected.length === 0 || chartData.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="Select a center to plot"
                  description="Pick at least one center above to draw its occupancy timeline."
                  className="border-dashed"
                />
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="t" tick={{ fontSize: 10 }} tickFormatter={(v: string) => format(new Date(v), "MMM d HH:mm")} minTickGap={40} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <RTooltip
                        labelFormatter={(v) => formatDateTime(String(v))}
                        formatter={(value: number | string, name: string) => [`${evacNum(Number(value))} evacuees`, name]}
                      />
                      <RLegend wrapperStyle={{ fontSize: 11 }} />
                      {selected.map((c, i) => (
                        <Line
                          key={c.centerId}
                          dataKey={c.centerId}
                          name={c.name}
                          type="monotone"
                          stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                          strokeWidth={2}
                          connectNulls
                          dot={{ r: 3 }}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* Per-barangay rollup */}
            <Card className="self-start">
              <CardHeader>
                <CardTitle className="text-base">Per-Barangay Rollup</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                <div className="max-h-96 overflow-auto console-scroll">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
                      <TableRow className="text-[11px] uppercase tracking-wide">
                        <TableHead className="pl-4">Barangay</TableHead>
                        <TableHead>Centers</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead className="pr-4">Occupants</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.perBarangay.map((b) => (
                        <TableRow key={b.barangay} className="hover:bg-muted/40">
                          <TableCell className="pl-4 text-sm font-medium">{b.barangay}</TableCell>
                          <TableCell className="text-sm tabular-nums">{b.centers}</TableCell>
                          <TableCell className="text-sm tabular-nums">{evacNum(b.capacity)}</TableCell>
                          <TableCell className="pr-4">
                            <div className="flex items-center gap-2">
                              <span className="w-12 text-right text-sm font-semibold tabular-nums">{evacNum(b.occupants)}</span>
                              <div className="h-2 w-16 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-black/[0.04]">
                                <div
                                  className={cn("h-full rounded-full transition-[width]", EVAC_CAPACITY_META[capacityLevelFromPct(b.capacity > 0 ? (b.occupants / b.capacity) * 100 : 0, b.capacity)].bar)}
                                  style={{ width: `${b.capacity > 0 ? Math.min(100, Math.round((b.occupants / b.capacity) * 100)) : 0}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {data.perBarangay.length === 0 && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={4} className="py-4">
                            <EmptyState title="No centers on record" className="border-dashed" />
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Status history */}
            <Card className="self-start">
              <CardHeader>
                <CardTitle className="text-base">Status Transitions In Range</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                <div className="max-h-96 overflow-auto console-scroll">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
                      <TableRow className="text-[11px] uppercase tracking-wide">
                        <TableHead className="pl-4">When</TableHead>
                        <TableHead>Center</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead className="pr-4">Reason / By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allStatusHistory.length === 0 && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={4} className="py-4">
                            <EmptyState title="No status changes in this range" className="border-dashed" />
                          </TableCell>
                        </TableRow>
                      )}
                      {allStatusHistory.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="pl-4 text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</TableCell>
                          <TableCell className="max-w-40 truncate text-sm font-medium">{h.centerName}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            <span className="text-muted-foreground">
                              {h.previousStatus ? EVAC_STATUS_META[h.previousStatus as EvacCenterStatus]?.label ?? h.previousStatus : "—"}
                            </span>
                            <span className="mx-1">→</span>
                            <EvacStatusBadge status={h.newStatus as EvacCenterStatus} />
                            {h.overridden && <span className="ml-1.5 rounded bg-amber-100 px-1 py-px text-[10px] font-semibold text-amber-800">override</span>}
                          </TableCell>
                          <TableCell className="max-w-48 pr-4 text-xs">
                            <p className="truncate text-muted-foreground" title={h.reason ?? ""}>
                              {h.reason ?? "—"}
                            </p>
                            <p className="font-medium">{h.changedByName ?? "—"}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
