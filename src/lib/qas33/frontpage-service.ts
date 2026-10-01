// QAS33 — Barangay frontpage service (server-side).
//
// Reads/writes BarangayFrontpage rows, merges saved content over DB-derived
// defaults, resolves slugs through the 33-barangay registry, and powers the
// public frontpage APIs plus the barangay portal Frontpage manager.

import { db } from "@/lib/db";
import { logAudit } from "@/lib/qas33/audit";
import { sanitizeText } from "@/lib/qas33/portal-server";
import { getDraftConfig } from "@/lib/qas33/portal-server";
import type { GeneralSettings } from "@/lib/qas33/portal-types";
import {
  BARANGAY_REGISTRY,
  bareBarangayName,
  registryBySlug,
  type BarangayRegistryEntry,
  type BarangayTheme,
} from "@/lib/qas33/barangay-registry";
import {
  FRONTPAGE_LIMITS,
  buildDefaultFrontpageContent,
  mergeFrontpageContent,
  type BarangayFrontpageContent,
  type FrontpageAnnouncement,
  type FrontpageEvent,
  type FrontpageService,
} from "@/lib/qas33/frontpage-types";

// ---------------------------------------------------------------------------
// Public payload shapes (shared with the client via api.ts)
// ---------------------------------------------------------------------------

export interface PublicBarangaySummary {
  code: string;
  name: string;
  bareName: string;
  slug: string;
  captain: string | null;
  population: number | null;
  logoUrl: string | null;
  theme: { primary: string; accent: string };
}

export interface FrontpageCouncilMember {
  id: string;
  name: string;
  position: string; // PUNONG_BARANGAY | KAGAWAD | SK_CHAIRPERSON | SECRETARY | TREASURER
  committee: string | null;
}

/** Real purok profile row (brgy_per_purok_profile data) for the public page. */
export interface FrontpagePurok {
  name: string;
  households: number;
  families: number;
  population: number;
  male: number;
  female: number;
  seniors: number;
  pwd: number;
  soloParents: number;
  fourPs: number | null;
}

export interface BarangayFrontpageResponse {
  ok: true;
  barangay: {
    code: string;
    name: string;
    bareName: string;
    slug: string;
    captain: string | null;
    locArea: "up-land" | "coastal" | null;
    brgyClass: "rural" | "urban" | null;
  };
  theme: BarangayTheme;
  content: BarangayFrontpageContent;
  council: FrontpageCouncilMember[];
  puroks: FrontpagePurok[];
  residentCount: number;
  published: boolean;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// List + slug resolution
// ---------------------------------------------------------------------------

export async function listBarangaysPublic(): Promise<PublicBarangaySummary[]> {
  const rows = await db.barangay.findMany({
    where: { active: true },
    select: { code: true, name: true, captain: true, population: true, logoUrl: true },
    orderBy: { code: "asc" },
  });
  return rows.map((r) => {
    const reg: BarangayRegistryEntry | null =
      BARANGAY_REGISTRY.find((e) => e.code === r.code) ?? null;
    const theme = reg?.theme ?? { primary: "#0B5D3E", primaryDark: "#073E2A", accent: "#E8A317" };
    return {
      code: r.code,
      name: r.name,
      bareName: bareBarangayName(r.name),
      slug: reg?.slug ?? r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      captain: r.captain,
      population: r.population,
      logoUrl: r.logoUrl,
      theme: { primary: theme.primary, accent: theme.accent },
    };
  });
}

/** Real purok + demographic rows → public purok profile list (ordered). */
function toFrontpagePuroks(
  zones: Array<{ name: string; order: number; demographics: {
    households: number; families: number; population: number; male: number; female: number;
    age60plus: number; pwd: number; soloParents: number; fourPs: number | null;
  } | null }>
): FrontpagePurok[] {
  return zones
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((p) => ({
      name: p.name,
      households: p.demographics?.households ?? 0,
      families: p.demographics?.families ?? 0,
      population: p.demographics?.population ?? 0,
      male: p.demographics?.male ?? 0,
      female: p.demographics?.female ?? 0,
      seniors: p.demographics?.age60plus ?? 0,
      pwd: p.demographics?.pwd ?? 0,
      soloParents: p.demographics?.soloParents ?? 0,
      fourPs: p.demographics?.fourPs ?? null,
    }));
}

async function resolveBarangayBySlug(slug: string) {
  const normalized = slug.trim().toLowerCase();
  const reg = registryBySlug(normalized);
  if (!reg) return null;
  const barangay = await db.barangay.findUnique({ where: { code: reg.code } });
  if (!barangay || !barangay.active) return null;
  return { barangay, reg };
}

// ---------------------------------------------------------------------------
// Public frontpage payload
// ---------------------------------------------------------------------------

export async function getFrontpageBySlug(slug: string): Promise<BarangayFrontpageResponse | null> {
  const resolved = await resolveBarangayBySlug(slug);
  if (!resolved) return null;
  const { barangay, reg } = resolved;

  const [row, officials, residentCount, docCount, general, purokZones, boundary] = await Promise.all([
    db.barangayFrontpage.findUnique({ where: { barangayId: barangay.id } }),
    db.barangayOfficial.findMany({
      where: { barangayId: barangay.id, active: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    db.residentAccount.count({ where: { barangayId: barangay.id, status: "ACTIVE" } }),
    db.serviceDocument.count({ where: { barangayId: barangay.id, status: "ISSUED" } }),
    getDraftConfig<GeneralSettings>("general").catch(() => null),
    db.purok.findMany({
      where: { barangayId: barangay.id, active: true },
      include: { demographics: true },
      orderBy: { order: "asc" },
    }),
    db.barangayBoundary.findUnique({ where: { barangayId: barangay.id } }),
  ]);
  const puroks = toFrontpagePuroks(purokZones);
  const seniors = puroks.reduce((a, p) => a + p.seniors, 0);
  const pwd = puroks.reduce((a, p) => a + p.pwd, 0);

  // Defaults: real DB profile + purok demographic sums + MDRRMO fallback contact.
  const defaults = buildDefaultFrontpageContent({
    name: barangay.name,
    captain: barangay.captain,
    population: barangay.population,
    households: barangay.households,
    puroks: puroks.length > 0 ? puroks.length : barangay.puroks,
    clearancesIssued: docCount,
    vision: barangay.vision,
    mission: barangay.mission,
    goals: barangay.goals,
    objectives: barangay.objectives,
    logoUrl: barangay.logoUrl,
    seniors,
    pwd,
  });
  if (!defaults.contact.emergency && general?.hotline) {
    defaults.contact.emergency = `MDRRMO Hotline: ${general.hotline}`;
  }
  if (general?.contactPhone && !defaults.contact.phone) defaults.contact.phone = general.contactPhone;
  if (general?.contactEmail && !defaults.contact.email) defaults.contact.email = general.contactEmail;

  let content = defaults;
  let published = true;
  let updatedAt: string | null = null;
  if (row) {
    try {
      const parsed = JSON.parse(row.content) as Partial<BarangayFrontpageContent>;
      content = mergeFrontpageContent(defaults, parsed);
    } catch {
      content = defaults;
    }
    published = row.published;
    updatedAt = row.updatedAt.toISOString();
  }

  const themeOverride = content.theme;
  const theme: BarangayTheme = themeOverride
    ? { ...reg.theme, primary: themeOverride.primary, accent: themeOverride.accent }
    : reg.theme;

  return {
    ok: true,
    barangay: {
      code: barangay.code,
      name: barangay.name,
      bareName: bareBarangayName(barangay.name),
      slug: reg.slug,
      captain: barangay.captain,
      locArea: boundary ? (boundary.coastal ? "coastal" : boundary.upland ? "up-land" : null) : null,
      brgyClass: boundary ? (boundary.urban ? "urban" : "rural") : null,
    },
    theme,
    content,
    council: officials.map((o) => ({ id: o.id, name: o.name, position: o.position, committee: o.committee })),
    puroks,
    residentCount,
    published,
    updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Privacy-safe public resident lookup (name + purok only)
// ---------------------------------------------------------------------------

export async function searchResidentsPublic(barangayId: string, query: string) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = await db.residentAccount.findMany({
    where: {
      barangayId,
      status: "ACTIVE",
      OR: [
        { fullName: { contains: query.trim() } },
        { fullName: { contains: query.trim().toLowerCase() } },
        { fullName: { contains: capitalizeWords(query.trim()) } },
      ],
    },
    select: { id: true, fullName: true, purok: true },
    take: 10,
    orderBy: { fullName: "asc" },
  });
  // SQLite `contains` is case-sensitive — filter client-side as a fallback.
  const lowered = q;
  return rows
    .filter((r) => r.fullName.toLowerCase().includes(lowered))
    .map((r) => ({ fullName: r.fullName, purok: r.purok ?? "—" }));
}

function capitalizeWords(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Inquiries (contact form + service requests from the frontpage)
// ---------------------------------------------------------------------------

export async function createFrontpageInquiry(
  barangayId: string,
  input: { kind: string; name: string; contact: string; service: string; message: string }
) {
  const kind = input.kind === "SERVICE_REQUEST" ? "SERVICE_REQUEST" : "MESSAGE";
  const name = sanitizeText(input.name, 100);
  const contact = sanitizeText(input.contact, 120) || null;
  const service = kind === "SERVICE_REQUEST" ? sanitizeText(input.service, 140) || null : null;
  const message = sanitizeText(input.message, 1500);
  if (name.length < 2) throw new Error("Please provide your name.");
  if (message.length < 10) throw new Error("Your message must be at least 10 characters long.");
  const row = await db.frontpageInquiry.create({
    data: { barangayId, kind, name, contact, service, message, status: "NEW" },
  });
  return row;
}

/** Resolve a public slug to its barangay id (for inquiry submission). */
export async function resolveBarangayIdBySlug(slug: string): Promise<string | null> {
  const resolved = await resolveBarangayBySlug(slug);
  return resolved?.barangay.id ?? null;
}

export async function listFrontpageInquiries(barangayId: string) {
  const rows = await db.frontpageInquiry.findMany({
    where: { barangayId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    contact: r.contact,
    service: r.service,
    message: r.message,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function setFrontpageInquiryStatus(barangayId: string, id: string, status: string) {
  const next = status === "DONE" ? "DONE" : "NEW";
  const row = await db.frontpageInquiry.findUnique({ where: { id } });
  if (!row || row.barangayId !== barangayId) throw new Error("Inquiry not found.");
  await db.frontpageInquiry.update({ where: { id }, data: { status: next } });
  return next;
}

// ---------------------------------------------------------------------------
// Save / reset (barangay portal Frontpage manager)
// ---------------------------------------------------------------------------

function clampInt(v: unknown, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : 0;
  return Math.max(0, Math.min(max, n));
}

function validHex(v: unknown): string | null {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toUpperCase() : null;
}

function validUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = sanitizeText(v, FRONTPAGE_LIMITS.url);
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : "";
}

function strList(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => sanitizeText(x, maxLen))
    .filter((x) => x.length > 0)
    .slice(0, maxItems);
}

/**
 * Validate + sanitize a client-supplied content document. Unknown/garbage
 * fields are dropped; every string is length-capped; URLs must be http(s);
 * theme colors must be 6-digit hex. Returns the clean document.
 */
export function sanitizeFrontpageContent(input: unknown): BarangayFrontpageContent {
  if (!input || typeof input !== "object") throw new Error("Invalid frontpage content.");
  const raw = input as Record<string, unknown>;
  const c = raw.contact && typeof raw.contact === "object" ? (raw.contact as Record<string, unknown>) : {};
  const s = raw.statistics && typeof raw.statistics === "object" ? (raw.statistics as Record<string, unknown>) : {};

  const announcements: FrontpageAnnouncement[] = (Array.isArray(raw.announcements) ? raw.announcements : [])
    .slice(0, FRONTPAGE_LIMITS.announcements)
    .map((a, i) => {
      const o = (a ?? {}) as Record<string, unknown>;
      return {
        id: sanitizeText(o.id, 40) || `ann-${i + 1}`,
        title: sanitizeText(o.title, FRONTPAGE_LIMITS.announcementTitle),
        category: sanitizeText(o.category, 40) || "Advisory",
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(o.date ?? "")) ? String(o.date) : new Date().toISOString().slice(0, 10),
        content: sanitizeText(o.content, FRONTPAGE_LIMITS.announcementContent),
        pinned: o.pinned === true,
      };
    })
    .filter((a) => a.title.length > 0);

  const events: FrontpageEvent[] = (Array.isArray(raw.events) ? raw.events : [])
    .slice(0, FRONTPAGE_LIMITS.events)
    .map((e, i) => {
      const o = (e ?? {}) as Record<string, unknown>;
      return {
        id: sanitizeText(o.id, 40) || `evt-${i + 1}`,
        title: sanitizeText(o.title, FRONTPAGE_LIMITS.eventTitle),
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(o.date ?? "")) ? String(o.date) : new Date().toISOString().slice(0, 10),
        time: sanitizeText(o.time, 60),
        venue: sanitizeText(o.venue, 140),
        description: sanitizeText(o.description, FRONTPAGE_LIMITS.eventDesc),
      };
    })
    .filter((e) => e.title.length > 0);

  const services: FrontpageService[] = (Array.isArray(raw.services) ? raw.services : [])
    .slice(0, FRONTPAGE_LIMITS.services)
    .map((sv, i) => {
      const o = (sv ?? {}) as Record<string, unknown>;
      return {
        id: sanitizeText(o.id, 40) || `svc-${i + 1}`,
        title: sanitizeText(o.title, FRONTPAGE_LIMITS.serviceTitle),
        desc: sanitizeText(o.desc, FRONTPAGE_LIMITS.serviceDesc),
        fee: sanitizeText(o.fee, 60) || "Free",
        processingTime: sanitizeText(o.processingTime, 60) || "Same day",
        requirements: strList(o.requirements, FRONTPAGE_LIMITS.requirements, FRONTPAGE_LIMITS.requirement),
        icon: sanitizeText(o.icon, 8) || "📄",
      };
    })
    .filter((sv) => sv.title.length > 0);

  const themePrimary = raw.theme && typeof raw.theme === "object" ? validHex((raw.theme as Record<string, unknown>).primary) : null;
  const themeAccent = raw.theme && typeof raw.theme === "object" ? validHex((raw.theme as Record<string, unknown>).accent) : null;

  return {
    tagline: sanitizeText(raw.tagline, FRONTPAGE_LIMITS.tagline),
    welcomeMessage: sanitizeText(raw.welcomeMessage, FRONTPAGE_LIMITS.welcomeMessage),
    history: sanitizeText(raw.history, FRONTPAGE_LIMITS.history),
    vision: sanitizeText(raw.vision, FRONTPAGE_LIMITS.vision),
    mission: sanitizeText(raw.mission, FRONTPAGE_LIMITS.mission),
    goals: strList(raw.goals, FRONTPAGE_LIMITS.listItems, FRONTPAGE_LIMITS.listItem),
    objectives: strList(raw.objectives, FRONTPAGE_LIMITS.listItems, FRONTPAGE_LIMITS.listItem),
    logoUrl: validUrl(raw.logoUrl),
    heroImage: validUrl(raw.heroImage),
    address: sanitizeText(raw.address, FRONTPAGE_LIMITS.address),
    contact: {
      phone: sanitizeText(c.phone, FRONTPAGE_LIMITS.contactField),
      mobile: sanitizeText(c.mobile, FRONTPAGE_LIMITS.contactField),
      email: sanitizeText(c.email, FRONTPAGE_LIMITS.contactField),
      facebook: validUrl(c.facebook),
      officeHours: sanitizeText(c.officeHours, FRONTPAGE_LIMITS.contactField),
      emergency: sanitizeText(c.emergency, FRONTPAGE_LIMITS.emergency),
    },
    statistics: {
      population: clampInt(s.population, FRONTPAGE_LIMITS.statsMax),
      households: clampInt(s.households, FRONTPAGE_LIMITS.statsMax),
      puroks: clampInt(s.puroks, 10000),
      voters: clampInt(s.voters, FRONTPAGE_LIMITS.statsMax),
      seniors: clampInt(s.seniors, FRONTPAGE_LIMITS.statsMax),
      pwd: clampInt(s.pwd, FRONTPAGE_LIMITS.statsMax),
      clearancesIssued: clampInt(s.clearancesIssued, FRONTPAGE_LIMITS.statsMax),
    },
    announcements,
    events,
    services,
    theme: themePrimary && themeAccent ? { primary: themePrimary, accent: themeAccent } : null,
  };
}

export interface FrontpageManagerPayload {
  ok: true;
  slug: string;
  content: BarangayFrontpageContent;
  defaultTheme: BarangayTheme;
  published: boolean;
  savedAt: string | null;
  inquiries: Array<{
    id: string;
    kind: string;
    name: string;
    contact: string | null;
    service: string | null;
    message: string;
    status: string;
    createdAt: string;
  }>;
  counts: { residents: number; documents: number; inquiriesNew: number };
}

/** Effective content + inquiries for the barangay portal Frontpage manager. */
export async function getFrontpageManager(barangayId: string, barangayCode: string, barangayName: string): Promise<FrontpageManagerPayload> {
  const reg = BARANGAY_REGISTRY.find((e) => e.code === barangayCode) ?? null;
  const slug = reg?.slug ?? barangayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const [row, barangay, inquiries, residents, documents, purokZones] = await Promise.all([
    db.barangayFrontpage.findUnique({ where: { barangayId } }),
    db.barangay.findUnique({ where: { id: barangayId } }),
    listFrontpageInquiries(barangayId),
    db.residentAccount.count({ where: { barangayId, status: "ACTIVE" } }),
    db.serviceDocument.count({ where: { barangayId, status: "ISSUED" } }),
    db.purok.findMany({
      where: { barangayId, active: true },
      include: { demographics: true },
      orderBy: { order: "asc" },
    }),
  ]);
  const puroks = toFrontpagePuroks(purokZones);
  const seniors = puroks.reduce((a, p) => a + p.seniors, 0);
  const pwd = puroks.reduce((a, p) => a + p.pwd, 0);
  const defaults = buildDefaultFrontpageContent({
    name: barangay?.name ?? barangayName,
    captain: barangay?.captain ?? null,
    population: barangay?.population ?? null,
    households: barangay?.households ?? null,
    puroks: puroks.length > 0 ? puroks.length : (barangay?.puroks ?? null),
    clearancesIssued: documents,
    vision: barangay?.vision,
    mission: barangay?.mission,
    goals: barangay?.goals,
    objectives: barangay?.objectives,
    logoUrl: barangay?.logoUrl,
    seniors,
    pwd,
  });
  let content = defaults;
  if (row) {
    try {
      content = mergeFrontpageContent(defaults, JSON.parse(row.content) as Partial<BarangayFrontpageContent>);
    } catch {
      content = defaults;
    }
  }
  return {
    ok: true,
    slug,
    content,
    defaultTheme: reg?.theme ?? { primary: "#0B5D3E", primaryDark: "#073E2A", accent: "#E8A317" },
    published: row ? row.published : true,
    savedAt: row ? row.updatedAt.toISOString() : null,
    inquiries,
    counts: {
      residents,
      documents,
      inquiriesNew: inquiries.filter((i) => i.status === "NEW").length,
    },
  };
}

export async function saveFrontpage(
  barangayId: string,
  barangayCode: string,
  contentInput: unknown,
  published: boolean,
  editorDescription: string
): Promise<void> {
  const content = sanitizeFrontpageContent(contentInput);
  await db.barangayFrontpage.upsert({
    where: { barangayId },
    create: { barangayId, content: JSON.stringify(content), published, updatedBy: editorDescription },
    update: { content: JSON.stringify(content), published, updatedBy: editorDescription },
  });
  await logAudit({
    actorType: "BARANGAY",
    barangayId,
    actorName: editorDescription,
    action: "FRONTPAGE_SAVED",
    detail: `Public frontpage content ${published ? "published" : "saved as unpublished"} (${barangayCode}).`,
  }).catch(() => undefined);
}

/**
 * Toggle only the published flag of a barangay's public frontpage — without
 * touching the saved content. Used by the barangay portal Settings page
 * (quick publish / hide switch). If the barangay never saved customizations,
 * a minimal row is created so the hidden state still persists (the public
 * page merges `{}` content over the DB-derived defaults, so it renders the
 * exact same default page).
 */
export async function setFrontpagePublished(
  barangayId: string,
  barangayCode: string,
  published: boolean,
  editorDescription: string
): Promise<void> {
  await db.barangayFrontpage.upsert({
    where: { barangayId },
    create: { barangayId, content: "{}", published, updatedBy: editorDescription },
    update: { published, updatedBy: editorDescription },
  });
  await logAudit({
    actorType: "BARANGAY",
    barangayId,
    actorName: editorDescription,
    action: published ? "FRONTPAGE_PUBLISHED" : "FRONTPAGE_HIDDEN",
    detail: `Public frontpage ${published ? "published — visible at /barangay" : "hidden from the public"} (settings quick toggle, ${barangayCode}).`,
  }).catch(() => undefined);
}

export async function resetFrontpage(barangayId: string, editorDescription: string): Promise<void> {
  await db.barangayFrontpage.deleteMany({ where: { barangayId } });
  await logAudit({
    actorType: "BARANGAY",
    barangayId,
    actorName: editorDescription,
    action: "FRONTPAGE_RESET",
    detail: "Public frontpage content reset to system defaults.",
  }).catch(() => undefined);
}
