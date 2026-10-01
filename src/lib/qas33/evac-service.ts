// QAS33 — Evacuation Management service (EvacuationCenter module).
// DTO mapping, dashboard stats, occupancy updates with auto-status
// computation + audit trail, manual status overrides, validation.
import { db } from "@/lib/db";
import { logAudit } from "./audit";
import { getCommunicationSettings } from "./comm-settings";
import {
  autoStatusFromPct,
  capacityLevelFromPct,
  FACILITY_TYPES,
} from "./emergency-types";
import type {
  CommunicationSettings,
  EvacAnnouncementDTO,
  EvacAnnouncementPriority,
  EvacCenterDTO,
  EvacCenterInput,
  EvacCenterStatus,
  EvacDashboardStats,
  OccupancyLogDTO,
  StatusHistoryDTO,
} from "./emergency-types";
import type {
  EvacuationAnnouncement,
  EvacuationCenter,
  EvacuationOccupancyLog,
  EvacuationStatusHistory,
} from "@prisma/client";

export type EvacCenterRow = EvacuationCenter;
type Thresholds = Pick<CommunicationSettings, "evacNearCapacityThreshold" | "evacCriticalThreshold">;

const VALID_STATUSES: EvacCenterStatus[] = ["OPEN", "NEAR_CAPACITY", "FULL", "CLOSED", "PREPARING"];

/** Legacy status values → current enum. */
function normalizeStatus(status: string): EvacCenterStatus {
  if (status === "LIMITED") return "NEAR_CAPACITY";
  return (VALID_STATUSES as string[]).includes(status) ? (status as EvacCenterStatus) : "OPEN";
}

// ---------------------------------------------------------------------------
// DTO mapping
// ---------------------------------------------------------------------------

export function toEvacCenterDTO(
  center: EvacCenterRow,
  thresholds?: Thresholds
): EvacCenterDTO {
  const near = thresholds?.evacNearCapacityThreshold ?? 70;
  const critical = thresholds?.evacCriticalThreshold ?? 90;
  const capacity = center.capacity ?? 0;
  const occupants = center.currentOccupants ?? 0;
  const occupancyPct = capacity > 0 ? Math.min(999, Math.round((occupants / capacity) * 100)) : 0;
  return {
    id: center.id,
    code: center.code,
    name: center.name,
    barangay: center.barangay,
    barangayId: center.barangayId,
    address: center.address,
    latitude: center.latitude,
    longitude: center.longitude,
    contactPerson: center.contactPerson,
    contactNumber: center.contactNumber,
    facilityType: center.facilityType,
    capacity,
    capacityFamilies: center.capacityFamilies ?? null,
    landAreaSqm: center.landAreaSqm ?? null,
    currentOccupants: occupants,
    availableSlots: Math.max(0, capacity - occupants),
    occupancyPct,
    maleOccupants: center.maleOccupants ?? 0,
    femaleOccupants: center.femaleOccupants ?? 0,
    childrenOccupants: center.childrenOccupants ?? 0,
    seniorOccupants: center.seniorOccupants ?? 0,
    pwdOccupants: center.pwdOccupants ?? 0,
    pregnantOccupants: center.pregnantOccupants ?? 0,
    otherVulnerable: center.otherVulnerable ?? 0,
    vulnerableTotal:
      (center.childrenOccupants ?? 0) +
      (center.seniorOccupants ?? 0) +
      (center.pwdOccupants ?? 0) +
      (center.pregnantOccupants ?? 0) +
      (center.otherVulnerable ?? 0),
    accessibleFacilities: center.accessibleFacilities,
    waterStatus: center.waterStatus,
    electricityStatus: center.electricityStatus,
    washStatus: center.washStatus,
    medicalAssistance: center.medicalAssistance ?? false,
    foodRelief: center.foodRelief ?? false,
    sleepingArea: center.sleepingArea ?? false,
    generator: center.generator ?? false,
    vehicleAccess: center.vehicleAccess ?? false,
    petsAllowed: center.petsAllowed ?? false,
    status: normalizeStatus(center.status),
    capacityLevel: capacityLevelFromPct(occupancyPct, capacity, near, critical),
    statusOverride: center.statusOverride ?? false,
    specialNotes: center.specialNotes,
    notes: center.notes,
    lastUpdatedBy: center.lastUpdatedBy,
    lastUpdated: center.updatedAt.toISOString(),
    visible: center.visible,
    displayOrder: center.displayOrder,
  };
}

export function toOccupancyLogDTO(
  log: EvacuationOccupancyLog & { center?: { name: string } }
): OccupancyLogDTO {
  return {
    id: log.id,
    centerId: log.centerId,
    centerName: log.center?.name ?? "",
    occupants: log.occupants,
    male: log.male,
    female: log.female,
    children: log.children,
    seniors: log.seniors,
    pwd: log.pwd,
    pregnant: log.pregnant,
    otherVulnerable: log.otherVulnerable,
    note: log.note,
    recordedByName: log.recordedByName,
    createdAt: log.createdAt.toISOString(),
  };
}

export function toStatusHistoryDTO(
  log: EvacuationStatusHistory & { center?: { name: string } }
): StatusHistoryDTO {
  return {
    id: log.id,
    centerId: log.centerId,
    centerName: log.center?.name ?? "",
    previousStatus: log.previousStatus,
    newStatus: log.newStatus,
    reason: log.reason,
    overridden: log.overridden,
    changedByName: log.changedByName,
    createdAt: log.createdAt.toISOString(),
  };
}

export function toEvacAnnouncementDTO(a: EvacuationAnnouncement): EvacAnnouncementDTO {
  return {
    id: a.id,
    title: a.title,
    message: a.message,
    priority: a.priority as EvacAnnouncementPriority,
    targetBarangays: a.targetBarangays ? a.targetBarangays.split(",").map((s) => s.trim()).filter(Boolean) : [],
    targetCenterIds: safeParseArray(a.targetCenterIds),
    status: a.status as EvacAnnouncementDTO["status"],
    publishAt: a.publishAt.toISOString(),
    expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
    pushSent: a.pushSent,
    showOnWebsite: a.showOnWebsite,
    createdByName: a.createdByName,
    createdAt: a.createdAt.toISOString(),
  };
}

function safeParseArray(raw: string | null): string[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

export function computeEvacStats(centers: EvacCenterDTO[]): EvacDashboardStats {
  const byStatus = { OPEN: 0, NEAR_CAPACITY: 0, FULL: 0, CLOSED: 0, PREPARING: 0 } as Record<EvacCenterStatus, number>;
  let totalCapacity = 0;
  let totalFamilies = 0;
  let currentEvacuees = 0;
  const vulnerable = { children: 0, seniors: 0, pwd: 0, pregnant: 0, other: 0, total: 0 };
  const brgyMap = new Map<string, { barangay: string; centers: number; capacity: number; occupants: number }>();
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  let updatedToday = 0;

  for (const c of centers) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    totalCapacity += c.capacity;
    if (c.capacityFamilies != null) totalFamilies += c.capacityFamilies;
    currentEvacuees += c.currentOccupants;
    vulnerable.children += c.childrenOccupants;
    vulnerable.seniors += c.seniorOccupants;
    vulnerable.pwd += c.pwdOccupants;
    vulnerable.pregnant += c.pregnantOccupants;
    vulnerable.other += c.otherVulnerable;
    vulnerable.total += c.vulnerableTotal;
    if (new Date(c.lastUpdated).getTime() >= dayAgo) updatedToday++;
    const entry = brgyMap.get(c.barangay) ?? { barangay: c.barangay, centers: 0, capacity: 0, occupants: 0 };
    entry.centers++;
    entry.capacity += c.capacity;
    entry.occupants += c.currentOccupants;
    brgyMap.set(c.barangay, entry);
  }

  return {
    totalCenters: centers.length,
    openCenters: byStatus.OPEN,
    nearCapacityCenters: byStatus.NEAR_CAPACITY,
    fullCenters: byStatus.FULL,
    closedCenters: byStatus.CLOSED,
    preparingCenters: byStatus.PREPARING,
    totalCapacity,
    totalFamilies,
    currentEvacuees,
    availableSpaces: Math.max(0, totalCapacity - currentEvacuees),
    occupancyPct: totalCapacity > 0 ? Math.min(999, Math.round((currentEvacuees / totalCapacity) * 100)) : 0,
    byBarangay: Array.from(brgyMap.values()).sort((a, b) => b.occupants - a.occupants || b.capacity - a.capacity || a.barangay.localeCompare(b.barangay)),
    vulnerable,
    updatedToday,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const intOrNaN = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

/** Validate center create/update input. Throws Error with a readable message. */
export function validateCenterInput(input: EvacCenterInput): void {
  if (!input?.name || !String(input.name).trim()) throw new Error("Center name is required.");
  if (String(input.name).trim().length > 200) throw new Error("Center name must be at most 200 characters.");
  if (!input?.barangay || !String(input.barangay).trim()) throw new Error("Barangay is required.");
  if (String(input.barangay).trim().length > 120) throw new Error("Barangay must be at most 120 characters.");

  if (input.capacity !== undefined && input.capacity !== null) {
    const cap = intOrNaN(input.capacity);
    if (Number.isNaN(cap)) throw new Error("Capacity must be a number.");
    if (cap < 0 || cap > 100000) throw new Error("Capacity must be between 0 and 100,000 persons.");
  }
  if (input.capacityFamilies !== undefined && input.capacityFamilies !== null && String(input.capacityFamilies) !== "") {
    const fam = intOrNaN(input.capacityFamilies);
    if (Number.isNaN(fam)) throw new Error("Capacity (families) must be a number.");
    if (fam < 0 || fam > 20000) throw new Error("Capacity (families) must be between 0 and 20,000 families.");
  }
  if (input.landAreaSqm !== undefined && input.landAreaSqm !== null && String(input.landAreaSqm) !== "") {
    const sqm = Number(input.landAreaSqm);
    if (!Number.isFinite(sqm)) throw new Error("Land area must be a number.");
    if (sqm < 0 || sqm > 10000000) throw new Error("Land area must be between 0 and 10,000,000 sqm.");
  }
  if (input.latitude !== undefined && input.latitude !== null) {
    const lat = Number(input.latitude);
    if (!Number.isFinite(lat)) throw new Error("Latitude must be a number.");
    if (lat < 5 || lat > 20) throw new Error("Latitude must be within Philippine bounds (5 to 20).");
  }
  if (input.longitude !== undefined && input.longitude !== null) {
    const lng = Number(input.longitude);
    if (!Number.isFinite(lng)) throw new Error("Longitude must be a number.");
    if (lng < 115 || lng > 130) throw new Error("Longitude must be within Philippine bounds (115 to 130).");
  }
  if (input.contactNumber !== undefined && input.contactNumber !== null && String(input.contactNumber).length > 30) {
    throw new Error("Contact number must be at most 30 characters.");
  }
  if (input.contactPerson !== undefined && input.contactPerson !== null && String(input.contactPerson).length > 120) {
    throw new Error("Contact person must be at most 120 characters.");
  }
  if (input.status !== undefined && !(VALID_STATUSES as string[]).includes(String(input.status))) {
    throw new Error("Invalid status. Use OPEN, NEAR_CAPACITY, FULL, CLOSED or PREPARING.");
  }
  if (input.facilityType !== undefined && !FACILITY_TYPES.some((f) => f.value === input.facilityType)) {
    throw new Error("Invalid facility type.");
  }
}

// ---------------------------------------------------------------------------
// Occupancy updates
// ---------------------------------------------------------------------------

export interface OccupancyUpdateInput {
  centerId: string;
  occupants: number;
  male?: number;
  female?: number;
  children?: number;
  seniors?: number;
  pwd?: number;
  pregnant?: number;
  otherVulnerable?: number;
  note?: string | null;
  overrideOverCapacity?: boolean;
  actor: { id: string; name: string };
}

/**
 * Record a new occupancy snapshot for a center. Auto-recomputes the status
 * (unless overridden / CLOSED / PREPARING), writes an occupancy log +
 * status history entry, and audits the change.
 */
export async function updateCenterOccupancy(
  input: OccupancyUpdateInput
): Promise<{ center: EvacCenterDTO; log: OccupancyLogDTO }> {
  const settings = await getCommunicationSettings();
  const center = await db.evacuationCenter.findUnique({ where: { id: input.centerId } });
  if (!center) throw new Error("Evacuation center not found.");

  const counts: Array<[string, unknown]> = [
    ["occupants", input.occupants],
    ["male", input.male ?? 0],
    ["female", input.female ?? 0],
    ["children", input.children ?? 0],
    ["seniors", input.seniors ?? 0],
    ["pwd", input.pwd ?? 0],
    ["pregnant", input.pregnant ?? 0],
    ["otherVulnerable", input.otherVulnerable ?? 0],
  ];
  for (const [label, raw] of counts) {
    const n = intOrNaN(raw);
    if (Number.isNaN(n) || n < 0) throw new Error(`${label === "occupants" ? "Occupants" : label} must be a whole number of 0 or more.`);
  }

  const occupants = intOrNaN(input.occupants);
  const male = intOrNaN(input.male ?? 0);
  const female = intOrNaN(input.female ?? 0);
  const children = intOrNaN(input.children ?? 0);
  const seniors = intOrNaN(input.seniors ?? 0);
  const pwd = intOrNaN(input.pwd ?? 0);
  const pregnant = intOrNaN(input.pregnant ?? 0);
  const otherVulnerable = intOrNaN(input.otherVulnerable ?? 0);

  const capacity = center.capacity ?? 0;
  if (occupants > capacity && !input.overrideOverCapacity) {
    throw new Error("Occupancy exceeds capacity — override required");
  }

  const notes: string[] = [];
  if (male + female !== occupants) {
    notes.push(`Note: sex breakdown (male ${male} + female ${female} = ${male + female}) does not match the total of ${occupants}.`);
  }
  const note = [input.note?.trim(), ...notes].filter(Boolean).join(" ") || null;

  const pct = capacity > 0 ? Math.min(999, Math.round((occupants / capacity) * 100)) : 0;
  const autoStatus = autoStatusFromPct(pct, capacity);

  let newStatus = normalizeStatus(center.status);
  const canAuto =
    !center.statusOverride && !["CLOSED", "PREPARING"].includes(normalizeStatus(center.status));
  if (canAuto && newStatus !== autoStatus) {
    newStatus = autoStatus;
  }

  const updated = await db.evacuationCenter.update({
    where: { id: center.id },
    data: {
      currentOccupants: occupants,
      maleOccupants: male,
      femaleOccupants: female,
      childrenOccupants: children,
      seniorOccupants: seniors,
      pwdOccupants: pwd,
      pregnantOccupants: pregnant,
      otherVulnerable,
      status: newStatus,
      lastUpdatedBy: input.actor.name,
    },
  });

  if (canAuto && newStatus !== normalizeStatus(center.status)) {
    await db.evacuationStatusHistory.create({
      data: {
        centerId: center.id,
        previousStatus: center.status,
        newStatus,
        reason: "Auto-computed from occupancy",
        overridden: false,
        changedBy: input.actor.id,
        changedByName: input.actor.name,
      },
    });
  }

  const logRow = await db.evacuationOccupancyLog.create({
    data: {
      centerId: center.id,
      occupants,
      male,
      female,
      children,
      seniors,
      pwd,
      pregnant,
      otherVulnerable,
      note,
      recordedBy: input.actor.id,
      recordedByName: input.actor.name,
    },
    include: { center: { select: { name: true } } },
  });

  await logAudit({
    actorType: "ADMIN",
    actorName: input.actor.name,
    action: "EVAC_OCCUPANCY_UPDATED",
    detail: `${updated.name} (${updated.barangay}): ${center.currentOccupants} → ${occupants} occupants (${pct}% of ${capacity}). ${note ?? ""}`.trim(),
  });

  return {
    center: toEvacCenterDTO(updated, settings),
    log: toOccupancyLogDTO(logRow),
  };
}

// ---------------------------------------------------------------------------
// Manual status changes
// ---------------------------------------------------------------------------

export async function setCenterStatus(input: {
  centerId: string;
  status: EvacCenterStatus;
  reason?: string | null;
  actor: { id: string; name: string };
}): Promise<EvacCenterDTO> {
  const settings = await getCommunicationSettings();
  const center = await db.evacuationCenter.findUnique({ where: { id: input.centerId } });
  if (!center) throw new Error("Evacuation center not found.");
  if (!(VALID_STATUSES as string[]).includes(String(input.status))) {
    throw new Error("Invalid status. Use OPEN, NEAR_CAPACITY, FULL, CLOSED or PREPARING.");
  }

  const capacity = center.capacity ?? 0;
  const occupants = center.currentOccupants ?? 0;
  const pct = capacity > 0 ? Math.min(999, Math.round((occupants / capacity) * 100)) : 0;
  const autoStatus = autoStatusFromPct(pct, capacity);
  const matchesAuto = input.status === autoStatus;

  const updated = await db.evacuationCenter.update({
    where: { id: center.id },
    data: {
      status: input.status,
      statusOverride: !matchesAuto,
      lastUpdatedBy: input.actor.name,
    },
  });

  await db.evacuationStatusHistory.create({
    data: {
      centerId: center.id,
      previousStatus: center.status,
      newStatus: input.status,
      reason: input.reason?.trim() || (matchesAuto ? "Manual set (matches auto-computed status)" : "Manual override"),
      overridden: !matchesAuto,
      changedBy: input.actor.id,
      changedByName: input.actor.name,
    },
  });

  await logAudit({
    actorType: "ADMIN",
    actorName: input.actor.name,
    action: "EVAC_STATUS_CHANGED",
    detail: `${center.name}: ${normalizeStatus(center.status)} → ${input.status}${matchesAuto ? "" : " (override)"}${input.reason ? ` — ${input.reason}` : ""}`,
  });

  return toEvacCenterDTO(updated, settings);
}

// ---------------------------------------------------------------------------
// Helpers used by routes
// ---------------------------------------------------------------------------

/** Next PD-EVC-### sequence code based on existing rows. */
export async function nextEvacCenterCode(): Promise<string> {
  const rows = await db.evacuationCenter.findMany({ select: { code: true } });
  let max = 0;
  for (const row of rows) {
    const m = row.code?.match(/^PD-EVC-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `PD-EVC-${String(max + 1).padStart(3, "0")}`;
}

/** Resolve a barangay name to its Barangay row id (when it matches). */
export async function resolveBarangayId(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const row = await db.barangay.findFirst({ where: { name: trimmed }, select: { id: true } });
  return row?.id ?? null;
}

/** Map an EvacCenterInput body into Prisma create/update data (validated). */
export function centerInputToData(input: EvacCenterInput): Record<string, unknown> {
  return {
    name: String(input.name).trim(),
    barangay: String(input.barangay).trim(),
    address: input.address ? String(input.address).trim().slice(0, 300) : null,
    latitude: input.latitude != null && Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : null,
    longitude: input.longitude != null && Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : null,
    contactPerson: input.contactPerson ? String(input.contactPerson).trim().slice(0, 120) : null,
    contactNumber: input.contactNumber ? String(input.contactNumber).trim().slice(0, 30) : null,
    facilityType: input.facilityType && FACILITY_TYPES.some((f) => f.value === input.facilityType)
      ? input.facilityType
      : "SCHOOL",
    capacity: input.capacity != null ? intOrNaN(input.capacity) : 0,
    capacityFamilies:
      input.capacityFamilies != null && String(input.capacityFamilies) !== "" && Number.isFinite(Number(input.capacityFamilies))
        ? intOrNaN(input.capacityFamilies)
        : null,
    landAreaSqm:
      input.landAreaSqm != null && String(input.landAreaSqm) !== "" && Number.isFinite(Number(input.landAreaSqm))
        ? Number(input.landAreaSqm)
        : null,
    status: input.status && (VALID_STATUSES as string[]).includes(String(input.status)) ? input.status : "OPEN",
    specialNotes: input.specialNotes ? String(input.specialNotes).trim().slice(0, 1000) : null,
    accessibleFacilities: input.accessibleFacilities ? String(input.accessibleFacilities).trim().slice(0, 500) : null,
    waterStatus: ["AVAILABLE", "LIMITED", "UNAVAILABLE"].includes(String(input.waterStatus)) ? input.waterStatus : "AVAILABLE",
    electricityStatus: ["AVAILABLE", "GENERATOR_ONLY", "UNAVAILABLE"].includes(String(input.electricityStatus)) ? input.electricityStatus : "AVAILABLE",
    washStatus: ["AVAILABLE", "LIMITED", "UNAVAILABLE"].includes(String(input.washStatus)) ? input.washStatus : "AVAILABLE",
    medicalAssistance: input.medicalAssistance === true,
    foodRelief: input.foodRelief === true,
    sleepingArea: input.sleepingArea !== false,
    generator: input.generator === true,
    vehicleAccess: input.vehicleAccess !== false,
    petsAllowed: input.petsAllowed === true,
    visible: input.visible !== false,
    displayOrder: input.displayOrder != null ? intOrNaN(input.displayOrder) : 0,
  };
}
