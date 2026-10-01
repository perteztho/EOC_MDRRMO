import { NextRequest, NextResponse } from "next/server";
import {
  canManageNotificationConfig,
  getClientIp,
  normalizeAdminRole,
  requireAdmin,
} from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import {
  changedSettingKeys,
  getCommunicationSettings,
  saveCommunicationSettings,
} from "@/lib/qas33/comm-settings";
import type { CommunicationSettings } from "@/lib/qas33/emergency-types";

// GET /api/admin/portal/communication — communication settings + push status
// (any admin role — MDRRMO_STAFF is read-only).
export async function GET() {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { getPushStatus } = await import("@/lib/qas33/push-service");
    const [settings, push] = await Promise.all([getCommunicationSettings(), getPushStatus()]);
    return NextResponse.json({ settings, push });
  } catch (e) {
    console.error("communication GET failed", e);
    return NextResponse.json({ error: "Failed to load communication settings." }, { status: 500 });
  }
}

// PUT /api/admin/portal/communication — save a partial patch.
// Requires MDRRMO_OFFICER or SYSTEM_ADMIN; push/provider fields
// (pushEnabled) additionally require SYSTEM_ADMIN (canManageNotificationConfig).
export async function PUT(request: NextRequest) {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = normalizeAdminRole(session.admin.role);
  if (role !== "SYSTEM_ADMIN" && role !== "MDRRMO_OFFICER") {
    return NextResponse.json(
      { error: "Only MDRRMO Officers and System Administrators can change communication settings." },
      { status: 403 }
    );
  }
  try {
    const body = (await request.json()) as Partial<CommunicationSettings>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
    }

    const touchesPush =
      body.pushEnabled !== undefined ||
      Object.keys(body).some((k) => k.toLowerCase().includes("push") || k.toLowerCase().includes("provider"));
    if (touchesPush && !canManageNotificationConfig(session.admin.role)) {
      return NextResponse.json(
        {
          error:
            "Push notification configuration can only be changed by a System Administrator. Save the other settings first, then ask the system administrator to update the push settings.",
        },
        { status: 403 }
      );
    }

    const before = await getCommunicationSettings();
    const settings = await saveCommunicationSettings(body);
    const changed = changedSettingKeys(before, settings);
    await logAudit({
      actorType: "ADMIN",
      actorName: session.admin.name,
      action: "COMMUNICATION_SETTINGS_UPDATED",
      detail: changed.length ? `Updated: ${changed.join(", ")}` : "Saved (no changes)",
      ip: getClientIp(request),
    });
    return NextResponse.json({ settings });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save communication settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
