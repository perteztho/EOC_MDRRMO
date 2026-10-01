"use client";

// QAS33 Public Portal — live evacuation section upgrades.
//
//  • EvacuationLiveSection — replaces the static content-directory rendering of
//    the "evacuation" section template with LIVE data from
//    GET /api/public/evacuation: summary stat chips, top center cards (sorted
//    by available slots — horizontal snap-scroll on phones, grid on desktop),
//    active evacuation announcements and the big CTA that opens the
//    full-screen interactive finder. Falls back to the legacy directory cards
//    when the live API is unavailable (or the public page is hidden).
//  • EvacuationMapSection — "evacuationMap" template: embedded interactive
//    Leaflet map + top open-centers summary + link into the full finder.

import * as React from "react";
import { ArrowRight, MapPin, Siren, TentTree } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EvacAnnouncementDTO, PublicEvacResponse } from "@/lib/qas33/emergency-types";
import { timeAgo } from "./portal-shared";
import { EvacMap } from "./evac-map";
import { CapacityBar, StatusBadge } from "./portal-evacuation";
import { PortalPushCard } from "./portal-push";
import type { PushStatusDTO } from "@/lib/qas33/emergency-types";
import { useToast } from "@/hooks/use-toast";

/** Priority → announcement mini-card styles (shared with the finder). */
export const EVAC_ANNOUNCEMENT_STYLES: Record<string, { label: string; badge: string; border: string }> = {
  NORMAL: { label: "Advisory", badge: "border-slate-200 bg-slate-50 text-slate-700", border: "border-l-slate-400" },
  HIGH: { label: "High", badge: "border-amber-200 bg-amber-50 text-amber-800", border: "border-l-amber-500" },
  URGENT: { label: "Urgent", badge: "border-orange-200 bg-orange-50 text-orange-800", border: "border-l-orange-500" },
  CRITICAL: { label: "Critical", badge: "border-red-200 bg-red-50 text-red-800", border: "border-l-red-600" },
};

function SectionStatChip({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "emerald" | "blue" | "amber";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3.5 text-center",
        tone === "emerald" && "border-emerald-200 bg-emerald-50",
        tone === "blue" && "border-gov-blue-100 bg-gov-blue-50",
        tone === "amber" && "border-amber-200 bg-amber-50"
      )}
    >
      <p
        className={cn(
          "text-2xl font-extrabold tabular-nums md:text-3xl",
          tone === "emerald" && "text-emerald-700",
          tone === "blue" && "text-gov-blue",
          tone === "amber" && "text-amber-700"
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          "mt-1 text-[10px] font-bold uppercase tracking-wider",
          tone === "emerald" && "text-emerald-800/80",
          tone === "blue" && "text-gov-blue/80",
          tone === "amber" && "text-amber-800/80"
        )}
      >
        {label}
      </p>
    </div>
  );
}

export interface EvacuationLiveSectionProps {
  /** Section shell (heading/config/CTA) — rendered by the caller. */
  evacuation: PublicEvacResponse;
  onOpenEvac?: () => void;
  pushStatus?: PushStatusDTO | null;
}

export function EvacuationLiveSection({ evacuation, onOpenEvac, pushStatus }: EvacuationLiveSectionProps) {
  const { centers, stats, announcements } = evacuation;
  const open = stats.openCenters;
  const canOpenFinder = !!onOpenEvac;

  // Top centers by available slots (CLOSED/PREPARING sink to the end).
  const top = React.useMemo(
    () =>
      [...centers]
        .sort((a, b) => {
          const rank = (s: string) => (s === "CLOSED" || s === "PREPARING" ? 1 : 0);
          if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
          return b.availableSlots - a.availableSlots;
        })
        .slice(0, 6),
    [centers]
  );

  return (
    <div className="space-y-6">
      {/* Summary stat chips */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <SectionStatChip value={String(open)} label="Open centers" tone="emerald" />
        <SectionStatChip value={stats.currentEvacuees.toLocaleString("en-PH")} label="Evacuees" tone="blue" />
        <SectionStatChip value={stats.availableSpaces.toLocaleString("en-PH")} label="Available slots" tone="amber" />
      </div>
      <p className="text-xs text-slate-500">
        Live from the MDRRMO — last synchronized {timeAgo(evacuation.generatedAt)}. Combined rated capacity:{" "}
        <span className="font-semibold text-slate-700">
          {stats.totalFamilies.toLocaleString("en-PH")} families ({stats.totalCapacity.toLocaleString("en-PH")} individuals)
        </span>
        .
      </p>

      {/* Active evacuation announcements */}
      {announcements.length > 0 ? (
        <div className="space-y-2.5" aria-label="Evacuation announcements">
          {announcements.slice(0, 2).map((a) => (
            <EvacAnnouncementMini key={a.id} a={a} />
          ))}
          {announcements.length > 2 ? (
            <p className="text-center text-xs text-slate-500">
              + {announcements.length - 2} more announcement{announcements.length - 2 > 1 ? "s" : ""} — open the map for details.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Top center cards — horizontal snap-scroll on phones, grid on desktop */}
      {top.length > 0 ? (
        <div
          className="portal-no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3"
          role="list"
          aria-label="Evacuation centers with the most available slots"
        >
          {top.map((c) => (
            <article
              key={c.id}
              role="listitem"
              className="flex w-72 shrink-0 snap-start flex-col gap-3 rounded-2xl portal-glass p-5 transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-auto"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold leading-snug text-slate-900">{c.name}</h3>
                <StatusBadge status={c.status} />
              </div>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="font-semibold text-gov-blue">Brgy. {c.barangay}</span>
              </p>
              <CapacityBar c={c} />
            </article>
          ))}
        </div>
      ) : null}

      {/* Push card + big CTA */}
      {pushStatus ? <PortalPushCard pushStatus={pushStatus} context="evacuation" /> : null}
      {canOpenFinder ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gov-blue-100 bg-gov-blue-50 p-6 text-center sm:p-8">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gov-blue text-white shadow-sm">
            <TentTree aria-hidden="true" className="size-7" />
          </span>
          <div>
            <h3 className="text-lg font-bold text-gov-blue-deep">Find your nearest evacuation center</h3>
            <p className="mx-auto mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600">
              Open the interactive map to see live status, capacity, directions and contact details for all{" "}
              {centers.length} evacuation centers in Pio Duran.
            </p>
          </div>
          <Button
            type="button"
            onClick={onOpenEvac}
            className="mt-1 h-12 gap-2 bg-gov-blue px-6 text-sm font-bold hover:bg-gov-blue-700"
          >
            Open Interactive Map &amp; Find a Center
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function EvacAnnouncementMini({ a }: { a: EvacAnnouncementDTO }) {
  const style = EVAC_ANNOUNCEMENT_STYLES[a.priority] ?? EVAC_ANNOUNCEMENT_STYLES.NORMAL;
  return (
    <div className={cn("rounded-xl border-l-4 portal-glass p-4", style.border)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", style.badge)}>
          {style.label}
        </span>
        <span className="text-[11px] text-slate-400">{timeAgo(a.publishAt)}</span>
        {a.targetBarangays.length > 0 ? (
          <span className="text-[11px] font-medium text-slate-500">Brgy. {a.targetBarangays.slice(0, 3).join(", ")}</span>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm font-bold text-slate-900">{a.title}</p>
      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">{a.message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// evacuationMap — embedded interactive map template
// ---------------------------------------------------------------------------

export interface EvacuationMapSectionBodyProps {
  evacuation: PublicEvacResponse;
  onOpenEvac?: () => void;
}

export function EvacuationMapSectionBody({ evacuation, onOpenEvac }: EvacuationMapSectionBodyProps) {
  const { toast } = useToast();
  const centers = evacuation.centers;
  const openCenters = centers.filter((c) => c.status === "OPEN" || c.status === "NEAR_CAPACITY");

  const topOpen = React.useMemo(
    () => [...openCenters].sort((a, b) => b.availableSlots - a.availableSlots).slice(0, 3),
    [openCenters]
  );

  const onFindNearest = () => {
    if (!("geolocation" in navigator)) {
      toast({ title: "Location not supported", description: "Browse the list or open the full map instead." });
      return;
    }
    toast({ title: "Opening map", description: "Use “Find Nearest” inside the map to locate the closest center." });
    onOpenEvac?.();
  };

  return (
    <div className="space-y-5">
      <div className="h-[380px] w-full">
        <EvacMap
          centers={centers}
          onSelect={(id) => {
            const c = centers.find((x) => x.id === id);
            if (c) {
              toast({
                title: c.name,
                description: `Brgy. ${c.barangay} — ${c.status.replace("_", " ")} · ${c.availableSlots.toLocaleString("en-PH")} slots available. Open the full map for details.`,
              });
            }
          }}
          autoFit
          scrollWheelZoom={false}
        />
      </div>

      {/* Top open centers summary */}
      {topOpen.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {topOpen.map((c, i) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-xl portal-glass p-4"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-extrabold text-emerald-700">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-500">
                  Brgy. {c.barangay} ·{" "}
                  <span className="font-bold text-emerald-700">{c.availableSlots.toLocaleString("en-PH")} slots</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl portal-glass px-4 py-6 text-center text-sm text-slate-500">
          No evacuation centers are currently open. During emergencies, live status appears here.
        </p>
      )}

      {onOpenEvac ? (
        <div className="flex justify-center">
          <Button
            type="button"
            onClick={onFindNearest}
            className="h-12 gap-2 bg-gov-blue px-6 text-sm font-bold hover:bg-gov-blue-700"
          >
            <MapPin aria-hidden="true" className="size-4" />
            Open Full Evacuation Finder
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : null}

      <p className="text-center text-xs text-slate-500">
        <Siren aria-hidden="true" className="mr-1 inline size-3.5 text-emergency-red" />
        Live from the MDRRMO — last synchronized {timeAgo(evacuation.generatedAt)}.
      </p>
    </div>
  );
}
