import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, canReviewBdrrmp, normalizeAdminRole, getClientIp } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";

// POST — save/update MDRRMO evaluation for a submission
// (MDRRMO Officer + MDRRMO Staff can rate; the System Administrator is read-only)
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canReviewBdrrmp(resolved.admin.role)) {
    return NextResponse.json(
      { error: "Only the MDRRMO Officer and MDRRMO Staff can save evaluations." },
      { status: 403 }
    );
  }
  const { id } = await ctx.params;
  const submission = await db.submission.findUnique({ where: { id }, include: { barangay: true } });
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const scores = (body.scores || {}) as Record<string, number>;
  const remarks = body.remarks ? String(body.remarks).slice(0, 2000) : null;
  const criteria = await db.ratingCriterion.findMany({ where: { active: true }, orderBy: { order: "asc" } });
  if (criteria.length === 0) {
    return NextResponse.json({ error: "No rating criteria configured." }, { status: 400 });
  }

  const saved: Record<string, number> = {};
  let total = 0;
  let maxTotal = 0;
  for (const c of criteria) {
    const s = Number(scores[c.key] ?? 0);
    if (!Number.isFinite(s) || s < 0 || s > c.maxScore) {
      return NextResponse.json({ error: `Score for "${c.name}" must be between 0 and ${c.maxScore}.` }, { status: 400 });
    }
    saved[c.key] = s;
    total += s;
    maxTotal += c.maxScore;
  }

  const rating = await db.rating.create({
    data: {
      submissionId: id,
      scoresJson: JSON.stringify(saved),
      total,
      remarks,
      ratedBy: resolved.admin.id,
      ratedByName: resolved.admin.name,
    },
  });

  await logAudit({
    actorType: "ADMIN",
    actorName: resolved.admin.name,
    action: "RATED",
    detail: `Evaluation saved: ${total}/${maxTotal} — Barangay ${submission.barangay.name}`,
    barangayId: submission.barangayId,
    ip: getClientIp(request),
  });

  return NextResponse.json({
    ok: true,
    rating: {
      scores: criteria.map((c) => ({ key: c.key, name: c.name, score: saved[c.key], maxScore: c.maxScore })),
      total,
      maxTotal,
      remarks,
      createdAt: rating.createdAt.toISOString(),
    },
  });
}
