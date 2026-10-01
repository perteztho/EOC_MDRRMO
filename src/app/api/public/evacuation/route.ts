import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cached } from "@/lib/qas33/cache";
import { getCommunicationSettings } from "@/lib/qas33/comm-settings";
import {
  computeEvacStats,
  toEvacAnnouncementDTO,
  toEvacCenterDTO,
} from "@/lib/qas33/evac-service";
import { processDueBroadcasts } from "@/lib/qas33/broadcast-service";
import { effectiveMode, getPublishedConfig } from "@/lib/qas33/portal-server";
import type { OperationalSettings } from "@/lib/qas33/portal-types";
import type { PublicEvacResponse } from "@/lib/qas33/emergency-types";

// GET /api/public/evacuation — public evacuation dashboard (no login).
// Processes due scheduled broadcasts first, then returns visible centers,
// active announcements, stats and the live operational mode.
// 30s in-memory cache — the dashboard is polled repeatedly while open.
export async function GET() {
  try {
    const payload = await cached("public:evacuation", 30_000, async (): Promise<PublicEvacResponse> => {
      await processDueBroadcasts();
      return buildEvacPayload();
    });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
    });
  } catch (e) {
    console.error("public evacuation GET failed", e);
    return NextResponse.json({ ok: false, error: "Public evacuation data could not be loaded." }, { status: 500 });
  }
}

async function buildEvacPayload(): Promise<PublicEvacResponse> {
  const now = new Date();
    const [centers, settings, announcements, operational] = await Promise.all([
      db.evacuationCenter.findMany({
        where: { visible: true },
        orderBy: [{ displayOrder: "asc" }, { barangay: "asc" }, { name: "asc" }],
      }),
      getCommunicationSettings(),
      db.evacuationAnnouncement.findMany({
        where: {
          status: "PUBLISHED",
          showOnWebsite: true,
          publishAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { publishAt: "desc" },
        take: 20,
      }),
      getPublishedConfig<OperationalSettings>("operational"),
    ]);

    const centerDTOs = centers.map((c) => toEvacCenterDTO(c, settings));
    const mode = effectiveMode(operational);

    const payload: PublicEvacResponse = {
      ok: true,
      visible: settings.publicEvacPageVisible !== false,
      centers: centerDTOs,
      announcements: announcements.map(toEvacAnnouncementDTO),
      stats: computeEvacStats(centerDTOs),
      operationalMode: mode === "NORMAL" ? "NORMAL" : "TYPHOON",
      generatedAt: new Date().toISOString(),
    };
    return payload;
}
