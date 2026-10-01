import { NextResponse } from "next/server";
import { cached } from "@/lib/qas33/cache";
import { buildHomepageResponse } from "@/lib/qas33/portal-server";

// GET /api/public/homepage — published frontpage configuration for the public
// portal. Mode-aware (sections/widgets already filtered server-side).
// A 15s in-memory cache keeps repeat visits instant; publishing new portal
// content invalidates it immediately (see publishHomepages).
export async function GET() {
  try {
    const response = await cached("public:homepage", 15_000, () => buildHomepageResponse());
    return NextResponse.json(response, { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("public homepage failed", e);
    return NextResponse.json({ ok: false, error: "Homepage configuration could not be loaded." }, { status: 500 });
  }
}
