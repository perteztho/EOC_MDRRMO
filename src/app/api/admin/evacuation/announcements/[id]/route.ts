import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  canDeleteAnnouncements,
  canManageEvacuation,
  getClientIp,
  requireAdmin,
} from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { toEvacAnnouncementDTO } from "@/lib/qas33/evac-service";

// PUT /api/admin/evacuation/announcements/[id] — edit (canManageEvacuation)
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageEvacuation(session.admin.role)) {
    return NextResponse.json({ error: "Only MDRRMO Officers and System Administrators can edit evacuation announcements." }, { status: 403 });
  }
  try {
    const { id } = await ctx.params;
    const existing = await db.evacuationAnnouncement.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    const body = (await request.json()) as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (!t || t.length > 200) return NextResponse.json({ error: "Title is required (max 200 characters)." }, { status: 400 });
      data.title = t;
    }
    if (body.message !== undefined) {
      const m = String(body.message).trim();
      if (!m) return NextResponse.json({ error: "Message is required." }, { status: 400 });
      data.message = m;
    }
    if (body.priority !== undefined && ["NORMAL", "HIGH", "URGENT", "CRITICAL"].includes(String(body.priority))) {
      data.priority = String(body.priority);
    }
    if (body.status !== undefined && ["DRAFT", "SCHEDULED", "PUBLISHED", "EXPIRED", "CANCELLED"].includes(String(body.status))) {
      data.status = String(body.status);
    }
    if (body.targetBarangays !== undefined) {
      const list = Array.isArray(body.targetBarangays)
        ? (body.targetBarangays as unknown[]).map((b) => String(b).trim()).filter(Boolean).slice(0, 33)
        : [];
      data.targetBarangays = list.length ? list.join(",") : null;
    }
    if (body.targetCenterIds !== undefined) {
      const list = Array.isArray(body.targetCenterIds)
        ? (body.targetCenterIds as unknown[]).map((c) => String(c).trim()).filter(Boolean).slice(0, 50)
        : [];
      data.targetCenterIds = JSON.stringify(list);
    }
    if (body.publishAt !== undefined) {
      const d = new Date(String(body.publishAt));
      if (isNaN(d.getTime())) return NextResponse.json({ error: "Publication date is not valid." }, { status: 400 });
      data.publishAt = d;
    }
    if (body.expiresAt !== undefined) {
      data.expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;
    }

    const updated = await db.evacuationAnnouncement.update({ where: { id }, data });
    await logAudit({
      actorType: "ADMIN",
      actorName: session.admin.name,
      action: "EVAC_ANNOUNCEMENT_UPDATED",
      detail: `Updated "${updated.title}" (${updated.status})`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ announcement: toEvacAnnouncementDTO(updated) });
  } catch (e) {
    console.error("evac announcement PUT failed", e);
    return NextResponse.json({ error: "Failed to update evacuation announcement." }, { status: 500 });
  }
}

// DELETE /api/admin/evacuation/announcements/[id] — cancel by default
// (status CANCELLED); hard delete only for canDeleteAnnouncements (SYSTEM_ADMIN).
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageEvacuation(session.admin.role)) {
    return NextResponse.json({ error: "Only MDRRMO Officers and System Administrators can manage evacuation announcements." }, { status: 403 });
  }
  try {
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const hard = url.searchParams.get("hard") === "1" || url.searchParams.get("hard") === "true";
    const existing = await db.evacuationAnnouncement.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });

    if (hard) {
      if (!canDeleteAnnouncements(session.admin.role)) {
        return NextResponse.json(
          { error: "Hard delete is restricted to System Administrators. Use cancel instead." },
          { status: 403 }
        );
      }
      await db.evacuationAnnouncement.delete({ where: { id } });
      await logAudit({
        actorType: "ADMIN",
        actorName: session.admin.name,
        action: "EVAC_ANNOUNCEMENT_DELETED",
        detail: `Hard-deleted "${existing.title}"`,
        ip: getClientIp(request),
      });
      return NextResponse.json({ ok: true, deleted: true });
    }

    if (existing.status === "CANCELLED") {
      return NextResponse.json({ error: "This announcement is already cancelled." }, { status: 400 });
    }
    const updated = await db.evacuationAnnouncement.update({ where: { id }, data: { status: "CANCELLED" } });
    await logAudit({
      actorType: "ADMIN",
      actorName: session.admin.name,
      action: "EVAC_ANNOUNCEMENT_CANCELLED",
      detail: `Cancelled "${updated.title}"`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true, announcement: toEvacAnnouncementDTO(updated) });
  } catch (e) {
    console.error("evac announcement DELETE failed", e);
    return NextResponse.json({ error: "Failed to delete evacuation announcement." }, { status: 500 });
  }
}
