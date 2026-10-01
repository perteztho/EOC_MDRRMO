import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { sanitizeHexColor, sanitizeText } from "@/lib/qas33/portal-server";
import { validateGeoJson } from "@/lib/qas33/map-overlays";

// GET  — list ALL map overlay layers (admin; geojson excluded to stay light)
// POST — upload a new layer (GeoJSON payload; KML is converted client-side)
// PUT  — reorder layers { order: string[] }

export async function GET() {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await db.mapOverlay.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({
      ok: true,
      layers: rows.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        featureCount: r.featureCount,
        strokeColor: r.strokeColor,
        fillColor: r.fillColor,
        visible: r.visible,
        displayOrder: r.displayOrder,
        fileName: r.fileName,
        fileSize: r.fileSize,
        notes: r.notes,
        createdByName: r.createdByName,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("list map layers failed", e);
    return NextResponse.json({ error: "Failed to load map layers." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ip = getClientIp(request);
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const name = sanitizeText(body.name, 80);
    if (!name) return NextResponse.json({ error: "A layer name is required (max 80 characters)." }, { status: 400 });

    const kind = String(body.kind ?? "geojson");
    if (kind !== "geojson" && kind !== "kml") {
      return NextResponse.json({ error: 'Layer kind must be "geojson" or "kml".' }, { status: 400 });
    }

    const check = validateGeoJson(body.geojson);
    if (!check.ok) return NextResponse.json({ error: `Invalid overlay data: ${check.error}` }, { status: 400 });

    const strokeColor = sanitizeHexColor(body.strokeColor) || null;
    const fillColor = sanitizeHexColor(body.fillColor) || null;
    const notes = sanitizeText(body.notes, 600) || null;
    const fileName = sanitizeText(body.fileName, 200) || null;
    const fileSize = typeof body.fileSize === "number" && Number.isFinite(body.fileSize)
      ? Math.max(0, Math.round(body.fileSize))
      : 0;

    const count = await db.mapOverlay.count();
    const row = await db.mapOverlay.create({
      data: {
        name,
        kind,
        geojson: JSON.stringify(check.fc),
        featureCount: check.featureCount,
        strokeColor,
        fillColor,
        visible: true,
        displayOrder: count,
        fileName,
        fileSize,
        notes,
        createdByName: resolved.admin.name,
      },
    });
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "PORTAL_MAP_LAYER_UPLOADED",
      detail: `${name} (${kind}, ${check.featureCount} features)`,
      ip,
    });
    return NextResponse.json({ ok: true, id: row.id, featureCount: row.featureCount });
  } catch (e) {
    console.error("map layer upload failed", e);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ip = getClientIp(request);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const ids = Array.isArray(body.order) ? body.order.map((x) => String(x)) : [];
    if (!ids.length) return NextResponse.json({ error: "order (array of layer ids) is required." }, { status: 400 });

    const rows = await db.mapOverlay.findMany();
    const known = new Set(rows.map((r) => r.id));
    const validIds = ids.filter((id) => known.has(id));
    for (let i = 0; i < validIds.length; i++) {
      await db.mapOverlay.update({ where: { id: validIds[i] }, data: { displayOrder: i } });
    }
    const missing = rows.filter((r) => !validIds.includes(r.id)).sort((a, b) => a.displayOrder - b.displayOrder);
    for (let i = 0; i < missing.length; i++) {
      await db.mapOverlay.update({ where: { id: missing[i].id }, data: { displayOrder: validIds.length + i } });
    }
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "PORTAL_MAP_LAYERS_REORDERED",
      detail: `${validIds.length} layers reordered`,
      ip,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("map layers reorder failed", e);
    return NextResponse.json({ error: "Reorder failed." }, { status: 500 });
  }
}
