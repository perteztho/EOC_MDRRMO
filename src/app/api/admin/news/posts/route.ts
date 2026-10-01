import { NextRequest, NextResponse } from "next/server";
import { canPublishNews, requireAdmin } from "@/lib/qas33/auth";
import { listNewsPosts, savePost } from "@/lib/qas33/news-service";
import { sanitizeRichText } from "@/lib/qas33/rich-text";
import type { NewsPostInput } from "@/lib/qas33/emergency-types";

// GET /api/admin/news/posts?status=&category=&search=&page=&pageSize= — any role
export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const featured = url.searchParams.get("featured");
    const emergency = url.searchParams.get("emergency");
    const result = await listNewsPosts({
      status: url.searchParams.get("status") || undefined,
      category: url.searchParams.get("category") || undefined,
      search: url.searchParams.get("search") || undefined,
      page: Number(url.searchParams.get("page") || 1),
      pageSize: Number(url.searchParams.get("pageSize") || 10),
      featured: featured === null || featured === "" ? undefined : featured === "true" || featured === "1",
      emergency: emergency === null || emergency === "" ? undefined : emergency === "true" || emergency === "1",
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("admin news GET failed", e);
    return NextResponse.json({ error: "Failed to load news posts." }, { status: 500 });
  }
}

// POST /api/admin/news/posts — create a post (canPublishNews)
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPublishNews(session.admin.role)) {
    return NextResponse.json({ error: "Only MDRRMO Officers and System Administrators can publish news." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as NewsPostInput;
    // sanitize before any persistence (also applied inside savePost)
    body.content = sanitizeRichText(body.content, 60000);
    const post = await savePost({
      data: body,
      actor: { id: session.admin.id, name: session.admin.name },
      action: "NEWS_POST_CREATED",
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create news post.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
