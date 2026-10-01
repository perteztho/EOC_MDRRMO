// QAS33 template engine (server): section loading, completion & validation
import { db } from "@/lib/db";
import type { SectionDef, TemplateFieldDef, ClientSection, ValidationResult, ValidationIssue, FileMeta } from "./types";
import { PRE_SUBMISSION_STATUSES, type SubmissionStatus } from "./types";

export async function getSectionDefs(): Promise<SectionDef[]> {
  const rows = await db.templateSection.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
  });
  return rows.map((r) => ({
    key: r.key,
    order: r.order,
    titleEn: r.titleEn,
    titleTl: r.titleTl,
    descEn: r.descEn,
    descTl: r.descTl,
    icon: r.icon || "file",
    requiresUpload: r.requiresUpload,
    uploadLabelEn: r.uploadLabelEn,
    uploadLabelTl: r.uploadLabelTl,
    uploadFormats: r.uploadFormats,
    uploadMaxMB: r.uploadMaxMB,
    required: r.required,
    fields: JSON.parse(r.fieldsJson || "[]") as TemplateFieldDef[],
  }));
}

export function localizeSection(s: SectionDef, lang: string): ClientSection {
  return {
    key: s.key,
    order: s.order,
    title: lang === "TL" ? s.titleTl : s.titleEn,
    desc: lang === "TL" ? s.descTl : s.descEn,
    icon: s.icon,
    requiresUpload: s.requiresUpload,
    uploadLabel: lang === "TL" ? s.uploadLabelTl : s.uploadLabelEn,
    uploadFormats: (s.uploadFormats || "pdf,jpg,jpeg,png,doc,docx").split(",").map((f) => f.trim().toLowerCase()),
    uploadMaxMB: s.uploadMaxMB ?? 10,
    required: s.required,
    fields: s.fields,
  };
}

export function fieldLabel(f: TemplateFieldDef, lang: string): string {
  return lang === "TL" ? f.labelTl : f.labelEn;
}

function fieldHasValue(f: TemplateFieldDef, values: Record<string, unknown>): boolean {
  const v = values[f.key];
  if (f.type === "checkbox") return Array.isArray(v) && v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return true;
  return v !== undefined && v !== null;
}

export function sectionFormComplete(s: SectionDef, values: Record<string, unknown>): boolean {
  if (s.fields.length === 0) return true;
  return s.fields.filter((f) => f.required).every((f) => fieldHasValue(f, values));
}

export function sectionFiles(files: FileMeta[], sectionKey: string): FileMeta[] {
  return files.filter((f) => f.sectionKey === sectionKey);
}

export interface SectionProgress {
  sectionKey: string;
  title: string;
  required: boolean;
  requiresUpload: boolean;
  formComplete: boolean;
  uploadComplete: boolean;
  uploadStatus: "MISSING" | "PENDING" | "APPROVED" | "NEEDS_REVISION";
  fileCount: number;
  complete: boolean;
}

export function computeSectionProgress(
  sections: SectionDef[],
  values: Record<string, unknown>,
  files: FileMeta[],
  lang: string
): SectionProgress[] {
  return sections.map((s) => {
    const sFiles = sectionFiles(files, s.key);
    const formComplete = sectionFormComplete(s, values);
    const needsUpload = s.requiresUpload && s.required;
    const uploadComplete = !needsUpload || sFiles.length > 0;
    let uploadStatus: SectionProgress["uploadStatus"] = "MISSING";
    if (sFiles.length > 0) {
      if (sFiles.some((f) => f.status === "NEEDS_REVISION")) uploadStatus = "NEEDS_REVISION";
      else if (sFiles.every((f) => f.status === "APPROVED")) uploadStatus = "APPROVED";
      else uploadStatus = "PENDING";
    }
    return {
      sectionKey: s.key,
      title: lang === "TL" ? s.titleTl : s.titleEn,
      required: s.required,
      requiresUpload: s.requiresUpload,
      formComplete,
      uploadComplete,
      uploadStatus,
      fileCount: sFiles.length,
      complete: formComplete && uploadComplete,
    };
  });
}

export function computeValidation(
  sections: SectionDef[],
  values: Record<string, unknown>,
  files: FileMeta[],
  lang: string
): ValidationResult {
  const issues: ValidationIssue[] = [];
  let completed = 0;
  for (const s of sections) {
    if (!s.required) {
      // optional sections don't block submission
      if (sectionFormComplete(s, values) && sectionFiles(files, s.key).length > 0) completed += 1;
      continue;
    }
    const sFiles = sectionFiles(files, s.key);
    const missingFields = s.fields.filter((f) => f.required && !fieldHasValue(f, values));
    const missingUpload = s.requiresUpload && sFiles.length === 0;
    if (missingFields.length === 0 && !missingUpload) {
      completed += 1;
    } else {
      const reasons: string[] = [];
      if (missingFields.length > 0) {
        const names = missingFields.map((f) => fieldLabel(f, lang)).slice(0, 3).join(", ");
        reasons.push(
          lang === "TL"
            ? `Kulang sa kinakailangang field: ${names}${missingFields.length > 3 ? "..." : ""}`
            : `Missing required fields: ${names}${missingFields.length > 3 ? "..." : ""}`
        );
      }
      if (missingUpload) {
        reasons.push(lang === "TL" ? "Kinakailangang dokumento ay hindi pa nai-upload" : "Required document not yet uploaded");
      }
      issues.push({
        sectionKey: s.key,
        sectionTitle: lang === "TL" ? s.titleTl : s.titleEn,
        reason: reasons.join(" • "),
      });
    }
  }
  const requiredCount = sections.filter((s) => s.required).length;
  return {
    ready: issues.length === 0,
    issues,
    completedSections: completed,
    totalSections: requiredCount,
  };
}

// Recompute progress + draft-stage status after any barangay-side change
export function recomputeDraftStatus(
  currentStatus: string,
  sections: SectionDef[],
  values: Record<string, unknown>,
  files: FileMeta[]
): { progress: number; status: SubmissionStatus } {
  const validation = computeValidation(sections, values, files, "EN");
  const optionalSections = sections.filter((s) => !s.required).length;
  const totalAll = sections.length;
  const totalRequired = validation.totalSections;
  const progress =
    totalAll === 0 ? 0 : Math.round((Math.min(validation.completedSections, totalRequired + optionalSections) / totalAll) * 100);
  let status: SubmissionStatus = currentStatus as SubmissionStatus;
  if (PRE_SUBMISSION_STATUSES.includes(status as SubmissionStatus)) {
    const hasNothing = Object.keys(values).length === 0 && files.length === 0;
    status = hasNothing ? "NOT_STARTED" : validation.ready ? "READY_FOR_SUBMISSION" : "DRAFT";
  }
  return { progress, status };
}

export function toFileMeta(f: {
  id: string;
  sectionKey: string;
  filename: string;
  mimeType: string;
  size: number;
  version: number;
  status: string;
  uploadedBy: string;
  uploadedAt: Date;
}): FileMeta {
  return {
    id: f.id,
    sectionKey: f.sectionKey,
    filename: f.filename,
    mimeType: f.mimeType,
    size: f.size,
    version: f.version,
    status: f.status,
    uploadedBy: f.uploadedBy,
    uploadedAt: f.uploadedAt.toISOString(),
  };
}
