"use client";

// QAS33 Public Portal — mobile bottom app bar (auto-shown on phones/tablets).
//
// App-like primary actions, always one thumb-tap away:
//   Home · Emergency Hotlines · [REPORT INCIDENT — raised red FAB] · · Menu
// NORMAL keeps Weather in the 4th slot; TYPHOON/EMERGENCY swaps it for an
// "Evacuate" action (TentTree) that opens the full-screen evacuation finder.
// Auto-detects mobile via CSS breakpoints (md:hidden) — no UA sniffing.
// Uses position:sticky (bottom-0) rather than fixed: it lives IN the document
// flow at the end of the site column (never covers content, no spacer needed)
// while staying pinned to the viewport bottom — and inside the admin's phone
// preview frame it pins to that frame's scrollport exactly like a real phone.
//
// Task 3-c polish: gold hairline accent on the top edge, active state with a
// gold indicator dot + gov-blue (gold in emergency) label, safe-area padding.

import * as React from "react";
import { House, Menu, PhoneCall, Siren, TentTree, Thermometer } from "lucide-react";

import { cn } from "@/lib/utils";
import { scrollToAnchor } from "./portal-shared";

interface PortalBottomBarProps {
  emergency?: boolean;
  onOpenModal: (modal: "hotlines" | "report") => void;
  /** Opens the hamburger navigation drawer (state owned by the site view). */
  onOpenMenu: () => void;
  /** Opens the full-screen evacuation finder — when provided AND in emergency
   *  mode, the Weather slot becomes "Evacuate". */
  onOpenEvac?: () => void;
  /** Anchor of the weather section (falls back to page top when missing). */
  weatherAnchor?: string;
  /** Hide while a fullscreen modal is open (avoids showing through the overlay). */
  hidden?: boolean;
  /** Show even on wide viewports — used by the admin mobile preview frame
      (CSS media queries evaluate the browser width, not the frame width). */
  forceVisible?: boolean;
}

function BarButton({
  label,
  icon,
  onClick,
  emergency,
  active = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  emergency?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active || undefined}
      className={cn(
        "group relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-0 active:scale-95",
        active
          ? emergency
            ? "text-gov-gold"
            : "text-gov-blue"
          : emergency
            ? "text-red-200 hover:text-white"
            : "text-slate-600 hover:text-gov-blue"
      )}
    >
      {/* Gold indicator dot — present in the layout for every item, visible when active */}
      <span
        aria-hidden="true"
        className={cn(
          "size-1 rounded-full transition-opacity",
          active ? "bg-gov-gold opacity-100" : "bg-transparent opacity-0"
        )}
      />
      {icon}
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

export function PortalBottomAppBar({
  emergency,
  onOpenModal,
  onOpenMenu,
  onOpenEvac,
  weatherAnchor = "weather",
  hidden,
  forceVisible,
}: PortalBottomBarProps) {
  const iconSize = "size-5";
  // TYPHOON/EMERGENCY swaps the Weather slot for the Evacuate action.
  const showEvacuate = emergency && !!onOpenEvac;
  // "Home" is the active destination while the page rests at the top.
  const [atTop, setAtTop] = React.useState(true);
  React.useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav
      aria-label="Quick actions"
      hidden={hidden}
      className={cn(
        "sticky bottom-0 z-40 border-t transition-opacity",
        !forceVisible && "md:hidden",
        hidden && "pointer-events-none opacity-0",
        emergency
          ? "border-red-900/60 bg-red-950/95 backdrop-blur"
          : "border-slate-200/80 bg-white/95 backdrop-blur"
      )}
    >
      {/* Gold accent hairline on the top edge */}
      <div
        aria-hidden="true"
        className={cn(
          "h-0.5 w-full",
          emergency
            ? "bg-gradient-to-r from-red-800/0 via-gov-gold/80 to-red-800/0"
            : "bg-gradient-to-r from-transparent via-gov-gold/80 to-transparent"
        )}
      />
      <div
        className={cn(
          "mx-auto grid max-w-md grid-cols-5 items-end px-2",
          "pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        )}
      >
        <BarButton
          label="Home"
          emergency={emergency}
          active={atTop}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          icon={<House aria-hidden="true" className={iconSize} />}
        />
        <BarButton
          label="Hotlines"
          emergency={emergency}
          onClick={() => onOpenModal("hotlines")}
          icon={<PhoneCall aria-hidden="true" className={iconSize} />}
        />

        {/* Raised REPORT FAB — the hero action on mobile */}
        <div className="relative flex items-end justify-center">
          <button
            type="button"
            onClick={() => onOpenModal("report")}
            aria-label="Report an incident"
            className={cn(
              "relative -mb-1 flex size-14 flex-col items-center justify-center gap-0.5 rounded-full text-white shadow-lg transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 active:scale-95",
              emergency
                ? "portal-status-dot bg-gradient-to-br from-red-500 to-emergency-red-dark ring-2 ring-gov-gold/70"
                : "bg-gradient-to-br from-red-500 to-emergency-red"
            )}
          >
            <Siren aria-hidden="true" className="size-6" />
            <span className="text-[8px] font-extrabold uppercase tracking-widest">Report</span>
          </button>
        </div>

        {showEvacuate ? (
          <BarButton
            label="Evacuate"
            emergency={emergency}
            onClick={() => onOpenEvac?.()}
            icon={<TentTree aria-hidden="true" className={iconSize} />}
          />
        ) : (
          <BarButton
            label="Weather"
            emergency={emergency}
            onClick={() => scrollToAnchor(weatherAnchor)}
            icon={<Thermometer aria-hidden="true" className={iconSize} />}
          />
        )}
        <BarButton
          label="Menu"
          emergency={emergency}
          onClick={onOpenMenu}
          icon={<Menu aria-hidden="true" className={iconSize} />}
        />
      </div>
    </nav>
  );
}
