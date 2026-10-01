// Barangay-side service helpers shared by API routes
import { db } from "@/lib/db";
import { getSettings } from "./server";
import {
  getSectionDefs,
  computeValidation,
  computeSectionProgress,
  localizeSection,
  toFileMeta,
} from "./template";
import type { BarangayOverview, CommentItem, OfficialItem } from "./types";
import type { Submission, Barangay, SubmissionFile, Review, ReviewComment, AdminUser } from "@prisma/client";

export async function getOrCreateSubmission(barangayId: string): Promise<Submission> {
  const settings = await getSettings();
  const year = settings.planYear;
  let sub = await db.submission.findUnique({ where: { barangayId_year: { barangayId, year } } });
  if (!sub) {
    sub = await db.submission.create({ data: { barangayId, year } });
  }
  return sub;
}

export async function getSubmissionFiles(submissionId: string): Promise<SubmissionFile[]> {
  return db.submissionFile.findMany({ where: { submissionId }, orderBy: { uploadedAt: "desc" } });
}

export function parseValues(submission: Submission): Record<string, unknown> {
  try {
    return JSON.parse(submission.valuesJson || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function getCommentsForBarangay(submissionId: string): Promise<CommentItem[]> {
  const reviews = await db.review.findMany({
    where: { submissionId },
    include: { comments: true },
    orderBy: { createdAt: "desc" },
  });
  const items: CommentItem[] = [];
  for (const r of reviews) {
    for (const c of r.comments) {
      items.push({
        id: c.id,
        sectionKey: c.sectionKey,
        comment: c.comment,
        requiresRevision: c.requiresRevision,
        createdAt: c.createdAt.toISOString(),
        reviewerName: r.reviewerName,
        reviewAction: r.action,
        version: r.version,
      });
    }
  }
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function buildOverview(
  barangay: Barangay,
  submission: Submission,
  files: SubmissionFile[]
): Promise<BarangayOverview> {
  const sections = await getSectionDefs();
  const lang = submission.templateLang || "EN";
  const values = parseValues(submission);
  const fileMetas = files.map(toFileMeta);
  const progressList = computeSectionProgress(sections, values, fileMetas, lang);
  const validation = computeValidation(sections, values, fileMetas, lang);
  const comments = await getCommentsForBarangay(submission.id);
  const officialsRaw = await db.barangayOfficial.findMany({
    where: { barangayId: barangay.id, active: true },
    orderBy: { order: "asc" },
  });
  const officials: OfficialItem[] = officialsRaw.map((o) => ({
    id: o.id,
    name: o.name,
    position: o.position,
    committee: o.committee,
  }));
  const doc = await db.generatedDocument.findFirst({
    where: { submissionId: submission.id },
    orderBy: { generatedAt: "desc" },
    include: { downloads: true },
  });
  const unread = await db.notification.count({
    where: { barangayId: barangay.id, audience: "BARANGAY", read: false },
  });
  const requiredUploadSections = sections.filter((s) => s.requiresUpload);
  const requiredFilesUploaded = requiredUploadSections.filter(
    (s) => files.some((f) => f.sectionKey === s.key)
  ).length;

  return {
    barangay: {
      id: barangay.id,
      code: barangay.code,
      name: barangay.name,
      captain: barangay.captain,
      population: barangay.population,
      households: barangay.households,
    },
    officials,
    submission: {
      id: submission.id,
      year: submission.year,
      status: submission.status as BarangayOverview["submission"]["status"],
      templateLang: submission.templateLang,
      progress: submission.progress,
      version: submission.version,
      submittedAt: submission.submittedAt?.toISOString() ?? null,
      approvedAt: submission.approvedAt?.toISOString() ?? null,
      downloadedAt: submission.downloadedAt?.toISOString() ?? null,
      updatedAt: submission.updatedAt.toISOString(),
    },
    counts: {
      completedSections: progressList.filter((p) => p.complete).length,
      totalSections: sections.length,
      filesUploaded: files.length,
      requiredFilesUploaded,
      unreadNotifications: unread,
      openRevisionComments: comments.filter((c) => c.requiresRevision).length,
    },
    requirements: progressList.map((p) => ({
      sectionKey: p.sectionKey,
      title: p.title,
      required: p.required,
      requiresUpload: p.requiresUpload,
      formComplete: p.formComplete,
      uploadComplete: p.uploadComplete,
      uploadStatus: p.uploadStatus,
      fileCount: p.fileCount,
    })),
    latestComments: comments.slice(0, 5),
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

export function localizedSections(lang: string) {
  return getSectionDefs().then((sections) => sections.map((s) => localizeSection(s, lang)));
}
