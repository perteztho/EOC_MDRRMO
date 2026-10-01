import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { sanitizeSectionConfig, sanitizeSectionKey, sanitizeText, sectionRowToPublic } from "@/lib/qas33/portal-server";

// PATCH  /api/admin/portal/sections/[id] — update a draft section
// DELETE /api/admin/portal/sections/[id] — remove a draft section

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const row = await db.homepageSection.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Section not found." }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if (typeof body.name === "string") data.name = sanitizeText(body.name, 100) || row.name;
    if (typeof body.heading === "string") data.heading = sanitizeText(body.heading, 200);
    if ("subtitle" in body) data.subtitle = sanitizeText(body.subtitle, 200) || null;
    if ("description" in body) data.description = sanitizeText(body.description, 600) || null;
    if (typeof body.status === "string" && ["ACTIVE", "HIDDEN", "DRAFT"].includes(body.status)) data.status = body.status;
    if (typeof body.sectionKey === "string") {
      const key = sanitizeSectionKey(body.sectionKey);
      if (key && key !== row.sectionKey) {
        const clash = await db.homepageSection.findUnique({ where: { sectionKey: key } });
        if (clash) return NextResponse.json({ error: `Section ID "${key}" is already in use.` }, { status: 400 });
        data.sectionKey = key;
      }
    }
    if (body.config && typeof body.config === "object") {
      const current = JSON.parse(row.config || "{}");
      data.config = JSON.stringify(sanitizeSectionConfig({ ...current, ...(body.config as object) }));
    }
    if (typeof body.displayOrder === "number") data.displayOrder = Math.max(1, Math.round(body.displayOrder));

    const updated = await db.homepageSection.update({ where: { id }, data });
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "PORTAL_SECTION_UPDATED",
      detail: `${updated.name} (key=${updated.sectionKey})`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true, section: sectionRowToPublic(updated) });
  } catch (e) {
    console.error("section PATCH failed", e);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const row = await db.homepageSection.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Section not found." }, { status: 404 });
    if (row.template === "hero") {
      return NextResponse.json({ error: "The hero section cannot be deleted. Hide it instead." }, { status: 400 });
    }
    await db.homepageSection.delete({ where: { id } });
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "PORTAL_SECTION_DELETED",
      detail: `${row.name} (key=${row.sectionKey})`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("section DELETE failed", e);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
