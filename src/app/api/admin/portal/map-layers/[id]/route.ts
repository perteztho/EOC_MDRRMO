import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { sanitizeHexColor, sanitizeText } from "@/lib/qas33/portal-server";

// PUT    /api/admin/portal/map-layers/[id] — update name / visibility / colors / notes
// DELETE /api/admin/portal/map-layers/[id] — remove a layer

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const row = await db.mapOverlay.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Map layer not found." }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") {
      const name = sanitizeText(body.name, 80);
      if (!name) return NextResponse.json({ error: "Layer name cannot be empty." }, { status: 400 });
      data.name = name;
    }
    if (typeof body.visible === "boolean") data.visible = body.visible;
    if ("strokeColor" in body) data.strokeColor = sanitizeHexColor(body.strokeColor) || null;
    if ("fillColor" in body) data.fillColor = sanitizeHexColor(body.fillColor) || null;
    if ("notes" in body) data.notes = sanitizeText(body.notes, 600) || null;

    const updated = await db.mapOverlay.update({ where: { id }, data });
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "PORTAL_MAP_LAYER_UPDATED",
      detail: `${updated.name} (visible=${updated.visible})`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("map layer update failed", e);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const row = await db.mapOverlay.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Map layer not found." }, { status: 404 });
    await db.mapOverlay.delete({ where: { id } });
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "PORTAL_MAP_LAYER_DELETED",
      detail: `${row.name} (${row.kind}, ${row.featureCount} features)`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("map layer delete failed", e);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
