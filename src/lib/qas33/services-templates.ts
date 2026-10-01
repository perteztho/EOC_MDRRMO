// QAS33 e-Serbisyo — service document templates (certificates, permits, DRRM reports)
//
// Shared metadata + field definitions for the 6 barangay service document types.
// Pure module (no pdf-lib / no db) — used by BOTH the PDF generator
// (services-pdf.ts), the API routes (validation / sanitising) and the barangay
// portal UI (services-generator.tsx live preview), so the on-screen preview,
// the stored data and the printed PDF always tell the same story.

export type ServiceDocTypeKey =
  | "BRGY_CLEARANCE"
  | "BRGY_RESIDENCY"
  | "BRGY_INDIGENCY"
  | "BUSINESS_PERMIT"
  | "AARL"
  | "SPOT_REPORT";

export type ServiceDocCategory = "certificates" | "permits" | "drrm-reports";

export type ServiceFieldType = "text" | "textarea" | "select" | "date" | "number";

export interface ServiceFieldDef {
  key: string;
  label: string;
  type: ServiceFieldType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
  help?: string;
  /** Initial value for a brand-new document. */
  defaultValue?: string;
  /** Only render this field when another field equals a value (e.g. purpose === "Other"). */
  showIf?: { field: string; equals: string };
  /** Primary subject field — minimal validation for saving a draft. */
  primary?: boolean;
}

export type ServiceAccentColor = "emerald" | "teal" | "rose" | "amber" | "orange" | "red";

export interface ServiceDocTypeDef {
  key: ServiceDocTypeKey;
  /** Human label ("Barangay Clearance"). */
  label: string;
  /** Official printed document heading ("BARANGAY CLEARANCE"). */
  title: string;
  /** Control-number code (CLR). */
  short: string;
  /** lucide icon name — mapped in the UI (services-generator.tsx). */
  icon: string;
  color: ServiceAccentColor;
  description: string;
  category: ServiceDocCategory;
  fields: ServiceFieldDef[];
}

// ---------------------------------------------------------------------------
// Shared option lists
// ---------------------------------------------------------------------------

export const COMMON_PURPOSES = [
  "Employment",
  "School / Scholarship",
  "Medical Assistance",
  "Financial Assistance",
  "Business / Mayor's Permit",
  "Loan / GSIS / SSS",
  "Travel",
  "Legal / Court",
  "Local Transfer / Residency",
  "Other",
];

export const CIVIL_STATUS_OPTIONS = ["Single", "Married", "Widowed", "Separated", "Annulled"];
export const SEX_OPTIONS = ["Male", "Female"];
export const INCIDENT_TYPE_OPTIONS = [
  "Typhoon",
  "Flooding",
  "Landslide",
  "Earthquake",
  "Fire",
  "Storm Surge",
  "Drought",
  "El Niño",
  "Other",
];
export const NATURE_OF_BUSINESS_OPTIONS = [
  "Sari-sari Store",
  "Eatery / Carinderia",
  "Grocery",
  "Hardware",
  "Pharmacy",
  "Rice Retail",
  "Transport Services",
  "Construction Supply",
  "Agri Supply",
  "Barber / Salon",
  "Workshop / Welding",
  "Tailoring",
  "Other",
];
export const REASON_FOR_ASSISTANCE_OPTIONS = [
  "Medical",
  "Educational",
  "Burial / Funeral",
  "Livelihood",
  "Emergency Relief",
  "Other",
];
export const SPOT_STATUS_OPTIONS = ["Ongoing", "Controlled", "Resolved"];

// ---------------------------------------------------------------------------
// Field groups (re-used across templates)
// ---------------------------------------------------------------------------

const personFields: ServiceFieldDef[] = [
  { key: "fullName", label: "Full Name", type: "text", required: true, primary: true, placeholder: "Surname, First Name, Middle Name" },
  { key: "citizenship", label: "Citizenship", type: "text", defaultValue: "Filipino" },
  { key: "sex", label: "Sex", type: "select", options: SEX_OPTIONS, placeholder: "—" },
  { key: "birthdate", label: "Date of Birth", type: "date" },
  { key: "age", label: "Age", type: "number", placeholder: "auto from birthdate if blank" },
  { key: "civilStatus", label: "Civil Status", type: "select", options: CIVIL_STATUS_OPTIONS, placeholder: "—" },
  { key: "address", label: "House No. / Street", type: "text", required: true, placeholder: "House / lot / street" },
  { key: "purok", label: "Purok / Sitio", type: "text", placeholder: "e.g. Purok 3" },
];

const purposeField: ServiceFieldDef = {
  key: "purpose",
  label: "Purpose",
  type: "select",
  options: COMMON_PURPOSES,
  required: true,
  placeholder: "Select the purpose of this document",
};

const purposeOtherField: ServiceFieldDef = {
  key: "purposeOther",
  label: "Specify Other Purpose",
  type: "text",
  required: true,
  placeholder: "State the specific purpose",
  showIf: { field: "purpose", equals: "Other" },
};

const validityField = (defaultValue: string): ServiceFieldDef => ({
  key: "validity",
  label: "Validity",
  type: "text",
  defaultValue,
  help: "Printed on the certificate (e.g. six (6) months).",
});

function isoToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------------------------------------------------------------------------
// The 6 document types
// ---------------------------------------------------------------------------

export const SERVICE_DOC_TYPES: ServiceDocTypeDef[] = [
  {
    key: "BRGY_CLEARANCE",
    label: "Barangay Clearance",
    title: "BARANGAY CLEARANCE",
    short: "CLR",
    icon: "file-check",
    color: "emerald",
    description: "Certify that a resident has no pending case or derogatory record in the barangay.",
    category: "certificates",
    fields: [
      ...personFields,
      purposeField,
      purposeOtherField,
      { key: "ctcNo", label: "CTC No. (Community Tax Certificate)", type: "text", placeholder: "e.g. 12345678" },
      { key: "orNo", label: "O.R. No. (Official Receipt)", type: "text", placeholder: "e.g. 87654321" },
      { key: "orDate", label: "O.R. Date", type: "date" },
      { key: "fee", label: "Fee (₱)", type: "number", defaultValue: "50" },
      validityField("six (6) months"),
    ],
  },
  {
    key: "BRGY_RESIDENCY",
    label: "Certificate of Residency",
    title: "CERTIFICATE OF RESIDENCY",
    short: "RES",
    icon: "home",
    color: "teal",
    description: "Certify that a person is a bona fide resident of the barangay.",
    category: "certificates",
    fields: [
      ...personFields,
      { key: "residentSince", label: "Resident Since", type: "text", placeholder: "e.g. birth / 1998", help: "Since when the person has lived in the barangay." },
      purposeField,
      purposeOtherField,
      validityField("six (6) months"),
    ],
  },
  {
    key: "BRGY_INDIGENCY",
    label: "Certificate of Indigency",
    title: "CERTIFICATE OF INDIGENCY",
    short: "IND",
    icon: "heart-handshake",
    color: "rose",
    description: "Certify that a resident belongs to an indigent household for assistance programs.",
    category: "certificates",
    fields: [
      ...personFields,
      { key: "spouseName", label: "Name of Spouse", type: "text", placeholder: "Leave blank if not applicable" },
      { key: "householdNo", label: "No. of Household Members", type: "number", placeholder: "e.g. 5" },
      { key: "monthlyIncome", label: "Combined Monthly Income", type: "text", placeholder: "e.g. below ₱8,000" },
      {
        key: "reasonForAssistance",
        label: "Reason for Assistance",
        type: "select",
        options: REASON_FOR_ASSISTANCE_OPTIONS,
        required: true,
        placeholder: "Type of assistance being applied for",
      },
      purposeField,
      purposeOtherField,
      validityField("six (6) months"),
    ],
  },
  {
    key: "BUSINESS_PERMIT",
    label: "Barangay Business Clearance",
    title: "BARANGAY BUSINESS CLEARANCE",
    short: "BIZ",
    icon: "store",
    color: "amber",
    description: "Barangay clearance for businesses operating within the barangay (pre-Mayor's permit requirement).",
    category: "permits",
    fields: [
      { key: "businessName", label: "Business / Trade Name", type: "text", required: true, primary: true, placeholder: "e.g. Aling Nena's Sari-sari Store" },
      { key: "businessOwner", label: "Business Owner", type: "text", required: true, placeholder: "Full name of owner" },
      {
        key: "natureOfBusiness",
        label: "Nature of Business",
        type: "select",
        options: NATURE_OF_BUSINESS_OPTIONS,
        required: true,
        placeholder: "Select the line of business",
      },
      { key: "businessAddress", label: "Business Address", type: "text", required: true, placeholder: "Complete address of the establishment" },
      { key: "permitYear", label: "Permit Year", type: "number", defaultValue: String(new Date().getFullYear()) },
      purposeField,
      purposeOtherField,
      validityField("one (1) year"),
    ],
  },
  {
    key: "AARL",
    label: "After-Action Report & Log (AARL)",
    title: "AFTER-ACTION REPORT",
    short: "AARL",
    icon: "clipboard-check",
    color: "orange",
    description: "Post-incident report — actions taken, resources used, observations and recommendations.",
    category: "drrm-reports",
    fields: [
      { key: "incidentName", label: "Name / Title of Incident", type: "text", required: true, primary: true, placeholder: "e.g. Typhoon Tino Response" },
      { key: "incidentType", label: "Type of Incident", type: "select", options: INCIDENT_TYPE_OPTIONS, required: true },
      { key: "incidentDate", label: "Date of Incident", type: "date", required: true },
      { key: "incidentTime", label: "Time of Incident", type: "text", placeholder: "e.g. 2:30 AM" },
      { key: "locationSitio", label: "Location (Sitio / Purok)", type: "text", placeholder: "Affected sitio / purok in the barangay" },
      { key: "summary", label: "Summary of the Incident", type: "textarea", required: true, placeholder: "What happened, who was affected, extent of the incident…" },
      { key: "actionsTaken", label: "Actions Taken", type: "textarea", required: true, placeholder: "One action per line — e.g.\nConducted pre-emptive evacuation of 42 families\nDistributed 120 relief packs", help: "Press Enter after each action." },
      { key: "resourcesUsed", label: "Resources Used / Deployed", type: "textarea", placeholder: "Personnel, equipment, supplies and funds used" },
      { key: "observations", label: "Observations / Lessons Learned", type: "textarea", placeholder: "What worked, what did not, lessons for next time" },
      { key: "issues", label: "Issues / Concerns Encountered", type: "textarea", placeholder: "Gaps, delays and difficulties encountered" },
      { key: "recommendations", label: "Recommendations", type: "textarea", placeholder: "Recommended corrective actions and follow-ups" },
      { key: "preparedBy", label: "Prepared By (Name)", type: "text", required: true, placeholder: "e.g. Juan D. Dela Cruz" },
      { key: "preparedByPosition", label: "Prepared By (Position)", type: "text", defaultValue: "Barangay DRRM Coordinator" },
    ],
  },
  {
    key: "SPOT_REPORT",
    label: "Spot Report",
    title: "SPOT REPORT",
    short: "SPOT",
    icon: "siren",
    color: "red",
    description: "Initial incident report — the 5Ws of an ongoing or recent emergency event.",
    category: "drrm-reports",
    fields: [
      { key: "reportDate", label: "Date of Report", type: "date", required: true, defaultValue: isoToday() },
      { key: "reportTime", label: "Time of Report", type: "text", placeholder: "e.g. 9:15 AM" },
      { key: "incidentDate", label: "Date of Incident", type: "date", required: true, primary: true },
      { key: "incidentTime", label: "Time of Incident", type: "text", placeholder: "e.g. 8:47 AM" },
      { key: "incidentPlace", label: "Place of Incident", type: "text", required: true, placeholder: "Sitio / purok / landmark" },
      { key: "incidentType", label: "Type of Incident", type: "select", options: INCIDENT_TYPE_OPTIONS, required: true },
      { key: "description", label: "Description of the Incident (5Ws)", type: "textarea", required: true, placeholder: "Who, what, when, where, why — narrate what happened" },
      { key: "actionsTaken", label: "Actions Taken", type: "textarea", placeholder: "Initial response actions of the barangay" },
      { key: "casualtiesInjuries", label: "Casualties / Injuries", type: "text", placeholder: "e.g. None / 2 injured (transported to RHU)" },
      { key: "estimatedDamage", label: "Estimated Damage", type: "text", placeholder: "e.g. 3 houses partially damaged" },
      { key: "status", label: "Status", type: "select", options: SPOT_STATUS_OPTIONS, required: true },
      { key: "preparedBy", label: "Prepared By (Name)", type: "text", required: true, placeholder: "e.g. Juan D. Dela Cruz" },
      { key: "preparedByPosition", label: "Prepared By (Position)", type: "text", defaultValue: "Barangay DRRM Officer" },
    ],
  },
];

export const SERVICE_DOC_TYPE_MAP: Record<string, ServiceDocTypeDef> = Object.fromEntries(
  SERVICE_DOC_TYPES.map((t) => [t.key, t])
);

export const SERVICE_DOC_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  SERVICE_DOC_TYPES.map((t) => [t.key, t.label])
);

export function getServiceDocType(key: string): ServiceDocTypeDef | undefined {
  return SERVICE_DOC_TYPE_MAP[key];
}

// ---------------------------------------------------------------------------
// Control numbers — PD-BRG-006-CLR-25-0001
// ---------------------------------------------------------------------------

/** Extract the 3-digit barangay number from a QAS33 barangay code (PD-BRG-006 → "006"). */
export function barangayNumberFromCode(code: string): string {
  const m = code.match(/(\d+)\s*$/);
  return m ? m[1].padStart(3, "0") : "000";
}

/** Build a service document control number: PD-BRG-006-CLR-25-0001. */
export function buildControlNo(barangayCode: string, short: string, year: number, seq: number): string {
  const yy = String(year % 100).padStart(2, "0");
  return `PD-BRG-${barangayNumberFromCode(barangayCode)}-${short}-${yy}-${String(seq).padStart(4, "0")}`;
}

/** Sequence-stripped prefix used to count same-type documents for a barangay + year. */
export function controlNoPrefix(barangayCode: string, short: string, year: number): string {
  return buildControlNo(barangayCode, short, year, 0).slice(0, -4);
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

export type ServiceDocData = Record<string, string>;

/** Default data object for a brand-new document of the given type. */
export function defaultServiceData(key: ServiceDocTypeKey): ServiceDocData {
  const def = SERVICE_DOC_TYPE_MAP[key];
  const data: ServiceDocData = {};
  if (def) for (const f of def.fields) if (f.defaultValue !== undefined) data[f.key] = f.defaultValue;
  return data;
}

/**
 * Keep only known keys with sane lengths (used on every write so the stored
 * JSON always matches the current template definition).
 */
export function sanitizeServiceData(key: ServiceDocTypeKey, incoming: Record<string, unknown>): ServiceDocData {
  const def = SERVICE_DOC_TYPE_MAP[key];
  const data: ServiceDocData = {};
  if (!def) return data;
  for (const f of def.fields) {
    const raw = incoming[f.key];
    if (raw === undefined || raw === null) continue;
    const text = String(raw).replace(/\r\n/g, "\n").trim();
    if (!text) continue;
    data[f.key] = text.slice(0, f.type === "textarea" ? 4000 : 300);
  }
  return data;
}

/** Validate required fields. Returns the list of missing field labels. */
export function validateServiceData(key: ServiceDocTypeKey, data: ServiceDocData): { ok: boolean; missing: string[] } {
  const def = SERVICE_DOC_TYPE_MAP[key];
  const missing: string[] = [];
  if (!def) return { ok: false, missing: ["Unknown document type"] };
  for (const f of def.fields) {
    if (!f.required) continue;
    if (f.showIf && data[f.showIf.field] !== f.showIf.equals) continue;
    if (!data[f.key] || !data[f.key].trim()) missing.push(f.label);
  }
  return { ok: missing.length === 0, missing };
}

/** The primary subject field must be present even for a draft. */
export function validateDraftMinimum(key: ServiceDocTypeKey, data: ServiceDocData): { ok: boolean; missing: string[] } {
  const def = SERVICE_DOC_TYPE_MAP[key];
  if (!def) return { ok: false, missing: ["Unknown document type"] };
  const primary = def.fields.find((f) => f.primary) ?? def.fields[0];
  const ok = !!(data[primary.key] && data[primary.key].trim());
  return { ok, missing: ok ? [] : [primary.label] };
}

// ---------------------------------------------------------------------------
// Formatting helpers (shared by PDF + live preview)
// ---------------------------------------------------------------------------

/** "2026-01-05" → "January 5, 2026" (returns "" for invalid/empty). */
export function formatDatePh(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

/** "2026-01-05" → "5th day of January 2026" (official PH phrasing). */
export function formatDayOrdinal(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  const month = d.toLocaleDateString("en-PH", { month: "long" });
  return `${day}${suffix} day of ${month} ${d.getFullYear()}`;
}

/** Age in years from a birthdate ("" when implausible). */
export function computeAge(birthdate: string | undefined): string {
  if (!birthdate) return "";
  const d = new Date(`${birthdate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age > 0 && age < 130 ? String(age) : "";
}

export interface DocRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export interface DocParagraph {
  runs: DocRun[];
  align?: "left" | "center";
  small?: boolean;
}

/** Blank placeholder for values not yet filled in (draft preview). */
function v(data: ServiceDocData, key: string, blank = "____________________"): string {
  const val = data[key];
  return val && val.trim() ? val.trim() : blank;
}

/** Avoids "Barangay Barangay III" duplication — DB names may already carry the prefix. */
export function barangayLabel(name: string): string {
  const trimmed = name.trim();
  return /^barangay\b/i.test(trimmed) ? trimmed : `Barangay ${trimmed}`;
}

function pronouns(data: ServiceDocData): { objective: string } {
  if (data.sex === "Male") return { objective: "him" };
  if (data.sex === "Female") return { objective: "her" };
  return { objective: "him/her" };
}

/** "House 12, Purok 3" style address line from address + purok fields. */
function addressLine(data: ServiceDocData): string {
  return [data.address?.trim(), data.purok?.trim() ? `Purok ${data.purok.trim()}` : null]
    .filter(Boolean)
    .join(", ");
}

function purposeText(data: ServiceDocData): string {
  if (data.purpose === "Other" && data.purposeOther?.trim()) return data.purposeOther.trim();
  return v(data, "purpose");
}

function ageClause(data: ServiceDocData): string {
  const age = data.age?.trim() || computeAge(data.birthdate);
  return age ? `${age} years of age` : "";
}

function personIntro(data: ServiceDocData, barangayName: string): DocRun[] {
  const runs: DocRun[] = [{ text: "THIS IS TO CERTIFY that " }, { text: v(data, "fullName").toUpperCase(), bold: true }];
  const parts: string[] = [];
  const age = ageClause(data);
  if (age) parts.push(age);
  if (data.civilStatus?.trim()) parts.push(data.civilStatus.trim().toLowerCase());
  const citizen = data.citizenship?.trim() || "Filipino";
  parts.push(`${citizen} citizen`);
  runs.push({ text: `, ${parts.join(", ")}, and a resident of ` });
  const addr = addressLine(data);
  runs.push({ text: addr || "____________________", bold: true });
  runs.push({ text: `, ${barangayLabel(barangayName)}, Municipality of Pio Duran, Province of Albay` });
  return runs;
}

function purposeValidityClause(data: ServiceDocData): string {
  let text = `This certification is issued upon request of the interested party for ${purposeText(data)} purposes`;
  if (data.validity?.trim()) text += ` and is valid for ${data.validity.trim()} from the date of issuance, unless sooner revoked`;
  return `${text}.`;
}

function issuedThisClause(data: ServiceDocData, barangayName: string, dateIso: string): DocParagraph {
  return {
    runs: [
      { text: "ISSUED this ", bold: true },
      { text: formatDayOrdinal(dateIso) || "____ day of ____________, 20__" },
      { text: " at ", bold: true },
      { text: `${barangayLabel(barangayName)}, Pio Duran, Albay.` },
    ],
  };
}

// ---------------------------------------------------------------------------
// Certificate / permit bodies (certificates + permits share this shape)
// ---------------------------------------------------------------------------

export function buildCertificateBody(
  key: ServiceDocTypeKey,
  data: ServiceDocData,
  barangayName: string,
  issueDateIso?: string
): DocParagraph[] {
  const dateIso = issueDateIso || new Date().toISOString().slice(0, 10);
  const pron = pronouns(data);
  const paragraphs: DocParagraph[] = [{ runs: [{ text: "TO WHOM IT MAY CONCERN:", bold: true }] }];

  if (key === "BRGY_CLEARANCE") {
    paragraphs.push({
      runs: [
        ...personIntro(data, barangayName),
        { text: ", has " },
        { text: "NO PENDING CASE", bold: true },
        { text: " and " },
        { text: "NO DEROGATORY RECORD", bold: true },
        { text: ` filed against ${pron.objective} in this barangay as of ${formatDatePh(dateIso) || "____"}.` },
      ],
    });
    paragraphs.push({ runs: [{ text: purposeValidityClause(data) }] });
  } else if (key === "BRGY_RESIDENCY") {
    const since = data.residentSince?.trim();
    paragraphs.push({
      runs: [
        ...personIntro(data, barangayName).slice(0, 2), // "THIS IS TO CERTIFY that NAME"
        { text: ` is a BONA FIDE RESIDENT of ` },
        { text: addressLine(data) || "____________________", bold: true },
        { text: `, ${barangayLabel(barangayName)}, Pio Duran, Albay${since ? ` since ${since}` : ""}.` },
      ],
    });
    paragraphs.push({
      runs: [
        {
          text: "As per records of this office, the above-named resident has maintained residency in this barangay and is a person of good moral standing in the community.",
        },
      ],
    });
    paragraphs.push({ runs: [{ text: purposeValidityClause(data) }] });
  } else if (key === "BRGY_INDIGENCY") {
    paragraphs.push({
      runs: [
        ...personIntro(data, barangayName),
        {
          text: ", belongs to an INDIGENT FAMILY as determined through the socio-economic spot survey conducted by this barangay.",
        },
      ],
    });
    const details: string[] = [];
    if (data.spouseName?.trim()) details.push(`Married to ${data.spouseName.trim()}`);
    if (data.householdNo?.trim()) details.push(`household of ${data.householdNo.trim()} member(s)`);
    if (data.monthlyIncome?.trim()) details.push(`combined monthly income of approximately ${data.monthlyIncome.trim()}`);
    if (details.length) {
      paragraphs.push({ runs: [{ text: `Based on said survey, the subject is ${details.join(" and ")}.` }] });
    }
    const reason = data.reasonForAssistance?.trim();
    paragraphs.push({
      runs: [
        {
          text: `This certification is being issued to support the above-named resident's application for ${reason || "____________________"} assistance and for ${purposeText(data)} purposes, subject to the usual verification by the concerned agency.`,
        },
      ],
    });
  } else if (key === "BUSINESS_PERMIT") {
    paragraphs.push({
      runs: [
        { text: "THIS IS TO CERTIFY that " },
        { text: v(data, "businessName").toUpperCase(), bold: true },
        { text: ", a business establishment owned and managed by " },
        { text: v(data, "businessOwner"), bold: true },
        {
          text: `, with nature of business "${v(data, "natureOfBusiness")}" and operating at ${v(data, "businessAddress")}, ${barangayLabel(barangayName)}, Municipality of Pio Duran, Province of Albay, has COMPLIED with the requirements set by this barangay for the operation of the above-mentioned establishment.`,
        },
      ],
    });
    const year = data.permitYear?.trim() || String(new Date().getFullYear());
    let clause = `This barangay business clearance is issued for ${purposeText(data)} purposes and covers calendar year ${year}`;
    if (data.validity?.trim()) clause += `, valid for ${data.validity.trim()} from the date of issuance unless sooner revoked`;
    paragraphs.push({ runs: [{ text: `${clause}.` }] });
  }

  paragraphs.push(issuedThisClause(data, barangayName, dateIso));
  return paragraphs;
}

// ---------------------------------------------------------------------------
// AARL / Spot Report bodies — labelled sections
// ---------------------------------------------------------------------------

export interface DocReportSection {
  label: string;
  lines: string[];
}

function lines(data: ServiceDocData, key: string): string[] {
  const raw = data[key]?.trim();
  if (!raw) return ["—"];
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (/^[-•*\d]/.test(l) ? l : `- ${l}`));
}

function oneLine(data: ServiceDocData, ...keys: string[]): string {
  const parts = keys.map((k) => data[k]?.trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

function dateLine(data: ServiceDocData, dateKey: string, timeKey?: string): string {
  const d = formatDatePh(data[dateKey]);
  const t = timeKey ? data[timeKey]?.trim() : "";
  if (d && t) return `${d} (${t})`;
  if (d) return d;
  return t || "—";
}

export function buildReportSections(key: ServiceDocTypeKey, data: ServiceDocData, barangayName: string): DocReportSection[] {
  if (key === "AARL") {
    return [
      { label: "Name / Title of Incident", lines: [data.incidentName?.trim() || "—"] },
      { label: "Type of Incident", lines: [data.incidentType?.trim() || "—"] },
      { label: "Date & Time of Incident", lines: [dateLine(data, "incidentDate", "incidentTime")] },
      { label: "Location (Sitio / Purok)", lines: [data.locationSitio?.trim() ? `${data.locationSitio.trim()} — ${barangayLabel(barangayName)}, Pio Duran, Albay` : `${barangayLabel(barangayName)}, Pio Duran, Albay`] },
      { label: "Summary of the Incident", lines: data.summary?.trim() ? data.summary.trim().split("\n").map((l) => l.trim()).filter(Boolean) : ["—"] },
      { label: "Actions Taken", lines: lines(data, "actionsTaken") },
      { label: "Resources Used / Deployed", lines: lines(data, "resourcesUsed") },
      { label: "Observations / Lessons Learned", lines: lines(data, "observations") },
      { label: "Issues / Concerns Encountered", lines: lines(data, "issues") },
      { label: "Recommendations", lines: lines(data, "recommendations") },
    ];
  }
  // SPOT_REPORT
  return [
    { label: "Date & Time Reported", lines: [dateLine(data, "reportDate", "reportTime")] },
    { label: "Date & Time of Incident", lines: [dateLine(data, "incidentDate", "incidentTime")] },
    { label: "Place of Incident", lines: [data.incidentPlace?.trim() ? `${data.incidentPlace.trim()} — ${barangayLabel(barangayName)}, Pio Duran, Albay` : "—"] },
    { label: "Type of Incident", lines: [data.incidentType?.trim() || "—"] },
    { label: "Description of the Incident (5Ws)", lines: data.description?.trim() ? data.description.trim().split("\n").map((l) => l.trim()).filter(Boolean) : ["—"] },
    { label: "Actions Taken", lines: lines(data, "actionsTaken") },
    { label: "Casualties / Injuries", lines: [oneLine(data, "casualtiesInjuries")] },
    { label: "Estimated Damage", lines: [oneLine(data, "estimatedDamage")] },
    { label: "Status of the Incident", lines: [data.status?.trim() ? data.status.trim().toUpperCase() : "—"] },
  ];
}
