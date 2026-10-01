import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  canDeleteAnnouncements,
  canPublishNews,
  getClientIp,
  requireAdmin,
} from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { publishPost, savePost, toNewsPostDTO, getNewsCategoryMap } from "@/lib/qas33/news-service";
import { sanitizeRichText } from "@/lib/qas33/rich-text";
import type { NewsPostInput } from "@/lib/qas33/emergency-types";

// PUT /api/admin/news/posts/[id] — update (canPublishNews). Body may contain
// { action: "publish" } to publish the post immediately.
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPublishNews(session.admin.role)) {
    return NextResponse.json({ error: "Only MDRRMO Officers and System Administrators can edit news." }, { status: 403 });
  }
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as Partial<NewsPostInput> & { action?: string };
    if (body.action === "publish") {
      const post = await publishPost({ id, actor: { id: session.admin.id, name: session.admin.name } });
      return NextResponse.json({ post });
    }
    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    if (body.content !== undefined) body.content = sanitizeRichText(body.content, 60000);
    const post = await savePost({
      id,
      data: body as NewsPostInput,
      actor: { id: session.admin.id, name: session.admin.name },
      action: "NEWS_POST_UPDATED",
    });
    return NextResponse.json({ post });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update news post.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/admin/news/posts/[id] — soft archive (canPublishNews);
// ?hard=1 hard-deletes but only for canDeleteAnnouncements (SYSTEM_ADMIN).
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPublishNews(session.admin.role)) {
    return NextResponse.json({ error: "Only MDRRMO Officers and System Administrators can archive news." }, { status: 403 });
  }
  try {
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const hard = url.searchParams.get("hard") === "1" || url.searchParams.get("hard") === "true";
    const existing = await db.newsArticle.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "News post not found." }, { status: 404 });

    if (hard) {
      if (!canDeleteAnnouncements(session.admin.role)) {
        return NextResponse.json(
          { error: "Hard delete is restricted to System Administrators. Archiving is available instead." },
          { status: 403 }
        );
      }
      await db.newsArticle.delete({ where: { id } });
      await logAudit({
        actorType: "ADMIN",
        actorName: session.admin.name,
        action: "NEWS_POST_DELETED",
        detail: `Hard-deleted "${existing.title}"`,
        ip: getClientIp(request),
      });
      return NextResponse.json({ ok: true, deleted: true });
    }

    const updated = await db.newsArticle.update({ where: { id }, data: { status: "ARCHIVED" } });
    await logAudit({
      actorType: "ADMIN",
      actorName: session.admin.name,
      action: "NEWS_POST_ARCHIVED",
      detail: `Archived "${existing.title}"`,
      ip: getClientIp(request),
    });
    const categoryMap = await getNewsCategoryMap();
    return NextResponse.json({ ok: true, post: toNewsPostDTO(updated, categoryMap) });
  } catch (e) {
    console.error("news DELETE failed", e);
    return NextResponse.json({ error: "Failed to delete news post." }, { status: 500 });
  }
}
