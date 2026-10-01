// QAS33 Public Portal — typed client API helpers
// Used by the public portal components AND the admin Public Website module.

import type {
  AdminConfigResponse,
  AdminSection,
  AdminWidget,
  AnnouncementDTO,
  AwsWeatherResponse,
  ForecastResponse,
  HomepageResponse,
  IncidentSubmitResponse,
  OperationalMode,
  PortalContentResponse,
  PublishStateResponse,
  SectionConfig,
  SnapshotInfo,
  TemplateMeta,
  WidgetMeta,
} from "./portal-types";
import { CONTENT_TYPES } from "./portal-types";
import type { ContentTypeDef } from "./portal-types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData ? init?.headers : { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Public endpoints
// ---------------------------------------------------------------------------

export const portalApiPublic = {
  homepage: () => request<HomepageResponse>("/api/public/homepage"),
  content: () => request<PortalContentResponse>("/api/public/content"),
  weather: () => request<AwsWeatherResponse>("/api/public/weather"),
  forecast: () => request<ForecastResponse>("/api/public/weather/forecast"),
  submitIncident: (form: FormData) =>
    request<IncidentSubmitResponse>("/api/public/incident-report", { method: "POST", body: form }),
  checkIncident: (ref: string) =>
    request<{ ok: true; referenceNo: string; type: string; urgency: string; barangay: string | null; status: string; createdAt: string }>(
      `/api/public/incident-report?ref=${encodeURIComponent(ref)}`
    ),
};

// ---------------------------------------------------------------------------
// Admin endpoints — homepage builder
// ---------------------------------------------------------------------------

export interface SectionsResponse {
  ok: true;
  sections: AdminSection[];
  templates: TemplateMeta[];
}

export interface WidgetsResponse {
  ok: true;
  widgets: AdminWidget[];
  types: WidgetMeta[];
}

export const portalApiAdmin = {
  listSections: () => request<SectionsResponse>("/api/admin/portal/sections"),
  createSection: (template: string, key?: string) =>
    request<{ ok: true; section: AdminSection }>("/api/admin/portal/sections", {
      method: "POST",
      body: JSON.stringify({ action: "create", template, key }),
    }),
  reorderSections: (ids: string[]) =>
    request<{ ok: true }>("/api/admin/portal/sections", { method: "POST", body: JSON.stringify({ action: "reorder", ids }) }),
  duplicateSection: (id: string) =>
    request<{ ok: true; section: AdminSection }>("/api/admin/portal/sections", {
      method: "POST",
      body: JSON.stringify({ action: "duplicate", id }),
    }),
  resetSection: (id: string) =>
    request<{ ok: true; section: AdminSection }>("/api/admin/portal/sections", {
      method: "POST",
      body: JSON.stringify({ action: "reset", id }),
    }),
  updateSection: (id: string, patch: Partial<{ name: string; sectionKey: string; heading: string; subtitle: string | null; description: string | null; status: string; config: Partial<SectionConfig> }>) =>
    request<{ ok: true; section: AdminSection }>(`/api/admin/portal/sections/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteSection: (id: string) => request<{ ok: true }>(`/api/admin/portal/sections/${id}`, { method: "DELETE" }),

  listWidgets: () => request<WidgetsResponse>("/api/admin/portal/widgets"),
  createWidget: (type: string) =>
    request<{ ok: true; widget: AdminWidget }>("/api/admin/portal/widgets", {
      method: "POST",
      body: JSON.stringify({ action: "create", type }),
    }),
  reorderWidgets: (ids: string[]) =>
    request<{ ok: true }>("/api/admin/portal/widgets", { method: "POST", body: JSON.stringify({ action: "reorder", ids }) }),
  resetWidgets: () =>
    request<{ ok: true; widgets: AdminWidget[] }>("/api/admin/portal/widgets", { method: "POST", body: JSON.stringify({ action: "reset" }) }),
  updateWidget: (id: string, patch: Partial<{ title: string; enabled: boolean; config: Record<string, unknown> }>) =>
    request<{ ok: true; widget: AdminWidget }>(`/api/admin/portal/widgets/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteWidget: (id: string) => request<{ ok: true }>(`/api/admin/portal/widgets/${id}`, { method: "DELETE" }),

  publishState: () => request<PublishStateResponse>("/api/admin/portal/publish"),
  publish: (note?: string) =>
    request<{ ok: true; version: number; publishedAt: string }>("/api/admin/portal/publish", {
      method: "POST",
      body: JSON.stringify({ action: "publish", note }),
    }),
  restoreSnapshot: (snapshotId: string) =>
    request<{ ok: true; version: number; publishedAt: string }>("/api/admin/portal/publish", {
      method: "POST",
      body: JSON.stringify({ action: "restore", snapshotId }),
    }),
  resetHomepage: () =>
    request<{ ok: true; version: number; publishedAt: string }>("/api/admin/portal/publish", {
      method: "POST",
      body: JSON.stringify({ action: "reset" }),
    }),

  getConfig: () => request<AdminConfigResponse>("/api/admin/portal/config"),
  saveConfig: (scope: string, value: Record<string, unknown>) =>
    request<{ ok: true }>("/api/admin/portal/config", { method: "PUT", body: JSON.stringify({ scope, value }) }),
  setMode: (mode: OperationalMode) =>
    request<{ ok: true; mode: OperationalMode }>("/api/admin/portal/config", {
      method: "POST",
      body: JSON.stringify({ action: "set-mode", mode }),
    }),

  // generic content CRUD — types driven by CONTENT_TYPES
  listContent: (type: string) => request<{ ok: true; items: Record<string, unknown>[] }>(`/api/admin/portal/content/${type}`),
  createContent: (type: string, data: Record<string, unknown>) =>
    request<{ ok: true; item: Record<string, unknown> }>(`/api/admin/portal/content/${type}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateContent: (type: string, id: string, data: Record<string, unknown>) =>
    request<{ ok: true; item: Record<string, unknown> }>(`/api/admin/portal/content/${type}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteContent: (type: string, id: string) =>
    request<{ ok: true }>(`/api/admin/portal/content/${type}/${id}`, { method: "DELETE" }),

  listIncidents: (status?: string) =>
    request<{
      ok: true;
      items: Array<{
        id: string; referenceNo: string; type: string; urgency: string; name: string | null; contact: string | null;
        location: string; barangay: string | null; description: string | null; latitude: string | null;
        longitude: string | null; attachmentUrl: string | null; status: string; adminNotes: string | null; createdAt: string;
      }>;
    }>(`/api/admin/portal/incidents${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  updateIncident: (id: string, patch: { status?: string; adminNotes?: string }) =>
    request<{ ok: true }>("/api/admin/portal/incidents", { method: "PATCH", body: JSON.stringify({ id, ...patch }) }),
};

export function contentTypeDefs(): ContentTypeDef[] {
  return CONTENT_TYPES;
}
