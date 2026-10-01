import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/qas33/auth";
import { getSettings } from "@/lib/qas33/server";

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

// GET — monitoring report data (?export=csv for file download)
export async function GET(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getSettings();
  const year = settings.planYear;
  const submissions = await db.submission.findMany({
    where: { year },
    include: { barangay: true, documents: { include: { downloads: true } } },
  });
  const ratings = await db.rating.findMany({ orderBy: { createdAt: "desc" } });
  const ratingBySub = new Map<string, (typeof ratings)[number]>();
  for (const r of ratings) if (!ratingBySub.has(r.submissionId)) ratingBySub.set(r.submissionId, r);
  // Configured maximum evaluation score (kept in sync with the rating editor)
  const ratingMaxTotal = (await db.ratingCriterion.findMany({ where: { active: true } })).reduce(
    (a, c) => a + c.maxScore,
    0
  );

  const rows = submissions
    .sort((a, b) => a.barangay.code.localeCompare(b.barangay.code))
    .map((s) => {
      const rating = ratingBySub.get(s.id);
      const doc = s.documents[0];
      return {
        code: s.barangay.code,
        barangay: s.barangay.name,
        captain: s.barangay.captain || "",
        status: s.status,
        progress: s.progress,
        version: s.version,
        template: s.templateLang === "TL" ? "Tagalog" : s.templateLang === "EN" ? "English" : "",
        lastSubmitted: s.resubmittedAt?.toISOString() ?? s.submittedAt?.toISOString() ?? "",
        approvedAt: s.approvedAt?.toISOString() ?? "",
        rating: rating?.total ?? null,
        docId: doc?.docId ?? "",
        downloads: doc?.downloads.length ?? 0,
      };
    });

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;

  const url = new URL(request.url);
  if (url.searchParams.get("export") === "csv") {
    const header = [
      "Code",
      "Barangay",
      "Punong Barangay",
      "Status",
      "Progress (%)",
      "Version",
      "Template",
      "Last Submitted",
      "Approved",
      "Rating",
      "Document ID",
      "Downloads",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.code,
          csvEscape(r.barangay),
          csvEscape(r.captain),
          r.status,
          String(r.progress),
          String(r.version),
          r.template,
          r.lastSubmitted.slice(0, 10),
          r.approvedAt.slice(0, 10),
          r.rating === null ? "" : String(r.rating),
          r.docId,
          String(r.downloads),
        ].join(",")
      );
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="QAS33_BDRRMP_Monitoring_${year}.csv"`,
      },
    });
  }

  return NextResponse.json({
    year,
    rows,
    counts,
    totals: {
      barangays: rows.length,
      submitted: rows.filter((r) => r.version > 0).length,
      approved: rows.filter((r) => ["APPROVED", "READY_FOR_DOWNLOAD", "DOWNLOADED", "ARCHIVED"].includes(r.status)).length,
      ratingMaxTotal,
      avgRating:
        rows.filter((r) => r.rating !== null).length > 0
          ? Math.round(
              (rows.filter((r) => r.rating !== null).reduce((a, r) => a + (r.rating ?? 0), 0) /
                rows.filter((r) => r.rating !== null).length) *
                10
            ) / 10
          : null,
    },
  });
}
