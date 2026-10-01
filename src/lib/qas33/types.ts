// QAS33 shared types (safe for client & server)

export type Role = "BARANGAY" | "ADMIN";

// ---- Console (admin) roles ----
// SYSTEM_ADMIN   — the only role that can edit roles, configure all settings and CRUD the database
// MDRRMO_OFFICER — reviews and approves the BDRRMP (signs/finalizes)
// MDRRMO_STAFF   — assists the review process (comments, revision requests, evaluations)
export type AdminRole = "SYSTEM_ADMIN" | "MDRRMO_OFFICER" | "MDRRMO_STAFF";

export const ADMIN_ROLE_META: Record<AdminRole, { label: string; short: string; badge: string; description: string }> = {
  SYSTEM_ADMIN: {
    label: "System Administrator",
    short: "SysAdmin",
    badge: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
    description: "Manages user roles, configures all settings and has full database access.",
  },
  MDRRMO_OFFICER: {
    label: "MDRRMO Officer",
    short: "Officer",
    badge: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    description: "Reviews and approves BDRRMP submissions — signs the final document.",
  },
  MDRRMO_STAFF: {
    label: "MDRRMO Staff",
    short: "Staff",
    badge: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    description: "Assists the review process — comments, revision requests and evaluations.",
  },
};

export function normalizeAdminRole(role: string | null | undefined): AdminRole {
  if (role === "SYSTEM_ADMIN") return "SYSTEM_ADMIN";
  if (role === "MDRRMO_STAFF") return "MDRRMO_STAFF";
  return "MDRRMO_OFFICER"; // includes legacy MDRRMO_ADMIN
}

export function isSystemAdmin(role: string | null | undefined): boolean {
  return normalizeAdminRole(role) === "SYSTEM_ADMIN";
}

export function canReviewBdrrmp(role: string | null | undefined): boolean {
  const r = normalizeAdminRole(role);
  return r === "MDRRMO_OFFICER" || r === "MDRRMO_STAFF";
}

export function canApproveBdrrmp(role: string | null | undefined): boolean {
  return normalizeAdminRole(role) === "MDRRMO_OFFICER";
}

export interface SessionInfo {
  role: Role;
  barangay?: {
    id: string;
    code: string;
    name: string;
    captain?: string | null;
  };
  admin?: {
    id: string;
    username?: string;
    name: string;
    position?: string | null;
    role: string;
  };
  mustChangePin?: boolean;
  expiresAt: string;
}

export type SubmissionStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "READY_FOR_SUBMISSION"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "NEEDS_REVISION"
  | "RESUBMITTED"
  | "APPROVED"
  | "FINALIZING"
  | "READY_FOR_DOWNLOAD"
  | "DOWNLOADED"
  | "ARCHIVED";

export const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "NOT_STARTED",
  "DRAFT",
  "READY_FOR_SUBMISSION",
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_REVISION",
  "RESUBMITTED",
  "APPROVED",
  "FINALIZING",
  "READY_FOR_DOWNLOAD",
  "DOWNLOADED",
  "ARCHIVED",
];

export const PRE_SUBMISSION_STATUSES: SubmissionStatus[] = [
  "NOT_STARTED",
  "DRAFT",
  "READY_FOR_SUBMISSION",
];

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "radio"
  | "checkbox";

export interface TemplateFieldDef {
  key: string;
  type: FieldType;
  labelEn: string;
  labelTl: string;
  required: boolean;
  options?: string[]; // for select/radio/checkbox
  helpEn?: string;
  helpTl?: string;
  unit?: string; // e.g. "PHP", "hectares"
  placeholder?: string;
  width?: "full" | "half";
}

export interface SectionDef {
  key: string;
  order: number;
  titleEn: string;
  titleTl: string;
  descEn?: string | null;
  descTl?: string | null;
  icon: string;
  requiresUpload: boolean;
  uploadLabelEn?: string | null;
  uploadLabelTl?: string | null;
  uploadFormats?: string;
  uploadMaxMB?: number;
  required: boolean;
  fields: TemplateFieldDef[];
}

// Section as delivered to the client
export interface ClientSection {
  key: string;
  order: number;
  title: string;
  desc?: string | null;
  icon: string;
  requiresUpload: boolean;
  uploadLabel?: string | null;
  uploadFormats: string[];
  uploadMaxMB: number;
  required: boolean;
  fields: TemplateFieldDef[];
  uploadStatus?: "MISSING" | "PENDING" | "APPROVED" | "NEEDS_REVISION";
  complete?: boolean;
}

export interface FileMeta {
  id: string;
  sectionKey: string;
  filename: string;
  mimeType: string;
  size: number;
  version: number;
  status: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface ValidationIssue {
  sectionKey: string;
  sectionTitle: string;
  reason: string;
}

export interface ValidationResult {
  ready: boolean;
  issues: ValidationIssue[];
  completedSections: number;
  totalSections: number;
}

export interface CommentItem {
  id: string;
  sectionKey: string;
  comment: string;
  requiresRevision: boolean;
  createdAt: string;
  reviewerName: string;
  reviewAction: string;
  version: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export interface VersionItem {
  version: number;
  submittedAt: string;
  note?: string | null;
  reviewerName?: string;
  outcome?: string;
}

export interface DocumentInfo {
  docId: string;
  version: number;
  lang: string;
  signed: boolean;
  signedBy?: string | null;
  signedAt?: string | null;
  generatedAt: string;
  downloadCount: number;
}

export interface OfficialItem {
  id: string;
  name: string;
  position: string;
  committee?: string | null;
}

// ---- Plan Builders (BDRRM Plan Builder v5 & BDP Plan Builder v2) ----

export type PlanFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "table";

/** Column definition for table-type plan fields (PPAs, evacuation centers, …). */
export interface PlanTableColumn {
  key: string;
  labelEn: string;
  labelTl: string;
  type: "text" | "number" | "select";
  options?: string[]; // for select columns
  placeholder?: string;
  width?: string; // Tailwind width hint e.g. "w-44"
}

export interface PlanFieldDef {
  key: string;
  type: PlanFieldType;
  labelEn: string;
  labelTl: string;
  required: boolean;
  options?: string[]; // for select/radio/checkbox
  helpEn?: string;
  helpTl?: string;
  unit?: string;
  placeholder?: string;
  width?: "full" | "half" | "third";
  columns?: PlanTableColumn[]; // for type = "table"
  minRows?: number; // pre-seeded empty rows for type = "table"
}

export type PlanStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "COMPLETED"
  | "SUBMITTED"
  | "APPROVED"
  | "PROVINCE_APPROVED"
  | "RETURNED";

export const PLAN_STATUS_META: Record<PlanStatus, { label: string; labelTl: string; badge: string; dot: string }> = {
  NOT_STARTED: {
    label: "Not started",
    labelTl: "Hindi pa nasisimulan",
    badge: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-400",
  },
  DRAFT: {
    label: "Draft — in progress",
    labelTl: "Draft — isinasagawa",
    badge: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  COMPLETED: {
    label: "Completed",
    labelTl: "Nakumpleto",
    badge: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  SUBMITTED: {
    label: "Submitted for Approval",
    labelTl: "Naisumite para sa Pag-apruba",
    badge: "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  APPROVED: {
    label: "Approved",
    labelTl: "Aprubado",
    badge: "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  RETURNED: {
    label: "Returned for Revision",
    labelTl: "Ibininalik para Ayusin",
    badge: "border-orange-400 bg-orange-50 text-orange-800 dark:border-orange-600 dark:bg-orange-950/40 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  PROVINCE_APPROVED: {
    label: "Approved — Provincial DRRM Officer",
    labelTl: "Aprubado — Provincial DRRM Officer",
    badge: "border-teal-500 bg-teal-50 text-teal-800 dark:border-teal-600 dark:bg-teal-950/40 dark:text-teal-300",
    dot: "bg-teal-500",
  },
};

export interface PlanSectionClient {
  code: string;
  order: number;
  group?: string | null;
  title: string;
  desc?: string | null;
  icon?: string | null;
  required: boolean;
  fields: PlanFieldDef[];
}

export interface PlanBuilderCard {
  code: string;
  version: number;
  title: string;
  titleTl: string;
  subtitle?: string | null;
  description?: string | null;
  icon: string;
  color: string;
  docPrefix: string;
  sectionCount: number;
  plan: {
    year: number;
    status: PlanStatus;
    progress: number;
    updatedAt: string | null;
    submittedAt?: string | null;
    docRef?: string | null;
  } | null;
}

/** MDRRMO approval workflow info attached to a plan detail response. */
export interface PlanReviewInfo {
  submittedAt: string | null;
  submittedByName: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  docRef: string | null;
  provincialApprovedBy: string | null;
  provincialApprovedAt: string | null;
  provincialNote: string | null;
  lastExportAt: string | null;
  lastExportFormat: string | null;
}

export interface PlanDetailResponse {
  builder: PlanBuilderCard;
  year: number;
  barangay: { code: string; name: string; captain?: string | null };
  sections: PlanSectionClient[];
  values: Record<string, unknown>;
  progress: number;
  status: PlanStatus;
  updatedAt: string | null;
  review: PlanReviewInfo;
}

// ---- File Library (documents & images uploaded by ANY user) ----

export type FileCategory =
  | "General"
  | "Photo / Documentation"
  | "Report"
  | "Correspondence"
  | "Supporting Document";

export const FILE_CATEGORIES: FileCategory[] = [
  "General",
  "Photo / Documentation",
  "Report",
  "Correspondence",
  "Supporting Document",
];

export const DEFAULT_UPLOAD_FORMATS =
  "pdf,jpg,jpeg,png,gif,webp,doc,docx,xls,xlsx,csv,txt,ppt,pptx";

export interface FileLibraryItem {
  id: string;
  ownerType: "BARANGAY" | "ADMIN";
  ownerName: string;
  barangay: { code: string; name: string } | null;
  category: string;
  title: string | null;
  description: string | null;
  originalName: string;
  mimeType: string;
  kind: "IMAGE" | "DOCUMENT";
  size: number;
  downloads: number;
  createdAt: string;
  canDelete: boolean;
}

export interface FileLibraryStats {
  total: number;
  images: number;
  documents: number;
  storageBytes: number;
}

export interface FileLibraryResponse {
  files: FileLibraryItem[];
  total: number;
  page: number;
  pageSize: number;
  stats: FileLibraryStats;
  uploadConfig: { maxMB: number; formats: string };
}

export const OFFICIAL_POSITION_META: Record<string, { label: string; order: number }> = {
  PUNONG_BARANGAY: { label: "Punong Barangay", order: 1 },
  KAGAWAD: { label: "Kagawad", order: 2 },
  SK_CHAIRPERSON: { label: "SK Chairperson", order: 3 },
  SECRETARY: { label: "Barangay Secretary", order: 4 },
  TREASURER: { label: "Barangay Treasurer", order: 5 },
};

export interface BarangayOverview {
  barangay: {
    id: string;
    code: string;
    name: string;
    captain?: string | null;
    population?: number | null;
    households?: number | null;
  };
  officials: OfficialItem[];
  submission: {
    id: string;
    year: number;
    status: SubmissionStatus;
    templateLang: string | null;
    progress: number;
    version: number;
    submittedAt: string | null;
    approvedAt: string | null;
    downloadedAt: string | null;
    updatedAt: string;
  };
  counts: {
    completedSections: number;
    totalSections: number;
    filesUploaded: number;
    requiredFilesUploaded: number;
    unreadNotifications: number;
    openRevisionComments: number;
  };
  requirements: Array<{
    sectionKey: string;
    title: string;
    required: boolean;
    requiresUpload: boolean;
    formComplete: boolean;
    uploadComplete: boolean;
    uploadStatus: "MISSING" | "PENDING" | "APPROVED" | "NEEDS_REVISION";
    fileCount: number;
  }>;
  latestComments: CommentItem[];
  document: DocumentInfo | null;
}

export interface BarangaySubmissionData {
  submission: {
    id: string;
    year: number;
    status: SubmissionStatus;
    templateLang: string | null;
    progress: number;
    version: number;
    values: Record<string, unknown>;
  };
  sections: ClientSection[];
  files: FileMeta[];
  validation: ValidationResult;
}

export interface AdminBarangayRow {
  id: string;
  code: string;
  name: string;
  captain?: string | null;
  active: boolean;
  officials: OfficialItem[];
  credential: {
    active: boolean;
    mustChangePin: boolean;
    tempPinPending: boolean; // a temporary PIN is still pending → printable without regenerating
    lockedUntil: string | null;
    lastLoginAt: string | null;
  } | null;
  submission: {
    id: string;
    status: SubmissionStatus;
    progress: number;
    version: number;
    templateLang: string | null;
    updatedAt: string;
    submittedAt: string | null;
  } | null;
}

export interface AdminSubmissionRow {
  id: string;
  barangay: { id: string; code: string; name: string };
  year: number;
  status: SubmissionStatus;
  progress: number;
  version: number;
  templateLang: string | null;
  updatedAt: string;
  submittedAt: string | null;
  lastRating: { total: number; maxTotal: number; createdAt: string } | null;
}

export interface AdminSubmissionDetail {
  submission: {
    id: string;
    year: number;
    status: SubmissionStatus;
    templateLang: string | null;
    progress: number;
    version: number;
    values: Record<string, unknown>;
    submittedAt: string | null;
    approvedAt: string | null;
  };
  barangay: { id: string; code: string; name: string; captain?: string | null };
  sections: ClientSection[];
  files: FileMeta[];
  validation: ValidationResult;
  comments: CommentItem[];
  reviews: Array<{
    id: string;
    action: string;
    reviewerName: string;
    overallComment?: string | null;
    createdAt: string;
    version: number;
  }>;
  rating: {
    scores: Array<{ key: string; name: string; score: number; maxScore: number }>;
    total: number;
    maxTotal: number;
    remarks?: string | null;
    ratedByName?: string | null;
    createdAt: string;
  } | null;
  criteria: Array<{ key: string; name: string; maxScore: number }>;
  document: DocumentInfo | null;
}

export interface AuditEntry {
  id: string;
  actorType: string;
  actorName: string;
  action: string;
  detail?: string | null;
  barangay?: string | null;
  ip?: string | null;
  createdAt: string;
}

export interface AdminOverviewStats {
  total: number;
  active: number;
  counts: Record<string, number>;
  completionRate: number;
  submittedThisMonth: number;
  avgProgress: number;
  pendingReviews: number;
  documentsGenerated: number;
  totalDownloads: number;
  avgRating: number | null;
  /** Configured maximum evaluation score (sum of active rating criteria). */
  ratingMaxTotal: number;
}

export interface SettingValues {
  planYear: number;
  signatoryName: string;
  signatoryPosition: string;
  municipality: string;
  province: string;
  region: string;
  motto: string;
  uploadMaxMB: number;
  uploadFormats: string;
}

export interface TutorialItem {
  key: string;
  title: string;
  body: string;
}

export const STATUS_META: Record<
  SubmissionStatus,
  { label: string; labelTl: string; badge: string; dot: string; group: string }
> = {
  NOT_STARTED: {
    label: "Not Started",
    labelTl: "Hindi Pa Nagsisimula",
    badge: "bg-slate-100 text-slate-700 border border-slate-300",
    dot: "bg-slate-400",
    group: "pre",
  },
  DRAFT: {
    label: "Draft",
    labelTl: "Burador",
    badge: "bg-stone-100 text-stone-700 border border-stone-300",
    dot: "bg-stone-400",
    group: "pre",
  },
  READY_FOR_SUBMISSION: {
    label: "Ready for Submission",
    labelTl: "Handa nang Isumite",
    badge: "bg-cyan-50 text-cyan-800 border border-cyan-300",
    dot: "bg-cyan-500",
    group: "pre",
  },
  SUBMITTED: {
    label: "Submitted",
    labelTl: "Naisumite na",
    badge: "bg-teal-50 text-teal-800 border border-teal-300",
    dot: "bg-teal-500",
    group: "queue",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    labelTl: "Sinusuri",
    badge: "bg-amber-50 text-amber-800 border border-amber-300",
    dot: "bg-amber-500",
    group: "queue",
  },
  NEEDS_REVISION: {
    label: "Needs Revision",
    labelTl: "Kailangang Baguhin",
    badge: "bg-orange-50 text-orange-800 border border-orange-300",
    dot: "bg-orange-500",
    group: "queue",
  },
  RESUBMITTED: {
    label: "Resubmitted",
    labelTl: "Muling Naisumite",
    badge: "bg-lime-50 text-lime-800 border border-lime-300",
    dot: "bg-lime-600",
    group: "queue",
  },
  APPROVED: {
    label: "Approved",
    labelTl: "Aprubado",
    badge: "bg-emerald-50 text-emerald-800 border border-emerald-300",
    dot: "bg-emerald-600",
    group: "done",
  },
  FINALIZING: {
    label: "Finalizing",
    labelTl: "Inihahanda",
    badge: "bg-violet-50 text-violet-800 border border-violet-300",
    dot: "bg-violet-500",
    group: "done",
  },
  READY_FOR_DOWNLOAD: {
    label: "Ready for Download",
    labelTl: "Maaari nang I-download",
    badge: "bg-green-100 text-green-900 border border-green-400",
    dot: "bg-green-600",
    group: "done",
  },
  DOWNLOADED: {
    label: "Downloaded",
    labelTl: "Nai-download na",
    badge: "bg-emerald-100 text-emerald-900 border border-emerald-400",
    dot: "bg-emerald-700",
    group: "done",
  },
  ARCHIVED: {
    label: "Archived",
    labelTl: "Naka-arsibo",
    badge: "bg-zinc-100 text-zinc-700 border border-zinc-300",
    dot: "bg-zinc-500",
    group: "done",
  },
};

// ---- Printable barangay account credentials ----
// One sheet per barangay — the official handout MDRRMO prints & gives to the
// barangay so they can sign in to their own dashboard (code + temporary PIN).
export interface CredentialSheet {
  code: string; // PD-BRG-001
  name: string; // Barangay name
  captain: string | null; // Punong Barangay
  tempPin: string; // QAS33-XXXXXX — temporary PIN pending first sign-in
  accountActive: boolean;
  pinActive: boolean;
  issuedAt: string; // ISO
  issuedBy: { name: string; position: string }; // console user who printed
}

export interface CredentialsPrintResponse {
  sheets: CredentialSheet[];
  generated: number; // new PINs issued for this print run
  reused: number; // pending temporary PINs reused as-is
}
