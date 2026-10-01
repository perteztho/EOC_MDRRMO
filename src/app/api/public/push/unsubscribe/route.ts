import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/public/push/unsubscribe — deactivate a device subscription.
// Body: { endpoint }
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { endpoint?: string };
    const endpoint = String(body.endpoint ?? "").trim();
    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint is required." }, { status: 400 });
    }
    const existing = await db.notificationSubscription.findUnique({ where: { endpoint } });
    if (!existing) {
      // nothing to do — treat as success (idempotent)
      return NextResponse.json({ ok: true });
    }
    await db.notificationSubscription.update({ where: { endpoint }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("push unsubscribe failed", e);
    return NextResponse.json({ error: "Unsubscribe failed." }, { status: 500 });
  }
}
