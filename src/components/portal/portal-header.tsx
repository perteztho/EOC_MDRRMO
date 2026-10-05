"use client";

// QAS33 Public Portal — emergency banner, utility bar, sticky main header and
// the universal navigation drawer (hamburger on ALL screen sizes).
//
// Navigation model (per spec): the 7 primary destinations (Home, About,
// Preparedness, Emergency Response, Resources, News & Updates, Contact) ALWAYS
// live in the hamburger drawer — on mobile and desktop alike. The header keeps
// the brand, the operational status and the two emergency actions. On phones
// (< md) the emergency actions move to the fixed bottom app bar, keeping the
// header slim.
//
// Chrome polish (Task 3-c): refined utility-bar typography (gold interpuncts,
// PHT clock), seal on a white disc with a gold sentinel dot, shadow-on-scroll,
// consistent gold focus-visible rings. All utility classes used here are part
// of the portal-dark TYPHOON theme remapping (bg-white, slate borders/text,
// gov-blue text, emerald/red chips) so the header reads correctly in both
// NORMAL and emergency themes without any local theme switching.

import * as React from "react";
import { Clock, Facebook, Globe, LogIn, Menu, PhoneCall, Siren, TentTree } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { HomepageResponse, NavigationSettings, OperationalMode } from "@/lib/qas33/portal-types";
import type { PushStatusDTO } from "@/lib/qas33/emergency-types";
import { LinkAction, PortalIcon, resolveLink, scrollToAnchor, telHref, type PortalLinkCtx } from "./portal-shared";
import { PortalPushButton } from "./portal-push";

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
// Utility bar (PH/region identity, live clock, social + logins)
// ---------------------------------------------------------------------------

function usePhilippineClock(): string {
  const [now, setNow] = React.useState<string | null>(null);
  React.useEffect(() => {
    const fmt = () =>
      new Date().toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    setNow(fmt());
    const id = window.setInterval(() => setNow(fmt()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now ?? "";
}

export function UtilityBar({
  general,
  emergency,
  onOpenLogin,
  preview,
}: {
  general: HomepageResponse["general"];
  emergency: boolean;
  onOpenLogin?: (kind: "admin" | "barangay") => void;
  preview?: boolean;
}) {
  const clock = usePhilippineClock();
  return (
    <div
      className={cn(
        "hidden border-b border-white/5 text-[11px] text-slate-300 sm:block",
        emergency ? "bg-red-950/90 backdrop-blur-sm" : "bg-slate-950/95 backdrop-blur-sm"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 sm:px-6 lg:px-8">
        <p className="flex min-w-0 items-center gap-2 font-medium tracking-[0.12em] text-slate-400">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-gov-gold shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
          <span className="truncate text-slate-300">
            REPUBLIC OF THE PHILIPPINES
            <span aria-hidden="true" className="px-2 text-slate-600">•</span>
            REGION V (BICOL)
            <span aria-hidden="true" className="px-2 text-slate-600">•</span>
            PROVINCE OF ALBAY
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-3">
          {clock ? (
            <span className="flex items-center gap-2 font-medium tracking-wide text-slate-300" suppressHydrationWarning>
              <Clock aria-hidden="true" className="size-3.5 text-gov-gold/80" />
              <span className="font-mono text-xs text-slate-200">{clock}</span>
              <span className="text-[10px] font-bold tracking-widest text-slate-500">PHT</span>
            </span>
          ) : null}
          
          <div className="h-3 w-px bg-slate-800" />
          
          {general.facebookUrl ? (
            <a
              href={general.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MDRRMO Pio Duran on Facebook (opens in a new tab)"
              className="flex size-7 items-center justify-center rounded-md text-slate-400 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <Facebook aria-hidden="true" className="size-3.5" />
            </a>
          ) : null}
          
          {!preview ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenLogin?.("admin")}
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold tracking-wide text-slate-300 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                MDRRMO Login
              </button>
              <span aria-hidden="true" className="text-slate-700">|</span>
              <button
                type="button"
                onClick={() => onOpenLogin?.("barangay")}
                title="Browse the public frontpages of the 33 barangays"
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold tracking-wide text-slate-300 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Barangay Public
              </button>
            </div>
          ) : (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-500 ring-1 ring-amber-500/20">
              Preview Mode
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status pill (full for ≥md, compact for phones)
// ---------------------------------------------------------------------------

function StatusPill({ mode, className }: { mode: OperationalMode; className?: string }) {
  const emergency = mode !== "NORMAL";
  const label = mode === "TYPHOON" ? "TYPHOON OPERATION" : mode === "EMERGENCY" ? "EMERGENCY OPERATION" : "NORMAL OPERATION";
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center gap-2.5 rounded-full border px-3.5 text-[11px] font-bold tracking-wider shadow-sm backdrop-blur-sm transition-colors",
        emergency
          ? "border-red-200 bg-red-50/80 text-red-700 ring-1 ring-red-500/10"
          : "border-emerald-200 bg-emerald-50/80 text-emerald-700 ring-1 ring-emerald-500/10",
        className
      )}
    >
      <span className="relative flex size-2 shrink-0 items-center justify-center">
        <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", emergency ? "bg-red-500" : "bg-emerald-500")} />
        <span className={cn("relative size-2 rounded-full shadow-sm", emergency ? "bg-red-600" : "bg-emerald-500")} />
      </span>
      {label}
    </span>
  );
}

/** Compact status indicator for the slim phone header. */
function StatusDot({ mode, className }: { mode: OperationalMode; className?: string }) {
  const emergency = mode !== "NORMAL";
  const label = mode === "TYPHOON" ? "Typhoon operation active" : mode === "EMERGENCY" ? "Emergency operation active" : "Normal operation";
  return (
    <span
      title={label}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border px-2.5 text-[10px] font-bold tracking-wider shadow-sm backdrop-blur-sm",
        emergency ? "border-red-200 bg-red-50/80 text-red-700 ring-1 ring-red-500/10" : "border-emerald-200 bg-emerald-50/80 text-emerald-700 ring-1 ring-emerald-500/10",
        className
      )}
    >
      <span className="relative flex size-2 shrink-0 items-center justify-center">
        <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", emergency ? "bg-red-500" : "bg-emerald-500")} />
        <span className={cn("relative size-2 rounded-full", emergency ? "bg-red-600" : "bg-emerald-500")} />
      </span>
      <span className="sm:hidden">{emergency ? "ALERT" : "NORMAL"}</span>
      <span className="hidden sm:inline">{label.toUpperCase()}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main sticky header
// ---------------------------------------------------------------------------

export interface PortalHeaderProps {
  data: HomepageResponse;
  mode: OperationalMode;
  emergency: boolean;
  onOpenModal: (modal: "hotlines" | "report") => void;
  onOpenLogin?: (kind: "admin" | "barangay") => void;
  /** Opens the full-screen evacuation finder (live data only). */
  onOpenEvac?: () => void;
  /** Web-push status — powers the notification bell (hidden when null). */
  pushStatus?: PushStatusDTO | null;
  preview?: boolean;
  linkCtx: PortalLinkCtx;
  /** Drawer open state is owned by the site view (the bottom bar also opens it). */
  navOpen: boolean;
  onNavOpenChange: (open: boolean) => void;
}

/** True once the page is scrolled a few pixels — drives shadow-on-scroll. */
function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

export function PortalHeader({
  data,
  mode,
  emergency,
  onOpenModal,
  onOpenLogin,
  onOpenEvac,
  pushStatus,
  preview,
  linkCtx,
  navOpen,
  onNavOpenChange,
}: PortalHeaderProps) {
  const general = data.general;
  const navItems = (data.navigation as NavigationSettings)?.items?.filter((i) => i.visible) ?? [];
  const scrolled = useScrolled();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-white/80 backdrop-blur-xl transition-all duration-300",
        scrolled ? "border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" : "border-transparent shadow-none"
      )}
    >
      {/* Government gold sentinel line — top */}
      <div aria-hidden="true" className="h-1 w-full bg-gradient-to-r from-gov-gold/80 via-gov-gold to-gov-gold/80" />
      
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <a
          href="#main-content"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="group flex min-w-0 items-center gap-3 rounded-xl p-1 -ml-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
          aria-label="MDRRMO Pio Duran — back to top"
        >
          <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform group-hover:scale-105 group-hover:shadow-md">
            <img
              src="/logome-256.webp"
              alt=""
              aria-hidden="true"
              className="size-9 rounded-full object-contain"
            />
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white bg-gov-gold shadow-sm"
            />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-bold tracking-tight text-slate-900 transition-colors group-hover:text-gov-blue-deep">
              MDRRMO PIO DURAN
            </span>
            <span className="hidden truncate text-[11px] font-medium tracking-wide text-slate-500 sm:block">
              Disaster Risk Reduction & Management
            </span>
          </span>
        </a>

        {/* Right actions: status + hamburger (always). */}
        <div className="flex items-center gap-2 sm:gap-3">
          <StatusDot mode={mode} className="md:hidden" />
          <StatusPill mode={mode} className="hidden md:inline-flex" />
          
          <span aria-hidden="true" className="hidden h-6 w-px bg-slate-200 md:block" />
          
          {pushStatus ? (
            <div className="hidden md:block">
              <PortalPushButton pushStatus={pushStatus} />
            </div>
          ) : null}
          
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open navigation menu"
            aria-expanded={navOpen}
            onClick={() => onNavOpenChange(true)}
            className="size-11 rounded-xl text-slate-600 transition-all hover:bg-slate-100 hover:text-gov-blue-deep focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
          >
            <Menu aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </div>

      {/* Subtle bottom separator */}
      <div aria-hidden="true" className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* Universal navigation drawer (hamburger — all screen sizes) */}
      <PortalNavDrawer
        open={navOpen}
        onOpenChange={onNavOpenChange}
        navItems={navItems}
        mode={mode}
        general={general}
        linkCtx={linkCtx}
        onOpenModal={(m) => {
          onNavOpenChange(false);
          onOpenModal(m);
        }}
        onOpenLogin={(k) => {
          onNavOpenChange(false);
          onOpenLogin?.(k);
        }}
        onOpenEvac={
          onOpenEvac
            ? () => {
                onNavOpenChange(false);
                onOpenEvac();
              }
            : undefined
        }
        preview={preview}
      />
    </header>
  );
}

// ---------------------------------------------------------------------------
// Navigation drawer (hamburger menu — the single nav surface, all sizes)
// ---------------------------------------------------------------------------

/** Anchor → icon mapping for the drawer (falls back to label keywords). */
const NAV_ICONS: Record<string, string> = {
  home: "home",
  about: "info",
  preparedness: "life-buoy",
  emergency: "siren",
  "emergency-response": "siren",
  resources: "file-text",
  news: "newspaper",
  contact: "phone",
  weather: "cloud-sun",
  announcements: "megaphone",
  evacuation: "map-pin",
  hazards: "triangle-alert",
  dashboard: "layout-dashboard",
  hotlines: "phone-call",
  stats: "bar-chart-3",
  links: "link",
};

function navItemIcon(anchor: string | null | undefined, label: string): string {
  if (anchor && NAV_ICONS[anchor]) return NAV_ICONS[anchor];
  const l = label.toLowerCase();
  if (l.includes("home")) return "home";
  if (l.includes("about")) return "info";
  if (l.includes("prepare")) return "life-buoy";
  if (l.includes("emergency") || l.includes("response")) return "siren";
  if (l.includes("resource")) return "file-text";
  if (l.includes("news") || l.includes("update")) return "newspaper";
  if (l.includes("contact")) return "phone";
  if (l.includes("weather")) return "cloud-sun";
  return "arrow-right";
}

const NAV_TINTS = ["blue", "amber", "teal", "red", "cyan", "slate", "orange"] as const;

function PortalNavDrawer({
  open,
  onOpenChange,
  navItems,
  mode,
  general,
  linkCtx,
  onOpenModal,
  onOpenLogin,
  onOpenEvac,
  preview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navItems: NavigationSettings["items"];
  mode: OperationalMode;
  general: HomepageResponse["general"];
  linkCtx: PortalLinkCtx;
  onOpenModal: (modal: "hotlines" | "report") => void;
  onOpenLogin?: (kind: "admin" | "barangay") => void;
  onOpenEvac?: () => void;
  preview?: boolean;
}) {
  const emergency = mode !== "NORMAL";
  const modeText =
    mode === "TYPHOON"
      ? "Typhoon operations are active. Monitor official advisories."
      : mode === "EMERGENCY"
        ? "Emergency operations are active. Follow official instructions."
        : "Normal operations. Stay informed and prepared.";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[86vw] max-w-sm flex-col gap-0 overflow-y-auto p-0 portal-scroll sm:max-w-md bg-slate-50/95 backdrop-blur-xl"
      >
        {/* Brand header */}
        <SheetHeader
          className={cn(
            "relative border-b p-5 pb-6 text-left",
            emergency
              ? "border-red-900/50 bg-gradient-to-br from-red-950 via-red-900 to-slate-900"
              : "border-slate-800/50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
          )}
        >
          <div aria-hidden="true" className="portal-grid-pattern pointer-events-none absolute inset-0 opacity-40" />
          <SheetTitle className="relative flex items-center gap-3 text-base font-semibold text-white">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/5">
              <img
                src="/logome-256.webp"
                alt=""
                aria-hidden="true"
                className="size-9 object-contain"
              />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate tracking-tight">MDRRMO PIO DURAN</span>
              <span className="truncate text-[11px] font-medium tracking-wide text-slate-300">
                Disaster Risk Reduction & Management
              </span>
            </span>
          </SheetTitle>
          <SheetDescription className="relative mt-2 text-xs font-medium text-slate-400">
            DRRM public information portal — Pio Duran, Albay
          </SheetDescription>
          <div className="relative mt-4 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <span
              className={cn(
                "inline-flex h-7 items-center gap-2 rounded-full border px-3 text-[10px] font-bold tracking-wider",
                emergency
                  ? "border-gov-gold/50 bg-gov-gold/10 text-gov-gold"
                  : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
              )}
            >
              <span className="relative flex size-2 shrink-0 items-center justify-center">
                <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", emergency ? "bg-gov-gold" : "bg-emerald-400")} />
                <span className={cn("relative size-2 rounded-full", emergency ? "bg-gov-gold" : "bg-emerald-400")} />
              </span>
              {emergency ? "ACTIVE TYPHOON / EMERGENCY OPERATION" : "NORMAL OPERATION"}
            </span>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{modeText}</p>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 space-y-6 p-5">
          <div>
            <p className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Navigate</p>
            <nav aria-label="Main navigation" className="flex flex-col gap-2">
              {navItems.map((item, idx) => {
                const resolved = resolveLink(item.link, linkCtx);
                const icon = navItemIcon(resolved.kind === "anchor" ? resolved.anchor : null, item.label);
                const tint = NAV_TINTS[idx % NAV_TINTS.length];
                return (
                  <LinkAction
                    key={item.id}
                    link={item.link}
                    ctx={linkCtx}
                    onClick={() => onOpenChange(false)}
                    className="group relative flex min-h-11 items-center gap-4 rounded-xl border border-transparent bg-white/60 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-200 hover:bg-white hover:shadow-md hover:translate-x-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-all",
                        tint === "blue" && "border-gov-blue-100 bg-gov-blue-50 text-gov-blue group-hover:bg-gov-blue group-hover:text-white group-hover:border-gov-blue",
                        tint === "amber" && "border-amber-100 bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500",
                        tint === "teal" && "border-teal-100 bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600",
                        tint === "red" && "border-red-100 bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white group-hover:border-red-600",
                        tint === "cyan" && "border-cyan-100 bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-600",
                        tint === "slate" && "border-slate-200 bg-slate-100 text-slate-600 group-hover:bg-slate-700 group-hover:text-white group-hover:border-slate-700",
                        tint === "orange" && "border-orange-100 bg-orange-50 text-orange-600 group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-500"
                      )}
                    >
                      <PortalIcon name={icon} className="size-5" />
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    <PortalIcon name="chevron-right" className="size-4 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-gov-blue" />
                  </LinkAction>
                );
              })}
            </nav>
          </div>

          <div>
            <p className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Emergency Actions</p>
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                onClick={() => onOpenModal("report")}
                className="group relative h-12 w-full gap-3 overflow-hidden bg-gradient-to-r from-red-600 to-red-700 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition-all hover:shadow-red-900/30 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                <span className="relative z-10 flex items-center gap-3">
                  <Siren aria-hidden="true" className="size-5 animate-pulse" />
                  Report an Incident
                </span>
              </Button>
              <Button
                type="button"
                onClick={() => onOpenModal("hotlines")}
                className="group relative h-12 w-full gap-3 overflow-hidden bg-gradient-to-r from-amber-400 to-amber-500 text-sm font-bold text-slate-900 shadow-lg shadow-amber-900/10 transition-all hover:shadow-amber-900/20 hover:brightness-105 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                <span className="relative z-10 flex items-center gap-3">
                  <PhoneCall aria-hidden="true" className="size-5" />
                  Emergency Hotlines
                </span>
              </Button>
              <a
                href={telHref(general.hotline)}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-gov-blue hover:bg-gov-blue-50 hover:text-gov-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
              >
                <PhoneCall aria-hidden="true" className="size-4" />
                Call MDRRMO: {general.hotline}
              </a>
              {onOpenEvac ? (
                <button
                  type="button"
                  onClick={onOpenEvac}
                  className="group flex min-h-12 w-full items-center gap-3 rounded-xl border border-gov-blue-100 bg-gov-blue-50/50 px-4 text-sm font-semibold text-gov-blue transition-all hover:border-gov-blue hover:bg-gov-blue hover:text-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gov-blue text-white shadow-sm transition-colors group-hover:bg-white group-hover:text-gov-blue">
                    <TentTree aria-hidden="true" className="size-5" />
                  </span>
                  <span className="flex-1 text-left">Evacuation Centers</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 transition-colors group-hover:bg-white group-hover:text-emerald-700">Live Map</span>
                </button>
              ) : null}
            </div>
          </div>

          {!preview ? (
            <div>
              <p className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Portals</p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenLogin?.("admin")}
                  className="h-11 w-full justify-start gap-3 border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-gov-blue hover:bg-gov-blue-50 hover:text-gov-blue focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
                >
                  <LogIn aria-hidden="true" className="size-4" />
                  MDRRMO Login
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenLogin?.("barangay")}
                  className="h-11 w-full justify-start gap-3 border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-gov-blue hover:bg-gov-blue-50 hover:text-gov-blue focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
                >
                  <Globe aria-hidden="true" className="size-4" />
                  Barangay Public
                </Button>
                <p className="mt-2 px-1 text-[11px] leading-relaxed text-slate-500">
                  Browse the 33 barangay frontpages — each barangay’s own public page with announcements, services, events and contacts.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 p-5">
          <p className="mb-4 text-center text-[10px] font-medium tracking-wide text-slate-400">
            REPUBLIC OF THE PHILIPPINES • MUNICIPALITY OF PIO DURAN • ALBAY
          </p>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              scrollToAnchor("main-content");
            }}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
          >
            Close Menu
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}