import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canPublishNews, getClientIp, requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { toNewsCategoryDTO } from "@/lib/qas33/news-service";

// GET /api/admin/news/categories — list + per-key post counts (any role)
export async function GET() {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [categories, posts] = await Promise.all([
      db.newsCategory.findMany({ orderBy: [{ displayOrder: "asc" }, { key: "asc" }] }),
      db.newsArticle.groupBy({ by: ["category"], _count: { _all: true } }),
    ]);
    const counts: Record<string, number> = {};
    for (const g of posts) counts[g.category] = g._count._all;
    return NextResponse.json({
      categories: categories.map(toNewsCategoryDTO),
      counts,
    });
  } catch (e) {
    console.error("news categories GET failed", e);
    return NextResponse.json({ error: "Failed to load news categories." }, { status: 500 });
  }
}

// POST /api/admin/news/categories — create (canPublishNews)
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPublishNews(session.admin.role)) {
    return NextResponse.json({ error: "Only MDRRMO Officers and System Administrators can manage news categories." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const key = String(body.key ?? "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const name = String(body.name ?? "").trim();
    if (!key) return NextResponse.json({ error: "Category key is required (A-Z, 0-9, underscore)." }, { status: 400 });
    if (key.length > 60) return NextResponse.json({ error: "Category key must be at most 60 characters." }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    const dupe = await db.newsCategory.findUnique({ where: { key } });
    if (dupe) return NextResponse.json({ error: `A category with key ${key} already exists.` }, { status: 400 });

    const created = await db.newsCategory.create({
      data: {
        key,
        name,
        description: body.description ? String(body.description).trim().slice(0, 400) : null,
        color: body.color ? String(body.color).trim().slice(0, 40) : "gov-blue",
        emergency: body.emergency === true,
        displayOrder: Number.isFinite(Number(body.displayOrder)) ? Math.max(0, Math.round(Number(body.displayOrder))) : 99,
        active: body.active !== false,
      },
    });
    await logAudit({
      actorType: "ADMIN",
      actorName: session.admin.name,
      action: "NEWS_CATEGORY_CREATED",
      detail: `${created.key} — ${created.name}`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ category: toNewsCategoryDTO(created) }, { status: 201 });
  } catch (e) {
    console.error("news category POST failed", e);
    return NextResponse.json({ error: "Failed to create news category." }, { status: 500 });
  }
}
