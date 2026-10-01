import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/qas33/auth";
import { getCommunicationSettings } from "@/lib/qas33/comm-settings";
import { computeEvacStats, toEvacCenterDTO, toOccupancyLogDTO, toStatusHistoryDTO } from "@/lib/qas33/evac-service";

// GET /api/admin/evacuation/reports?from=&to= — per-center + per-barangay
// occupancy/status reporting for a date range (default: last 7 days).
export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const fromDate = from && !isNaN(new Date(from).getTime()) ? new Date(from) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const toDate = to && !isNaN(new Date(to).getTime()) ? new Date(to) : new Date();

    const [centers, settings] = await Promise.all([
      db.evacuationCenter.findMany({
        orderBy: [{ barangay: "asc" }, { name: "asc" }],
      }),
      getCommunicationSettings(),
    ]);
    const centerDTOs = centers.map((c) => toEvacCenterDTO(c, settings));

    const [allLogs, allHistory] = await Promise.all([
      db.evacuationOccupancyLog.findMany({
        where: { createdAt: { gte: fromDate, lte: toDate } },
        orderBy: { createdAt: "desc" },
        include: { center: { select: { name: true } } },
      }),
      db.evacuationStatusHistory.findMany({
        where: { createdAt: { gte: fromDate, lte: toDate } },
        orderBy: { createdAt: "desc" },
        include: { center: { select: { name: true } } },
      }),
    ]);

    const perCenter = centerDTOs.map((c) => ({
      centerId: c.id,
      name: c.name,
      barangay: c.barangay,
      capacity: c.capacity,
      capacityFamilies: c.capacityFamilies,
      landAreaSqm: c.landAreaSqm,
      currentOccupants: c.currentOccupants,
      logs: allLogs.filter((l) => l.centerId === c.id).map(toOccupancyLogDTO),
      statusHistory: allHistory.filter((h) => h.centerId === c.id).map(toStatusHistoryDTO),
    }));

    return NextResponse.json({
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      perCenter,
      perBarangay: computeEvacStats(centerDTOs).byBarangay,
      totals: computeEvacStats(centerDTOs),
    });
  } catch (e) {
    console.error("evac reports GET failed", e);
    return NextResponse.json({ error: "Failed to load evacuation report." }, { status: 500 });
  }
}
