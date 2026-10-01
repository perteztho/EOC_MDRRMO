// QAS33 — Database Management registry & generic CRUD service (SYSTEM_ADMIN only)
// Provides table metadata (labels, field types) plus safe, audit-logged CRUD
// used by /api/admin/database*. All operations go through the Prisma client.
import { db } from "@/lib/db";
import { logAudit } from "@/lib/qas33/audit";

export type DbFieldType = "string" | "number" | "boolean" | "datetime" | "json";

export interface DbFieldDef {
  name: string; // Prisma field name
  label: string; // UI label
  type: DbFieldType;
  required?: boolean; // required when creating a row
  nullable?: boolean; // accepts empty -> null
  readonly?: boolean; // id / createdAt / updatedAt (shown but not editable)
  fk?: string; // referenced table key for a nicer picker hint
  help?: string;
}

export interface DbTableDef {
  key: string; // URL key, e.g. "barangays"
  model: string; // Prisma delegate name, e.g. "barangay"
  label: string;
  group:
    | "People & Access"
    | "Barangay Data"
    | "Plans & Reviews"
    | "Documents"
    | "Evacuation Management"
    | "News & Broadcast"
    | "System";
  desc: string;
  idField: string; // "id" (or "key" for system_settings)
  orderBy: { field: string; dir: "asc" | "desc" };
  searchFields: string[];
  fields: DbFieldDef[];
}

const idField = (label = "ID"): DbFieldDef => ({ name: "id", label, type: "string", readonly: true, help: "Auto-generated (cuid)" });
const createdAtField: DbFieldDef = { name: "createdAt", label: "Created At", type: "datetime", readonly: true };
const updatedAtField: DbFieldDef = { name: "updatedAt", label: "Updated At", type: "datetime", readonly: true };

export const DB_TABLES: DbTableDef[] = [
  {
    key: "admin_users",
    model: "adminUser",
    label: "Admin Users",
    group: "People & Access",
    desc: "Console accounts — MDRRMO Officer, MDRRMO Staff and System Administrators.",
    idField: "id",
    orderBy: { field: "createdAt", dir: "asc" },
    searchFields: ["username", "name", "position", "role"],
    fields: [
      idField(),
      { name: "username", label: "Username", type: "string", required: true },
      { name: "passwordHash", label: "Password Hash", type: "string", required: true, help: "scrypt hash — normally managed via the Users module" },
      { name: "name", label: "Full Name", type: "string", required: true },
      { name: "position", label: "Position", type: "string", nullable: true },
      { name: "role", label: "Role", type: "string", required: true, help: "SYSTEM_ADMIN | MDRRMO_OFFICER | MDRRMO_STAFF" },
      { name: "active", label: "Active", type: "boolean" },
      { name: "lastLoginAt", label: "Last Login", type: "datetime", nullable: true },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "barangays",
    model: "barangay",
    label: "Barangays",
    group: "Barangay Data",
    desc: "The 33 barangays of Pio Duran with profile data.",
    idField: "id",
    orderBy: { field: "code", dir: "asc" },
    searchFields: ["code", "name", "captain"],
    fields: [
      idField(),
      { name: "code", label: "Code", type: "string", required: true, help: "e.g. PD-BRG-001" },
      { name: "name", label: "Barangay Name", type: "string", required: true },
      { name: "captain", label: "Punong Barangay", type: "string", nullable: true },
      { name: "population", label: "Population", type: "number", nullable: true },
      { name: "households", label: "Households", type: "number", nullable: true },
      { name: "puroks", label: "Puroks", type: "number", nullable: true },
      { name: "landArea", label: "Land Area (ha)", type: "number", nullable: true },
      { name: "vision", label: "Vision", type: "string", nullable: true },
      { name: "mission", label: "Mission", type: "string", nullable: true },
      { name: "goals", label: "Goals", type: "string", nullable: true },
      { name: "objectives", label: "Objectives", type: "string", nullable: true },
      { name: "logoUrl", label: "Seal / Logo URL", type: "string", nullable: true },
      { name: "active", label: "Active", type: "boolean" },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "barangay_frontpages",
    model: "barangayFrontpage",
    label: "Barangay Frontpages",
    group: "Barangay Data",
    desc: "Saved public frontpage content for each barangay website (/barangay/<slug>).",
    idField: "id",
    orderBy: { field: "updatedAt", dir: "desc" },
    searchFields: ["updatedBy"],
    fields: [
      idField(),
      { name: "barangayId", label: "Barangay", type: "string", required: true, fk: "barangays" },
      { name: "content", label: "Content JSON", type: "json", help: "Managed via the barangay portal Frontpage manager" },
      { name: "published", label: "Published", type: "boolean" },
      { name: "updatedBy", label: "Updated By", type: "string", nullable: true },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "frontpage_inquiries",
    model: "frontpageInquiry",
    label: "Frontpage Inquiries",
    group: "Barangay Data",
    desc: "Contact-form messages and service requests received through the barangay frontpages.",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["name", "contact", "service", "message"],
    fields: [
      idField(),
      { name: "barangayId", label: "Barangay", type: "string", required: true, fk: "barangays" },
      { name: "kind", label: "Kind", type: "string", required: true, help: "MESSAGE | SERVICE_REQUEST" },
      { name: "name", label: "Sender Name", type: "string", required: true },
      { name: "contact", label: "Contact", type: "string", nullable: true },
      { name: "service", label: "Service", type: "string", nullable: true },
      { name: "message", label: "Message", type: "string", required: true },
      { name: "status", label: "Status", type: "string", help: "NEW | DONE" },
      createdAtField,
    ],
  },
  {
    key: "barangay_officials",
    model: "barangayOfficial",
    label: "Barangay Officials",
    group: "Barangay Data",
    desc: "Sangguniang Barangay council members for each barangay.",
    idField: "id",
    orderBy: { field: "order", dir: "asc" },
    searchFields: ["name", "position", "committee"],
    fields: [
      idField(),
      { name: "barangayId", label: "Barangay", type: "string", required: true, fk: "barangays" },
      { name: "name", label: "Official Name", type: "string", required: true },
      { name: "position", label: "Position", type: "string", required: true, help: "PUNONG_BARANGAY | KAGAWAD | SK_CHAIRPERSON | SECRETARY | TREASURER" },
      { name: "committee", label: "Committee", type: "string", nullable: true },
      { name: "order", label: "Order", type: "number" },
      { name: "active", label: "Active", type: "boolean" },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "official_positions",
    model: "officialPosition",
    label: "Official Positions",
    group: "Barangay Data",
    desc: "Catalog of standard barangay official positions (LGC) with seats per barangay.",
    idField: "id",
    orderBy: { field: "order", dir: "asc" },
    searchFields: ["key", "title", "titleFil", "category"],
    fields: [
      idField(),
      { name: "key", label: "Key", type: "string", required: true, help: "PUNONG_BARANGAY | KAGAWAD | SK_CHAIRPERSON | SECRETARY | TREASURER" },
      { name: "title", label: "Title", type: "string", required: true },
      { name: "titleFil", label: "Title (Filipino)", type: "string", nullable: true },
      { name: "category", label: "Category", type: "string", help: "ELECTIVE | APPOINTIVE" },
      { name: "seats", label: "Seats per Barangay", type: "number" },
      { name: "order", label: "Order", type: "number" },
      { name: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    key: "puroks",
    model: "purok",
    label: "Puroks",
    group: "Barangay Data",
    desc: "Puroks (sub-barangay zones) of each barangay with zone leaders.",
    idField: "id",
    orderBy: { field: "code", dir: "asc" },
    searchFields: ["code", "name", "zoneLeader"],
    fields: [
      idField(),
      { name: "barangayId", label: "Barangay", type: "string", required: true, fk: "barangays" },
      { name: "code", label: "Code", type: "string", required: true, help: "e.g. PD-BRG-004-P01" },
      { name: "name", label: "Purok Name", type: "string", required: true },
      { name: "zoneLeader", label: "Zone Leader", type: "string", nullable: true },
      { name: "order", label: "Order", type: "number" },
      { name: "active", label: "Active", type: "boolean" },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "purok_demographics",
    model: "purokDemographic",
    label: "Purok Demographics",
    group: "Barangay Data",
    desc: "CBMS-style demographic baseline per purok (population, age brackets, vulnerable groups).",
    idField: "id",
    orderBy: { field: "id", dir: "asc" },
    searchFields: [],
    fields: [
      idField(),
      { name: "purokId", label: "Purok", type: "string", required: true, fk: "puroks" },
      { name: "households", label: "Households", type: "number" },
      { name: "families", label: "Families", type: "number" },
      { name: "population", label: "Population", type: "number" },
      { name: "male", label: "Male", type: "number" },
      { name: "female", label: "Female", type: "number" },
      { name: "age0to4", label: "Age 0-4", type: "number" },
      { name: "age5to11", label: "Age 5-11", type: "number" },
      { name: "age12to17", label: "Age 12-17", type: "number" },
      { name: "age18to59", label: "Age 18-59", type: "number" },
      { name: "age60plus", label: "Age 60+", type: "number" },
      { name: "pwd", label: "Persons with Disability", type: "number" },
      { name: "pregnant", label: "Pregnant / Lactating", type: "number" },
      { name: "soloParents", label: "Solo Parents", type: "number" },
      { name: "extendedFamilies", label: "Extended Families", type: "number" },
      { name: "seniorMale", label: "Senior Citizens (M)", type: "number" },
      { name: "seniorFemale", label: "Senior Citizens (F)", type: "number" },
      { name: "pwdMale", label: "PWD (M)", type: "number" },
      { name: "pwdFemale", label: "PWD (F)", type: "number" },
      { name: "soloParentMale", label: "Solo Parents (M)", type: "number" },
      { name: "soloParentFemale", label: "Solo Parents (F)", type: "number" },
      { name: "fourPs", label: "4Ps Households", type: "number", nullable: true },
      updatedAtField,
    ],
  },
  {
    key: "barangay_boundaries",
    model: "barangayBoundary",
    label: "Barangay Boundaries",
    group: "Barangay Data",
    desc: "Geographic profile per barangay — boundaries, center coordinates, elevation, area, classification.",
    idField: "id",
    orderBy: { field: "id", dir: "asc" },
    searchFields: ["north", "south", "east", "west", "adjacent"],
    fields: [
      idField(),
      { name: "barangayId", label: "Barangay", type: "string", required: true, fk: "barangays" },
      { name: "north", label: "North Boundary", type: "string", nullable: true },
      { name: "south", label: "South Boundary", type: "string", nullable: true },
      { name: "east", label: "East Boundary", type: "string", nullable: true },
      { name: "west", label: "West Boundary", type: "string", nullable: true },
      { name: "adjacent", label: "Adjacent Barangays", type: "string", nullable: true, help: "Comma-separated names" },
      { name: "latitude", label: "Latitude", type: "number", nullable: true },
      { name: "longitude", label: "Longitude", type: "number", nullable: true },
      { name: "elevationM", label: "Elevation (m)", type: "number", nullable: true },
      { name: "areaHa", label: "Land Area (ha)", type: "number", nullable: true },
      { name: "coastal", label: "Coastal", type: "boolean" },
      { name: "upland", label: "Upland", type: "boolean" },
      { name: "urban", label: "Urban (Poblacion)", type: "boolean" },
      { name: "polygonJson", label: "Bounding Polygon (JSON)", type: "json", nullable: true },
      updatedAtField,
    ],
  },
  {
    key: "barangay_reported_subtotals",
    model: "barangayReportedSubtotal",
    label: "Reported Subtotals",
    group: "Barangay Data",
    desc: "Barangay-reported aggregate figures per year (population, households, hazard-prone households, livelihood).",
    idField: "id",
    orderBy: { field: "year", dir: "desc" },
    searchFields: ["reportedBy"],
    fields: [
      idField(),
      { name: "barangayId", label: "Barangay", type: "string", required: true, fk: "barangays" },
      { name: "year", label: "Reporting Year", type: "number", required: true },
      { name: "population", label: "Population", type: "number" },
      { name: "households", label: "Households", type: "number" },
      { name: "families", label: "Families", type: "number" },
      { name: "purokCount", label: "Purok Count", type: "number" },
      { name: "landAreaHa", label: "Land Area (ha)", type: "number", nullable: true },
      { name: "male", label: "Male", type: "number" },
      { name: "female", label: "Female", type: "number" },
      { name: "seniorCount", label: "Senior Citizens", type: "number" },
      { name: "pwdCount", label: "Persons with Disability", type: "number" },
      { name: "pregnantCount", label: "Pregnant / Lactating", type: "number" },
      { name: "soloParentCount", label: "Solo Parents", type: "number" },
      { name: "floodProneHouseholds", label: "Flood-Prone Households", type: "number" },
      { name: "landslideProneHouseholds", label: "Landslide-Prone Households", type: "number" },
      { name: "stormSurgeProneHouseholds", label: "Storm-Surge-Prone Households", type: "number" },
      { name: "farmingHouseholds", label: "Farming Households", type: "number" },
      { name: "fishingHouseholds", label: "Fishing Households", type: "number" },
      { name: "evacuationCapacity", label: "Evacuation Capacity", type: "number" },
      { name: "reportedBy", label: "Reported By", type: "string", nullable: true },
      { name: "reportedAt", label: "Reported At", type: "datetime", nullable: true },
      updatedAtField,
    ],
  },
  {
    key: "barangay_credentials",
    model: "barangayCredential",
    label: "Barangay Credentials",
    group: "People & Access",
    desc: "Barangay login PINs (hashed), lockout and first-login state.",
    idField: "id",
    orderBy: { field: "createdAt", dir: "asc" },
    searchFields: ["tempPin", "lastLoginIp"],
    fields: [
      idField(),
      { name: "barangayId", label: "Barangay", type: "string", required: true, fk: "barangays" },
      { name: "pinHash", label: "PIN Hash", type: "string", required: true },
      { name: "tempPin", label: "Temp PIN", type: "string", nullable: true },
      { name: "mustChangePin", label: "Must Change PIN", type: "boolean" },
      { name: "active", label: "Active", type: "boolean" },
      { name: "failedAttempts", label: "Failed Attempts", type: "number" },
      { name: "lockedUntil", label: "Locked Until", type: "datetime", nullable: true },
      { name: "lastLoginAt", label: "Last Login", type: "datetime", nullable: true },
      { name: "lastLoginIp", label: "Last Login IP", type: "string", nullable: true },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "sessions",
    model: "session",
    label: "Sessions",
    group: "People & Access",
    desc: "Active login sessions. Deleting a row forces that user to sign in again.",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["token", "role", "ip", "userAgent"],
    fields: [
      idField(),
      { name: "token", label: "Token", type: "string", required: true },
      { name: "role", label: "Role", type: "string", required: true, help: "BARANGAY | ADMIN" },
      { name: "barangayId", label: "Barangay ID", type: "string", nullable: true, fk: "barangays" },
      { name: "adminId", label: "Admin ID", type: "string", nullable: true, fk: "admin_users" },
      { name: "ip", label: "IP", type: "string", nullable: true },
      { name: "userAgent", label: "User Agent", type: "string", nullable: true },
      { name: "expiresAt", label: "Expires At", type: "datetime", required: true },
      createdAtField,
    ],
  },
  {
    key: "template_sections",
    model: "templateSection",
    label: "Template Sections",
    group: "System",
    desc: "BDRRMP plan sections (References) shown to barangays in both languages.",
    idField: "id",
    orderBy: { field: "order", dir: "asc" },
    searchFields: ["key", "titleEn", "titleTl"],
    fields: [
      idField(),
      { name: "key", label: "Key", type: "string", required: true, help: "e.g. hazard_assessment" },
      { name: "order", label: "Order", type: "number", required: true },
      { name: "titleEn", label: "Title (EN)", type: "string", required: true },
      { name: "titleTl", label: "Title (TL)", type: "string", required: true },
      { name: "descEn", label: "Description (EN)", type: "string", nullable: true },
      { name: "descTl", label: "Description (TL)", type: "string", nullable: true },
      { name: "icon", label: "Icon", type: "string", nullable: true },
      { name: "requiresUpload", label: "Requires Upload", type: "boolean" },
      { name: "uploadLabelEn", label: "Upload Label (EN)", type: "string", nullable: true },
      { name: "uploadLabelTl", label: "Upload Label (TL)", type: "string", nullable: true },
      { name: "uploadFormats", label: "Upload Formats", type: "string" },
      { name: "uploadMaxMB", label: "Upload Max (MB)", type: "number" },
      { name: "required", label: "Required", type: "boolean" },
      { name: "active", label: "Active", type: "boolean" },
      { name: "fieldsJson", label: "Fields (JSON)", type: "json" },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "submissions",
    model: "submission",
    label: "Submissions",
    group: "Plans & Reviews",
    desc: "One BDRRMP submission per barangay per year with its status.",
    idField: "id",
    orderBy: { field: "updatedAt", dir: "desc" },
    searchFields: ["status", "valuesJson"],
    fields: [
      idField(),
      { name: "barangayId", label: "Barangay", type: "string", required: true, fk: "barangays" },
      { name: "year", label: "Year", type: "number", required: true },
      { name: "status", label: "Status", type: "string" },
      { name: "templateLang", label: "Template Language", type: "string", nullable: true, help: "EN | TL" },
      { name: "valuesJson", label: "Form Values (JSON)", type: "json" },
      { name: "progress", label: "Progress", type: "number" },
      { name: "version", label: "Version", type: "number" },
      { name: "submittedAt", label: "Submitted At", type: "datetime", nullable: true },
      { name: "resubmittedAt", label: "Resubmitted At", type: "datetime", nullable: true },
      { name: "underReviewAt", label: "Under Review At", type: "datetime", nullable: true },
      { name: "approvedAt", label: "Approved At", type: "datetime", nullable: true },
      { name: "finalizedAt", label: "Finalized At", type: "datetime", nullable: true },
      { name: "downloadedAt", label: "Downloaded At", type: "datetime", nullable: true },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "submission_versions",
    model: "submissionVersion",
    label: "Submission Versions",
    group: "Plans & Reviews",
    desc: "Immutable snapshots of every submitted version (v1, v2, …).",
    idField: "id",
    orderBy: { field: "submittedAt", dir: "desc" },
    searchFields: ["note"],
    fields: [
      idField(),
      { name: "submissionId", label: "Submission", type: "string", required: true, fk: "submissions" },
      { name: "version", label: "Version", type: "number", required: true },
      { name: "valuesJson", label: "Values (JSON)", type: "json", required: true },
      { name: "filesJson", label: "Files (JSON)", type: "json" },
      { name: "note", label: "Note", type: "string", nullable: true },
      { name: "submittedAt", label: "Submitted At", type: "datetime" },
    ],
  },
  {
    key: "plan_builders",
    model: "planBuilder",
    label: "Plan Builders",
    group: "Plans & Reviews",
    desc: "In-portal plan builder definitions (BDRRM Plan Builder v5, BDP Plan Builder v2).",
    idField: "id",
    orderBy: { field: "order", dir: "asc" },
    searchFields: ["code", "titleEn", "titleTl"],
    fields: [
      idField(),
      { name: "code", label: "Code", type: "string", required: true, help: "BDRRM_PLAN | BDP_PLAN" },
      { name: "version", label: "Version", type: "number", required: true },
      { name: "titleEn", label: "Title (EN)", type: "string", required: true },
      { name: "titleTl", label: "Title (TL)", type: "string", required: true },
      { name: "subtitleEn", label: "Subtitle (EN)", type: "string", nullable: true },
      { name: "subtitleTl", label: "Subtitle (TL)", type: "string", nullable: true },
      { name: "descriptionEn", label: "Description (EN)", type: "string", nullable: true },
      { name: "descriptionTl", label: "Description (TL)", type: "string", nullable: true },
      { name: "icon", label: "Icon", type: "string", nullable: true, help: "lucide icon name" },
      { name: "color", label: "Accent Color", type: "string", help: "emerald | amber" },
      { name: "docPrefix", label: "Doc Prefix", type: "string", help: "e.g. QAS33-BDRRM" },
      { name: "order", label: "Order", type: "number" },
      { name: "active", label: "Active", type: "boolean" },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "plan_builder_sections",
    model: "planBuilderSection",
    label: "Plan Builder Sections",
    group: "Plans & Reviews",
    desc: "Sections and form-field definitions (JSON) of each plan builder.",
    idField: "id",
    orderBy: { field: "order", dir: "asc" },
    searchFields: ["code", "titleEn", "groupEn"],
    fields: [
      idField(),
      { name: "builderId", label: "Plan Builder", type: "string", required: true, fk: "plan_builders" },
      { name: "code", label: "Section Code", type: "string", required: true, help: "e.g. bdrrm_s1_profile" },
      { name: "order", label: "Order", type: "number", required: true },
      { name: "groupEn", label: "Group (EN)", type: "string", nullable: true },
      { name: "groupTl", label: "Group (TL)", type: "string", nullable: true },
      { name: "titleEn", label: "Title (EN)", type: "string", required: true },
      { name: "titleTl", label: "Title (TL)", type: "string", required: true },
      { name: "descEn", label: "Description (EN)", type: "string", nullable: true },
      { name: "descTl", label: "Description (TL)", type: "string", nullable: true },
      { name: "icon", label: "Icon", type: "string", nullable: true },
      { name: "required", label: "Required", type: "boolean" },
      { name: "fieldsJson", label: "Fields (JSON)", type: "json" },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "barangay_plans",
    model: "barangayPlan",
    label: "Barangay Plans",
    group: "Plans & Reviews",
    desc: "Each barangay's saved plan documents per builder & plan year (autosaved values).",
    idField: "id",
    orderBy: { field: "updatedAt", dir: "desc" },
    searchFields: ["builderCode", "status", "valuesJson"],
    fields: [
      idField(),
      { name: "barangayId", label: "Barangay", type: "string", required: true, fk: "barangays" },
      { name: "builderCode", label: "Plan Builder", type: "string", required: true, fk: "plan_builders", help: "BDRRM_PLAN | BDP_PLAN" },
      { name: "year", label: "Plan Year", type: "number", required: true },
      { name: "status", label: "Status", type: "string", help: "NOT_STARTED | DRAFT | COMPLETED" },
      { name: "valuesJson", label: "Plan Values (JSON)", type: "json" },
      { name: "progress", label: "Progress", type: "number" },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "submission_files",
    model: "submissionFile",
    label: "Submission Files",
    group: "Documents",
    desc: "Uploaded supporting documents per submission section.",
    idField: "id",
    orderBy: { field: "uploadedAt", dir: "desc" },
    searchFields: ["filename", "sectionKey", "mimeType", "uploadedBy"],
    fields: [
      idField(),
      { name: "submissionId", label: "Submission", type: "string", required: true, fk: "submissions" },
      { name: "sectionKey", label: "Section Key", type: "string", required: true },
      { name: "filename", label: "Filename", type: "string", required: true },
      { name: "storageKey", label: "Storage Key", type: "string", required: true },
      { name: "mimeType", label: "MIME Type", type: "string", required: true },
      { name: "size", label: "Size (bytes)", type: "number", required: true },
      { name: "version", label: "Version", type: "number" },
      { name: "status", label: "Status", type: "string" },
      { name: "uploadedBy", label: "Uploaded By", type: "string", required: true },
      { name: "uploadedAt", label: "Uploaded At", type: "datetime" },
    ],
  },
  {
    key: "stored_files",
    model: "storedFile",
    label: "File Library",
    group: "Documents",
    desc: "Documents & images uploaded by any user (barangays and console users) via the File Library.",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["originalName", "title", "ownerName", "category", "mimeType"],
    fields: [
      idField(),
      { name: "ownerType", label: "Owner Type", type: "string", required: true, help: "BARANGAY | ADMIN" },
      { name: "barangayId", label: "Barangay", type: "string", nullable: true, fk: "barangays", help: "Set when a barangay uploaded the file" },
      { name: "adminId", label: "Console User", type: "string", nullable: true, fk: "admin_users", help: "Set when a console user uploaded the file" },
      { name: "ownerName", label: "Owner Name", type: "string", required: true },
      { name: "category", label: "Category", type: "string", required: true },
      { name: "title", label: "Title", type: "string", nullable: true },
      { name: "description", label: "Description", type: "string", nullable: true },
      { name: "originalName", label: "Original Filename", type: "string", required: true },
      { name: "storageKey", label: "Storage Key", type: "string", required: true },
      { name: "mimeType", label: "MIME Type", type: "string", required: true },
      { name: "kind", label: "Kind", type: "string", required: true, help: "IMAGE | DOCUMENT" },
      { name: "size", label: "Size (bytes)", type: "number", required: true },
      { name: "downloads", label: "Downloads", type: "number" },
      createdAtField,
    ],
  },
  {
    key: "reviews",
    model: "review",
    label: "Reviews",
    group: "Plans & Reviews",
    desc: "Review actions (started / commented / revision requested / approved).",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["reviewerName", "action", "overallComment"],
    fields: [
      idField(),
      { name: "submissionId", label: "Submission", type: "string", required: true, fk: "submissions" },
      { name: "version", label: "Version", type: "number", required: true },
      { name: "reviewerId", label: "Reviewer ID", type: "string", required: true, fk: "admin_users" },
      { name: "reviewerName", label: "Reviewer", type: "string", required: true },
      { name: "action", label: "Action", type: "string", required: true },
      { name: "overallComment", label: "Overall Comment", type: "string", nullable: true },
      createdAtField,
    ],
  },
  {
    key: "review_comments",
    model: "reviewComment",
    label: "Review Comments",
    group: "Plans & Reviews",
    desc: "Section-level review comments attached to a review.",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["sectionKey", "comment"],
    fields: [
      idField(),
      { name: "reviewId", label: "Review", type: "string", required: true, fk: "reviews" },
      { name: "sectionKey", label: "Section Key", type: "string", required: true },
      { name: "comment", label: "Comment", type: "string", required: true },
      { name: "requiresRevision", label: "Requires Revision", type: "boolean" },
      createdAtField,
    ],
  },
  {
    key: "rating_criteria",
    model: "ratingCriterion",
    label: "Rating Criteria",
    group: "System",
    desc: "Configurable evaluation criteria and their maximum scores.",
    idField: "id",
    orderBy: { field: "order", dir: "asc" },
    searchFields: ["key", "name"],
    fields: [
      idField(),
      { name: "key", label: "Key", type: "string", required: true },
      { name: "name", label: "Name", type: "string", required: true },
      { name: "maxScore", label: "Max Score", type: "number", required: true },
      { name: "order", label: "Order", type: "number", required: true },
      { name: "active", label: "Active", type: "boolean" },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "ratings",
    model: "rating",
    label: "Ratings",
    group: "Plans & Reviews",
    desc: "Evaluation scores given to submissions.",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["scoresJson", "remarks", "ratedByName"],
    fields: [
      idField(),
      { name: "submissionId", label: "Submission", type: "string", required: true, fk: "submissions" },
      { name: "scoresJson", label: "Scores (JSON)", type: "json", required: true },
      { name: "total", label: "Total", type: "number", required: true },
      { name: "remarks", label: "Remarks", type: "string", nullable: true },
      { name: "ratedBy", label: "Rated By (ID)", type: "string", required: true, fk: "admin_users" },
      { name: "ratedByName", label: "Rated By", type: "string", nullable: true },
      createdAtField,
    ],
  },
  {
    key: "generated_documents",
    model: "generatedDocument",
    label: "Generated Documents",
    group: "Documents",
    desc: "Final signed BDRRMP PDFs with document IDs.",
    idField: "id",
    orderBy: { field: "generatedAt", dir: "desc" },
    searchFields: ["docId", "signedBy", "fileKey"],
    fields: [
      idField(),
      { name: "submissionId", label: "Submission", type: "string", required: true, fk: "submissions" },
      { name: "docId", label: "Document ID", type: "string", required: true },
      { name: "version", label: "Version", type: "number", required: true },
      { name: "fileKey", label: "File Key", type: "string", required: true },
      { name: "lang", label: "Language", type: "string" },
      { name: "signed", label: "Signed", type: "boolean" },
      { name: "signedBy", label: "Signed By", type: "string", nullable: true },
      { name: "signedAt", label: "Signed At", type: "datetime", nullable: true },
      { name: "signatureHash", label: "Signature Hash", type: "string", nullable: true },
      { name: "generatedAt", label: "Generated At", type: "datetime" },
    ],
  },
  {
    key: "download_logs",
    model: "downloadLog",
    label: "Download Logs",
    group: "Documents",
    desc: "Who downloaded which final document and when.",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["downloadedBy", "ip"],
    fields: [
      idField(),
      { name: "documentId", label: "Document", type: "string", required: true, fk: "generated_documents" },
      { name: "downloadedBy", label: "Downloaded By", type: "string", required: true },
      { name: "ip", label: "IP", type: "string", nullable: true },
      createdAtField,
    ],
  },
  {
    key: "notifications",
    model: "notification",
    label: "Notifications",
    group: "System",
    desc: "In-app notifications for barangays and the MDRRMO.",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["title", "body", "type"],
    fields: [
      idField(),
      { name: "barangayId", label: "Barangay", type: "string", nullable: true, fk: "barangays" },
      { name: "audience", label: "Audience", type: "string", required: true, help: "BARANGAY | ADMIN" },
      { name: "type", label: "Type", type: "string", required: true },
      { name: "title", label: "Title", type: "string", required: true },
      { name: "body", label: "Body", type: "string", nullable: true },
      { name: "link", label: "Link", type: "string", nullable: true },
      { name: "read", label: "Read", type: "boolean" },
      createdAtField,
    ],
  },
  {
    key: "audit_logs",
    model: "auditLog",
    label: "Audit Logs",
    group: "System",
    desc: "Full audit trail of every action in the system.",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["actorName", "action", "detail", "ip"],
    fields: [
      idField(),
      { name: "actorType", label: "Actor Type", type: "string", required: true },
      { name: "actorName", label: "Actor", type: "string", required: true },
      { name: "action", label: "Action", type: "string", required: true },
      { name: "detail", label: "Detail", type: "string", nullable: true },
      { name: "barangayId", label: "Barangay", type: "string", nullable: true, fk: "barangays" },
      { name: "ip", label: "IP", type: "string", nullable: true },
      createdAtField,
    ],
  },
  {
    key: "tutorials",
    model: "tutorial",
    label: "Tutorials",
    group: "System",
    desc: "Help guides shown inside the barangay portal (EN + TL).",
    idField: "id",
    orderBy: { field: "order", dir: "asc" },
    searchFields: ["key", "titleEn", "titleTl"],
    fields: [
      idField(),
      { name: "key", label: "Key", type: "string", required: true },
      { name: "titleEn", label: "Title (EN)", type: "string", required: true },
      { name: "titleTl", label: "Title (TL)", type: "string", required: true },
      { name: "bodyEn", label: "Body (EN)", type: "string", required: true },
      { name: "bodyTl", label: "Body (TL)", type: "string", required: true },
      { name: "order", label: "Order", type: "number", required: true },
      { name: "active", label: "Active", type: "boolean" },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "system_settings",
    model: "systemSetting",
    label: "System Settings",
    group: "System",
    desc: "Key–value application settings (JSON-encoded values).",
    idField: "key",
    orderBy: { field: "key", dir: "asc" },
    searchFields: ["key", "value"],
    fields: [
      { name: "key", label: "Key", type: "string", required: true },
      { name: "value", label: "Value (JSON)", type: "json", required: true },
    ],
  },

  // ------------------------------------------------------------------------
  // Emergency modules — Evacuation Management
  // ------------------------------------------------------------------------
  {
    key: "evacuation_centers",
    model: "evacuationCenter",
    label: "Evacuation Centers",
    group: "Evacuation Management",
    desc: "Directory of evacuation centers with capacity, occupancy breakdown, facilities and status.",
    idField: "id",
    orderBy: { field: "code", dir: "asc" },
    searchFields: ["code", "name", "barangay", "contactPerson", "contactNumber"],
    fields: [
      idField(),
      { name: "code", label: "Code", type: "string", nullable: true, help: "e.g. PD-EVC-001" },
      { name: "name", label: "Center Name", type: "string", required: true },
      { name: "barangay", label: "Barangay", type: "string", required: true },
      { name: "barangayId", label: "Barangay ID", type: "string", nullable: true, fk: "barangays" },
      { name: "address", label: "Address / Landmark", type: "string", nullable: true },
      { name: "latitude", label: "Latitude", type: "number", nullable: true, help: "5 to 20 (Philippines)" },
      { name: "longitude", label: "Longitude", type: "number", nullable: true, help: "115 to 130 (Philippines)" },
      { name: "contactPerson", label: "Contact Person", type: "string", nullable: true },
      { name: "contactNumber", label: "Contact Number", type: "string", nullable: true },
      { name: "facilityType", label: "Facility Type", type: "string", help: "SCHOOL | BARANGAY_HALL | MUNICIPAL_EVAC_CENTER | MULTI_PURPOSE_HALL | MUNICIPAL_BUILDING | RHU | GYMNASIUM | COVERED_COURT | CHURCH | CHURCH_SCHOOL | EVAC_SITE | OTHER" },
      { name: "capacity", label: "Capacity (individuals)", type: "number" },
      { name: "capacityFamilies", label: "Capacity (families)", type: "number", nullable: true },
      { name: "landAreaSqm", label: "Land Area (sqm)", type: "number", nullable: true },
      { name: "currentOccupants", label: "Current Occupants", type: "number" },
      { name: "maleOccupants", label: "Male", type: "number" },
      { name: "femaleOccupants", label: "Female", type: "number" },
      { name: "childrenOccupants", label: "Children", type: "number" },
      { name: "seniorOccupants", label: "Seniors", type: "number" },
      { name: "pwdOccupants", label: "PWD", type: "number" },
      { name: "pregnantOccupants", label: "Pregnant", type: "number" },
      { name: "otherVulnerable", label: "Other Vulnerable", type: "number" },
      { name: "accessibleFacilities", label: "Accessible Facilities", type: "string", nullable: true },
      { name: "waterStatus", label: "Water Status", type: "string", help: "AVAILABLE | LIMITED | UNAVAILABLE" },
      { name: "electricityStatus", label: "Electricity Status", type: "string", help: "AVAILABLE | GENERATOR_ONLY | UNAVAILABLE" },
      { name: "washStatus", label: "WASH / Toilets", type: "string", help: "AVAILABLE | LIMITED | UNAVAILABLE" },
      { name: "medicalAssistance", label: "Medical Assistance", type: "boolean" },
      { name: "foodRelief", label: "Food Relief", type: "boolean" },
      { name: "sleepingArea", label: "Sleeping Area", type: "boolean" },
      { name: "generator", label: "Generator", type: "boolean" },
      { name: "vehicleAccess", label: "Vehicle Access", type: "boolean" },
      { name: "petsAllowed", label: "Pets Allowed", type: "boolean" },
      { name: "status", label: "Status", type: "string", help: "OPEN | NEAR_CAPACITY | FULL | CLOSED | PREPARING" },
      { name: "statusOverride", label: "Status Override", type: "boolean" },
      { name: "specialNotes", label: "Special Notes", type: "string", nullable: true },
      { name: "notes", label: "Notes (legacy)", type: "string", nullable: true },
      { name: "lastUpdatedBy", label: "Last Updated By", type: "string", nullable: true },
      { name: "displayOrder", label: "Display Order", type: "number" },
      { name: "visible", label: "Visible", type: "boolean" },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "evacuation_occupancy_logs",
    model: "evacuationOccupancyLog",
    label: "Occupancy Logs",
    group: "Evacuation Management",
    desc: "Occupancy snapshots written on every evacuation center update.",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["note", "recordedByName"],
    fields: [
      idField(),
      { name: "centerId", label: "Evacuation Center", type: "string", required: true, fk: "evacuation_centers" },
      { name: "occupants", label: "Occupants", type: "number", required: true },
      { name: "male", label: "Male", type: "number" },
      { name: "female", label: "Female", type: "number" },
      { name: "children", label: "Children", type: "number" },
      { name: "seniors", label: "Seniors", type: "number" },
      { name: "pwd", label: "PWD", type: "number" },
      { name: "pregnant", label: "Pregnant", type: "number" },
      { name: "otherVulnerable", label: "Other Vulnerable", type: "number" },
      { name: "note", label: "Note", type: "string", nullable: true },
      { name: "recordedBy", label: "Recorded By (ID)", type: "string", required: true },
      { name: "recordedByName", label: "Recorded By", type: "string", nullable: true },
      createdAtField,
    ],
  },
  {
    key: "evacuation_status_history",
    model: "evacuationStatusHistory",
    label: "Status History",
    group: "Evacuation Management",
    desc: "Status transitions per center, including auto-computed changes and manual overrides.",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["previousStatus", "newStatus", "reason", "changedByName"],
    fields: [
      idField(),
      { name: "centerId", label: "Evacuation Center", type: "string", required: true, fk: "evacuation_centers" },
      { name: "previousStatus", label: "Previous Status", type: "string", nullable: true },
      { name: "newStatus", label: "New Status", type: "string", required: true },
      { name: "reason", label: "Reason", type: "string", nullable: true },
      { name: "overridden", label: "Manual Override", type: "boolean" },
      { name: "changedBy", label: "Changed By (ID)", type: "string", required: true },
      { name: "changedByName", label: "Changed By", type: "string", nullable: true },
      createdAtField,
    ],
  },
  {
    key: "evacuation_announcements",
    model: "evacuationAnnouncement",
    label: "Evacuation Announcements",
    group: "Evacuation Management",
    desc: "Announcements shown on the public evacuation pages and center cards.",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["title", "message", "createdByName"],
    fields: [
      idField(),
      { name: "title", label: "Title", type: "string", required: true },
      { name: "message", label: "Message", type: "string", required: true },
      { name: "priority", label: "Priority", type: "string", help: "NORMAL | HIGH | URGENT | CRITICAL" },
      { name: "targetBarangays", label: "Target Barangays", type: "string", nullable: true, help: "Comma-separated (blank = all)" },
      { name: "targetCenterIds", label: "Target Center IDs", type: "json", nullable: true, help: "JSON array of center ids" },
      { name: "status", label: "Status", type: "string", help: "DRAFT | SCHEDULED | PUBLISHED | EXPIRED | CANCELLED" },
      { name: "publishAt", label: "Publish At", type: "datetime" },
      { name: "expiresAt", label: "Expires At", type: "datetime", nullable: true },
      { name: "pushSent", label: "Push Sent", type: "boolean" },
      { name: "showOnWebsite", label: "Show on Website", type: "boolean" },
      { name: "createdBy", label: "Created By (ID)", type: "string", required: true },
      { name: "createdByName", label: "Created By", type: "string", nullable: true },
      createdAtField,
      updatedAtField,
    ],
  },

  // ------------------------------------------------------------------------
  // Emergency modules — News & Broadcast
  // ------------------------------------------------------------------------
  {
    key: "news_categories",
    model: "newsCategory",
    label: "News Categories",
    group: "News & Broadcast",
    desc: "Admin-managed news category catalog (keys mirror NewsArticle.category).",
    idField: "id",
    orderBy: { field: "displayOrder", dir: "asc" },
    searchFields: ["key", "name", "description"],
    fields: [
      idField(),
      { name: "key", label: "Key", type: "string", required: true, help: "e.g. WEATHER_UPDATE (unique, uppercase)" },
      { name: "name", label: "Name", type: "string", required: true },
      { name: "description", label: "Description", type: "string", nullable: true },
      { name: "color", label: "Accent Color", type: "string", help: "accent token, e.g. red / gov-blue" },
      { name: "emergency", label: "Emergency Content", type: "boolean" },
      { name: "displayOrder", label: "Display Order", type: "number" },
      { name: "active", label: "Active", type: "boolean" },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "broadcasts",
    model: "broadcast",
    label: "Broadcasts",
    group: "News & Broadcast",
    desc: "One message fanned out to many channels (website, banner, ticker, news, push, evacuation, dashboard).",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["title", "message", "sentByName"],
    fields: [
      idField(),
      { name: "title", label: "Title", type: "string", required: true },
      { name: "message", label: "Message", type: "string", required: true },
      { name: "priority", label: "Priority", type: "string", help: "NORMAL | IMPORTANT | URGENT | CRITICAL" },
      { name: "channelsJson", label: "Channels", type: "json", help: "JSON array: WEBSITE, HOME_BANNER, TICKER, NEWS, PUSH, EVAC_CENTER, DASHBOARD" },
      { name: "targetAudience", label: "Target Audience", type: "string", help: "ALL | RESIDENTS | BARANGAY_OFFICIALS" },
      { name: "targetBarangaysJson", label: "Target Barangays", type: "json", help: "JSON array of barangay names" },
      { name: "targetCenterIdsJson", label: "Target Center IDs", type: "json", help: "JSON array of center ids" },
      { name: "status", label: "Status", type: "string", help: "DRAFT | SCHEDULED | SENT | CANCELLED | FAILED" },
      { name: "scheduledAt", label: "Scheduled At", type: "datetime", nullable: true },
      { name: "expiresAt", label: "Expires At", type: "datetime", nullable: true },
      { name: "sentAt", label: "Sent At", type: "datetime", nullable: true },
      { name: "sentById", label: "Sent By (ID)", type: "string", nullable: true },
      { name: "sentByName", label: "Sent By", type: "string", nullable: true },
      { name: "statsJson", label: "Channel Outcomes", type: "json", nullable: true },
      createdAtField,
      updatedAtField,
    ],
  },
  {
    key: "broadcast_targets",
    model: "broadcastTarget",
    label: "Broadcast Targets",
    group: "News & Broadcast",
    desc: "Explicit target records (barangays / evacuation centers / ALL) per broadcast.",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["targetType", "targetRef", "targetName"],
    fields: [
      idField(),
      { name: "broadcastId", label: "Broadcast", type: "string", required: true, fk: "broadcasts" },
      { name: "targetType", label: "Target Type", type: "string", required: true, help: "ALL | BARANGAY | EVAC_CENTER" },
      { name: "targetRef", label: "Target Ref", type: "string", required: true },
      { name: "targetName", label: "Target Name", type: "string", nullable: true },
      createdAtField,
    ],
  },
  {
    key: "notification_subscriptions",
    model: "notificationSubscription",
    label: "Push Subscriptions",
    group: "News & Broadcast",
    desc: "Web-push device subscriptions (service-worker based, VAPID).",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["endpoint", "audience", "barangay"],
    fields: [
      idField(),
      { name: "endpoint", label: "Endpoint", type: "string", required: true, help: "https:// push service URL (unique)" },
      { name: "p256dh", label: "Key (p256dh)", type: "string", required: true },
      { name: "auth", label: "Auth Secret", type: "string", required: true },
      { name: "audience", label: "Audience", type: "string", help: "PUBLIC | BARANGAY | ADMIN" },
      { name: "barangay", label: "Barangay", type: "string", nullable: true },
      { name: "userAgent", label: "User Agent", type: "string", nullable: true },
      { name: "active", label: "Active", type: "boolean" },
      createdAtField,
      { name: "lastSeenAt", label: "Last Seen", type: "datetime" },
    ],
  },
  {
    key: "notification_delivery_logs",
    model: "notificationDeliveryLog",
    label: "Delivery Logs",
    group: "News & Broadcast",
    desc: "Delivery record for every broadcast/notification attempt (per channel).",
    idField: "id",
    orderBy: { field: "createdAt", dir: "desc" },
    searchFields: ["channel", "target", "sentByName", "error"],
    fields: [
      idField(),
      { name: "broadcastId", label: "Broadcast", type: "string", nullable: true, fk: "broadcasts" },
      { name: "channel", label: "Channel", type: "string", required: true, help: "PUSH | WEBSITE | HOME_BANNER | TICKER | NEWS | EVAC_CENTER | DASHBOARD" },
      { name: "target", label: "Target", type: "string" },
      { name: "priority", label: "Priority", type: "string" },
      { name: "status", label: "Status", type: "string", help: "SENT | SCHEDULED | FAILED | CANCELLED" },
      { name: "deviceCount", label: "Device Count", type: "number" },
      { name: "deliveredCount", label: "Delivered", type: "number" },
      { name: "openedCount", label: "Opened", type: "number" },
      { name: "error", label: "Error", type: "string", nullable: true },
      { name: "sentBy", label: "Sent By (ID)", type: "string", nullable: true },
      { name: "sentByName", label: "Sent By", type: "string", nullable: true },
      createdAtField,
    ],
  },
];

export function getTableDef(key: string): DbTableDef | undefined {
  return DB_TABLES.find((t) => t.key === key);
}

// Minimal structural type so we can address Prisma models dynamically
// without pulling the full Prisma client types into this module.
interface DynamicModel {
  count: (args?: any) => Promise<number>;
  findMany: (args?: any) => Promise<any[]>;
  findUnique: (args: any) => Promise<any | null>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
}

function getModel(def: DbTableDef): DynamicModel {
  const models = db as unknown as Record<string, DynamicModel>;
  const model = models[def.model];
  if (!model) throw new Error(`Unknown Prisma model: ${def.model}`);
  return model;
}

export interface TableSummary {
  key: string;
  label: string;
  group: string;
  desc: string;
  count: number;
  fields: DbFieldDef[];
  idField: string;
  orderBy: { field: string; dir: "asc" | "desc" };
  searchFields: string[];
}

export async function listTables(): Promise<TableSummary[]> {
  const out: TableSummary[] = [];
  for (const def of DB_TABLES) {
    const count = await getModel(def).count().catch(() => 0);
    out.push({
      key: def.key,
      label: def.label,
      group: def.group,
      desc: def.desc,
      count,
      fields: def.fields,
      idField: def.idField,
      orderBy: def.orderBy,
      searchFields: def.searchFields,
    });
  }
  return out;
}

function buildSearchWhere(def: DbTableDef, search: string) {
  if (!search) return undefined;
  return { OR: def.searchFields.map((f) => ({ [f]: { contains: search } })) };
}

export async function listRows(
  tableKey: string,
  opts: { page: number; pageSize: number; search: string }
): Promise<{ rows: Record<string, unknown>[]; total: number; page: number; pageSize: number }> {
  const def = getTableDef(tableKey);
  if (!def) throw new Error("Unknown table");
  const model = getModel(def);
  const page = Math.max(1, opts.page);
  const pageSize = Math.min(100, Math.max(5, opts.pageSize));
  const where = buildSearchWhere(def, opts.search);
  const [rows, total] = await Promise.all([
    model.findMany({
      where,
      orderBy: { [def.orderBy.field]: def.orderBy.dir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    model.count({ where }),
  ]);
  return { rows: rows as Record<string, unknown>[], total, page, pageSize };
}

// Coerce and validate a raw payload against the table's field definitions.
// Returns { data } ready for Prisma, or throws with a readable message.
export function coerceRowData(
  def: DbTableDef,
  body: Record<string, unknown>,
  mode: "create" | "update"
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of def.fields) {
    const present = Object.prototype.hasOwnProperty.call(body, field.name);
    if (mode === "create") {
      if (field.readonly) continue; // auto-generated
      if (!present) {
        if (field.required) throw new Error(`Field "${field.label}" is required.`);
        continue; // optional fields fall back to Prisma defaults
      }
    } else {
      if (!present || field.readonly) continue;
    }
    const raw = body[field.name];
    if (raw === null || raw === "" || raw === undefined) {
      if (field.type === "boolean") {
        data[field.name] = false;
        continue;
      }
      if (field.nullable) {
        data[field.name] = null;
        continue;
      }
      if (mode === "update") continue; // skip clearing non-nullable fields
      throw new Error(`Field "${field.label}" cannot be empty.`);
    }
    switch (field.type) {
      case "number": {
        const n = Number(raw);
        if (!Number.isFinite(n)) throw new Error(`Field "${field.label}" must be a number.`);
        data[field.name] = n;
        break;
      }
      case "boolean":
        data[field.name] = raw === true || raw === "true" || raw === 1 || raw === "1";
        break;
      case "datetime": {
        const d = new Date(String(raw));
        if (isNaN(d.getTime())) throw new Error(`Field "${field.label}" must be a valid date/time.`);
        data[field.name] = d;
        break;
      }
      case "json": {
        try {
          const parsed = JSON.parse(String(raw));
          data[field.name] = JSON.stringify(parsed);
        } catch {
          throw new Error(`Field "${field.label}" must contain valid JSON.`);
        }
        break;
      }
      default:
        data[field.name] = String(raw);
    }
  }
  if (Object.keys(data).length === 0) throw new Error("Nothing to save — no editable fields were provided.");
  return data;
}

export async function createRow(
  tableKey: string,
  body: Record<string, unknown>,
  actor: { name: string; ip?: string }
): Promise<Record<string, unknown>> {
  const def = getTableDef(tableKey);
  if (!def) throw new Error("Unknown table");
  const data = coerceRowData(def, body, "create");
  try {
    const row = (await getModel(def).create({ data })) as Record<string, unknown>;
    await logAudit({
      actorType: "ADMIN",
      actorName: actor.name,
      action: "DB_CREATE",
      detail: `Created row in ${def.label} (${def.idField}=${String(row[def.idField])}) via Database Management`,
      ip: actor.ip,
    });
    return row;
  } catch (e) {
    throw new Error(friendlyDbError(e, def.label, "create"));
  }
}

export async function updateRow(
  tableKey: string,
  id: string,
  body: Record<string, unknown>,
  actor: { name: string; ip?: string }
): Promise<Record<string, unknown>> {
  const def = getTableDef(tableKey);
  if (!def) throw new Error("Unknown table");
  const model = getModel(def);
  const existing = await model.findUnique({ where: { [def.idField]: id } });
  if (!existing) throw new Error("Row not found.");
  const data = coerceRowData(def, body, "update");
  try {
    const row = (await model.update({ where: { [def.idField]: id }, data })) as Record<string, unknown>;
    await logAudit({
      actorType: "ADMIN",
      actorName: actor.name,
      action: "DB_UPDATE",
      detail: `Updated row in ${def.label} (${def.idField}=${id}) via Database Management`,
      ip: actor.ip,
    });
    return row;
  } catch (e) {
    throw new Error(friendlyDbError(e, def.label, "update"));
  }
}

export async function deleteRow(
  tableKey: string,
  id: string,
  actor: { id: string; name: string; ip?: string }
): Promise<void> {
  const def = getTableDef(tableKey);
  if (!def) throw new Error("Unknown table");
  const model = getModel(def);
  const existing = await model.findUnique({ where: { [def.idField]: id } });
  if (!existing) throw new Error("Row not found.");

  // Guardrails for the admin_users table
  if (def.key === "admin_users") {
    const row = existing as unknown as { id: string; username: string; role: string; active: boolean };
    if (row.id === actor.id) throw new Error("You cannot delete your own account.");
    if (row.username === "sysadmin") throw new Error("The default System Administrator account (sysadmin) cannot be deleted.");
    if (row.role === "SYSTEM_ADMIN") {
      const admins = await db.adminUser.findMany({ where: { role: "SYSTEM_ADMIN", active: true } });
      if (admins.length <= 1) throw new Error("Cannot delete the last active System Administrator account.");
    }
  }

  try {
    await model.delete({ where: { [def.idField]: id } });
    await logAudit({
      actorType: "ADMIN",
      actorName: actor.name,
      action: "DB_DELETE",
      detail: `Deleted row from ${def.label} (${def.idField}=${id}) via Database Management`,
      ip: actor.ip,
    });
  } catch (e) {
    throw new Error(friendlyDbError(e, def.label, "delete"));
  }
}

function friendlyDbError(e: unknown, label: string, verb: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("UNIQUE constraint failed")) {
    return `A row with the same unique value already exists in ${label}.`;
  }
  if (msg.includes("FOREIGN KEY constraint failed")) {
    return `Cannot ${verb} this ${label} row — other records reference it.`;
  }
  if (msg.includes("Required value missing")) {
    return `A required field is missing for ${label}.`;
  }
  return `Could not ${verb} the ${label} row: ${msg.slice(0, 200)}`;
}
