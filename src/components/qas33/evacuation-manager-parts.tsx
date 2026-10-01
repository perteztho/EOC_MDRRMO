"use client";

// QAS33 Admin Console — Evacuation Management module (shared parts).
// Sibling of evacuation-manager.tsx: presentational helpers (badges, capacity
// bars, stat cards), the center form sheet, the occupancy / status / history
// dialogs and the Leaflet map panel. The heavier data panels (Ops, Announcements,
// Reports) live in evacuation-manager-panels.tsx.

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Accessibility,
  AlertTriangle,
  BedDouble,
  CheckSquare,
  FileText,
  Gauge,
  History,
  List,
  Loader2,
  MapPin,
  MapPinOff,
  SquarePen,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Map as LeafletMap, Marker, MarkerClusterGroup } from "leaflet";
import { formatDateTime } from "@/lib/qas33/api";
import {
  autoStatusFromPct,
  EVAC_CAPACITY_META,
  EVAC_STATUS_META,
  FACILITY_TYPES,
} from "@/lib/qas33/emergency-types";
import type { EvacCenterDTO, EvacCenterStatus } from "@/lib/qas33/emergency-types";
import { evacApi, evacNum, type OccupancyPayload } from "@/lib/qas33/evac-api";
import { cn } from "@/lib/utils";
import { ErrorAlert, TableSkeleton, useLoad } from "./mdrrmo-shared";

// ---------------------------------------------------------------------------
// Shared option lists / meta
// ---------------------------------------------------------------------------

export const EVAC_STATUSES: EvacCenterStatus[] = ["OPEN", "NEAR_CAPACITY", "FULL", "CLOSED", "PREPARING"];

const WATER_WASH_OPTS = [
  { value: "AVAILABLE", label: "Available" },
  { value: "LIMITED", label: "Limited" },
  { value: "UNAVAILABLE", label: "Unavailable" },
];
const ELECTRICITY_OPTS = [
  { value: "AVAILABLE", label: "Available" },
  { value: "GENERATOR_ONLY", label: "Generator only" },
  { value: "UNAVAILABLE", label: "Unavailable" },
];

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

export function EvacStatusBadge({ status, className }: { status: EvacCenterStatus; className?: string }) {
  const meta = EVAC_STATUS_META[status] ?? EVAC_STATUS_META.OPEN;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        meta.badge,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

/** Colored capacity bar with "X/Y (Z%)" label (+ families capacity). */
export function EvacCapacityBar({ center, className }: { center: EvacCenterDTO; className?: string }) {
  const meta = EVAC_CAPACITY_META[center.capacityLevel] ?? EVAC_CAPACITY_META.UNKNOWN;
  return (
    <div className={cn("min-w-32", className)}>
      <div className="flex items-center justify-between gap-2 text-[11px] leading-tight">
        <span className="tabular-nums text-muted-foreground">
          {evacNum(center.currentOccupants)}/{evacNum(center.capacity)}
          {center.capacityFamilies != null ? (
            <span className="text-[10px] text-muted-foreground/80"> ({evacNum(center.capacityFamilies)} fam)</span>
          ) : null}
        </span>
        <span className={cn("font-semibold tabular-nums", meta.text)}>{center.occupancyPct}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-black/[0.04]">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", meta.bar)}
          style={{ width: `${Math.min(100, center.occupancyPct)}%` }}
        />
      </div>
    </div>
  );
}

export function EvacStatCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
  tone?: "emerald" | "amber" | "red" | "slate";
}) {
  return (
    <Card className="console-card-hover gap-2 py-4">
      <CardContent className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="pt-1 text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase">{label}</p>
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
              tone === "emerald"
                ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                : tone === "amber"
                  ? "bg-amber-100 text-amber-700 ring-amber-200"
                  : tone === "red"
                    ? "bg-red-100 text-red-700 ring-red-200"
                    : tone === "slate"
                      ? "bg-slate-100 text-slate-600 ring-slate-200"
                      : "bg-muted text-foreground ring-border"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <div className="text-2xl font-extrabold tracking-tight tabular-nums">{value}</div>
        {note && <p className="text-[11px] leading-snug text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}

/** Labeled number input used by the occupancy dialog. */
function NumField({
  id,
  label,
  value,
  onChange,
  min = 0,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  invalid?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className="h-9 tabular-nums"
      />
    </div>
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong — please try again.";
}

// ---------------------------------------------------------------------------
// CENTER FORM SHEET (create & edit)
// ---------------------------------------------------------------------------

interface CenterFormState {
  name: string;
  barangay: string;
  address: string;
  facilityType: string;
  latitude: string;
  longitude: string;
  capacity: string;
  capacityFamilies: string;
  landAreaSqm: string;
  contactPerson: string;
  contactNumber: string;
  accessibleFacilities: string;
  waterStatus: string;
  electricityStatus: string;
  washStatus: string;
  medicalAssistance: boolean;
  foodRelief: boolean;
  sleepingArea: boolean;
  generator: boolean;
  vehicleAccess: boolean;
  petsAllowed: boolean;
  status: EvacCenterStatus;
  specialNotes: string;
  visible: boolean;
}

const SERVICE_TOGGLES: Array<{ key: keyof CenterFormState; label: string }> = [
  { key: "medicalAssistance", label: "Medical assistance" },
  { key: "foodRelief", label: "Food & relief goods" },
  { key: "sleepingArea", label: "Sleeping area" },
  { key: "generator", label: "Generator" },
  { key: "vehicleAccess", label: "Vehicle access" },
  { key: "petsAllowed", label: "Pets allowed" },
];

function initialCenterForm(center: EvacCenterDTO | null): CenterFormState {
  return {
    name: center?.name ?? "",
    barangay: center?.barangay ?? "",
    address: center?.address ?? "",
    facilityType: center?.facilityType ?? "SCHOOL",
    latitude: center?.latitude != null ? String(center.latitude) : "",
    longitude: center?.longitude != null ? String(center.longitude) : "",
    capacity: center ? String(center.capacity) : "",
    capacityFamilies: center?.capacityFamilies != null ? String(center.capacityFamilies) : "",
    landAreaSqm: center?.landAreaSqm != null ? String(center.landAreaSqm) : "",
    contactPerson: center?.contactPerson ?? "",
    contactNumber: center?.contactNumber ?? "",
    accessibleFacilities: center?.accessibleFacilities ?? "",
    waterStatus: center?.waterStatus ?? "AVAILABLE",
    electricityStatus: center?.electricityStatus ?? "AVAILABLE",
    washStatus: center?.washStatus ?? "AVAILABLE",
    medicalAssistance: center?.medicalAssistance ?? false,
    foodRelief: center?.foodRelief ?? false,
    sleepingArea: center?.sleepingArea ?? true,
    generator: center?.generator ?? false,
    vehicleAccess: center?.vehicleAccess ?? true,
    petsAllowed: center?.petsAllowed ?? false,
    status: center?.status ?? "OPEN",
    specialNotes: center?.specialNotes ?? "",
    visible: center?.visible ?? true,
  };
}

function validateCenterForm(f: CenterFormState): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!f.name.trim()) errs.name = "Center name is required.";
  if (!f.barangay) errs.barangay = "Barangay is required.";
  const cap = f.capacity.trim() === "" ? NaN : Number(f.capacity);
  if (Number.isNaN(cap) || cap < 0 || cap > 100000 || !Number.isInteger(cap)) {
    errs.capacity = "Capacity must be a whole number between 0 and 100,000.";
  }
  if (f.capacityFamilies.trim() !== "") {
    const fam = Number(f.capacityFamilies);
    if (!Number.isFinite(fam) || fam < 0 || fam > 20000 || !Number.isInteger(fam)) {
      errs.capacityFamilies = "Families must be a whole number between 0 and 20,000.";
    }
  }
  if (f.landAreaSqm.trim() !== "") {
    const sqm = Number(f.landAreaSqm);
    if (!Number.isFinite(sqm) || sqm < 0 || sqm > 10000000) {
      errs.landAreaSqm = "Land area must be between 0 and 10,000,000 sqm.";
    }
  }
  if (f.latitude.trim() !== "") {
    const lat = Number(f.latitude);
    if (!Number.isFinite(lat) || lat < 5 || lat > 20) errs.latitude = "Must be within 5–20 (Philippines).";
  }
  if (f.longitude.trim() !== "") {
    const lng = Number(f.longitude);
    if (!Number.isFinite(lng) || lng < 115 || lng > 130) errs.longitude = "Must be within 115–130 (Philippines).";
  }
  return errs;
}

function FormSection({ icon: Icon, title, desc, children }: { icon: LucideIcon; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-semibold leading-none">{title}</h3>
          {desc && <p className="mt-1 text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function CenterFormSheet({
  open,
  center,
  barangays,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  center: EvacCenterDTO | null; // null → create
  barangays: Array<{ code: string; name: string }>;
  onOpenChange: (open: boolean) => void;
  onSaved: (center: EvacCenterDTO, created: boolean) => void;
}) {
  const editing = !!center;
  const [form, setForm] = useState<CenterFormState>(() => initialCenterForm(center));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const set = <K extends keyof CenterFormState>(key: K, value: CenterFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const errors = submitted ? validateCenterForm(form) : {};
  const hasErrors = Object.keys(validateCenterForm(form)).length > 0;

  const save = async () => {
    if (!submitted) setSubmitted(true);
    if (hasErrors) {
      setError("Please fix the highlighted fields before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = {
        name: form.name.trim(),
        barangay: form.barangay,
        address: form.address.trim() || null,
        latitude: form.latitude.trim() === "" ? null : Number(form.latitude),
        longitude: form.longitude.trim() === "" ? null : Number(form.longitude),
        contactPerson: form.contactPerson.trim() || null,
        contactNumber: form.contactNumber.trim() || null,
        facilityType: form.facilityType,
        capacity: Number(form.capacity),
        capacityFamilies: form.capacityFamilies.trim() === "" ? null : Number(form.capacityFamilies),
        landAreaSqm: form.landAreaSqm.trim() === "" ? null : Number(form.landAreaSqm),
        status: form.status,
        specialNotes: form.specialNotes.trim() || null,
        accessibleFacilities: form.accessibleFacilities.trim() || null,
        waterStatus: form.waterStatus,
        electricityStatus: form.electricityStatus,
        washStatus: form.washStatus,
        medicalAssistance: form.medicalAssistance,
        foodRelief: form.foodRelief,
        sleepingArea: form.sleepingArea,
        generator: form.generator,
        vehicleAccess: form.vehicleAccess,
        petsAllowed: form.petsAllowed,
        visible: form.visible,
      };
      const res = editing && center ? await evacApi.updateCenter(center.id, input) : await evacApi.createCenter(input);
      onSaved(res.center, !editing);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b bg-muted/40 px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
            {editing ? "Edit Evacuation Center" : "Add Evacuation Center"}
          </SheetTitle>
          <SheetDescription>
            {editing
              ? `${center?.code ?? ""} — updates are audited and reflected on the public portal immediately.`
              : "Register a new evacuation center. A PD-EVC code is assigned automatically."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Could not save center</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FormSection icon={FileText} title="Basics" desc="Identity and location of the facility.">
            <div className="space-y-1">
              <Label htmlFor="ev-name">
                Center name <span className="text-destructive">*</span>
              </Label>
              <Input id="ev-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Municipal Evacuation Center" aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ev-barangay">
                  Barangay <span className="text-destructive">*</span>
                </Label>
                <Select value={form.barangay} onValueChange={(v) => set("barangay", v)}>
                  <SelectTrigger id="ev-barangay" aria-invalid={!!errors.barangay}>
                    <SelectValue placeholder="Select barangay" />
                  </SelectTrigger>
                  <SelectContent>
                    {barangays.map((b) => (
                      <SelectItem key={b.code} value={b.name}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.barangay && <p className="text-xs text-destructive">{errors.barangay}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="ev-facility">Facility type</Label>
                <Select value={form.facilityType} onValueChange={(v) => set("facilityType", v)}>
                  <SelectTrigger id="ev-facility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FACILITY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ev-address">Address</Label>
              <Input id="ev-address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street / purok, Pio Duran, Albay" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ev-lat">GPS latitude</Label>
                <Input id="ev-lat" type="number" step="any" value={form.latitude} onChange={(e) => set("latitude", e.target.value)} placeholder="13.0429" aria-invalid={!!errors.latitude} />
                {errors.latitude ? (
                  <p className="text-xs text-destructive">{errors.latitude}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Philippines: lat 5–20, lng 115–130</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="ev-lng">GPS longitude</Label>
                <Input id="ev-lng" type="number" step="any" value={form.longitude} onChange={(e) => set("longitude", e.target.value)} placeholder="123.4536" aria-invalid={!!errors.longitude} />
                {errors.longitude && <p className="text-xs text-destructive">{errors.longitude}</p>}
              </div>
            </div>
          </FormSection>

          <FormSection icon={BedDouble} title="Capacity & Contact">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="ev-capacity">
                  Capacity (individuals) <span className="text-destructive">*</span>
                </Label>
                <Input id="ev-capacity" type="number" min={0} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="588" aria-invalid={!!errors.capacity} />
                {errors.capacity && <p className="text-xs text-destructive">{errors.capacity}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="ev-capacity-families">Capacity (families)</Label>
                <Input id="ev-capacity-families" type="number" min={0} value={form.capacityFamilies} onChange={(e) => set("capacityFamilies", e.target.value)} placeholder="196" aria-invalid={!!errors.capacityFamilies} />
                {errors.capacityFamilies ? (
                  <p className="text-xs text-destructive">{errors.capacityFamilies}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Rated capacity in families</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="ev-land-area">Land area (sqm)</Label>
                <Input id="ev-land-area" type="number" min={0} step="any" value={form.landAreaSqm} onChange={(e) => set("landAreaSqm", e.target.value)} placeholder="1969" aria-invalid={!!errors.landAreaSqm} />
                {errors.landAreaSqm && <p className="text-xs text-destructive">{errors.landAreaSqm}</p>}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ev-contact-person">Contact person</Label>
                <Input id="ev-contact-person" value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} placeholder="Center manager" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ev-contact-number">Contact number</Label>
                <Input id="ev-contact-number" value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} placeholder="09XX XXX XXXX" />
              </div>
            </div>
          </FormSection>

          <FormSection icon={CheckSquare} title="Services & Facilities" desc="Utilities and on-site services available to evacuees.">
            <div className="space-y-1">
              <Label htmlFor="ev-accessible">Accessible facilities</Label>
              <Input id="ev-accessible" value={form.accessibleFacilities} onChange={(e) => set("accessibleFacilities", e.target.value)} placeholder="e.g. Ramp, wide doorways, accessible toilet" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["waterStatus", "Water", WATER_WASH_OPTS],
                  ["electricityStatus", "Electricity", ELECTRICITY_OPTS],
                  ["washStatus", "WASH", WATER_WASH_OPTS],
                ] as const
              ).map(([key, label, opts]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`ev-${key}`}>{label}</Label>
                  <Select value={form[key]} onValueChange={(v) => set(key, v as CenterFormState[typeof key])}>
                    <SelectTrigger id={`ev-${key}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {opts.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SERVICE_TOGGLES.map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm">
                  <span className={cn(key === "medicalAssistance" && "flex items-center gap-1.5")}>
                    {key === "medicalAssistance" && <Accessibility className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                    {label}
                  </span>
                  <Switch checked={form[key] as boolean} onCheckedChange={(v) => set(key, v as CenterFormState[typeof key])} aria-label={label} />
                </label>
              ))}
            </div>
          </FormSection>

          <FormSection icon={Gauge} title="Status" desc="Status is auto-computed from occupancy unless manually overridden.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ev-status">Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as EvacCenterStatus)}>
                  <SelectTrigger id="ev-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVAC_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {EVAC_STATUS_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Visible in listings</p>
                </div>
                <Switch checked={form.visible} onCheckedChange={(v) => set("visible", v)} aria-label="Center active" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ev-notes">Special notes</Label>
              <Textarea id="ev-notes" rows={3} value={form.specialNotes} onChange={(e) => set("specialNotes", e.target.value)} placeholder="e.g. Poblacion catchment center — monitor overflow during storm surge" />
            </div>
          </FormSection>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t bg-background px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SquarePen className="h-4 w-4" aria-hidden="true" />}
            {editing ? "Save Changes" : "Create Center"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// OCCUPANCY DIALOG
// ---------------------------------------------------------------------------

export function OccupancyDialog({
  center,
  initialOccupants,
  canManage,
  onOpenChange,
  onSaved,
}: {
  center: EvacCenterDTO;
  initialOccupants?: number;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (center: EvacCenterDTO, occupants: number) => void;
}) {
  const [f, setF] = useState(() => ({
    occupants: String(initialOccupants ?? center.currentOccupants),
    male: String(center.maleOccupants),
    female: String(center.femaleOccupants),
    children: String(center.childrenOccupants),
    seniors: String(center.seniorOccupants),
    pwd: String(center.pwdOccupants),
    pregnant: String(center.pregnantOccupants),
    other: String(center.otherVulnerable),
    note: "",
  }));
  const [override, setOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (s: string) => (s.trim() === "" ? 0 : parseInt(s, 10));
  const occupants = num(f.occupants);
  const breakdownInvalid = [f.male, f.female, f.children, f.seniors, f.pwd, f.pregnant, f.other].some(
    (s) => s.trim() !== "" && (Number.isNaN(parseInt(s, 10)) || parseInt(s, 10) < 0)
  );
  const occupantsInvalid = f.occupants.trim() === "" || Number.isNaN(occupants) || occupants < 0;
  const over = occupants > center.capacity;
  const pct = center.capacity > 0 ? Math.min(999, Math.round((occupants / center.capacity) * 100)) : 0;
  const available = Math.max(0, center.capacity - occupants);
  const canAuto = !center.statusOverride && center.status !== "CLOSED" && center.status !== "PREPARING";
  const resultStatus: EvacCenterStatus = canAuto ? autoStatusFromPct(pct, center.capacity) : center.status;
  const sexMismatch = !occupantsInvalid && num(f.male) + num(f.female) !== occupants;

  const save = async () => {
    if (!canManage || occupantsInvalid || breakdownInvalid || (over && !override)) return;
    setSaving(true);
    setError(null);
    const payload: OccupancyPayload = {
      occupants,
      male: num(f.male),
      female: num(f.female),
      children: num(f.children),
      seniors: num(f.seniors),
      pwd: num(f.pwd),
      pregnant: num(f.pregnant),
      otherVulnerable: num(f.other),
      note: f.note.trim() || null,
      overrideOverCapacity: over ? true : undefined,
    };
    try {
      await evacApi.occupancy(center.id, payload);
      onSaved(center, occupants);
    } catch (e) {
      setError(errMsg(e));
      setSaving(false);
    }
  };

  const fields: Array<[keyof typeof f, string]> = [
    ["male", "Male"],
    ["female", "Female"],
    ["children", "Children"],
    ["seniors", "Seniors"],
    ["pwd", "PWD"],
    ["pregnant", "Pregnant"],
    ["other", "Other vulnerable"],
  ];

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Users className="h-5 w-5 text-primary" aria-hidden="true" />
            Update Occupancy
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{center.name}</span>
            <EvacStatusBadge status={center.status} />
            <span className="text-xs">
              Capacity {evacNum(center.capacity)} · {evacNum(center.currentOccupants)} current evacuees
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <NumField id="occ-total" label="Total occupants" value={f.occupants} onChange={(v) => setF((s) => ({ ...s, occupants: v }))} invalid={occupantsInvalid} />
            <div className="flex items-end">
              <div className="w-full rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                <p className="text-muted-foreground">
                  Available slots: <span className={cn("font-semibold tabular-nums", available > 0 ? "text-emerald-600" : "text-red-600")}>{evacNum(available)}</span>
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  Result: <span className="font-semibold tabular-nums">{pct}%</span> ·{" "}
                  {canAuto ? (
                    <EvacStatusBadge status={resultStatus} />
                  ) : (
                    <span className="text-muted-foreground">status unchanged (manual override)</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Breakdown (optional but recommended)</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fields.map(([key, label]) => (
                <NumField key={key} id={`occ-${key}`} label={label} value={f[key]} onChange={(v) => setF((s) => ({ ...s, [key]: v }))} invalid={f[key].trim() !== "" && (Number.isNaN(parseInt(f[key], 10)) || parseInt(f[key], 10) < 0)} />
              ))}
            </div>
            {sexMismatch && <p className="mt-2 text-[11px] text-amber-700">Male + female does not match the total — a note will be recorded automatically.</p>}
          </div>

          {over && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Over capacity ({pct}%)</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  {evacNum(occupants)} evacuees exceed the rated capacity of {evacNum(center.capacity)}. Overcrowding
                  risks must be assessed by the MDRRMO on the ground.
                </p>
                {canManage && (
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={override} onCheckedChange={(v) => setOverride(v === true)} aria-label="Override capacity (authorized)" />
                    Override (authorized)
                  </label>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1">
            <Label htmlFor="occ-note">Note (optional)</Label>
            <Textarea id="occ-note" rows={2} value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} placeholder="e.g. 12 families from Purok 3 arrived after flood warning" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={!canManage || saving || occupantsInvalid || breakdownInvalid || (over && !override)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckSquare className="h-4 w-4" aria-hidden="true" />}
            Record Occupancy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// STATUS DIALOG
// ---------------------------------------------------------------------------

export function StatusDialog({
  center,
  presetStatus,
  onOpenChange,
  onSaved,
}: {
  center: EvacCenterDTO;
  presetStatus?: EvacCenterStatus;
  onOpenChange: (open: boolean) => void;
  onSaved: (center: EvacCenterDTO, status: EvacCenterStatus) => void;
}) {
  const [status, setStatus] = useState<EvacCenterStatus>(presetStatus ?? center.status);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auto = autoStatusFromPct(center.occupancyPct, center.capacity);
  const isOverride = status !== auto;
  const needsReason = status === "CLOSED" || status === "PREPARING" || isOverride;

  const save = async () => {
    if (needsReason && !reason.trim()) {
      setError("A reason is required when setting CLOSED / PREPARING or overriding the auto-computed status.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await evacApi.status(center.id, status, reason.trim() || null);
      onSaved(center, status);
    } catch (e) {
      setError(errMsg(e));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" aria-hidden="true" /> Set Center Status
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{center.name}</span>
            <EvacStatusBadge status={center.status} />
            <span className="text-xs">
              {evacNum(center.currentOccupants)}/{evacNum(center.capacity)} evacuees ({center.occupancyPct}%)
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1">
            <Label htmlFor="st-status">New status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as EvacCenterStatus)}>
              <SelectTrigger id="st-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVAC_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {EVAC_STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Auto-computed from occupancy unless overridden — auto status for this center is currently{" "}
              <span className="font-medium">{EVAC_STATUS_META[auto].label}</span>.
            </p>
          </div>
          {isOverride && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This differs from the auto-computed status and will be flagged as a manual override.
            </p>
          )}
          <div className="space-y-1">
            <Label htmlFor="st-reason">
              Reason {needsReason ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(recommended)</span>}
            </Label>
            <Textarea id="st-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Structural inspection after aftershocks" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null} Save Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// HISTORY DIALOG
// ---------------------------------------------------------------------------

export function HistoryDialog({ center, onOpenChange }: { center: EvacCenterDTO; onOpenChange: (open: boolean) => void }) {
  const { data, loading, error, reload } = useLoad(() => evacApi.history(center.id), center.id);
  const logs = data?.occupancyLogs ?? [];
  const history = data?.statusHistory ?? [];

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" aria-hidden="true" /> History — {center.name}
          </DialogTitle>
          <DialogDescription>
            {center.code ?? ""} · {center.barangay} — occupancy snapshots and status transitions, newest first.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <ErrorAlert message={error} onRetry={reload} />
        ) : (
          <Tabs defaultValue="occupancy">
            <TabsList className="w-full">
              <TabsTrigger value="occupancy" className="flex-1">
                Occupancy Log ({logs.length})
              </TabsTrigger>
              <TabsTrigger value="status" className="flex-1">
                Status History ({history.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="occupancy" className="mt-3">
              {loading ? (
                <TableSkeleton rows={4} cols={6} />
              ) : logs.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No occupancy records yet.</p>
              ) : (
                <ScrollArea className="max-h-[55vh] rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead className="pl-3">When</TableHead>
                        <TableHead>Occupants</TableHead>
                        <TableHead>M / F</TableHead>
                        <TableHead>Vulnerable (Ch / Sn / PWD / Preg / Other)</TableHead>
                        <TableHead className="pr-3">Note / By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="pl-3 text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</TableCell>
                          <TableCell className="font-semibold tabular-nums">{evacNum(l.occupants)}</TableCell>
                          <TableCell className="text-xs tabular-nums">
                            {evacNum(l.male)} / {evacNum(l.female)}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums">
                            {evacNum(l.children)} / {evacNum(l.seniors)} / {evacNum(l.pwd)} / {evacNum(l.pregnant)} / {evacNum(l.otherVulnerable)}
                          </TableCell>
                          <TableCell className="max-w-56 pr-3 text-xs">
                            {l.note && <p className="text-muted-foreground">{l.note}</p>}
                            <p className="mt-0.5 font-medium text-foreground">{l.recordedByName ?? "—"}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>
            <TabsContent value="status" className="mt-3">
              {loading ? (
                <TableSkeleton rows={4} cols={5} />
              ) : history.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No status changes recorded yet.</p>
              ) : (
                <ScrollArea className="max-h-[55vh] rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead className="pl-3">When</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="pr-3">By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="pl-3 text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            <span className="text-muted-foreground">{h.previousStatus ? EVAC_STATUS_META[h.previousStatus as EvacCenterStatus]?.label ?? h.previousStatus : "—"}</span>
                            <span className="mx-1">→</span>
                            <EvacStatusBadge status={h.newStatus as EvacCenterStatus} />
                            {h.overridden && <span className="ml-1.5 rounded bg-amber-100 px-1 py-px text-[10px] font-semibold text-amber-800">override</span>}
                          </TableCell>
                          <TableCell className="max-w-56 text-xs text-muted-foreground">{h.reason ?? "—"}</TableCell>
                          <TableCell className="pr-3 text-xs font-medium">{h.changedByName ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}


// ---------------------------------------------------------------------------
// MAP PANEL (Leaflet — client-only dynamic import)
// ---------------------------------------------------------------------------

const MARKER_COLORS: Record<EvacCenterStatus, string> = {
  OPEN: "#10b981",
  NEAR_CAPACITY: "#f59e0b",
  FULL: "#ef4444",
  CLOSED: "#64748b",
  PREPARING: "#0284c7",
};
const MARKER_LETTERS: Record<EvacCenterStatus, string> = { OPEN: "O", NEAR_CAPACITY: "N", FULL: "F", CLOSED: "C", PREPARING: "P" };

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildPopup(
  c: EvacCenterDTO,
  canManage: boolean,
  onEdit: (c: EvacCenterDTO) => void,
  onOccupancy: (c: EvacCenterDTO) => void
): HTMLElement {
  const root = el("div", "w-60 space-y-1.5");
  root.append(el("div", "text-sm font-semibold leading-tight", c.name));
  root.append(el("div", "text-xs text-slate-500", `${c.barangay}${c.code ? ` · ${c.code}` : ""}`));
  const pill = el(
    "span",
    `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${EVAC_STATUS_META[c.status].badge}`,
    EVAC_STATUS_META[c.status].label
  );
  const pillWrap = el("div", "");
  pillWrap.append(pill);
  root.append(pillWrap);
  const barOuter = el("div", "h-1.5 w-full overflow-hidden rounded-full bg-slate-200");
  const barInner = el("div", `h-full rounded-full ${EVAC_STATUS_META[c.status].bar}`);
  barInner.style.width = `${Math.min(100, c.occupancyPct)}%`;
  barOuter.append(barInner);
  root.append(barOuter);
  root.append(
    el(
      "div",
      "text-xs text-slate-600",
      `${evacNum(c.currentOccupants)} / ${evacNum(c.capacity)} evacuees (${c.occupancyPct}%)` +
        (c.capacityFamilies != null ? ` · ${evacNum(c.capacityFamilies)} families` : "")
    )
  );
  const actions = el("div", "flex gap-1.5 pt-1");
  if (canManage) {
    const editBtn = el("button", "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50", "Edit");
    editBtn.addEventListener("click", () => onEdit(c));
    const occBtn = el("button", "rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800", "Occupancy");
    occBtn.addEventListener("click", () => onOccupancy(c));
    actions.append(editBtn, occBtn);
  } else {
    actions.append(el("span", "text-[10px] text-slate-400", "Read-only — MDRRMO Staff"));
  }
  root.append(actions);
  return root;
}

export function MapPanel({
  centers,
  canManage,
  onEdit,
  onOccupancy,
}: {
  centers: EvacCenterDTO[];
  canManage: boolean;
  onEdit: (c: EvacCenterDTO) => void;
  onOccupancy: (c: EvacCenterDTO) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const clusterRef = useRef<MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [initNonce, setInitNonce] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [search, setSearch] = useState("");

  const geo = useMemo(() => centers.filter((c) => c.latitude != null && c.longitude != null), [centers]);
  const noGeo = useMemo(() => centers.filter((c) => c.latitude == null || c.longitude == null), [centers]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return centers;
    return centers.filter((c) => c.name.toLowerCase().includes(q) || c.barangay.toLowerCase().includes(q));
  }, [centers, search]);

  // Signature of everything rendered on the map — the markers layer is rebuilt
  // ONLY when this actually changes (auto-refresh every 60s produces new array
  // identities; rebuilding unconditionally would flicker and close open popups).
  const markerSig = useMemo(
    () => `${canManage ? 1 : 0};` + geo.map((c) => `${c.id}:${c.status}:${c.currentOccupants}:${c.capacity}:${c.capacityFamilies}:${c.latitude}:${c.longitude}`).join("|"),
    [geo, canManage]
  );

  // Initialise the map once (Leaflet + cluster plugin loaded dynamically).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet.markercluster");
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current).setView([13.0429, 123.4536], 12);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
        mapRef.current = map;
        setMapReady(true);
        setTimeout(() => map.invalidateSize(), 150);
      } catch {
        if (!cancelled) setMapError("The map library could not be loaded. Check your connection and retry.");
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      clusterRef.current = null;
      markersRef.current.clear();
    };
  }, [initNonce]);

  // Rebuild markers only when the map-relevant data actually changed (markerSig).
  useEffect(() => {
    if (!mapReady) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      if (cancelled) return;
      const map = mapRef.current;
      if (!map) return;
      // remove previous cluster layer
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
        clusterRef.current = null;
      }
      const cluster = L.markerClusterGroup({ disableClusteringAtZoom: 15, showCoverageOnHover: false });
      const markers = new Map<string, Marker>();
      for (const c of geo) {
        const marker = L.marker([c.latitude as number, c.longitude as number], {
          icon: L.divIcon({
            className: "evac-map-marker",
            html: `<div style="width:26px;height:26px;border-radius:9999px;background:${MARKER_COLORS[c.status]};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);color:#fff;font:700 12px/22px system-ui,sans-serif;text-align:center;cursor:pointer" role="img" aria-label="${EVAC_STATUS_META[c.status].label}">${MARKER_LETTERS[c.status]}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
            popupAnchor: [0, -14],
          }),
          title: c.name,
        });
        marker.bindPopup(buildPopup(c, canManage, onEdit, onOccupancy));
        cluster.addLayer(marker);
        markers.set(c.id, marker);
      }
      cluster.addTo(map);
      clusterRef.current = cluster;
      markersRef.current = markers;
    })();
    return () => {
      cancelled = true;
    };
    // Deps are intentionally [mapReady, markerSig] only — geo / canManage /
    // onEdit / onOccupancy are captured through markerSig, so a fresh array
    // identity from the 60s auto-refresh never rebuilds layers or closes popups.
  }, [mapReady, markerSig]);

  const focusCenter = (c: EvacCenterDTO) => {
    const map = mapRef.current;
    const marker = markersRef.current.get(c.id);
    if (!map || !marker || c.latitude == null || c.longitude == null) return;
    map.flyTo([c.latitude, c.longitude], 15, { duration: 0.7 });
    setTimeout(() => marker.openPopup(), 750);
  };

  const fitAll = () => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    const bounds = cluster.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [48, 48] });
  };

  if (geo.length === 0 && !mapError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <MapPinOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium">No centers have GPS coordinates yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add latitude / longitude values from the center form (Basics → GPS) to plot evacuation centers on the map.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border">
        {mapError ? (
          <div className="p-6">
            <ErrorAlert message={mapError} onRetry={() => { setMapError(null); setMapReady(false); setInitNonce((n) => n + 1); }} />
          </div>
        ) : (
          <>
            <div ref={containerRef} className="h-[70vh] max-h-[640px] min-h-[420px] w-full" role="application" aria-label="Evacuation center map of Pio Duran, Albay" />
            {!mapReady && <div className="absolute inset-0 flex items-center justify-center bg-background/60"><Skeleton className="h-full w-full rounded-none" /></div>}

            {/* Overlay: center list */}
            {listOpen && (
              <div className="absolute left-3 top-3 z-[1000] w-[calc(100%-1.5rem)] max-w-72 rounded-xl border bg-background/95 shadow-lg backdrop-blur">
                <div className="border-b p-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search centers or barangay…"
                    className="h-8 text-xs"
                    aria-label="Search map list"
                  />
                </div>
                <ScrollArea className="max-h-72">
                  <ul className="divide-y">
                    {filtered.length === 0 && <li className="p-3 text-xs text-muted-foreground">No centers match.</li>}
                    {filtered.map((c) => {
                      const hasGeo = c.latitude != null && c.longitude != null;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            disabled={!hasGeo}
                            onClick={() => focusCenter(c)}
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted",
                              !hasGeo && "cursor-not-allowed opacity-50 hover:bg-transparent"
                            )}
                          >
                            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", EVAC_STATUS_META[c.status].dot)} aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{c.name}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {c.barangay} · {evacNum(c.currentOccupants)}/{evacNum(c.capacity)}
                              </span>
                            </span>
                            {!c.visible && <Badge variant="outline" className="text-[9px]">Inactive</Badge>}
                            {!hasGeo && <Badge variant="outline" className="text-[9px]">No GPS</Badge>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              </div>
            )}

            {/* Map controls */}
            <div className="absolute right-3 top-3 z-[1000] flex gap-1.5">
              <Button size="sm" variant="secondary" className="h-8 shadow" onClick={() => setListOpen((v) => !v)} aria-label={listOpen ? "Hide center list" : "Show center list"}>
                <List className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button size="sm" variant="secondary" className="h-8 shadow" onClick={fitAll} disabled={!mapReady} aria-label="Fit all centers on map">
                <MapPin className="h-4 w-4" aria-hidden="true" /> Fit all
              </Button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 z-[1000] rounded-xl border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {EVAC_STATUSES.map((s) => (
                  <li key={s} className="flex items-center gap-1.5 text-[11px]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: MARKER_COLORS[s] }} aria-hidden="true" />
                    {EVAC_STATUS_META[s].label}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
      {noGeo.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {noGeo.length} center{noGeo.length === 1 ? "" : "s"} without GPS coordinates (not shown on map): {noGeo.map((c) => c.name).join(", ")}.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">Municipal center: Pio Duran, Albay (13.0429, 123.4536) · Map data © OpenStreetMap contributors.</p>
    </div>
  );
}
