import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getClientIp } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { generatePlanDocx, generatePlanPdf, loadPlanExportDataByPlanId } from "@/lib/qas33/plan-export";

// GET /api/admin/plans/[id]/export?format=pdf|docx — download any barangay's
// plan document from the admin console (any console role).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const format = (new URL(request.url).searchParams.get("format") ?? "pdf").toLowerCase();
  if (format !== "pdf" && format !== "docx") {
    return NextResponse.json({ error: "Unsupported format — use pdf or docx." }, { status: 400 });
  }

  const data = await loadPlanExportDataByPlanId(id);
  if (!data) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  try {
    const filename = `${data.builder.docPrefix}-${data.barangay.code}-${data.plan.year}.${format}`;
    const body = format === "pdf" ? await generatePlanPdf(data) : await generatePlanDocx(data);

    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "PLAN_EXPORTED",
      detail: `${data.plan.builderCode} ${format} (admin) — ${data.barangay.name} (${data.barangay.code})`,
      barangayId: data.plan.barangayId,
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
    console.error("admin plan export failed", e);
    return NextResponse.json({ error: "Failed to generate the plan document." }, { status: 500 });
  }
}
