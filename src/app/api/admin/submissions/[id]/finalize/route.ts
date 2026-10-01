import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { requireAdmin, canApproveBdrrmp, getClientIp } from "@/lib/qas33/auth";
import { logAudit, notifyBarangay } from "@/lib/qas33/audit";
import { getSectionDefs } from "@/lib/qas33/template";
import { parseValues } from "@/lib/qas33/barangay-service";
import { generateBdrrmpPdf } from "@/lib/qas33/pdf";
import { buildDocId, getSettings, getBaseUrl } from "@/lib/qas33/server";
import { saveGeneratedDocument } from "@/lib/qas33/storage";

// POST — finalize: apply authorized signature + generate final PDF + unlock download
// Only the MDRRMO Officer (review & approve role) may sign and finalize BDRRMPs.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canApproveBdrrmp(resolved.admin.role)) {
    return NextResponse.json(
      { error: "Only the MDRRMO Officer can sign and finalize the approved BDRRMP." },
      { status: 403 }
    );
  }
  const { id } = await ctx.params;
  const submission = await db.submission.findUnique({ where: { id }, include: { barangay: true } });
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  if (!["APPROVED", "READY_FOR_DOWNLOAD"].includes(submission.status)) {
    return NextResponse.json(
      { error: "Only APPROVED submissions can be finalized. Approve the submission first." },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const settings = await getSettings();
  const signedBy = String(body.signedBy || settings.signatoryName).slice(0, 120);
  const position = String(body.position || settings.signatoryPosition).slice(0, 200);
  const ip = getClientIp(request);

  try {
    // Step 1 — mark FINALIZING
    await db.submission.update({ where: { id }, data: { status: "FINALIZING" } });
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "FINALIZATION_STARTED",
      detail: `Began finalizing BDRRMP ${submission.year} v${submission.version} — Barangay ${submission.barangay.name}`,
      barangayId: submission.barangayId,
      ip,
    });

    // Step 2 — build the document
    const sections = await getSectionDefs();
    const values = parseValues(submission);
    const docId = buildDocId(submission.barangay.code, submission.year, submission.version);
    const signedAt = new Date();
    const signatureHash = createHash("sha256")
      .update(`${docId}|${submission.id}|${signedBy}|${signedAt.toISOString()}|${submission.valuesJson.length}`)
      .digest("hex");
    const baseUrl = getBaseUrl(request);
    const verifyUrl = `${baseUrl}/?verify=${docId}`;
    const rating = await db.rating.findFirst({ where: { submissionId: id }, orderBy: { createdAt: "desc" } });

    const pdfBuffer = await generateBdrrmpPdf({
      barangay: { name: submission.barangay.name, code: submission.barangay.code },
      submission: { year: submission.year, version: submission.version, lang: submission.templateLang || "EN", values },
      sections,
      docId,
      rating: rating
        ? {
            total: rating.total,
            maxTotal: (await db.ratingCriterion.findMany({ where: { active: true } })).reduce((a, c) => a + c.maxScore, 0),
            remarks: rating.remarks,
          }
        : null,
      signature: { signedBy, position, signedAt, signatureHash },
      settings: { municipality: settings.municipality, province: settings.province },
      verifyUrl,
      approvedAt: submission.approvedAt,
    });

    // Step 3 — store (replace previous generated doc if regenerating)
    const fileKey = await saveGeneratedDocument(docId, pdfBuffer);
    const existing = await db.generatedDocument.findFirst({ where: { submissionId: id } });
    if (existing) {
      await db.generatedDocument.delete({ where: { id: existing.id } });
    }
    const doc = await db.generatedDocument.create({
      data: {
        submissionId: id,
        docId,
        version: submission.version,
        fileKey,
        lang: submission.templateLang || "EN",
        signed: true,
        signedBy,
        signedAt,
        signatureHash,
      },
    });

    // Step 4 — unlock download
    await db.submission.update({
      where: { id },
      data: { status: "READY_FOR_DOWNLOAD", finalizedAt: new Date() },
    });

    await logAudit({
      actorType: "SYSTEM",
      actorName: "System",
      action: "SIGNED",
      detail: `Applied authorized signature of ${signedBy} to ${docId}`,
      barangayId: submission.barangayId,
      ip,
    });
    await logAudit({
      actorType: "SYSTEM",
      actorName: "System",
      action: "GENERATED_FINAL_DOCUMENT",
      detail: `Generated final PDF ${docId} (${pdfBuffer.length} bytes) — download unlocked`,
      barangayId: submission.barangayId,
      ip,
    });
    await notifyBarangay(submission.barangayId, {
      type: "FINALIZED",
      title: "Final BDRRMP ready for download",
      body: `Your BDRRMP ${submission.year} was approved and signed by ${signedBy}. Document ID: ${docId}. You can now download the final PDF from the Documents page.`,
      link: "documents",
    });

    return NextResponse.json({
      ok: true,
      docId: doc.docId,
      signedBy,
      signedAt: signedAt.toISOString(),
      size: pdfBuffer.length,
      status: "READY_FOR_DOWNLOAD",
      verifyUrl,
    });
  } catch (e) {
    console.error("finalize error", e);
    // Roll back to APPROVED so the admin can retry
    await db.submission.update({ where: { id }, data: { status: "APPROVED" } }).catch(() => undefined);
    return NextResponse.json({ error: "Failed to generate the final document. Please try again." }, { status: 500 });
  }
}
