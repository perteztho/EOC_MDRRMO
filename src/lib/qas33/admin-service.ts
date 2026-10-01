// Admin-side service helpers
import { db } from "@/lib/db";
import {
  getSectionDefs,
  computeValidation,
  computeSectionProgress,
  localizeSection,
  toFileMeta,
  fieldLabel,
} from "./template";
import { getCommentsForBarangay, parseValues } from "./barangay-service";
import type { AdminSubmissionDetail, AdminBarangayRow, AdminSubmissionRow } from "./types";
import type { Submission, Barangay } from "@prisma/client";

export async function buildSubmissionDetail(submission: Submission, barangay: Barangay): Promise<AdminSubmissionDetail> {
  const lang = submission.templateLang || "EN";
  const sections = await getSectionDefs();
  const values = parseValues(submission);
  const fileRows = await db.submissionFile.findMany({
    where: { submissionId: submission.id },
    orderBy: { uploadedAt: "desc" },
  });
  const files = fileRows.map(toFileMeta);
  const validation = computeValidation(sections, values, files, lang);
  const comments = await getCommentsForBarangay(submission.id);
  const reviews = await db.review.findMany({
    where: { submissionId: submission.id },
    orderBy: { createdAt: "desc" },
  });
  const criteriaRows = await db.ratingCriterion.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
  });
  const ratingRow = await db.rating.findFirst({
    where: { submissionId: submission.id },
    orderBy: { createdAt: "desc" },
  });
  const doc = await db.generatedDocument.findFirst({
    where: { submissionId: submission.id },
    orderBy: { generatedAt: "desc" },
    include: { downloads: true },
  });

  let rating: AdminSubmissionDetail["rating"] = null;
  if (ratingRow) {
    const scores = JSON.parse(ratingRow.scoresJson || "{}") as Record<string, number>;
    rating = {
      scores: criteriaRows.map((c) => ({
        key: c.key,
        name: c.name,
        score: scores[c.key] ?? 0,
        maxScore: c.maxScore,
      })),
      total: ratingRow.total,
      maxTotal: criteriaRows.reduce((a, c) => a + c.maxScore, 0),
      remarks: ratingRow.remarks,
      ratedByName: ratingRow.ratedByName,
      createdAt: ratingRow.createdAt.toISOString(),
    };
  }

  return {
    submission: {
      id: submission.id,
      year: submission.year,
      status: submission.status as AdminSubmissionDetail["submission"]["status"],
      templateLang: submission.templateLang,
      progress: submission.progress,
      version: submission.version,
      values,
      submittedAt: submission.submittedAt?.toISOString() ?? null,
      approvedAt: submission.approvedAt?.toISOString() ?? null,
    },
    barangay: {
      id: barangay.id,
      code: barangay.code,
      name: barangay.name,
      captain: barangay.captain,
    },
    sections: (() => {
      const progressBySection = new Map(
        computeSectionProgress(sections, values, files, lang).map((p) => [p.sectionKey, p])
      );
      return sections.map((s) => {
        const localized = localizeSection(s, lang);
        const p = progressBySection.get(s.key);
        return {
          ...localized,
          complete: p?.complete ?? false,
          uploadStatus: p?.uploadStatus ?? "MISSING",
        };
      });
    })(),
    files,
    validation,
    comments,
    reviews: reviews.map((r) => ({
      id: r.id,
      action: r.action,
      reviewerName: r.reviewerName,
      overallComment: r.overallComment,
      createdAt: r.createdAt.toISOString(),
      version: r.version,
    })),
    rating,
    criteria: criteriaRows.map((c) => ({ key: c.key, name: c.name, maxScore: c.maxScore })),
    document: doc
      ? {
          docId: doc.docId,
          version: doc.version,
          lang: doc.lang,
          signed: doc.signed,
          signedBy: doc.signedBy,
          signedAt: doc.signedAt?.toISOString() ?? null,
          generatedAt: doc.generatedAt.toISOString(),
          downloadCount: doc.downloads.length,
        }
      : null,
  };
}

export async function listBarangayRows(search: string, statusFilter: string, year: number): Promise<AdminBarangayRow[]> {
  const barangays = await db.barangay.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { code: { contains: search.toUpperCase() } },
            { captain: { contains: search } },
          ],
        }
      : undefined,
    include: {
      credential: true,
      submissions: { where: { year }, orderBy: { updatedAt: "desc" }, take: 1 },
      officials: { where: { active: true }, orderBy: { order: "asc" } },
    },
    orderBy: { code: "asc" },
  });
  return barangays
    .filter((b) => {
      if (!statusFilter || statusFilter === "ALL") return true;
      const sub = b.submissions[0];
      return (sub?.status ?? "NOT_STARTED") === statusFilter;
    })
    .map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      captain: b.captain,
      active: b.active,
      officials: b.officials.map((o) => ({ id: o.id, name: o.name, position: o.position, committee: o.committee })),
      credential: b.credential
        ? {
            active: b.credential.active,
            mustChangePin: b.credential.mustChangePin,
            tempPinPending: Boolean(b.credential.tempPin),
            lockedUntil: b.credential.lockedUntil?.toISOString() ?? null,
            lastLoginAt: b.credential.lastLoginAt?.toISOString() ?? null,
          }
        : null,
      submission: b.submissions[0]
        ? {
            id: b.submissions[0].id,
            status: b.submissions[0].status as AdminBarangayRow["submission"] extends null ? never : NonNullable<AdminBarangayRow["submission"]>["status"],
            progress: b.submissions[0].progress,
            version: b.submissions[0].version,
            templateLang: b.submissions[0].templateLang,
            updatedAt: b.submissions[0].updatedAt.toISOString(),
            submittedAt: b.submissions[0].submittedAt?.toISOString() ?? null,
          }
        : null,
    }));
}

export async function listSubmissionRows(search: string, statusFilter: string, year: number): Promise<AdminSubmissionRow[]> {
  const subs = await db.submission.findMany({
    where: { year },
    include: { barangay: true },
  });
  const ratings = await db.rating.findMany({ orderBy: { createdAt: "desc" } });
  const ratingBySubmission = new Map<string, (typeof ratings)[number]>();
  const maxTotals = new Map<string, number>();
  const criteria = await db.ratingCriterion.findMany({ where: { active: true } });
  const totalMax = criteria.reduce((a, c) => a + c.maxScore, 0);
  for (const r of ratings) {
    if (!ratingBySubmission.has(r.submissionId)) ratingBySubmission.set(r.submissionId, r);
  }
  return subs
    .filter((s) => {
      if (statusFilter && statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.barangay.name.toLowerCase().includes(q) && !s.barangay.code.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => a.barangay.code.localeCompare(b.barangay.code))
    .map((s) => {
      const rating = ratingBySubmission.get(s.id);
      return {
        id: s.id,
        barangay: { id: s.barangay.id, code: s.barangay.code, name: s.barangay.name },
        year: s.year,
        status: s.status as AdminSubmissionRow["status"],
        progress: s.progress,
        version: s.version,
        templateLang: s.templateLang,
        updatedAt: s.updatedAt.toISOString(),
        submittedAt: s.submittedAt?.toISOString() ?? null,
        lastRating: rating ? { total: rating.total, maxTotal: totalMax, createdAt: rating.createdAt.toISOString() } : null,
      };
    });
}
