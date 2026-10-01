"use client";

// QAS33 Public Portal — hero / status dashboard section (normal + emergency)
//
// Command-center hero (Task 3-c polish): gold tracking-wide kicker, huge
// condensed-feel headline, slate supporting copy, premium glass tiles for the
// live status/stats, the portal-grid-pattern overlay with a soft vignette, and
// a three-tier CTA ladder (red-950 hotline → gold report → quiet link).
// The municipal-hall photo (/hero-bg.webp) shows through a 50% government
// gradient. The section renders identically in NORMAL mode and under the
// portal-dark TYPHOON theme (the hero carries its own dark surface).

import * as React from "react";
import { Home, MapPinned, PhoneCall, ShieldCheck, Siren, TriangleAlert, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  AlertDTO,
  AlertSettings,
  HomepageResponse,
  OperationalSettings,
  PortalStats,
  PublicSection,
} from "@/lib/qas33/portal-types";
import {
  LinkAction,
  PortalIcon,
  compactNumber,
  levelStyle,
  LEVEL_STYLES,
  scrollToAnchor,
  timeAgo,
  type PortalLinkCtx,
} from "./portal-shared";

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/15 bg-white/[0.08] p-4 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md",
        className
      )}
    >
      {children}
    </div>
  );
}

function StatBlock({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-3.5 shadow-[0_16px_40px_-26px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md transition-colors hover:border-gov-gold/40">
      <span className="flex size-7 items-center justify-center rounded-lg bg-gov-gold/15 text-gov-gold">
        {icon}
      </span>
      <p className="mt-2 text-xl font-extrabold tabular-nums tracking-tight text-white sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">{label}</p>
    </div>
  );
}

function HeroAlertChip({ alert }: { alert: AlertDTO }) {
  const style = levelStyle(LEVEL_STYLES, alert.level);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-sm",
        style.badge
      )}
    >
      <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="truncate">{alert.title}</span>
    </span>
  );
}

function HeroAlertCard({ alert }: { alert: AlertDTO }) {
  const style = levelStyle(LEVEL_STYLES, alert.level);
  return (
    <div
      className={cn(
        "rounded-r-xl border border-l-4 border-white/10 bg-white/10 p-4 shadow-[0_16px_40px_-26px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md",
        style.border
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", style.badge)}>
          {style.label}
        </span>
        <span className="text-[11px] text-slate-300">{timeAgo(alert.createdAt)}</span>
      </div>
      <p className="mt-2 text-sm font-bold text-white">{alert.title}</p>
      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-200/90">{alert.message}</p>
      {alert.linkUrl ? (
        <a
          href={alert.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-gov-gold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
        >
          More information
          <PortalIcon name="arrow-right" className="size-3" />
        </a>
      ) : null}
    </div>
  );
}

export interface HeroSectionProps {
  section: PublicSection;
  mode: HomepageResponse["mode"];
  emergency: boolean;
  operational: OperationalSettings;
  stats: PortalStats | null;
  alerts: AlertDTO[];
  alertSettings?: AlertSettings | null;
  onOpenModal: (modal: "hotlines" | "report") => void;
  /** Opens the full-screen evacuation finder (falls back to section scroll). */
  onOpenEvac?: () => void;
  linkCtx: PortalLinkCtx;
}

export function HeroSection({
  section,
  emergency,
  operational,
  stats,
  alerts,
  alertSettings,
  onOpenModal,
  onOpenEvac,
  linkCtx,
}: HeroSectionProps) {
  const cfg = section.config;
  const heroNote = (cfg.data?.heroNote as string | undefined) ?? null;
  const showHeroAlerts = emergency ? alerts.length > 0 : alerts.length > 0 && (alertSettings?.showInHero ?? true);
  const heroAlerts = alerts.slice(0, emergency ? 3 : alertSettings?.heroMaxAlerts ?? 2);
  const openEvacuation = onOpenEvac ?? (() => scrollToAnchor("evacuation"));

  return (
    <section
      id={section.key}
      aria-label={section.name || "Hero"}
      className={cn(
        "relative scroll-mt-28 overflow-hidden",
        // Fallback base color while the photo loads / if it fails
        emergency ? "bg-red-950" : "bg-gov-blue-deep",
        "text-white"
      )}
    >
      {/* Hint the browser to start fetching the hero photo immediately */}
      <link rel="preload" as="image" href="/hero-bg.webp" fetchPriority="high" />
      {/* Background photo — Municipality of Pio Duran municipal hall */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero-bg.webp')" }}
      />
      {/* Government gradient overlay at 50% opacity (photo shows through) */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 opacity-50",
          emergency
            ? "bg-gradient-to-br from-red-950/95 via-emergency-red-dark/90 to-gov-blue-deep/95"
            : "bg-gradient-to-br from-gov-blue-deep/95 via-gov-blue/85 to-gov-blue-700/80"
        )}
      />
      {/* Top warning stripes (emergency only) */}
      {emergency ? <div aria-hidden="true" className="portal-warning-stripes relative z-10 h-1.5 w-full" /> : null}
      <div aria-hidden="true" className="portal-grid-pattern pointer-events-none absolute inset-0" />
      {/* Soft vignette — anchors the grid pattern and deepens text contrast */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-b via-transparent to-black/25",
          emergency ? "from-red-950/50" : "from-gov-blue-deep/55"
        )}
      />
      <div aria-hidden="true" className="relative z-10 h-1 w-full bg-gov-gold" />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8 lg:py-16">
        {/* LEFT */}
        <div>
          <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-gov-gold sm:text-xs">
            <span aria-hidden="true" className="h-0.5 w-8 rounded-full bg-gov-gold" />
            {emergency ? "EMERGENCY OPERATIONS ACTIVE" : "DRRM PUBLIC IEC PORTAL"}
          </p>
          <h1 className="mt-4 text-balance text-3xl font-extrabold leading-[1.05] tracking-[-0.02em] text-white sm:text-4xl lg:text-[2.9rem] xl:text-[3.3rem]">
            {section.heading}
          </h1>
          {section.subtitle ? (
            <p className="mt-3 text-lg font-semibold text-gov-gold sm:text-xl">{section.subtitle}</p>
          ) : null}
          {section.description ? (
            <p className="mt-4 max-w-2xl text-pretty text-[15px] leading-relaxed text-slate-200/90 sm:text-base">
              {section.description}
            </p>
          ) : null}
          {heroNote ? (
            <p className="mt-3 flex max-w-2xl items-start gap-2 text-sm italic leading-relaxed text-slate-300">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gov-gold" />
              {heroNote}
            </p>
          ) : null}

          {/* Emergency status chip */}
          {emergency ? (
            <div className="mt-5 flex flex-col gap-3">
              <div className="inline-flex w-fit items-center gap-2.5 rounded-xl border border-white/15 bg-emergency-red px-4 py-2 font-bold text-white shadow-lg shadow-black/25">
                <span aria-hidden="true" className="portal-status-dot size-2.5 rounded-full bg-white" />
                {operational.emergencyTitle}
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-200">
                {operational.emergencyDescription}
              </p>
            </div>
          ) : null}

          {/* Alerts */}
          {showHeroAlerts && heroAlerts.length > 0 ? (
            emergency ? (
              <div className="mt-6 flex max-w-2xl flex-col gap-3">
                {heroAlerts.map((a) => (
                  <HeroAlertCard key={a.id} alert={a} />
                ))}
              </div>
            ) : (
              <div className="mt-6 flex max-w-2xl flex-wrap gap-2">
                {heroAlerts.map((a) => (
                  <HeroAlertChip key={a.id} alert={a} />
                ))}
              </div>
            )
          ) : null}

          {/* CTA row — gold primary · strong outline · quiet link */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {emergency ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpenModal("report")}
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-emergency-red px-5 text-sm font-bold text-white shadow-lg shadow-black/30 transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 focus-visible:ring-offset-red-950"
                >
                  <Siren aria-hidden="true" className="size-4" />
                  Report an Emergency
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModal("hotlines")}
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-gov-gold px-5 text-sm font-bold text-gov-blue-deep shadow-lg shadow-gov-gold/25 transition-colors hover:bg-gov-gold-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-red-950"
                >
                  <PhoneCall aria-hidden="true" className="size-4" />
                  Emergency Hotlines
                </button>
                <button
                  type="button"
                  onClick={openEvacuation}
                  className="inline-flex h-12 items-center gap-2 rounded-lg border-2 border-white/40 bg-white/5 px-5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-white/70 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 focus-visible:ring-offset-red-950"
                >
                  <PortalIcon name="map-pin" className="size-4" />
                  Evacuation Centers
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenModal("hotlines")}
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-red-950 px-5 text-sm font-bold text-white shadow-[0_12px_32px_-12px_rgba(20,8,10,0.55)] transition-colors hover:bg-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 focus-visible:ring-offset-gov-blue-deep"
                >
                  <PhoneCall aria-hidden="true" className="size-4" />
                  Emergency Hotline
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModal("report")}
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-gov-gold px-5 text-sm font-bold text-gov-blue-deep shadow-[0_12px_32px_-12px_rgba(252,207,3,0.55)] transition-colors hover:bg-gov-gold-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold-dark focus-visible:ring-offset-2 focus-visible:ring-offset-gov-blue-deep"
                >
                  <Siren aria-hidden="true" className="size-4" />
                  Report an Incident
                </button>
                {cfg.ctaEnabled && cfg.ctaLink && cfg.ctaLabel ? (
                  <LinkAction
                    link={cfg.ctaLink}
                    ctx={linkCtx}
                    className="group inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-white/85 underline-offset-4 transition-colors hover:text-gov-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 focus-visible:ring-offset-gov-blue-deep"
                  >
                    {cfg.ctaLabel}
                    <PortalIcon name="arrow-right" className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </LinkAction>
                ) : (
                  <button
                    type="button"
                    onClick={() => scrollToAnchor("announcements")}
                    className="group inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-white/85 underline-offset-4 transition-colors hover:text-gov-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 focus-visible:ring-offset-gov-blue-deep"
                  >
                    <PortalIcon name="megaphone" className="size-4 text-gov-gold/80" />
                    Read Public Advisories
                    <PortalIcon name="arrow-right" className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT — glass command cards */}
        <div className="flex flex-col gap-3">
          {/* Operational status */}
          <GlassCard>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-300">Operational Status</p>
            <div className="mt-3 flex items-center gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "portal-status-dot size-2.5 rounded-full",
                  emergency ? "bg-red-500" : "bg-emerald-400"
                )}
              />
              <p className="text-lg font-bold text-white">
                {emergency ? operational.emergencyTitle : operational.normalTitle}
              </p>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-200/85">
              {emergency ? operational.emergencyDescription : operational.normalDescription}
            </p>
          </GlassCard>

          {/* Quick stats or emergency quick actions */}
          {emergency ? (
            <GlassCard>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-300">Quick Actions</p>
              <div className="mt-3 flex flex-col gap-2">
                {[
                  { label: "Evacuation Centers", icon: "map-pin", anchor: "evacuation", evac: true },
                  { label: "Emergency Hotlines", icon: "phone-call", modal: "hotlines" as const },
                  { label: "Preparedness Guides", icon: "shield-check", anchor: "preparedness" },
                ].map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => {
                      if (a.modal) onOpenModal(a.modal);
                      else if (a.evac && onOpenEvac) onOpenEvac();
                      else if (a.anchor) scrollToAnchor(a.anchor);
                    }}
                    className="flex min-h-11 items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white transition-colors hover:border-gov-gold/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                  >
                    <span className="flex items-center gap-2.5">
                      <PortalIcon name={a.icon} className="size-4 text-gov-gold" />
                      {a.label}
                    </span>
                    <PortalIcon name="chevron-right" className="size-4 text-slate-400" />
                  </button>
                ))}
              </div>
            </GlassCard>
          ) : stats ? (
            <div className="grid grid-cols-3 gap-3">
              <StatBlock value={String(stats.barangays)} label="Barangays" icon={<MapPinned aria-hidden="true" className="size-4" />} />
              <StatBlock value={compactNumber(stats.population)} label="Residents" icon={<Users aria-hidden="true" className="size-4" />} />
              <StatBlock value={compactNumber(stats.households)} label="Households" icon={<Home aria-hidden="true" className="size-4" />} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/10" />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
