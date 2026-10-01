import { NextResponse } from "next/server";
import { cached } from "@/lib/qas33/cache";
import { listBarangaysPublic } from "@/lib/qas33/frontpage-service";

// Public list of the 33 barangays (slug + identity theme + basic facts).
// Powers the "Barangay Public" selector dialog on the MDRRMO portal.
// 5-minute in-memory cache — the roster is effectively static.

export async function GET() {
  try {
    const barangays = await cached("public:barangays", 300_000, () => listBarangaysPublic());
    return NextResponse.json(
      { ok: true, barangays },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  } catch (e) {
    console.error("public barangays list failed", e);
    return NextResponse.json({ ok: false, error: "Unable to load the barangay list." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
