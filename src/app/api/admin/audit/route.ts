import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/qas33/auth";

// GET — audit trail (?search=&actor=&limit=&offset=)
export async function GET(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim();
  const actor = url.searchParams.get("actor") || "";
  // clamp limit/offset — NaN or negative values would make Prisma throw
  const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit")) || 100), 500);
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const where = {
    ...(search
      ? {
          OR: [
            { action: { contains: search } },
            { detail: { contains: search } },
            { actorName: { contains: search } },
          ],
        }
      : {}),
    ...(actor ? { actorType: actor } : {}),
  };

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { barangay: true },
    }),
    db.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    entries: entries.map((a) => ({
      id: a.id,
      actorType: a.actorType,
      actorName: a.actorName,
      action: a.action,
      detail: a.detail,
      barangay: a.barangay?.name ?? null,
      ip: a.ip,
      createdAt: a.createdAt.toISOString(),
    })),
    total,
  });
}
