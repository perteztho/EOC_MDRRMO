// QAS33 Emergency Communication contract — shared by admin UI, public portal,
// and API routes for the Evacuation Management + News & Broadcast modules.
// Pure types + display metadata only (safe to import from client components).

// ===========================================================================
// EVACUATION
// ===========================================================================

export type EvacCenterStatus = "OPEN" | "NEAR_CAPACITY" | "FULL" | "CLOSED" | "PREPARING";
export type EvacCapacityLevel = "AVAILABLE" | "NEAR_CAPACITY" | "CRITICAL" | "FULL" | "UNKNOWN";
export type WaterElectricStatus = "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
export type ElectricityStatus = "AVAILABLE" | "GENERATOR_ONLY" | "UNAVAILABLE";

export const EVAC_STATUS_META: Record<
  EvacCenterStatus,
  { label: string; badge: string; dot: string; bar: string }
> = {
  OPEN: {
    label: "Open",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
  },
  NEAR_CAPACITY: {
    label: "Near Capacity",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
  },
  FULL: {
    label: "Full",
    badge: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    bar: "bg-red-500",
  },
  CLOSED: {
    label: "Closed",
    badge: "bg-slate-100 text-slate-600 border-slate-300",
    dot: "bg-slate-400",
    bar: "bg-slate-400",
  },
  PREPARING: {
    label: "Preparing",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
  },
};

export const EVAC_CAPACITY_META: Record<EvacCapacityLevel, { label: string; bar: string; text: string }> = {
  AVAILABLE: { label: "Available", bar: "bg-emerald-500", text: "text-emerald-600" },
  NEAR_CAPACITY: { label: "Near Capacity", bar: "bg-amber-500", text: "text-amber-600" },
  CRITICAL: { label: "Critical", bar: "bg-orange-500", text: "text-orange-600" },
  FULL: { label: "Full", bar: "bg-red-500", text: "text-red-600" },
  UNKNOWN: { label: "—", bar: "bg-slate-300", text: "text-slate-400" },
};

export const FACILITY_TYPES: Array<{ value: string; label: string }> = [
  { value: "SCHOOL", label: "School" },
  { value: "BARANGAY_HALL", label: "Barangay Hall" },
  { value: "MUNICIPAL_EVAC_CENTER", label: "Municipal Evacuation Center" },
  { value: "MULTI_PURPOSE_HALL", label: "Multi-Purpose Hall" },
  { value: "MUNICIPAL_BUILDING", label: "Municipal Building" },
  { value: "RHU", label: "Rural Health Unit (RHU)" },
  { value: "GYMNASIUM", label: "Gymnasium" },
  { value: "COVERED_COURT", label: "Covered Court" },
  { value: "CHURCH", label: "Church / Chapel" },
  { value: "CHURCH_SCHOOL", label: "Church / School Building" },
  { value: "EVAC_SITE", label: "Designated Evacuation Site" },
  { value: "OTHER", label: "Other" },
];

export interface EvacCenterDTO {
  id: string;
  code: string | null;
  name: string;
  barangay: string;
  barangayId: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  contactPerson: string | null;
  contactNumber: string | null;
  facilityType: string;
  capacity: number; // rated capacity in individuals (persons)
  capacityFamilies: number | null; // rated capacity in families, when encoded
  landAreaSqm: number | null; // land area in square meters, when encoded
  currentOccupants: number;
  availableSlots: number; // max(0, capacity - currentOccupants)
  occupancyPct: number; // 0 when capacity 0
  maleOccupants: number;
  femaleOccupants: number;
  childrenOccupants: number;
  seniorOccupants: number;
  pwdOccupants: number;
  pregnantOccupants: number;
  otherVulnerable: number;
  vulnerableTotal: number;
  accessibleFacilities: string | null;
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
  capacityLevel: EvacCapacityLevel;
  statusOverride: boolean;
  specialNotes: string | null;
  notes: string | null;
  lastUpdatedBy: string | null;
  lastUpdated: string; // ISO
  visible: boolean;
  displayOrder: number;
}

export interface EvacDashboardStats {
  totalCenters: number;
  openCenters: number;
  nearCapacityCenters: number;
  fullCenters: number;
  closedCenters: number;
  preparingCenters: number;
  totalCapacity: number;
  totalFamilies: number; // sum of rated family capacity (where encoded)
  currentEvacuees: number;
  availableSpaces: number;
  occupancyPct: number;
  byBarangay: Array<{ barangay: string; centers: number; capacity: number; occupants: number }>;
  vulnerable: { children: number; seniors: number; pwd: number; pregnant: number; other: number; total: number };
  updatedToday: number;
}

export interface OccupancyLogDTO {
  id: string;
  centerId: string;
  centerName: string;
  occupants: number;
  male: number;
  female: number;
  children: number;
  seniors: number;
  pwd: number;
  pregnant: number;
  otherVulnerable: number;
  note: string | null;
  recordedByName: string | null;
  createdAt: string;
}

export interface StatusHistoryDTO {
  id: string;
  centerId: string;
  centerName: string;
  previousStatus: string | null;
  newStatus: string;
  reason: string | null;
  overridden: boolean;
  changedByName: string | null;
  createdAt: string;
}

export type EvacAnnouncementPriority = "NORMAL" | "HIGH" | "URGENT" | "CRITICAL";

export interface EvacAnnouncementDTO {
  id: string;
  title: string;
  message: string;
  priority: EvacAnnouncementPriority;
  targetBarangays: string[];
  targetCenterIds: string[];
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "EXPIRED" | "CANCELLED";
  publishAt: string;
  expiresAt: string | null;
  pushSent: boolean;
  showOnWebsite: boolean;
  createdByName: string | null;
  createdAt: string;
}

/** Payload for creating/updating an evacuation center (admin). */
export interface EvacCenterInput {
  name: string;
  barangay: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contactPerson?: string | null;
  contactNumber?: string | null;
  facilityType?: string;
  capacity?: number;
  capacityFamilies?: number | null;
  landAreaSqm?: number | null;
  status?: EvacCenterStatus;
  specialNotes?: string | null;
  accessibleFacilities?: string | null;
  waterStatus?: string;
  electricityStatus?: string;
  washStatus?: string;
  medicalAssistance?: boolean;
  foodRelief?: boolean;
  sleepingArea?: boolean;
  generator?: boolean;
  vehicleAccess?: boolean;
  petsAllowed?: boolean;
  visible?: boolean;
  displayOrder?: number;
}

// ===========================================================================
// NEWS & PUBLIC UPDATES
// ===========================================================================

export const NEWS_CATEGORY_SEEDS: Array<{ key: string; name: string; emergency: boolean; order: number }> = [
  { key: "EMERGENCY_ALERT", name: "Emergency Alert", emergency: true, order: 1 },
  { key: "PUBLIC_ADVISORY", name: "Public Advisory", emergency: false, order: 2 },
  { key: "WEATHER_UPDATE", name: "Weather Update", emergency: false, order: 3 },
  { key: "EVACUATION_UPDATE", name: "Evacuation Update", emergency: true, order: 4 },
  { key: "DISASTER_PREPAREDNESS", name: "Disaster Preparedness", emergency: false, order: 5 },
  { key: "MDRRMO_NEWS", name: "MDRRMO News", emergency: false, order: 6 },
  { key: "COMMUNITY_ACTIVITIES", name: "Community Activities", emergency: false, order: 7 },
  { key: "TRAINING_DRILLS", name: "Training & Drills", emergency: false, order: 8 },
  { key: "RELIEF_OPERATIONS", name: "Relief Operations", emergency: false, order: 9 },
  { key: "GOVERNMENT_ANNOUNCEMENT", name: "Government Announcement", emergency: false, order: 10 },
  { key: "GENERAL_INFO", name: "General Information", emergency: false, order: 11 },
];

export interface NewsCategoryDTO {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  emergency: boolean;
  displayOrder: number;
  active: boolean;
}

export interface NewsAttachment {
  title: string;
  url: string;
  size?: number;
}
export interface NewsExternalLink {
  label: string;
  url: string;
}

export type NewsPostStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export interface NewsPostDTO {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  excerpt: string; // summary or plain-text content prefix (≤ 220 chars)
  content: string;
  category: string; // category key
  categoryName: string;
  categoryEmergency: boolean;
  author: string | null;
  tags: string[];
  featuredImage: string | null;
  gallery: string[];
  attachments: NewsAttachment[];
  links: NewsExternalLink[];
  publishAt: string;
  expiresAt: string | null;
  targetAudience: string;
  targetBarangays: string[];
  pushEnabled: boolean;
  emergency: boolean;
  featured: boolean;
  pinned: boolean;
  status: NewsPostStatus;
  linkUrl: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewsPostInput {
  title: string;
  category: string;
  subtitle?: string | null;
  summary?: string | null;
  content: string;
  author?: string | null;
  tags?: string[];
  featuredImage?: string | null;
  gallery?: string[];
  attachments?: NewsAttachment[];
  links?: NewsExternalLink[];
  publishAt?: string | null;
  expiresAt?: string | null;
  targetAudience?: string;
  targetBarangays?: string[];
  pushEnabled?: boolean;
  emergency?: boolean;
  featured?: boolean;
  pinned?: boolean;
  status?: NewsPostStatus;
  linkUrl?: string | null;
}

// ===========================================================================
// BROADCAST CENTER
// ===========================================================================

export type BroadcastChannel =
  | "WEBSITE"
  | "HOME_BANNER"
  | "TICKER"
  | "NEWS"
  | "PUSH"
  | "EVAC_CENTER"
  | "DASHBOARD";

export const BROADCAST_CHANNELS: Array<{ key: BroadcastChannel; label: string; desc: string }> = [
  { key: "WEBSITE", label: "Website Announcement", desc: "Published announcement shown across the public portal" },
  { key: "HOME_BANNER", label: "Homepage Emergency Banner", desc: "Alert banner at the top of the homepage" },
  { key: "TICKER", label: "Broadcast Ticker", desc: "Scrolling ticker message under the header" },
  { key: "NEWS", label: "News & Public Updates", desc: "Full post in the News & Updates section" },
  { key: "PUSH", label: "Push Notification", desc: "Web push to subscribed devices" },
  { key: "EVAC_CENTER", label: "Evacuation Center Announcement", desc: "Shown on evacuation pages and center cards" },
  { key: "DASHBOARD", label: "Emergency Operation Dashboard Alert", desc: "Critical alert on the public dashboard" },
];

export type BroadcastPriority = "NORMAL" | "IMPORTANT" | "URGENT" | "CRITICAL";

export const BROADCAST_PRIORITY_META: Record<
  BroadcastPriority,
  { label: string; badge: string; ring: string }
> = {
  NORMAL: { label: "Normal", badge: "bg-slate-100 text-slate-700 border-slate-300", ring: "" },
  IMPORTANT: { label: "Important", badge: "bg-blue-50 text-blue-700 border-blue-200", ring: "" },
  URGENT: { label: "Urgent", badge: "bg-amber-50 text-amber-800 border-amber-300", ring: "ring-2 ring-amber-200" },
  CRITICAL: {
    label: "Critical",
    badge: "bg-red-50 text-red-700 border-red-300",
    ring: "ring-2 ring-red-200",
  },
};

export type BroadcastStatus = "DRAFT" | "SCHEDULED" | "SENT" | "CANCELLED" | "FAILED";

export interface BroadcastDTO {
  id: string;
  title: string;
  message: string;
  priority: BroadcastPriority;
  channels: BroadcastChannel[];
  targetAudience: string; // ALL | RESIDENTS | BARANGAY_OFFICIALS
  targetBarangays: string[];
  targetCenterIds: string[];
  targetCenterNames: string[];
  status: BroadcastStatus;
  scheduledAt: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  sentByName: string | null;
  stats: Record<string, { ok: boolean; detail?: string }>; // per-channel outcome
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryLogDTO {
  id: string;
  broadcastId: string | null;
  broadcastTitle: string | null;
  channel: string;
  target: string;
  priority: string;
  status: "SENT" | "SCHEDULED" | "FAILED" | "CANCELLED";
  deviceCount: number;
  deliveredCount: number;
  openedCount: number;
  error: string | null;
  sentByName: string | null;
  createdAt: string;
}

// ===========================================================================
// PUSH NOTIFICATIONS
// ===========================================================================

export interface PushStatusDTO {
  enabled: boolean; // master switch from communication settings
  configured: boolean; // VAPID keys present (env or settings)
  publicKey: string | null; // exposed ONLY when configured (public key is safe)
  subscriptions: number;
  provider: string; // "web-push (VAPID)" | "none"
}

// ===========================================================================
// COMMUNICATION SETTINGS (SystemConfig scope: "communication")
// ===========================================================================

export interface CommunicationSettings {
  defaultPriority: BroadcastPriority;
  pushEnabled: boolean;
  notificationIcon: string;
  bannerEnabled: boolean;
  bannerTitle: string;
  tickerEnabled: boolean;
  tickerSpeed: number; // seconds
  autoExpireHours: number; // announcements auto-expire after N hours (0 = never)
  evacNearCapacityThreshold: number; // default 70 (%)
  evacCriticalThreshold: number; // default 90 (%)
  publicEvacPageVisible: boolean;
  defaultPublishStatus: "DRAFT" | "PUBLISHED";
  typhoonPriorityBoost: boolean; // urgent+ content pinned on top during TYPHOON mode
  criticalConfirmRequired: boolean;
}

export const DEFAULT_COMMUNICATION_SETTINGS: CommunicationSettings = {
  defaultPriority: "NORMAL",
  pushEnabled: false,
  notificationIcon: "shield-alert",
  bannerEnabled: true,
  bannerTitle: "EMERGENCY ALERT",
  tickerEnabled: true,
  tickerSpeed: 45,
  autoExpireHours: 0,
  evacNearCapacityThreshold: 70,
  evacCriticalThreshold: 90,
  publicEvacPageVisible: true,
  defaultPublishStatus: "PUBLISHED",
  typhoonPriorityBoost: true,
  criticalConfirmRequired: true,
};

// ===========================================================================
// PUBLIC EVACUATION RESPONSE (no login)
// ===========================================================================

export interface PublicEvacResponse {
  ok: true;
  visible: boolean; // publicEvacPageVisible setting
  centers: EvacCenterDTO[];
  announcements: EvacAnnouncementDTO[]; // active, published, not expired
  stats: EvacDashboardStats;
  operationalMode: string; // NORMAL | TYPHOON
  generatedAt: string;
}

// ===========================================================================
// PLAN APPROVALS (BarangayPlan extension)
// ===========================================================================

export type PlanApprovalStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "COMPLETED"
  | "SUBMITTED"
  | "APPROVED"
  | "PROVINCE_APPROVED"
  | "RETURNED";

export interface AdminPlanRow {
  id: string;
  barangayCode: string;
  barangayName: string;
  builderCode: string;
  builderTitle: string;
  year: number;
  status: PlanApprovalStatus;
  progress: number;
  submittedAt: string | null;
  submittedByName: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  docRef: string | null;
  provincialApprovedBy: string | null;
  provincialApprovedAt: string | null;
  provincialNote: string | null;
  updatedAt: string;
}

export interface PlanAutofillResponse {
  ok: true;
  values: Record<string, unknown>; // sanitized against builder fields
  filledCount: number;
  sources: string[]; // human-readable source list, e.g. "PSA 2020 census population"
  generatedAt: string;
}

// ===========================================================================
// SHARED HELPERS
// ===========================================================================

/** Compute the capacity level band from occupancy percentage (thresholds configurable). */
export function capacityLevelFromPct(
  pct: number,
  capacity: number,
  nearThreshold = 70,
  criticalThreshold = 90
): EvacCapacityLevel {
  if (capacity <= 0) return "UNKNOWN";
  if (pct >= 100) return "FULL";
  if (pct >= criticalThreshold) return "CRITICAL";
  if (pct >= nearThreshold) return "NEAR_CAPACITY";
  return "AVAILABLE";
}

/** Auto-computed operational status from occupancy (used when no override). */
export function autoStatusFromPct(pct: number, capacity: number): EvacCenterStatus {
  if (capacity > 0 && pct >= 100) return "FULL";
  if (capacity > 0 && pct >= 70) return "NEAR_CAPACITY";
  return "OPEN";
}
