import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/qas33/auth";
import { getCommunicationSettings } from "@/lib/qas33/comm-settings";
import { computeEvacStats, toEvacAnnouncementDTO, toEvacCenterDTO, toOccupancyLogDTO } from "@/lib/qas33/evac-service";

// GET /api/admin/evacuation/dashboard — stats + settings + recent activity.
// Any admin role (MDRRMO_STAFF is read-only for emergency data).
export async function GET() {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [centers, settings, recentLogRows, announcements] = await Promise.all([
      db.evacuationCenter.findMany({
        orderBy: [{ displayOrder: "asc" }, { barangay: "asc" }, { name: "asc" }],
      }),
      getCommunicationSettings(),
      db.evacuationOccupancyLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { center: { select: { name: true } } },
      }),
      db.evacuationAnnouncement.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    ]);

    const centerDTOs = centers.map((c) => toEvacCenterDTO(c, settings));
    return NextResponse.json({
      stats: computeEvacStats(centerDTOs),
      settings,
      centers: centerDTOs,
      recentLogs: recentLogRows.map(toOccupancyLogDTO),
      announcements: announcements.map(toEvacAnnouncementDTO),
    });
  } catch (e) {
    console.error("evac dashboard GET failed", e);
    return NextResponse.json({ error: "Failed to load evacuation dashboard." }, { status: 500 });
  }
}
