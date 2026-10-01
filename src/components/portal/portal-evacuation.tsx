"use client";

// QAS33 Public Portal — FULL-SCREEN public Evacuation Finder.
//
// Opened from multiple CTAs (hero emergency button, evacuation section,
// bottom-bar "Evacuate" slot in TYPHOON mode, nav drawer, quick actions).
// Layout: desktop = left 45% sticky Leaflet map + right scrolling list;
// mobile = map top (45vh) + scrolling list beneath. Center details open in a
// desktop Dialog / mobile bottom-sheet (vaul). Includes live filters,
// "Find Nearest" geolocation ranking, evacuation announcements strip and a
// push-subscription card. Renders correctly under BOTH themes — in TYPHOON
// mode the root <html> carries .portal-dark so every utility used here is
// remapped onto the emergency-operations palette.

import * as React from "react";
import {
  ArrowLeft,
  Accessibility,
  BedDouble,
  CheckCircle2,
  Droplets,
  Fuel,
  HeartPulse,
  Info,
  LocateFixed,
  MapPin,
  Navigation,
  Package,
  PawPrint,
  Phone,
  PhoneCall,
  Search,
  Siren,
  TentTree,
  Users,
  Zap,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  EVAC_CAPACITY_META,
  EVAC_STATUS_META,
  type EvacAnnouncementDTO,
  type EvacCenterDTO,
  type EvacCenterStatus,
  type PublicEvacResponse,
  type PushStatusDTO,
} from "@/lib/qas33/emergency-types";
import type { OperationalMode } from "@/lib/qas33/portal-types";
import { timeAgo, telHref } from "./portal-shared";
import { EvacMap } from "./evac-map";
import { PortalPushCard } from "./portal-push";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Great-circle distance in km (haversine). */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

const STATUS_OPTIONS: Array<{ value: EvacCenterStatus; label: string }> = [
  { value: "OPEN", label: "Open" },
  { value: "NEAR_CAPACITY", label: "Near Capacity" },
  { value: "FULL", label: "Full" },
  { value: "PREPARING", label: "Preparing" },
  { value: "CLOSED", label: "Closed" },
];

const ANNOUNCEMENT_PRIORITY_STYLES: Record<string, { label: string; badge: string; border: string }> = {
  NORMAL: {
    label: "Advisory",
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    border: "border-l-slate-400",
  },
  HIGH: {
    label: "High",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    border: "border-l-amber-500",
  },
  URGENT: {
    label: "Urgent",
    badge: "border-orange-200 bg-orange-50 text-orange-800",
    border: "border-l-orange-500",
  },
  CRITICAL: {
    label: "Critical",
    badge: "border-red-200 bg-red-50 text-red-800",
    border: "border-l-red-600",
  },
};

const FACILITY_TYPE_LABELS: Record<string, string> = {
  SCHOOL: "School",
  BARANGAY_HALL: "Barangay Hall",
  MUNICIPAL_EVAC_CENTER: "Municipal Evacuation Center",
  MULTI_PURPOSE_HALL: "Multi-Purpose Hall",
  MUNICIPAL_BUILDING: "Municipal Building",
  RHU: "Rural Health Unit (RHU)",
  GYMNASIUM: "Gymnasium",
  COVERED_COURT: "Covered Court",
  CHURCH: "Church / Chapel",
  CHURCH_SCHOOL: "Church / School Building",
  EVAC_SITE: "Designated Evacuation Site",
  OTHER: "Other Facility",
};

/** ≥768px media query hook (Dialog vs bottom-sheet). */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = React.useState(true);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

function directionsUrl(c: EvacCenterDTO): string {
  if (c.latitude != null && c.longitude != null && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`;
  }
  const label = `${c.name}, ${c.address || "Brgy. " + c.barangay}, Pio Duran, Albay`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(label)}`;
}

/** Facility amenity chips (icon + tooltip via title). */
function FacilityChips({ c, className }: { c: EvacCenterDTO; className?: string }) {
  const chips: Array<{ key: string; label: string; on: boolean; icon: React.ReactNode }> = [
    {
      key: "water",
      label: c.waterStatus === "AVAILABLE" ? "Water available" : c.waterStatus === "LIMITED" ? "Water limited" : "Water unavailable",
      on: c.waterStatus !== "UNAVAILABLE",
      icon: <Droplets aria-hidden="true" className="size-3.5" />,
    },
    {
      key: "power",
      label: c.electricityStatus === "AVAILABLE" ? "Electricity available" : c.electricityStatus === "GENERATOR_ONLY" ? "Generator power only" : "No electricity",
      on: c.electricityStatus !== "UNAVAILABLE",
      icon: <Zap aria-hidden="true" className="size-3.5" />,
    },
    {
      key: "medical",
      label: "Medical assistance",
      on: c.medicalAssistance,
      icon: <HeartPulse aria-hidden="true" className="size-3.5" />,
    },
    { key: "food", label: "Food / relief", on: c.foodRelief, icon: <Package aria-hidden="true" className="size-3.5" /> },
    { key: "sleep", label: "Sleeping area", on: c.sleepingArea, icon: <BedDouble aria-hidden="true" className="size-3.5" /> },
    { key: "gen", label: "Generator on-site", on: c.generator, icon: <Fuel aria-hidden="true" className="size-3.5" /> },
    { key: "pets", label: "Pets allowed", on: c.petsAllowed, icon: <PawPrint aria-hidden="true" className="size-3.5" /> },
    { key: "access", label: "Accessible facilities", on: !!c.accessibleFacilities, icon: <Accessibility aria-hidden="true" className="size-3.5" /> },
  ];
  const active = chips.filter((ch) => ch.on);
  if (active.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {active.map((ch) => (
        <span
          key={ch.key}
          title={ch.label}
          className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800"
        >
          {ch.icon}
          <span className="sr-only">{ch.label}</span>
        </span>
      ))}
    </div>
  );
}

export function CapacityBar({ c }: { c: EvacCenterDTO }) {
  const meta = EVAC_CAPACITY_META[c.capacityLevel] ?? EVAC_CAPACITY_META.UNKNOWN;
  const pct = Math.max(0, Math.min(100, c.occupancyPct));
  return (
    <div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${c.name} occupancy`}
      >
        <div className={cn("h-full rounded-full transition-all", meta.bar)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
        <span className="font-semibold tabular-nums text-slate-700">
          {c.currentOccupants.toLocaleString("en-PH")} of {c.capacity.toLocaleString("en-PH")} persons occupied
        </span>
        {c.capacityFamilies != null ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="font-medium tabular-nums text-slate-600">
              {c.capacityFamilies.toLocaleString("en-PH")} families capacity
            </span>
          </>
        ) : null}
        <span aria-hidden="true">·</span>
        <span className={cn("font-bold tabular-nums", c.availableSlots > 0 ? "text-emerald-700" : "text-red-700")}>
          {c.availableSlots > 0 ? `${c.availableSlots.toLocaleString("en-PH")} slots available` : "No slots available"}
        </span>
      </p>
    </div>
  );
}

export function StatusBadge({ status }: { status: EvacCenterStatus }) {
  const meta = EVAC_STATUS_META[status];
  return (
    <Badge variant="outline" className={cn("shrink-0 text-[10px] font-bold uppercase tracking-wide", meta.badge)}>
      <span aria-hidden="true" className={cn("mr-1 size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Announcements strip
// ---------------------------------------------------------------------------

function AnnouncementStrip({ announcements }: { announcements: EvacAnnouncementDTO[] }) {
  if (announcements.length === 0) return null;
  return (
    <div className="space-y-2.5" aria-label="Evacuation announcements">
      {announcements.map((a) => {
        const style = ANNOUNCEMENT_PRIORITY_STYLES[a.priority] ?? ANNOUNCEMENT_PRIORITY_STYLES.NORMAL;
        return (
          <div
            key={a.id}
            className={cn("rounded-xl border border-l-4 border-slate-200/80 bg-white p-4 shadow-sm", style.border)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-wide", style.badge)}>
                {style.label}
              </Badge>
              {a.targetBarangays.length > 0 ? (
                <span className="text-[11px] font-medium text-slate-500">
                  Brgy. {a.targetBarangays.slice(0, 3).join(", ")}
                  {a.targetBarangays.length > 3 ? ` +${a.targetBarangays.length - 3}` : ""}
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-500">All barangays</span>
              )}
              <span className="text-[11px] text-slate-400">{timeAgo(a.publishAt)}</span>
            </div>
            <p className="mt-2 text-sm font-bold text-slate-900">{a.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{a.message}</p>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Center card (list)
// ---------------------------------------------------------------------------

interface CenterCardProps {
  center: EvacCenterDTO;
  selected: boolean;
  nearest: boolean;
  distanceKm?: number;
  onOpen: () => void;
  onHover?: (id: string | null) => void;
}

function CenterCard({ center: c, selected, nearest, distanceKm, onOpen, onHover }: CenterCardProps) {
  return (
    <article
      onClick={onOpen}
      onMouseEnter={() => onHover?.(c.id)}
      onMouseLeave={() => onHover?.(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${c.name}`}
      className={cn(
        "flex cursor-pointer flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold sm:p-5",
        selected ? "border-gov-blue ring-2 ring-gov-blue/30" : "border-slate-200/70",
        nearest && "border-emerald-400 ring-2 ring-emerald-200"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold leading-snug text-slate-900">{c.name}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="font-semibold text-gov-blue">Brgy. {c.barangay}</span>
            {c.address ? <span className="truncate">· {c.address}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={c.status} />
          {distanceKm != null ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gov-blue-50 px-2 py-0.5 text-[10px] font-bold tabular-nums text-gov-blue">
              <Navigation aria-hidden="true" className="size-3" />
              {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
            </span>
          ) : null}
          {nearest ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <CheckCircle2 aria-hidden="true" className="size-3" />
              Nearest
            </span>
          ) : null}
        </div>
      </div>

      <CapacityBar c={c} />

      <FacilityChips c={c} />

      {c.vulnerableTotal > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Users aria-hidden="true" className="size-3.5 shrink-0" />
          <span>
            <span className="font-semibold text-slate-700">{c.vulnerableTotal.toLocaleString("en-PH")} vulnerable evacuees</span>{" "}
            ({c.childrenOccupants} children · {c.seniorOccupants} seniors · {c.pwdOccupants} PWD
            {c.pregnantOccupants > 0 ? ` · ${c.pregnantOccupants} pregnant` : ""})
          </span>
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {c.contactPerson ? (
          <span className="mr-auto flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
            <span aria-hidden="true" className="font-semibold text-slate-600">Contact:</span>
            <span className="truncate font-medium text-slate-700">{c.contactPerson}</span>
          </span>
        ) : (
          <span className="mr-auto" />
        )}
        {c.contactNumber ? (
          <a
            href={telHref(c.contactNumber)}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gov-gold px-3 text-xs font-bold text-gov-blue-deep transition-colors hover:bg-gov-gold-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
          >
            <PhoneCall aria-hidden="true" className="size-3.5" />
            Call
          </a>
        ) : null}
        <a
          href={directionsUrl(c)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-bold text-gov-blue transition-colors hover:border-gov-blue hover:bg-gov-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
        >
          <Navigation aria-hidden="true" className="size-3.5" />
          Directions
        </a>
      </div>
      <p className="text-[11px] text-slate-400">Updated {timeAgo(c.lastUpdated)}</p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Center detail body (shared by Dialog + bottom sheet)
// ---------------------------------------------------------------------------

function CenterDetailBody({
  center: c,
  announcements,
  distanceKm,
}: {
  center: EvacCenterDTO;
  announcements: EvacAnnouncementDTO[];
  distanceKm?: number;
}) {
  const targeting = announcements.filter(
    (a) =>
      a.targetCenterIds.includes(c.id) ||
      a.targetBarangays.includes(c.barangay) ||
      (a.targetCenterIds.length === 0 && a.targetBarangays.length === 0)
  );
  return (
    <div className="space-y-5">
      {/* Focused mini-map */}
      <div className="h-56 w-full overflow-hidden rounded-xl border border-slate-200/80 sm:h-64">
        <EvacMap
          centers={[c]}
          selectedId={c.id}
          autoFit
          showLegend={false}
          scrollWheelZoom={false}
          className="h-full w-full rounded-none border-0"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={c.status} />
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600">
          {FACILITY_TYPE_LABELS[c.facilityType] || c.facilityType}
        </Badge>
        {distanceKm != null ? (
          <Badge variant="outline" className="border-gov-blue-100 bg-gov-blue-50 text-[10px] font-bold tabular-nums text-gov-blue">
            {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} away
          </Badge>
        ) : null}
      </div>

      <CapacityBar c={c} />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Barangay</dt>
          <dd className="mt-0.5 font-medium text-slate-800">{c.barangay}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Capacity (families)</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-slate-800">
            {c.capacityFamilies != null ? `${c.capacityFamilies.toLocaleString("en-PH")} families` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Capacity (individuals)</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-slate-800">
            {c.capacity.toLocaleString("en-PH")} persons
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Address</dt>
          <dd className="mt-0.5 font-medium text-slate-800">{c.address || `Brgy. ${c.barangay}, Pio Duran, Albay`}</dd>
        </div>
        {c.landAreaSqm != null ? (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Land area</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-slate-800">
              {c.landAreaSqm.toLocaleString("en-PH", { maximumFractionDigits: 2 })} sqm
            </dd>
          </div>
        ) : null}
        {c.latitude != null && c.longitude != null ? (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">GPS coordinates</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-slate-800">
              {c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact person</dt>
          <dd className="mt-0.5 font-medium text-slate-800">{c.contactPerson || "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact number</dt>
          <dd className="mt-0.5 font-medium text-slate-800">{c.contactNumber || "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Last updated</dt>
          <dd className="mt-0.5 font-medium text-slate-800">{timeAgo(c.lastUpdated)}</dd>
        </div>
      </dl>

      <FacilityChips c={c} />

      {c.vulnerableTotal > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <Users aria-hidden="true" className="size-4" />
            Vulnerable evacuees: {c.vulnerableTotal.toLocaleString("en-PH")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            {c.childrenOccupants} children · {c.seniorOccupants} seniors · {c.pwdOccupants} PWD · {c.pregnantOccupants} pregnant
            {c.otherVulnerable > 0 ? ` · ${c.otherVulnerable} other vulnerable` : ""}
          </p>
        </div>
      ) : null}

      {c.specialNotes || c.notes ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <Info aria-hidden="true" className="size-3.5" />
            Notes
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{c.specialNotes || c.notes}</p>
        </div>
      ) : null}

      {targeting.length > 0 ? (
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Siren aria-hidden="true" className="size-3.5" />
            Announcements for this center
          </p>
          <AnnouncementStrip announcements={targeting} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {c.contactNumber ? (
          <a
            href={telHref(c.contactNumber)}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-gov-gold px-4 text-sm font-bold text-gov-blue-deep transition-colors hover:bg-gov-gold-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
          >
            <PhoneCall aria-hidden="true" className="size-4" />
            Call {c.contactNumber}
          </a>
        ) : null}
        <a
          href={directionsUrl(c)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-gov-blue transition-colors hover:border-gov-blue hover:bg-gov-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
        >
          <Navigation aria-hidden="true" className="size-4" />
          Get Directions
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main overlay
// ---------------------------------------------------------------------------

export interface PortalEvacuationProps {
  open: boolean;
  onClose: () => void;
  data: PublicEvacResponse | null;
  /** Set when the last refresh failed (previous data kept). */
  error?: string | null;
  onRetry?: () => void;
  mode: OperationalMode;
  pushStatus: PushStatusDTO | null;
  /** MDRRMO hotline for the emergency banner. */
  hotline?: string;
}

export function PortalEvacuation({
  open,
  onClose,
  data,
  error,
  onRetry,
  mode,
  pushStatus,
  hotline,
}: PortalEvacuationProps) {
  const { toast } = useToast();
  const isDesktop = useIsDesktop();
  const emergency = mode !== "NORMAL";

  // Filters
  const [search, setSearch] = React.useState("");
  const [barangayFilter, setBarangayFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [slotsOnly, setSlotsOnly] = React.useState(false);
  const [openOnly, setOpenOnly] = React.useState(false);

  // Interaction state
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [hoverId, setHoverId] = React.useState<string | null>(null);
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [locError, setLocError] = React.useState<string | null>(null);

  // Close on Escape + lock page scroll while the overlay is open.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedId === null) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, selectedId]);

  // Reset transient state when reopened.
  React.useEffect(() => {
    if (open) {
      setSelectedId(null);
      setHoverId(null);
      setLocError(null);
    }
  }, [open]);

  const centers = data?.centers ?? [];

  const barangays = React.useMemo(
    () => Array.from(new Set(centers.map((c) => c.barangay))).sort((a, b) => a.localeCompare(b)),
    [centers]
  );

  /** center id → distance km from the user (when located). */
  const distances = React.useMemo(() => {
    const map = new Map<string, number>();
    if (!userLocation) return map;
    for (const c of centers) {
      if (c.latitude == null || c.longitude == null) continue;
      map.set(c.id, haversineKm(userLocation, { lat: c.latitude, lng: c.longitude }));
    }
    return map;
  }, [centers, userLocation]);

  const visibleCenters = React.useMemo(() => {
    let list = centers;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.barangay.toLowerCase().includes(q) ||
          (c.address ?? "").toLowerCase().includes(q)
      );
    }
    if (barangayFilter !== "ALL") list = list.filter((c) => c.barangay === barangayFilter);
    if (statusFilter !== "ALL") list = list.filter((c) => c.status === statusFilter);
    if (slotsOnly) list = list.filter((c) => c.availableSlots > 0 && c.status !== "CLOSED");
    if (openOnly) list = list.filter((c) => c.status !== "CLOSED" && c.status !== "PREPARING");
    if (userLocation) {
      list = [...list].sort((a, b) => (distances.get(a.id) ?? Infinity) - (distances.get(b.id) ?? Infinity));
    }
    return list;
  }, [centers, search, barangayFilter, statusFilter, slotsOnly, openOnly, userLocation, distances]);

  const nearestId = React.useMemo(() => {
    if (!userLocation || visibleCenters.length === 0) return null;
    const candidates = visibleCenters.filter((c) => c.availableSlots > 0 && c.status !== "CLOSED");
    const pool = candidates.length > 0 ? candidates : visibleCenters;
    return pool[0]?.id ?? null;
  }, [visibleCenters, userLocation]);

  const selected = centers.find((c) => c.id === selectedId) ?? null;

  const findNearest = () => {
    if (!("geolocation" in navigator)) {
      setLocError("Location is not supported on this device — browse the list instead.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast({
          title: "Sorted by distance",
          description: "Centers are now ranked by distance from your location.",
        });
      },
      () => {
        setLocating(false);
        setLocError("Location unavailable — browse the list instead.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  if (!open) return null;

  const stats = data?.stats;
  const listPane = (
    <div className="flex min-h-0 flex-1 flex-col lg:h-full">
      {/* Filters bar */}
      <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search center or barangay…"
                aria-label="Search evacuation centers"
                className="h-10 pl-9 text-sm"
              />
            </div>
            <Select value={barangayFilter} onValueChange={setBarangayFilter}>
              <SelectTrigger aria-label="Filter by barangay" className="h-10 w-[38%] max-w-44 shrink-0 text-sm">
                <SelectValue placeholder="Barangay" />
              </SelectTrigger>
              <SelectContent className="max-h-72 portal-scroll">
                <SelectItem value="ALL">All barangays</SelectItem>
                {barangays.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Filter by status" className="h-9 w-auto gap-1.5 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              aria-pressed={slotsOnly}
              onClick={() => setSlotsOnly((v) => !v)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold",
                slotsOnly
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-emerald-500 hover:text-emerald-700"
              )}
            >
              <CheckCircle2 aria-hidden="true" className="size-3.5" />
              Available slots only
            </button>
            <button
              type="button"
              aria-pressed={openOnly}
              onClick={() => setOpenOnly((v) => !v)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold",
                openOnly
                  ? "border-gov-blue bg-gov-blue text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-gov-blue hover:text-gov-blue"
              )}
            >
              <span aria-hidden="true" className={cn("size-2 rounded-full", openOnly ? "bg-white" : "bg-emerald-500")} />
              Open now
            </button>
            {userLocation ? (
              <button
                type="button"
                onClick={() => setUserLocation(null)}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-500 transition-colors hover:border-red-300 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
              >
                <X aria-hidden="true" className="size-3.5" />
                Clear location
              </button>
            ) : null}
          </div>
          {locError ? (
            <p role="status" className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <Info aria-hidden="true" className="size-3.5 shrink-0" />
              {locError}
            </p>
          ) : null}
        </div>
      </div>

      {/* Scrollable list */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 portal-scroll sm:px-5">
        {/* Live summary chips */}
        {stats ? (
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center">
              <p className="text-lg font-extrabold tabular-nums text-emerald-700 sm:text-xl">{stats.openCenters}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Open centers</p>
            </div>
            <div className="rounded-xl border border-gov-blue-100 bg-gov-blue-50 px-3 py-2.5 text-center">
              <p className="text-lg font-extrabold tabular-nums text-gov-blue sm:text-xl">
                {stats.currentEvacuees.toLocaleString("en-PH")}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gov-blue">Evacuees</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center">
              <p className="text-lg font-extrabold tabular-nums text-amber-700 sm:text-xl">
                {stats.availableSpaces.toLocaleString("en-PH")}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Available slots</p>
            </div>
          </div>
        ) : null}

        {/* Push subscription card */}
        <PortalPushCard pushStatus={pushStatus} context="evacuation" />

        {/* Announcements */}
        {data?.announcements?.length ? <AnnouncementStrip announcements={data.announcements} /> : null}

        {/* Centers */}
        {!data && !error ? (
          <div className="space-y-4" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : data && visibleCenters.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-gov-blue-50 text-gov-blue">
              <TentTree aria-hidden="true" className="size-7" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-slate-800">No centers match your filters</h3>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
              Try clearing the search or switching the status filter. During emergencies, updated information appears here as
              soon as the MDRRMO posts it.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-5 h-10 gap-2 border-slate-300 text-slate-700 hover:border-gov-blue hover:text-gov-blue"
              onClick={() => {
                setSearch("");
                setBarangayFilter("ALL");
                setStatusFilter("ALL");
                setSlotsOnly(false);
                setOpenOnly(false);
              }}
            >
              Clear all filters
            </Button>
          </div>
        ) : data && centers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-gov-blue-50 text-gov-blue">
              <MapPin aria-hidden="true" className="size-7" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-slate-800">No evacuation centers published</h3>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
              {data.visible
                ? "The MDRRMO has not published evacuation centers yet. During emergencies, updated information will appear here."
                : "Evacuation information is currently not published. Contact the MDRRMO directly for assistance."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleCenters.map((c) => (
              <CenterCard
                key={c.id}
                center={c}
                selected={hoverId === c.id || selectedId === c.id}
                nearest={nearestId === c.id && !!userLocation}
                distanceKm={distances.get(c.id)}
                onOpen={() => setSelectedId(c.id)}
                onHover={setHoverId}
              />
            ))}
            {data ? (
              <p className="pb-24 text-center text-[11px] text-slate-400 lg:pb-4">
                Last synchronized {timeAgo(data.generatedAt)} · {visibleCenters.length} of {centers.length} centers shown
              </p>
            ) : null}
          </div>
        )}

        {error && data ? (
          <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
            Refresh failed — showing the last synchronized information.
            {onRetry ? (
              <button type="button" onClick={onRetry} className="ml-1 font-bold underline underline-offset-2">
                Try again
              </button>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Evacuation Centers — Pio Duran"
      className="fixed inset-0 z-[60] flex flex-col bg-slate-50"
    >
      {/* Top bar */}
      <header className="z-20 shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close evacuation finder"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-gov-blue transition-colors hover:bg-gov-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-extrabold tracking-tight text-gov-blue-deep sm:text-base">
              Evacuation Centers — Pio Duran
            </h2>
            <p className="hidden text-[11px] text-slate-500 sm:block">
              Live status, capacity and directions from the MDRRMO
            </p>
          </div>
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider sm:inline-flex",
              emergency
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            )}
          >
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", emergency ? "portal-status-dot bg-red-600" : "bg-emerald-500")} />
            {emergency ? "EMERGENCY OPERATION" : "LIVE"}
          </span>
          <Button
            type="button"
            onClick={findNearest}
            disabled={locating}
            className="h-10 gap-1.5 bg-gov-blue px-3 text-xs font-bold hover:bg-gov-blue-700 sm:px-4 sm:text-sm"
          >
            {locating ? (
              <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <LocateFixed aria-hidden="true" className="size-4" />
            )}
            <span className="hidden xs:inline sm:inline">Find Nearest</span>
            <span className="sm:hidden">Nearest</span>
          </Button>
        </div>
      </header>

      {/* TYPHOON / EMERGENCY banner */}
      {emergency ? (
        <div role="alert" className="z-20 shrink-0">
          <div aria-hidden="true" className="portal-warning-stripes h-1.5 w-full" />
          <div className="bg-emergency-red-dark text-white">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2.5 text-center">
              <Siren aria-hidden="true" className="size-4 shrink-0 text-gov-gold" />
              <p className="text-xs font-semibold leading-snug sm:text-sm">
                EMERGENCY OPERATION — Follow official evacuation orders.
                {hotline ? (
                  <>
                    {" "}
                    Call MDRRMO{" "}
                    <a href={telHref(hotline)} className="font-bold text-gov-gold underline underline-offset-2">
                      {hotline}
                    </a>{" "}
                    if you need help.
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Content: map (left/top) + list (right/below) */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[45vh] w-full shrink-0 p-2 pb-0 lg:h-full lg:w-[45%] lg:p-3">
          <EvacMap
            centers={data?.centers ?? []}
            selectedId={hoverId ?? selectedId}
            onSelect={(id) => setSelectedId(id)}
            userLocation={userLocation}
            autoFit
          />
        </div>
        {listPane}
      </div>

      {/* Center detail — desktop dialog */}
      {isDesktop ? (
        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
          <DialogContent className="max-h-[88dvh] w-[95vw] max-w-2xl overflow-y-auto portal-scroll">
            <DialogHeader>
              <DialogTitle className="pr-8 text-lg font-bold leading-snug text-gov-blue-deep">{selected?.name}</DialogTitle>
              <DialogDescription>
                Brgy. {selected?.barangay}
                {selected?.address ? ` · ${selected.address}` : ""} — full evacuation center details
              </DialogDescription>
            </DialogHeader>
            {selected ? (
              <CenterDetailBody center={selected} announcements={data?.announcements ?? []} distanceKm={distances.get(selected.id)} />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
          <DrawerContent className="max-h-[88dvh] overflow-y-auto portal-scroll">
            <DrawerHeader className="pb-2 text-left">
              <DrawerTitle className="pr-8 text-left text-lg font-bold leading-snug text-gov-blue-deep">{selected?.name}</DrawerTitle>
              <DrawerDescription>
                Brgy. {selected?.barangay}
                {selected?.address ? ` · ${selected.address}` : ""}
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-8">
              {selected ? (
                <CenterDetailBody center={selected} announcements={data?.announcements ?? []} distanceKm={distances.get(selected.id)} />
              ) : null}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
