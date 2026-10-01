import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/qas33/auth";
import { toOccupancyLogDTO, toStatusHistoryDTO } from "@/lib/qas33/evac-service";

// GET /api/admin/evacuation/centers/[id]/history — occupancy logs + status
// history (latest 100 each). Any admin role (read-only for staff).
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await ctx.params;
    const center = await db.evacuationCenter.findUnique({ where: { id }, select: { id: true } });
    if (!center) return NextResponse.json({ error: "Evacuation center not found." }, { status: 404 });
    const [occupancyLogs, statusHistory] = await Promise.all([
      db.evacuationOccupancyLog.findMany({
        where: { centerId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { center: { select: { name: true } } },
      }),
      db.evacuationStatusHistory.findMany({
        where: { centerId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { center: { select: { name: true } } },
      }),
    ]);
    return NextResponse.json({
      occupancyLogs: occupancyLogs.map(toOccupancyLogDTO),
      statusHistory: statusHistory.map(toStatusHistoryDTO),
    });
  } catch (e) {
    console.error("evac history GET failed", e);
    return NextResponse.json({ error: "Failed to load history." }, { status: 500 });
  }
}
