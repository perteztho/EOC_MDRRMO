// QAS33 audit trail & notifications
import { db } from "@/lib/db";

export async function logAudit(entry: {
  actorType: "BARANGAY" | "ADMIN" | "SYSTEM";
  actorName: string;
  action: string;
  detail?: string;
  barangayId?: string | null;
  ip?: string | null;
}) {
  try {
    await db.auditLog.create({
      data: {
        actorType: entry.actorType,
        actorName: entry.actorName,
        action: entry.action,
        detail: entry.detail,
        barangayId: entry.barangayId ?? null,
        ip: entry.ip ?? null,
      },
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

export async function notifyBarangay(
  barangayId: string,
  n: { type: string; title: string; body?: string; link?: string }
) {
  try {
    await db.notification.create({
      data: { barangayId, audience: "BARANGAY", type: n.type, title: n.title, body: n.body, link: n.link },
    });
  } catch (e) {
    console.error("notify barangay failed", e);
  }
}

export async function notifyAdmins(n: { type: string; title: string; body?: string; link?: string }) {
  try {
    await db.notification.create({
      data: { barangayId: null, audience: "ADMIN", type: n.type, title: n.title, body: n.body, link: n.link },
    });
  } catch (e) {
    console.error("notify admins failed", e);
  }
}
