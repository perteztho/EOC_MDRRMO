import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canManageEvacuation, getClientIp, requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { getCommunicationSettings } from "@/lib/qas33/comm-settings";
import {
  centerInputToData,
  resolveBarangayId,
  toEvacCenterDTO,
  validateCenterInput,
} from "@/lib/qas33/evac-service";
import type { EvacCenterInput } from "@/lib/qas33/emergency-types";

// PUT /api/admin/evacuation/centers/[id] — update center details (canManageEvacuation)
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageEvacuation(session.admin.role)) {
    return NextResponse.json({ error: "Only MDRRMO Officers and System Administrators can manage evacuation centers." }, { status: 403 });
  }
  try {
    const { id } = await ctx.params;
    const existing = await db.evacuationCenter.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Evacuation center not found." }, { status: 404 });

    const body = (await request.json()) as EvacCenterInput;
    // merge over the existing row so partial edits stay valid
    const merged = {
      ...existing,
      ...Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)),
      name: body.name ?? existing.name,
      barangay: body.barangay ?? existing.barangay,
      status: body.status ?? existing.status,
      facilityType: body.facilityType ?? existing.facilityType,
      waterStatus: body.waterStatus ?? existing.waterStatus,
      electricityStatus: body.electricityStatus ?? existing.electricityStatus,
      washStatus: body.washStatus ?? existing.washStatus,
    } as unknown as EvacCenterInput;
    validateCenterInput(merged);
    const data = centerInputToData(merged);
    const barangayId = body.barangay ? await resolveBarangayId(String(merged.barangay)) : existing.barangayId;

    const updated = await db.evacuationCenter.update({
      where: { id },
      data: { ...data, barangayId, lastUpdatedBy: session.admin.name },
    });
    const settings = await getCommunicationSettings();
    await logAudit({
      actorType: "ADMIN",
      actorName: session.admin.name,
      action: "EVAC_CENTER_UPDATED",
      detail: `${updated.name} (${updated.code}) updated — capacity ${existing.capacity} → ${updated.capacity}`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ center: toEvacCenterDTO(updated, settings) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update evacuation center.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE /api/admin/evacuation/centers/[id] — SOFT delete (visible=false)
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageEvacuation(session.admin.role)) {
    return NextResponse.json({ error: "Only MDRRMO Officers and System Administrators can manage evacuation centers." }, { status: 403 });
  }
  try {
    const { id } = await ctx.params;
    const existing = await db.evacuationCenter.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Evacuation center not found." }, { status: 404 });
    await db.evacuationCenter.update({ where: { id }, data: { visible: false } });
    await logAudit({
      actorType: "ADMIN",
      actorName: session.admin.name,
      action: "EVAC_CENTER_DELETED",
      detail: `${existing.name} (${existing.code}) hidden from all listings (soft delete)`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("evac center DELETE failed", e);
    return NextResponse.json({ error: "Failed to delete evacuation center." }, { status: 500 });
  }
}
