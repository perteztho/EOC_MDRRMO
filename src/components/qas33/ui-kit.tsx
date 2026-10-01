"use client";

// QAS33 — shared premium UI kit ("Modern Philippine Government Emergency &
// Resilience Platform" design system). Used by the MDRRMO console, the
// barangay console and module screens so every screen belongs to the same
// visual language:
//   • deep government blue #042189 (primary) · emergency gold #fccf03 accent
//   • large-radius cards (16px), thin borders, soft layered shadows
//   • operational status tiers: NORMAL / ALERT / HEIGHTENED / EMERGENCY
//     (color is NEVER the only signal — every tier carries a label + icon)
//
// Data honesty: components render exactly what callers pass — no fabricated
// numbers. Loading states use skeletons; empty states use EmptyState.

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Minus,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Operational status tiers (command-center states)
// ---------------------------------------------------------------------------

export type OpStatus = "NORMAL" | "ALERT" | "HEIGHTENED" | "EMERGENCY";

export const OP_STATUS_META: Record<
  OpStatus,
  {
    label: string;
    blurb: string;
    /** pill: tinted background + strong text + border */
    pill: string;
    dot: string;
    Icon: LucideIcon;
    /** subtle top-band treatment for the app shell while this status is active */
    band: string;
  }
> = {
  NORMAL: {
    label: "NORMAL OPERATIONS",
    blurb: "All systems monitoring normally.",
    pill: "bg-op-normal-bg text-op-normal border border-op-normal-border",
    dot: "bg-op-normal",
    Icon: ShieldCheck,
    band: "",
  },
  ALERT: {
    label: "ALERT",
    blurb: "Active advisories — heightened monitoring.",
    pill: "bg-op-alert-bg text-op-alert border border-op-alert-border",
    dot: "bg-op-alert",
    Icon: AlertTriangle,
    band: "",
  },
  HEIGHTENED: {
    label: "HEIGHTENED ALERT",
    blurb: "Elevated risk — response teams on standby.",
    pill: "bg-op-heightened-bg text-op-heightened border border-op-heightened-border",
    dot: "bg-op-heightened",
    Icon: ShieldAlert,
    band: "",
  },
  EMERGENCY: {
    label: "EMERGENCY OPERATIONS",
    blurb: "Emergency operations center is active.",
    pill: "bg-op-emergency-bg text-op-emergency border border-op-emergency-border",
    dot: "bg-op-emergency",
    Icon: ShieldAlert,
    band: "console-emergency-band",
  },
};

export function OperationalStatusPill({
  status,
  className,
  size = "md",
}: {
  status: OpStatus;
  className?: string;
  size?: "sm" | "md";
}) {
  const meta = OP_STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold tracking-wide whitespace-nowrap",
        meta.pill,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot, status !== "NORMAL" && "portal-status-dot")} />
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Full-width operational banner. `detail` lines come from real data only. */
export function OperationalStatusBanner({
  status,
  detail,
  action,
  className,
}: {
  status: OpStatus;
  detail?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const meta = OP_STATUS_META[status];
  const Icon = meta.Icon;
  const emergency = status === "EMERGENCY";
  return (
    <section
      aria-label={`Operational status: ${meta.label}`}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3",
        emergency
          ? "border-red-300 bg-gradient-to-r from-[#5c1010] via-[#8f1616] to-[#a31414] text-white shadow-[0_10px_30px_-14px_rgba(127,29,29,0.7)]"
          : meta.pill,
        className
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-xl",
          emergency ? "bg-white/15 text-white" : cn(meta.pill, "border-0")
        )}
      >
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className={cn("text-sm font-extrabold tracking-wide", emergency && "text-white")}>
          {meta.label}
        </p>
        {detail ? (
          <p className={cn("text-xs", emergency ? "text-red-100" : "opacity-90")}>{detail}</p>
        ) : null}
      </div>
      {action ? <div className="ml-auto flex items-center gap-2">{action}</div> : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Generic tone badge (status vocabulary across tables/cards)
// ---------------------------------------------------------------------------

export type BadgeTone =
  | "normal"
  | "active"
  | "pending"
  | "warning"
  | "critical"
  | "resolved"
  | "offline"
  | "info"
  | "neutral";

export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  normal: "bg-emerald-50 text-emerald-800 border-emerald-200",
  active: "bg-blue-50 text-blue-800 border-blue-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  warning: "bg-orange-50 text-orange-800 border-orange-200",
  critical: "bg-red-50 text-red-800 border-red-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  offline: "bg-slate-100 text-slate-600 border-slate-200",
  info: "bg-cyan-50 text-cyan-800 border-cyan-200",
  neutral: "bg-slate-50 text-slate-700 border-slate-200",
};

export const BADGE_DOT_CLASS: Record<BadgeTone, string> = {
  normal: "bg-emerald-600",
  active: "bg-blue-600",
  pending: "bg-amber-500",
  warning: "bg-orange-500",
  critical: "bg-red-600",
  resolved: "bg-emerald-500",
  offline: "bg-slate-400",
  info: "bg-cyan-600",
  neutral: "bg-slate-400",
};

export function ToneBadge({
  tone = "neutral",
  children,
  dot = true,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        BADGE_TONE_CLASS[tone],
        className
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", BADGE_DOT_CLASS[tone])} /> : null}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// KPI card — large number, label, icon, status, trend, optional sparkline
// ---------------------------------------------------------------------------

export interface KpiTrend {
  dir: "up" | "down" | "flat";
  label: string;
  /** semantic tone of the trend — e.g. rising incidents is bad (warning) */
  tone?: BadgeTone;
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  tone = "neutral",
  footer,
  loading,
  onClick,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  trend?: KpiTrend;
  tone?: BadgeTone;
  footer?: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const clickable = typeof onClick === "function";
  return (
    <div
      className={cn(
        "console-card console-card-hover group relative overflow-hidden p-4",
        clickable && "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className
      )}
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      aria-label={clickable ? `${label} — view details` : undefined}
    >
      {/* gradient accent edge */}
      <span
        aria-hidden="true"
        className="console-accent-line absolute inset-x-0 top-0 h-[3px] opacity-70"
      />
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary ring-1 ring-primary/12">
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        {trend ? <TrendChip trend={trend} /> : null}
      </div>
      <div className="mt-3">
        {loading ? (
          <>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="mt-2 h-3.5 w-28" />
          </>
        ) : (
          <>
            <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              {label}
            </p>
            <p className="mt-0.5 text-[1.65rem] leading-tight font-extrabold tracking-tight text-foreground tabular-nums">
              {value}
            </p>
            {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
          </>
        )}
      </div>
      {footer ? <div className="mt-3 border-t border-border/70 pt-2.5">{footer}</div> : null}
      {clickable ? (
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          View details <ArrowRight className="size-3" aria-hidden="true" />
        </span>
      ) : null}
    </div>
  );
}

function TrendChip({ trend }: { trend: KpiTrend }) {
  const tone = trend.tone ?? "neutral";
  const Icon = trend.dir === "up" ? ArrowUpRight : trend.dir === "down" ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold",
        BADGE_TONE_CLASS[tone]
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {trend.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page header + section card
// ---------------------------------------------------------------------------

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_rgba(4,33,137,0.55)]">
              <Icon className="size-5" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  contentClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("console-card overflow-hidden", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon ? (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold tracking-tight text-foreground">{title}</h2>
              {description ? (
                <p className="truncate text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-4", contentClassName)}>{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stat tile — compact figure used inside dashboards/footers
// ---------------------------------------------------------------------------

export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border/80 bg-background/60 px-3 py-2.5", className)}>
      <p className="text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase">{label}</p>
      <p className={cn("mt-0.5 text-lg leading-snug font-extrabold tabular-nums", toneClassForText(tone))}>
        {value}
      </p>
      {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function toneClassForText(tone: BadgeTone): string {
  switch (tone) {
    case "normal":
    case "resolved":
      return "text-emerald-700";
    case "critical":
      return "text-red-700";
    case "warning":
      return "text-orange-700";
    case "pending":
      return "text-amber-700";
    case "info":
      return "text-cyan-700";
    case "active":
      return "text-blue-700";
    default:
      return "text-foreground";
  }
}

// ---------------------------------------------------------------------------
// MiniSparkline — tiny inline SVG trend (no chart library, no layout shift)
// ---------------------------------------------------------------------------

export function MiniSparkline({
  data,
  className,
  stroke = "#042189",
  height = 28,
  width = 96,
  label,
}: {
  data: number[];
  className?: string;
  stroke?: string;
  height?: number;
  width?: number;
  /** accessible description of what the sparkline shows */
  label: string;
}) {
  const path = useMemo(() => {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    const pts = data.map((v, i) => {
      const x = i * stepX;
      const y = height - 3 - ((v - min) / range) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { line: `M ${pts.join(" L ")}`, area: `M 0,${height} L ${pts.join(" L ")} L ${width},${height} Z` };
  }, [data, height, width]);

  if (!path) return null;
  const gid = `spark-${stroke.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill={`url(#${gid})`} />
      <path d={path.line} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// EmptyState — consistent "no data" presentation
// ---------------------------------------------------------------------------

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center",
        className
      )}
    >
      {Icon ? (
        <span className="flex size-10 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LiveClock — PHT (Asia/Manila) clock + date for command-center headers
// ---------------------------------------------------------------------------

const phtDateFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const phtTimeFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

export function LiveClock({ className, showSeconds = true }: { className?: string; showSeconds?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    // Defer the first tick to the next frame (keeps SSR/CSR markup identical)
    const raf = requestAnimationFrame(tick);
    const t = setInterval(tick, showSeconds ? 1000 : 15000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(t);
    };
  }, [showSeconds]);

  if (!now) {
    // Render a stable placeholder on the server/first paint to avoid hydration mismatch
    return (
      <div className={cn("text-right leading-tight", className)} aria-hidden="true">
        <div className="h-4 w-20" />
        <div className="h-3 w-32" />
      </div>
    );
  }
  return (
    <div className={cn("text-right leading-tight", className)}>
      <p className="text-sm font-extrabold text-foreground tabular-nums">
        {showSeconds ? phtTimeFmt.format(now) : phtTimeFmt.format(now).replace(/:\d\d /, " ")}
      </p>
      <p className="text-[11px] font-medium text-muted-foreground">
        {phtDateFmt.format(now)} <span className="text-muted-foreground/70">· PHT</span>
      </p>
    </div>
  );
}
