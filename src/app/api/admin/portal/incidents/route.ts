import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { sanitizeText } from "@/lib/qas33/portal-server";

// GET   /api/admin/portal/incidents — list public incident reports
// PATCH /api/admin/portal/incidents — update status / notes { id, status, adminNotes }

const STATUSES = ["RECEIVED", "REVIEWING", "DISPATCHED", "RESOLVED", "DISMISSED"];

export async function GET(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const status = new URL(request.url).searchParams.get("status");
    const where = status && STATUSES.includes(status) ? { status } : {};
    const rows = await db.incidentReport.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
    return NextResponse.json({
      ok: true,
      items: rows.map((r) => ({
        id: r.id,
        referenceNo: r.referenceNo,
        type: r.type,
        urgency: r.urgency,
        name: r.name,
        contact: r.contact,
        location: r.location,
        barangay: r.barangay,
        description: r.description,
        latitude: r.latitude,
        longitude: r.longitude,
        attachmentUrl: r.attachmentUrl,
        status: r.status,
        adminNotes: r.adminNotes,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("incidents list failed", e);
    return NextResponse.json({ error: "Failed to load incident reports." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as { id?: string; status?: string; adminNotes?: string };
    if (!body.id) return NextResponse.json({ error: "id is required." }, { status: 400 });
    const data: Record<string, unknown> = {};
    if (body.status) {
      if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      data.status = body.status;
    }
    if (typeof body.adminNotes === "string") data.adminNotes = sanitizeText(body.adminNotes, 2000) || null;
    const updated = await db.incidentReport.update({ where: { id: body.id }, data });
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "INCIDENT_STATUS_UPDATED",
      detail: `${updated.referenceNo} → ${updated.status}`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("incident update failed", e);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
