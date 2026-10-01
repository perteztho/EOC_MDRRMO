import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  canSendBroadcast,
  canSendCriticalBroadcast,
  requireAdmin,
} from "@/lib/qas33/auth";
import {
  createBroadcast,
  processDueBroadcasts,
  scheduleBroadcast,
  sendBroadcastNow,
  toBroadcastDTOs,
} from "@/lib/qas33/broadcast-service";
import type { BroadcastInput } from "@/lib/qas33/broadcast-service";

// GET /api/admin/broadcasts?status= — list (any role). Processes due
// scheduled broadcasts first (opportunistic scheduler).
export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await processDueBroadcasts({ id: session.admin.id, name: session.admin.name });
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const rows = await db.broadcast.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ broadcasts: await toBroadcastDTOs(rows) });
  } catch (e) {
    console.error("broadcasts GET failed", e);
    return NextResponse.json({ error: "Failed to load broadcasts." }, { status: 500 });
  }
}

// POST /api/admin/broadcasts — compose + send / schedule / save draft.
// canSendBroadcast; CRITICAL send/schedule additionally requires
// canSendCriticalBroadcast (MDRRMO Officer or System Admin).
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canSendBroadcast(session.admin.role)) {
    return NextResponse.json({ error: "MDRRMO Staff accounts are read-only for the Broadcast Center." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as BroadcastInput & {
      mode?: string;
      scheduledAt?: string;
    };
    const mode = body.mode === "schedule" ? "schedule" : body.mode === "draft" ? "draft" : "send";
    const priority = String(body.priority ?? "NORMAL");

    if (
      (mode === "send" || mode === "schedule") &&
      priority === "CRITICAL" &&
      !canSendCriticalBroadcast(session.admin.role)
    ) {
      return NextResponse.json(
        { error: "CRITICAL broadcasts can only be sent by the MDRRMO Officer or a System Administrator." },
        { status: 403 }
      );
    }

    const actor = { id: session.admin.id, name: session.admin.name };

    if (mode === "send") {
      const broadcast = await createBroadcast(body, actor, "DRAFT");
      const sent = await sendBroadcastNow(broadcast.id, actor);
      const [dto] = await toBroadcastDTOs([sent]);
      return NextResponse.json({ broadcast: dto }, { status: 201 });
    }
    if (mode === "schedule") {
      if (!body.scheduledAt) {
        return NextResponse.json({ error: "Scheduled date/time is required." }, { status: 400 });
      }
      const broadcast = await createBroadcast(body, actor, "DRAFT");
      const scheduled = await scheduleBroadcast(broadcast.id, body.scheduledAt, actor);
      const [dto] = await toBroadcastDTOs([scheduled]);
      return NextResponse.json({ broadcast: dto }, { status: 201 });
    }
    const broadcast = await createBroadcast(body, actor, "DRAFT");
    const [dto] = await toBroadcastDTOs([broadcast]);
    return NextResponse.json({ broadcast: dto }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create broadcast.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
