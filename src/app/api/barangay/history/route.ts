import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay } from "@/lib/qas33/auth";
import { getOrCreateSubmission } from "@/lib/qas33/barangay-service";

// GET — version history + review timeline
export async function GET() {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const submission = await getOrCreateSubmission(resolved.barangay.id);
  const versions = await db.submissionVersion.findMany({
    where: { submissionId: submission.id },
    orderBy: { version: "desc" },
  });
  const reviews = await db.review.findMany({
    where: { submissionId: submission.id },
    include: { comments: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    versions: versions.map((v) => ({
      version: v.version,
      submittedAt: v.submittedAt.toISOString(),
      note: v.note,
    })),
    reviews: reviews.map((r) => ({
      id: r.id,
      action: r.action,
      reviewerName: r.reviewerName,
      overallComment: r.overallComment,
      createdAt: r.createdAt.toISOString(),
      version: r.version,
      commentCount: r.comments.length,
    })),
    currentStatus: submission.status,
    currentVersion: submission.version,
  });
}
