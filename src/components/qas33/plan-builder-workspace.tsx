"use client";

// QAS33 Plan Builder Workspace — wizard-style layout (BDRRM Plan v6 / BDP Plan v3).
// Two views: an Overview landing (hero card w/ progress ring, workflow timeline,
// quick actions) and a Wizard editor (sticky left rail grouped by template parts,
// section-by-section editing with prev/next stepper, autosave, auto-fill from
// municipal records, PDF/DOCX export and the MDRRMO → Provincial approval flow).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Building2,
  ChartLine,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CloudLightning,
  Dumbbell,
  Eye,
  FileDown,
  FileSignature,
  Hammer,
  HeartPulse,
  Landmark,
  LayoutGrid,
  Leaf,
  LifeBuoy,
  ListChecks,
  Loader2,
  Map as MapIcon,
  Network,
  PanelLeft,
  Plus,
  RotateCcw,
  Route,
  Save,
  Scale,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Siren,
  Sprout,
  Tent,
  TriangleAlert,
  TriangleAlert as AlertIcon,
  Undo2,
  Users,
  Wallet,
  Wand2,
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
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api, formatDateTime } from "@/lib/qas33/api";
import type { PlanAutofillResponse } from "@/lib/qas33/emergency-types";
import {
  PLAN_STATUS_META,
  type PlanDetailResponse,
  type PlanFieldDef,
  type PlanReviewInfo,
  type PlanSectionClient,
  type PlanStatus,
} from "@/lib/qas33/types";
import { LoadError, errMsg } from "./barangay-shared";

// ---------------------------------------------------------------------------
// Icon registry for template section icons
// ---------------------------------------------------------------------------

const ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  users: Users,
  building: Building2,
  "cloud-lightning": CloudLightning,
  "triangle-alert": TriangleAlert,
  dumbbell: Dumbbell,
  network: Network,
  siren: Siren,
  tent: Tent,
  shield: Shield,
  "clipboard-check": ClipboardCheck,
  "life-buoy": LifeBuoy,
  hammer: Hammer,
  wallet: Wallet,
  "chart-line": ChartLine,
  "file-signature": FileSignature,
  map: MapIcon,
  "heart-pulse": HeartPulse,
  sprout: Sprout,
  leaf: Leaf,
  route: Route,
  search: Search,
  eye: Eye,
  "clipboard-list": ClipboardList,
  "shield-check": ShieldCheck,
  "book-open": BookOpen,
  scale: Scale,
};

function SectionIcon({ name, className }: { name?: string | null; className?: string }) {
  const Comp = (name && ICONS[name]) || ClipboardList;
  return <Comp aria-hidden="true" className={className} />;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCENTS: Record<string, { iconBg: string; ring: string; bar: string; chip: string; text: string; button: string }> = {
  emerald: {
    iconBg: "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
    ring: "ring-emerald-500/40",
    bar: "[&>div]:bg-emerald-600",
    chip: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    text: "text-emerald-700 dark:text-emerald-400",
    button: "bg-emerald-700 text-white hover:bg-emerald-800",
  },
  amber: {
    iconBg: "bg-amber-600/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
    ring: "ring-amber-500/40",
    bar: "[&>div]:bg-amber-600",
    chip: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    text: "text-amber-700 dark:text-amber-400",
    button: "bg-amber-700 text-white hover:bg-amber-800",
  },
};

function accentOf(color: string) {
  return ACCENTS[color] ?? ACCENTS.emerald;
}

// DB names may already carry the "Barangay" prefix (Poblacion I–V) — strip it
// so composed strings never read "Barangay Barangay III".
const bareBarangayName = (name: string) => name.replace(/^Barangay\s+/i, "").trim();

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function fieldHasValue(f: PlanFieldDef, values: Record<string, unknown>): boolean {
  const v = values[f.key];
  if (f.type === "checkbox") return Array.isArray(v) && v.length > 0;
  if (f.type === "table") {
    if (!Array.isArray(v)) return false;
    return v.some((row) =>
      Object.values(row as Record<string, unknown>).some(
        (cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""
      )
    );
  }
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return true;
  return v !== undefined && v !== null;
}

/** Is a stored value effectively empty (for auto-fill "fill only empty" mode)? */
function isValEmpty(v: unknown, field?: PlanFieldDef): boolean {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) {
    if (field?.type === "table") {
      return (
        v.length === 0 ||
        v.every((row) =>
          Object.values(row as Record<string, unknown>).every(
            (c) => c === null || c === undefined || String(c).trim() === ""
          )
        )
      );
    }
    return v.length === 0; // checkbox list
  }
  if (typeof v === "string") return v.trim() === "";
  return false; // numbers count as filled (including 0)
}

function sectionComplete(s: PlanSectionClient, values: Record<string, unknown>): boolean {
  const required = s.fields.filter((f) => f.required);
  if (required.length > 0) return required.every((f) => fieldHasValue(f, values));
  // Section with only optional fields counts once the user has entered anything.
  return s.fields.some((f) => fieldHasValue(f, values));
}

/** % of this section's required fields that are filled (100 when complete). */
function sectionPct(s: PlanSectionClient, values: Record<string, unknown>): number {
  const required = s.fields.filter((f) => f.required);
  if (required.length === 0) return s.fields.some((f) => fieldHasValue(f, values)) ? 100 : 0;
  return Math.round((required.filter((f) => fieldHasValue(f, values)).length / required.length) * 100);
}

function overallProgress(sections: PlanSectionClient[], values: Record<string, unknown>): number {
  let total = 0;
  let filled = 0;
  for (const s of sections) {
    const required = s.fields.filter((f) => f.required);
    if (required.length === 0) {
      total += 1;
      if (s.fields.some((f) => fieldHasValue(f, values))) filled += 1;
      continue;
    }
    for (const f of required) {
      total += 1;
      if (fieldHasValue(f, values)) filled += 1;
    }
  }
  return total === 0 ? 0 : Math.round((filled / total) * 100);
}

/** Compact relative time for the "Last saved" chip. */
function relTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const t = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - t.getTime();
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return t.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Animated SVG progress ring
// ---------------------------------------------------------------------------

function ProgressRing({
  value,
  size = 116,
  strokeWidth = 10,
  trackClass = "stroke-muted-foreground/15",
  arcClass = "stroke-gov-blue",
  className,
  children,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  trackClass?: string;
  arcClass?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const pct = mounted ? Math.min(100, Math.max(0, value)) : 0;
  const offset = c - (pct / 100) * c;
  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(value)} percent complete`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} className={trackClass} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-700 ease-out", arcClass)}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  );
}

/** Tiny per-section ring used in the navigator rows. */
function MiniRing({ pct, size = 18, strokeWidth = 3 }: { pct: number; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} className="stroke-muted-foreground/25" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        className="stroke-gov-blue transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Autosave badge
// ---------------------------------------------------------------------------

function SaveBadge({ state, savedAt, live = false }: { state: SaveState; savedAt: Date | null; live?: boolean }) {
  const time = savedAt ? savedAt.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) : "";
  const body =
    state === "idle" ? (
      <>
        <Save className="size-3" /> Autosave on
      </>
    ) : state === "dirty" ? (
      <>
        <Loader2 className="size-3 animate-spin" /> Unsaved…
      </>
    ) : state === "saving" ? (
      <>
        <Loader2 className="size-3 animate-spin" /> Saving…
      </>
    ) : state === "saved" ? (
      <>
        <CheckCircle2 className="size-3" /> Saved{time ? ` · ${time}` : ""}
      </>
    ) : (
      <>
        <AlertIcon className="size-3" /> Save failed
      </>
    );
  return (
    <span
      {...(live ? { "aria-live": "polite" } : {})}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        state === "saved"
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          : state === "error"
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : state === "idle"
              ? "border-muted-foreground/20 bg-muted/40 text-muted-foreground"
              : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      )}
    >
      {body}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Approval workflow timeline (Draft → Submitted → MDRRMO Review → MDRRMO
// Approved → Provincial Approval)
// ---------------------------------------------------------------------------

const TIMELINE_STEPS: Array<{ key: string; label: string; short: string; hint: string }> = [
  { key: "draft", label: "Draft", short: "Draft", hint: "Fill out the plan sections" },
  { key: "submitted", label: "Submitted", short: "Sent", hint: "Submitted to the MDRRMO" },
  { key: "review", label: "MDRRMO Review", short: "Review", hint: "Evaluation by the MDRRMO" },
  { key: "mdrrmo", label: "MDRRMO Approved", short: "Approved", hint: "Municipal approval recorded" },
  { key: "province", label: "Provincial Approval", short: "Province", hint: "Provincial DRRM Officer" },
];

const TIMELINE_MAP: Record<PlanStatus, { done: number; current: number }> = {
  NOT_STARTED: { done: 0, current: 0 },
  DRAFT: { done: 0, current: 0 },
  COMPLETED: { done: 0, current: 0 },
  RETURNED: { done: 0, current: 0 },
  SUBMITTED: { done: 2, current: 2 },
  APPROVED: { done: 4, current: 4 },
  PROVINCE_APPROVED: { done: 5, current: -1 },
};

function WorkflowTimeline({ status }: { status: PlanStatus }) {
  const { done, current } = TIMELINE_MAP[status] ?? TIMELINE_MAP.NOT_STARTED;
  return (
    <div>
      <p className="sr-only">
        {current === -1
          ? "Plan approval progress: all five steps complete — approved by the Provincial DRRM Officer."
          : `Plan approval progress: step ${current + 1} of ${TIMELINE_STEPS.length} — ${TIMELINE_STEPS[current].label}.`}
      </p>
      <ol className="flex items-start" aria-hidden="true">
        {TIMELINE_STEPS.map((step, i) => {
          const state = i < done ? "done" : i === current ? "current" : "future";
          const connectorDone = i + 1 <= done;
          return (
            <li key={step.key} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
              {i < TIMELINE_STEPS.length - 1 && (
                <span
                  className={cn(
                    "absolute top-[13px] right-[calc(-50%+16px)] left-[calc(50%+16px)] h-0.5 rounded-full",
                    connectorDone ? "bg-emerald-500/70" : "bg-muted-foreground/20"
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors",
                  state === "done" && "border-emerald-600 bg-emerald-600 text-white",
                  state === "current" && "animate-pulse border-gov-gold bg-gov-gold text-gov-blue-deep ring-4 ring-gov-gold/25",
                  state === "future" && "border-muted-foreground/30 bg-background text-muted-foreground/60"
                )}
              >
                {state === "done" ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "mt-1.5 max-w-[92px] text-[9px] leading-tight font-semibold tracking-wide uppercase sm:text-[10px]",
                  state === "done" && "text-emerald-700 dark:text-emerald-400",
                  state === "current" && "text-gov-blue dark:text-gov-blue-100",
                  state === "future" && "text-muted-foreground/70"
                )}
              >
                {step.short}
              </span>
              <span className="mt-0.5 hidden max-w-[110px] text-[9px] leading-tight text-muted-foreground/70 xl:block">
                {step.hint}
              </span>
            </li>
          );
        })}
      </ol>
      {status === "RETURNED" && (
        <p className="mt-2 text-center text-[10px] font-medium text-orange-700 dark:text-orange-400">
          Returned for revision — address the MDRRMO notes, then submit again.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Approval workflow banners (kept from the previous layout; shown under the
// hero on the overview and under the toolbar in the wizard)
// ---------------------------------------------------------------------------

function StatusBanner({ status, review, barangayName }: { status: PlanStatus; review: PlanReviewInfo | null; barangayName: string }) {
  if (status === "SUBMITTED") {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <Clock className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold">Submitted for approval on {formatDateTime(review?.submittedAt)} by {review?.submittedByName ?? barangayName}.</p>
          <p className="mt-0.5 text-amber-800/80 dark:text-amber-300/80">
            The MDRRMO will review this plan. Use <span className="font-medium">Withdraw</span> to pull it back and keep editing.
          </p>
        </div>
      </div>
    );
  }
  if (status === "APPROVED") {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
      >
        <BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold">
            APPROVED by {review?.reviewedBy ?? "MDRRMO"} on {formatDateTime(review?.reviewedAt)}
          </p>
          <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-300/80">
            Document Ref: <span className="font-mono font-semibold">{review?.docRef ?? "—"}</span> · Awaiting approval by the Provincial DRRM
            Officer — the MDRRMO will record it. Download the current PDF or DOCX from the overview.
          </p>
        </div>
      </div>
    );
  }
  if (status === "PROVINCE_APPROVED") {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-teal-300 bg-teal-50 p-4 text-teal-900 dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-200"
      >
        <BadgeCheck className="mt-0.5 size-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold">
            APPROVED by the Provincial DRRM Officer{review?.provincialApprovedBy ? ` — ${review.provincialApprovedBy}` : ""}
            {review?.provincialApprovedAt ? ` on ${formatDateTime(review.provincialApprovedAt)}` : ""}
          </p>
          <p className="mt-0.5 text-teal-800/80 dark:text-teal-300/80">
            Document Ref: <span className="font-mono font-semibold">{review?.docRef ?? "—"}</span> · This plan is final. Download the approved PDF
            or DOCX from the overview — the provincial approval is printed on the signature page.
          </p>
        </div>
      </div>
    );
  }
  if (status === "RETURNED") {
    return (
      <div
        role="alert"
        className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-orange-900 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-200"
      >
        <div className="flex items-start gap-3">
          <Undo2 className="mt-0.5 size-5 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold">Returned for revision by {review?.reviewedBy ?? "MDRRMO"}</p>
            <p className="mt-1 whitespace-pre-line rounded-lg bg-white/60 p-2.5 text-orange-900/90 dark:bg-black/20 dark:text-orange-100/90">
              {review?.reviewNote ?? "Please review the MDRRMO comments, update the plan and submit it again."}
            </p>
            <p className="mt-1.5 text-orange-800/80 dark:text-orange-300/80">
              Address the notes above, then submit the plan for approval again when ready.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Section navigator rail (desktop sidebar + mobile sheet share this)
// ---------------------------------------------------------------------------

function RailContent({
  sections,
  done,
  pcts,
  activeIdx,
  groups,
  query,
  onQueryChange,
  collapsed,
  onToggleGroup,
  onSelect,
  doneCount,
  localProgress,
  accentBar,
  scrollClass,
}: {
  sections: PlanSectionClient[];
  done: boolean[];
  pcts: number[];
  activeIdx: number;
  groups: Array<{ label: string; items: Array<{ idx: number; section: PlanSectionClient }> }>;
  query: string;
  onQueryChange: (q: string) => void;
  collapsed: Set<string>;
  onToggleGroup: (label: string) => void;
  onSelect: (idx: number) => void;
  doneCount: number;
  localProgress: number;
  accentBar: string;
  scrollClass: string;
}) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? sections
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.title.toLowerCase().includes(q) || s.fields.some((f) => f.labelEn.toLowerCase().includes(q)))
    : null;

  const row = (idx: number, section: PlanSectionClient) => {
    const isActive = idx === activeIdx;
    const complete = done[idx];
    return (
      <li key={section.code}>
        <button
          type="button"
          onClick={() => onSelect(idx)}
          aria-current={isActive ? "true" : undefined}
          className={cn(
            "relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
            isActive ? "bg-gov-blue/[0.08] dark:bg-gov-blue-800/40" : "hover:bg-muted/70"
          )}
        >
          {isActive && <span aria-hidden="true" className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-gov-blue" />}
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg",
              isActive ? "bg-gov-blue/10 text-gov-blue dark:bg-gov-blue-100/10 dark:text-gov-blue-100" : "bg-muted text-muted-foreground"
            )}
          >
            <SectionIcon name={section.icon} className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">Section {idx + 1}</span>
            <span
              className={cn(
                "block truncate text-xs leading-tight",
                isActive ? "font-semibold text-gov-blue dark:text-gov-blue-100" : "font-medium"
              )}
            >
              {section.title}
            </span>
          </span>
          {complete ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          ) : (
            <MiniRing pct={pcts[idx]} />
          )}
          <span className="sr-only">{complete ? "Section complete" : `${pcts[idx]} percent complete`}</span>
        </button>
      </li>
    );
  };

  return (
    <div className="flex min-h-0 flex-col">
      {/* Overall progress */}
      <div className="px-3 pt-3">
        <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
          <span>Overall progress</span>
          <span className="font-semibold tabular-nums">{localProgress}%</span>
        </div>
        <Progress value={localProgress} className={cn("mt-1 h-2", accentBar)} aria-label={`Plan completion ${localProgress}%`} />
        <p className="mt-1 text-[10px] text-muted-foreground">
          {doneCount} of {sections.length} sections complete
        </p>
      </div>

      {/* Search */}
      <div className="relative mt-3 px-3">
        <Search className="pointer-events-none absolute top-1/2 left-5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search sections or fields…"
          aria-label="Search plan sections"
          className="h-8 border-muted-foreground/20 pl-8 text-xs"
        />
      </div>

      <ScrollArea className={cn("mt-2 min-h-0 pb-3", scrollClass)}>
        <nav aria-label="Plan sections">
          {filtered ? (
            filtered.length > 0 ? (
              <ul className="space-y-0.5 px-2">
                {filtered.map(({ s, i }) => row(i, s))}
              </ul>
            ) : (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No sections match <span className="font-medium">“{query.trim()}”</span>
              </p>
            )
          ) : (
            groups.map((g) => (
              <Collapsible key={g.label} open={!collapsed.has(g.label)} onOpenChange={() => onToggleGroup(g.label)}>
                <div className="px-2">
                  <CollapsibleTrigger className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-[10px] font-semibold tracking-wider text-muted-foreground uppercase transition-colors hover:bg-muted/60">
                    <ChevronDown
                      className={cn("size-3.5 shrink-0 text-muted-foreground/70 transition-transform", collapsed.has(g.label) && "-rotate-90")}
                      aria-hidden="true"
                    />
                    <span className="truncate">{g.label}</span>
                    <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold tabular-nums">
                      {g.items.filter(({ idx }) => done[idx]).length}/{g.items.length}
                    </span>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <ul className="mb-1 space-y-0.5 px-2">{g.items.map(({ idx, section }) => row(idx, section))}</ul>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </nav>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export default function PlanBuilderWorkspace({
  builderCode,
  barangayName,
  onExit,
  onSaved,
}: {
  builderCode: string;
  barangayName: string;
  onExit: () => void;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<PlanDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<PlanStatus>("NOT_STARTED");
  const [locked, setLocked] = useState(false); // autosave hit the SUBMITTED/APPROVED lock (409)
  const [resetOpen, setResetOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [lastExport, setLastExport] = useState<{ format: string; at: string } | null>(null);

  // Auto-fill dialog state
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [autofillData, setAutofillData] = useState<PlanAutofillResponse | null>(null);
  const [autofillMode, setAutofillMode] = useState<"empty" | "overwrite">("empty");

  // New wizard layout state
  const [view, setView] = useState<"overview" | "wizard">("overview");
  const [railQuery, setRailQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewAck, setReviewAck] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valuesRef = useRef(values);
  const sectionHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const navInitRef = useRef(false);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const load = useCallback(() => {
    api
      .planDetail(builderCode)
      .then((d) => {
        setDetail(d);
        setValues(d.values);
        setProgress(d.progress);
        setStatus(d.status);
        setLocked(false);
        setLastExport(
          d.review.lastExportAt ? { format: d.review.lastExportFormat ?? "", at: d.review.lastExportAt } : null
        );
        setActiveIdx(0);
        setLoadError(null);
      })
      .catch((e) => setLoadError(errMsg(e)));
  }, [builderCode]);

  useEffect(() => {
    load();
  }, [load]);

  // Read-only while awaiting / after MDRRMO or provincial approval (or when autosave was 409-locked)
  const review = detail?.review ?? null;
  const readOnly = status === "SUBMITTED" || status === "APPROVED" || status === "PROVINCE_APPROVED" || locked;

  // Debounced autosave ---------------------------------------------------------
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("dirty");
    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        const r = await api.savePlan(builderCode, valuesRef.current);
        setProgress(r.progress);
        setStatus(r.status as PlanStatus);
        setLocked(false);
        setSaveState("saved");
        setSavedAt(new Date());
        onSaved?.();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.toLowerCase().includes("locked")) {
          // Plan was submitted/approved elsewhere — switch to read-only mode.
          setLocked(true);
          setSaveState("idle");
          load();
          toast({
            title: "Plan locked",
            description: "This plan is awaiting MDRRMO approval and can no longer be edited.",
            variant: "destructive",
          });
        } else {
          setSaveState("error");
        }
      }
    }, 900);
  }, [builderCode, load, onSaved, toast]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        // Flush the pending autosave so in-flight edits aren't silently
        // dropped when the user exits the builder (fire-and-forget).
        void api.savePlan(builderCode, valuesRef.current).catch(() => {
          // Best-effort flush — the workspace is navigating away.
        });
      }
    };
  }, [builderCode]);

  const setValue = useCallback(
    (key: string, v: unknown) => {
      if (readOnly) return;
      setValues((prev) => {
        const next = { ...prev, [key]: v };
        return next;
      });
      scheduleSave();
    },
    [readOnly, scheduleSave]
  );

  async function handleReset() {
    setResetOpen(false);
    try {
      await api.planAction(builderCode, "reset");
      setValues({});
      setProgress(0);
      setStatus("NOT_STARTED");
      setActiveIdx(0);
      setSaveState("idle");
      setView("overview");
      onSaved?.();
    } catch (e) {
      toast({ title: "Could not reset plan", description: errMsg(e), variant: "destructive" });
      setSaveState("error");
    }
  }

  // ---- Submit / withdraw workflow -------------------------------------------
  async function handleSubmit() {
    setSubmitOpen(false);
    setReviewAck(false);
    setActionBusy(true);
    try {
      const r = await api.planAction(builderCode, "submit");
      setStatus((r.status as PlanStatus) ?? "SUBMITTED");
      setSaveState("idle");
      setView("overview");
      load();
      toast({
        title: "Plan submitted for approval",
        description: "The MDRRMO has been notified and will review your plan. You can withdraw it while pending.",
      });
      onSaved?.();
    } catch (e) {
      toast({ title: "Could not submit plan", description: errMsg(e), variant: "destructive" });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleWithdraw() {
    setWithdrawOpen(false);
    setActionBusy(true);
    try {
      const r = await api.planAction(builderCode, "withdraw");
      setStatus((r.status as PlanStatus) ?? "DRAFT");
      setView("overview");
      load();
      toast({ title: "Plan withdrawn", description: "Your plan is back to draft — you can keep editing it." });
      onSaved?.();
    } catch (e) {
      toast({ title: "Could not withdraw plan", description: errMsg(e), variant: "destructive" });
    } finally {
      setActionBusy(false);
    }
  }

  // ---- Auto-fill from municipal records --------------------------------------
  function openAutofill() {
    setAutofillOpen(true);
    setAutofillError(null);
    setAutofillData(null);
    setAutofillMode("empty");
    setAutofillLoading(true);
    api
      .planAutofill(builderCode)
      .then((r) => {
        setAutofillData(r);
        setAutofillLoading(false);
      })
      .catch((e) => {
        setAutofillError(errMsg(e));
        setAutofillLoading(false);
      });
  }

  const fieldByKey = useMemo(() => {
    const m = new Map<string, PlanFieldDef>();
    for (const s of detail?.sections ?? []) for (const f of s.fields) m.set(f.key, f);
    return m;
  }, [detail]);

  function applyAutofill() {
    if (!autofillData) return;
    const prev = values;
    const next = { ...prev };
    let applied = 0;
    for (const [key, val] of Object.entries(autofillData.values)) {
      const existing = prev[key];
      const hasExisting = !isValEmpty(existing, fieldByKey.get(key));
      if (autofillMode === "empty" && hasExisting) continue;
      if (autofillMode === "overwrite" && JSON.stringify(existing ?? null) === JSON.stringify(val)) continue;
      next[key] = val;
      applied += 1;
    }
    setValues(next);
    setAutofillOpen(false);
    if (applied > 0) {
      scheduleSave();
      toast({
        title: `Filled ${applied} field${applied === 1 ? "" : "s"} from municipal records`,
        description: "Review the pre-filled answers and adjust anything that needs updating.",
      });
    } else {
      toast({ title: "Nothing to fill", description: "Your answers already cover everything the municipal records can provide." });
    }
  }

  // ---- Export -----------------------------------------------------------------
  function downloadExport(format: "pdf" | "docx") {
    const a = document.createElement("a");
    a.href = api.planExportUrl(builderCode, format);
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setLastExport({ format, at: new Date().toISOString() });
    toast({ title: `Preparing ${format.toUpperCase()}`, description: "Your download will start in a moment." });
  }

  const sections = detail?.sections ?? [];
  const active = sections[activeIdx];
  const accent = accentOf(detail?.builder.color ?? "emerald");

  // Group sections by their `group` label for the navigator
  const groups = useMemo(() => {
    const out: Array<{ label: string; items: Array<{ idx: number; section: PlanSectionClient }> }> = [];
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const label = s.group ?? "Sections";
      let g = out.find((x) => x.label === label);
      if (!g) {
        g = { label, items: [] };
        out.push(g);
      }
      g.items.push({ idx: i, section: s });
    }
    return out;
  }, [sections]);

  // Scroll + focus management when the active section changes ------------------
  useEffect(() => {
    if (!navInitRef.current) {
      navInitRef.current = true;
      return;
    }
    const el = sectionHeadingRef.current;
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeIdx]);

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function goToSection(idx: number) {
    setActiveIdx(Math.max(0, Math.min(sections.length - 1, idx)));
  }

  function enterWizard(idx?: number) {
    if (typeof idx === "number") setActiveIdx(idx);
    setView("wizard");
  }

  if (loadError) {
    return <LoadError title="Failed to load plan builder" message={loadError} onRetry={load} />;
  }
  if (!detail) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const done = sections.map((s) => sectionComplete(s, values));
  const pcts = sections.map((s) => sectionPct(s, values));
  const allDone = done.every(Boolean);
  const doneCount = done.filter(Boolean).length;
  const localProgress = overallProgress(sections, values);
  const totalFields = sections.reduce((n, s) => n + s.fields.length, 0);
  const filledFields = sections.reduce((n, s) => n + s.fields.filter((f) => fieldHasValue(f, values)).length, 0);
  const firstIncomplete = done.findIndex((d) => !d);
  const canSubmitNow = !readOnly && (status === "DRAFT" || status === "COMPLETED" || status === "RETURNED");
  const statusMeta = PLAN_STATUS_META[status];
  const startLabel = readOnly ? "View plan sections" : status === "NOT_STARTED" ? "Start building" : "Continue building";
  const lastSavedLabel = relTime(savedAt ?? detail.updatedAt);

  // ============================================================================
  // WIZARD VIEW
  // ============================================================================
  const wizard = (
    <div>
      {/* ---- Sticky toolbar ------------------------------------------------ */}
      <div className="sticky top-14 z-20 -mx-4 mb-4 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setView("overview")} aria-label="Back to plan overview">
            <LayoutGrid className="size-4" />
            <span className="hidden sm:inline">Overview</span>
          </Button>
          <Separator orientation="vertical" className="!h-6" />
          <div className="hidden min-w-0 flex-1 items-center gap-2.5 md:flex">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", accent.iconBg)}>
              <SectionIcon name={detail.builder.icon} className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] leading-tight font-semibold">{detail.builder.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                Barangay {bareBarangayName(detail.barangay.name)} · Plan Year {detail.year} · {doneCount}/{sections.length} sections
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="hidden sm:inline-flex">
              <SaveBadge state={saveState} savedAt={savedAt} live />
            </span>
            {readOnly && (
              <Badge
                variant="outline"
                className="border-amber-400 bg-amber-50 text-[10px] text-amber-800 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <Clock className="mr-1 size-3" /> Read-only
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open section navigator"
            >
              <PanelLeft className="size-4" />
              <span className="hidden sm:inline">Sections</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={openAutofill}
              disabled={readOnly}
              aria-label="Auto-fill from municipal records"
            >
              <Wand2 className="size-4" />
              <span className="hidden lg:inline">Auto-fill</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Download plan">
                  <FileDown className="size-4" />
                  <span className="hidden lg:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Download plan</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => downloadExport("pdf")}>
                  <FileDown className="size-4" /> PDF document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadExport("docx")}>
                  <FileDown className="size-4" /> Word document (DOCX)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canSubmitNow && (
              <Button type="button" size="sm" className={cn("gap-1.5", accent.button)} onClick={() => setReviewOpen(true)} disabled={actionBusy}>
                <Send className="size-4" />
                <span className="hidden sm:inline">Submit</span>
              </Button>
            )}
            {status === "SUBMITTED" && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setWithdrawOpen(true)} disabled={actionBusy}>
                <Undo2 className="size-4" />
                <span className="hidden sm:inline">Withdraw</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Read-only strip */}
      {readOnly && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300" role="status">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          Read-only — editing is disabled while the plan is in the approval workflow (MDRRMO / Provincial DRRM Officer).
        </p>
      )}

      <StatusBanner status={status} review={review} barangayName={barangayName} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ---- Section navigator rail (desktop) ----------------------------- */}
        <aside className="hidden self-start lg:block">
          <Card className="sticky top-[118px] overflow-hidden py-0">
            <CardContent className="p-0">
              <RailContent
                sections={sections}
                done={done}
                pcts={pcts}
                activeIdx={activeIdx}
                groups={groups}
                query={railQuery}
                onQueryChange={setRailQuery}
                collapsed={collapsedGroups}
                onToggleGroup={toggleGroup}
                onSelect={goToSection}
                doneCount={doneCount}
                localProgress={localProgress}
                accentBar={accent.bar}
                scrollClass="h-[calc(100vh-360px)] min-h-[280px]"
              />
            </CardContent>
          </Card>
        </aside>

        {/* ---- Main pane ------------------------------------------------------ */}
        <div className="min-w-0">
          {active && (
            <>
              <div key={active.code} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Card>
                  <CardContent className="p-4 sm:p-6">
                    {/* Section header */}
                    <div className="flex flex-wrap items-start gap-4">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gov-blue to-gov-blue-700 text-white shadow-lg shadow-gov-blue/20 ring-2 ring-gov-gold/40">
                        <SectionIcon name={active.icon} className="size-6" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <nav aria-label="Section breadcrumb" className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                          <span className="truncate">{active.group ?? "Plan"}</span>
                          <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
                          <span>Section {activeIdx + 1} of {sections.length}</span>
                        </nav>
                        <h2
                          ref={sectionHeadingRef}
                          tabIndex={-1}
                          className="mt-0.5 scroll-mt-32 rounded-sm text-lg leading-snug font-bold outline-none focus-visible:ring-2 focus-visible:ring-gov-gold/60 sm:text-xl"
                        >
                          {active.title}
                        </h2>
                        {active.desc && <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{active.desc}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {done[activeIdx] ? (
                          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <CheckCircle2 className="mr-1 size-3" /> Complete
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            In progress · {pcts[activeIdx]}%
                          </Badge>
                        )}
                        <span className="sm:hidden">
                          <SaveBadge state={saveState} savedAt={savedAt} />
                        </span>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    {/* Fields */}
                    <div className="grid gap-5 sm:grid-cols-2">
                      {active.fields.map((f) => (
                        <PlanField key={f.key} field={f} values={values} onChange={setValue} accent={detail.builder.color} disabled={readOnly} />
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Completion notice */}
                {allDone && (
                  <Card className="mt-4 border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40">
                    <CardContent className="flex flex-wrap items-start gap-3 p-4">
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                          {detail.builder.title} — {detail.year} {canSubmitNow ? "ready to submit" : "complete"}
                        </p>
                        <p className="mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-300/80">
                          {canSubmitNow
                            ? "All required fields are filled. Submit the plan to the MDRRMO for review and approval."
                            : review?.docRef
                              ? `Approved document reference: ${review.docRef}`
                              : `Reference: ${detail.builder.docPrefix}-${String(detail.year).slice(2)}-${detail.barangay.code.slice(-3)} · Saved to the QAS33 database.`}
                        </p>
                      </div>
                      {canSubmitNow && (
                        <Button size="sm" className={cn("shrink-0", accent.button)} onClick={() => setReviewOpen(true)} disabled={actionBusy}>
                          <Send className="size-4" /> Submit for Approval
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* ---- Bottom navigation ------------------------------------------ */}
              <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activeIdx === 0}
                    onClick={() => goToSection(activeIdx - 1)}
                    aria-label="Go to previous section"
                    className="gap-1"
                  >
                    <ChevronLeft className="size-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>

                  {/* Segmented section progress */}
                  <div
                    className="hidden min-w-0 flex-1 items-center gap-[3px] md:flex"
                    role="progressbar"
                    aria-valuemin={1}
                    aria-valuemax={sections.length}
                    aria-valuenow={activeIdx + 1}
                    aria-label={`Section ${activeIdx + 1} of ${sections.length}`}
                  >
                    {sections.map((s, i) => (
                      <span
                        key={s.code}
                        className={cn(
                          "h-1.5 min-w-[3px] flex-1 rounded-full transition-colors",
                          i === activeIdx
                            ? "bg-gov-blue dark:bg-gov-blue-100"
                            : done[i]
                              ? "bg-emerald-500/80"
                              : "bg-muted-foreground/20"
                        )}
                      />
                    ))}
                  </div>
                  <p className="min-w-0 flex-1 text-center text-[11px] tabular-nums text-muted-foreground md:hidden">
                    Section {activeIdx + 1} of {sections.length}
                  </p>

                  {activeIdx < sections.length - 1 ? (
                    <Button size="sm" onClick={() => goToSection(activeIdx + 1)} aria-label="Go to next section" className="gap-1">
                      <span className="hidden sm:inline">Next section</span>
                      <ChevronRight className="size-4" />
                    </Button>
                  ) : canSubmitNow ? (
                    <Button size="sm" className={cn("gap-1", accent.button)} onClick={() => setReviewOpen(true)} disabled={actionBusy}>
                      Review &amp; Submit <Send className="size-4" />
                    </Button>
                  ) : (
                    <Badge variant="outline" className={cn("px-3 py-1.5", allDone ? PLAN_STATUS_META.COMPLETED.badge : "text-muted-foreground")}>
                      {allDone ? "All sections complete" : `${doneCount}/${sections.length} sections complete`}
                    </Badge>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- Mobile section navigator sheet ---------------------------------- */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[86vw] gap-0 p-0 sm:max-w-[320px]">
          <SheetHeader className="border-b pr-10">
            <SheetTitle className="text-left text-sm">{detail.builder.title}</SheetTitle>
            <SheetDescription className="text-left text-xs">
              {doneCount} of {sections.length} sections complete · {localProgress}% filled
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1">
            <RailContent
              sections={sections}
              done={done}
              pcts={pcts}
              activeIdx={activeIdx}
              groups={groups}
              query={railQuery}
              onQueryChange={setRailQuery}
              collapsed={collapsedGroups}
              onToggleGroup={toggleGroup}
              onSelect={(i) => {
                goToSection(i);
                setMobileNavOpen(false);
              }}
              doneCount={doneCount}
              localProgress={localProgress}
              accentBar={accent.bar}
              scrollClass="h-[calc(100vh-190px)] min-h-[280px]"
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );

  // ============================================================================
  // OVERVIEW (landing) VIEW
  // ============================================================================
  const overview = (
    <div className="space-y-4">
      {/* ---- Plan hero card -------------------------------------------------- */}
      <Card className="overflow-hidden border-gov-blue/25 py-0">
        <div className="h-1 bg-gradient-to-r from-gov-gold via-gov-gold-light to-gov-gold" aria-hidden="true" />
        <div className="relative overflow-hidden bg-gradient-to-br from-gov-blue via-gov-blue-dark to-gov-blue-deep p-5 sm:p-7">
          {/* Decorative glows */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -right-16 size-64 rounded-full bg-gov-gold/15 blur-3xl" />
            <div className="absolute -bottom-28 -left-10 size-72 rounded-full bg-gov-blue-600/30 blur-3xl" />
          </div>
          <div className="relative flex flex-wrap items-center gap-x-5 gap-y-4">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Back to plan builders"
              onClick={onExit}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/25 backdrop-blur sm:size-14">
              <SectionIcon name={detail.builder.icon} className="size-6 sm:size-7" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-gov-gold uppercase">
                MDRRMO Pio Duran · Official Plan Builder
              </p>
              <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl leading-tight font-bold text-white sm:text-2xl">
                {detail.builder.title}
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white/80 ring-1 ring-white/15">
                  v{detail.builder.version}
                </span>
              </h1>
              <p className="mt-1 text-xs text-white/70 sm:text-sm">
                {detail.builder.subtitle} · Barangay {bareBarangayName(detail.barangay.name)} · Plan Year {detail.year}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-white/25 bg-white/10 text-[10px] text-white backdrop-blur dark:border-white/25 dark:bg-white/10 dark:text-white"
                >
                  <span className={cn("mr-1.5 size-1.5 rounded-full", statusMeta.dot)} />
                  {statusMeta.label}
                </Badge>
                <Badge variant="outline" className="border-white/25 bg-white/10 text-[10px] text-white backdrop-blur dark:border-white/25 dark:bg-white/10 dark:text-white">
                  {detail.builder.docPrefix}-{String(detail.year).slice(2)}-{detail.barangay.code.slice(-3)}
                </Badge>
              </div>
            </div>
            {/* Progress ring */}
            <div className="order-last flex flex-col items-center gap-1.5 max-sm:w-full sm:order-none">
              <ProgressRing
                value={localProgress}
                size={116}
                strokeWidth={10}
                trackClass="stroke-white/15"
                arcClass="stroke-gov-gold"
              >
                <span className="text-2xl font-bold tabular-nums text-white">{localProgress}%</span>
                <span className="text-[9px] font-semibold tracking-widest text-white/60 uppercase">complete</span>
              </ProgressRing>
              <p className="text-[11px] text-white/75">
                {doneCount} of {sections.length} sections completed
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-4 sm:p-5">
          {/* Stat chips */}
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: ClipboardCheck, label: "Sections completed", value: `${doneCount}/${sections.length}` },
              { icon: ListChecks, label: "Fields filled", value: `${filledFields}/${totalFields}` },
              { icon: Clock, label: "Last saved", value: lastSavedLabel },
              { icon: Activity, label: "Status", value: statusMeta.label },
            ].map((chip) => (
              <div key={chip.label} className="rounded-xl border bg-muted/30 p-3">
                <dt className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <chip.icon className="size-3.5 shrink-0" aria-hidden="true" />
                  {chip.label}
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold tabular-nums" title={chip.value}>
                  {chip.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* Workflow timeline */}
          <div className="mt-4 rounded-xl border bg-muted/20 p-3 sm:p-4">
            <p className="mb-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Plan approval workflow</p>
            <WorkflowTimeline status={status} />
          </div>
        </CardContent>
      </Card>

      {/* ---- Approval workflow banners ---------------------------------------- */}
      <StatusBanner status={status} review={review} barangayName={barangayName} />

      {/* ---- Quick actions ------------------------------------------------------ */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Quick actions</h2>
              <p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
                {readOnly ? (
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    Read-only — editing is disabled while the plan is in the approval workflow (MDRRMO / Provincial DRRM Officer).
                  </span>
                ) : saveState === "error" ? (
                  <span className="font-medium text-destructive">Save failed — check your connection. Editing continues locally.</span>
                ) : (
                  <>
                    Changes save automatically as you fill out the plan · Last saved {lastSavedLabel}
                  </>
                )}
              </p>
            </div>
            <Button
              type="button"
              className={cn(
                "gap-2 bg-gov-gold font-semibold text-gov-blue-deep shadow-lg shadow-gov-gold/25 hover:bg-gov-gold-dark"
              )}
              onClick={() => enterWizard(firstIncomplete >= 0 ? firstIncomplete : 0)}
            >
              {readOnly ? <Eye className="size-4" /> : <Hammer className="size-4" />}
              {startLabel}
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {/* Continue where you left off */}
            {firstIncomplete >= 0 && (
              <button
                type="button"
                onClick={() => enterWizard(firstIncomplete)}
                className="group flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:border-gov-blue/40 hover:bg-gov-blue/[0.04] dark:hover:bg-gov-blue-800/25"
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-gov-blue/10 text-gov-blue dark:bg-gov-blue-100/10 dark:text-gov-blue-100">
                  <Route className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">Continue where you left off</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Section {firstIncomplete + 1} of {sections.length} · {sections[firstIncomplete]?.title}
                  </span>
                </span>
                <ChevronRight className="mt-2.5 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            )}

            {/* Auto-fill */}
            <button
              type="button"
              onClick={openAutofill}
              disabled={readOnly}
              className="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:border-gov-blue/40 hover:bg-gov-blue/[0.04] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gov-blue-800/25"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-gov-blue/10 text-gov-blue dark:bg-gov-blue-100/10 dark:text-gov-blue-100">
                <Wand2 className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">Auto-fill from municipal records</span>
                <span className="block text-xs text-muted-foreground">Pre-fill official figures the MDRRMO has on file</span>
              </span>
            </button>

            {/* Exports */}
            <button
              type="button"
              onClick={() => downloadExport("pdf")}
              className="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:border-gov-blue/40 hover:bg-gov-blue/[0.04] dark:hover:bg-gov-blue-800/25"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-gov-blue/10 text-gov-blue dark:bg-gov-blue-100/10 dark:text-gov-blue-100">
                <FileDown className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">Export PDF</span>
                <span className="block text-xs text-muted-foreground">Official template with signature page</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => downloadExport("docx")}
              className="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:border-gov-blue/40 hover:bg-gov-blue/[0.04] dark:hover:bg-gov-blue-800/25"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-gov-blue/10 text-gov-blue dark:bg-gov-blue-100/10 dark:text-gov-blue-100">
                <FileDown className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">Export DOCX</span>
                <span className="block text-xs text-muted-foreground">Editable Word document for revision</span>
              </span>
            </button>

            {/* Submit */}
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              disabled={!canSubmitNow || actionBusy}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                canSubmitNow ? "border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40" : ""
              )}
            >
              <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg", accent.iconBg)}>
                <Send className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">Submit for approval</span>
                <span className="block text-xs text-muted-foreground">
                  {canSubmitNow ? "Send to the MDRRMO for review" : "Available once the plan is in an editable state"}
                </span>
              </span>
            </button>

            {/* Withdraw */}
            {status === "SUBMITTED" && (
              <button
                type="button"
                onClick={() => setWithdrawOpen(true)}
                disabled={actionBusy}
                className="flex items-start gap-3 rounded-xl border border-amber-300 p-3 text-left transition-colors hover:bg-amber-50 dark:border-amber-700 dark:hover:bg-amber-950/40"
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-600/10 text-amber-700 dark:text-amber-400">
                  <Undo2 className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">Withdraw submission</span>
                  <span className="block text-xs text-muted-foreground">Pull the plan back to draft and keep editing</span>
                </span>
              </button>
            )}

            {/* Reset */}
            {!readOnly && (
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                className="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:border-destructive/40 hover:bg-destructive/5"
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <RotateCcw className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">Reset plan data</span>
                  <span className="block text-xs text-muted-foreground">Clear every answer and start over</span>
                </span>
              </button>
            )}
          </div>

          {lastExport && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Last exported: {lastExport.format.toUpperCase()} · {formatDateTime(lastExport.at)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      {view === "wizard" ? wizard : overview}

      {/* ---- Auto-fill dialog --------------------------------------------------- */}
      <Dialog open={autofillOpen} onOpenChange={(o) => setAutofillOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="size-5 text-primary" /> Auto-fill from Municipal Records
            </DialogTitle>
            <DialogDescription>
              Pre-fill this {detail.builder.title} with the official figures the MDRRMO already has on file for Barangay{" "}
              {bareBarangayName(detail.barangay.name)} — you only answer what the records cannot provide.
            </DialogDescription>
          </DialogHeader>

          {autofillLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading municipal records…
            </div>
          ) : autofillError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{autofillError}</div>
          ) : autofillData ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p>
                  <span className="text-lg font-bold tabular-nums">{autofillData.filledCount}</span>{" "}
                  <span className="text-muted-foreground">field{autofillData.filledCount === 1 ? "" : "s"} can be filled from municipal records.</span>
                </p>
                <ul className="mt-2 space-y-1.5">
                  {autofillData.sources.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-[13px] font-medium">How should the records be applied?</legend>
                <RadioGroup value={autofillMode} onValueChange={(v) => setAutofillMode(v === "overwrite" ? "overwrite" : "empty")} className="gap-2">
                  <Label
                    htmlFor="af-mode-empty"
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-background p-2.5 text-[13px] font-normal transition-colors hover:bg-muted/60 has-[button[data-state=checked]]:border-primary/60 has-[button[data-state=checked]]:bg-primary/5"
                  >
                    <RadioGroupItem id="af-mode-empty" value="empty" />
                    <span>
                      Fill only empty fields <span className="text-muted-foreground">(recommended)</span>
                    </span>
                  </Label>
                  <Label
                    htmlFor="af-mode-overwrite"
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-background p-2.5 text-[13px] font-normal transition-colors hover:bg-muted/60 has-[button[data-state=checked]]:border-primary/60 has-[button[data-state=checked]]:bg-primary/5"
                  >
                    <RadioGroupItem id="af-mode-overwrite" value="overwrite" />
                    <span>Overwrite existing answers with municipal records</span>
                  </Label>
                </RadioGroup>
              </fieldset>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAutofillOpen(false)}>
              Cancel
            </Button>
            <Button
              className={accent.button}
              disabled={!autofillData || autofillData.filledCount === 0}
              onClick={applyAutofill}
            >
              <Wand2 className="size-4" /> Apply to plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Pre-submit review checklist --------------------------------------- */}
      <Dialog
        open={reviewOpen}
        onOpenChange={(o) => {
          setReviewOpen(o);
          if (!o) setReviewAck(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="size-5 text-primary" /> Review &amp; submit
            </DialogTitle>
            <DialogDescription>
              Final check before sending the {detail.year} {detail.builder.title} to the MDRRMO.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-3">
            <ProgressRing value={localProgress} size={84} strokeWidth={8} arcClass="stroke-gov-blue">
              <span className="text-lg font-bold tabular-nums">{localProgress}%</span>
            </ProgressRing>
            <div className="min-w-0 text-sm">
              <p className="font-semibold">
                {doneCount} of {sections.length} sections completed
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {filledFields} of {totalFields} fields filled · {lastSavedLabel === "—" ? "not saved yet" : `last saved ${lastSavedLabel}`}
              </p>
            </div>
          </div>

          {firstIncomplete >= 0 ? (
            <div>
              <p className="text-[13px] font-medium">
                Incomplete sections{" "}
                <span className="font-normal text-muted-foreground">
                  ({sections.length - doneCount} remaining — tap to jump)
                </span>
              </p>
              <ul className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border">
                {sections.map((s, i) => (done[i] ? null : (
                  <li key={s.code} className="border-b last:border-0">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/60"
                      onClick={() => {
                        setReviewOpen(false);
                        setReviewAck(false);
                        enterWizard(i);
                      }}
                    >
                      <span className="w-14 shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
                        Section {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{s.title}</span>
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                )))}
              </ul>
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              All sections are complete — the plan is ready for MDRRMO review.
            </p>
          )}

          <Label
            htmlFor="review-ack"
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-[13px] font-normal transition-colors hover:bg-muted/60 has-[button[data-state=checked]]:border-primary/60 has-[button[data-state=checked]]:bg-primary/5"
          >
            <Checkbox
              id="review-ack"
              checked={reviewAck}
              onCheckedChange={(c) => setReviewAck(c === true)}
              className="mt-0.5"
            />
            <span>
              I have reviewed the plan and confirm it is ready for MDRRMO review. The plan becomes read-only while it awaits
              approval.
            </span>
          </Label>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Keep editing
            </Button>
            <Button
              className={accent.button}
              disabled={!reviewAck || actionBusy}
              onClick={() => {
                setReviewOpen(false);
                setSubmitOpen(true);
              }}
            >
              <Send className="size-4" /> Continue to submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Submit confirm ------------------------------------------------------ */}
      <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit {detail.builder.title} to the MDRRMO?</AlertDialogTitle>
            <AlertDialogDescription>
              The MDRRMO will be notified and will review your {detail.year} plan ({localProgress}% complete). The plan
              becomes read-only while it awaits approval — you can withdraw it at any time before the review to keep
              editing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className={accent.button} onClick={() => void handleSubmit()}>
              <Send className="size-4" /> Submit for approval
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- Withdraw confirm ------------------------------------------------------ */}
      <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Your {detail.builder.title} will be pulled back from the MDRRMO approval queue and return to draft so you
              can keep editing. You can submit it again anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleWithdraw()}>
              <Undo2 className="size-4" /> Withdraw plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset confirm */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all plan data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently clears every answer you have entered for the {detail.builder.title}. The section structure stays available, but your data cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleReset()}
            >
              Yes, reset data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Field renderer
// ---------------------------------------------------------------------------

const GOLD_FOCUS = "focus-visible:border-gov-gold-dark focus-visible:ring-gov-gold/50";

function PlanField({
  field,
  values,
  onChange,
  accent,
  disabled = false,
}: {
  field: PlanFieldDef;
  values: Record<string, unknown>;
  onChange: (key: string, v: unknown) => void;
  accent: string;
  disabled?: boolean;
}) {
  const id = `plan-${field.key}`;
  const label = (
    <Label htmlFor={id} className="text-[13px] leading-snug font-semibold">
      {field.labelEn}
      {field.required && <span className="ml-0.5 text-destructive">*</span>}
      {field.unit && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">({field.unit})</span>}
    </Label>
  );
  const help = field.helpEn ? (
    <p id={`${id}-help`} className="mt-1 text-[11px] leading-snug text-muted-foreground">{field.helpEn}</p>
  ) : null;

  const widthCls = field.width === "half" ? "sm:col-span-1" : field.width === "third" ? "sm:col-span-1" : "sm:col-span-2";

  return (
    <div className={cn("col-span-1 space-y-1.5", widthCls)}>
      {field.type !== "checkbox" && field.type !== "radio" && field.type !== "table" && label}

      {field.type === "text" && (
        <>
          <Input
            id={id}
            value={typeof values[field.key] === "string" ? (values[field.key] as string) : ""}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={cn("bg-background", GOLD_FOCUS)}
          />
          {help}
        </>
      )}

      {field.type === "number" && (
        <>
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            value={values[field.key] === null || values[field.key] === undefined ? "" : String(values[field.key])}
            placeholder={field.placeholder ?? "0"}
            disabled={disabled}
            onChange={(e) => onChange(field.key, e.target.value === "" ? null : Number(e.target.value))}
            className={cn("bg-background tabular-nums", GOLD_FOCUS)}
          />
          {help}
        </>
      )}

      {field.type === "textarea" && (
        <>
          <Textarea
            id={id}
            value={typeof values[field.key] === "string" ? (values[field.key] as string) : ""}
            placeholder={field.placeholder}
            rows={3}
            disabled={disabled}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={cn("bg-background", GOLD_FOCUS)}
          />
          {help}
        </>
      )}

      {field.type === "select" && (
        <>
          <Select
            value={typeof values[field.key] === "string" ? (values[field.key] as string) : ""}
            onValueChange={(v) => onChange(field.key, v)}
            disabled={disabled}
          >
            <SelectTrigger id={id} className={cn("bg-background", GOLD_FOCUS)}>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {help}
        </>
      )}

      {field.type === "radio" && (
        <div className="space-y-1.5">
          {label}
          <RadioGroup
            value={typeof values[field.key] === "string" ? (values[field.key] as string) : ""}
            onValueChange={(v) => onChange(field.key, v)}
            disabled={disabled}
            className="grid gap-1.5"
          >
            {(field.options ?? []).map((o) => (
              <Label
                key={o}
                htmlFor={`${id}-${o}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border bg-background p-2.5 text-[13px] font-normal transition-colors",
                  disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-muted/60",
                  "has-[button[data-state=checked]]:border-gov-blue/60 has-[button[data-state=checked]]:bg-gov-blue/[0.05]"
                )}
              >
                <RadioGroupItem id={`${id}-${o}`} value={o} />
                {o}
              </Label>
            ))}
          </RadioGroup>
          {help}
        </div>
      )}

      {field.type === "checkbox" && (
        <fieldset className="space-y-1.5">
          <legend className="text-[13px] leading-snug font-semibold">
            {field.labelEn}
            {field.required && <span className="ml-0.5 text-destructive">*</span>}
          </legend>
          <div className={cn("grid gap-1.5 sm:grid-cols-2", disabled && "opacity-70")}>
            {(field.options ?? []).map((o) => {
              const list = Array.isArray(values[field.key]) ? (values[field.key] as string[]) : [];
              const checked = list.includes(o);
              return (
                <Label
                  key={o}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border bg-background p-2.5 text-[13px] font-normal leading-snug transition-colors",
                    disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-muted/60",
                    "has-[button[data-state=checked]]:border-gov-blue/60 has-[button[data-state=checked]]:bg-gov-blue/[0.05]"
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(c) => {
                      const next = c ? [...list, o] : list.filter((x) => x !== o);
                      onChange(field.key, next);
                    }}
                    className="mt-0.5"
                    aria-label={o}
                  />
                  {o}
                </Label>
              );
            })}
          </div>
          {help}
        </fieldset>
      )}

      {field.type === "table" && (
        <PlanTableField field={field} values={values} onChange={onChange} accent={accent} disabled={disabled} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dynamic table field (PPAs, evacuation centers, population by purok, …)
// ---------------------------------------------------------------------------

function PlanTableField({
  field,
  values,
  onChange,
  accent,
  disabled = false,
}: {
  field: PlanFieldDef;
  values: Record<string, unknown>;
  onChange: (key: string, v: unknown) => void;
  accent: string;
  disabled?: boolean;
}) {
  const cols = field.columns ?? [];
  const rows: Array<Record<string, string | number | null>> = Array.isArray(values[field.key])
    ? (values[field.key] as Array<Record<string, string | number | null>>)
    : [];
  const emptyRow = useMemo(() => {
    const r: Record<string, string | number | null> = {};
    for (const c of cols) r[c.key] = c.type === "number" ? null : "";
    return r;
  }, [cols]);

  const minRows = field.minRows ?? 0;
  // Show at least minRows rows (blank rows included)
  const displayRows = rows.length < minRows ? [...rows, ...Array(minRows - rows.length).fill(emptyRow)] : rows;
  const hasData = rows.length > 0;

  function updateRow(idx: number, colKey: string, val: string | number | null) {
    if (disabled) return;
    const base = hasData ? [...rows] : [];
    while (base.length <= idx) base.push({ ...emptyRow });
    base[idx] = { ...base[idx], [colKey]: val };
    onChange(field.key, base);
  }

  function addRow() {
    if (disabled) return;
    const base = hasData ? [...rows] : [];
    base.push({ ...emptyRow });
    onChange(field.key, base);
  }

  function removeRow(idx: number) {
    if (disabled) return;
    const base = hasData ? [...rows] : [];
    base.splice(idx, 1);
    onChange(field.key, base);
  }

  function moveRow(idx: number, dir: -1 | 1) {
    if (disabled) return;
    const target = idx + dir;
    if (target < 0 || target >= rows.length) return;
    const base = [...rows];
    [base[idx], base[target]] = [base[target], base[idx]];
    onChange(field.key, base);
  }

  const ac = accentOf(accent);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {field.type === "table" && (
          <p className="text-[13px] leading-snug font-semibold">
            {field.labelEn}
            {field.required && <span className="ml-0.5 text-destructive">*</span>}
            {disabled && <span className="ml-2 text-[11px] font-normal text-muted-foreground">(read-only)</span>}
          </p>
        )}
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7 text-xs">
            <Plus className="size-3.5" /> Add row
          </Button>
        )}
      </div>
      {field.helpEn && <p className="text-[11px] leading-snug text-muted-foreground">{field.helpEn}</p>}

      {/* Desktop table */}
      <div
        className={cn(
          "hidden overflow-x-auto rounded-lg border md:block",
          disabled && "pointer-events-none opacity-80"
        )}
        aria-disabled={disabled}
      >
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-8 px-1.5 py-2 text-left text-[10px] font-semibold text-muted-foreground">#</th>
              {cols.map((c) => (
                <th key={c.key} className="px-2 py-2 text-left text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {c.labelEn}
                </th>
              ))}
              {!disabled && <th className="w-20 px-1.5 py-2 text-right text-[10px] font-semibold text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-1.5 py-1 text-center text-[10px] tabular-nums text-muted-foreground">{i + 1}</td>
                {cols.map((c) => (
                  <td key={c.key} className="px-1 py-1">
                    {c.type === "select" ? (
                      <Select
                        value={typeof row[c.key] === "string" && row[c.key] !== "" ? (row[c.key] as string) : ""}
                        onValueChange={(v) => updateRow(i, c.key, v)}
                        disabled={disabled}
                      >
                        <SelectTrigger size="sm" className="h-8 border-0 bg-transparent text-xs shadow-none focus:ring-0">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {(c.options ?? []).map((o) => (
                            <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={row[c.key] === null || row[c.key] === undefined ? "" : String(row[c.key])}
                        type={c.type === "number" ? "number" : "text"}
                        inputMode={c.type === "number" ? "decimal" : undefined}
                        placeholder={c.placeholder ?? ""}
                        disabled={disabled}
                        onChange={(e) => updateRow(i, c.key, c.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
                        className="h-8 border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-1"
                      />
                    )}
                  </td>
                ))}
                {!disabled && (
                  <td className="whitespace-nowrap px-1 py-1 text-right">
                    <div className="inline-flex items-center gap-0.5">
                      {rows.length > 1 && (
                        <>
                          <button type="button" aria-label={`Move row ${i + 1} up`} disabled={i === 0} onClick={() => moveRow(i, -1)} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30">
                            <ChevronLeft className="size-3.5" />
                          </button>
                          <button type="button" aria-label={`Move row ${i + 1} down`} disabled={i >= rows.length - 1} onClick={() => moveRow(i, 1)} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30">
                            <ChevronRight className="size-3.5" />
                          </button>
                        </>
                      )}
                      <button type="button" aria-label={`Remove row ${i + 1}`} onClick={() => removeRow(i)} className="rounded p-1 text-destructive/70 hover:bg-destructive/10 hover:text-destructive">
                        ×
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {displayRows.length === 0 && (
              <tr>
                <td colSpan={cols.length + 2} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No rows yet — click “Add row” to begin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className={cn("space-y-2 md:hidden", disabled && "pointer-events-none opacity-80")} aria-disabled={disabled}>
        {displayRows.map((row, i) => (
          <div key={i} className={cn("rounded-lg border p-3", i < rows.length ? "bg-background" : "bg-muted/20")}>
            <div className="mb-2 flex items-center justify-between">
              <Badge variant="outline" className={cn("text-[10px]", ac.chip)}>Row {i + 1}</Badge>
              {!disabled && (
                <div className="flex gap-0.5">
                  {rows.length > 1 && (
                    <>
                      <button type="button" aria-label={`Move row ${i + 1} up`} disabled={i === 0} onClick={() => moveRow(i, -1)} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30">
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <button type="button" aria-label={`Move row ${i + 1} down`} disabled={i >= rows.length - 1} onClick={() => moveRow(i, 1)} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30">
                        <ChevronRight className="size-3.5" />
                      </button>
                    </>
                  )}
                  <button type="button" aria-label={`Remove row ${i + 1}`} onClick={() => removeRow(i)} className="rounded px-2 text-destructive/70 hover:bg-destructive/10">Remove</button>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              {cols.map((c) => (
                <div key={c.key} className="space-y-1">
                  <Label className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{c.labelEn}</Label>
                  {c.type === "select" ? (
                    <Select
                      value={typeof row[c.key] === "string" && row[c.key] !== "" ? (row[c.key] as string) : ""}
                      onValueChange={(v) => updateRow(i, c.key, v)}
                      disabled={disabled}
                    >
                      <SelectTrigger size="sm" className="h-9 bg-background text-xs">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {(c.options ?? []).map((o) => (
                          <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={row[c.key] === null || row[c.key] === undefined ? "" : String(row[c.key])}
                      type={c.type === "number" ? "number" : "text"}
                      inputMode={c.type === "number" ? "decimal" : undefined}
                      placeholder={c.placeholder ?? ""}
                      disabled={disabled}
                      onChange={(e) => updateRow(i, c.key, c.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
                      className="h-9 bg-background text-xs"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-full">
            <Plus className="size-4" /> Add row
          </Button>
        )}
      </div>
    </div>
  );
}
