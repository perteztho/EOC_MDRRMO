"use client";

// MDRRMO Console — BDRRM Command Dashboard.
// "Modern Philippine Government Emergency & Resilience Platform" layout:
// PageHeader → OperationalStatusBanner → KPI grid (console-card KpiCards from
// the shared ui-kit) → two-column command row (Submission Pipeline Overview +
// Weather AWS / Evacuation Snapshot) → quick actions → recent activity.
//
// Data honesty: every figure comes from real API fields — adminOverview()
// ({ stats, year, recentActivity }), the public weather endpoints and the
// public evacuation registry. No fabricated time series, so no sparklines.
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CloudRain,
  CloudSun,
  Droplets,
  FileCheck2,
  Gauge,
  LayoutDashboard,
  Loader2,
  Newspaper,
  RefreshCw,
  TentTree,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, formatDateTime } from "@/lib/qas33/api";
import type { PublicEvacResponse } from "@/lib/qas33/emergency-types";
import type { AwsWeatherResponse, ForecastResponse } from "@/lib/qas33/portal-types";
import { STATUS_META, SUBMISSION_STATUSES, type AuditEntry, type SubmissionStatus } from "@/lib/qas33/types";
import { cn } from "@/lib/utils";
import { ForecastMini } from "@/components/portal/portal-weather";
import { ActorBadge, useLoad } from "./mdrrmo-shared";
import {
  BADGE_DOT_CLASS,
  EmptyState,
  KpiCard,
  OperationalStatusBanner,
  PageHeader,
  SectionCard,
  StatTile,
  ToneBadge,
  type BadgeTone,
  type OpStatus,
} from "./ui-kit";

type OverviewData = Awaited<ReturnType<typeof api.adminOverview>>;
type OverviewStats = OverviewData["stats"];

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

/** Uppercase micro-label + hairline used to organize dashboard groups. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</p>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Submission status → ui-kit badge tone (drives the pipeline bar + legend). */
const STATUS_TONE: Record<SubmissionStatus, BadgeTone> = {
  NOT_STARTED: "neutral",
  DRAFT: "neutral",
  READY_FOR_SUBMISSION: "info",
  SUBMITTED: "active",
  UNDER_REVIEW: "pending",
  NEEDS_REVISION: "warning",
  RESUBMITTED: "pending",
  APPROVED: "normal",
  FINALIZING: "active",
  READY_FOR_DOWNLOAD: "resolved",
  DOWNLOADED: "resolved",
  ARCHIVED: "offline",
};

const fmtInt = (n: number): string => n.toLocaleString("en-PH");

const wf1 = (v: number | null | undefined, unit: string): string =>
  v == null || Number.isNaN(Number(v)) ? "—" : `${Number(v).toFixed(1)}${unit}`;
const wfInt = (v: number | null | undefined, unit: string): string =>
  v == null || Number.isNaN(Number(v)) ? "—" : `${Math.round(Number(v))}${unit}`;

interface KpiDef {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  view?: string;
}

/** KPI cards built ONLY from real AdminOverviewStats fields. */
function buildKpis(stats: OverviewStats, year: number): KpiDef[] {
  const approvedCount =
    (stats.counts.APPROVED ?? 0) +
    (stats.counts.FINALIZING ?? 0) +
    (stats.counts.READY_FOR_DOWNLOAD ?? 0) +
    (stats.counts.DOWNLOADED ?? 0) +
    (stats.counts.ARCHIVED ?? 0);
  return [
    {
      key: "barangays",
      icon: Building2,
      label: "Barangays Onboarded",
      value: fmtInt(stats.total),
      sub: `${stats.active} active accounts · SY ${year}`,
      view: "barangays",
    },
    {
      key: "pending",
      icon: ClipboardCheck,
      label: "Awaiting Review",
      value: fmtInt(stats.pendingReviews),
      sub: `${stats.submittedThisMonth} submitted this month`,
      view: "queue",
    },
    {
      key: "approved",
      icon: FileCheck2,
      label: "Approved / Finalized",
      value: fmtInt(approvedCount),
      sub: `${fmtInt(stats.documentsGenerated)} final PDFs · ${fmtInt(stats.totalDownloads)} downloads`,
      view: "plans",
    },
    {
      key: "completion",
      icon: Gauge,
      label: "Completion Rate",
      value: `${stats.completionRate}%`,
      sub: `avg form progress ${stats.avgProgress}%`,
      view: "reports",
    },
  ];
}

/** Hydration-safe PHT date for the header badge (renders after mount). */
function useTodayPHT(): string | null {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    // The update happens inside a timer callback: the server render and the
    // hydration render both see `null`, so markup can never mismatch.
    const t = window.setTimeout(
      () => setToday(new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" }).format(new Date())),
      0
    );
    return () => window.clearTimeout(t);
  }, []);
  return today;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function MdrrmoDashboard({
  refreshKey = 0,
  onNavigate,
  opStatus = "NORMAL",
}: {
  refreshKey?: number;
  onNavigate?: (view: string) => void;
  opStatus?: OpStatus;
}) {
  const { data, loading, error, reload } = useLoad<OverviewData>(() => api.adminOverview(), String(refreshKey));

  // Brief "working" feedback for the header Refresh button (useLoad refetches
  // keep the previous data mounted, so the spin is acknowledged locally and
  // cleared from a timer callback — never directly inside an effect body).
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    reload();
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 700);
  }, [reload]);

  const today = useTodayPHT();

  const headerActions = (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={loading || refreshing}
        className="gap-2"
      >
        {loading || refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        Refresh
      </Button>
      {today ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          <span className="tabular-nums">{today}</span>
        </span>
      ) : null}
    </>
  );

  if (error && !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={LayoutDashboard}
          title="BDRRM Monitoring Center"
          description="Municipality of Pio Duran — MDRRMO · Barangay DRRM Plan Monitoring"
          actions={headerActions}
        />
        <EmptyState
          icon={AlertTriangle}
          title="Dashboard data could not be loaded"
          description={error}
          action={
            <Button type="button" size="sm" onClick={reload}>
              <RefreshCw className="size-4" />
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const stats = data?.stats ?? null;
  const kpis = data ? buildKpis(data.stats, data.year) : null;
  const skeletonKpis: KpiDef[] = [
    { key: "s1", icon: Building2, label: "", value: "" },
    { key: "s2", icon: ClipboardCheck, label: "", value: "" },
    { key: "s3", icon: FileCheck2, label: "", value: "" },
    { key: "s4", icon: Gauge, label: "", value: "" },
  ];

  return (
    <div className="space-y-6">
      {/* Page header — title, description, refresh + date badge */}
      <PageHeader
        icon={LayoutDashboard}
        title="BDRRM Monitoring Center"
        description="Municipality of Pio Duran — MDRRMO · Barangay DRRM Plan Monitoring"
        actions={headerActions}
      />

      {/* Operational status — mirrors the public portal (EMERGENCY in typhoon mode) */}
      <OperationalStatusBanner
        status={opStatus}
        detail={
          stats
            ? `${fmtInt(stats.total)} barangays onboarded · ${fmtInt(stats.pendingReviews)} submissions awaiting review`
            : undefined
        }
      />

      {/* Primary KPIs — every card navigates to its module */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(kpis ?? skeletonKpis).map((kpi) => (
          <KpiCard
            key={kpi.key}
            icon={kpi.icon}
            label={kpi.label}
            value={kpi.value}
            sub={kpi.sub}
            loading={!kpis || undefined}
            onClick={kpis && kpi.view && onNavigate ? () => onNavigate(kpi.view as string) : undefined}
          />
        ))}
      </section>

      {/* Command row — pipeline overview + environmental/evacuation column */}
      <section aria-label="Operations overview" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {stats && data ? (
          <PipelinePanel stats={stats} year={data.year} className="lg:col-span-2" />
        ) : (
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" aria-hidden="true" />
        )}
        <div className="flex min-w-0 flex-col gap-4">
          <WeatherPanel />
          <EvacuationPanel />
        </div>
      </section>

      {/* Quick actions */}
      {onNavigate && stats ? (
        <section aria-label="Quick actions" className="space-y-2.5">
          <SectionLabel>Quick Actions</SectionLabel>
          <div className="flex flex-wrap gap-2.5">
            <Button type="button" variant="outline" className="gap-2 bg-card" onClick={() => onNavigate("queue")}>
              <ClipboardList className="size-4" aria-hidden="true" />
              Review Queue
              {stats.pendingReviews > 0 ? (
                <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[11px] font-bold text-amber-800 tabular-nums dark:bg-amber-950 dark:text-amber-300">
                  {stats.pendingReviews}
                </span>
              ) : null}
            </Button>
            <Button type="button" variant="outline" className="gap-2 bg-card" onClick={() => onNavigate("plans")}>
              <FileCheck2 className="size-4" aria-hidden="true" />
              Plan Approvals
            </Button>
            <Button type="button" variant="outline" className="gap-2 bg-card" onClick={() => onNavigate("evacuation")}>
              <TentTree className="size-4" aria-hidden="true" />
              Evacuation Management
            </Button>
            <Button type="button" variant="outline" className="gap-2 bg-card" onClick={() => onNavigate("news")}>
              <Newspaper className="size-4" aria-hidden="true" />
              News &amp; Broadcast
            </Button>
          </div>
        </section>
      ) : null}

      {/* Recent activity — audit feed from adminOverview */}
      {data ? (
        <SectionCard
          title="Recent Activity"
          description="Latest actions from barangay & admin consoles"
          icon={Activity}
          contentClassName="p-2 sm:p-3"
        >
          {data.recentActivity.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="console-scroll max-h-[24rem] space-y-2 overflow-y-auto pr-1">
              {data.recentActivity.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </SectionCard>
      ) : (
        <Skeleton className="h-48 rounded-2xl" aria-hidden="true" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submission Pipeline Overview (real counts from AdminOverviewStats)
// ---------------------------------------------------------------------------

function PipelinePanel({
  stats,
  year,
  className,
}: {
  stats: OverviewStats;
  year: number;
  className?: string;
}) {
  const distribution = SUBMISSION_STATUSES.map((status) => ({ status, count: stats.counts[status] ?? 0 })).filter(
    (r) => r.count > 0
  );
  const total = Math.max(1, stats.total);
  return (
    <SectionCard
      title="Submission Pipeline Overview"
      description={`BDRRMP ${year} · ${fmtInt(stats.total)} barangays${
        stats.avgRating != null ? ` · avg QAT rating ${stats.avgRating}/${stats.ratingMaxTotal || 100}` : ""
      }`}
      icon={BarChart3}
      contentClassName="space-y-4"
      className={className}
    >
      {distribution.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No plan submissions yet"
          description="Submission statuses will appear here once barangays begin their BDRRM plans."
        />
      ) : (
        <>
          {/* Stacked status distribution bar (ToneBadge-colored segments) */}
          <div>
            <div
              className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Submission status distribution across ${fmtInt(stats.total)} barangays`}
            >
              {distribution.map(({ status, count }) => (
                <span
                  key={status}
                  title={`${STATUS_META[status].label}: ${count}`}
                  className={cn("h-full min-w-1 rounded-full", BADGE_DOT_CLASS[STATUS_TONE[status]])}
                  style={{ width: `${Math.max(1, Math.round((count / total) * 100))}%` }}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {fmtInt(stats.pendingReviews)} submissions awaiting MDRRMO action · {fmtInt(stats.submittedThisMonth)} new
              this month
            </p>
          </div>
          {/* Legend with real counts + share */}
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {distribution.map(({ status, count }) => (
              <li
                key={status}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5"
              >
                <ToneBadge tone={STATUS_TONE[status]}>{STATUS_META[status].label}</ToneBadge>
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {fmtInt(count)} · {Math.round((count / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Weather · Pio Duran AWS — same public endpoints the portal uses
// (plain same-origin fetch, no auth; auto-refresh every 10 minutes).
// ---------------------------------------------------------------------------

function useLiveWeather() {
  const [weather, setWeather] = useState<AwsWeatherResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/public/weather", { cache: "no-store" }).then((r) =>
        r.ok ? (r.json() as Promise<AwsWeatherResponse>) : Promise.reject(new Error(`Weather service returned HTTP ${r.status}.`))
      ),
      fetch("/api/public/weather/forecast", { cache: "no-store" }).then((r) =>
        r.ok ? (r.json() as Promise<ForecastResponse>) : Promise.reject(new Error(`Forecast service returned HTTP ${r.status}.`))
      ),
    ])
      .then(([w, f]) => {
        if (!alive) return;
        setWeather(w);
        setForecast(f);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Unable to load live weather.");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  // Auto-refresh every 10 minutes (state updates only inside callbacks).
  useEffect(() => {
    const t = setInterval(() => setNonce((n) => n + 1), 10 * 60_000);
    return () => clearInterval(t);
  }, []);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { weather, forecast, loading, error, reload };
}

function WeatherChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-sky-200/70 bg-sky-50/60 px-2.5 py-2 dark:border-sky-900/60 dark:bg-sky-950/40">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function WeatherPanel() {
  const { weather, forecast, loading, error, reload } = useLiveWeather();
  return (
    <SectionCard
      title="Weather · Pio Duran AWS"
      description="Auto-refreshes every 10 minutes"
      icon={CloudSun}
      contentClassName="space-y-3"
      actions={
        <button
          type="button"
          onClick={reload}
          aria-label="Refresh live weather"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </button>
      }
    >
      {error && !weather ? (
        <EmptyState
          icon={CloudSun}
          title="Weather service unavailable"
          description={error}
          action={
            <Button type="button" size="sm" variant="outline" onClick={reload}>
              Retry
            </Button>
          }
          className="py-6"
        />
      ) : loading && !weather ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-10 w-36" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        </div>
      ) : weather && !weather.available ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <CloudSun className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{weather.message || "Live weather is temporarily unavailable."}</p>
        </div>
      ) : weather && weather.data ? (
        <>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="text-3xl leading-none font-extrabold tracking-tight text-foreground tabular-nums">
              {wf1(weather.data.temperature, "°C")}
            </p>
            <div className="pb-0.5">
              <p className="text-sm font-semibold">{weather.data.condition ?? "Current conditions"}</p>
              <p className="text-xs text-muted-foreground">Feels like {wf1(weather.data.feelsLike, "°C")}</p>
            </div>
            {weather.stale ? (
              <ToneBadge tone="pending" className="mb-1 ml-auto">
                Stale
              </ToneBadge>
            ) : (
              <ToneBadge tone="normal" className="mb-1 ml-auto">
                Live
              </ToneBadge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <WeatherChip
              icon={<Droplets className="size-4" aria-hidden="true" />}
              label="Humidity"
              value={wfInt(weather.data.humidity, "%")}
            />
            <WeatherChip
              icon={<Wind className="size-4" aria-hidden="true" />}
              label="Wind"
              value={
                weather.data.windSpeed != null
                  ? `${wfInt(weather.data.windSpeed, " km/h")}${weather.data.windDir ? ` ${weather.data.windDir}` : ""}`
                  : "—"
              }
            />
            <WeatherChip
              icon={<CloudRain className="size-4" aria-hidden="true" />}
              label="Rain today"
              value={wf1(weather.data.rainfall, " mm")}
            />
            <WeatherChip
              icon={<Gauge className="size-4" aria-hidden="true" />}
              label="Pressure"
              value={wfInt(weather.data.pressure, " hPa")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Observed {formatDateTime(weather.observedAt)} ·{" "}
            <span className="font-medium text-foreground">{weather.source}</span>
          </p>
          <div className="border-t border-border/70 pt-3">
            <p className="mb-2 text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              3-Day Outlook
            </p>
            <ForecastMini forecast={forecast} days={3} />
            {forecast && forecast.available ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Forecast: {forecast.source} — verify critical decisions with PAGASA advisories.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Evacuation Snapshot — live figures from GET /api/public/evacuation
// (the same public registry the portal renders; only real EvacDashboardStats
// fields are used).
// ---------------------------------------------------------------------------

function useEvacuationSnapshot() {
  const [data, setData] = useState<PublicEvacResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/public/evacuation", { cache: "no-store" })
      .then((r) =>
        r.ok
          ? (r.json() as Promise<PublicEvacResponse>)
          : Promise.reject(new Error(`Evacuation service returned HTTP ${r.status}.`))
      )
      .then((res) => {
        if (!alive) return;
        setData(res);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Unable to load evacuation data.");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

function EvacuationPanel() {
  const { data, loading, error, reload } = useEvacuationSnapshot();
  const stats = data?.stats ?? null;
  return (
    <SectionCard
      title="Evacuation Snapshot"
      description="Live from the public evacuation registry"
      icon={TentTree}
      contentClassName="space-y-3"
      actions={
        <button
          type="button"
          onClick={reload}
          aria-label="Refresh evacuation snapshot"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </button>
      }
    >
      {loading && !stats ? (
        <div className="grid grid-cols-2 gap-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[4.4rem]" />
          ))}
        </div>
      ) : error && !stats ? (
        <EmptyState
          icon={TentTree}
          title="Evacuation data unavailable"
          description={error}
          action={
            <Button type="button" size="sm" variant="outline" onClick={reload}>
              Retry
            </Button>
          }
          className="py-6"
        />
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Evacuation Centers" value={fmtInt(stats.totalCenters)} sub={`${stats.openCenters} open`} />
            <StatTile label="Total Capacity" value={fmtInt(stats.totalCapacity)} sub="rated persons" />
            <StatTile
              label="Current Occupants"
              value={fmtInt(stats.currentEvacuees)}
              sub={`${stats.updatedToday} updated today`}
            />
            <StatTile
              label="Available Slots"
              value={fmtInt(stats.availableSpaces)}
              sub={`${stats.occupancyPct}% occupied`}
              tone={stats.occupancyPct >= 90 ? "critical" : stats.occupancyPct >= 70 ? "warning" : "normal"}
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              <span>System-wide occupancy</span>
              <span className="tabular-nums">{stats.occupancyPct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  stats.occupancyPct >= 90 ? "bg-red-500" : stats.occupancyPct >= 70 ? "bg-orange-500" : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(100, Math.max(0, stats.occupancyPct))}%` }}
              />
            </div>
          </div>
        </>
      ) : null}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Recent activity (audit feed — real entries from adminOverview)
// ---------------------------------------------------------------------------

function ActivityRow({ entry }: { entry: AuditEntry }) {
  return (
    <li className="rounded-lg border bg-card p-3 transition-colors hover:border-primary/30">
      <div className="flex flex-wrap items-center gap-2">
        <ActorBadge type={entry.actorType} />
        <span className="text-sm font-medium leading-snug">{entry.actorName}</span>
        <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {entry.action}
        </code>
        {entry.barangay && <span className="text-xs text-muted-foreground">· {entry.barangay}</span>}
        <span className="ml-auto pl-3 text-[11px] whitespace-nowrap tabular-nums text-muted-foreground">
          {formatDateTime(entry.createdAt)}
        </span>
      </div>
      {entry.detail && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{entry.detail}</p>}
    </li>
  );
}
