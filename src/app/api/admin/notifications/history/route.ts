import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/qas33/auth";
import { toDeliveryLogDTO } from "@/lib/qas33/broadcast-service";

// GET /api/admin/notifications/history?channel=&status=&search=&page=
// Delivery log for every broadcast/notification channel (any admin role).
export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const channel = url.searchParams.get("channel") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get("pageSize") || 25)));

    const where: Record<string, unknown> = {};
    if (channel) where.channel = channel;
    if (status) where.status = status;
    if (search) {
      const q = search.trim();
      where.OR = [
        { target: { contains: q } },
        { sentByName: { contains: q } },
        { broadcast: { title: { contains: q } } },
      ];
    }

    const [rows, total] = await Promise.all([
      db.notificationDeliveryLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { broadcast: { select: { title: true } } },
      }),
      db.notificationDeliveryLog.count({ where }),
    ]);

    return NextResponse.json({ logs: rows.map(toDeliveryLogDTO), total, page, pageSize });
  } catch (e) {
    console.error("notifications history GET failed", e);
    return NextResponse.json({ error: "Failed to load notification history." }, { status: 500 });
  }
}
