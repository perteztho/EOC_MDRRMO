import { NextResponse } from "next/server";
import { requireBarangay } from "@/lib/qas33/auth";
import { getOrCreateSubmission, getCommentsForBarangay } from "@/lib/qas33/barangay-service";

export async function GET() {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const submission = await getOrCreateSubmission(resolved.barangay.id);
  const comments = await getCommentsForBarangay(submission.id);
  return NextResponse.json({ comments });
}
