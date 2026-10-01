import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay, getClientIp } from "@/lib/qas33/auth";
import { logAudit, notifyAdmins } from "@/lib/qas33/audit";
import {
  getOrCreateSubmission,
  getSubmissionFiles,
  parseValues,
  localizedSections,
} from "@/lib/qas33/barangay-service";
import { computeValidation, recomputeDraftStatus, toFileMeta } from "@/lib/qas33/template";
import type { BarangaySubmissionData } from "@/lib/qas33/types";

// GET — full submission with localized sections, files, validation
export async function GET() {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const submission = await getOrCreateSubmission(resolved.barangay.id);
  const files = await getSubmissionFiles(submission.id);
  const lang = submission.templateLang || "EN";
  const sections = await localizedSections(lang);
  const values = parseValues(submission);
  const fileMetas = files.map(toFileMeta);
  const validation = computeValidation(
    await (await import("@/lib/qas33/template")).getSectionDefs(),
    values,
    fileMetas,
    lang
  );
  const data: BarangaySubmissionData = {
    submission: {
      id: submission.id,
      year: submission.year,
      status: submission.status as BarangaySubmissionData["submission"]["status"],
      templateLang: submission.templateLang,
      progress: submission.progress,
      version: submission.version,
      values,
    },
    sections,
    files: fileMetas,
    validation,
  };
  return NextResponse.json(data);
}

// PUT — save draft values (autosave)
export async function PUT(request: NextRequest) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const values = (body.values ?? {}) as Record<string, unknown>;

  const submission = await getOrCreateSubmission(resolved.barangay.id);
  if (!["NOT_STARTED", "DRAFT", "READY_FOR_SUBMISSION", "NEEDS_REVISION"].includes(submission.status)) {
    return NextResponse.json(
      { error: "Submission is locked while under review or approved." },
      { status: 409 }
    );
  }

  const { getSectionDefs } = await import("@/lib/qas33/template");
  const sections = await getSectionDefs();
  // Whitelist: only known field keys, sanitized by type
  const allowed: Record<string, unknown> = {};
  const allFields = sections.flatMap((s) => s.fields);
  for (const f of allFields) {
    const v = values[f.key];
    if (v === undefined) continue;
    if (f.type === "checkbox") {
      allowed[f.key] = Array.isArray(v) ? v.map(String).slice(0, 20) : [];
    } else if (f.type === "number") {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      allowed[f.key] = Number.isFinite(n) ? n : null;
    } else {
      allowed[f.key] = String(v).slice(0, 5000);
    }
  }

  const files = await getSubmissionFiles(submission.id);
  const fileMetas = files.map(toFileMeta);
  const { progress, status } = recomputeDraftStatus(submission.status, sections, allowed, fileMetas);

  await db.submission.update({
    where: { id: submission.id },
    data: { valuesJson: JSON.stringify(allowed), progress, status },
  });

  return NextResponse.json({ ok: true, progress, status });
}

// POST — actions: select-template
export async function POST(request: NextRequest) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (body.action === "select-template") {
    const lang = body.lang === "TL" ? "TL" : "EN";
    const submission = await getOrCreateSubmission(resolved.barangay.id);
    if (submission.version > 0 && submission.templateLang && submission.templateLang !== lang) {
      return NextResponse.json(
        { error: "Template language can no longer be changed after submission. Contact the MDRRMO." },
        { status: 409 }
      );
    }
    await db.submission.update({
      where: { id: submission.id },
      data: { templateLang: lang, status: submission.status === "NOT_STARTED" ? "DRAFT" : submission.status },
    });
    await logAudit({
      actorType: "BARANGAY",
      actorName: `Barangay ${resolved.barangay.name}`,
      action: "TEMPLATE_SELECTED",
      detail: `Selected ${lang === "TL" ? "Tagalog" : "English"} template`,
      barangayId: resolved.barangay.id,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true, templateLang: lang });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
