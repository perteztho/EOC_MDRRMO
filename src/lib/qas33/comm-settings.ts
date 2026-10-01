// QAS33 — Communication settings (SystemConfig scope "communication").
// Drives defaults for the Broadcast Center, push notifications, ticker and
// evacuation capacity thresholds. Stored as JSON in SiteConfig.published
// (live values — no draft/publish cycle for emergency configuration).
import { db } from "@/lib/db";
import {
  DEFAULT_COMMUNICATION_SETTINGS,
} from "./emergency-types";
import type { BroadcastPriority, CommunicationSettings } from "./emergency-types";

const SCOPE = "communication";

function parseSettings(raw: string | null | undefined): Partial<CommunicationSettings> {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Partial<CommunicationSettings>;
    }
  } catch {
    // corrupted JSON → fall back to defaults
  }
  return {};
}

/** Live communication settings merged over the defaults (deep-safe, per key). */
export async function getCommunicationSettings(): Promise<CommunicationSettings> {
  const row = await db.siteConfig.findUnique({ where: { scope: SCOPE } });
  const patch = parseSettings(row?.published);
  return { ...DEFAULT_COMMUNICATION_SETTINGS, ...patch };
}

function isBool(v: unknown): boolean {
  return v === true || v === false;
}

/**
 * Validate a partial patch and merge it over the current settings.
 * Throws Error with a readable message when validation fails.
 */
export async function saveCommunicationSettings(
  patch: Partial<CommunicationSettings>
): Promise<CommunicationSettings> {
  const current = await getCommunicationSettings();
  const next: CommunicationSettings = { ...current };

  if (patch.defaultPriority !== undefined) {
    if (!["NORMAL", "IMPORTANT", "URGENT", "CRITICAL"].includes(String(patch.defaultPriority))) {
      throw new Error("Default priority must be NORMAL, IMPORTANT, URGENT or CRITICAL.");
    }
    next.defaultPriority = patch.defaultPriority as BroadcastPriority;
  }
  if (patch.pushEnabled !== undefined) {
    if (!isBool(patch.pushEnabled)) throw new Error("Push enabled must be a boolean.");
    next.pushEnabled = patch.pushEnabled === true;
  }
  if (patch.notificationIcon !== undefined) {
    const icon = String(patch.notificationIcon).trim().slice(0, 60);
    next.notificationIcon = icon || DEFAULT_COMMUNICATION_SETTINGS.notificationIcon;
  }
  if (patch.bannerEnabled !== undefined) {
    if (!isBool(patch.bannerEnabled)) throw new Error("Banner enabled must be a boolean.");
    next.bannerEnabled = patch.bannerEnabled === true;
  }
  if (patch.bannerTitle !== undefined) {
    const t = String(patch.bannerTitle).trim().slice(0, 120);
    if (!t) throw new Error("Banner title cannot be empty.");
    next.bannerTitle = t;
  }
  if (patch.tickerEnabled !== undefined) {
    if (!isBool(patch.tickerEnabled)) throw new Error("Ticker enabled must be a boolean.");
    next.tickerEnabled = patch.tickerEnabled === true;
  }
  if (patch.tickerSpeed !== undefined) {
    const n = Number(patch.tickerSpeed);
    if (!Number.isFinite(n) || n < 10 || n > 300) throw new Error("Ticker speed must be between 10 and 300 seconds.");
    next.tickerSpeed = Math.round(n);
  }
  if (patch.autoExpireHours !== undefined) {
    const n = Number(patch.autoExpireHours);
    if (!Number.isFinite(n) || n < 0 || n > 2160) throw new Error("Auto-expire hours must be 0 or more (max 2160).");
    next.autoExpireHours = Math.round(n);
  }
  if (patch.evacNearCapacityThreshold !== undefined || patch.evacCriticalThreshold !== undefined) {
    const near = patch.evacNearCapacityThreshold !== undefined
      ? Math.round(Number(patch.evacNearCapacityThreshold))
      : current.evacNearCapacityThreshold;
    const critical = patch.evacCriticalThreshold !== undefined
      ? Math.round(Number(patch.evacCriticalThreshold))
      : current.evacCriticalThreshold;
    if (!Number.isFinite(near) || near < 1 || near > 99) throw new Error("Near-capacity threshold must be between 1 and 99%.");
    if (!Number.isFinite(critical) || critical < 1 || critical > 99) throw new Error("Critical threshold must be between 1 and 99%.");
    if (near >= critical) throw new Error("Near-capacity threshold must be lower than the critical threshold.");
    next.evacNearCapacityThreshold = near;
    next.evacCriticalThreshold = critical;
  }
  if (patch.publicEvacPageVisible !== undefined) {
    if (!isBool(patch.publicEvacPageVisible)) throw new Error("Public evacuation page visibility must be a boolean.");
    next.publicEvacPageVisible = patch.publicEvacPageVisible === true;
  }
  if (patch.defaultPublishStatus !== undefined) {
    if (!["DRAFT", "PUBLISHED"].includes(String(patch.defaultPublishStatus))) {
      throw new Error("Default publish status must be DRAFT or PUBLISHED.");
    }
    next.defaultPublishStatus = patch.defaultPublishStatus;
  }
  if (patch.typhoonPriorityBoost !== undefined) {
    if (!isBool(patch.typhoonPriorityBoost)) throw new Error("Typhoon priority boost must be a boolean.");
    next.typhoonPriorityBoost = patch.typhoonPriorityBoost === true;
  }
  if (patch.criticalConfirmRequired !== undefined) {
    if (!isBool(patch.criticalConfirmRequired)) throw new Error("Critical confirmation requirement must be a boolean.");
    next.criticalConfirmRequired = patch.criticalConfirmRequired === true;
  }

  await db.siteConfig.upsert({
    where: { scope: SCOPE },
    create: { scope: SCOPE, draft: "{}", published: JSON.stringify(next) },
    update: { published: JSON.stringify(next) },
  });
  return next;
}

/** Which top-level keys differ between two settings objects (for audit detail). */
export function changedSettingKeys(
  before: CommunicationSettings,
  after: CommunicationSettings
): string[] {
  const keys = Object.keys(DEFAULT_COMMUNICATION_SETTINGS) as Array<keyof CommunicationSettings>;
  return keys.filter((k) => String(before[k]) !== String(after[k]));
}
