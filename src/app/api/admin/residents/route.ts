import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, requireAdmin, requireAdminRole } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";

// GET  /api/admin/residents?q=&barangayId=&status=&page=&pageSize= — list resident accounts
// PUT  /api/admin/residents { id, status } — set status (SYSTEM_ADMIN / MDRRMO_OFFICER)

const STATUSES = ["ACTIVE", "PENDING", "SUSPENDED", "REJECTED"];

export async function GET(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const status = (url.searchParams.get("status") ?? "").trim().toUpperCase();
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get("pageSize")) || 25));

    // Barangay filter — accepts a barangay id (barangayId=) or a barangay
    // name / code via the generic barangay= alias (resolved below).
    let barangayId = (url.searchParams.get("barangayId") ?? "").trim();
    const barangayAlias = (url.searchParams.get("barangay") ?? "").trim();
    if (!barangayId && barangayAlias) {
      const b = await db.barangay.findUnique({ where: { code: barangayAlias } });
      barangayId = b?.id ?? "";
      if (!barangayId) {
        // match by name (SQLite has no mode:"insensitive")
        const all = await db.barangay.findMany();
        barangayId = all.find((x) => x.name.toLowerCase() === barangayAlias.toLowerCase())?.id ?? "";
      }
    }

    const where: Record<string, unknown> = {};
    const baseWhere: Record<string, unknown> = {}; // filters minus status — powers the per-status counts
    if (q) {
      // SQLite contains is case-insensitive for ASCII.
      where.OR = [
        { fullName: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
      ];
      baseWhere.OR = where.OR;
    }
    if (barangayId) {
      where.barangayId = barangayId;
      baseWhere.barangayId = barangayId;
    }
    if (status && STATUSES.includes(status)) where.status = status;

    const [rows, total, statusGroups] = await Promise.all([
      db.residentAccount.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          purok: true,
          sex: true,
          status: true,
          createdAt: true,
          barangay: { select: { name: true } },
        },
      }),
      db.residentAccount.count({ where }),
      db.residentAccount.groupBy({ by: ["status"], _count: { _all: true }, where: baseWhere }),
    ]);

    const counts: Record<string, number> = { ACTIVE: 0, PENDING: 0, SUSPENDED: 0, REJECTED: 0 };
    for (const g of statusGroups) {
      if (STATUSES.includes(g.status)) counts[g.status] = g._count._all;
    }

    return NextResponse.json({
      ok: true,
      total,
      page,
      pageSize,
      counts,
      residents: rows.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        barangay: r.barangay?.name ?? "—",
        purok: r.purok,
        sex: r.sex,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("list residents failed", e);
    return NextResponse.json({ error: "Failed to load residents." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const resolved = await requireAdminRole(["SYSTEM_ADMIN", "MDRRMO_OFFICER"]);
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    const status = typeof body.status === "string" ? body.status.toUpperCase() : "";
    if (!id || !STATUSES.includes(status)) {
      return NextResponse.json({ error: "Provide a resident id and a valid status (ACTIVE, PENDING, SUSPENDED or REJECTED)." }, { status: 400 });
    }
    const row = await db.residentAccount.findUnique({ where: { id }, include: { barangay: { select: { name: true } } } });
    if (!row) return NextResponse.json({ error: "Resident not found." }, { status: 404 });

    const updated = await db.residentAccount.update({ where: { id }, data: { status } });
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "RESIDENT_STATUS_SET",
      detail: `${row.fullName} (Brgy. ${row.barangay?.name ?? "—"}): ${row.status} → ${status}`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true, resident: { id: updated.id, fullName: updated.fullName, status: updated.status } });
  } catch (e) {
    console.error("resident PUT failed", e);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
