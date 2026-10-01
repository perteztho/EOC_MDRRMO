import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, canReviewBdrrmp, canApproveBdrrmp, normalizeAdminRole, getClientIp } from "@/lib/qas33/auth";
import { logAudit, notifyBarangay } from "@/lib/qas33/audit";

interface CommentInput {
  sectionKey: string;
  comment: string;
  requiresRevision: boolean;
}

// POST — review actions: start | comment | revision | approve | archive
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");

  // ---- Role policy (QAS33) ----
  // MDRRMO Officer (Noel F. Ordona): full review workflow incl. APPROVE
  // MDRRMO Staff (Jun Carlo Anasco): assists — start review, comments, revision requests
  // System Administrator: read-only oversight of the review process
  const role = normalizeAdminRole(resolved.admin.role);
  const reviewer = canReviewBdrrmp(role); // start | comment | revision
  const approver = canApproveBdrrmp(role); // approve | archive
  if (["start", "comment", "revision", "approve", "archive"].includes(action) && !reviewer && !approver) {
    return NextResponse.json(
      { error: "The System Administrator has read-only access to the review process. Reviews are performed by the MDRRMO Officer and Staff." },
      { status: 403 }
    );
  }
  if (["approve", "archive"].includes(action) && !approver) {
    return NextResponse.json(
      { error: "Only the MDRRMO Officer can approve and archive BDRRMP submissions." },
      { status: 403 }
    );
  }

  const submission = await db.submission.findUnique({ where: { id }, include: { barangay: true } });
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  const admin = resolved.admin;
  const ip = getClientIp(request);
  const audit = (act: string, detail: string) =>
    logAudit({
      actorType: "ADMIN",
      actorName: admin.name,
      action: act,
      detail: `${detail} — Barangay ${submission.barangay.name}`,
      barangayId: submission.barangayId,
      ip,
    });

  if (submission.version === 0 && action !== "archive") {
    return NextResponse.json({ error: "This barangay has not submitted yet." }, { status: 409 });
  }

  // ---------- START REVIEW ----------
  if (action === "start") {
    if (!["SUBMITTED", "RESUBMITTED"].includes(submission.status)) {
      return NextResponse.json({ error: "Can only start review on a submitted/resubmitted BDRRMP." }, { status: 409 });
    }
    await db.submission.update({ where: { id }, data: { status: "UNDER_REVIEW", underReviewAt: new Date() } });
    await db.review.create({
      data: { submissionId: id, version: submission.version, reviewerId: admin.id, reviewerName: admin.name, action: "START_REVIEW" },
    });
    await audit("STARTED_REVIEW", `Started reviewing v${submission.version}`);
    return NextResponse.json({ ok: true, status: "UNDER_REVIEW" });
  }

  // ---------- ADD COMMENTS (no decision) ----------
  if (action === "comment") {
    const comments = (body.comments || []) as CommentInput[];
    const valid = comments.filter((c) => c.sectionKey && String(c.comment).trim());
    if (valid.length === 0 && !body.overallComment) {
      return NextResponse.json({ error: "At least one comment is required." }, { status: 400 });
    }
    if (["SUBMITTED", "RESUBMITTED"].includes(submission.status)) {
      await db.submission.update({ where: { id }, data: { status: "UNDER_REVIEW", underReviewAt: new Date() } });
    }
    const review = await db.review.create({
      data: {
        submissionId: id,
        version: submission.version,
        reviewerId: admin.id,
        reviewerName: admin.name,
        action: "COMMENT",
        overallComment: body.overallComment ? String(body.overallComment).slice(0, 2000) : null,
        comments: { create: valid.map((c) => ({ sectionKey: c.sectionKey, comment: String(c.comment).slice(0, 2000), requiresRevision: !!c.requiresRevision })) },
      },
    });
    await notifyBarangay(submission.barangayId, {
      type: "COMMENT",
      title: "New MDRRMO comment",
      body: valid.length
        ? `The MDRRMO added ${valid.length} comment(s) on your BDRRMP (${valid.map((c) => c.sectionKey.replace(/_/g, " ")).slice(0, 3).join(", ")}${valid.length > 3 ? "..." : ""}).`
        : "The MDRRMO added a comment on your BDRRMP.",
      link: "comments",
    });
    await audit("ADDED_COMMENT", `Added ${valid.length} review comment(s) on v${submission.version}`);
    return NextResponse.json({ ok: true, reviewId: review.id });
  }

  // ---------- REQUEST REVISION ----------
  if (action === "revision") {
    const comments = ((body.comments || []) as CommentInput[]).filter((c) => c.sectionKey && String(c.comment).trim());
    const overall = body.overallComment ? String(body.overallComment).slice(0, 2000) : null;
    if (comments.length === 0) {
      return NextResponse.json(
        { error: "Add at least one section comment describing what needs revision." },
        { status: 400 }
      );
    }
    if (!["SUBMITTED", "RESUBMITTED", "UNDER_REVIEW"].includes(submission.status)) {
      return NextResponse.json({ error: `Cannot request revision while status is ${submission.status}.` }, { status: 409 });
    }
    await db.review.create({
      data: {
        submissionId: id,
        version: submission.version,
        reviewerId: admin.id,
        reviewerName: admin.name,
        action: "REVISION_REQUESTED",
        overallComment: overall,
        comments: { create: comments.map((c) => ({ sectionKey: c.sectionKey, comment: String(c.comment).slice(0, 2000), requiresRevision: true })) },
      },
    });
    // mark files of flagged sections
    const flagged = comments.map((c) => c.sectionKey);
    await db.submissionFile.updateMany({
      where: { submissionId: id, sectionKey: { in: flagged } },
      data: { status: "NEEDS_REVISION" },
    });
    await db.submission.update({ where: { id }, data: { status: "NEEDS_REVISION" } });
    await notifyBarangay(submission.barangayId, {
      type: "REVISION",
      title: "BDRRMP needs revision",
      body: `The MDRRMO requested revisions on ${flagged.length} section(s): ${flagged.map((f) => f.replace(/_/g, " ")).join(", ")}. Please see the comments, make corrections and resubmit.`,
      link: "comments",
    });
    await audit("REVISION_REQUESTED", `Requested revision with ${comments.length} comment(s) on v${submission.version}`);
    return NextResponse.json({ ok: true, status: "NEEDS_REVISION" });
  }

  // ---------- APPROVE ----------
  if (action === "approve") {
    if (!["UNDER_REVIEW", "SUBMITTED", "RESUBMITTED", "NEEDS_REVISION"].includes(submission.status)) {
      return NextResponse.json({ error: `Cannot approve while status is ${submission.status}.` }, { status: 409 });
    }
    // Require an evaluation rating (either existing or provided inline)
    let rating = await db.rating.findFirst({ where: { submissionId: id }, orderBy: { createdAt: "desc" } });
    const inlineScores = (body.scores || null) as Record<string, number> | null;
    if (inlineScores) {
      const criteria = await db.ratingCriterion.findMany({ where: { active: true } });
      const scores: Record<string, number> = {};
      let total = 0;
      let maxTotal = 0;
      for (const c of criteria) {
        const s = Number(inlineScores[c.key] ?? 0);
        if (!Number.isFinite(s) || s < 0 || s > c.maxScore) {
          return NextResponse.json({ error: `Score for "${c.name}" must be between 0 and ${c.maxScore}.` }, { status: 400 });
        }
        scores[c.key] = s;
        total += s;
        maxTotal += c.maxScore;
      }
      rating = await db.rating.create({
        data: {
          submissionId: id,
          scoresJson: JSON.stringify(scores),
          total,
          remarks: body.remarks ? String(body.remarks).slice(0, 2000) : null,
          ratedBy: admin.id,
          ratedByName: admin.name,
        },
      });
      await audit("RATED", `Evaluation saved: ${total}/${maxTotal}`);
    }
    if (!rating) {
      return NextResponse.json(
        { error: "Please save the MDRRMO evaluation (rating) before approving." },
        { status: 400 }
      );
    }
    await db.review.create({
      data: {
        submissionId: id,
        version: submission.version,
        reviewerId: admin.id,
        reviewerName: admin.name,
        action: "APPROVED",
        overallComment: body.overallComment ? String(body.overallComment).slice(0, 2000) : null,
        comments: {
          create: ((body.comments || []) as CommentInput[])
            .filter((c) => c.sectionKey && String(c.comment).trim())
            .map((c) => ({ sectionKey: c.sectionKey, comment: String(c.comment).slice(0, 2000), requiresRevision: false })),
        },
      },
    });
    await db.submissionFile.updateMany({ where: { submissionId: id }, data: { status: "APPROVED" } });
    await db.submission.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date() } });
    const criteriaForMax = await db.ratingCriterion.findMany({ where: { active: true } });
    const maxTotal = criteriaForMax.reduce((a, c) => a + c.maxScore, 0);
    await notifyBarangay(submission.barangayId, {
      type: "APPROVED",
      title: "BDRRMP approved",
      body: `Your BDRRMP ${submission.year} (v${submission.version}) was approved by the MDRRMO with a rating of ${rating.total}/${maxTotal}. The final document will be available for download once signed.`,
      link: "documents",
    });
    await audit("APPROVED", `Approved BDRRMP ${submission.year} v${submission.version} (rating ${rating.total}/${maxTotal})`);
    return NextResponse.json({ ok: true, status: "APPROVED", ratingTotal: rating.total, maxTotal });
  }

  // ---------- ARCHIVE ----------
  if (action === "archive") {
    if (!["APPROVED", "READY_FOR_DOWNLOAD", "DOWNLOADED"].includes(submission.status)) {
      return NextResponse.json({ error: "Only approved/finalized BDRRMPs can be archived." }, { status: 409 });
    }
    await db.submission.update({ where: { id }, data: { status: "ARCHIVED" } });
    await audit("ARCHIVED", `Archived BDRRMP ${submission.year}`);
    return NextResponse.json({ ok: true, status: "ARCHIVED" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
