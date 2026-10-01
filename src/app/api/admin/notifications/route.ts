import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/qas33/auth";

export async function GET() {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const notifications = await db.notification.findMany({
    where: { audience: "ADMIN" },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  return NextResponse.json({
    notifications,
    unread: notifications.filter((n) => !n.read).length,
  });
}

export async function POST(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  if (body.all) {
    await db.notification.updateMany({ where: { audience: "ADMIN", read: false }, data: { read: true } });
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    await db.notification.updateMany({ where: { id: { in: body.ids }, audience: "ADMIN" }, data: { read: true } });
  }
  return NextResponse.json({ ok: true });
}
