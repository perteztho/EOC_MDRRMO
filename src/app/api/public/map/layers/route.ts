import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/public/map/layers — published map overlay layers for the public
// satellite map section (no login; mirrors /api/public/evacuation).

export async function GET() {
  try {
    const rows = await db.mapOverlay.findMany({
      where: { visible: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    const overlays = rows.map((r) => {
      let geojson: unknown = null;
      try {
        geojson = JSON.parse(r.geojson);
      } catch {
        geojson = null; // skip malformed rows defensively
      }
      return {
        id: r.id,
        name: r.name,
        kind: r.kind,
        strokeColor: r.strokeColor,
        fillColor: r.fillColor,
        featureCount: r.featureCount,
        geojson,
      };
    });
    // no-store: admin uploads / visibility toggles must appear on the public
    // map immediately (an SWR window would serve a stale layer list).
    return NextResponse.json(
      { ok: true, overlays: overlays.filter((o) => o.geojson !== null) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("public map layers failed", e);
    return NextResponse.json({ error: "Failed to load map layers." }, { status: 500 });
  }
}
