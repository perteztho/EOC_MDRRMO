import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";

// GET — all tutorials (both languages, for management)
export async function GET() {
  const resolved = await requireAdminRole(["SYSTEM_ADMIN"]);
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Only the System Administrator can manage tutorials." }, { status: 403 });
  }
  const tutorials = await db.tutorial.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ tutorials });
}

// PUT — update a tutorial { key, titleEn?, titleTl?, bodyEn?, bodyTl?, active? }
export async function PUT(request: NextRequest) {
  const resolved = await requireAdminRole(["SYSTEM_ADMIN"]);
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Only the System Administrator can manage tutorials." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const key = String(body.key || "");
  const tutorial = await db.tutorial.findUnique({ where: { key } });
  if (!tutorial) return NextResponse.json({ error: "Tutorial not found." }, { status: 404 });

  await db.tutorial.update({
    where: { key },
    data: {
      titleEn: body.titleEn !== undefined ? String(body.titleEn).slice(0, 200) : undefined,
      titleTl: body.titleTl !== undefined ? String(body.titleTl).slice(0, 200) : undefined,
      bodyEn: body.bodyEn !== undefined ? String(body.bodyEn).slice(0, 20000) : undefined,
      bodyTl: body.bodyTl !== undefined ? String(body.bodyTl).slice(0, 20000) : undefined,
      active: body.active !== undefined ? !!body.active : undefined,
    },
  });
  await logAudit({ actorType: "ADMIN", actorName: resolved.admin.name, action: "TUTORIAL_UPDATED", detail: `Updated tutorial '${key}'` });
  return NextResponse.json({ ok: true });
}
