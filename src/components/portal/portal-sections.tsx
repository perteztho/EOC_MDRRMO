"use client";

// QAS33 Public Portal — section renderer: maps every section template to its
// component, driven entirely by the admin-published configuration + live
// public content.

import * as React from "react";
import { ExternalLink, Loader2, MapPin, Pin, Search, ShieldCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { portalApiPublic } from "@/lib/qas33/portal-api";
import type { PublicEvacResponse, PushStatusDTO } from "@/lib/qas33/emergency-types";
import type {
  AlertSettings,
  AnnouncementDTO,
  AwsWeatherResponse,
  CustomWidgetBlock,
  ForecastResponse,
  GeneralSettings,
  HotlineDTO,
  HomepageResponse,
  PortalContentResponse,
  PreparednessDTO,
  PublicSection,
  PublicWidget,
  TickerDTO,
  WidgetCardStyle,
  WidgetTheme,
} from "@/lib/qas33/portal-types";
import { INCIDENT_TYPE_LABELS } from "@/lib/qas33/portal-types";
import {
  CATEGORY_STYLES,
  EmptyState,
  LinkAction,
  LEVEL_STYLES,
  PHASE_STYLES,
  PortalIcon,
  PRIORITY_STYLES,
  STATUS_STYLES,
  SectionShell,
  TINT_STYLES,
  formatDateTimePH,
  gridColsClass,
  isDarkSection,
  levelStyle,
  telHref,
  timeAgo,
  type PortalLinkCtx,
} from "./portal-shared";
import { BroadcastTicker } from "./portal-ticker";
import { HeroSection } from "./portal-hero";
import { ForecastMini, ForecastSection, WeatherOutlookSection } from "./portal-weather";
import { EvacuationLiveSection, EvacuationMapSectionBody } from "./portal-evac-sections";
import { SatelliteMapSectionBody } from "./portal-satellite-map";
import { NewsSectionBody } from "./portal-news-section";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Renderer context
// ---------------------------------------------------------------------------

export type PortalDevice = "mobile" | "tablet" | "desktop";

export interface SectionRendererProps {
  section: PublicSection;
  data: HomepageResponse;
  content: PortalContentResponse | null;
  weather: AwsWeatherResponse | null;
  forecast: ForecastResponse | null;
  /** LIVE evacuation data — powers the evacuation + evacuationMap templates
   *  and the full-screen finder. Undefined/null → legacy fallbacks. */
  evacuation?: PublicEvacResponse | null;
  /** Opens the full-screen evacuation finder. */
  onOpenEvac?: () => void;
  /** Web-push status (news + evacuation push cards). */
  pushStatus?: PushStatusDTO | null;
  alertSettings?: AlertSettings | null;
  linkCtx: PortalLinkCtx;
  device: PortalDevice;
  refreshWeather?: () => void;
  refreshForecast?: () => void;
  onOpenModal: (modal: "hotlines" | "report") => void;
  /** True inside the admin preview — forms intercept submit instead of POSTing. */
  preview?: boolean;
}

export function SectionRenderer(props: SectionRendererProps) {
  const { section, data, content, device } = props;
  const cfg = section.config;

  // Client-side device visibility (server already filtered mode/schedule/status)
  if (device === "mobile" && !cfg.visibleMobile) return null;
  if (device === "desktop" && !cfg.visibleDesktop) return null;
  if (device === "tablet" && !cfg.visibleTablet) return null;

  switch (section.template) {
    case "hero":
      return (
        <HeroSection
          section={section}
          mode={data.mode}
          emergency={data.visualMode === "emergency"}
          operational={data.operational}
          stats={content?.stats ?? null}
          alerts={content?.alerts ?? []}
          alertSettings={props.alertSettings ?? data.alert ?? null}
          onOpenModal={props.onOpenModal}
          onOpenEvac={props.onOpenEvac}
          linkCtx={props.linkCtx}
        />
      );
    case "alertBanner":
      return <AlertBannerSection {...props} />;
    case "weather":
      return (
        <SectionShell section={section} linkCtx={props.linkCtx}>
          <WeatherOutlookSection
            weather={props.weather}
            forecast={props.forecast}
            onRetryWeather={props.refreshWeather}
            onRetryForecast={props.refreshForecast}
          />
        </SectionShell>
      );
    case "forecast":
      return (
        <SectionShell section={section} linkCtx={props.linkCtx}>
          <ForecastSection forecast={props.forecast} onRetry={props.refreshForecast} />
        </SectionShell>
      );
    case "announcements":
      return <AnnouncementsSection {...props} />;
    case "ticker":
      return (
        <SectionShell section={section} linkCtx={props.linkCtx} hideHeader>
          <BroadcastTicker messages={content?.ticker ?? []} emergency={data.visualMode === "emergency"} />
        </SectionShell>
      );
    case "hotlines":
      return <HotlinesSection {...props} />;
    case "quickActions":
      return <QuickActionsSection {...props} />;
    case "dashboard":
      return <DashboardSection {...props} />;
    case "evacuation":
      return <EvacuationSection {...props} />;
    case "evacuationMap":
      return <EvacuationMapSection {...props} />;
    case "satelliteMap":
      return (
        <SectionShell section={section} linkCtx={props.linkCtx}>
          <SatelliteMapSectionBody evacuation={props.evacuation} />
        </SectionShell>
      );
    case "preparedness":
      return <PreparednessSection {...props} />;
    case "hazard":
      return <HazardSection {...props} />;
    case "news":
      return (
        <SectionShell section={section} linkCtx={props.linkCtx}>
          <NewsSectionBody pushStatus={props.pushStatus} />
        </SectionShell>
      );
    case "stats":
      return <StatsSection {...props} />;
    case "links":
      return <LinksSection {...props} />;
    case "residentSignup":
      return <ResidentSignupSection {...props} />;
    case "custom":
      return <CustomSection {...props} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// alertBanner
// ---------------------------------------------------------------------------

function AlertBannerSection({ section, content, data, linkCtx }: SectionRendererProps) {
  const alerts = content?.alerts ?? [];
  const emergency = data.visualMode === "emergency";

  return (
    <SectionShell section={section} linkCtx={linkCtx} hideHeader>
      {alerts.length === 0 && !emergency ? (
        <div className="flex items-center justify-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
          No active alerts — hazard monitoring continues 24/7.
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex items-center justify-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
          No specific alerts published — monitor this portal and official advisories.
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {alerts.slice(0, 4).map((alert) => {
              const style = levelStyle(LEVEL_STYLES, alert.level);
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "rounded-2xl border-l-4 portal-glass p-5 transition-shadow hover:shadow-md",
                    style.border
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-emergency-red">
                      <TriangleAlert aria-hidden="true" className="size-4" />
                    </span>
                    <Badge variant="outline" className={cn("text-[10px] font-bold tracking-wider", style.badge)}>
                      {style.label.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-slate-400">{timeAgo(alert.createdAt)}</span>
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-900">{alert.title}</h3>
                  <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-slate-600">{alert.message}</p>
                  {alert.linkUrl ? (
                    <a
                      href={alert.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gov-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                    >
                      More information
                      <ExternalLink aria-hidden="true" className="size-3" />
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
          {alerts.length > 4 ? (
            <p className="mt-3 text-center text-xs text-slate-500">
              + {alerts.length - 4} more active alert{alerts.length - 4 > 1 ? "s" : ""} — monitor official advisories.
            </p>
          ) : null}
        </div>
      )}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// quickActions
// ---------------------------------------------------------------------------

function QuickActionsSection({ section, linkCtx, data }: SectionRendererProps) {
  const items = section.config.items ?? [];
  if (items.length === 0) return null;
  const emergency = data.visualMode === "emergency";
  const grid = gridColsClass(section.config.columns.mobile, section.config.columns.tablet, section.config.columns.desktop);

  return (
    <SectionShell section={section} linkCtx={linkCtx}>
      <div className={cn(grid, "gap-4 sm:gap-5")}>
        {items.map((item, idx) => {
          const tint = TINT_STYLES[item.color || "blue"] || TINT_STYLES.blue;
          const isReport = item.link?.kind === "modal" && item.link?.modal === "report";
          const isHotline = item.link?.kind === "modal" && item.link?.modal === "hotlines";
          const urgentTint = emergency && (isReport || isHotline);
          return (
            <LinkAction
              key={`${item.label}-${idx}`}
              link={item.link}
              ctx={linkCtx}
              className={cn(
                "group flex min-h-32 w-full flex-col items-start gap-3 rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2",
                urgentTint ? "border border-red-200 bg-red-50/60 shadow-sm" : "portal-glass"
              )}
            >
              <span
                className={cn(
                  "flex size-12 items-center justify-center rounded-xl transition-colors",
                  urgentTint ? "bg-emergency-red/10 text-emergency-red" : tint.circle
                )}
              >
                <PortalIcon name={item.icon} className="size-6" />
              </span>
              <span>
                <span className="block font-bold text-slate-900 group-hover:text-gov-blue">{item.label}</span>
                {item.description ? (
                  <span className="mt-1 block text-sm leading-snug text-slate-500">{item.description}</span>
                ) : null}
              </span>
            </LinkAction>
          );
        })}
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// announcements
// ---------------------------------------------------------------------------

function AnnouncementCard({ a, dark }: { a: AnnouncementDTO; dark?: boolean }) {
  const cat = CATEGORY_STYLES[a.category] || { label: a.category, badge: "border-slate-200 bg-slate-50 text-slate-700" };
  const prio = levelStyle(PRIORITY_STYLES, a.priority);
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-md",
        dark ? "border border-white/15 bg-white/10 text-white shadow-sm" : "portal-glass",
        a.featured && "border-l-4 border-l-gov-gold ring-1 ring-gov-gold/30"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("text-[10px] font-semibold", dark ? "border-white/20 bg-white/10 text-slate-200" : cat.badge)}>
          {cat.label}
        </Badge>
        {a.priority === "CRITICAL" || a.priority === "HIGH" ? (
          <Badge variant="outline" className={cn("text-[10px] font-bold", prio.badge)}>
            {prio.label}
          </Badge>
        ) : null}
        {a.pinned ? (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gov-gold-dark">
            <Pin aria-hidden="true" className="size-3" />
            Pinned
          </span>
        ) : null}
      </div>
      <h3
        className={cn(
          "mt-3 font-semibold leading-snug",
          dark ? "text-white" : "text-slate-900"
        )}
      >
        {a.title}
      </h3>
      <p className={cn("mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed", dark ? "text-slate-200/85" : "text-slate-600")}>
        {a.content}
      </p>
      <div className={cn("mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3 text-xs", dark ? "border-white/10 text-slate-300" : "border-slate-100 text-slate-500")}>
        <span className="flex items-center gap-1.5">
          <PortalIcon name="calendar" className="size-3.5" />
          {formatDateTimePH(a.publishAt)}
        </span>
        {a.areas ? (
          <span className="flex items-center gap-1.5">
            <MapPin aria-hidden="true" className="size-3.5" />
            {a.areas}
          </span>
        ) : null}
        {a.linkUrl ? (
          <a
            href={a.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 font-semibold text-gov-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
          >
            Learn more
            <PortalIcon name="arrow-right" className="size-3.5" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function AnnouncementsSection({ section, content, linkCtx }: SectionRendererProps) {
  const dark = isDarkSection(section.config.bgStyle);
  const all = content?.announcements ?? [];
  const [expanded, setExpanded] = React.useState(false);
  const grid = gridColsClass(section.config.columns.mobile, section.config.columns.tablet, section.config.columns.desktop);
  const visible = expanded ? all : all.slice(0, 6);

  if (!content) {
    return (
      <SectionShell section={section} linkCtx={linkCtx}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell section={section} linkCtx={linkCtx}>
      {all.length === 0 ? (
        <EmptyState
          icon="megaphone"
          title="No announcements yet"
          message="Official announcements from the MDRRMO will be published here."
        />
      ) : (
        <>
          <div className={cn(grid, "gap-5")}>
            {visible.map((a) => (
              <AnnouncementCard key={a.id} a={a} dark={dark} />
            ))}
          </div>
          {all.length > 6 ? (
            <div className="mt-8 text-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExpanded((e) => !e)}
                className="h-11 gap-2 border-slate-300 px-6 font-semibold text-gov-blue hover:border-gov-blue hover:bg-gov-blue-50"
                aria-expanded={expanded}
              >
                {expanded ? "Show fewer announcements" : `View all announcements (${all.length})`}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// hotlines (section template)
// ---------------------------------------------------------------------------

function HotlinesSection({ section, content, linkCtx }: SectionRendererProps) {
  const hotlines = content?.hotlines ?? [];
  const dark = isDarkSection(section.config.bgStyle);
  const grid = gridColsClass(section.config.columns.mobile, section.config.columns.tablet, section.config.columns.desktop);

  if (!content) {
    return (
      <SectionShell section={section} linkCtx={linkCtx}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell section={section} linkCtx={linkCtx}>
      {hotlines.length === 0 ? (
        <EmptyState icon="phone-call" title="No hotlines published" message="Emergency hotline numbers will appear here once published." />
      ) : (
        <div className={cn(grid, "gap-4 sm:gap-5")}>
          {hotlines.map((h) => (
            <HotlineCard key={h.id} h={h} dark={dark} />
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function HotlineCard({ h, dark }: { h: HotlineDTO; dark?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-md",
        dark ? "border border-white/15 bg-white/10 shadow-sm" : "portal-glass"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            dark ? "bg-white/10 text-gov-gold" : "bg-gov-blue-50 text-gov-blue"
          )}
        >
          <PortalIcon name={h.icon || "phone"} className="size-5" />
        </span>
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-bold", dark ? "text-white" : "text-slate-900")}>{h.agency}</p>
          <p className={cn("truncate text-xs", dark ? "text-slate-300" : "text-slate-500")}>{h.serviceType}</p>
        </div>
      </div>
      <p className={cn("mt-4 text-xl font-extrabold tabular-nums", dark ? "text-white" : "text-gov-blue")}>{h.phone}</p>
      <a
        href={telHref(h.phone)}
        className={cn(
          "mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2",
          dark
            ? "bg-gov-gold text-gov-blue-deep hover:bg-gov-gold-dark"
            : "bg-gov-gold text-gov-blue-deep hover:bg-gov-gold-dark"
        )}
      >
        <PortalIcon name="phone-call" className="size-4" />
        Call Now
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// dashboard
// ---------------------------------------------------------------------------

// Widget theme system (25-c) — accent color + card style applied to ALL
// widgets. Defaults (blue + glass) reproduce the original look exactly.

interface WidgetThemeAccent {
  /** icon chip / small accent surfaces (light styles) */
  chip: string;
  /** strong theme text color (titles, stat values) */
  strong: string;
  /** themed border accent for outline cards */
  border: string;
  /** solid cardStyle background */
  solid: string;
  /** gradient cardStyle background */
  gradient: string;
}

const WIDGET_THEME_ACCENTS: Record<WidgetTheme, WidgetThemeAccent> = {
  blue: {
    chip: "bg-gov-blue-50 text-gov-blue",
    strong: "text-gov-blue-deep",
    border: "border-gov-blue/25",
    solid: "bg-gov-blue text-white",
    gradient: "bg-gradient-to-br from-gov-blue to-gov-blue-700 text-white",
  },
  gold: {
    chip: "bg-gov-gold/20 text-amber-700",
    strong: "text-amber-700",
    border: "border-gov-gold/50",
    solid: "bg-gov-gold text-gov-blue-deep",
    gradient: "bg-gradient-to-br from-gov-gold to-amber-500 text-gov-blue-deep",
  },
  emerald: {
    chip: "bg-emerald-50 text-emerald-700",
    strong: "text-emerald-700",
    border: "border-emerald-200",
    solid: "bg-emerald-600 text-white",
    gradient: "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white",
  },
  red: {
    chip: "bg-red-50 text-red-700",
    strong: "text-red-700",
    border: "border-red-200",
    solid: "bg-red-600 text-white",
    gradient: "bg-gradient-to-br from-red-500 to-red-700 text-white",
  },
  violet: {
    chip: "bg-violet-50 text-violet-700",
    strong: "text-violet-700",
    border: "border-violet-200",
    solid: "bg-violet-600 text-white",
    gradient: "bg-gradient-to-br from-violet-500 to-violet-700 text-white",
  },
  slate: {
    chip: "bg-slate-100 text-slate-700",
    strong: "text-slate-800",
    border: "border-slate-200",
    solid: "bg-slate-600 text-white",
    gradient: "bg-gradient-to-br from-slate-500 to-slate-700 text-white",
  },
  dark: {
    chip: "bg-slate-800 text-white",
    strong: "text-gov-blue-deep",
    border: "border-slate-300",
    solid: "bg-slate-900 text-white",
    gradient: "bg-gradient-to-br from-slate-800 to-black text-white",
  },
};

export interface WidgetThemeClasses {
  /** card container classes (portal-glass / solid / outline / gradient) */
  frame: string;
  /** header icon chip */
  iconChip: string;
  /** title text color */
  title: string;
  /** body text color */
  body: string;
  /** CTA link color */
  cta: string;
  /** solid/gradient styles carry their own dark surface + light text */
  onDark: boolean;
  /** raw accent (chip/strong/border/solid/gradient) for content blocks */
  accent: WidgetThemeAccent;
}

/** Resolve a widget's theme + card style into concrete class fragments. */
export function widgetThemeClasses(
  theme: WidgetTheme | undefined,
  cardStyle: WidgetCardStyle | undefined
): WidgetThemeClasses {
  const accent = WIDGET_THEME_ACCENTS[theme ?? "blue"] ?? WIDGET_THEME_ACCENTS.blue;
  switch (cardStyle ?? "glass") {
    case "solid":
      return {
        frame: cn("border-0 shadow-sm", accent.solid),
        iconChip: "bg-white/15 text-white",
        title: "text-white",
        body: "text-white/90",
        cta: "text-white underline-offset-2 hover:underline",
        onDark: true,
        accent,
      };
    case "gradient":
      return {
        frame: cn("border-0 shadow-md", accent.gradient),
        iconChip: "bg-white/15 text-white",
        title: "text-white",
        body: "text-white/90",
        cta: "text-white underline-offset-2 hover:underline",
        onDark: true,
        accent,
      };
    case "outline":
      return {
        frame: cn("border-2 bg-white shadow-sm", accent.border),
        iconChip: accent.chip,
        title: accent.strong,
        body: "text-slate-600",
        cta: "text-gov-blue underline-offset-2 hover:underline",
        onDark: false,
        accent,
      };
    case "glass":
    default:
      return {
        frame: "portal-glass",
        iconChip: accent.chip,
        title: "text-slate-800",
        body: "text-slate-600",
        cta: "text-gov-blue underline-offset-2 hover:underline",
        onDark: false,
        accent,
      };
  }
}

function WidgetFrame({
  widget,
  children,
  ctx,
  emergency,
}: {
  widget: PublicWidget;
  children: React.ReactNode;
  ctx: PortalLinkCtx;
  emergency?: boolean;
}) {
  const cfg = widget.config;
  const themed = widgetThemeClasses(cfg.theme, cfg.cardStyle);
  // Emergency tint only on light surfaces (solid/gradient carry their own bg).
  const chipCls = emergency && !themed.onDark ? "bg-red-50 text-emergency-red" : themed.iconChip;
  const span =
    cfg.size === "large"
      ? "md:col-span-2 lg:col-span-4"
      : cfg.size === "wide"
      ? "md:col-span-2"
      : "";
  // Tall: quarter-width card spanning two dashboard rows (list-friendly).
  const tall = cfg.size === "tall" ? "lg:row-span-2 lg:min-h-64" : "";
  const cta =
    cfg.ctaLabel && cfg.link ? (
      <LinkAction
        link={cfg.link}
        ctx={ctx}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold",
          themed.cta
        )}
      >
        {cfg.ctaLabel} →
      </LinkAction>
    ) : null;

  return (
    <div className={cn("flex min-h-0 flex-col rounded-2xl p-5", span, tall, themed.frame)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", chipCls)}>
            <PortalIcon name={cfg.icon} className="size-4.5" />
          </span>
          <h3 className={cn("truncate text-sm font-semibold", themed.title)}>{widget.title}</h3>
        </div>
        {cta}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function IncidentLookupForm() {
  const { toast } = useToast();
  const [ref, setRef] = React.useState("");
  const [checking, setChecking] = React.useState(false);
  const [result, setResult] = React.useState<{ status: string; type: string; createdAt: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const check = async () => {
    const v = ref.trim();
    if (!v) {
      setError("Enter your reference number (e.g. PD-INC-2026-00001).");
      return;
    }
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const res = await portalApiPublic.checkIncident(v);
      setResult({ status: res.status, type: res.type, createdAt: res.createdAt });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Reference number not found.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs leading-relaxed text-slate-500">
        Submitted a report? Track its status with your reference number.
      </p>
      <div className="flex gap-2">
        <Input
          value={ref}
          onChange={(e) => {
            setRef(e.target.value);
            setError(null);
          }}
          placeholder="PD-INC-2026-00001"
          aria-label="Incident reference number"
          className="h-10 font-mono text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") void check();
          }}
        />
        <Button
          type="button"
          onClick={() => void check()}
          disabled={checking}
          className="h-10 shrink-0 gap-1.5 bg-gov-blue text-xs font-semibold hover:bg-gov-blue-700"
          aria-label="Check incident report status"
        >
          {checking ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Search aria-hidden="true" className="size-3.5" />}
          Check
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-emergency-red">
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <Badge className="border-transparent bg-emerald-600 text-white">{result.status}</Badge>
          <span className="text-xs font-medium text-emerald-900">
            {INCIDENT_TYPE_LABELS[result.type] || result.type} · filed {timeAgo(result.createdAt)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function WidgetBody({
  widget,
  props,
}: {
  widget: PublicWidget;
  props: SectionRendererProps;
}) {
  const { content, weather, forecast, data } = props;
  const emergency = data.visualMode === "emergency";

  switch (widget.type) {
    case "status":
      return (
        <div className="flex h-full flex-col justify-center gap-2">
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={cn("portal-status-dot size-2.5 rounded-full", emergency ? "bg-red-500" : "bg-emerald-500")}
            />
            <span className="text-base font-bold text-slate-800">
              {emergency ? data.operational.emergencyTitle : data.operational.normalTitle}
            </span>
          </span>
          <p className="text-xs leading-relaxed text-slate-500">
            {emergency ? data.operational.emergencyDescription : data.operational.normalDescription}
          </p>
        </div>
      );

    case "alerts": {
      const alerts = content?.alerts ?? [];
      if (!content)
        return <p className="text-xs text-slate-400">Loading alerts…</p>;
      if (alerts.length === 0)
        return (
          <p className="flex items-center gap-2 text-xs font-medium text-emerald-700">
            <ShieldCheck aria-hidden="true" className="size-4" />
            No active alerts — monitoring continues 24/7.
          </p>
        );
      return (
        <ul className="max-h-40 space-y-2 overflow-y-auto portal-scroll">
          {alerts.slice(0, 3).map((a) => {
            const style = levelStyle(LEVEL_STYLES, a.level);
            return (
              <li key={a.id} className={cn("rounded-lg border-l-2 bg-slate-50/70 px-3 py-2", style.border)}>
                <div className="flex items-center gap-1.5">
                  <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", style.badge)}>{style.label}</span>
                  <span className="text-[10px] text-slate-400">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-xs font-semibold text-slate-800">{a.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{a.message}</p>
              </li>
            );
          })}
        </ul>
      );
    }

    case "weather": {
      if (!weather || !weather.available || !weather.data) {
        return (
          <p className="text-xs leading-relaxed text-slate-500">
            {weather?.message || "Live weather is temporarily unavailable."}
          </p>
        );
      }
      const d = weather.data;
      return (
        <div className="flex h-full flex-col gap-1">
          <p className="text-3xl font-extrabold tabular-nums text-gov-blue-deep">
            {d.temperature != null ? Number(d.temperature).toFixed(1) : "—"}
            <span className="text-lg text-slate-400">°C</span>
          </p>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5">
              <PortalIcon name="droplets" className="size-3 text-gov-blue" />
              {d.humidity != null ? `${Math.round(Number(d.humidity))}% RH` : "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <PortalIcon name="wind" className="size-3 text-gov-blue" />
              {d.windSpeed != null ? `${Math.round(Number(d.windSpeed))} km/h` : "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <PortalIcon name="droplet" className="size-3 text-gov-blue" />
              {d.rainfall != null ? `${Number(d.rainfall).toFixed(1)} mm` : "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <PortalIcon name="gauge" className="size-3 text-gov-blue" />
              {d.pressure != null ? `${Math.round(Number(d.pressure))} hPa` : "—"}
            </span>
          </div>
          <p className="mt-auto pt-1 text-[10px] text-slate-400">
            {weather.stale ? `Last observation ${timeAgo(weather.observedAt)}` : `Observed ${timeAgo(weather.observedAt)}`}
          </p>
        </div>
      );
    }

    case "forecast":
      return <ForecastMini forecast={forecast} days={4} />;

    case "hotlines": {
      const hotlines = (content?.hotlines ?? []).slice(0, 4);
      if (!content) return <p className="text-xs text-slate-400">Loading hotlines…</p>;
      if (hotlines.length === 0) return <p className="text-xs text-slate-500">No hotlines published yet.</p>;
      return (
        <ul className="space-y-1.5">
          {hotlines.map((h) => (
            <li key={h.id}>
              <a
                href={telHref(h.phone)}
                className="flex min-h-9 items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-gov-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
              >
                <span className="truncate text-xs font-medium text-slate-700">{h.agency}</span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-gov-blue">{h.phone}</span>
              </a>
            </li>
          ))}
        </ul>
      );
    }

    case "incidents":
      return <IncidentLookupForm />;

    case "evacuation": {
      const centers = content?.evacuation ?? [];
      if (!content) return <p className="text-xs text-slate-400">Loading evacuation info…</p>;
      if (centers.length === 0)
        return (
          <p className="text-xs leading-relaxed text-slate-500">
            No evacuation centers published. During emergencies, updated information will appear here.
          </p>
        );
      const open = centers.filter((c) => c.status === "OPEN").length;
      const limited = centers.filter((c) => c.status === "LIMITED").length;
      const full = centers.filter((c) => c.status === "FULL").length;
      return (
        <div className="flex h-full flex-col gap-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2">
              <p className="text-lg font-extrabold tabular-nums text-emerald-700">{open}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80">Open</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2">
              <p className="text-lg font-extrabold tabular-nums text-amber-700">{limited}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/80">Limited</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-2 py-2">
              <p className="text-lg font-extrabold tabular-nums text-red-700">{full}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-800/80">Full</p>
            </div>
          </div>
          <ul className="max-h-24 space-y-1 overflow-y-auto portal-scroll">
            {centers.slice(0, 3).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-slate-600">{c.name}</span>
                <Badge variant="outline" className={cn("shrink-0 text-[9px] font-bold", levelStyle(STATUS_STYLES, c.status).badge)}>
                  {c.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    case "announcements": {
      const items = (content?.announcements ?? []).slice(0, 3);
      if (!content) return <p className="text-xs text-slate-400">Loading announcements…</p>;
      if (items.length === 0) return <p className="text-xs text-slate-500">No announcements yet.</p>;
      return (
        <ul className="max-h-40 space-y-2 overflow-y-auto portal-scroll">
          {items.map((a) => (
            <li key={a.id} className="rounded-lg bg-slate-50/70 px-3 py-2">
              <p className="text-xs font-semibold text-slate-800">{a.title}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{formatDateTimePH(a.publishAt)}</p>
            </li>
          ))}
        </ul>
      );
    }

    case "ticker": {
      const msgs: TickerDTO[] = content?.ticker ?? [];
      if (!content) return <p className="text-xs text-slate-400">Loading broadcasts…</p>;
      if (msgs.length === 0) return <p className="text-xs text-slate-500">No broadcast messages.</p>;
      return (
        <ul className="space-y-1.5">
          {msgs.slice(0, 3).map((m) => (
            <li key={m.id} className="flex items-start gap-2 text-xs text-slate-600">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1 size-1.5 shrink-0 rounded-full",
                  m.priority === "EMERGENCY" || m.priority === "CRITICAL"
                    ? "bg-emergency-red"
                    : m.priority === "HIGH"
                    ? "bg-amber-500"
                    : "bg-gov-blue"
                )}
              />
              <span className="line-clamp-2 leading-relaxed">{m.message}</span>
            </li>
          ))}
        </ul>
      );
    }

    case "preparedness": {
      const topics = content?.preparedness ?? [];
      if (!content) return <p className="text-xs text-slate-400">Loading safety tips…</p>;
      if (topics.length === 0) return <p className="text-xs text-slate-500">No preparedness topics yet.</p>;
      return (
        <ul className="max-h-40 space-y-2 overflow-y-auto portal-scroll">
          {topics.slice(0, 3).map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-800">{p.title}</p>
                <p className="text-[10px] text-slate-400">{p.hazard}</p>
              </div>
              <Badge variant="outline" className={cn("shrink-0 text-[9px] font-bold", levelStyle(PHASE_STYLES, p.phase).badge)}>
                {p.phase}
              </Badge>
            </li>
          ))}
        </ul>
      );
    }

    case "hazard": {
      // Uses the hazard section's configured items when available
      const hazardSection = props.data.sections.find((s) => s.template === "hazard");
      const items = hazardSection?.config.items ?? [];
      if (items.length === 0)
        return (
          <p className="text-xs leading-relaxed text-slate-500">
            Typhoon · Flood · Landslide · Storm Surge · Earthquake · Fire — know the hazards in your area.
          </p>
        );
      return (
        <div className="flex flex-wrap gap-1.5">
          {items.slice(0, 6).map((it, i) => (
            <span key={i} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
              {it.label}
            </span>
          ))}
        </div>
      );
    }

    case "contacts": {
      const g: GeneralSettings = data.general;
      const hotlines = (content?.hotlines ?? []).slice(0, 2);
      return (
        <ul className="space-y-2 text-xs">
          <li className="flex items-center justify-between gap-2">
            <span className="truncate text-slate-600">MDRRMO Office</span>
            <a href={telHref(g.contactPhone)} className="shrink-0 font-bold text-gov-blue underline-offset-2 hover:underline">
              {g.contactPhone}
            </a>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="truncate text-slate-600">Email</span>
            <a href={`mailto:${g.contactEmail}`} className="shrink-0 font-medium text-gov-blue underline-offset-2 hover:underline">
              {g.contactEmail}
            </a>
          </li>
          {hotlines.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-slate-600">{h.agency}</span>
              <a href={telHref(h.phone)} className="shrink-0 font-bold text-gov-blue underline-offset-2 hover:underline">
                {h.phone}
              </a>
            </li>
          ))}
        </ul>
      );
    }

    case "quicklinks": {
      const items = widget.config.items ?? [];
      if (items.length === 0) return <p className="text-xs text-slate-500">No quick links configured.</p>;
      return (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={i}>
              <LinkAction
                link={it.link}
                ctx={props.linkCtx}
                className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-gov-blue-50 hover:text-gov-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
              >
                <PortalIcon name={it.icon} className="size-3.5 text-gov-blue" />
                {it.label}
              </LinkAction>
            </li>
          ))}
        </ul>
      );
    }

    case "custom": {
      // Fully admin-configured widget (25-c): body paragraph + content blocks.
      const cfg = widget.config;
      const themed = widgetThemeClasses(cfg.theme, cfg.cardStyle);
      const bodyText = (cfg.bodyText ?? "").trim();
      const blocks: CustomWidgetBlock[] = cfg.blocks ?? [];
      const stats = blocks.filter((b) => b.kind === "stat");
      const rows = blocks.filter((b) => b.kind !== "stat");
      const wide = cfg.size === "wide" || cfg.size === "large";

      if (!bodyText && blocks.length === 0) {
        return themed.onDark ? (
          <p className="text-xs leading-relaxed text-white/85">Customize this widget from the admin widget builder.</p>
        ) : (
          <EmptyState
            icon="layout-template"
            title="Nothing configured yet"
            message="Customize this widget from the admin widget builder."
          />
        );
      }

      return (
        <div className="flex h-full flex-col gap-3">
          {bodyText ? (
            <p className={cn("text-xs leading-relaxed", themed.body)}>{bodyText}</p>
          ) : null}
          {stats.length > 0 ? (
            <div className={cn("grid grid-cols-2 gap-2", wide && "sm:grid-cols-3")}>
              {stats.map((b, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg px-2 py-2 text-center",
                    themed.onDark ? "bg-white/10" : "bg-slate-50/80"
                  )}
                >
                  <p
                    className={cn(
                      "text-lg font-extrabold leading-tight tabular-nums",
                      themed.onDark ? "text-white" : themed.accent.strong
                    )}
                  >
                    {b.value || "—"}
                  </p>
                  {b.label ? (
                    <p
                      className={cn(
                        "mt-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        themed.onDark ? "text-white/75" : "text-slate-500"
                      )}
                    >
                      {b.label}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {rows.length > 0 ? (
            <ul className="space-y-1.5">
              {rows.map((b, i) => {
                if (b.kind === "link") {
                  return (
                    <li key={i}>
                      <LinkAction
                        link={b.link}
                        ctx={props.linkCtx}
                        className={cn(
                          "flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold",
                          themed.onDark
                            ? "text-white hover:bg-white/10"
                            : "text-slate-700 hover:bg-gov-blue-50 hover:text-gov-blue"
                        )}
                      >
                        <PortalIcon
                          name={b.icon || "link"}
                          className={cn("size-3.5 shrink-0", themed.onDark ? "text-gov-gold" : "text-gov-blue")}
                        />
                        {b.label || "Link"}
                      </LinkAction>
                    </li>
                  );
                }
                if (b.kind === "bullet") {
                  return (
                    <li key={i} className={cn("flex items-start gap-2 text-xs", themed.body)}>
                      <PortalIcon
                        name={b.icon || "check"}
                        className={cn("mt-0.5 size-3.5 shrink-0", themed.onDark ? "text-gov-gold" : "text-gov-blue")}
                      />
                      <span className="leading-relaxed">{b.label || b.value}</span>
                    </li>
                  );
                }
                return (
                  <li key={i} className={cn("text-xs leading-relaxed", themed.body)}>
                    {b.value || b.label}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      );
    }

    default:
      return null;
  }
}

function DashboardSection(props: SectionRendererProps) {
  const { data, device, linkCtx } = props;
  const emergency = data.visualMode === "emergency";
  // Server already filtered widgets by enabled + mode; apply device visibility here.
  const widgets = data.widgets.filter((w) => {
    if (device === "mobile") return w.config.visibleMobile !== false;
    return w.config.visibleDesktop !== false;
  });

  return (
    <SectionShell section={props.section} linkCtx={linkCtx}>
      {widgets.length === 0 ? (
        <EmptyState icon="layout-dashboard" title="Dashboard widgets coming soon" message="The MDRRMO is preparing the public dashboard." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:auto-rows-min">
          {widgets.map((w) => (
            <WidgetFrame key={w.id} widget={w} ctx={linkCtx} emergency={emergency && (w.type === "status" || w.type === "alerts")}>
              <WidgetBody widget={w} props={props} />
            </WidgetFrame>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// evacuation — LIVE data from GET /api/public/evacuation when available
// (summary chips + top center cards + announcements + finder CTA), with a
// graceful fallback to the legacy content-directory cards.
// ---------------------------------------------------------------------------

function EvacuationSection(props: SectionRendererProps) {
  const { section, content, linkCtx } = props;
  const live = props.evacuation && props.evacuation.visible ? props.evacuation : null;

  // LIVE view — stats chips, top-6 center cards, announcements, finder CTA.
  if (live) {
    return (
      <SectionShell section={section} linkCtx={linkCtx}>
        <EvacuationLiveSection evacuation={live} onOpenEvac={props.onOpenEvac} pushStatus={props.pushStatus} />
      </SectionShell>
    );
  }

  // FALLBACK — legacy content-directory cards (also used by the admin preview
  // and whenever the live API is unavailable).
  const centers = content?.evacuation ?? [];
  const grid = gridColsClass(section.config.columns.mobile, section.config.columns.tablet, section.config.columns.desktop);

  if (!content) {
    return (
      <SectionShell section={section} linkCtx={linkCtx}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell section={section} linkCtx={linkCtx}>
      {centers.length === 0 ? (
        <EmptyState
          icon="map-pin"
          title="Evacuation center directory is being updated"
          message="Contact the MDRRMO for the latest evacuation information."
        />
      ) : (
        <div className={cn(grid, "gap-4 sm:gap-5")}>
          {centers.map((c) => (
            <article
              key={c.id}
              className="flex h-full flex-col rounded-2xl portal-glass p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-snug text-slate-900">{c.name}</h3>
                <Badge variant="outline" className={cn("shrink-0 text-[10px] font-bold", levelStyle(STATUS_STYLES, c.status).badge)}>
                  {c.status}
                </Badge>
              </div>
              <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-gov-blue-50 px-2.5 py-1 text-[11px] font-semibold text-gov-blue">
                <MapPin aria-hidden="true" className="size-3" />
                Brgy. {c.barangay}
              </span>
              {c.address ? <p className="mt-2 text-sm text-slate-600">{c.address}</p> : null}
              <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                <PortalIcon name="users" className="size-4" />
                {c.capacity != null ? `Capacity: ${c.capacity.toLocaleString("en-PH")} persons` : "Capacity: — persons"}
              </p>
              {c.notes ? <p className="mt-2 text-sm leading-relaxed text-slate-500">{c.notes}</p> : null}
            </article>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// evacuationMap — embedded interactive Leaflet map (live data only)
// ---------------------------------------------------------------------------

function EvacuationMapSection(props: SectionRendererProps) {
  const { section, linkCtx } = props;
  const live = props.evacuation && props.evacuation.visible ? props.evacuation : null;

  return (
    <SectionShell section={section} linkCtx={linkCtx}>
      {live ? (
        <EvacuationMapSectionBody evacuation={live} onOpenEvac={props.onOpenEvac} />
      ) : (
        <EmptyState
          icon="map"
          title="Evacuation map is standing by"
          message={
            props.evacuation
              ? "The MDRRMO has not published evacuation information yet — the map activates automatically during emergencies."
              : "Live evacuation data is unavailable right now. The map activates automatically once the MDRRMO publishes it."
          }
        />
      )}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// preparedness
// ---------------------------------------------------------------------------

const HAZARD_LABELS: Record<string, string> = {
  GENERAL: "General",
  TYPHOON: "Typhoon",
  FLOOD: "Flood",
  LANDSLIDE: "Landslide",
  EARTHQUAKE: "Earthquake",
  STORM_SURGE: "Storm Surge",
  FIRE: "Fire",
};

function PreparednessSection({ section, content, linkCtx }: SectionRendererProps) {
  const topics = content?.preparedness ?? [];
  const [filter, setFilter] = React.useState<string>("ALL");
  const [openTopic, setOpenTopic] = React.useState<PreparednessDTO | null>(null);

  const hazards = React.useMemo(() => {
    const set = new Set(topics.map((t) => t.hazard));
    return Array.from(set);
  }, [topics]);
  const filtered = filter === "ALL" ? topics : topics.filter((t) => t.hazard === filter);
  const grid = gridColsClass(section.config.columns.mobile, section.config.columns.tablet, section.config.columns.desktop);

  if (!content) {
    return (
      <SectionShell section={section} linkCtx={linkCtx}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell section={section} linkCtx={linkCtx}>
      {topics.length === 0 ? (
        <EmptyState icon="hard-hat" title="Preparedness guides coming soon" message="Safety guides will be published here." />
      ) : (
        <>
          {/* Hazard filter chips */}
          <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter safety guides by hazard">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              aria-pressed={filter === "ALL"}
              className={cn(
                "min-h-9 rounded-full border px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold",
                filter === "ALL"
                  ? "border-gov-blue bg-gov-blue text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-gov-blue hover:text-gov-blue"
              )}
            >
              All
            </button>
            {hazards.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setFilter(h)}
                aria-pressed={filter === h}
                className={cn(
                  "min-h-9 rounded-full border px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold",
                  filter === h
                    ? "border-gov-blue bg-gov-blue text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-gov-blue hover:text-gov-blue"
                )}
              >
                {HAZARD_LABELS[h] || h}
              </button>
            ))}
          </div>

          <div className={cn(grid, "gap-4 sm:gap-5")}>
            {filtered.map((p) => {
              const phase = levelStyle(PHASE_STYLES, p.phase);
              return (
                <article
                  key={p.id}
                  className="flex h-full flex-col rounded-2xl portal-glass p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[10px] font-bold", phase.badge)}>
                      {phase.label}
                    </Badge>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {HAZARD_LABELS[p.hazard] || p.hazard}
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-900">{p.title}</h3>
                  <p className="mt-2 line-clamp-4 flex-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">{p.content}</p>
                  <button
                    type="button"
                    onClick={() => setOpenTopic(p)}
                    className="mt-4 inline-flex w-fit items-center gap-1 text-xs font-semibold text-gov-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                  >
                    Read full guide
                    <PortalIcon name="arrow-right" className="size-3.5" />
                  </button>
                </article>
              );
            })}
          </div>

          <Dialog open={!!openTopic} onOpenChange={(o) => !o && setOpenTopic(null)}>
            <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg portal-scroll">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg text-gov-blue-deep">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-gov-blue-50 text-gov-blue">
                    <PortalIcon name={openTopic?.icon || "hard-hat"} className="size-4" />
                  </span>
                  {openTopic?.title}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 pt-1">
                  {openTopic ? (
                    <>
                      <Badge variant="outline" className={cn("text-[10px] font-bold", levelStyle(PHASE_STYLES, openTopic.phase).badge)}>
                        {openTopic.phase}
                      </Badge>
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600">
                        {HAZARD_LABELS[openTopic.hazard] || openTopic.hazard}
                      </Badge>
                    </>
                  ) : null}
                </DialogDescription>
              </DialogHeader>
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{openTopic?.content}</div>
              {openTopic?.linkUrl ? (
                <a
                  href={openTopic.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gov-blue underline-offset-2 hover:underline"
                >
                  More information
                  <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              ) : null}
            </DialogContent>
          </Dialog>
        </>
      )}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// hazard
// ---------------------------------------------------------------------------

function HazardSection({ section, linkCtx }: SectionRendererProps) {
  const items = section.config.items ?? [];
  const dark = isDarkSection(section.config.bgStyle);
  const grid = gridColsClass(section.config.columns.mobile, section.config.columns.tablet, section.config.columns.desktop);
  if (items.length === 0) return null;

  return (
    <SectionShell section={section} linkCtx={linkCtx}>
      <div className={cn(grid, "gap-4 sm:gap-5")}>
        {items.map((item, idx) => {
          const tint = TINT_STYLES[item.color || "blue"] || TINT_STYLES.blue;
          return (
            <div
              key={`${item.label}-${idx}`}
              className={cn(
                "flex h-full flex-col gap-3 rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-md",
                dark ? "border border-white/15 bg-white/10 shadow-sm" : "portal-glass"
              )}
            >
              <span
                className={cn(
                  "flex size-12 items-center justify-center rounded-xl",
                  dark ? "bg-white/10 text-gov-gold" : tint.circle
                )}
              >
                <PortalIcon name={item.icon} className="size-6" />
              </span>
              <div>
                <h3 className={cn("font-semibold", dark ? "text-white" : "text-slate-900")}>{item.label}</h3>
                {item.description ? (
                  <p className={cn("mt-1.5 text-sm leading-relaxed", dark ? "text-slate-200/85" : "text-slate-500")}>
                    {item.description}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// stats
// ---------------------------------------------------------------------------

function StatsSection({ section, content, linkCtx }: SectionRendererProps) {
  const stats = content?.stats ?? null;
  const dark = isDarkSection(section.config.bgStyle);
  const grid = gridColsClass(section.config.columns.mobile, section.config.columns.tablet, section.config.columns.desktop);

  const blocks = stats
    ? [
        { value: String(stats.barangays), label: "Barangays" },
        { value: stats.population.toLocaleString("en-PH"), label: "Residents" },
        { value: stats.households.toLocaleString("en-PH"), label: "Households" },
        { value: String(stats.approvedPlans), label: "Approved BDRRMPs" },
      ]
    : [];

  return (
    <SectionShell section={section} linkCtx={linkCtx}>
      {stats ? (
        <div className={cn(grid, "gap-4 sm:gap-5")}>
          {blocks.map((b) => (
            <div
              key={b.label}
              className={cn(
                "rounded-2xl p-6 text-center",
                dark ? "border border-white/15 bg-white/10 backdrop-blur" : "portal-glass"
              )}
            >
              <p
                className={cn(
                  "text-3xl font-extrabold tabular-nums md:text-4xl",
                  dark ? "text-gov-gold" : "text-gov-blue-deep"
                )}
              >
                {b.value}
              </p>
              <p
                className={cn(
                  "mt-2 text-xs font-semibold uppercase tracking-wider",
                  dark ? "text-slate-200" : "text-slate-600"
                )}
              >
                {b.label}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn(grid, "gap-4 sm:gap-5")} aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn("h-32 animate-pulse rounded-2xl", dark ? "bg-white/10" : "bg-slate-200/70")} />
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// links
// ---------------------------------------------------------------------------

function LinksSection({ section, linkCtx }: SectionRendererProps) {
  const items = section.config.items ?? [];
  const dark = isDarkSection(section.config.bgStyle);
  const grid = gridColsClass(section.config.columns.mobile, section.config.columns.tablet, section.config.columns.desktop);
  if (items.length === 0) return null;

  return (
    <SectionShell section={section} linkCtx={linkCtx}>
      <div className={cn(grid, "gap-4")}>
        {items.map((item, idx) => (
          <LinkAction
            key={`${item.label}-${idx}`}
            link={item.link}
            ctx={linkCtx}
            className={cn(
              "group flex h-full w-full flex-col gap-2.5 rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2",
              dark
                ? "border border-white/15 bg-white/10 shadow-sm hover:border-gov-gold/40"
                : "portal-glass hover:border-gov-blue"
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl",
                  dark ? "bg-white/10 text-gov-gold" : "bg-gov-blue-50 text-gov-blue"
                )}
              >
                <PortalIcon name={item.icon} className="size-5" />
              </span>
              <ExternalLink
                aria-hidden="true"
                className={cn("size-4 shrink-0 transition-colors", dark ? "text-slate-400 group-hover:text-gov-gold" : "text-slate-300 group-hover:text-gov-blue")}
              />
            </span>
            <span>
              <span className={cn("block text-sm font-semibold", dark ? "text-white" : "text-slate-900")}>{item.label}</span>
              {item.description ? (
                <span className={cn("mt-0.5 block text-xs leading-relaxed", dark ? "text-slate-300" : "text-slate-500")}>
                  {item.description}
                </span>
              ) : null}
            </span>
          </LinkAction>
        ))}
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// custom (About / Contact)
// ---------------------------------------------------------------------------

function CustomSection({ section, linkCtx }: SectionRendererProps) {
  const items = section.config.items ?? [];
  const dark = isDarkSection(section.config.bgStyle);
  const grid = gridColsClass(
    Math.min(2, section.config.columns.mobile),
    section.config.columns.tablet,
    section.config.columns.desktop
  );

  return (
    <SectionShell section={section} linkCtx={linkCtx}>
      {section.description ? (
        <p className={cn("max-w-3xl leading-relaxed", dark ? "text-slate-200/85" : "text-slate-600")}>{section.description}</p>
      ) : null}
      {items.length > 0 ? (
        <div className={cn(grid, "mt-8 gap-4 sm:gap-5")}>
          {items.map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className={cn(
                "flex h-full flex-col gap-2.5 rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-md",
                dark ? "border border-white/15 bg-white/10 shadow-sm" : "portal-glass"
              )}
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl",
                  dark ? "bg-white/10 text-gov-gold" : "bg-gov-blue-50 text-gov-blue"
                )}
              >
                <PortalIcon name={item.icon} className="size-5" />
              </span>
              <div>
                <h3 className={cn("text-sm font-bold", dark ? "text-white" : "text-slate-900")}>{item.label}</h3>
                {item.description ? (
                  <p className={cn("mt-1 text-sm leading-relaxed", dark ? "text-slate-200/85" : "text-slate-600")}>
                    {item.description}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// residentSignup (25-b) — public QAS33 resident account registration
// ---------------------------------------------------------------------------

const RESIDENT_SEX_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const CIVIL_STATUS_OPTIONS = ["Single", "Married", "Widowed", "Separated", "Solo Parent"];

const RESIDENT_BENEFITS: Array<{ icon: string; title: string; text: string }> = [
  {
    icon: "file-text",
    title: "Faster barangay certificates",
    text: "Your name, purok and contact details auto-fill clearance, residency and indigency requests — no repeated forms.",
  },
  {
    icon: "life-buoy",
    title: "Evacuation assistance priority",
    text: "Registered households are easier to locate and assist during evacuations and relief operations.",
  },
  {
    icon: "megaphone",
    title: "Incident & advisory updates",
    text: "Receive the latest advisories and follow-up on reports tied to your barangay.",
  },
  {
    icon: "user-check",
    title: "One-time data entry",
    text: "Register once — your profile is reusable for every QAS33 barangay service request.",
  },
];

interface ResidentFormState {
  fullName: string;
  barangayCode: string;
  purok: string;
  address: string;
  sex: string;
  civilStatus: string;
  birthdate: string;
  occupation: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  purpose: string;
}

const EMPTY_RESIDENT_FORM: ResidentFormState = {
  fullName: "",
  barangayCode: "",
  purok: "",
  address: "",
  sex: "",
  civilStatus: "",
  birthdate: "",
  occupation: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
  purpose: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ResidentSignupSection({ section, content, linkCtx, preview }: SectionRendererProps) {
  const { toast } = useToast();
  const barangays = content?.barangays ?? [];
  const dark = isDarkSection(section.config.bgStyle);
  const [form, setForm] = React.useState<ResidentFormState>(EMPTY_RESIDENT_FORM);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState<{ fullName: string; barangay: string } | null>(null);

  const set = (key: keyof ResidentFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (form.fullName.trim().length < 2) next.fullName = "Enter your complete full name.";
    if (!form.barangayCode) next.barangayCode = "Select your barangay.";
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (!email && !phone) {
      next.phone = "Provide a mobile number or an email address.";
      next.email = "Provide a mobile number or an email address.";
    }
    if (email && !EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    if (phone && phone.replace(/\D/g, "").length < 7) next.phone = "Enter a valid mobile number.";
    if (form.password.length < 6) next.password = "At least 6 characters.";
    if (form.confirmPassword !== form.password) next.confirmPassword = "Passwords do not match.";
    if (form.birthdate) {
      const d = new Date(form.birthdate);
      if (Number.isNaN(d.getTime()) || d.getTime() >= Date.now()) next.birthdate = "Birthdate must be in the past.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) {
      toast({
        title: "Preview mode",
        description: "Resident registration is disabled in the admin preview.",
      });
      return;
    }
    if (submitting || !validate()) return;

    const selected = barangays.find((b) => b.code === form.barangayCode);
    const payload: Record<string, string> = {
      fullName: form.fullName.trim(),
      barangayCode: form.barangayCode,
      barangayName: selected?.name ?? "",
      password: form.password,
    };
    const optional: Array<[string, string]> = [
      ["purok", form.purok.trim()],
      ["address", form.address.trim()],
      ["sex", form.sex],
      ["civilStatus", form.civilStatus],
      ["birthdate", form.birthdate],
      ["occupation", form.occupation.trim()],
      ["phone", form.phone.trim()],
      ["email", form.email.trim()],
      ["purpose", form.purpose.trim()],
    ];
    for (const [key, value] of optional) if (value) payload[key] = value;

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/residents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        fullName?: string;
        barangay?: string;
      };
      if (!res.ok || !data.ok) {
        const message = data.error || "Registration could not be completed. Please try again.";
        // Email conflicts come back as 409 — surface them on the email field.
        if (res.status === 409 && /email/i.test(message)) {
          setErrors((prev) => ({ ...prev, email: message }));
        }
        toast({ title: "Registration failed", description: message, variant: "destructive" });
        return;
      }
      setSuccess({ fullName: data.fullName ?? form.fullName.trim(), barangay: data.barangay ?? "" });
      setForm(EMPTY_RESIDENT_FORM);
      setErrors({});
    } catch {
      toast({
        title: "Registration failed",
        description: "You appear to be offline. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const fieldLabel = (htmlFor: string, text: string, required?: boolean, hint?: string) => (
    <Label htmlFor={htmlFor} className="text-xs font-semibold text-foreground">
      {text}
      {required ? <span className="ml-0.5 text-emergency-red">*</span> : null}
      {hint ? <span className="ml-1.5 font-normal text-muted-foreground">({hint})</span> : null}
    </Label>
  );

  const fieldError = (key: string) =>
    errors[key] ? (
      <p role="alert" className="text-xs font-medium text-emergency-red">
        {errors[key]}
      </p>
    ) : null;

  return (
    <SectionShell section={section} linkCtx={linkCtx}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        {/* Benefits — why create a resident account */}
        <aside
          className={cn(
            "h-fit rounded-2xl p-6",
            dark ? "border border-white/15 bg-white/10 shadow-sm" : "portal-glass"
          )}
        >
          <h3 className={cn("text-base font-bold", dark ? "text-white" : "text-gov-blue-deep")}>
            Why create a resident account?
          </h3>
          <ul className="mt-4 space-y-4">
            {RESIDENT_BENEFITS.map((b) => (
              <li key={b.title} className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    dark ? "bg-white/10 text-gov-gold" : "bg-gov-blue-50 text-gov-blue"
                  )}
                >
                  <PortalIcon name={b.icon} className="size-4.5" />
                </span>
                <div>
                  <p className={cn("text-sm font-semibold", dark ? "text-white" : "text-slate-900")}>{b.title}</p>
                  <p className={cn("mt-0.5 text-xs leading-relaxed", dark ? "text-slate-200/85" : "text-slate-600")}>
                    {b.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p
            className={cn(
              "mt-5 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[11px] leading-relaxed",
              dark ? "border-white/15 bg-white/5 text-slate-200" : "border-slate-200 bg-slate-50/80 text-slate-600"
            )}
          >
            <PortalIcon name="shield" className="mt-0.5 size-3.5 shrink-0 text-gov-blue" />
            Your data is protected under RA 10173 (Data Privacy Act of 2012). It is used only for MDRRMO and barangay
            services and is never shared without your consent.
          </p>
        </aside>

        {/* Registration form — theme-token surface so it stays readable in
            normal, typhoon-dark and admin-preview rendering. */}
        <div className="rounded-2xl border bg-card/95 p-5 shadow-sm backdrop-blur sm:p-6">
          {success ? (
            <div className="flex flex-col items-center py-8 text-center" role="status">
              <span className="flex size-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600">
                <PortalIcon name="check" className="size-7" />
              </span>
              <h3 className="mt-4 text-base font-bold text-foreground">
                Resident account created!
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Welcome, <span className="font-semibold text-foreground">{success.fullName}</span>
                {success.barangay ? ` of Brgy. ${success.barangay}` : ""}. You may now request certificates from your
                barangay.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-5 h-11 gap-2 border-slate-300 px-5 text-sm font-semibold text-gov-blue hover:border-gov-blue hover:bg-gov-blue-50"
                onClick={() => setSuccess(null)}
              >
                Register another resident
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  {fieldLabel("rs-fullname", "Full name", true)}
                  <Input
                    id="rs-fullname"
                    value={form.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    placeholder="Juan M. Dela Cruz"
                    autoComplete="name"
                    maxLength={120}
                    aria-invalid={!!errors.fullName}
                  />
                  {fieldError("fullName")}
                </div>

                <div className="space-y-1.5">
                  {fieldLabel("rs-barangay", "Barangay", true)}
                  <Select value={form.barangayCode || "__none"} onValueChange={(v) => set("barangayCode", v === "__none" ? "" : v)}>
                    <SelectTrigger id="rs-barangay" aria-invalid={!!errors.barangayCode}>
                      <SelectValue placeholder="Select your barangay" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="__none">— Select barangay —</SelectItem>
                      {barangays.map((b) => (
                        <SelectItem key={b.code} value={b.code}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldError("barangayCode")}
                </div>

                <div className="space-y-1.5">
                  {fieldLabel("rs-purok", "Purok / Sitio")}
                  <Input
                    id="rs-purok"
                    value={form.purok}
                    onChange={(e) => set("purok", e.target.value)}
                    placeholder="e.g. Purok 3"
                    maxLength={80}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  {fieldLabel("rs-address", "House / Street address")}
                  <Input
                    id="rs-address"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="House no., street, landmark"
                    maxLength={200}
                  />
                </div>

                <div className="space-y-1.5">
                  {fieldLabel("rs-sex", "Sex")}
                  <Select value={form.sex || "__none"} onValueChange={(v) => set("sex", v === "__none" ? "" : v)}>
                    <SelectTrigger id="rs-sex">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Prefer not to say —</SelectItem>
                      {RESIDENT_SEX_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  {fieldLabel("rs-civil", "Civil status")}
                  <Select
                    value={form.civilStatus || "__none"}
                    onValueChange={(v) => set("civilStatus", v === "__none" ? "" : v)}
                  >
                    <SelectTrigger id="rs-civil">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Select —</SelectItem>
                      {CIVIL_STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  {fieldLabel("rs-birthdate", "Birthdate")}
                  <Input
                    id="rs-birthdate"
                    type="date"
                    value={form.birthdate}
                    onChange={(e) => set("birthdate", e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    aria-invalid={!!errors.birthdate}
                  />
                  {fieldError("birthdate")}
                </div>

                <div className="space-y-1.5">
                  {fieldLabel("rs-occupation", "Occupation")}
                  <Input
                    id="rs-occupation"
                    value={form.occupation}
                    onChange={(e) => set("occupation", e.target.value)}
                    placeholder="e.g. Farmer, Teacher"
                    maxLength={80}
                  />
                </div>

                <div className="space-y-1.5">
                  {fieldLabel("rs-phone", "Mobile no.")}
                  <Input
                    id="rs-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="09XX XXX XXXX"
                    autoComplete="tel"
                    maxLength={40}
                    aria-invalid={!!errors.phone}
                  />
                  {fieldError("phone")}
                </div>

                <div className="space-y-1.5">
                  {fieldLabel("rs-email", "Email")}
                  <Input
                    id="rs-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    maxLength={120}
                    aria-invalid={!!errors.email}
                  />
                  {fieldError("email")}
                </div>

                <div className="space-y-1.5">
                  {fieldLabel("rs-password", "Password", true, "min. 6 characters")}
                  <Input
                    id="rs-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    autoComplete="new-password"
                    aria-invalid={!!errors.password}
                  />
                  {fieldError("password")}
                </div>

                <div className="space-y-1.5">
                  {fieldLabel("rs-confirm", "Confirm password", true)}
                  <Input
                    id="rs-confirm"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => set("confirmPassword", e.target.value)}
                    autoComplete="new-password"
                    aria-invalid={!!errors.confirmPassword}
                  />
                  {fieldError("confirmPassword")}
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  {fieldLabel("rs-purpose", "Purpose", undefined, "optional")}
                  <Textarea
                    id="rs-purpose"
                    value={form.purpose}
                    onChange={(e) => set("purpose", e.target.value)}
                    placeholder="e.g. Requesting barangay clearance and evacuation assistance listing"
                    className="min-h-20"
                    maxLength={400}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Fields marked <span className="font-semibold text-emergency-red">*</span> are required. Provide at
                  least one contact (mobile or email).
                </p>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 gap-2 bg-gov-blue px-6 text-sm font-bold text-white hover:bg-gov-blue-700"
                >
                  {submitting ? (
                    <>
                      <Loader2 aria-hidden="true" className="size-4 animate-spin" /> Creating account…
                    </>
                  ) : (
                    <>
                      <PortalIcon name="user-plus" className="size-4" /> Create Resident Account
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
