import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay } from "@/lib/qas33/auth";
import { buildSanitizedAutofill } from "@/lib/qas33/plan-autofill";
import { getPlanYear } from "@/lib/qas33/plan-service";
import type { PlanAutofillResponse } from "@/lib/qas33/emergency-types";
import type { PlanFieldDef, PlanSectionClient } from "@/lib/qas33/types";

// GET /api/barangay/plans/[code]/autofill — municipal-database auto-fill values
// for the given builder, sanitized against its field definitions.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { code } = await params;
  const builderCode = code.toUpperCase();

  const builder = await db.planBuilder.findUnique({
    where: { code: builderCode },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  if (!builder || !builder.active) {
    return NextResponse.json({ error: "Plan builder not found" }, { status: 404 });
  }

  const year = await getPlanYear();
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

  const { values, sources } = await buildSanitizedAutofill(resolved.barangay.id, builderCode, sections, year);

  const response: PlanAutofillResponse = {
    ok: true,
    values,
    filledCount: Object.keys(values).length,
    sources,
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json(response);
}
