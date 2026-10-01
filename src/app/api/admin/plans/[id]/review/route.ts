import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, canReviewBdrrmp, canApproveBdrrmp, isSystemAdmin, normalizeAdminRole, getClientIp } from "@/lib/qas33/auth";
import { logAudit, notifyBarangay } from "@/lib/qas33/audit";
import { toAdminPlanRow } from "@/lib/qas33/plan-service";
import type { BarangayPlan } from "@prisma/client";

// POST /api/admin/plans/[id]/review — approve | return | provincial-approve a plan.
//   approve            → MDRRMO_OFFICER (or SYSTEM_ADMIN): status APPROVED + docRef issued
//   return             → MDRRMO_OFFICER / MDRRMO_STAFF: status RETURNED + required review note
//   provincial-approve → MDRRMO_OFFICER (or SYSTEM_ADMIN) records the second-level
//                        approval by the PROVINCIAL DRRM OFFICER: status PROVINCE_APPROVED.
//                        The MDRRMO console acts on behalf of / at the direction of the
//                        Provincial DRRM Officer (name + note captured for the record).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const note = body.note ? String(body.note).slice(0, 2000).trim() : "";

  const role = normalizeAdminRole(resolved.admin.role);
  const admin = resolved.admin;
  const ip = getClientIp(request);

  const plan = await db.barangayPlan.findUnique({
    where: { id },
    include: { barangay: true, builder: true },
  });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const audit = (act: string, detail: string) =>
    logAudit({
      actorType: "ADMIN",
      actorName: admin.name,
      action: act,
      detail: `${detail} — ${plan.barangay.name} (${plan.barangay.code})`,
      barangayId: plan.barangayId,
      ip,
    });

  const failLocked = (status: string) =>
    NextResponse.json(
      { error: `This action requires the plan to be SUBMITTED for approval (current status: ${status}).` },
      { status: 409 }
    );

  // ---------- APPROVE ----------
  if (action === "approve") {
    if (!canApproveBdrrmp(role) && !isSystemAdmin(role)) {
      return NextResponse.json(
        { error: "Only the MDRRMO Officer (or System Administrator) can approve plans." },
        { status: 403 }
      );
    }
    if (plan.status !== "SUBMITTED") return failLocked(plan.status);

    const yy = String(plan.year % 100).padStart(2, "0");
    const num = plan.barangay.code.replace(/\D/g, "").padStart(3, "0");
    const docRef = `${plan.builder.docPrefix}-${yy}-${num}`;
    const now = new Date();

    const updated = await db.barangayPlan.update({
      where: { id },
      data: { status: "APPROVED", reviewedBy: admin.name, reviewedAt: now, reviewNote: note || null, docRef },
    });
    await notifyBarangay(plan.barangayId, {
      type: "APPROVED",
      title: `${plan.builder.titleEn} APPROVED`,
      body: note || `Approved by ${admin.name} on ${now.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}. Document Ref: ${docRef}.`,
      link: "plans",
    });
    await audit("PLAN_APPROVED", `Approved ${plan.builder.titleEn} ${plan.year} (${docRef})`);
    return NextResponse.json({ ok: true, plan: toAdminPlanRow(updated as BarangayPlan, plan.barangay, plan.builder) });
  }

  // ---------- PROVINCIAL APPROVAL (2nd level) ----------
  if (action === "provincial-approve") {
    if (!canApproveBdrrmp(role) && !isSystemAdmin(role)) {
      return NextResponse.json(
        { error: "Only the MDRRMO Officer (or System Administrator) can record the Provincial DRRM Officer's approval." },
        { status: 403 }
      );
    }
    if (plan.status !== "APPROVED" && plan.status !== "PROVINCE_APPROVED") {
      return NextResponse.json(
        { error: `Provincial approval can only be recorded after the MDRRMO has approved the plan (current status: ${plan.status}).` },
        { status: 409 }
      );
    }
    const officerName = (body.officerName ? String(body.officerName).slice(0, 160).trim() : "").trim();
    if (!officerName) {
      return NextResponse.json(
        { error: "The name of the Provincial DRRM Officer is required." },
        { status: 400 }
      );
    }

    const now = new Date();
    const updated = await db.barangayPlan.update({
      where: { id },
      data: {
        status: "PROVINCE_APPROVED",
        provincialApprovedBy: officerName,
        provincialApprovedAt: now,
        provincialNote: note || null,
      },
    });
    await notifyBarangay(plan.barangayId, {
      type: "APPROVED",
      title: `${plan.builder.titleEn} APPROVED by the Provincial DRRM Officer`,
      body: `Approved by ${officerName} (Provincial DRRM Officer) on ${now.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}.${note ? ` Note: ${note}` : ""}${plan.docRef ? ` Document Ref: ${plan.docRef}.` : ""}`,
      link: "plans",
    });
    await audit(
      "PLAN_PROVINCE_APPROVED",
      `Recorded Provincial DRRM Officer approval for ${plan.builder.titleEn} ${plan.year}${plan.docRef ? ` (${plan.docRef})` : ""} — approved by ${officerName}`
    );
    return NextResponse.json({ ok: true, plan: toAdminPlanRow(updated as BarangayPlan, plan.barangay, plan.builder) });
  }

  // ---------- RETURN FOR REVISION ----------
  if (action === "return") {
    if (!canReviewBdrrmp(role)) {
      return NextResponse.json(
        { error: "Only the MDRRMO Officer and Staff can return plans for revision." },
        { status: 403 }
      );
    }
    if (plan.status !== "SUBMITTED") return failLocked(plan.status);
    if (!note) {
      return NextResponse.json(
        { error: "A review note is required when returning a plan for revision." },
        { status: 400 }
      );
    }

    const now = new Date();
    const updated = await db.barangayPlan.update({
      where: { id },
      data: { status: "RETURNED", reviewedBy: admin.name, reviewedAt: now, reviewNote: note },
    });
    await notifyBarangay(plan.barangayId, {
      type: "REVISION",
      title: `${plan.builder.titleEn} returned for revision`,
      body: note,
      link: "plans",
    });
    await audit("PLAN_RETURNED", `Returned ${plan.builder.titleEn} ${plan.year} for revision`);
    return NextResponse.json({ ok: true, plan: toAdminPlanRow(updated as BarangayPlan, plan.barangay, plan.builder) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
