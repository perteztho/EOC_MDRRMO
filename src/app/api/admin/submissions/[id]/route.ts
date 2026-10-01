import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/qas33/auth";
import { buildSubmissionDetail } from "@/lib/qas33/admin-service";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const submission = await db.submission.findUnique({ where: { id }, include: { barangay: true } });
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  const detail = await buildSubmissionDetail(submission, submission.barangay);
  return NextResponse.json(detail);
}
