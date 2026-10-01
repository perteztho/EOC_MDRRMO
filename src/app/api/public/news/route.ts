import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cached } from "@/lib/qas33/cache";
import { listNewsPosts, toNewsCategoryDTO } from "@/lib/qas33/news-service";
import type { NewsCategoryDTO } from "@/lib/qas33/emergency-types";

// GET /api/public/news?category=&search=&page=&pageSize=1..24&featured=
// Public listing — published, unexpired, audience ALL/RESIDENTS. Emergency
// posts float to the top of the default (unfiltered) listing.
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
    const pageSizeRaw = Number(url.searchParams.get("pageSize") || 9);
    const pageSize = Math.min(24, Math.max(1, Number.isFinite(pageSizeRaw) ? pageSizeRaw : 9));
    const featured = url.searchParams.get("featured");
    const category = url.searchParams.get("category") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const featuredFlag =
      featured === null || featured === "" ? undefined : featured === "true" || featured === "1";

    // Cache the default listing (first page, no search) — the hot path.
    const cacheable = page === 1 && !search && category === undefined && featuredFlag === undefined;

    const load = async () => {
      const [result, categories] = await Promise.all([
        listNewsPosts({
          category,
          search,
          featured: featuredFlag,
          page,
          pageSize,
          publicOnly: true,
        }),
        db.newsCategory.findMany({
          where: { active: true },
          orderBy: [{ displayOrder: "asc" }, { key: "asc" }],
        }),
      ]);
      return { result, categories };
    };

    const { result, categories } = cacheable
      ? await cached("public:news:default", 30_000, load)
      : await load();

    const categoryDTOs: NewsCategoryDTO[] = categories.map(toNewsCategoryDTO);
    return NextResponse.json({
      posts: result.posts,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: page * pageSize < result.total,
      categories: categoryDTOs,
    });
  } catch (e) {
    console.error("public news GET failed", e);
    return NextResponse.json({ error: "Public news could not be loaded." }, { status: 500 });
  }
}
