import { NextRequest, NextResponse } from "next/server";
import { getClientIp, requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { contentDelegate, validateContentPayload } from "@/lib/qas33/portal-content";
import { getContentTypeDef } from "@/lib/qas33/portal-types";

// PATCH  /api/admin/portal/content/[type]/[id] — update a row
// DELETE /api/admin/portal/content/[type]/[id] — delete a row

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ type: string; id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { type, id } = await ctx.params;
  const def = getContentTypeDef(type);
  const delegate = contentDelegate(type);
  if (!def || !delegate) return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
  try {
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Item not found." }, { status: 404 });
    const payload = (await request.json()) as Record<string, unknown>;
    const { data, errors } = validateContentPayload(type, payload, { partial: true });
    if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    const updated = await delegate.update({ where: { id }, data });
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "PORTAL_CONTENT_UPDATED",
      detail: `${def.label} updated — ${String((updated as Record<string, unknown>).title ?? (updated as Record<string, unknown>).name ?? (updated as Record<string, unknown>).message ?? id)}`.slice(0, 200),
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true, item: updated });
  } catch (e) {
    console.error("content update failed", e);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ type: string; id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { type, id } = await ctx.params;
  const def = getContentTypeDef(type);
  const delegate = contentDelegate(type);
  if (!def || !delegate) return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
  try {
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Item not found." }, { status: 404 });
    await delegate.delete({ where: { id } });
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "PORTAL_CONTENT_DELETED",
      detail: `${def.label} deleted — ${String((existing as Record<string, unknown>).title ?? (existing as Record<string, unknown>).name ?? (existing as Record<string, unknown>).message ?? id)}`.slice(0, 200),
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("content delete failed", e);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
