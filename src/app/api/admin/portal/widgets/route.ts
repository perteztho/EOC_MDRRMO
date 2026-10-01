import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { sanitizeText, sanitizeWidgetConfig, widgetRowToPublic } from "@/lib/qas33/portal-server";
import { WIDGET_TYPES } from "@/lib/qas33/portal-types";
import type { WidgetType } from "@/lib/qas33/portal-types";

// GET  — list draft dashboard widgets (+ widget type metadata)
// POST — actions: { action: "create" | "reorder" | "reset" }

export async function GET() {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await db.dashboardWidget.findMany({ orderBy: { displayOrder: "asc" } });
    return NextResponse.json({
      ok: true,
      widgets: rows.map((r) => ({ ...widgetRowToPublic(r), updatedAt: r.updatedAt.toISOString() })),
      types: WIDGET_TYPES,
    });
  } catch (e) {
    console.error("list widgets failed", e);
    return NextResponse.json({ error: "Failed to load widgets." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ip = getClientIp(request);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "create");

    if (action === "create") {
      const type = String(body.type ?? "") as WidgetType;
      const meta = WIDGET_TYPES.find((t) => t.type === type);
      if (!meta) return NextResponse.json({ error: "Unknown widget type." }, { status: 400 });
      const count = await db.dashboardWidget.count();
      let key = `w-${type}-${Date.now().toString(36).slice(-4)}`;
      while (await db.dashboardWidget.findUnique({ where: { widgetKey: key } })) {
        key = `w-${type}-${Date.now().toString(36).slice(-4)}${Math.floor(Math.random() * 100)}`;
      }
      const title = sanitizeText(body.title, 80) || meta.name;
      // Type-aware starting config — custom widgets start wide + deployable
      // with the layout-template icon so the public card renders immediately.
      const baseConfig: Record<string, unknown> =
        type === "custom"
          ? {
              size: "wide",
              refreshSec: 120,
              icon: "layout-template",
              theme: "blue",
              cardStyle: "glass",
              bodyText: "",
              blocks: [],
              deployable: true,
            }
          : { size: "small", refreshSec: 120 };
      const row = await db.dashboardWidget.create({
        data: {
          widgetKey: key,
          type,
          title,
          displayOrder: count + 1,
          enabled: true,
          config: JSON.stringify(sanitizeWidgetConfig(baseConfig)),
        },
      });
      await logAudit({ actorType: "ADMIN", actorName: resolved.admin.name, action: "PORTAL_WIDGET_CREATED", detail: `${title} (${type})`, ip });
      return NextResponse.json({ ok: true, widget: widgetRowToPublic(row) });
    }

    if (action === "reorder") {
      const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x)) : [];
      if (!ids.length) return NextResponse.json({ error: "ids is required." }, { status: 400 });
      const rows = await db.dashboardWidget.findMany();
      const known = new Set(rows.map((r) => r.id));
      const validIds = ids.filter((id) => known.has(id));
      for (let i = 0; i < validIds.length; i++) {
        await db.dashboardWidget.update({ where: { id: validIds[i] }, data: { displayOrder: i + 1 } });
      }
      const missing = rows.filter((r) => !validIds.includes(r.id)).sort((a, b) => a.displayOrder - b.displayOrder);
      for (let i = 0; i < missing.length; i++) {
        await db.dashboardWidget.update({ where: { id: missing[i].id }, data: { displayOrder: validIds.length + i + 1 } });
      }
      await logAudit({ actorType: "ADMIN", actorName: resolved.admin.name, action: "PORTAL_WIDGETS_REORDERED", detail: `${validIds.length} widgets reordered`, ip });
      return NextResponse.json({ ok: true });
    }

    if (action === "reset") {
      await db.dashboardWidget.deleteMany({});
      const { DEFAULT_WIDGETS } = await import("@/lib/qas33/portal-defaults");
      for (let i = 0; i < DEFAULT_WIDGETS.length; i++) {
        const def = DEFAULT_WIDGETS[i];
        await db.dashboardWidget.create({
          data: {
            widgetKey: def.key,
            type: def.type,
            title: def.title,
            displayOrder: i + 1,
            enabled: def.enabled ?? true,
            config: JSON.stringify(def.config),
          },
        });
      }
      await logAudit({ actorType: "ADMIN", actorName: resolved.admin.name, action: "PORTAL_WIDGETS_RESET", detail: "Dashboard widgets reset to defaults", ip });
      const rows = await db.dashboardWidget.findMany({ orderBy: { displayOrder: "asc" } });
      return NextResponse.json({ ok: true, widgets: rows.map(widgetRowToPublic) });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error("widgets POST failed", e);
    return NextResponse.json({ error: "Operation failed." }, { status: 500 });
  }
}
