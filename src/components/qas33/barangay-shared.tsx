"use client";

// QAS33 Barangay Portal — shared components & helpers (client only)

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  FileCheck,
  FileText,
  Gauge,
  Info,
  Landmark,
  Megaphone,
  MessageSquare,
  Network,
  Paperclip,
  Send,
  Tent,
  Users,
  Wallet,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUS_META, type SubmissionStatus } from "@/lib/qas33/types";
import { EmptyState as UIKitEmptyState } from "./ui-kit";

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const EDITABLE_STATUSES: SubmissionStatus[] = [
  "NOT_STARTED",
  "DRAFT",
  "READY_FOR_SUBMISSION",
  "NEEDS_REVISION",
];

export function isEditableStatus(status: SubmissionStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function isLockedForReview(status: SubmissionStatus): boolean {
  return status === "SUBMITTED" || status === "RESUBMITTED" || status === "UNDER_REVIEW";
}

export function isFinalized(status: SubmissionStatus): boolean {
  return ["APPROVED", "FINALIZING", "READY_FOR_DOWNLOAD", "DOWNLOADED", "ARCHIVED"].includes(status);
}

export function StatusBadge({
  status,
  lang,
  className,
}: {
  status: SubmissionStatus;
  lang?: string | null;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.NOT_STARTED;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        meta.badge,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
      {lang === "TL" ? meta.labelTl : meta.label}
    </span>
  );
}

const STATUS_HINTS: Record<SubmissionStatus, { en: string; tl: string }> = {
  NOT_STARTED: {
    en: "Select a template and start filling out your BDRRMP.",
    tl: "Pumili ng template at simulan ang pagpuno ng inyong BDRRMP.",
  },
  DRAFT: {
    en: "Your BDRRMP is in progress. Complete all required sections.",
    tl: "May progreso na ang inyong BDRRMP. Buuin ang lahat ng kinakailangang seksyon.",
  },
  READY_FOR_SUBMISSION: {
    en: "All references complete — review, validate and submit.",
    tl: "Kumpleto na ang mga kailangan — suriin at isumite na.",
  },
  SUBMITTED: {
    en: "Submitted to the MDRRMO. Waiting for the review to begin.",
    tl: "Naisumite na sa MDRRMO. Hinihintay ang pagsisimula ng pagsusuri.",
  },
  UNDER_REVIEW: {
    en: "The MDRRMO is currently reviewing your BDRRMP.",
    tl: "Kasalukuyang sinusuri ng MDRRMO ang inyong BDRRMP.",
  },
  NEEDS_REVISION: {
    en: "The MDRRMO requested revisions. Update the flagged sections and resubmit.",
    tl: "Humingi ng pagbabago ang MDRRMO. Ayusin ang mga na-flag na seksyon at isumite muli.",
  },
  RESUBMITTED: {
    en: "Revisions received. Waiting for MDRRMO re-evaluation.",
    tl: "Natanggap ang mga pagbabago. Hinihintay ang muling pagsusuri ng MDRRMO.",
  },
  APPROVED: {
    en: "Approved by the MDRRMO. The final document is being prepared.",
    tl: "Aprubado ng MDRRMO. Inihahanda na ang panghuling dokumento.",
  },
  FINALIZING: {
    en: "Your signed final BDRRMP is being generated.",
    tl: "Binubuo na ang inyong pinirmahang panghuling BDRRMP.",
  },
  READY_FOR_DOWNLOAD: {
    en: "Approved and signed — download your final BDRRMP PDF.",
    tl: "Aprubado at pirmado na — i-download na ang panghuling BDRRMP PDF.",
  },
  DOWNLOADED: {
    en: "Final BDRRMP downloaded. Keep a copy for your records.",
    tl: "Nai-download na ang panghuling BDRRMP. Mag-ingat ng kopya.",
  },
  ARCHIVED: {
    en: "This plan year is archived.",
    tl: "Naka-arsibo na ang planong ito.",
  },
};

export function StatusHint({ status, lang }: { status: SubmissionStatus; lang?: string | null }) {
  const hint = STATUS_HINTS[status] ?? STATUS_HINTS.NOT_STARTED;
  return <p className="text-xs text-muted-foreground">{lang === "TL" ? hint.tl : hint.en}</p>;
}

// ---------------------------------------------------------------------------
// Section icons (server stores icon names)
// ---------------------------------------------------------------------------

const SECTION_ICONS: Record<string, LucideIcon> = {
  gauge: Gauge,
  landmark: Landmark,
  megaphone: Megaphone,
  paperclip: Paperclip,
  sitemap: Network,
  tent: Tent,
  users: Users,
  wallet: Wallet,
  file: FileText,
};

export function SectionIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = SECTION_ICONS[icon] ?? FileText;
  return <Icon className={className} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Reference checklist icons
// ---------------------------------------------------------------------------

export type ReqState = "complete" | "incomplete" | "notstarted";

export function ReqIcon({ state, className }: { state: ReqState; className?: string }) {
  if (state === "complete")
    return <CheckCircle2 className={cn("size-4 shrink-0 text-primary", className)} aria-hidden="true" />;
  if (state === "incomplete")
    return <AlertTriangle className={cn("size-4 shrink-0 text-amber-500", className)} aria-hidden="true" />;
  return <Circle className={cn("size-4 shrink-0 text-muted-foreground/60", className)} aria-hidden="true" />;
}

export function requirementState(r: {
  required: boolean;
  formComplete: boolean;
  uploadComplete: boolean;
  fileCount: number;
}): ReqState {
  if (r.formComplete && r.uploadComplete) return "complete";
  if (!r.required) return "notstarted";
  // Some progress made (partially filled form or files uploaded) → incomplete
  if (r.formComplete || r.fileCount > 0) return "incomplete";
  return "notstarted";
}

// ---------------------------------------------------------------------------
// Notification icons
// ---------------------------------------------------------------------------

export const NOTIF_ICON: Record<string, { icon: LucideIcon; className: string }> = {
  COMMENT: { icon: MessageSquare, className: "text-teal-600 bg-teal-50 border-teal-200" },
  REVISION: { icon: AlertTriangle, className: "text-orange-600 bg-orange-50 border-orange-200" },
  APPROVED: { icon: CheckCircle2, className: "text-primary bg-primary/10 border-primary/30" },
  FINALIZED: { icon: FileCheck, className: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  SUBMITTED: { icon: Send, className: "text-cyan-600 bg-cyan-50 border-cyan-200" },
  SYSTEM: { icon: Info, className: "text-muted-foreground bg-muted border-border" },
};

export function notifIcon(type: string) {
  return NOTIF_ICON[type] ?? NOTIF_ICON.SYSTEM;
}

// ---------------------------------------------------------------------------
// File status badge
// ---------------------------------------------------------------------------

// Tints mirror the ui-kit BADGE_TONE_CLASS vocabulary (thin *-200 borders).
export const FILE_STATUS_META: Record<string, { label: string; className: string }> = {
  PENDING: { label: "For Review", className: "bg-amber-50 text-amber-800 border border-amber-200" },
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-800 border border-emerald-200" },
  NEEDS_REVISION: { label: "Needs Revision", className: "bg-red-50 text-red-800 border border-red-200" },
  MISSING: { label: "Not Uploaded", className: "bg-muted text-muted-foreground border border-border" },
};

export function FileStatusBadge({ status }: { status: string }) {
  const meta = FILE_STATUS_META[status] ?? FILE_STATUS_META.MISSING;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Review action badge (history timeline)
// ---------------------------------------------------------------------------

// Tints mirror the ui-kit BADGE_TONE_CLASS vocabulary (thin *-200 borders).
export const REVIEW_ACTION_META: Record<string, { label: string; className: string }> = {
  START_REVIEW: { label: "Review Started", className: "bg-amber-50 text-amber-800 border border-amber-200" },
  COMMENT: { label: "Comment", className: "bg-teal-50 text-teal-800 border border-teal-200" },
  REVISION_REQUESTED: { label: "Revision Requested", className: "bg-orange-50 text-orange-800 border border-orange-200" },
  RATED: { label: "Rated", className: "bg-lime-50 text-lime-800 border border-lime-200" },
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-800 border border-emerald-200" },
  FINALIZED: { label: "Finalized", className: "bg-green-100 text-green-900 border border-green-300" },
};

export function ReviewActionBadge({ action }: { action: string }) {
  const meta = REVIEW_ACTION_META[action];
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "An unexpected error occurred.";
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Loading / error states
// ---------------------------------------------------------------------------

export function LoadError({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** Delegates to the shared ui-kit EmptyState so the barangay console renders
 *  the exact same "no data" presentation as the rest of QAS33. */
export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return <UIKitEmptyState icon={icon} title={title} description={description} />;
}
