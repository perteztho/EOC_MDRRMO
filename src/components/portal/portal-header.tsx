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
    <div role="alert" className="relative z-40">
      <div aria-hidden="true" className="portal-warning-stripes h-1.5 w-full" />
      <div className="bg-emergency-red-dark text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-2.5 text-center">
          <span className="relative flex shrink-0 items-center">
            <span className="portal-status-dot absolute inline-flex size-4 rounded-full bg-gov-gold/60" aria-hidden="true" />
            <Siren aria-hidden="true" className="relative size-4 text-gov-gold" />
          </span>
          <p className="text-xs font-semibold leading-snug sm:text-sm">{bannerText}</p>
        </div>
      </div>
      <div aria-hidden="true" className="portal-alert-glow h-0.5 w-full bg-gov-gold/90" />
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
        "hidden border-b border-white/10 text-[11px] text-slate-300 sm:block",
        emergency ? "border-red-900/40 bg-red-950" : "bg-gov-blue-deep"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <p className="flex min-w-0 items-center gap-2 py-1.5 font-medium tracking-[0.08em]">
          <span aria-hidden="true" className="hidden size-1 shrink-0 rounded-full bg-gov-gold md:inline-block" />
          <span className="truncate">
            REPUBLIC OF THE PHILIPPINES
            <span aria-hidden="true" className="px-1.5 text-gov-gold/70">·</span>
            REGION V (BICOL)
            <span aria-hidden="true" className="px-1.5 text-gov-gold/70">·</span>
            PROVINCE OF ALBAY
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-2.5 py-1.5">
          {clock ? (
            <span
              className="hidden items-center gap-1.5 font-medium tracking-wide text-slate-200 md:inline-flex"
              suppressHydrationWarning
            >
              <Clock aria-hidden="true" className="size-3 text-gov-gold/80" />
              {clock} · PHT
            </span>
          ) : null}
          {general.facebookUrl ? (
            <a
              href={general.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MDRRMO Pio Duran on Facebook (opens in a new tab)"
              className="flex size-6 items-center justify-center rounded text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
            >
              <Facebook aria-hidden="true" className="size-3.5" />
            </a>
          ) : null}
          {!preview ? (
            <>
              <button
                type="button"
                onClick={() => onOpenLogin?.("admin")}
                className="rounded px-2 py-1 font-medium tracking-wide transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
              >
                MDRRMO Login
              </button>
              <span aria-hidden="true" className="text-slate-600">
                |
              </span>
              <button
                type="button"
                onClick={() => onOpenLogin?.("barangay")}
                title="Browse the public frontpages of the 33 barangays"
                className="rounded px-2 py-1 font-medium tracking-wide transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
              >
                Barangay Public
              </button>
            </>
          ) : (
            <span className="px-2 py-1 text-slate-500">Preview Mode</span>
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
        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[11px] font-bold tracking-wider shadow-sm",
        emergency
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
        className
      )}
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full", emergency ? "portal-status-dot bg-red-600" : "bg-emerald-500")} />
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
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold tracking-wider shadow-sm",
        emergency ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
        className
      )}
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full", emergency ? "portal-status-dot bg-red-600" : "bg-emerald-500")} />
      <span className="sm:hidden">{emergency ? "ALERT" : "NORMAL"}</span>
      <span className="hidden sm:inline">{label.toUpperCase()}</span>
      <span className="sr-only"> — {label}</span>
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
        "sticky top-0 z-40 border-b bg-white/95 backdrop-blur transition-shadow duration-300",
        "border-slate-200/80",
        scrolled && "shadow-[0_10px_32px_-20px_rgba(2,15,63,0.5)]"
      )}
    >
      {/* Government gold sentinel line — top */}
      <div aria-hidden="true" className="h-1 w-full bg-gov-gold" />
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <a
          href="#main-content"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 sm:gap-3"
          aria-label="MDRRMO Pio Duran — back to top"
        >
          {/* Official MDRRMO seal (logome.webp) on a white disc with a gold sentinel dot */}
          <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 sm:size-11">
            <img
              src="/logome-256.webp"
              alt=""
              aria-hidden="true"
              className="size-9 rounded-full object-contain sm:size-10"
            />
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white bg-gov-gold"
            />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[13px] font-extrabold uppercase tracking-tight text-gov-blue-deep sm:text-base">
              MDRRMO PIO DURAN
            </span>
            <span className="hidden truncate text-[11px] font-medium text-slate-500 sm:block">
              Disaster Risk Reduction &amp; Management Office
            </span>
          </span>
        </a>

        {/* Right actions: status + hamburger (always).
            Emergency Hotline / Report actions live in the nav drawer, the hero
            CTAs and the mobile bottom app bar — the top bar stays clean. */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Compact status on phones, full pill ≥md */}
          <StatusDot mode={mode} className="md:hidden" />
          <StatusPill mode={mode} className="hidden md:inline-flex" />
          <span aria-hidden="true" className="hidden h-6 w-px bg-slate-200 md:block" />
          {/* Push notification bell (live portal only, ≥md — phones get the card
              inside the evacuation finder / news section) */}
          {pushStatus ? <div className="hidden md:block"><PortalPushButton pushStatus={pushStatus} /></div> : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open navigation menu"
            aria-expanded={navOpen}
            onClick={() => onNavOpenChange(true)}
            className="size-11 rounded-lg text-gov-blue hover:bg-gov-blue-50 hover:text-gov-blue focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
          >
            <Menu aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </div>

      {/* Government gold sentinel line — bottom */}
      <div aria-hidden="true" className="h-1 w-full bg-gov-gold" />

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
        className="flex w-[86vw] max-w-sm flex-col gap-0 overflow-y-auto p-0 portal-scroll sm:max-w-md"
      >
        {/* Brand header */}
        <SheetHeader
          className={cn(
            "relative border-b p-4 pb-5 text-left",
            emergency
              ? "border-red-900/60 bg-gradient-to-br from-red-950 via-emergency-red-dark to-gov-blue-deep"
              : "border-gov-blue-800/60 bg-gradient-to-br from-gov-blue-deep via-gov-blue to-gov-blue-700"
          )}
        >
          <div aria-hidden="true" className="portal-grid-pattern pointer-events-none absolute inset-0 opacity-60" />
          <SheetTitle className="relative flex items-center gap-3 text-base text-white">
            {/* Official MDRRMO seal on a white disc for contrast on dark bg */}
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
              <img
                src="/logome-256.webp"
                alt=""
                aria-hidden="true"
                className="size-9 object-contain"
              />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate">MDRRMO PIO DURAN</span>
              <span className="truncate text-[11px] font-medium text-slate-200">
                Disaster Risk Reduction &amp; Management Office
              </span>
            </span>
          </SheetTitle>
          <SheetDescription className="relative text-xs text-slate-300">
            Official public information portal — Pio Duran, Albay
          </SheetDescription>
          <div className="relative pt-1">
            <span
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[10px] font-bold tracking-wider",
                emergency
                  ? "border-gov-gold/50 bg-gov-gold/10 text-gov-gold"
                  : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
              )}
            >
              <span
                aria-hidden="true"
                className={cn("size-2 rounded-full", emergency ? "portal-status-dot bg-gov-gold" : "bg-emerald-400")}
              />
              {emergency ? "ACTIVE TYPHOON / EMERGENCY OPERATION" : "NORMAL OPERATION"}
            </span>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{modeText}</p>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 p-4">
          <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Navigate</p>
          <nav aria-label="Main navigation" className="flex flex-col gap-1">
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
                  className="group flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:translate-x-0.5 hover:bg-gov-blue-50 hover:text-gov-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                      tint === "blue" && "bg-gov-blue-50 text-gov-blue group-hover:bg-gov-blue group-hover:text-white",
                      tint === "amber" && "bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white",
                      tint === "teal" && "bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white",
                      tint === "red" && "bg-red-50 text-red-600 group-hover:bg-emergency-red group-hover:text-white",
                      tint === "cyan" && "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white",
                      tint === "slate" && "bg-slate-100 text-slate-600 group-hover:bg-slate-700 group-hover:text-white",
                      tint === "orange" && "bg-orange-50 text-orange-600 group-hover:bg-orange-500 group-hover:text-white"
                    )}
                  >
                    <PortalIcon name={icon} className="size-4.5" />
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  <PortalIcon name="chevron-right" className="size-4 text-slate-300 transition-transform group-hover:translate-x-0.5" />
                </LinkAction>
              );
            })}
          </nav>

          <p className="mb-2 mt-6 px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Emergency</p>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => onOpenModal("report")}
              className="h-12 w-full gap-2 bg-emergency-red text-sm font-bold text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
            >
              <Siren aria-hidden="true" className="size-4" />
              Report an Incident
            </Button>
            <Button
              type="button"
              onClick={() => onOpenModal("hotlines")}
              className="h-12 w-full gap-2 bg-gov-gold text-sm font-bold text-gov-blue-deep hover:bg-gov-gold-dark focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
            >
              <PhoneCall aria-hidden="true" className="size-4" />
              Emergency Hotlines
            </Button>
            <a
              href={telHref(general.hotline)}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-semibold text-gov-blue hover:border-gov-blue hover:bg-gov-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
            >
              <PhoneCall aria-hidden="true" className="size-4" />
              Call MDRRMO: {general.hotline}
            </a>
            {onOpenEvac ? (
              <button
                type="button"
                onClick={onOpenEvac}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-gov-blue-100 bg-gov-blue-50 px-3 text-sm font-semibold text-gov-blue transition-all hover:translate-x-0.5 hover:border-gov-blue hover:bg-gov-blue hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gov-blue text-white">
                  <TentTree aria-hidden="true" className="size-4.5" />
                </span>
                <span className="flex-1 text-left">Evacuation Centers</span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Live map</span>
              </button>
            ) : null}
          </div>

          {!preview ? (
            <>
              <p className="mb-2 mt-6 px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Portals</p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenLogin?.("admin")}
                  className="h-11 w-full justify-start gap-2 border-slate-200 text-sm font-medium text-slate-700 hover:border-gov-blue hover:text-gov-blue focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
                >
                  <LogIn aria-hidden="true" className="size-4" />
                  MDRRMO Login
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenLogin?.("barangay")}
                  className="h-11 w-full justify-start gap-2 border-slate-200 text-sm font-medium text-slate-700 hover:border-gov-blue hover:text-gov-blue focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
                >
                  <Globe aria-hidden="true" className="size-4" />
                  Barangay Public
                </Button>
                <p className="px-1 text-[11px] leading-relaxed text-slate-400">
                  Browse the 33 barangay frontpages — each barangay’s own public page with announcements, services, events
                  and contacts. Barangay staff sign in from their frontpage.
                </p>
              </div>
            </>
          ) : null}
        </div>

        <div className="border-t border-slate-100 p-4">
          <p className="mb-3 text-center text-[10px] font-medium tracking-wide text-slate-400">
            REPUBLIC OF THE PHILIPPINES · MUNICIPALITY OF PIO DURAN · ALBAY
          </p>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              scrollToAnchor("main-content");
            }}
            className="w-full rounded-lg bg-gov-blue px-4 py-3 text-sm font-bold text-white hover:bg-gov-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
          >
            Close Menu
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
