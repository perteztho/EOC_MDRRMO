// QAS33 client-side API helpers
import type {
  SessionInfo,
  BarangayOverview,
  BarangaySubmissionData,
  AdminBarangayRow,
  AdminSubmissionRow,
  AdminSubmissionDetail,
  AdminOverviewStats,
  AuditEntry,
  NotificationItem,
  CommentItem,
  SettingValues,
  TutorialItem,
  FileLibraryResponse,
  FileLibraryItem,
  CredentialsPrintResponse,
  PlanBuilderCard,
  PlanDetailResponse,
  PlanReviewInfo,
  PlanSectionClient,
} from "./types";
import type { AdminPlanRow, PlanAutofillResponse, PlanApprovalStatus } from "./emergency-types";
import type {
  BarangayFrontpageContent,
} from "./frontpage-types";
import type {
  BarangayFrontpageResponse,
  FrontpageManagerPayload,
  PublicBarangaySummary,
} from "./frontpage-service";

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

export const api = {
  // ---- auth ----
  me: () => request<{ session: SessionInfo | null }>("/api/auth/me"),
  loginBarangay: (code: string, pin: string) =>
    request<{ role: string; mustChangePin?: boolean }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ role: "barangay", code, pin }),
    }),
  loginAdmin: (username: string, password: string) =>
    request<{ role: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ role: "admin", username, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  changePin: (currentPin: string, newPin: string, confirmPin: string) =>
    request<{ ok: boolean }>("/api/auth/change-pin", {
      method: "POST",
      body: JSON.stringify({ currentPin, newPin, confirmPin }),
    }),

  // ---- barangay ----
  overview: () => request<BarangayOverview>("/api/barangay/overview"),
  submission: () => request<BarangaySubmissionData>("/api/barangay/submission"),
  saveValues: (values: Record<string, unknown>) =>
    request<{ ok: boolean; progress: number; status: string }>("/api/barangay/submission", {
      method: "PUT",
      body: JSON.stringify({ values }),
    }),
  planBuilders: () =>
    request<{ year: number; builders: PlanBuilderCard[] }>("/api/barangay/plans"),
  planDetail: (code: string) => request<PlanDetailResponse>(`/api/barangay/plans/${code}`),
  planAutofill: (code: string) =>
    request<PlanAutofillResponse>(`/api/barangay/plans/${code}/autofill`),
  planExportUrl: (code: string, format: "pdf" | "docx") =>
    `/api/barangay/plans/${code}/export?format=${format}`,
  adminPlanExportUrl: (id: string, format: "pdf" | "docx") =>
    `/api/admin/plans/${id}/export?format=${format}`,
  savePlan: (code: string, values: Record<string, unknown>) =>
    request<{ ok: boolean; progress: number; status: string }>(`/api/barangay/plans/${code}`, {
      method: "PUT",
      body: JSON.stringify({ values }),
    }),
  planAction: (code: string, action: "reset" | "reopen" | "submit" | "withdraw") =>
    request<{ ok: boolean; progress?: number; status?: string; submittedAt?: string }>(`/api/barangay/plans/${code}`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),
  selectTemplate: (lang: string) =>
    request<{ ok: boolean; templateLang: string }>("/api/barangay/submission", {
      method: "POST",
      body: JSON.stringify({ action: "select-template", lang }),
    }),
  uploadFile: (sectionKey: string, file: File) => {
    const form = new FormData();
    form.append("sectionKey", sectionKey);
    form.append("file", file);
    return request<{ ok: boolean; progress: number; status: string }>("/api/barangay/files", {
      method: "POST",
      body: form,
    });
  },
  deleteFile: (fileId: string) =>
    request<{ ok: boolean; progress: number; status: string }>(`/api/barangay/files?fileId=${fileId}`, {
      method: "DELETE",
    }),
  submit: (certified: boolean) =>
    request<{ ok: boolean; version: number; status: string }>("/api/barangay/submit", {
      method: "POST",
      body: JSON.stringify({ certified }),
    }),
  comments: () => request<{ comments: CommentItem[] }>("/api/barangay/comments"),
  document: () =>
    request<{
      document: {
        docId: string;
        version: number;
        lang: string;
        signed: boolean;
        signedBy: string | null;
        signedAt: string | null;
        signatureHash: string | null;
        generatedAt: string;
        downloadCount: number;
        downloads: Array<{ id: string; downloadedBy: string; ip: string | null; createdAt: string }>;
      };
      submission: { status: string; approvedAt: string | null };
    }>("/api/barangay/document"),
  notifications: () =>
    request<{ notifications: NotificationItem[]; unread: number }>("/api/barangay/notifications"),
  markNotificationsRead: (ids?: string[]) =>
    request<{ ok: boolean }>("/api/barangay/notifications", {
      method: "POST",
      body: JSON.stringify(ids ? { ids } : { all: true }),
    }),
  history: () =>
    request<{
      versions: Array<{ version: number; submittedAt: string; note: string | null }>;
      reviews: Array<{
        id: string;
        action: string;
        reviewerName: string;
        overallComment: string | null;
        createdAt: string;
        version: number;
        commentCount: number;
      }>;
      currentStatus: string;
      currentVersion: number;
    }>("/api/barangay/history"),
  tutorials: () => request<{ lang: string; tutorials: TutorialItem[] }>("/api/barangay/tutorials"),

  // ---- barangay frontpage (public + manager) ----
  publicBarangays: () =>
    request<{ ok: boolean; barangays: PublicBarangaySummary[] }>("/api/public/barangays"),
  publicFrontpage: (slug: string) =>
    request<BarangayFrontpageResponse>(`/api/public/barangay-frontpage?slug=${encodeURIComponent(slug)}`),
  publicFrontpageInquiry: (payload: {
    slug: string;
    kind: "MESSAGE" | "SERVICE_REQUEST";
    name: string;
    contact: string;
    service?: string;
    message: string;
  }) =>
    request<{ ok: boolean; message: string }>("/api/public/barangay-frontpage", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  publicResidentSearch: (slug: string, q: string) =>
    request<{ ok: boolean; results: Array<{ fullName: string; purok: string }>; hint?: string }>(
      `/api/public/barangay-residents?slug=${encodeURIComponent(slug)}&q=${encodeURIComponent(q)}`
    ),
  frontpageManager: () => request<FrontpageManagerPayload>("/api/barangay/frontpage"),
  saveFrontpage: (content: BarangayFrontpageContent, published: boolean) =>
    request<{ ok: boolean; published: boolean }>("/api/barangay/frontpage", {
      method: "PUT",
      body: JSON.stringify({ content, published }),
    }),
  /** Quick publish/hide toggle (Settings page) — content is untouched. */
  setFrontpagePublished: (published: boolean) =>
    request<{ ok: boolean; published: boolean }>("/api/barangay/frontpage", {
      method: "PATCH",
      body: JSON.stringify({ published }),
    }),
  resetFrontpage: () =>
    request<{ ok: boolean }>("/api/barangay/frontpage", { method: "DELETE" }),
  frontpageInquiries: () =>
    request<{ ok: boolean; inquiries: FrontpageManagerPayload["inquiries"] }>(
      "/api/barangay/frontpage/inquiries"
    ),
  setFrontpageInquiryStatus: (id: string, status: "NEW" | "DONE") =>
    request<{ ok: boolean; status: string }>("/api/barangay/frontpage/inquiries", {
      method: "POST",
      body: JSON.stringify({ id, status }),
    }),

  // ---- admin ----
  adminOverview: () =>
    request<{
      stats: AdminOverviewStats;
      year: number;
      recentActivity: AuditEntry[];
    }>("/api/admin/overview"),
  adminBarangays: (search = "", status = "ALL") =>
    request<{ barangays: AdminBarangayRow[]; year: number }>(
      `/api/admin/barangays?search=${encodeURIComponent(search)}&status=${status}`
    ),
  adminBarangayAction: (id: string, action: string) =>
    request<{ ok: boolean; tempPin?: string; message?: string; active?: boolean }>(`/api/admin/barangays/${id}`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),
  // Printable barangay account credential sheets (all console roles)
  adminPrintCredentials: (
    payload:
      | { mode: "one"; barangayId: string; regenerate?: boolean }
      | { mode: "all"; regenerate: "pending" | "missing" | "all" }
  ) =>
    request<CredentialsPrintResponse>("/api/admin/credentials", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  adminSubmissions: (search = "", status = "ALL") =>
    request<{ submissions: AdminSubmissionRow[]; year: number }>(
      `/api/admin/submissions?search=${encodeURIComponent(search)}&status=${status}`
    ),
  adminSubmission: (id: string) => request<AdminSubmissionDetail>(`/api/admin/submissions/${id}`),
  adminReview: (id: string, payload: Record<string, unknown>) =>
    request<{ ok: boolean; status?: string; maxTotal?: number }>(`/api/admin/submissions/${id}/review`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // ---- admin: Plan Approvals (BDRRM/BDP plan builders) ----
  adminPlans: (params?: { status?: string; builder?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status && params.status !== "ALL") qs.set("status", params.status);
    if (params?.builder && params.builder !== "ALL") qs.set("builder", params.builder);
    if (params?.search) qs.set("search", params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ plans: AdminPlanRow[]; year: number }>(`/api/admin/plans${suffix}`);
  },
  adminPlanDetail: (id: string) =>
    request<{
      plan: AdminPlanRow;
      builder: PlanBuilderCard;
      year: number;
      barangay: { code: string; name: string; captain?: string | null };
      sections: PlanSectionClient[];
      values: Record<string, unknown>;
      progress: number;
      status: PlanApprovalStatus;
      updatedAt: string | null;
      review: PlanReviewInfo;
    }>(`/api/admin/plans/${id}`),
  adminPlanReview: (
    id: string,
    action: "approve" | "return" | "provincial-approve",
    note?: string,
    officerName?: string
  ) =>
    request<{ ok: boolean; plan: AdminPlanRow }>(`/api/admin/plans/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ action, note, officerName }),
    }),
  adminRating: (id: string, scores: Record<string, number>, remarks?: string) =>
    request<{ ok: boolean }>(`/api/admin/submissions/${id}/rating`, {
      method: "POST",
      body: JSON.stringify({ scores, remarks }),
    }),
  adminFinalize: (id: string, signedBy?: string, position?: string) =>
    request<{ ok: boolean; docId: string; signedBy: string; size: number; verifyUrl: string }>(
      `/api/admin/submissions/${id}/finalize`,
      { method: "POST", body: JSON.stringify({ signedBy, position }) }
    ),
  adminReports: () =>
    request<{
      year: number;
      rows: Array<{
        code: string;
        barangay: string;
        captain: string;
        status: string;
        progress: number;
        version: number;
        template: string;
        lastSubmitted: string;
        approvedAt: string;
        rating: number | null;
        docId: string;
        downloads: number;
      }>;
      counts: Record<string, number>;
      totals: { barangays: number; submitted: number; approved: number; avgRating: number | null; ratingMaxTotal: number };
    }>("/api/admin/reports"),
  adminAudit: (search = "", actor = "", offset = 0) =>
    request<{ entries: AuditEntry[]; total: number }>(
      `/api/admin/audit?search=${encodeURIComponent(search)}&actor=${actor}&limit=100&offset=${offset}`
    ),
  adminNotifications: () =>
    request<{ notifications: NotificationItem[]; unread: number }>("/api/admin/notifications"),
  adminMarkNotificationsRead: (ids?: string[]) =>
    request<{ ok: boolean }>("/api/admin/notifications", {
      method: "POST",
      body: JSON.stringify(ids ? { ids } : { all: true }),
    }),
  adminSettings: () =>
    request<{
      settings: SettingValues;
      criteria: Array<{ id: string; key: string; name: string; maxScore: number; order: number; active: boolean }>;
      users: Array<{
        id: string;
        username: string;
        name: string;
        position: string | null;
        role: string;
        active: boolean;
        lastLoginAt: string | null;
      }>;
    }>("/api/admin/settings"),
  adminSaveSettings: (payload: Record<string, unknown>) =>
    request<{ ok: boolean }>("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) }),
  adminTutorials: () =>
    request<{
      tutorials: Array<{
        key: string;
        titleEn: string;
        titleTl: string;
        bodyEn: string;
        bodyTl: string;
        order: number;
        active: boolean;
      }>;
    }>("/api/admin/tutorials"),
  adminUpdateTutorial: (payload: Record<string, unknown>) =>
    request<{ ok: boolean }>("/api/admin/tutorials", { method: "PUT", body: JSON.stringify(payload) }),
  adminRequirements: () =>
    request<{
      sections: Array<{
        key: string;
        order: number;
        titleEn: string;
        titleTl: string;
        descEn: string | null;
        descTl: string | null;
        requiresUpload: boolean;
        uploadLabelEn: string | null;
        uploadLabelTl: string | null;
        uploadFormats: string[];
        uploadMaxMB: number;
        required: boolean;
        active: boolean;
        fieldCount: number;
      }>;
    }>("/api/admin/requirements"),
  adminUpdateRequirement: (payload: Record<string, unknown>) =>
    request<{ ok: boolean }>("/api/admin/requirements", { method: "PUT", body: JSON.stringify(payload) }),

  // ---- admin: user management (SYSTEM_ADMIN only) ----
  adminUsers: () =>
    request<{
      users: Array<{
        id: string;
        username: string;
        name: string;
        position: string | null;
        role: string;
        active: boolean;
        lastLoginAt: string | null;
        createdAt: string;
      }>;
    }>("/api/admin/users"),
  adminCreateUser: (payload: { username: string; name: string; position?: string; password: string; role: string }) =>
    request<{ ok: boolean; user: { id: string; username: string; name: string } }>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  adminUpdateUser: (
    id: string,
    payload: { name?: string; position?: string; role?: string; active?: boolean; password?: string }
  ) =>
    request<{ ok: boolean; message?: string }>(`/api/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  adminDeleteUser: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${id}`, { method: "DELETE" }),

  // ---- admin: resident accounts (QAS33 public registration directory) ----
  adminResidents: (params: { q?: string; barangay?: string; barangayId?: string; status?: string; page?: number; pageSize?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.barangayId) qs.set("barangayId", params.barangayId);
    if (params.barangay) qs.set("barangay", params.barangay);
    if (params.status) qs.set("status", params.status);
    qs.set("page", String(params.page ?? 1));
    qs.set("pageSize", String(params.pageSize ?? 25));
    return request<{
      ok: true;
      total: number;
      page: number;
      pageSize: number;
      counts: Record<string, number>;
      residents: Array<{
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        barangay: string;
        purok: string | null;
        sex: string | null;
        status: string;
        createdAt: string;
      }>;
    }>(`/api/admin/residents?${qs.toString()}`);
  },
  adminSetResidentStatus: (id: string, status: string) =>
    request<{ ok: true; resident: { id: string; fullName: string; status: string } }>("/api/admin/residents", {
      method: "PUT",
      body: JSON.stringify({ id, status }),
    }),

  // ---- admin: database management (SYSTEM_ADMIN only) ----
  adminDatabaseTables: () =>
    request<{
      tables: Array<{
        key: string;
        label: string;
        group: string;
        desc: string;
        count: number;
        idField: string;
        orderBy: { field: string; dir: "asc" | "desc" };
        searchFields: string[];
        fields: Array<{
          name: string;
          label: string;
          type: "string" | "number" | "boolean" | "datetime" | "json";
          required?: boolean;
          nullable?: boolean;
          readonly?: boolean;
          fk?: string;
          help?: string;
        }>;
      }>;
    }>("/api/admin/database"),
  adminDatabaseRows: (table: string, page = 1, pageSize = 25, search = "") =>
    request<{ rows: Array<Record<string, unknown>>; total: number; page: number; pageSize: number }>(
      `/api/admin/database/${table}?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`
    ),
  adminDatabaseCreate: (table: string, data: Record<string, unknown>) =>
    request<{ ok: boolean; row: Record<string, unknown> }>(`/api/admin/database/${table}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminDatabaseUpdate: (table: string, id: string, data: Record<string, unknown>) =>
    request<{ ok: boolean; row: Record<string, unknown> }>(`/api/admin/database/${table}/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDatabaseDelete: (table: string, id: string) =>
    request<{ ok: boolean }>(`/api/admin/database/${table}/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // ---- admin: database backup / restore (SYSTEM_ADMIN only) ----
  adminDatabaseExportUrl: (table: "ALL" | string) =>
    `/api/admin/database/export?table=${encodeURIComponent(table)}`,
  adminDatabaseImport: (
    payload: unknown,
    mode: "merge" | "replace",
    tables?: string[]
  ) =>
    request<{
      ok: boolean;
      mode: string;
      format: string;
      totalInserted: number;
      unknownKeys: string[];
      errors: string[];
      results: Array<{ model: string; label: string; inserted: number; skipped: number; mode: string }>;
    }>("/api/admin/database/import", {
      method: "POST",
      body: JSON.stringify({ payload, mode, tables }),
    }),

  // ---- admin: full system backup (Settings — SYSTEM_ADMIN only) ----
  adminSystemBackupUrl: () => "/api/admin/settings/system-backup",
  adminSystemRestore: (file: File, confirm: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("confirm", confirm);
    return request<{
      ok: boolean;
      file: string;
      tables: number;
      totalInserted: number;
      filesRestored: number;
      fileErrors: string[];
      rows: Array<{ table: string; inserted: number }>;
    }>("/api/admin/settings/system-backup", { method: "POST", body: form });
  },

  // ---- file library (ALL users — barangay + every console role) ----
  filesList: (params: {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
    kind?: string;
    scope?: string; // all | mine | barangay-uploads (admin only)
    barangayCode?: string; // admin filter
  }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.search) qs.set("search", params.search);
    if (params.category && params.category !== "ALL") qs.set("category", params.category);
    if (params.kind && params.kind !== "ALL") qs.set("kind", params.kind);
    if (params.scope) qs.set("scope", params.scope);
    if (params.barangayCode) qs.set("barangayCode", params.barangayCode);
    return request<FileLibraryResponse>(`/api/files?${qs.toString()}`);
  },
  fileUpload: (payload: { file: File; category: string; title?: string; description?: string }) => {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("category", payload.category);
    if (payload.title) form.append("title", payload.title);
    if (payload.description) form.append("description", payload.description);
    return request<{ ok: boolean; file: FileLibraryItem }>("/api/files", { method: "POST", body: form });
  },
  fileDelete: (id: string) =>
    request<{ ok: boolean }>(`/api/files?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
  fileDownloadUrl: (id: string) => `/api/files/download?id=${encodeURIComponent(id)}`,

  // ---- public ----
  verify: (docId: string) =>
    request<{
      valid: boolean;
      error?: string;
      docId?: string;
      document?: string;
      barangay?: string;
      year?: number;
      version?: number;
      status?: string;
      signed?: boolean;
      signedBy?: string;
      signedAt?: string | null;
      approvedAt?: string | null;
      generatedAt?: string;
      downloadCount?: number;
    }>(`/api/verify?docId=${encodeURIComponent(docId)}`),
};

// Label helper for fields (used across barangay + admin UI)
export function fieldLabel(field: { labelEn: string; labelTl: string }, lang: string | null | undefined): string {
  return lang === "TL" ? field.labelTl : field.labelEn;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}
