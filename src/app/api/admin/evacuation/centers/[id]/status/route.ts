import { NextRequest, NextResponse } from "next/server";
import { canManageEvacuation, requireAdmin } from "@/lib/qas33/auth";
import { setCenterStatus } from "@/lib/qas33/evac-service";
import type { EvacCenterStatus } from "@/lib/qas33/emergency-types";

// POST /api/admin/evacuation/centers/[id]/status — manual status change
// (override flag + status history entry) — canManageEvacuation
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageEvacuation(session.admin.role)) {
    return NextResponse.json({ error: "Only MDRRMO Officers and System Administrators can change center status." }, { status: 403 });
  }
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as { status?: string; reason?: string };
    if (!body.status) return NextResponse.json({ error: "Status is required." }, { status: 400 });
    const center = await setCenterStatus({
      centerId: id,
      status: body.status as EvacCenterStatus,
      reason: body.reason ?? null,
      actor: { id: session.admin.id, name: session.admin.name },
    });
    return NextResponse.json({ center });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to change status.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
