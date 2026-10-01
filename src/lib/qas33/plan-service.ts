// QAS33 Plan Builder service (server) — loading builder templates, per-barangay
// plan documents, sanitizing saves and computing progress.
import { db } from "@/lib/db";
import { getSettings } from "./server";
import type { AdminPlanRow, PlanApprovalStatus } from "./emergency-types";
import type { PlanBuilderCard, PlanFieldDef, PlanReviewInfo, PlanSectionClient, PlanStatus } from "./types";
import type { PlanBuilder, PlanBuilderSection, BarangayPlan } from "@prisma/client";

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export async function getPlanYear(): Promise<number> {
  const settings = await getSettings();
  return settings.planYear;
}

export async function listBuildersForBarangay(barangayId: string): Promise<PlanBuilderCard[]> {
  const year = await getPlanYear();
  const builders = await db.planBuilder.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  const plans = await db.barangayPlan.findMany({ where: { barangayId, year } });
  const planByCode = new Map(plans.map((p) => [p.builderCode, p]));

  return builders.map((b) => {
    const plan = planByCode.get(b.code);
    return {
      code: b.code,
      version: b.version,
      title: b.titleEn,
      titleTl: b.titleTl,
      subtitle: b.subtitleEn,
      description: b.descriptionEn,
      icon: b.icon,
      color: b.color,
      docPrefix: b.docPrefix,
      sectionCount: b.sections.length,
      plan: plan
        ? {
            year: plan.year,
            status: plan.status as PlanStatus,
            progress: plan.progress,
            updatedAt: plan.updatedAt.toISOString(),
            submittedAt: plan.submittedAt ? plan.submittedAt.toISOString() : null,
            docRef: plan.docRef,
          }
        : null,
    } satisfies PlanBuilderCard;
  });
}

export interface PlanDetail {
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

export async function getOrCreatePlan(barangayId: string, builderCode: string): Promise<BarangayPlan> {
  const year = await getPlanYear();
  let plan = await db.barangayPlan.findUnique({
    where: { barangayId_builderCode_year: { barangayId, builderCode, year } },
  });
  if (!plan) {
    plan = await db.barangayPlan.create({ data: { barangayId, builderCode, year } });
  }
  return plan;
}

export async function getPlanDetail(
  barangay: { id: string; code: string; name: string; captain?: string | null },
  builderCode: string
): Promise<PlanDetail | null> {
  const builder = await db.planBuilder.findUnique({
    where: { code: builderCode },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  if (!builder || !builder.active) return null;

  const plan = await getOrCreatePlan(barangay.id, builderCode);
  const year = plan.year;
  const values = parsePlanValues(plan);

  const sections: PlanSectionClient[] = builder.sections.map((s) => ({
    code: s.code,
    order: s.order,
    group: s.groupEn,
    title: s.titleEn,
    desc: s.descEn,
    icon: s.icon,
    required: s.required,
    fields: JSON.parse(s.fieldsJson || "[]") as PlanFieldDef[],
  }));

  const progress = computePlanProgress(sections, values);

  return {
    builder: {
      code: builder.code,
      version: builder.version,
      title: builder.titleEn,
      titleTl: builder.titleTl,
      subtitle: builder.subtitleEn,
      description: builder.descriptionEn,
      icon: builder.icon,
      color: builder.color,
      docPrefix: builder.docPrefix,
      sectionCount: sections.length,
      plan: {
        year,
        status: plan.status as PlanStatus,
        progress: plan.progress,
        updatedAt: plan.updatedAt.toISOString(),
      },
    },
    year,
    barangay: { code: barangay.code, name: barangay.name, captain: barangay.captain },
    sections,
    values,
    progress,
    status: plan.status as PlanStatus,
    updatedAt: plan.updatedAt.toISOString(),
    review: {
      submittedAt: plan.submittedAt ? plan.submittedAt.toISOString() : null,
      submittedByName: plan.submittedByName,
      reviewedBy: plan.reviewedBy,
      reviewedAt: plan.reviewedAt ? plan.reviewedAt.toISOString() : null,
      reviewNote: plan.reviewNote,
      docRef: plan.docRef,
      provincialApprovedBy: plan.provincialApprovedBy,
      provincialApprovedAt: plan.provincialApprovedAt ? plan.provincialApprovedAt.toISOString() : null,
      provincialNote: plan.provincialNote,
      lastExportAt: plan.lastExportAt ? plan.lastExportAt.toISOString() : null,
      lastExportFormat: plan.lastExportFormat,
    },
  };
}

export function parsePlanValues(plan: BarangayPlan): Record<string, unknown> {
  try {
    return JSON.parse(plan.valuesJson || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Admin approval workflow rows (Plan Approvals console)
// ---------------------------------------------------------------------------

/** Shape a BarangayPlan (+ joined barangay/builder) into the shared AdminPlanRow DTO. */
export function toAdminPlanRow(
  plan: BarangayPlan,
  barangay: { code: string; name: string },
  builder: { titleEn: string }
): AdminPlanRow {
  return {
    id: plan.id,
    barangayCode: barangay.code,
    barangayName: barangay.name,
    builderCode: plan.builderCode,
    builderTitle: builder.titleEn,
    year: plan.year,
    status: plan.status as PlanApprovalStatus,
    progress: plan.progress,
    submittedAt: plan.submittedAt ? plan.submittedAt.toISOString() : null,
    submittedByName: plan.submittedByName,
    reviewedBy: plan.reviewedBy,
    reviewedAt: plan.reviewedAt ? plan.reviewedAt.toISOString() : null,
    reviewNote: plan.reviewNote,
    docRef: plan.docRef,
    provincialApprovedBy: plan.provincialApprovedBy,
    provincialApprovedAt: plan.provincialApprovedAt ? plan.provincialApprovedAt.toISOString() : null,
    provincialNote: plan.provincialNote,
    updatedAt: plan.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Validation, sanitization & progress
// ---------------------------------------------------------------------------

const MAX_TEXT = 5000;
const MAX_TABLE_ROWS = 60;

/** Field has a meaningful value? */
export function planFieldHasValue(f: PlanFieldDef, values: Record<string, unknown>): boolean {
  const v = values[f.key];
  if (f.type === "checkbox") return Array.isArray(v) && v.length > 0;
  if (f.type === "table") {
    if (!Array.isArray(v)) return false;
    return v.some((row) =>
      Object.values(row as Record<string, unknown>).some(
        (cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""
      )
    );
  }
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return true;
  return v !== undefined && v !== null;
}

/** Section complete = all required fields have values (all-optional sections need ≥1 filled). */
export function planSectionComplete(s: PlanSectionClient, values: Record<string, unknown>): boolean {
  const requiredFields = s.fields.filter((f) => f.required);
  if (requiredFields.length > 0) return requiredFields.every((f) => planFieldHasValue(f, values));
  // Section with only optional fields counts once the user has entered anything.
  return s.fields.some((f) => planFieldHasValue(f, values));
}

/** 0–100 progress across all sections (weighted by required field count). */
export function computePlanProgress(sections: PlanSectionClient[], values: Record<string, unknown>): number {
  if (sections.length === 0) return 0;
  let totalFields = 0;
  let filledFields = 0;
  for (const s of sections) {
    const requiredFields = s.fields.filter((f) => f.required);
    if (requiredFields.length === 0) {
      // all-optional section counts once the user has entered anything
      totalFields += 1;
      if (s.fields.some((f) => planFieldHasValue(f, values))) filledFields += 1;
      continue;
    }
    for (const f of requiredFields) {
      totalFields += 1;
      if (planFieldHasValue(f, values)) filledFields += 1;
    }
  }
  return totalFields === 0 ? 0 : Math.round((filledFields / totalFields) * 100);
}

export function computePlanStatus(
  current: string,
  sections: PlanSectionClient[],
  values: Record<string, unknown>
): PlanStatus {
  const progress = computePlanProgress(sections, values);
  const complete = progress >= 100 && sections.every((s) => planSectionComplete(s, values));
  // Approval-workflow states are never downgraded by autosave:
  // SUBMITTED / APPROVED / PROVINCE_APPROVED are locked upstream (PUT returns
  // 409); RETURNED flips back to DRAFT as soon as the barangay edits the plan again.
  if (current === "SUBMITTED" || current === "APPROVED" || current === "PROVINCE_APPROVED") return current as PlanStatus;
  if (current === "RETURNED") return complete ? "COMPLETED" : "DRAFT";
  if (complete) return "COMPLETED";
  if (progress > 0) return "DRAFT";
  return current === "COMPLETED" ? "DRAFT" : "NOT_STARTED";
}

/** Whitelist + sanitize incoming values against the builder's field definitions. */
export function sanitizePlanValues(
  sections: Array<{ fields: PlanFieldDef[] }>,
  values: Record<string, unknown>
): Record<string, unknown> {
  const allowed: Record<string, unknown> = {};
  const allFields = sections.flatMap((s) => s.fields);
  for (const f of allFields) {
    const v = values[f.key];
    if (v === undefined) continue;
    if (f.type === "checkbox") {
      allowed[f.key] = Array.isArray(v) ? v.map(String).slice(0, 30) : [];
    } else if (f.type === "number") {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      allowed[f.key] = Number.isFinite(n) ? n : null;
    } else if (f.type === "table") {
      if (!Array.isArray(v)) continue;
      const cols = f.columns ?? [];
      const rows = v.slice(0, MAX_TABLE_ROWS).map((row) => {
        const clean: Record<string, unknown> = {};
        if (row && typeof row === "object") {
          for (const col of cols) {
            const cell = (row as Record<string, unknown>)[col.key];
            if (col.type === "number") {
              const n = typeof cell === "number" ? cell : parseFloat(String(cell));
              clean[col.key] = Number.isFinite(n) ? n : null;
            } else {
              clean[col.key] = cell === null || cell === undefined ? "" : String(cell).slice(0, 500);
            }
          }
        }
        return clean;
      });
      allowed[f.key] = rows;
    } else {
      allowed[f.key] = v === null || v === undefined ? "" : String(v).slice(0, MAX_TEXT);
    }
  }
  return allowed;
}

// ---------------------------------------------------------------------------
// Types re-exported for API routes
// ---------------------------------------------------------------------------

export type { PlanBuilder, PlanBuilderSection, BarangayPlan };
