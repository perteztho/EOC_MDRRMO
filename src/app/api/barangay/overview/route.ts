import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay } from "@/lib/qas33/auth";
import { buildOverview, getOrCreateSubmission, getSubmissionFiles } from "@/lib/qas33/barangay-service";

export async function GET() {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const barangay = await db.barangay.findUnique({ where: { id: resolved.barangay.id } });
  if (!barangay) return NextResponse.json({ error: "Barangay not found" }, { status: 404 });
  const submission = await getOrCreateSubmission(barangay.id);
  const files = await getSubmissionFiles(submission.id);
  const overview = await buildOverview(barangay, submission, files);
  return NextResponse.json(overview);
}
