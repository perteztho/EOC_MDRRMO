import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/qas33/auth";
import { computePlanProgress, toAdminPlanRow } from "@/lib/qas33/plan-service";
import type { AdminPlanRow } from "@/lib/qas33/emergency-types";
import type { PlanBuilderCard, PlanFieldDef, PlanSectionClient, PlanStatus } from "@/lib/qas33/types";
import type { BarangayPlan } from "@prisma/client";

// GET /api/admin/plans/[id] — full plan detail (same shape as the barangay
// plan detail + review fields) for the admin review dialog.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const plan = await db.barangayPlan.findUnique({
    where: { id },
    include: { barangay: true, builder: { include: { sections: { orderBy: { order: "asc" } } } } },
  });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  let values: Record<string, unknown> = {};
  try {
    values = JSON.parse(plan.valuesJson || "{}") as Record<string, unknown>;
  } catch {
    values = {};
  }

  const sections: PlanSectionClient[] = plan.builder.sections.map((s) => ({
    code: s.code,
    order: s.order,
    group: s.groupEn,
    title: s.titleEn,
    desc: s.descEn,
    icon: s.icon,
    required: s.required,
    fields: JSON.parse(s.fieldsJson || "[]") as PlanFieldDef[],
  }));

  const builderCard: PlanBuilderCard = {
    code: plan.builder.code,
    version: plan.builder.version,
    title: plan.builder.titleEn,
    titleTl: plan.builder.titleTl,
    subtitle: plan.builder.subtitleEn,
    description: plan.builder.descriptionEn,
    icon: plan.builder.icon,
    color: plan.builder.color,
    docPrefix: plan.builder.docPrefix,
    sectionCount: sections.length,
    plan: {
      year: plan.year,
      status: plan.status as PlanStatus,
      progress: plan.progress,
      updatedAt: plan.updatedAt.toISOString(),
    },
  };

  const row: AdminPlanRow = toAdminPlanRow(plan as BarangayPlan, plan.barangay, plan.builder);

  return NextResponse.json({
    plan: row,
    builder: builderCard,
    year: plan.year,
    barangay: { code: plan.barangay.code, name: plan.barangay.name, captain: plan.barangay.captain },
    sections,
    values,
    progress: computePlanProgress(sections, values),
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
  });
}
