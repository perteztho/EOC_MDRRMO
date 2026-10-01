import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay } from "@/lib/qas33/auth";

// GET — list notifications for the logged-in barangay
export async function GET() {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const notifications = await db.notification.findMany({
    where: { barangayId: resolved.barangay.id, audience: "BARANGAY" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({
    notifications,
    unread: notifications.filter((n) => !n.read).length,
  });
}

// POST — mark read: { ids: string[] } or { all: true }
export async function POST(request: NextRequest) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  if (body.all) {
    await db.notification.updateMany({
      where: { barangayId: resolved.barangay.id, audience: "BARANGAY", read: false },
      data: { read: true },
    });
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    await db.notification.updateMany({
      where: { id: { in: body.ids }, barangayId: resolved.barangay.id },
      data: { read: true },
    });
  }
  return NextResponse.json({ ok: true });
}
