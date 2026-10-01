// QAS33 Evacuation Management — client-side typed fetch helpers + pure UI helpers.
// Follows the request pattern of src/lib/qas33/api.ts (JSON in/out, throws
// Error(data.error) on !ok). Safe to import from client components.
//
// NOTE on permissions: canManageEvacuation / canDeleteAnnouncements live in
// src/lib/qas33/auth.ts, but that module imports next/headers + Prisma and is
// SERVER-ONLY (verified: importing it from a client component fails the build
// with "You're importing a component that needs next/headers"). The pure
// permission logic is therefore mirrored here against the client-safe
// normalizeAdminRole() in ./types — keep in sync with auth.ts.

import { formatDistanceToNowStrict } from "date-fns";
import { normalizeAdminRole } from "./types";
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

async function evacRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Response contracts (verified live against the API routes)
// ---------------------------------------------------------------------------

export interface EvacCentersResponse {
  centers: EvacCenterDTO[];
  barangays: Array<{ code: string; name: string }>;
}

export interface EvacDashboardResponse {
  stats: EvacDashboardStats;
  settings: CommunicationSettings;
  centers: EvacCenterDTO[];
  recentLogs: OccupancyLogDTO[];
  announcements: EvacAnnouncementDTO[];
}

export interface EvacHistoryResponse {
  occupancyLogs: OccupancyLogDTO[];
  statusHistory: StatusHistoryDTO[];
}

export interface EvacPerCenterReport {
  centerId: string;
  name: string;
  barangay: string;
  capacity: number;
  currentOccupants: number;
  logs: OccupancyLogDTO[];
  statusHistory: StatusHistoryDTO[];
}

export interface EvacReportsResponse {
  from: string;
  to: string;
  perCenter: EvacPerCenterReport[];
  perBarangay: Array<{ barangay: string; centers: number; capacity: number; occupants: number }>;
  totals: EvacDashboardStats;
}

/** POST /occupancy payload — full breakdown required (server zeroes omitted fields). */
export interface OccupancyPayload {
  occupants: number;
  male: number;
  female: number;
  children: number;
  seniors: number;
  pwd: number;
  pregnant: number;
  otherVulnerable: number;
  note?: string | null;
  overrideOverCapacity?: boolean;
}

export interface AnnouncementPayload {
  title: string;
  message: string;
  priority: EvacAnnouncementPriority;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "CANCELLED" | "EXPIRED";
  targetBarangays: string[];
  targetCenterIds: string[];
  publishAt?: string;
  expiresAt?: string | null;
}

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

export const evacApi = {
  centers: () => evacRequest<EvacCentersResponse>("/api/admin/evacuation/centers"),
  createCenter: (input: EvacCenterInput) =>
    evacRequest<{ center: EvacCenterDTO }>("/api/admin/evacuation/centers", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCenter: (id: string, input: EvacCenterInput) =>
    evacRequest<{ center: EvacCenterDTO }>(`/api/admin/evacuation/centers/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  /** Soft delete (visible=false). */
  deleteCenter: (id: string) =>
    evacRequest<{ ok: boolean }>(`/api/admin/evacuation/centers/${id}`, { method: "DELETE" }),
  occupancy: (id: string, payload: OccupancyPayload) =>
    evacRequest<{ center: EvacCenterDTO; log: OccupancyLogDTO }>(
      `/api/admin/evacuation/centers/${id}/occupancy`,
      { method: "POST", body: JSON.stringify(payload) }
    ),
  status: (id: string, status: EvacCenterStatus, reason?: string | null) =>
    evacRequest<{ center: EvacCenterDTO }>(`/api/admin/evacuation/centers/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, reason: reason ?? null }),
    }),
  history: (id: string) =>
    evacRequest<EvacHistoryResponse>(`/api/admin/evacuation/centers/${id}/history`),
  dashboard: () => evacRequest<EvacDashboardResponse>("/api/admin/evacuation/dashboard"),
  reports: (from: string, to: string) =>
    evacRequest<EvacReportsResponse>(
      `/api/admin/evacuation/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ),
  announcements: () =>
    evacRequest<{ announcements: EvacAnnouncementDTO[] }>("/api/admin/evacuation/announcements"),
  createAnnouncement: (payload: AnnouncementPayload) =>
    evacRequest<{ announcement: EvacAnnouncementDTO }>("/api/admin/evacuation/announcements", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAnnouncement: (id: string, payload: Partial<AnnouncementPayload>) =>
    evacRequest<{ announcement: EvacAnnouncementDTO }>(`/api/admin/evacuation/announcements/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  /** Default DELETE = cancel (status CANCELLED). hard=true permanently removes (SYSTEM_ADMIN only). */
  deleteAnnouncement: (id: string, hard = false) =>
    evacRequest<{ ok: boolean; announcement?: EvacAnnouncementDTO; deleted?: boolean }>(
      `/api/admin/evacuation/announcements/${id}${hard ? "?hard=1" : ""}`,
      { method: "DELETE" }
    ),
};

// ---------------------------------------------------------------------------
// Client-safe permission mirrors (auth.ts is server-only — see note at top)
// ---------------------------------------------------------------------------

/** Can create/edit centers, update occupancy, change status, manage announcements. */
export function canManageEvacuationClient(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = normalizeAdminRole(role);
  return r === "SYSTEM_ADMIN" || r === "MDRRMO_OFFICER";
}

/** Hard delete of announcements is restricted to the System Administrator. */
export function canDeleteAnnouncementsClient(role: string | null | undefined): boolean {
  if (!role) return false;
  return normalizeAdminRole(role) === "SYSTEM_ADMIN";
}

// ---------------------------------------------------------------------------
// Formatting helpers (en-PH / date-fns)
// ---------------------------------------------------------------------------

const phNumber = new Intl.NumberFormat("en-PH");

/** 1,640 — en-PH grouping. */
export function evacNum(n: number | null | undefined): string {
  return phNumber.format(Math.max(0, Number(n) || 0));
}

/** "2 minutes ago" */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}
