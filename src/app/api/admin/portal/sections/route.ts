import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { getClientIp } from "@/lib/qas33/auth";
import {
  sanitizeSectionKey,
  sanitizeText,
  sectionRowToPublic,
  templateDefaultConfig,
} from "@/lib/qas33/portal-server";
import { SECTION_TEMPLATES } from "@/lib/qas33/portal-types";
import type { SectionTemplate } from "@/lib/qas33/portal-types";

// GET  — list draft sections (+ template library metadata)
// POST — actions: { action: "create" | "reorder" | "duplicate" | "reset" }

export async function GET() {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await db.homepageSection.findMany({ orderBy: { displayOrder: "asc" } });
    return NextResponse.json({
      ok: true,
      sections: rows.map((r) => ({ ...sectionRowToPublic(r), updatedAt: r.updatedAt.toISOString() })),
      templates: SECTION_TEMPLATES,
    });
  } catch (e) {
    console.error("list sections failed", e);
    return NextResponse.json({ error: "Failed to load sections." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = resolved.admin.name;
  const ip = getClientIp(request);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "create");

    if (action === "create") {
      const template = String(body.template ?? "") as SectionTemplate;
      const meta = SECTION_TEMPLATES.find((t) => t.template === template);
      if (!meta) return NextResponse.json({ error: "Unknown section template." }, { status: 400 });
      const count = await db.homepageSection.count();
      const baseKey = sanitizeSectionKey(body.key) || `${template}-${Date.now().toString(36).slice(-4)}`;
      let key = baseKey;
      let n = 2;
      while (await db.homepageSection.findUnique({ where: { sectionKey: key } })) {
        key = `${baseKey}-${n++}`;
      }
      const name = sanitizeText(body.name, 100) || meta.name;
      const row = await db.homepageSection.create({
        data: {
          sectionKey: key,
          template,
          name,
          heading: sanitizeText(body.heading, 200) || meta.name,
          subtitle: sanitizeText(body.subtitle, 200) || null,
          description: null,
          status: "ACTIVE",
          displayOrder: count + 1,
          config: JSON.stringify(templateDefaultConfig(template)),
        },
      });
      await logAudit({ actorType: "ADMIN", actorName: actor, action: "PORTAL_SECTION_CREATED", detail: `${name} (${template}) key=${key}`, ip });
      return NextResponse.json({ ok: true, section: sectionRowToPublic(row) });
    }

    if (action === "reorder") {
      const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x)) : [];
      if (!ids.length) return NextResponse.json({ error: "ids is required." }, { status: 400 });
      const rows = await db.homepageSection.findMany();
      const known = new Set(rows.map((r) => r.id));
      const validIds = ids.filter((id) => known.has(id));
      for (let i = 0; i < validIds.length; i++) {
        await db.homepageSection.update({ where: { id: validIds[i] }, data: { displayOrder: i + 1 } });
      }
      // any sections not in the list keep their relative order at the end
      const missing = rows.filter((r) => !validIds.includes(r.id)).sort((a, b) => a.displayOrder - b.displayOrder);
      for (let i = 0; i < missing.length; i++) {
        await db.homepageSection.update({ where: { id: missing[i].id }, data: { displayOrder: validIds.length + i + 1 } });
      }
      await logAudit({ actorType: "ADMIN", actorName: actor, action: "PORTAL_SECTIONS_REORDERED", detail: `${validIds.length} sections reordered`, ip });
      return NextResponse.json({ ok: true });
    }

    if (action === "duplicate") {
      const id = String(body.id ?? "");
      const row = await db.homepageSection.findUnique({ where: { id } });
      if (!row) return NextResponse.json({ error: "Section not found." }, { status: 404 });
      const count = await db.homepageSection.count();
      let key = `${row.sectionKey}-copy`;
      let n = 2;
      while (await db.homepageSection.findUnique({ where: { sectionKey: key } })) {
        key = `${row.sectionKey}-copy-${n++}`;
      }
      const copy = await db.homepageSection.create({
        data: {
          sectionKey: key,
          template: row.template,
          name: `${row.name} (Copy)`,
          heading: row.heading,
          subtitle: row.subtitle,
          description: row.description,
          status: "DRAFT",
          displayOrder: count + 1,
          config: row.config,
        },
      });
      await logAudit({ actorType: "ADMIN", actorName: actor, action: "PORTAL_SECTION_DUPLICATED", detail: `${row.name} → ${key}`, ip });
      return NextResponse.json({ ok: true, section: sectionRowToPublic(copy) });
    }

    if (action === "reset") {
      const id = String(body.id ?? "");
      const row = await db.homepageSection.findUnique({ where: { id } });
      if (!row) return NextResponse.json({ error: "Section not found." }, { status: 404 });
      const meta = SECTION_TEMPLATES.find((t) => t.template === row.template);
      const updated = await db.homepageSection.update({
        where: { id },
        data: {
          config: JSON.stringify(templateDefaultConfig(row.template as SectionTemplate)),
          heading: meta ? meta.name : row.heading,
        },
      });
      await logAudit({ actorType: "ADMIN", actorName: actor, action: "PORTAL_SECTION_RESET", detail: `${row.name} reset to template defaults`, ip });
      return NextResponse.json({ ok: true, section: sectionRowToPublic(updated) });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error("sections POST failed", e);
    return NextResponse.json({ error: "Operation failed." }, { status: 500 });
  }
}

// PATCH body fields are validated through sanitizeSectionConfig
