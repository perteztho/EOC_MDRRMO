"use client";

// QAS33 Public Portal — hero / status dashboard section (normal + emergency)
//
// Command-center hero (Task 3-c polish): gold tracking-wide kicker, huge
// condensed-feel headline, slate supporting copy, premium glass tiles for the
// live status/stats, the portal-grid-pattern overlay with a soft vignette, and
// a three-tier CTA ladder. Auto-fits the viewport below the sticky header.

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

// ---------------------------------------------------------------------------
// Emergency banner (very top strip)
// ---------------------------------------------------------------------------

export function EmergencyBanner({ bannerText }: { bannerText: string }) {
  if (!bannerText) return null;
  return (
    <div role="alert" className="relative z-50">
      <div aria-hidden="true" className="portal-warning-stripes h-1.5 w-full" />
      <div className="relative overflow-hidden bg-gradient-to-r from-red-900 via-red-800 to-red-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 to-transparent opacity-50" />
        <div className="relative mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-2.5 text-center">
          <span className="relative flex shrink-0 items-center justify-center">
            <span className="absolute inline-flex size-4 animate-ping rounded-full bg-gov-gold/40" />
            <Siren aria-hidden="true" className="relative size-4 text-gov-gold" />
          </span>
          <p className="text-xs font-semibold leading-snug tracking-wide text-white/95 sm:text-sm">
            {bannerText}
          </p>
        </div>
      </div>
      <div aria-hidden="true" className="h-px w-full bg-gradient-to-r from-transparent via-gov-gold to-transparent" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Premium Glass Components
// ---------------------------------------------------------------------------

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/[0.08]",
        className
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function StatBlock({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all hover:border-gov-gold/30 hover:bg-white/[0.08]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gov-gold/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative z-10 flex flex-col gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-gov-gold/10 text-gov-gold ring-1 ring-gov-gold/20 transition-colors group-hover:bg-gov-gold/20">
          {icon}
        </span>
        <div>
          <p className="text-2xl font-extrabold tabular-nums tracking-tight text-white sm:text-3xl">{value}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300/80">{label}</p>
        </div>
      </div>
    </div>
  );
}

function HeroAlertChip({ alert }: { alert: AlertDTO }) {
  const style = levelStyle(LEVEL_STYLES, alert.level);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-md transition-colors hover:bg-white/10",
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
        "group relative overflow-hidden rounded-xl border border-l-4 border-white/10 bg-white/[0.06] p-4 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/[0.08]",
        style.border
      )}
    >
      <div className="relative z-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm", style.badge)}>
            {style.label}
          </span>
          <span className="text-[11px] font-medium text-slate-300/80">{timeAgo(alert.createdAt)}</span>
        </div>
        <p className="mt-2.5 text-sm font-bold text-white">{alert.title}</p>
        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-200/90">{alert.message}</p>
        {alert.linkUrl ? (
          <a
            href={alert.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-gov-gold underline-offset-2 transition-colors hover:text-gov-gold/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
          >
            More information
            <PortalIcon name="arrow-right" className="size-3 transition-transform group-hover:translate-x-0.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero Section
// ---------------------------------------------------------------------------

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
  /** Optional banner text to render the EmergencyBanner at the top. */
  bannerText?: string;
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
  bannerText,
}: HeroSectionProps) {
  const cfg = section.config;
  const heroNote = (cfg.data?.heroNote as string | undefined) ?? null;
  const showHeroAlerts = emergency ? alerts.length > 0 : alerts.length > 0 && (alertSettings?.showInHero ?? true);
  const heroAlerts = alerts.slice(0, emergency ? 3 : alertSettings?.heroMaxAlerts ?? 2);
  const openEvacuation = onOpenEvac ?? (() => scrollToAnchor("evacuation"));

  return (
    <>
      {emergency && bannerText && <EmergencyBanner bannerText={bannerText} />}
      
      <section
        id={section.key}
        aria-label={section.name || "Hero"}
        className={cn(
          // Auto-fits the remaining viewport below a standard 4rem (64px) sticky header
          "relative flex min-h-[calc(100vh-4rem)] w-full flex-col justify-center overflow-hidden",
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
        
        {/* Government gradient overlay (photo shows through) */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 opacity-50",
            emergency
              ? "bg-gradient-to-br from-red-950/95 via-red-900/90 to-gov-blue-deep/95"
              : "bg-gradient-to-br from-gov-blue-deep/95 via-gov-blue/90 to-slate-900/90"
          )}
        />
        
        {/* Top warning stripes (emergency only) */}
        {emergency ? <div aria-hidden="true" className="portal-warning-stripes relative z-10 h-1.5 w-full" /> : null}
        
        <div aria-hidden="true" className="portal-grid-pattern pointer-events-none absolute inset-0 opacity-40" />
        
        {/* Soft radial vignette — anchors the grid pattern and deepens text contrast */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-black/40"
        />
        
        <div aria-hidden="true" className="relative z-10 h-1 w-full bg-gov-gold" />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col justify-center gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:flex-row lg:items-center lg:gap-12 lg:px-8 lg:py-16">
          {/* LEFT COLUMN */}
          <div className="flex-1">
            <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-gov-gold sm:text-xs">
              <span aria-hidden="true" className="h-0.5 w-8 rounded-full bg-gov-gold" />
              {emergency ? "EMERGENCY OPERATIONS ACTIVE" : "DRRM PUBLIC IEC PORTAL"}
            </p>
            
            <h1 className="mt-4 text-balance text-3xl font-extrabold leading-[1.05] tracking-[-0.02em] text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] sm:text-4xl lg:text-[2.9rem] xl:text-[3.3rem]">
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
                <div className="inline-flex w-fit items-center gap-2.5 rounded-xl border border-white/15 bg-red-600/90 px-4 py-2 font-bold text-white shadow-lg shadow-black/25 backdrop-blur-sm">
                  <span aria-hidden="true" className="relative flex size-2.5 shrink-0 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/50" />
                    <span className="relative size-2.5 rounded-full bg-white" />
                  </span>
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
            {emergency ? (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenModal("report")}
                  className="group relative inline-flex h-12 items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-6 text-sm font-bold text-white shadow-lg shadow-red-900/30 transition-all hover:shadow-red-900/50 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-red-950"
                >
                  <Siren aria-hidden="true" className="size-4 animate-pulse" />
                  Report an Emergency
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModal("hotlines")}
                  className="group relative inline-flex h-12 items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 text-sm font-bold text-slate-900 shadow-lg shadow-amber-900/20 transition-all hover:shadow-amber-900/40 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-red-950"
                >
                  <PhoneCall aria-hidden="true" className="size-4" />
                  Emergency Hotlines
                </button>
                <button
                  type="button"
                  onClick={openEvacuation}
                  className="group inline-flex h-12 items-center gap-2.5 rounded-xl border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur-md transition-all hover:border-white/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 focus-visible:ring-offset-red-950"
                >
                  <PortalIcon name="map-pin" className="size-4 transition-transform group-hover:-translate-y-0.5" />
                  Evacuation Centers
                </button>
              </div>
            ) : (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenModal("hotlines")}
                  className="group relative inline-flex h-12 items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-red-900 to-red-950 px-6 text-sm font-bold text-white shadow-lg shadow-red-950/40 transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 focus-visible:ring-offset-gov-blue-deep"
                >
                  <PhoneCall aria-hidden="true" className="size-4" />
                  Emergency Hotline
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModal("report")}
                  className="group relative inline-flex h-12 items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 text-sm font-bold text-slate-900 shadow-lg shadow-amber-900/20 transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gov-blue-deep"
                >
                  <Siren aria-hidden="true" className="size-4" />
                  Report an Incident
                </button>
                {cfg.ctaEnabled && cfg.ctaLink && cfg.ctaLabel ? (
                  <LinkAction
                    link={cfg.ctaLink}
                    ctx={linkCtx}
                    className="group inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white/80 underline-offset-4 transition-colors hover:text-gov-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 focus-visible:ring-offset-gov-blue-deep"
                  >
                    {cfg.ctaLabel}
                    <PortalIcon name="arrow-right" className="size-4 transition-transform group-hover:translate-x-1" />
                  </LinkAction>
                ) : (
                  <button
                    type="button"
                    onClick={() => scrollToAnchor("announcements")}
                    className="group inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white/80 underline-offset-4 transition-colors hover:text-gov-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 focus-visible:ring-offset-gov-blue-deep"
                  >
                    <PortalIcon name="megaphone" className="size-4 text-gov-gold/80" />
                    Read Public Advisories
                    <PortalIcon name="arrow-right" className="size-4 transition-transform group-hover:translate-x-1" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN — glass command cards */}
          <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[340px]">
            {/* Operational status */}
            <GlassCard>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-300">Operational Status</p>
              <div className="mt-3 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative flex size-2.5 shrink-0 items-center justify-center",
                    emergency ? "text-red-500" : "text-emerald-400"
                  )}
                >
                  <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", emergency ? "bg-red-500" : "bg-emerald-400")} />
                  <span className={cn("relative size-2.5 rounded-full shadow-sm", emergency ? "bg-red-500" : "bg-emerald-400")} />
                </span>
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
              <GlassCard className="flex flex-col gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-300">Quick Actions</p>
                <div className="flex flex-col gap-2">
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
                      className="group flex min-h-11 items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-white transition-all hover:border-gov-gold/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                    >
                      <span className="flex items-center gap-3">
                        <PortalIcon name={a.icon} className="size-4 text-gov-gold transition-colors group-hover:text-white" />
                        {a.label}
                      </span>
                      <PortalIcon name="chevron-right" className="size-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                    </button>
                  ))}
                </div>
              </GlassCard>
            ) : stats ? (
              <div className="grid grid-cols-3 gap-3">
                <StatBlock value={String(stats.barangays)} label="Barangays" icon={<MapPinned aria-hidden="true" className="size-5" />} />
                <StatBlock value={compactNumber(stats.population)} label="Residents" icon={<Users aria-hidden="true" className="size-5" />} />
                <StatBlock value={compactNumber(stats.households)} label="Households" icon={<Home aria-hidden="true" className="size-5" />} />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/10" />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}