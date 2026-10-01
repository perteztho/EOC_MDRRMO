import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/qas33/auth";
import { getSettings } from "@/lib/qas33/server";
import type { AdminOverviewStats } from "@/lib/qas33/types";

export async function GET() {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getSettings();
  const year = settings.planYear;
  const barangays = await db.barangay.count();
  const activeBarangays = await db.barangay.count({ where: { active: true } });
  const submissions = await db.submission.findMany({ where: { year } });
  const counts: Record<string, number> = {};
  for (const s of submissions) {
    counts[s.status] = (counts[s.status] || 0) + 1;
  }
  const notStarted = barangays - submissions.filter((s) => s.status !== "NOT_STARTED").length;
  counts["NOT_STARTED"] = notStarted;

  const doneStatuses = ["APPROVED", "FINALIZING", "READY_FOR_DOWNLOAD", "DOWNLOADED", "ARCHIVED"];
  const completionRate = barangays ? Math.round((submissions.filter((s) => doneStatuses.includes(s.status)).length / barangays) * 100) : 0;
  const avgProgress = barangays
    ? Math.round(submissions.reduce((a, s) => a + s.progress, 0) / barangays)
    : 0;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const submittedThisMonth = submissions.filter(
    (s) => (s.resubmittedAt ?? s.submittedAt ?? s.updatedAt) >= monthStart && s.version > 0
  ).length;
  const pendingReviews = submissions.filter((s) => ["SUBMITTED", "RESUBMITTED"].includes(s.status)).length;
  const documentsGenerated = await db.generatedDocument.count();
  const totalDownloads = await db.downloadLog.count();
  const allRatings = await db.rating.findMany();
  const avgRating = allRatings.length
    ? Math.round((allRatings.reduce((a, r) => a + r.total, 0) / allRatings.length) * 10) / 10
    : null;
  // Configured maximum evaluation score (kept in sync with the rating editor)
  const ratingMaxTotal = (await db.ratingCriterion.findMany({ where: { active: true } })).reduce(
    (a, c) => a + c.maxScore,
    0
  );

  const recentActivity = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { barangay: true },
  });

  const stats: AdminOverviewStats = {
    total: barangays,
    active: activeBarangays,
    counts,
    completionRate,
    submittedThisMonth,
    avgProgress,
    pendingReviews,
    documentsGenerated,
    totalDownloads,
    avgRating,
    ratingMaxTotal,
  };

  return NextResponse.json({
    stats,
    year,
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      actorType: a.actorType,
      actorName: a.actorName,
      action: a.action,
      detail: a.detail,
      barangay: a.barangay?.name ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}
