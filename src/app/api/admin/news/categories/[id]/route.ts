import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  canDeleteAnnouncements,
  canPublishNews,
  getClientIp,
  requireAdmin,
} from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { toNewsCategoryDTO } from "@/lib/qas33/news-service";

// PUT /api/admin/news/categories/[id] — edit (canPublishNews)
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPublishNews(session.admin.role)) {
    return NextResponse.json({ error: "Only MDRRMO Officers and System Administrators can manage news categories." }, { status: 403 });
  }
  try {
    const { id } = await ctx.params;
    const existing = await db.newsCategory.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Category not found." }, { status: 404 });
    const body = (await request.json()) as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const n = String(body.name).trim();
      if (!n) return NextResponse.json({ error: "Category name is required." }, { status: 400 });
      data.name = n.slice(0, 120);
    }
    if (body.description !== undefined) {
      data.description = body.description ? String(body.description).trim().slice(0, 400) : null;
    }
    if (body.color !== undefined) data.color = String(body.color).trim().slice(0, 40) || "gov-blue";
    if (body.emergency !== undefined) data.emergency = body.emergency === true;
    if (body.active !== undefined) data.active = body.active !== false;
    if (body.displayOrder !== undefined && Number.isFinite(Number(body.displayOrder))) {
      data.displayOrder = Math.max(0, Math.round(Number(body.displayOrder)));
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

    const updated = await db.newsCategory.update({ where: { id }, data });
    await logAudit({
      actorType: "ADMIN",
      actorName: session.admin.name,
      action: "NEWS_CATEGORY_UPDATED",
      detail: `${updated.key} — ${updated.name}`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ category: toNewsCategoryDTO(updated) });
  } catch (e) {
    console.error("news category PUT failed", e);
    return NextResponse.json({ error: "Failed to update news category." }, { status: 500 });
  }
}

// DELETE /api/admin/news/categories/[id] — blocked while posts reference it
// (400). Requires canDeleteAnnouncements (SYSTEM_ADMIN).
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canDeleteAnnouncements(session.admin.role)) {
    return NextResponse.json(
      { error: "Deleting news categories is restricted to System Administrators." },
      { status: 403 }
    );
  }
  try {
    const { id } = await ctx.params;
    const existing = await db.newsCategory.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Category not found." }, { status: 404 });
    const refCount = await db.newsArticle.count({ where: { category: existing.key } });
    if (refCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete "${existing.name}" — ${refCount} news post(s) still reference it. Reassign or archive them first.` },
        { status: 400 }
      );
    }
    await db.newsCategory.delete({ where: { id } });
    await logAudit({
      actorType: "ADMIN",
      actorName: session.admin.name,
      action: "NEWS_CATEGORY_DELETED",
      detail: `${existing.key} — ${existing.name}`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("news category DELETE failed", e);
    return NextResponse.json({ error: "Failed to delete news category." }, { status: 500 });
  }
}
