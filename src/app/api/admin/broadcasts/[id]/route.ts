import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canSendBroadcast, canSendCriticalBroadcast, requireAdmin } from "@/lib/qas33/auth";
import {
  cancelBroadcast,
  duplicateBroadcast,
  scheduleBroadcast,
  sendBroadcastNow,
  toBroadcastDTOs,
  validateBroadcastInput,
} from "@/lib/qas33/broadcast-service";
import type { BroadcastInput } from "@/lib/qas33/broadcast-service";

// PUT /api/admin/broadcasts/[id] — edit DRAFT only; or { action: "cancel" }
// (SCHEDULED) / { action: "duplicate" } / { action: "send" } / { action: "schedule", scheduledAt }.
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canSendBroadcast(session.admin.role)) {
    return NextResponse.json({ error: "MDRRMO Staff accounts are read-only for the Broadcast Center." }, { status: 403 });
  }
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as Partial<BroadcastInput> & {
      action?: string;
      scheduledAt?: string;
    };
    const actor = { id: session.admin.id, name: session.admin.name };
    const existing = await db.broadcast.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Broadcast not found." }, { status: 404 });

    const action = body.action;

    if (action === "cancel") {
      const updated = await cancelBroadcast(id, actor);
      const [dto] = await toBroadcastDTOs([updated]);
      return NextResponse.json({ broadcast: dto });
    }
    if (action === "duplicate") {
      const copy = await duplicateBroadcast(id, actor);
      const [dto] = await toBroadcastDTOs([copy]);
      return NextResponse.json({ broadcast: dto }, { status: 201 });
    }
    if (action === "send") {
      if (existing.priority === "CRITICAL" && !canSendCriticalBroadcast(session.admin.role)) {
        return NextResponse.json(
          { error: "CRITICAL broadcasts can only be sent by the MDRRMO Officer or a System Administrator." },
          { status: 403 }
        );
      }
      const sent = await sendBroadcastNow(id, actor);
      const [dto] = await toBroadcastDTOs([sent]);
      return NextResponse.json({ broadcast: dto });
    }
    if (action === "schedule") {
      if (existing.priority === "CRITICAL" && !canSendCriticalBroadcast(session.admin.role)) {
        return NextResponse.json(
          { error: "CRITICAL broadcasts can only be scheduled by the MDRRMO Officer or a System Administrator." },
          { status: 403 }
        );
      }
      if (!body.scheduledAt) return NextResponse.json({ error: "Scheduled date/time is required." }, { status: 400 });
      const updated = await scheduleBroadcast(id, body.scheduledAt, actor);
      const [dto] = await toBroadcastDTOs([updated]);
      return NextResponse.json({ broadcast: dto });
    }

    // plain edit — DRAFT only
    if (existing.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft broadcasts can be edited." }, { status: 400 });
    }
    const merged: BroadcastInput = {
      title: body.title ?? existing.title,
      message: body.message ?? existing.message,
      priority: body.priority ?? existing.priority,
      channels:
        body.channels ??
        (JSON.parse(existing.channelsJson) as string[]),
      targetAudience: body.targetAudience ?? existing.targetAudience,
      targetBarangays:
        body.targetBarangays ??
        (JSON.parse(existing.targetBarangaysJson) as string[]),
      targetCenterIds:
        body.targetCenterIds ??
        (JSON.parse(existing.targetCenterIdsJson) as string[]),
      expiresAt:
        body.expiresAt !== undefined
          ? body.expiresAt
          : existing.expiresAt
            ? existing.expiresAt.toISOString()
            : null,
    };
    const v = validateBroadcastInput(merged);
    const updated = await db.broadcast.update({
      where: { id },
      data: {
        title: v.title,
        message: v.message,
        priority: v.priority,
        channelsJson: JSON.stringify(v.channels),
        targetAudience: v.targetAudience,
        targetBarangaysJson: JSON.stringify(v.targetBarangays),
        targetCenterIdsJson: JSON.stringify(v.targetCenterIds),
        expiresAt: v.expiresAt,
      },
    });
    const [dto] = await toBroadcastDTOs([updated]);
    return NextResponse.json({ broadcast: dto });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update broadcast.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/admin/broadcasts/[id] — DRAFT only
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canSendBroadcast(session.admin.role)) {
    return NextResponse.json({ error: "MDRRMO Staff accounts are read-only for the Broadcast Center." }, { status: 403 });
  }
  try {
    const { id } = await ctx.params;
    const existing = await db.broadcast.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Broadcast not found." }, { status: 404 });
    if (existing.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft broadcasts can be deleted. Cancel scheduled broadcasts instead." }, { status: 400 });
    }
    await db.broadcast.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("broadcast DELETE failed", e);
    return NextResponse.json({ error: "Failed to delete broadcast." }, { status: 500 });
  }
}
