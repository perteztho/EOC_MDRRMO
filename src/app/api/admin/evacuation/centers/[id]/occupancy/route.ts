import { NextRequest, NextResponse } from "next/server";
import { canManageEvacuation, requireAdmin } from "@/lib/qas33/auth";
import { updateCenterOccupancy } from "@/lib/qas33/evac-service";

// POST /api/admin/evacuation/centers/[id]/occupancy — record an occupancy
// snapshot (auto-status recompute + occupancy log + audit) — canManageEvacuation
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageEvacuation(session.admin.role)) {
    return NextResponse.json({ error: "Only MDRRMO Officers and System Administrators can update occupancy." }, { status: 403 });
  }
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as Record<string, unknown>;
    const result = await updateCenterOccupancy({
      centerId: id,
      occupants: Number(body.occupants),
      male: body.male !== undefined ? Number(body.male) : undefined,
      female: body.female !== undefined ? Number(body.female) : undefined,
      children: body.children !== undefined ? Number(body.children) : undefined,
      seniors: body.seniors !== undefined ? Number(body.seniors) : undefined,
      pwd: body.pwd !== undefined ? Number(body.pwd) : undefined,
      pregnant: body.pregnant !== undefined ? Number(body.pregnant) : undefined,
      otherVulnerable: body.otherVulnerable !== undefined ? Number(body.otherVulnerable) : undefined,
      note: body.note != null ? String(body.note) : null,
      overrideOverCapacity: body.overrideOverCapacity === true,
      actor: { id: session.admin.id, name: session.admin.name },
    });
    return NextResponse.json({ center: result.center, log: result.log });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update occupancy.";
    const status = message.includes("not found") ? 404 : message.includes("override required") ? 400 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
