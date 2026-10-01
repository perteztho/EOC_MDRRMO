import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canManageEvacuation, getClientIp, requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { toEvacAnnouncementDTO } from "@/lib/qas33/evac-service";

// GET /api/admin/evacuation/announcements — all statuses, newest first (any role)
export async function GET() {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await db.evacuationAnnouncement.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ announcements: rows.map(toEvacAnnouncementDTO) });
  } catch (e) {
    console.error("evac announcements GET failed", e);
    return NextResponse.json({ error: "Failed to load evacuation announcements." }, { status: 500 });
  }
}

// POST /api/admin/evacuation/announcements — create/publish (canManageEvacuation)
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageEvacuation(session.admin.role)) {
    return NextResponse.json({ error: "Only MDRRMO Officers and System Administrators can publish evacuation announcements." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = String(body.title ?? "").trim();
    const message = String(body.message ?? "").trim();
    if (!title || title.length > 200) return NextResponse.json({ error: "Title is required (max 200 characters)." }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

    const priority = ["NORMAL", "HIGH", "URGENT", "CRITICAL"].includes(String(body.priority))
      ? String(body.priority)
      : "NORMAL";
    const status = ["PUBLISHED", "SCHEDULED", "DRAFT"].includes(String(body.status))
      ? String(body.status)
      : "PUBLISHED";
    const targetBarangays = Array.isArray(body.targetBarangays)
      ? (body.targetBarangays as unknown[]).map((b) => String(b).trim()).filter(Boolean).slice(0, 33)
      : [];
    const targetCenterIds = Array.isArray(body.targetCenterIds)
      ? (body.targetCenterIds as unknown[]).map((c) => String(c).trim()).filter(Boolean).slice(0, 50)
      : [];

    let publishAt = new Date();
    if (body.publishAt) {
      const d = new Date(String(body.publishAt));
      if (isNaN(d.getTime())) return NextResponse.json({ error: "Publication date is not valid." }, { status: 400 });
      publishAt = d;
    }
    let expiresAt: Date | null = null;
    if (body.expiresAt) {
      const d = new Date(String(body.expiresAt));
      if (isNaN(d.getTime())) return NextResponse.json({ error: "Expiration date is not valid." }, { status: 400 });
      expiresAt = d;
    }

    const created = await db.evacuationAnnouncement.create({
      data: {
        title,
        message,
        priority,
        targetBarangays: targetBarangays.length ? targetBarangays.join(",") : null,
        targetCenterIds: JSON.stringify(targetCenterIds),
        status,
        publishAt,
        expiresAt,
        pushSent: body.pushSent === true,
        createdBy: session.admin.id,
        createdByName: session.admin.name,
      },
    });
    await logAudit({
      actorType: "ADMIN",
      actorName: session.admin.name,
      action: "EVAC_ANNOUNCEMENT_PUBLISHED",
      detail: `${status} "${title}" [${priority}]${targetBarangays.length ? ` — ${targetBarangays.join(", ")}` : ""}`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ announcement: toEvacAnnouncementDTO(created) }, { status: 201 });
  } catch (e) {
    console.error("evac announcement POST failed", e);
    return NextResponse.json({ error: "Failed to create evacuation announcement." }, { status: 500 });
  }
}
