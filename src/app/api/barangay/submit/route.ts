import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay, getClientIp } from "@/lib/qas33/auth";
import { logAudit, notifyAdmins } from "@/lib/qas33/audit";
import { getOrCreateSubmission, getSubmissionFiles, parseValues } from "@/lib/qas33/barangay-service";
import { computeValidation, getSectionDefs, toFileMeta } from "@/lib/qas33/template";

// POST — submit (or resubmit) the BDRRMP with certification
export async function POST(request: NextRequest) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const barangay = await db.barangay.findUnique({ where: { id: resolved.barangay.id } });
  if (!barangay) return NextResponse.json({ error: "Barangay not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (!body.certified) {
    return NextResponse.json(
      { error: "You must certify that the information is complete and accurate before submitting." },
      { status: 400 }
    );
  }

  const submission = await getOrCreateSubmission(barangay.id);
  if (!["NOT_STARTED", "DRAFT", "READY_FOR_SUBMISSION", "NEEDS_REVISION"].includes(submission.status)) {
    return NextResponse.json(
      { error: "This submission is already submitted or finalized." },
      { status: 409 }
    );
  }
  if (!submission.templateLang) {
    return NextResponse.json({ error: "Please select a template (English/Tagalog) first." }, { status: 400 });
  }

  const sections = await getSectionDefs();
  const values = parseValues(submission);
  const files = (await getSubmissionFiles(submission.id)).map(toFileMeta);
  const validation = computeValidation(sections, values, files, submission.templateLang);
  if (!validation.ready) {
    return NextResponse.json(
      {
        error: "Cannot submit yet — some requirements still need attention.",
        validation,
      },
      { status: 422 }
    );
  }

  const newVersion = submission.version + 1;
  const isResubmission = submission.version > 0;
  const now = new Date();

  await db.submissionVersion.create({
    data: {
      submissionId: submission.id,
      version: newVersion,
      valuesJson: JSON.stringify(values),
      filesJson: JSON.stringify(files),
      note: isResubmission ? "Resubmission after MDRRMO revision request" : "Initial submission",
      submittedAt: now,
    },
  });

  await db.submission.update({
    where: { id: submission.id },
    data: {
      version: newVersion,
      status: isResubmission ? "RESUBMITTED" : "SUBMITTED",
      submittedAt: submission.submittedAt ?? now,
      resubmittedAt: isResubmission ? now : null,
      progress: 100,
    },
  });

  // Reset file statuses to PENDING for the new review round
  await db.submissionFile.updateMany({ where: { submissionId: submission.id }, data: { status: "PENDING" } });

  const versionLabel = `v${newVersion}`;
  await notifyAdmins({
    type: isResubmission ? "SUBMITTED" : "SUBMITTED",
    title: isResubmission ? "Resubmission received" : "New BDRRMP submission",
    body: `Barangay ${barangay.name} ${isResubmission ? "resubmitted" : "submitted"} BDRRMP ${submission.year} (${versionLabel}) for review.`,
    link: "submissions",
  });
  await logAudit({
    actorType: "BARANGAY",
    actorName: `Barangay ${barangay.name}`,
    action: isResubmission ? "RESUBMITTED" : "SUBMITTED",
    detail: `${isResubmission ? "Resubmitted" : "Submitted"} BDRRMP ${submission.year} ${versionLabel}`,
    barangayId: barangay.id,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true, version: newVersion, status: isResubmission ? "RESUBMITTED" : "SUBMITTED" });
}
