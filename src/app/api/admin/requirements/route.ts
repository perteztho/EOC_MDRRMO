import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, requireAdminRole } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";

// GET — template/references configuration (both languages + upload settings)
export async function GET() {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sections = await db.templateSection.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({
    sections: sections.map((s) => ({
      key: s.key,
      order: s.order,
      titleEn: s.titleEn,
      titleTl: s.titleTl,
      descEn: s.descEn,
      descTl: s.descTl,
      requiresUpload: s.requiresUpload,
      uploadLabelEn: s.uploadLabelEn,
      uploadLabelTl: s.uploadLabelTl,
      uploadFormats: s.uploadFormats.split(","),
      uploadMaxMB: s.uploadMaxMB,
      required: s.required,
      active: s.active,
      fieldCount: (JSON.parse(s.fieldsJson || "[]") as unknown[]).length,
    })),
  });
}

// PUT — update a section's configuration (SYSTEM_ADMIN only — references are configured by the System Administrator)
export async function PUT(request: NextRequest) {
  const resolved = await requireAdminRole(["SYSTEM_ADMIN"]);
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Only the System Administrator can configure the references." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const key = String(body.key || "");
  const section = await db.templateSection.findUnique({ where: { key } });
  if (!section) return NextResponse.json({ error: "Section not found." }, { status: 404 });

  await db.templateSection.update({
    where: { key },
    data: {
      titleEn: body.titleEn !== undefined ? String(body.titleEn).slice(0, 200) : undefined,
      titleTl: body.titleTl !== undefined ? String(body.titleTl).slice(0, 200) : undefined,
      required: body.required !== undefined ? !!body.required : undefined,
      requiresUpload: body.requiresUpload !== undefined ? !!body.requiresUpload : undefined,
      uploadFormats: body.uploadFormats !== undefined
        ? Array.isArray(body.uploadFormats)
          ? body.uploadFormats.join(",")
          : String(body.uploadFormats)
        : undefined,
      uploadMaxMB: body.uploadMaxMB !== undefined ? Math.max(1, Math.min(50, Number(body.uploadMaxMB) || 10)) : undefined,
    },
  });
  await logAudit({
    actorType: "ADMIN",
    actorName: resolved.admin.name,
    action: "REQUIREMENTS_UPDATED",
    detail: `Updated requirement configuration for section '${key}'`,
  });
  return NextResponse.json({ ok: true });
}
