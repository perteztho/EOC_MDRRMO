// QAS33 Public Portal — generic content CRUD mapping & validation
// Driven by CONTENT_TYPES definitions (shared with the admin UI forms).

import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { getContentTypeDef } from "./portal-types";
import type { ContentFieldDef } from "./portal-types";
import { sanitizeText, sanitizeUrl, clampInt } from "./portal-server";

type Delegate =
  | "announcement"
  | "tickerMessage"
  | "emergencyHotline"
  | "publicAlert"
  | "newsArticle"
  | "preparednessTopic"
  | "evacuationCenter";

const TYPE_DELEGATES: Record<string, Delegate> = {
  announcements: "announcement",
  ticker: "tickerMessage",
  hotlines: "emergencyHotline",
  alerts: "publicAlert",
  news: "newsArticle",
  preparedness: "preparednessTopic",
  evacuation: "evacuationCenter",
};

export function contentDelegate(typeKey: string) {
  const delegate = TYPE_DELEGATES[typeKey];
  if (!delegate) return null;
  return (db as unknown as Record<Delegate, unknown>)[delegate] as {
    findMany: (args?: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
    create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
    update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
    delete: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
    count: (args?: Record<string, unknown>) => Promise<number>;
  };
}

function coerceField(field: ContentFieldDef, raw: unknown): { value: unknown; error?: string } {
  if (field.type === "boolean") {
    return { value: raw === true || raw === "true" || raw === "on" };
  }
  if (field.type === "number") {
    if (raw === "" || raw == null) return { value: field.default !== undefined ? field.default : null };
    return { value: clampInt(raw, -(10 ** 8), 10 ** 8, 0) };
  }
  if (field.type === "datetime") {
    if (raw === "now") return { value: new Date() };
    if (typeof raw !== "string" || !raw.trim()) return { value: null };
    const d = new Date(raw);
    if (isNaN(d.getTime())) return { value: null, error: `${field.label} is not a valid date.` };
    return { value: d };
  }
  if (field.type === "select") {
    const s = typeof raw === "string" ? raw : "";
    const allowed = (field.options ?? []).map((o) => o.value);
    if (!allowed.includes(s)) return { value: field.default ?? allowed[0] ?? "" };
    return { value: s };
  }
  if (field.type === "url") {
    return { value: sanitizeUrl(raw) };
  }
  // text / textarea
  const max = field.max ?? 500;
  return { value: sanitizeText(raw, max) };
}

/** Validate & coerce a payload against a content type definition. */
export function validateContentPayload(
  typeKey: string,
  payload: Record<string, unknown>,
  { partial = false }: { partial?: boolean } = {}
): { data: Record<string, unknown>; errors: string[] } {
  const def = getContentTypeDef(typeKey);
  const errors: string[] = [];
  const data: Record<string, unknown> = {};
  if (!def) return { data, errors: ["Unknown content type."] };

  for (const field of def.fields) {
    const present = Object.prototype.hasOwnProperty.call(payload, field.name);
    if (partial && !present) continue;
    const raw = present ? payload[field.name] : field.default;
    if (!present && field.default === undefined) {
      if (field.required) {
        errors.push(`${field.label} is required.`);
        continue;
      }
      if (partial) continue;
      // absent & optional & no default → null/false
      data[field.name] = field.type === "boolean" ? false : null;
      continue;
    }
    const { value, error } = coerceField(field, raw);
    if (error) errors.push(error);
    if (field.required && (value === "" || value == null)) {
      errors.push(`${field.label} is required.`);
      continue;
    }
    data[field.name] = value;
  }
  return { data, errors };
}
