import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay, getClientIp } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { getOrCreateSubmission, getSubmissionFiles } from "@/lib/qas33/barangay-service";
import { saveUploadedFile, deleteStoredFile } from "@/lib/qas33/storage";
import { getSectionDefs, toFileMeta } from "@/lib/qas33/template";
import { recomputeDraftStatus } from "@/lib/qas33/template";

// POST — upload a file for a section (multipart/form-data)
export async function POST(request: NextRequest) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const barangay = await db.barangay.findUnique({ where: { id: resolved.barangay.id } });
  if (!barangay) return NextResponse.json({ error: "Barangay not found" }, { status: 404 });

  const submission = await getOrCreateSubmission(barangay.id);
  if (!["NOT_STARTED", "DRAFT", "READY_FOR_SUBMISSION", "NEEDS_REVISION"].includes(submission.status)) {
    return NextResponse.json({ error: "Uploads are locked while under review or approved." }, { status: 409 });
  }

  const form = await request.formData();
  const sectionKey = String(form.get("sectionKey") || "");
  const file = form.get("file") as File | null;
  if (!file || !sectionKey) {
    return NextResponse.json({ error: "Section and file are required." }, { status: 400 });
  }

  const sections = await getSectionDefs();
  const section = sections.find((s) => s.key === sectionKey);
  if (!section || !section.requiresUpload) {
    return NextResponse.json({ error: "This section does not accept uploads." }, { status: 400 });
  }

  // Validate extension
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const allowedExts = (section.uploadFormats || "pdf,jpg,jpeg,png,doc,docx")
    .split(",")
    .map((f) => f.trim().toLowerCase());
  if (!allowedExts.includes(ext)) {
    return NextResponse.json(
      { error: `Invalid file type ".${ext}". Accepted: ${allowedExts.join(", ").toUpperCase()}` },
      { status: 400 }
    );
  }
  const maxBytes = (section.uploadMaxMB ?? 10) * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: ${section.uploadMaxMB} MB.` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = await saveUploadedFile(buffer, barangay.code, submission.id, file.name);
  const created = await db.submissionFile.create({
    data: {
      submissionId: submission.id,
      sectionKey,
      filename: file.name.slice(0, 150),
      storageKey,
      mimeType: file.type || "application/octet-stream",
      size: buffer.length,
      version: Math.max(1, submission.version),
      status: "PENDING",
      uploadedBy: `Barangay ${barangay.name}`,
    },
  });

  // Recompute progress
  const { parseValues } = await import("@/lib/qas33/barangay-service");
  const values = parseValues(submission);
  const files = (await getSubmissionFiles(submission.id)).map(toFileMeta);
  const { progress, status } = recomputeDraftStatus(submission.status, sections, values, files);
  await db.submission.update({ where: { id: submission.id }, data: { progress, status } });

  await logAudit({
    actorType: "BARANGAY",
    actorName: `Barangay ${barangay.name}`,
    action: "UPLOADED_FILE",
    detail: `Uploaded: ${file.name} (${sectionKey})`,
    barangayId: barangay.id,
    ip: getClientIp(request),
  });

  return NextResponse.json({
    ok: true,
    file: toFileMeta(created),
    progress,
    status,
  });
}

// DELETE — remove an uploaded file (pre-approval only)
export async function DELETE(request: NextRequest) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const fileId = new URL(request.url).searchParams.get("fileId");
  if (!fileId) return NextResponse.json({ error: "fileId is required." }, { status: 400 });

  const submission = await getOrCreateSubmission(resolved.barangay.id);
  if (!["NOT_STARTED", "DRAFT", "READY_FOR_SUBMISSION", "NEEDS_REVISION"].includes(submission.status)) {
    return NextResponse.json({ error: "Files are locked while under review or approved." }, { status: 409 });
  }
  const file = await db.submissionFile.findFirst({ where: { id: fileId, submissionId: submission.id } });
  if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });

  await db.submissionFile.delete({ where: { id: file.id } });
  await deleteStoredFile(file.storageKey);

  const sections = await getSectionDefs();
  const { parseValues } = await import("@/lib/qas33/barangay-service");
  const values = parseValues(submission);
  const files = (await getSubmissionFiles(submission.id)).map(toFileMeta);
  const { progress, status } = recomputeDraftStatus(submission.status, sections, values, files);
  await db.submission.update({ where: { id: submission.id }, data: { progress, status } });

  await logAudit({
    actorType: "BARANGAY",
    actorName: `Barangay ${resolved.barangay.name}`,
    action: "DELETED_FILE",
    detail: `Deleted: ${file.filename} (${file.sectionKey})`,
    barangayId: resolved.barangay.id,
    ip: getClientIp(request),
  });
  return NextResponse.json({ ok: true, progress, status });
}
