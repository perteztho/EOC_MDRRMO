import { NextRequest, NextResponse } from "next/server";
import { getPublicNewsPost } from "@/lib/qas33/news-service";

// GET /api/public/news/[id] — published post detail + related posts (404 for
// drafts/expired/officials-only posts).
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const result = await getPublicNewsPost(id);
    if (!result) {
      return NextResponse.json({ error: "News post not found." }, { status: 404 });
    }
    return NextResponse.json({ post: result.post, related: result.related });
  } catch (e) {
    console.error("public news detail GET failed", e);
    return NextResponse.json({ error: "News post could not be loaded." }, { status: 500 });
  }
}
