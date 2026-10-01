import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { hasDraftChanges, publishHomepages, resetHomepage, restoreSnapshot } from "@/lib/qas33/portal-server";

// GET  — publish state: active snapshot + version history + draft-change flag
// POST — actions: { action: "publish" | "restore" | "reset" }

export async function GET() {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [rows, active, dirty] = await Promise.all([
      db.homepageSnapshot.findMany({ orderBy: { version: "desc" }, take: 20 }),
      db.homepageSnapshot.findFirst({ where: { isActive: true } }),
      hasDraftChanges(),
    ]);
    const toInfo = (r: { id: string; version: number; note: string | null; createdAt: Date; isActive: boolean }) => ({
      id: r.id,
      version: r.version,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      isActive: r.isActive,
    });
    return NextResponse.json({
      ok: true,
      active: active ? toInfo(active) : null,
      snapshots: rows.map(toInfo),
      hasDraftChanges: dirty,
    });
  } catch (e) {
    console.error("publish state failed", e);
    return NextResponse.json({ error: "Failed to load publish state." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ip = getClientIp(request);
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "publish");

    if (action === "publish") {
      const note = typeof body.note === "string" ? body.note.slice(0, 200) : null;
      const data = await publishHomepages(note);
      await logAudit({
        actorType: "ADMIN",
        actorName: resolved.admin.name,
        action: "PORTAL_PUBLISHED",
        detail: `Homepage published as version ${data.version}${note ? ` — ${note}` : ""}`,
        ip,
      });
      return NextResponse.json({ ok: true, version: data.version, publishedAt: data.createdAt });
    }

    if (action === "restore") {
      const snapshotId = String(body.snapshotId ?? "");
      const data = await restoreSnapshot(snapshotId);
      if (!data) return NextResponse.json({ error: "Snapshot not found or unreadable." }, { status: 404 });
      await logAudit({
        actorType: "ADMIN",
        actorName: resolved.admin.name,
        action: "PORTAL_RESTORED",
        detail: `Restored homepage configuration (now v${data.version})`,
        ip,
      });
      return NextResponse.json({ ok: true, version: data.version, publishedAt: data.createdAt });
    }

    if (action === "reset") {
      const data = await resetHomepage();
      await logAudit({
        actorType: "ADMIN",
        actorName: resolved.admin.name,
        action: "PORTAL_RESET",
        detail: `Homepage reset to defaults (v${data.version})`,
        ip,
      });
      return NextResponse.json({ ok: true, version: data.version, publishedAt: data.createdAt });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error("publish POST failed", e);
    return NextResponse.json({ error: "Operation failed." }, { status: 500 });
  }
}
