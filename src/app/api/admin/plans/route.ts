import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/qas33/auth";
import { getPlanYear, toAdminPlanRow } from "@/lib/qas33/plan-service";
import type { AdminPlanRow } from "@/lib/qas33/emergency-types";
import type { BarangayPlan } from "@prisma/client";

// GET /api/admin/plans?status=&builder=&search= — Plan Approvals queue.
// Available to every console role. Ordered: SUBMITTED first (oldest first),
// then everything else by most recently updated.
export async function GET(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.toUpperCase() || "";
  const builder = url.searchParams.get("builder")?.toUpperCase() || "";
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();

  const year = await getPlanYear();
  const plans = await db.barangayPlan.findMany({
    where: { year },
    include: { barangay: true, builder: true },
  });

  const rows: AdminPlanRow[] = plans
    .filter((p) => (status ? p.status === status : true))
    .filter((p) => (builder ? p.builderCode === builder : true))
    .filter((p) =>
      search
        ? p.barangay.name.toLowerCase().includes(search) ||
          p.barangay.code.toLowerCase().includes(search) ||
          p.builder.titleEn.toLowerCase().includes(search)
        : true
    )
    .map((p) => toAdminPlanRow(p as BarangayPlan, p.barangay, p.builder));

  // SUBMITTED first (oldest submission first), then the rest newest-updated first
  const rank = (s: string) => (s === "SUBMITTED" ? 0 : 1);
  rows.sort((a, b) => {
    const ra = rank(a.status);
    const rb = rank(b.status);
    if (ra !== rb) return ra - rb;
    if (ra === 0) {
      // both submitted — oldest first
      const ta = a.submittedAt ? Date.parse(a.submittedAt) : 0;
      const tb = b.submittedAt ? Date.parse(b.submittedAt) : 0;
      return ta - tb;
    }
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });

  return NextResponse.json({ plans: rows, year });
}
