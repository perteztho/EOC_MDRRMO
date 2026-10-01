// QAS33 — Web Push Notifications service (VAPID, web-push library).
// Server-side ONLY: VAPID keys come from the environment and never reach the
// browser (the public key is safe to expose — it is how subscriptions are made).
import { db } from "@/lib/db";
import { getCommunicationSettings } from "./comm-settings";
import type { PushStatusDTO } from "./emergency-types";

function vapidKeys() {
  return {
    publicKey: (process.env.PUSH_VAPID_PUBLIC_KEY || "").trim(),
    privateKey: (process.env.PUSH_VAPID_PRIVATE_KEY || "").trim(),
    contact: (process.env.PUSH_CONTACT || "mailto:mdrrmo@pioduran.gov.ph").trim(),
  };
}

export async function getPushStatus(): Promise<PushStatusDTO> {
  const [settings, subscriptions] = await Promise.all([
    getCommunicationSettings(),
    db.notificationSubscription.count({ where: { active: true } }),
  ]);
  const { publicKey, privateKey } = vapidKeys();
  const configured = Boolean(publicKey && privateKey);
  return {
    enabled: settings.pushEnabled && configured,
    configured,
    publicKey: configured ? publicKey : null,
    subscriptions,
    provider: configured ? "web-push (VAPID)" : "none",
  };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  priority?: string;
}

export interface PushSendResult {
  sent: number;
  failed: number;
  deviceCount: number;
  error?: string;
}

/**
 * Fan out a web push to every active subscription. Subscriptions that the push
 * service reports as gone (404/410) are deactivated automatically.
 */
export async function sendPush(payload: PushPayload): Promise<PushSendResult> {
  const settings = await getCommunicationSettings();
  const { publicKey, privateKey, contact } = vapidKeys();
  if (!publicKey || !privateKey) {
    return { sent: 0, failed: 0, deviceCount: 0, error: "not_configured" };
  }
  if (!settings.pushEnabled) {
    return { sent: 0, failed: 0, deviceCount: 0, error: "push_disabled" };
  }

  const subs = await db.notificationSubscription.findMany({ where: { active: true } });
  if (!subs.length) {
    return { sent: 0, failed: 0, deviceCount: 0 };
  }

  // web-push is a Node-only library — required lazily so it never ends up in a
  // client bundle (typed via the module's own type definitions).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const webpush: typeof import("web-push") = require("web-push");
  webpush.setVapidDetails(contact, publicKey, privateKey);

  // Web Push payloads must stay under the 4096-byte encrypted-payload limit —
  // long broadcast bodies (up to 5,000 chars) are truncated until the
  // serialized JSON fits, otherwise web-push rejects every send.
  const buildMessage = (body: string) =>
    JSON.stringify({
      title: payload.title,
      body,
      url: payload.url || "/",
      tag: payload.tag || "qas33",
      priority: payload.priority || "NORMAL",
    });
  let body = payload.body;
  let message = buildMessage(body);
  while (Buffer.byteLength(message, "utf8") > 4000 && body.length > 0) {
    body = body.slice(0, Math.max(1, Math.floor(body.length * 0.9)));
    message = buildMessage(body);
  }

  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
          { TTL: 3600 }
        );
        sent++;
        await db.notificationSubscription
          .update({ where: { id: sub.id }, data: { lastSeenAt: new Date() } })
          .catch(() => undefined);
      } catch (e) {
        failed++;
        const statusCode = (e as { statusCode?: number }).statusCode;
        // 404 / 410 — subscription no longer exists on the push service
        if (statusCode === 404 || statusCode === 410) {
          await db.notificationSubscription
            .update({ where: { id: sub.id }, data: { active: false } })
            .catch(() => undefined);
        }
      }
    })
  );

  return { sent, failed, deviceCount: subs.length };
}
