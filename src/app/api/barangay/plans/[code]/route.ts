import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay, getClientIp } from "@/lib/qas33/auth";
import { logAudit, notifyAdmins } from "@/lib/qas33/audit";
import type { PlanFieldDef, PlanSectionClient } from "@/lib/qas33/types";
import {
  getPlanDetail,
  getOrCreatePlan,
  parsePlanValues,
  sanitizePlanValues,
  computePlanProgress,
  computePlanStatus,
} from "@/lib/qas33/plan-service";

type Params = { params: Promise<{ code: string }> };

// GET — full plan detail (sections, fields, saved values) for one builder
export async function GET(_request: NextRequest, { params }: Params) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { code } = await params;
  const detail = await getPlanDetail(resolved.barangay, code.toUpperCase());
  if (!detail) {
    return NextResponse.json({ error: "Plan builder not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

// PUT — autosave plan values (whitelisted + sanitized against the template).
// SUBMITTED / APPROVED / PROVINCE_APPROVED plans are locked (409) while
// awaiting MDRRMO / provincial action.
export async function PUT(request: NextRequest, { params }: Params) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { code } = await params;
  const builderCode = code.toUpperCase();
  const barangay = resolved.barangay;

  const builder = await db.planBuilder.findUnique({
    where: { code: builderCode },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  if (!builder || !builder.active) {
    return NextResponse.json({ error: "Plan builder not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const incoming = (body.values ?? {}) as Record<string, unknown>;
  const plan = await getOrCreatePlan(barangay.id, builderCode);

  if (plan.status === "SUBMITTED" || plan.status === "APPROVED" || plan.status === "PROVINCE_APPROVED") {
    return NextResponse.json(
      { error: "This plan is locked while awaiting approval (MDRRMO / Provincial DRRM Officer)." },
      { status: 409 }
    );
  }

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

  // Merge sanitized incoming values onto existing values (client sends full
  // state, but merging keeps any unknown-key drift out of the store).
  const existing = parsePlanValues(plan);
  const merged = { ...existing, ...sanitizePlanValues(sections, incoming) };
  // Also clear keys the client explicitly emptied (present in incoming as "")
  for (const [k, v] of Object.entries(incoming)) {
    if (v === null || v === "" || (Array.isArray(v) && v.length === 0))
      merged[k] = sanitizePlanValues(sections, { [k]: v })[k] ?? v;
  }

  const progress = computePlanProgress(sections, merged);
  // RETURNED plans flip back to DRAFT on edit (computePlanStatus handles it).
  const status = computePlanStatus(plan.status, sections, merged);

  await db.barangayPlan.update({
    where: { id: plan.id },
    data: { valuesJson: JSON.stringify(merged), progress, status },
  });

  return NextResponse.json({ ok: true, progress, status });
}

// POST — actions:
//   reset    — clear all values (blocked once APPROVED)
//   reopen   — COMPLETED → DRAFT (blocked once APPROVED)
//   submit   — send the plan to the MDRRMO for approval
//   withdraw — pull back a submitted plan to keep editing
export async function POST(request: NextRequest, { params }: Params) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { code } = await params;
  const builderCode = code.toUpperCase();
  const barangay = resolved.barangay;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const builder = await db.planBuilder.findUnique({ where: { code: builderCode } });
  if (!builder || !builder.active) {
    return NextResponse.json({ error: "Plan builder not found" }, { status: 404 });
  }

  const plan = await getOrCreatePlan(barangay.id, builderCode);
  const audit = (action: string, detail: string) =>
    logAudit({
      actorType: "BARANGAY",
      actorName: `Barangay ${barangay.name}`,
      action,
      detail,
      barangayId: barangay.id,
      ip: getClientIp(request),
    });

  if (body.action === "reset") {
    if (plan.status === "APPROVED" || plan.status === "PROVINCE_APPROVED") {
      return NextResponse.json(
        { error: "This plan has been APPROVED and can no longer be reset." },
        { status: 409 }
      );
    }
    if (plan.status === "SUBMITTED") {
      return NextResponse.json(
        { error: "This plan is awaiting MDRRMO approval — withdraw it first to keep editing." },
        { status: 409 }
      );
    }
    await db.barangayPlan.update({
      where: { id: plan.id },
      data: { valuesJson: "{}", progress: 0, status: "NOT_STARTED" },
    });
    await audit("PLAN_RESET", `Reset ${builder.titleEn} (${builderCode}) data`);
    return NextResponse.json({ ok: true, progress: 0, status: "NOT_STARTED" });
  }

  if (body.action === "reopen") {
    if (plan.status === "APPROVED" || plan.status === "PROVINCE_APPROVED") {
      return NextResponse.json(
        { error: "This plan has been APPROVED and can no longer be reopened." },
        { status: 409 }
      );
    }
    if (plan.status === "SUBMITTED") {
      return NextResponse.json(
        { error: "This plan is awaiting MDRRMO approval — withdraw it first to keep editing." },
        { status: 409 }
      );
    }
    await db.barangayPlan.update({
      where: { id: plan.id },
      data: { status: "DRAFT" },
    });
    return NextResponse.json({ ok: true, status: "DRAFT" });
  }

  if (body.action === "submit") {
    if (plan.status === "SUBMITTED") {
      return NextResponse.json(
        { error: "This plan is already submitted and awaiting MDRRMO review." },
        { status: 400 }
      );
    }
    if (plan.status === "APPROVED" || plan.status === "PROVINCE_APPROVED") {
      return NextResponse.json(
        { error: "This plan was already APPROVED." },
        { status: 400 }
      );
    }
    if (plan.progress <= 0) {
      return NextResponse.json({ error: "Nothing to submit — fill the plan first" }, { status: 400 });
    }
    const now = new Date();
    const submittedByName = barangay.captain || barangay.name;
    await db.barangayPlan.update({
      where: { id: plan.id },
      data: { status: "SUBMITTED", submittedAt: now, submittedByName },
    });
    await notifyAdmins({
      type: "PLAN_SUBMITTED",
      title: `${builder.titleEn} submitted for approval`,
      body: `Barangay ${barangay.name} submitted its ${plan.year} ${builder.titleEn} (${plan.progress}% complete).`,
      link: "/plans",
    });
    await audit("PLAN_SUBMITTED", `Submitted ${builder.titleEn} ${plan.year} for MDRRMO approval`);
    return NextResponse.json({ ok: true, status: "SUBMITTED", submittedAt: now.toISOString() });
  }

  if (body.action === "withdraw") {
    if (plan.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: "Only plans currently awaiting MDRRMO approval can be withdrawn." },
        { status: 400 }
      );
    }
    await db.barangayPlan.update({
      where: { id: plan.id },
      data: { status: "DRAFT", submittedAt: null, submittedByName: null },
    });
    await notifyAdmins({
      type: "SYSTEM",
      title: "Plan withdrawn",
      body: `Barangay ${barangay.name} withdrew its ${plan.year} ${builder.titleEn} from the approval queue to keep editing.`,
      link: "/plans",
    });
    await audit("PLAN_WITHDRAWN", `Withdrew ${builder.titleEn} ${plan.year} from the approval queue`);
    return NextResponse.json({ ok: true, status: "DRAFT" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
