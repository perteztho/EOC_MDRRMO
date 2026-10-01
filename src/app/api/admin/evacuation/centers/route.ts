import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canManageEvacuation, getClientIp, requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { getCommunicationSettings } from "@/lib/qas33/comm-settings";
import {
  centerInputToData,
  nextEvacCenterCode,
  resolveBarangayId,
  toEvacCenterDTO,
  validateCenterInput,
} from "@/lib/qas33/evac-service";
import type { EvacCenterInput } from "@/lib/qas33/emergency-types";

// GET /api/admin/evacuation/centers — all centers (incl. hidden) + barangay list
export async function GET() {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [centers, settings, barangays] = await Promise.all([
      db.evacuationCenter.findMany({
        orderBy: [{ displayOrder: "asc" }, { barangay: "asc" }, { name: "asc" }],
      }),
      getCommunicationSettings(),
      db.barangay.findMany({
        where: { active: true },
        select: { code: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return NextResponse.json({
      centers: centers.map((c) => toEvacCenterDTO(c, settings)),
      barangays: barangays.map((b) => ({ code: b.code, name: b.name })),
    });
  } catch (e) {
    console.error("evac centers GET failed", e);
    return NextResponse.json({ error: "Failed to load evacuation centers." }, { status: 500 });
  }
}

// POST /api/admin/evacuation/centers — create a center (canManageEvacuation)
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageEvacuation(session.admin.role)) {
    return NextResponse.json({ error: "Only MDRRMO Officers and System Administrators can manage evacuation centers." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as EvacCenterInput;
    validateCenterInput(body);
    const data = centerInputToData(body);
    const code = await nextEvacCenterCode();
    const barangayId = await resolveBarangayId(String(body.barangay));

    const created = await db.evacuationCenter.create({
      data: { ...data, code, barangayId, lastUpdatedBy: session.admin.name } as Prisma.EvacuationCenterUncheckedCreateInput,
    });
    const settings = await getCommunicationSettings();
    await logAudit({
      actorType: "ADMIN",
      actorName: session.admin.name,
      action: "EVAC_CENTER_CREATED",
      detail: `${created.name} (${created.code}) — ${created.barangay}, capacity ${created.capacity}`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ center: toEvacCenterDTO(created, settings) }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create evacuation center.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
