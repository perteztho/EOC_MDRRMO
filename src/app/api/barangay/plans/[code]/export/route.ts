import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay, getClientIp } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { getPlanYear } from "@/lib/qas33/plan-service";
import { generatePlanDocx, generatePlanPdf, loadPlanExportDataForBarangay } from "@/lib/qas33/plan-export";

// GET /api/barangay/plans/[code]/export?format=pdf|docx — download the plan
// document. Updates lastExportAt/lastExportFormat (status untouched) + audit log.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { code } = await params;
  const builderCode = code.toUpperCase();
  const format = (new URL(request.url).searchParams.get("format") ?? "pdf").toLowerCase();
  if (format !== "pdf" && format !== "docx") {
    return NextResponse.json({ error: "Unsupported format — use pdf or docx." }, { status: 400 });
  }

  const builder = await db.planBuilder.findUnique({ where: { code: builderCode } });
  if (!builder || !builder.active) {
    return NextResponse.json({ error: "Plan builder not found" }, { status: 404 });
  }

  const year = await getPlanYear();
  const data = await loadPlanExportDataForBarangay(resolved.barangay.id, builderCode, year);
  if (!data) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  try {
    const filename = `${builder.docPrefix}-${resolved.barangay.code}-${year}.${format}`;
    let body: Uint8Array | Buffer;
    if (format === "pdf") {
      body = await generatePlanPdf(data);
    } else {
      body = await generatePlanDocx(data);
    }

    await db.barangayPlan.update({
      where: { id: data.plan.id },
      data: { lastExportAt: new Date(), lastExportFormat: format },
    });
    await logAudit({
      actorType: "BARANGAY",
      actorName: `Barangay ${resolved.barangay.name}`,
      action: "PLAN_EXPORTED",
      detail: `${builderCode} ${format} by ${resolved.barangay.name}`,
      barangayId: resolved.barangay.id,
      ip: getClientIp(request),
    });

    return new NextResponse(Buffer.from(body), {
      status: 200,
      headers: {
        "Content-Type":
          format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("plan export failed", e);
    return NextResponse.json({ error: "Failed to generate the plan document." }, { status: 500 });
  }
}
