import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { contentDelegate, validateContentPayload } from "@/lib/qas33/portal-content";
import { getContentTypeDef } from "@/lib/qas33/portal-types";

// GET  /api/admin/portal/content/[type] — list all rows (incl. drafts/hidden)
// POST /api/admin/portal/content/[type] — create a row

export async function GET(_request: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { type } = await ctx.params;
  const def = getContentTypeDef(type);
  const delegate = contentDelegate(type);
  if (!def || !delegate) return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
  try {
    const rows = await delegate.findMany({});
    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    console.error("content list failed", e);
    return NextResponse.json({ error: "Failed to load content." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { type } = await ctx.params;
  const def = getContentTypeDef(type);
  const delegate = contentDelegate(type);
  if (!def || !delegate) return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const { data, errors } = validateContentPayload(type, payload);
    if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    const created = await delegate.create({ data });
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "PORTAL_CONTENT_CREATED",
      detail: `${def.label} created — ${String((created as Record<string, unknown>).title ?? (created as Record<string, unknown>).name ?? (created as Record<string, unknown>).message ?? type)}`.slice(0, 200),
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true, item: created });
  } catch (e) {
    console.error("content create failed", e);
    return NextResponse.json({ error: "Creation failed." }, { status: 500 });
  }
}
