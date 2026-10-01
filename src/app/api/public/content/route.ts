import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cached } from "@/lib/qas33/cache";
import { ensureBootstrap } from "@/lib/qas33/portal-server";
import type { PortalContentResponse } from "@/lib/qas33/portal-types";

// GET /api/public/content — public portal content (announcements, ticker,
// alerts, hotlines, news, preparedness, evacuation, barangay list, stats).
// Only PUBLISHED/active/visible items inside their schedule windows are returned.
// Results are served from a 30s in-memory cache (stale-while-revalidate) so
// repeat visits skip the nine parallel DB queries entirely.
export async function GET() {
  try {
    const payload = await cached("public:content", 30_000, async () => {
      await ensureBootstrap();
      return buildPayload();
    });
    return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
  } catch (e) {
    console.error("public content failed", e);
    return NextResponse.json({ ok: false, error: "Public content could not be loaded." }, { status: 500 });
  }
}

async function buildPayload(): Promise<PortalContentResponse> {
  const now = new Date();

    const [announcements, ticker, alerts, hotlines, news, preparedness, evacuation, barangays, submissions] =
      await Promise.all([
        db.announcement.findMany({ where: { status: "PUBLISHED", showOnHomepage: true, publishAt: { lte: now } } }),
        db.tickerMessage.findMany({ where: { active: true } }),
        db.publicAlert.findMany({ where: { active: true } }),
        db.emergencyHotline.findMany({ where: { visible: true } }),
        db.newsArticle.findMany({ where: { status: "PUBLISHED", publishAt: { lte: now } } }),
        db.preparednessTopic.findMany({ where: { visible: true } }),
        db.evacuationCenter.findMany({ where: { visible: true } }),
        db.barangay.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
        db.submission.findMany({ select: { status: true } }),
      ]);

    const notExpired = (expiresAt: Date | null) => !expiresAt || expiresAt > now;
    const inWindow = (startsAt: Date | null, endsAt: Date | null) =>
      (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);

    const priorityRank = (p: string) => ({ CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as Record<string, number>)[p] ?? 9;

    const payload: PortalContentResponse = {
      ok: true,
      announcements: announcements
        .filter((a) => notExpired(a.expiresAt))
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || priorityRank(a.priority) - priorityRank(b.priority) || b.publishAt.getTime() - a.publishAt.getTime())
        .slice(0, 20)
        .map((a) => ({
          id: a.id, title: a.title, category: a.category, priority: a.priority, content: a.content,
          imageUrl: a.imageUrl, attachmentUrl: a.attachmentUrl, publishAt: a.publishAt.toISOString(),
          expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null, areas: a.areas,
          featured: a.featured, pinned: a.pinned, linkUrl: a.linkUrl,
        })),
      ticker: ticker
        .filter((t) => inWindow(t.startsAt, t.endsAt))
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((t) => ({ id: t.id, message: t.message, priority: t.priority, icon: t.icon })),
      alerts: alerts
        .filter((a) => inWindow(a.startsAt, a.expiresAt))
        .sort((a, b) => ({ CRITICAL: 0, WARNING: 1, ADVISORY: 2, INFO: 3 } as Record<string, number>)[a.level] - ({ CRITICAL: 0, WARNING: 1, ADVISORY: 2, INFO: 3 } as Record<string, number>)[b.level] || b.createdAt.getTime() - a.createdAt.getTime())
        .map((a) => ({ id: a.id, title: a.title, level: a.level, message: a.message, linkUrl: a.linkUrl, createdAt: a.createdAt.toISOString() })),
      hotlines: hotlines
        .sort((a, b) => b.priority - a.priority || a.displayOrder - b.displayOrder)
        .map((h) => ({ id: h.id, agency: h.agency, serviceType: h.serviceType, phone: h.phone, icon: h.icon, category: h.category })),
      news: news
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.publishAt.getTime() - a.publishAt.getTime())
        .slice(0, 12)
        .map((n) => ({
          id: n.id, title: n.title, category: n.category, summary: n.summary, content: n.content,
          thumbnailUrl: n.thumbnailUrl, publishAt: n.publishAt.toISOString(), featured: n.featured,
          pinned: n.pinned, linkUrl: n.linkUrl,
        })),
      preparedness: preparedness
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((p) => ({ id: p.id, title: p.title, hazard: p.hazard, phase: p.phase, content: p.content, icon: p.icon, linkUrl: p.linkUrl })),
      evacuation: evacuation
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((e) => ({ id: e.id, name: e.name, barangay: e.barangay, address: e.address, capacity: e.capacity, status: e.status, notes: e.notes })),
      barangays: barangays.map((b) => ({ code: b.code, name: b.name })),
      stats: {
        barangays: barangays.length,
        population: 0,
        households: 0,
        approvedPlans: 0,
        totalSubmissions: submissions.length,
      },
    };

    // Real municipal statistics from the QAS33 database
    const agg = await db.barangay.aggregate({ _sum: { population: true, households: true } });
    payload.stats.population = agg._sum.population ?? 0;
    payload.stats.households = agg._sum.households ?? 0;
    payload.stats.approvedPlans = submissions.filter((s) =>
      ["APPROVED", "FINALIZING", "READY_FOR_DOWNLOAD", "DOWNLOADED", "ARCHIVED"].includes(s.status)
    ).length;

    return payload;
}
