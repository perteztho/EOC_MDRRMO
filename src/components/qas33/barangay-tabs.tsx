"use client";

// QAS33 Barangay Portal — Dashboard tab

import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bell,
  BookOpenCheck,
  CheckCircle2,
  FileBadge2,
  FileUp,
  Globe,
  Info,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Settings2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/qas33/api";
import {
  OFFICIAL_POSITION_META,
  type BarangayOverview,
  type NotificationItem,
  type OfficialItem,
} from "@/lib/qas33/types";
import { EmptyState, notifIcon, ReviewActionBadge, StatusBadge } from "./barangay-shared";
import { SectionCard } from "./ui-kit";

type Translate = (en: string, tl: string) => string;

// Dark-mode companions for the shared notifIcon() chip colors (light-mode
// palettes only) so the notification icon chips keep their tint in dark mode.
const NOTIF_CHIP_DARK: Record<string, string> = {
  COMMENT: "dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
  REVISION: "dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  APPROVED: "dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  FINALIZED: "dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  SUBMITTED: "dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300",
  SYSTEM: "dark:border-border dark:bg-muted dark:text-muted-foreground",
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function DashboardTab({
  overview,
  notifications,
  lang,
  onRefresh,
  onNavigate,
}: {
  overview: BarangayOverview;
  notifications: NotificationItem[];
  lang: string | null;
  onRefresh: () => void;
  /** Jump to another portal tab (e.g. "plans") — wired by the app shell. */
  onNavigate?: (tab: string) => void;
}) {
  const { barangay, officials, submission, counts, latestComments } = overview;
  const t: Translate = (en, tl) => (lang === "TL" ? tl : en);
  // DB names may already carry the prefix ("Barangay III") — strip it so
  // composed strings never read "…Barangay Barangay III".
  const bareName = barangay.name.trim().replace(/^barangay\s+/i, "");
  const unreadFeed = notifications.filter((n) => !n.read).slice(0, 5);
  const recentComments = [...(latestComments ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  const pct = Math.round(submission.progress);
  // Council officials: PB first, then Kagawads (in ballot order), SK, Secretary, Treasurer
  const councilOfficials = [...(officials ?? [])].sort(
    (a, b) => (OFFICIAL_POSITION_META[a.position]?.order ?? 99) - (OFFICIAL_POSITION_META[b.position]?.order ?? 99)
  );

  const quickActions: Array<{ key: string; icon: LucideIcon; title: string; desc: string }> = onNavigate
    ? [
        {
          key: "frontpage",
          icon: Globe,
          title: t("Public Frontpage", "Pampublikong Frontpage"),
          desc: t("Manage your barangay website", "Pamahalaan ang inyong barangay website"),
        },
        {
          key: "plans",
          icon: BookOpenCheck,
          title: t("Continue Plan Builder", "Magpatuloy sa Plan Builder"),
          desc: t("Fill out your BDRRMP & BDP", "Punan ang inyong BDRRMP at BDP"),
        },
        {
          key: "services",
          icon: FileBadge2,
          title: t("Barangay Services", "Mga Serbisyo ng Barangay"),
          desc: t("Certificates & DRRM reports", "Mga sertipiko at ulat na DRRM"),
        },
        {
          key: "files",
          icon: FileUp,
          title: t("Upload Files", "Mag-upload ng File"),
          desc: t("Requirements & supporting documents", "Mga kailangan at karagdagang dokumento"),
        },
        {
          key: "settings",
          icon: Settings2,
          title: t("Settings / Change PIN", "Setting / Palitan ang PIN"),
          desc: t("Frontpage, security & preferences", "Frontpage, seguridad at kagustuhan"),
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Hero — welcome + BDRRMP submission status (gov-blue command surface) */}
      <Card className="relative overflow-hidden border-gov-blue-deep/50 bg-gradient-to-br from-gov-blue-deep via-gov-blue to-gov-blue-800 py-0 shadow-[0_18px_40px_-20px_rgba(4,33,137,0.55)]">
        <span aria-hidden="true" className="console-accent-line absolute inset-x-0 top-0 z-10 h-[3px] opacity-90" />
        <div
          className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-gov-gold/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-blue-300/10 blur-3xl"
          aria-hidden="true"
        />
        <CardContent className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          {/* Greeting + barangay facts */}
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gov-gold">
              <span aria-hidden="true" className="inline-block size-2 rounded-[3px] bg-gov-gold" />
              QAS33 · Barangay Portal
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {t("Welcome, Barangay", "Maligayang pagdating, Barangay")} {bareName}
            </h1>
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
              <div className="min-w-0 border-l-2 border-white/25 pl-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                  {t("Punong Barangay", "Punong Barangay")}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-white sm:text-base">
                  {barangay.captain ?? "—"}
                </p>
              </div>
              <div className="border-l-2 border-white/25 pl-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                  {t("Population", "Populasyon")}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-white sm:text-2xl">
                  {barangay.population != null ? barangay.population.toLocaleString("en-PH") : "—"}
                </p>
              </div>
              <div className="border-l-2 border-white/25 pl-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                  {t("Households", "Mga Sambahayan")}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-white sm:text-2xl">
                  {barangay.households != null ? barangay.households.toLocaleString("en-PH") : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* BDRRMP submission status panel */}
          <div className="flex shrink-0 items-center gap-5 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm sm:p-5">
            <ProgressRing value={submission.progress} label={t("BDRRMP completion", "Pagkakumpleto ng BDRRMP")}>
              <span className="text-lg font-bold tabular-nums text-white">{pct}%</span>
            </ProgressRing>
            <div className="min-w-0 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                {t("BDRRMP Plan", "Planong BDRRMP")}
              </p>
              <div>
                <StatusBadge status={submission.status} lang={lang} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white">
                  CY {submission.year}
                </span>
                <span className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white">
                  v{submission.version}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-white/70">
                {t(
                  `${counts.completedSections} of ${counts.totalSections} sections completed`,
                  `Kumpleto na ang ${counts.completedSections} sa ${counts.totalSections} na seksyon`
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats strip */}
      <Card className="overflow-hidden py-0">
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          <StatCell
            icon={CheckCircle2}
            chipClass="border-primary/25 bg-primary/10 text-primary"
            value={
              <>
                {counts.completedSections}
                <span className="text-sm font-medium text-muted-foreground">/{counts.totalSections}</span>
              </>
            }
            label={t("Sections Completed", "Nakumpletong Seksyon")}
          />
          <StatCell
            icon={Paperclip}
            chipClass="border-teal-300/60 bg-teal-50 text-teal-600 dark:border-teal-800/60 dark:bg-teal-950/40 dark:text-teal-400"
            value={counts.filesUploaded}
            label={t("Files Uploaded", "Nai-upload na mga File")}
          />
          <StatCell
            icon={Bell}
            chipClass={
              counts.unreadNotifications > 0
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-border bg-muted text-muted-foreground"
            }
            value={counts.unreadNotifications}
            valueClass={counts.unreadNotifications > 0 ? "text-primary" : undefined}
            label={t("Unread Notifications", "Hindi Pa Nabasang Abiso")}
          />
          <StatCell
            icon={MessageSquare}
            chipClass={
              counts.openRevisionComments > 0
                ? "border-amber-300/70 bg-amber-50 text-amber-600 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-400"
                : "border-border bg-muted text-muted-foreground"
            }
            value={counts.openRevisionComments}
            valueClass={counts.openRevisionComments > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
            label={t("Open Revision Comments", "Bukas na Komento sa Pagwawasto")}
          />
        </div>
      </Card>

      {/* Quick actions */}
      {quickActions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Quick Actions", "Mabilis na Aksyon")}
            </h2>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map(({ key, icon: Icon, title, desc }) => (
              <button
                key={key}
                type="button"
                onClick={() => onNavigate?.(key)}
                className="group flex items-center gap-3.5 rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-tight font-semibold">{title}</span>
                  <span className="mt-1 block text-xs leading-snug text-muted-foreground line-clamp-2">{desc}</span>
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sangguniang Barangay / Barangay Council */}
        <SectionCard
          icon={Users}
          title={t("Barangay Council", "Sangguniang Barangay")}
          description={t(
            `Sangguniang Barangay officials of Barangay ${bareName}`,
            `Mga opisyal ng Sangguniang Barangay ng Barangay ${bareName}`
          )}
        >
          {councilOfficials.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t("No council officials on record", "Walang naitalang opisyal")}
              description={t(
                "Council officials will appear here once encoded by the MDRRMO.",
                "Lalabas dito ang mga opisyal kapag na-encode ng MDRRMO."
              )}
            />
          ) : (
            <ul className="console-scroll max-h-96 space-y-2 overflow-y-auto pr-1">
              {councilOfficials.map((o: OfficialItem) => {
                const isPb = o.position === "PUNONG_BARANGAY";
                return (
                  <li
                    key={o.id}
                    className={cn(
                      "rounded-lg border p-3",
                      isPb && "border-primary/40 bg-primary/5 dark:border-primary/50 dark:bg-primary/10"
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p className={cn("text-sm leading-tight", isPb ? "font-semibold" : "font-medium")}>
                        {o.name}
                      </p>
                      <p className="text-[11px] leading-tight whitespace-nowrap text-muted-foreground">
                        {OFFICIAL_POSITION_META[o.position]?.label ?? o.position.replace(/_/g, " ")}
                      </p>
                    </div>
                    {o.committee && <p className="mt-1 text-xs text-muted-foreground">{o.committee}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        {/* Notifications preview */}
        <SectionCard
          title={t("Notifications", "Mga Abiso")}
          actions={
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Refresh notifications"
              onClick={onRefresh}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
            </Button>
          }
        >
          {unreadFeed.length === 0 ? (
            <EmptyState
              icon={Info}
              title={t("No unread notifications", "Walang babasahing abiso")}
              description={t(
                "Updates from the MDRRMO will appear here.",
                "Lalabas dito ang mga update mula sa MDRRMO."
              )}
            />
          ) : (
            <ul className="console-scroll max-h-96 space-y-2 overflow-y-auto pr-1">
              {unreadFeed.map((n) => {
                const meta = notifIcon(n.type);
                const Icon = meta.icon;
                return (
                  <li key={n.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                        meta.className,
                        NOTIF_CHIP_DARK[n.type] ?? NOTIF_CHIP_DARK.SYSTEM
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug font-medium">{n.title}</p>
                      {n.body && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1.5 text-[11px] text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Latest MDRRMO feedback */}
      {recentComments.length > 0 && (
        <SectionCard
          icon={MessageSquare}
          title={t("Latest MDRRMO Feedback", "Pinakabagong Komento ng MDRRMO")}
          description={t(
            "Recent review notes from the MDRRMO on your BDRRMP.",
            "Pinakabagong mga pahayag ng MDRRMO sa inyong BDRRMP."
          )}
        >
          <ul className="space-y-2.5">
            {recentComments.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-teal-200/70 bg-teal-50/50 p-3 dark:border-teal-900/60 dark:bg-teal-950/30"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-semibold">{c.reviewerName}</p>
                  <ReviewActionBadge action={c.reviewAction} />
                  <span className="ml-auto text-[11px] whitespace-nowrap text-muted-foreground">
                    {formatDateTime(c.createdAt)}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{c.comment}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local building blocks
// ---------------------------------------------------------------------------

/** One cell of the dashboard stats strip (divider hairlines via gap-px grid). */
function StatCell({
  icon: Icon,
  chipClass,
  value,
  valueClass,
  label,
}: {
  icon: LucideIcon;
  chipClass: string;
  value: ReactNode;
  valueClass?: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-card p-4 sm:p-5">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg border", chipClass)}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className={cn("text-2xl leading-none font-bold tabular-nums", valueClass)}>{value}</p>
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** Circular progress ring shown on the hero banner (white-on-emerald). */
function ProgressRing({
  value,
  label,
  size = 88,
  strokeWidth = 8,
  children,
}: {
  value: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
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
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} className="stroke-white/20" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="stroke-white transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  );
}
