import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { sanitizeText, sanitizeWidgetConfig, widgetRowToPublic } from "@/lib/qas33/portal-server";

// PATCH  /api/admin/portal/widgets/[id] — update a draft widget
// DELETE /api/admin/portal/widgets/[id] — remove a draft widget

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const row = await db.dashboardWidget.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Widget not found." }, { status: 404 });
    const body = (await request.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof body.title === "string") data.title = sanitizeText(body.title, 80) || row.title;
    if (typeof body.enabled === "boolean") data.enabled = body.enabled;
    if (body.config && typeof body.config === "object") {
      const current = JSON.parse(row.config || "{}");
      data.config = JSON.stringify(sanitizeWidgetConfig({ ...current, ...(body.config as object) }));
    }
    const updated = await db.dashboardWidget.update({ where: { id }, data });
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "PORTAL_WIDGET_UPDATED",
      detail: `${updated.title} (${updated.type})`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true, widget: widgetRowToPublic(updated) });
  } catch (e) {
    console.error("widget PATCH failed", e);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const row = await db.dashboardWidget.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Widget not found." }, { status: 404 });
    await db.dashboardWidget.delete({ where: { id } });
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "PORTAL_WIDGET_DELETED",
      detail: `${row.title} (${row.type})`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("widget DELETE failed", e);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
