import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/public/push/subscribe — register/reactivate a web-push device.
// Body: { endpoint, keys: { p256dh, auth }, audience?, barangay? }
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
      audience?: string;
      barangay?: string;
      userAgent?: string;
    };
    const endpoint = String(body.endpoint ?? "").trim();
    if (!endpoint.startsWith("https://")) {
      return NextResponse.json({ error: "A valid https:// push endpoint is required." }, { status: 400 });
    }
    const p256dh = String(body.keys?.p256dh ?? "").trim();
    const auth = String(body.keys?.auth ?? "").trim();
    if (!p256dh || !auth) {
      return NextResponse.json({ error: "Subscription keys (p256dh, auth) are required." }, { status: 400 });
    }
    const audience = ["PUBLIC", "BARANGAY", "ADMIN"].includes(String(body.audience))
      ? String(body.audience)
      : "PUBLIC";
    const barangay = body.barangay ? String(body.barangay).trim().slice(0, 120) : null;

    const existing = await db.notificationSubscription.findUnique({ where: { endpoint } });
    if (existing) {
      const updated = await db.notificationSubscription.update({
        where: { endpoint },
        data: {
          p256dh,
          auth,
          audience,
          barangay,
          active: true,
          lastSeenAt: new Date(),
          userAgent: body.userAgent ? String(body.userAgent).slice(0, 300) : existing.userAgent,
        },
      });
      return NextResponse.json({ ok: true, id: updated.id, reactivated: !existing.active });
    }
    const created = await db.notificationSubscription.create({
      data: {
        endpoint,
        p256dh,
        auth,
        audience,
        barangay,
        active: true,
        userAgent: body.userAgent ? String(body.userAgent).slice(0, 300) : null,
      },
    });
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (e) {
    console.error("push subscribe failed", e);
    return NextResponse.json({ error: "Subscription failed." }, { status: 500 });
  }
}
