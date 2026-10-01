// QAS33 — Broadcast Center service: one message fanned out to many channels
// (website announcement, homepage banner, ticker, news post, web push,
// evacuation-center announcement, ops-dashboard alert). Scheduled sends are
// processed opportunistically (processDueBroadcasts) on broadcast/evac reads.
import { db } from "@/lib/db";
import { logAudit } from "./audit";
import { getCommunicationSettings } from "./comm-settings";
import { sanitizeRichText } from "./rich-text";
import { sendPush } from "./push-service";
import type { BroadcastChannel, BroadcastDTO, BroadcastPriority, BroadcastStatus, DeliveryLogDTO } from "./emergency-types";
import { BROADCAST_CHANNELS } from "./emergency-types";
import type { Broadcast, NotificationDeliveryLog } from "@prisma/client";

export const VALID_CHANNELS = BROADCAST_CHANNELS.map((c) => c.key);

// ---------------------------------------------------------------------------
// DTO mapping
// ---------------------------------------------------------------------------

function safeJson<T>(raw: string | null, fallback: T): T {
  try {
    const parsed = raw ? JSON.parse(raw) : fallback;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function toBroadcastDTO(b: Broadcast, centerNames?: string[]): BroadcastDTO {
  const channels = safeJson<string[]>(b.channelsJson, []);
  const centerIds = safeJson<string[]>(b.targetCenterIdsJson, []);
  return {
    id: b.id,
    title: b.title,
    message: b.message,
    priority: b.priority as BroadcastPriority,
    channels: channels.filter((c): c is BroadcastChannel => VALID_CHANNELS.includes(c as BroadcastChannel)),
    targetAudience: b.targetAudience,
    targetBarangays: safeJson<string[]>(b.targetBarangaysJson, []),
    targetCenterIds: centerIds,
    targetCenterNames: centerNames ?? [],
    status: b.status as BroadcastStatus,
    scheduledAt: b.scheduledAt ? b.scheduledAt.toISOString() : null,
    expiresAt: b.expiresAt ? b.expiresAt.toISOString() : null,
    sentAt: b.sentAt ? b.sentAt.toISOString() : null,
    sentByName: b.sentByName,
    stats: safeJson<Record<string, { ok: boolean; detail?: string }>>(b.statsJson, {}),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export async function toBroadcastDTOs(rows: Broadcast[]): Promise<BroadcastDTO[]> {
  const centerIds = Array.from(
    new Set(rows.flatMap((r) => safeJson<string[]>(r.targetCenterIdsJson, [])))
  );
  const centers = centerIds.length
    ? await db.evacuationCenter.findMany({ where: { id: { in: centerIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(centers.map((c) => [c.id, c.name]));
  return rows.map((r) =>
    toBroadcastDTO(r, safeJson<string[]>(r.targetCenterIdsJson, []).map((id) => nameById.get(id) ?? id))
  );
}

export function toDeliveryLogDTO(log: NotificationDeliveryLog & { broadcast?: { title: string } | null }): DeliveryLogDTO {
  return {
    id: log.id,
    broadcastId: log.broadcastId,
    broadcastTitle: log.broadcast?.title ?? null,
    channel: log.channel,
    target: log.target,
    priority: log.priority,
    status: log.status as DeliveryLogDTO["status"],
    deviceCount: log.deviceCount,
    deliveredCount: log.deliveredCount,
    openedCount: log.openedCount,
    error: log.error,
    sentByName: log.sentByName,
    createdAt: log.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Priority mapping helpers
// ---------------------------------------------------------------------------

const isUrgent = (p: string) => p === "URGENT" || p === "CRITICAL";

function announcementPriority(p: string): string {
  if (p === "CRITICAL" || p === "URGENT") return "CRITICAL";
  if (p === "IMPORTANT") return "HIGH";
  return "NORMAL";
}

function alertLevel(p: string): string {
  if (p === "CRITICAL") return "CRITICAL";
  if (p === "URGENT") return "WARNING";
  return "ADVISORY";
}

function tickerPriority(p: string): string {
  return isUrgent(p) ? "EMERGENCY" : "NORMAL";
}

function evacPriority(p: string): string {
  if (p === "CRITICAL") return "CRITICAL";
  if (p === "URGENT") return "URGENT";
  if (p === "IMPORTANT") return "HIGH";
  return "NORMAL";
}

function audienceLabel(b: Broadcast): string {
  const brgys = safeJson<string[]>(b.targetBarangaysJson, []);
  const base = b.targetAudience || "ALL";
  return brgys.length ? `${base} — ${brgys.join(", ")}` : base;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface BroadcastInput {
  title: string;
  message: string;
  priority?: string;
  channels: string[];
  targetAudience?: string;
  targetBarangays?: string[];
  targetCenterIds?: string[];
  expiresAt?: string | null;
}

export function validateBroadcastInput(input: BroadcastInput): {
  title: string;
  message: string;
  priority: BroadcastPriority;
  channels: BroadcastChannel[];
  targetAudience: string;
  targetBarangays: string[];
  targetCenterIds: string[];
  expiresAt: Date | null;
} {
  const title = String(input?.title ?? "").trim();
  const message = String(input?.message ?? "").trim();
  if (!title) throw new Error("Broadcast title is required.");
  if (title.length > 200) throw new Error("Title must be at most 200 characters.");
  if (!message) throw new Error("Broadcast message is required.");
  if (message.length > 5000) throw new Error("Message must be at most 5,000 characters.");
  const priority = ["NORMAL", "IMPORTANT", "URGENT", "CRITICAL"].includes(String(input?.priority))
    ? (String(input.priority) as BroadcastPriority)
    : "NORMAL";
  const channels = Array.isArray(input?.channels)
    ? input.channels.filter((c): c is BroadcastChannel => VALID_CHANNELS.includes(c as BroadcastChannel))
    : [];
  if (!channels.length) throw new Error("Select at least one broadcast channel.");
  const targetAudience = ["ALL", "RESIDENTS", "BARANGAY_OFFICIALS"].includes(String(input?.targetAudience))
    ? String(input.targetAudience)
    : "ALL";
  const targetBarangays = Array.isArray(input?.targetBarangays)
    ? input.targetBarangays.map((s) => String(s).trim()).filter(Boolean).slice(0, 33)
    : [];
  const targetCenterIds = Array.isArray(input?.targetCenterIds)
    ? input.targetCenterIds.map((s) => String(s).trim()).filter(Boolean).slice(0, 50)
    : [];
  let expiresAt: Date | null = null;
  if (input?.expiresAt) {
    const d = new Date(input.expiresAt);
    if (isNaN(d.getTime())) throw new Error("Expiration date is not a valid date/time.");
    expiresAt = d;
  }
  return { title, message, priority, channels, targetAudience, targetBarangays, targetCenterIds, expiresAt };
}

// ---------------------------------------------------------------------------
// Create / targets
// ---------------------------------------------------------------------------

export async function createBroadcast(
  input: BroadcastInput,
  actor: { id: string; name: string },
  status: "DRAFT" | "SCHEDULED" = "DRAFT",
  scheduledAt?: Date
): Promise<Broadcast> {
  const v = validateBroadcastInput(input);
  const broadcast = await db.broadcast.create({
    data: {
      title: v.title,
      message: v.message,
      priority: v.priority,
      channelsJson: JSON.stringify(v.channels),
      targetAudience: v.targetAudience,
      targetBarangaysJson: JSON.stringify(v.targetBarangays),
      targetCenterIdsJson: JSON.stringify(v.targetCenterIds),
      status,
      scheduledAt: scheduledAt ?? null,
      expiresAt: v.expiresAt,
    },
  });
  await createBroadcastTargets(broadcast);
  return broadcast;
}

async function createBroadcastTargets(b: Broadcast): Promise<void> {
  const brgys = safeJson<string[]>(b.targetBarangaysJson, []);
  const centerIds = safeJson<string[]>(b.targetCenterIdsJson, []);
  const rows: Array<{ broadcastId: string; targetType: string; targetRef: string; targetName: string | null }> = [];
  if (b.targetAudience === "ALL" || (!brgys.length && !centerIds.length)) {
    rows.push({ broadcastId: b.id, targetType: "ALL", targetRef: "ALL", targetName: "All recipients" });
  }
  for (const name of brgys) {
    rows.push({ broadcastId: b.id, targetType: "BARANGAY", targetRef: name, targetName: name });
  }
  if (centerIds.length) {
    const centers = await db.evacuationCenter.findMany({
      where: { id: { in: centerIds } },
      select: { id: true, name: true },
    });
    for (const c of centers) {
      rows.push({ broadcastId: b.id, targetType: "EVAC_CENTER", targetRef: c.id, targetName: c.name });
    }
  }
  if (rows.length) {
    await db.broadcastTarget.createMany({ data: rows });
  }
}

// ---------------------------------------------------------------------------
// Send now — fan out to every selected channel
// ---------------------------------------------------------------------------

export async function sendBroadcastNow(
  broadcastId: string,
  actor: { id: string; name: string }
): Promise<Broadcast> {
  const broadcast = await db.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) throw new Error("Broadcast not found.");
  if (broadcast.status === "SENT") throw new Error("This broadcast has already been sent.");
  if (broadcast.status === "CANCELLED") throw new Error("This broadcast was cancelled.");

  const settings = await getCommunicationSettings();
  const channels = safeJson<string[]>(broadcast.channelsJson, []);
  const targetBarangays = safeJson<string[]>(broadcast.targetBarangaysJson, []);
  const targetCenterIds = safeJson<string[]>(broadcast.targetCenterIdsJson, []);
  const priority = broadcast.priority as BroadcastPriority;
  const label = audienceLabel(broadcast);
  const now = new Date();
  const stats: Record<string, { ok: boolean; detail?: string }> = {};

  for (const channel of channels) {
    try {
      let detail = "";
      let deviceCount = 0;
      let deliveredCount = 0;
      switch (channel) {
        case "WEBSITE": {
          const row = await db.announcement.create({
            data: {
              title: broadcast.title,
              content: broadcast.message,
              category: isUrgent(priority) ? "EMERGENCY_ALERT" : "PUBLIC_ADVISORY",
              priority: announcementPriority(priority),
              areas: targetBarangays.length ? targetBarangays.join(", ") : null,
              status: "PUBLISHED",
              showOnHomepage: true,
              pinned: priority === "CRITICAL",
              expiresAt: broadcast.expiresAt,
              publishAt: now,
            },
          });
          detail = `Announcement created (${row.id})`;
          break;
        }
        case "HOME_BANNER": {
          const row = await db.publicAlert.create({
            data: {
              title: broadcast.title,
              level: alertLevel(priority),
              message: broadcast.message,
              active: true,
              expiresAt: broadcast.expiresAt,
              startsAt: now,
            },
          });
          detail = `Homepage banner created (${row.id})`;
          break;
        }
        case "TICKER": {
          const tickerText = `${broadcast.title} — ${broadcast.message}`.slice(0, 300);
          const row = await db.tickerMessage.create({
            data: {
              message: tickerText,
              priority: tickerPriority(priority),
              active: true,
              startsAt: now,
              endsAt: broadcast.expiresAt,
            },
          });
          detail = `Ticker message created (${row.id})`;
          break;
        }
        case "NEWS": {
          const categoryKey = isUrgent(priority) ? "EMERGENCY_ALERT" : "PUBLIC_ADVISORY";
          const category = await db.newsCategory.findUnique({ where: { key: categoryKey } });
          const row = await db.newsArticle.create({
            data: {
              title: broadcast.title,
              category: categoryKey,
              categoryId: category?.id ?? null,
              summary: broadcast.message.slice(0, 600),
              content: sanitizeRichText(broadcast.message, 60000) || broadcast.message,
              status: "PUBLISHED",
              publishAt: now,
              expiresAt: broadcast.expiresAt,
              emergency: isUrgent(priority),
              featured: priority === "CRITICAL",
              author: actor.name,
              targetAudience: broadcast.targetAudience,
              targetBarangays: targetBarangays.length ? targetBarangays.join(",") : null,
              createdById: actor.id,
              createdByName: actor.name,
            },
          });
          detail = `News post published (${row.id})`;
          break;
        }
        case "PUSH": {
          const result = await sendPush({
            title: broadcast.title,
            body: broadcast.message,
            url: "/",
            priority,
          });
          deviceCount = result.deviceCount;
          deliveredCount = result.sent;
          if (result.error) {
            detail = `Push not sent: ${result.error}`;
            stats[channel] = { ok: false, detail };
            await db.notificationDeliveryLog.create({
              data: {
                broadcastId: broadcast.id,
                channel,
                target: label,
                priority,
                status: "FAILED",
                deviceCount,
                deliveredCount,
                error: result.error,
                sentBy: actor.id,
                sentByName: actor.name,
              },
            });
            continue; // FAILED — do not overwrite below
          }
          detail = `Push sent to ${result.sent}/${result.deviceCount} devices`;
          if (priority === "CRITICAL") {
            await db.notification.create({
              data: {
                audience: "ADMIN",
                type: "SYSTEM",
                title: `CRITICAL broadcast: ${broadcast.title}`,
                body: broadcast.message.slice(0, 400),
                link: "/mdrrmo",
              },
            });
          }
          break;
        }
        case "EVAC_CENTER": {
          const row = await db.evacuationAnnouncement.create({
            data: {
              title: broadcast.title,
              message: broadcast.message,
              priority: evacPriority(priority),
              targetBarangays: targetBarangays.length ? targetBarangays.join(",") : null,
              targetCenterIds: JSON.stringify(targetCenterIds),
              status: "PUBLISHED",
              publishAt: now,
              expiresAt: broadcast.expiresAt,
              pushSent: channels.includes("PUSH"),
              createdBy: actor.id,
              createdByName: actor.name,
            },
          });
          detail = `Evacuation announcement published (${row.id})`;
          break;
        }
        case "DASHBOARD": {
          const row = await db.publicAlert.create({
            data: {
              title: `OPS: [${priority}] ${broadcast.title}`.slice(0, 200),
              level: "CRITICAL",
              message: broadcast.message,
              active: true,
              startsAt: now,
              expiresAt: broadcast.expiresAt,
            },
          });
          detail = `Ops-dashboard alert created (${row.id})`;
          break;
        }
        default:
          detail = `Unknown channel ${channel} — skipped`;
          stats[channel] = { ok: false, detail };
          continue;
      }

      stats[channel] = { ok: true, detail };
      await db.notificationDeliveryLog.create({
        data: {
          broadcastId: broadcast.id,
          channel,
          target: label,
          priority,
          status: "SENT",
          deviceCount,
          deliveredCount,
          sentBy: actor.id,
          sentByName: actor.name,
        },
      });
    } catch (e) {
      const error = e instanceof Error ? e.message.slice(0, 300) : String(e);
      stats[channel] = { ok: false, detail: error };
      await db.notificationDeliveryLog.create({
        data: {
          broadcastId: broadcast.id,
          channel,
          target: label,
          priority,
          status: "FAILED",
          error,
          sentBy: actor.id,
          sentByName: actor.name,
        },
      }).catch(() => undefined);
    }
  }

  const updated = await db.broadcast.update({
    where: { id: broadcast.id },
    data: {
      status: "SENT",
      sentAt: now,
      sentById: actor.id,
      sentByName: actor.name,
      statsJson: JSON.stringify(stats),
    },
  });

  await logAudit({
    actorType: "ADMIN",
    actorName: actor.name,
    action: "BROADCAST_SENT",
    detail: `"${broadcast.title}" [${priority}] → ${channels.join(", ")} (audience: ${label})`,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Schedule / cancel / duplicate / process due
// ---------------------------------------------------------------------------

export async function scheduleBroadcast(
  broadcastId: string,
  scheduledAt: string | Date,
  actor: { id: string; name: string }
): Promise<Broadcast> {
  const broadcast = await db.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) throw new Error("Broadcast not found.");
  if (broadcast.status !== "DRAFT") throw new Error("Only draft broadcasts can be scheduled.");
  const when = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (isNaN(when.getTime())) throw new Error("Scheduled date/time is not valid.");
  if (when.getTime() <= Date.now()) throw new Error("Scheduled time must be in the future.");

  const channels = safeJson<string[]>(broadcast.channelsJson, []);
  const label = audienceLabel(broadcast);
  const updated = await db.broadcast.update({
    where: { id: broadcast.id },
    data: { status: "SCHEDULED", scheduledAt: when },
  });
  if (channels.length) {
    await db.notificationDeliveryLog.createMany({
      data: channels.map((channel) => ({
        broadcastId: broadcast.id,
        channel,
        target: label,
        priority: broadcast.priority,
        status: "SCHEDULED",
        sentBy: actor.id,
        sentByName: actor.name,
      })),
    });
  }
  await logAudit({
    actorType: "ADMIN",
    actorName: actor.name,
    action: "BROADCAST_SCHEDULED",
    detail: `"${broadcast.title}" [${broadcast.priority}] scheduled for ${when.toISOString()} → ${channels.join(", ")}`,
  });
  return updated;
}

export async function cancelBroadcast(
  broadcastId: string,
  actor: { id: string; name: string }
): Promise<Broadcast> {
  const broadcast = await db.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) throw new Error("Broadcast not found.");
  if (broadcast.status !== "SCHEDULED") throw new Error("Only scheduled broadcasts can be cancelled.");
  const updated = await db.broadcast.update({ where: { id: broadcast.id }, data: { status: "CANCELLED" } });
  await db.notificationDeliveryLog.updateMany({
    where: { broadcastId: broadcast.id, status: "SCHEDULED" },
    data: { status: "CANCELLED" },
  });
  await logAudit({
    actorType: "ADMIN",
    actorName: actor.name,
    action: "BROADCAST_CANCELLED",
    detail: `"${broadcast.title}" cancelled (was scheduled for ${broadcast.scheduledAt?.toISOString() ?? "?"})`,
  });
  return updated;
}

export async function duplicateBroadcast(
  broadcastId: string,
  actor: { id: string; name: string }
): Promise<Broadcast> {
  const broadcast = await db.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) throw new Error("Broadcast not found.");
  const copy = await db.broadcast.create({
    data: {
      title: `${broadcast.title} (copy)`.slice(0, 200),
      message: broadcast.message,
      priority: broadcast.priority,
      channelsJson: broadcast.channelsJson,
      targetAudience: broadcast.targetAudience,
      targetBarangaysJson: broadcast.targetBarangaysJson,
      targetCenterIdsJson: broadcast.targetCenterIdsJson,
      status: "DRAFT",
      expiresAt: broadcast.expiresAt,
    },
  });
  await createBroadcastTargets(copy);
  await logAudit({
    actorType: "ADMIN",
    actorName: actor.name,
    action: "BROADCAST_DUPLICATED",
    detail: `"${broadcast.title}" duplicated as new draft`,
  });
  return copy;
}

/**
 * Opportunistic scheduler: send every SCHEDULED broadcast whose time has come.
 * Cheap query — called at the start of the broadcast list + public evacuation
 * endpoints.
 */
export async function processDueBroadcasts(actor?: { id: string; name: string }): Promise<number> {
  try {
    const due = await db.broadcast.findMany({
      where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    });
    for (const b of due) {
      await sendBroadcastNow(b.id, actor ?? { id: "system", name: "QAS33 Scheduler" });
    }
    return due.length;
  } catch (e) {
    console.error("processDueBroadcasts failed", e);
    return 0;
  }
}
