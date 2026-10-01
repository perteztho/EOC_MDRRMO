// QAS33 client-side API helpers for the admin News & Public Updates module
// (News posts + categories + Broadcast Center + Notification history + push
// status + communication settings). Follows the request() pattern of
// src/lib/qas33/api.ts — pure fetch wrappers, no server imports.
import type {
  BroadcastChannel,
  BroadcastDTO,
  BroadcastPriority,
  CommunicationSettings,
  DeliveryLogDTO,
  EvacCenterDTO,
  NewsCategoryDTO,
  NewsPostDTO,
  NewsPostInput,
  NewsPostStatus,
  PushStatusDTO,
} from "./emergency-types";
import { normalizeAdminRole } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
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
// Role gating (client mirrors — @/lib/qas33/auth holds the canonical server
// predicates but imports next/headers + Prisma, so it cannot be imported into
// a client component. Semantics kept identical.)
// ---------------------------------------------------------------------------
const _r = (role: string | null | undefined) => normalizeAdminRole(role ?? "");
export const canPublishNews = (role: string | null | undefined) => {
  const r = _r(role);
  return r === "SYSTEM_ADMIN" || r === "MDRRMO_OFFICER";
};
export const canSendBroadcast = (role: string | null | undefined) => {
  const r = _r(role);
  return r === "SYSTEM_ADMIN" || r === "MDRRMO_OFFICER";
};
export const canSendCriticalBroadcast = (role: string | null | undefined) => {
  const r = _r(role);
  return r === "SYSTEM_ADMIN" || r === "MDRRMO_OFFICER";
};
export const canDeleteAnnouncements = (role: string | null | undefined) => _r(role) === "SYSTEM_ADMIN";
export const canManageNotificationConfig = (role: string | null | undefined) => _r(role) === "SYSTEM_ADMIN";
export const canSaveCommunication = (role: string | null | undefined) => {
  const r = _r(role);
  return r === "SYSTEM_ADMIN" || r === "MDRRMO_OFFICER";
};

// ---------------------------------------------------------------------------
// Payload shapes
// ---------------------------------------------------------------------------

export interface NewsPostsParams {
  status?: NewsPostStatus;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface NewsPostsResponse {
  posts: NewsPostDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BroadcastComposerPayload {
  title: string;
  message: string;
  priority: BroadcastPriority;
  channels: BroadcastChannel[];
  targetAudience: string;
  targetBarangays?: string[];
  targetCenterIds?: string[];
  expiresAt?: string | null;
  mode: "send" | "schedule" | "draft";
  scheduledAt?: string;
}

export interface HistoryParams {
  channel?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface HistoryResponse {
  logs: DeliveryLogDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EvacCentersResponse {
  centers: EvacCenterDTO[];
  barangays: Array<{ code: string; name: string }>;
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== "ALL") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const newsApi = {
  // ---- news posts ----
  posts: (params: NewsPostsParams = {}) =>
    request<NewsPostsResponse>(`/api/admin/news/posts${qs({ ...params })}`),
  createPost: (input: NewsPostInput) =>
    request<{ post: NewsPostDTO }>("/api/admin/news/posts", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updatePost: (id: string, patch: Partial<NewsPostInput> & { action?: string }) =>
    request<{ post: NewsPostDTO }>(`/api/admin/news/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  archivePost: (id: string) =>
    request<{ ok: boolean; post: NewsPostDTO }>(`/api/admin/news/posts/${id}`, { method: "DELETE" }),
  hardDeletePost: (id: string) =>
    request<{ ok: boolean; deleted: boolean }>(`/api/admin/news/posts/${id}?hard=1`, { method: "DELETE" }),

  // ---- news categories ----
  categories: () =>
    request<{ categories: NewsCategoryDTO[]; counts: Record<string, number> }>("/api/admin/news/categories"),
  createCategory: (payload: { key: string; name: string; description?: string; color?: string; emergency?: boolean; displayOrder?: number; active?: boolean }) =>
    request<{ category: NewsCategoryDTO }>("/api/admin/news/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCategory: (
    id: string,
    patch: { name?: string; description?: string; color?: string; emergency?: boolean; displayOrder?: number; active?: boolean }
  ) =>
    request<{ category: NewsCategoryDTO }>(`/api/admin/news/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteCategory: (id: string) => request<{ ok: boolean }>(`/api/admin/news/categories/${id}`, { method: "DELETE" }),

  // ---- broadcasts ----
  broadcasts: (status?: string) =>
    request<{ broadcasts: BroadcastDTO[] }>(`/api/admin/broadcasts${qs({ status })}`),
  createBroadcast: (payload: BroadcastComposerPayload) =>
    request<{ broadcast: BroadcastDTO }>("/api/admin/broadcasts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  broadcastAction: (id: string, body: Record<string, unknown>) =>
    request<{ broadcast: BroadcastDTO }>(`/api/admin/broadcasts/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteBroadcast: (id: string) => request<{ ok: boolean }>(`/api/admin/broadcasts/${id}`, { method: "DELETE" }),

  // ---- notification history ----
  history: (params: HistoryParams = {}) =>
    request<HistoryResponse>(`/api/admin/notifications/history${qs({ ...params })}`),

  // ---- push notifications ----
  pushStatus: () => request<{ push: PushStatusDTO }>("/api/admin/push/status"),
  pushTest: () =>
    request<{ result: { sent: number; failed: number; deviceCount: number; error?: string } }>(
      "/api/admin/push/test",
      { method: "POST" }
    ),

  // ---- communication settings ----
  communication: () => request<{ settings: CommunicationSettings; push: PushStatusDTO }>("/api/admin/portal/communication"),
  saveCommunication: (patch: Partial<CommunicationSettings>) =>
    request<{ settings: CommunicationSettings }>("/api/admin/portal/communication", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  // ---- evacuation centers (for targeting pickers) ----
  evacCenters: () => request<EvacCentersResponse>("/api/admin/evacuation/centers"),
};

// ---------------------------------------------------------------------------
// datetime-local helpers
// ---------------------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, "0");

/** ISO string → value usable in <input type="datetime-local"> (local time). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** datetime-local input value → ISO string (null when empty/invalid). */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Current local time as a datetime-local input value. */
export function nowLocalInput(): string {
  return isoToLocalInput(new Date().toISOString());
}

/** Derive an uppercase slug key from a category name (mirrors server rules). */
export function slugifyCategoryKey(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}
