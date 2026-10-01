// QAS33 Public Portal — server engine
// Draft/published configuration, snapshot publish / restore / reset, sanitization
// and content mapping helpers. All portal API routes use this module.

import { db } from "@/lib/db";
import { invalidateCache } from "./cache";
import type {
  AlertSettings,
  CustomWidgetBlock,
  FooterSettings,
  GeneralSettings,
  HomepageResponse,
  NavigationSettings,
  OperationalMode,
  OperationalSettings,
  PublicSection,
  PublicWidget,
  SectionConfig,
  SectionLinkConfig,
  SectionStatus,
  SiteConfigScope,
  WeatherSettings,
  WidgetConfig,
  WidgetType,
  SectionTemplate,
} from "./portal-types";
import { DEFAULT_SECTION_CONFIG, DEFAULT_WIDGET_CONFIG, visualModeOf } from "./portal-types";
import {
  DEFAULT_ALERT,
  DEFAULT_FOOTER,
  DEFAULT_GENERAL,
  DEFAULT_NAVIGATION,
  DEFAULT_OPERATIONAL,
  DEFAULT_SECTIONS,
  DEFAULT_WEATHER,
  DEFAULT_WIDGETS,
  SEED_ANNOUNCEMENTS,
  SEED_HOTLINES,
  SEED_PREPAREDNESS,
  SEED_TICKER,
  templateDefaultConfig,
} from "./portal-defaults";

// ---------------------------------------------------------------------------
// Sanitization helpers (defense in depth — React text rendering prevents XSS,
// these guards constrain lengths, enums and URL schemes)
// ---------------------------------------------------------------------------

export function sanitizeText(value: unknown, max = 400): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

export function sanitizeUrl(value: unknown, max = 500): string {
  if (typeof value !== "string") return "";
  const s = value.trim().slice(0, max);
  if (!s) return "";
  if (/^(https?:\/\/|tel:|mailto:)/i.test(s)) return s;
  if (s.startsWith("/")) return s; // same-app relative
  return ""; // blocks javascript:, data:, vbscript: etc.
}

export function sanitizeHexColor(value: unknown): string {
  if (typeof value !== "string") return "";
  const s = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : "";
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function sanitizeLink(value: unknown): SectionLinkConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Partial<SectionLinkConfig>;
  const kind = oneOf(v.kind, ["none", "anchor", "url", "modal", "app"] as const, "none");
  if (kind === "none") return { kind: "none" };
  const link: SectionLinkConfig = { kind };
  if (kind === "anchor") link.anchor = sanitizeText(v.anchor, 60).replace(/[^a-zA-Z0-9-_]/g, "");
  if (kind === "url") link.url = sanitizeUrl(v.url);
  if (kind === "modal") link.modal = oneOf(v.modal, ["hotlines", "report", "login-admin", "login-barangay"] as const, "hotlines");
  if (kind === "app") link.app = "verify";
  link.target = v.target === "new" ? "new" : "same";
  return link;
}

const SAFE_CSS_CLASSES = new Set(["", "portal-compact", "portal-divider", "portal-center"]);

export function sanitizeSectionConfig(raw: unknown): SectionConfig {
  const v = (raw && typeof raw === "object" ? raw : {}) as Partial<SectionConfig>;
  const items = Array.isArray(v.items)
    ? v.items.slice(0, 24).map((it) => ({
        label: sanitizeText((it as { label?: unknown })?.label, 120),
        description: sanitizeText((it as { description?: unknown })?.description, 400) || undefined,
        icon: sanitizeText((it as { icon?: unknown })?.icon, 40) || undefined,
        color: sanitizeText((it as { color?: unknown })?.color, 20) || undefined,
        value: sanitizeText((it as { value?: unknown })?.value, 40) || undefined,
        sub: sanitizeText((it as { sub?: unknown })?.sub, 80) || undefined,
        link: sanitizeLink((it as { link?: unknown })?.link),
      }))
    : [];
  const cfg: SectionConfig = {
    visibleDesktop: v.visibleDesktop !== false,
    visibleTablet: v.visibleTablet !== false,
    visibleMobile: v.visibleMobile !== false,
    normalMode: v.normalMode !== false,
    typhoonMode: v.typhoonMode !== false,
    layout: oneOf(v.layout, ["container", "wide", "full"] as const, "container"),
    columns: {
      desktop: clampInt(v.columns?.desktop, 1, 6, DEFAULT_SECTION_CONFIG.columns.desktop),
      tablet: clampInt(v.columns?.tablet, 1, 4, DEFAULT_SECTION_CONFIG.columns.tablet),
      mobile: clampInt(v.columns?.mobile, 1, 2, DEFAULT_SECTION_CONFIG.columns.mobile),
    },
    bgStyle: oneOf(v.bgStyle, ["default", "light", "muted", "primary", "dark", "gradient", "emergency", "custom"] as const, "default"),
    bgColor: sanitizeHexColor(v.bgColor),
    bgImage: sanitizeUrl(v.bgImage),
    overlayOpacity: clampInt(v.overlayOpacity, 0, 90, 30),
    paddingY: oneOf(v.paddingY, ["sm", "md", "lg", "xl"] as const, "md"),
    cardRadius: oneOf(v.cardRadius, ["none", "sm", "md", "lg", "xl"] as const, "lg"),
    shadow: oneOf(v.shadow, ["none", "sm", "md", "lg"] as const, "sm"),
    animation: oneOf(v.animation, ["none", "fade", "slide-up"] as const, "fade"),
    icon: sanitizeText(v.icon, 40) || undefined,
    ctaEnabled: v.ctaEnabled === true,
    ctaLabel: sanitizeText(v.ctaLabel, 60) || undefined,
    ctaLink: sanitizeLink(v.ctaLink),
    link: sanitizeLink(v.link),
    scheduleStart: v.scheduleStart ? sanitizeText(v.scheduleStart, 30) : null,
    scheduleEnd: v.scheduleEnd ? sanitizeText(v.scheduleEnd, 30) : null,
    items,
    data: v.data && typeof v.data === "object" && !Array.isArray(v.data) ? (v.data as Record<string, unknown>) : {},
    cssClass: SAFE_CSS_CLASSES.has(typeof v.cssClass === "string" ? v.cssClass : "") ? (v.cssClass as string) : "",
  };
  return cfg;
}

export function sanitizeWidgetConfig(raw: unknown): WidgetConfig {
  const v = (raw && typeof raw === "object" ? raw : {}) as Partial<WidgetConfig>;
  const items = Array.isArray(v.items)
    ? v.items.slice(0, 12).map((it) => ({
        label: sanitizeText((it as { label?: unknown })?.label, 60),
        description: sanitizeText((it as { description?: unknown })?.description, 200) || undefined,
        icon: sanitizeText((it as { icon?: unknown })?.icon, 40) || undefined,
        link: sanitizeLink((it as { link?: unknown })?.link),
      }))
    : [];
  const blocks = Array.isArray(v.blocks)
    ? v.blocks.slice(0, 24).map((b) => {
        const blk = (b && typeof b === "object" ? b : {}) as Partial<CustomWidgetBlock>;
        return {
          kind: oneOf(blk.kind, ["text", "stat", "link", "bullet"] as const, "text"),
          label: sanitizeText(blk.label, 120) || undefined,
          value: sanitizeText(blk.value, 600) || undefined,
          icon: sanitizeText(blk.icon, 40) || undefined,
          link: sanitizeLink(blk.link),
        };
      })
    : [];
  return {
    size: oneOf(v.size, ["small", "wide", "large", "tall"] as const, "small"),
    icon: sanitizeText(v.icon, 40) || undefined,
    ctaLabel: sanitizeText(v.ctaLabel, 40) || undefined,
    link: sanitizeLink(v.link),
    refreshSec: clampInt(v.refreshSec, 30, 3600, DEFAULT_WIDGET_CONFIG.refreshSec ?? 120),
    normalMode: v.normalMode !== false,
    typhoonMode: v.typhoonMode !== false,
    visibleMobile: v.visibleMobile !== false,
    visibleDesktop: v.visibleDesktop !== false,
    items,
    theme: oneOf(v.theme, ["blue", "gold", "emerald", "red", "violet", "slate", "dark"] as const, "blue"),
    cardStyle: oneOf(v.cardStyle, ["glass", "solid", "outline", "gradient"] as const, "glass"),
    bodyText: sanitizeText(v.bodyText, 600) || undefined,
    blocks,
    deployable: v.deployable === true,
  };
}

export function sanitizeSectionKey(value: unknown): string {
  return sanitizeText(value, 60).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
}

// ---------------------------------------------------------------------------
// SiteConfig scopes
// ---------------------------------------------------------------------------

const SCOPE_DEFAULTS: Record<SiteConfigScope, unknown> = {
  general: DEFAULT_GENERAL,
  operational: DEFAULT_OPERATIONAL,
  weather: DEFAULT_WEATHER,
  alert: DEFAULT_ALERT,
  navigation: DEFAULT_NAVIGATION,
  footer: DEFAULT_FOOTER,
};

function mergeDefaults<T>(scope: SiteConfigScope, raw: string | null | undefined): T {
  const fallback = SCOPE_DEFAULTS[scope] as T;
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ...fallback };
  return { ...fallback, ...(parsed as object) } as T;
}

export async function getDraftConfig<T>(scope: SiteConfigScope): Promise<T> {
  const row = await db.siteConfig.findUnique({ where: { scope } });
  return mergeDefaults<T>(scope, row?.draft);
}

export async function getPublishedConfig<T>(scope: SiteConfigScope): Promise<T> {
  const row = await db.siteConfig.findUnique({ where: { scope } });
  return mergeDefaults<T>(scope, row?.published);
}

export async function saveDraftConfig(scope: SiteConfigScope, value: unknown): Promise<void> {
  await db.siteConfig.upsert({
    where: { scope },
    create: { scope, draft: JSON.stringify(value ?? {}), published: JSON.stringify(SCOPE_DEFAULTS[scope] ?? {}) },
    update: { draft: JSON.stringify(value ?? {}) },
  });
}

/** Operational settings are LIVE: saving updates both draft and published values. */
export async function saveOperationalLive(value: OperationalSettings): Promise<void> {
  const json = JSON.stringify(value);
  await db.siteConfig.upsert({
    where: { scope: "operational" },
    create: { scope: "operational", draft: json, published: json },
    update: { draft: json, published: json },
  });
}

/** Publish a scope (draft → published). Used by the unified publish action. */
export async function publishScope(scope: SiteConfigScope): Promise<void> {
  const row = await db.siteConfig.findUnique({ where: { scope } });
  if (!row) return;
  await db.siteConfig.update({ where: { scope }, data: { published: row.draft } });
}

/** Effective mode honoring the optional scheduled override window. */
export function effectiveMode(operational: OperationalSettings, now = new Date()): OperationalMode {
  if (operational.scheduledEnabled) {
    const start = operational.scheduledStart ? new Date(operational.scheduledStart) : null;
    const end = operational.scheduledEnd ? new Date(operational.scheduledEnd) : null;
    const validStart = start && !isNaN(start.getTime());
    const validEnd = end && !isNaN(end.getTime());
    const afterStart = !validStart || now >= start!;
    const beforeEnd = !validEnd || now <= end!;
    if (afterStart && beforeEnd) {
      return oneOf(operational.scheduledMode, ["NORMAL", "TYPHOON", "EMERGENCY"] as const, "TYPHOON");
    }
  }
  return oneOf(operational.mode, ["NORMAL", "TYPHOON", "EMERGENCY"] as const, "NORMAL");
}

// ---------------------------------------------------------------------------
// Section / widget row mapping
// ---------------------------------------------------------------------------

type SectionRow = { id: string; sectionKey: string; template: string; name: string; heading: string; subtitle: string | null; description: string | null; status: string; displayOrder: number; config: string; updatedAt: Date };

function parseConfig<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function sectionRowToPublic(row: SectionRow): PublicSection {
  const merged = { ...DEFAULT_SECTION_CONFIG, ...parseConfig<SectionConfig>(row.config, DEFAULT_SECTION_CONFIG) };
  return {
    id: row.id,
    key: row.sectionKey,
    template: row.template as SectionTemplate,
    name: row.name,
    heading: row.heading,
    subtitle: row.subtitle,
    description: row.description,
    status: oneOf(row.status, ["ACTIVE", "HIDDEN", "DRAFT"] as const, "HIDDEN") as SectionStatus,
    order: row.displayOrder,
    config: sanitizeSectionConfig(merged),
  };
}

type WidgetRow = { id: string; widgetKey: string; type: string; title: string; displayOrder: number; enabled: boolean; config: string; updatedAt: Date };

export function widgetRowToPublic(row: WidgetRow): PublicWidget {
  const merged = { ...DEFAULT_WIDGET_CONFIG, ...parseConfig<WidgetConfig>(row.config, DEFAULT_WIDGET_CONFIG) };
  return {
    id: row.id,
    key: row.widgetKey,
    type: row.type as WidgetType,
    title: row.title,
    order: row.displayOrder,
    enabled: row.enabled,
    config: sanitizeWidgetConfig(merged),
  };
}

/** Is a section within its configured schedule window? */
export function sectionInSchedule(config: SectionConfig, now = new Date()): boolean {
  const { scheduleStart, scheduleEnd } = config;
  if (!scheduleStart && !scheduleEnd) return true;
  const start = scheduleStart ? new Date(scheduleStart) : null;
  const end = scheduleEnd ? new Date(scheduleEnd) : null;
  if (start && !isNaN(start.getTime()) && now < start) return false;
  if (end && !isNaN(end.getTime()) && now > end) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Snapshot data (published homepage configuration)
// ---------------------------------------------------------------------------

export interface PortalSnapshotData {
  version: number;
  createdAt: string;
  note: string | null;
  sections: PublicSection[];
  widgets: PublicWidget[];
  navigation: NavigationSettings;
  footer: FooterSettings;
  general: GeneralSettings;
  alert: AlertSettings;
  /** Used server-side only (contains API keys) — never sent to the client. */
  weather: WeatherSettings;
}

export async function buildSnapshotData(version: number, note: string | null): Promise<PortalSnapshotData> {
  const [sectionRows, widgetRows, navigation, footer, general, alert, weather] = await Promise.all([
    db.homepageSection.findMany({ orderBy: { displayOrder: "asc" } }),
    db.dashboardWidget.findMany({ orderBy: { displayOrder: "asc" } }),
    getDraftConfig<NavigationSettings>("navigation"),
    getDraftConfig<FooterSettings>("footer"),
    getDraftConfig<GeneralSettings>("general"),
    getDraftConfig<AlertSettings>("alert"),
    getDraftConfig<WeatherSettings>("weather"),
  ]);
  return {
    version,
    createdAt: new Date().toISOString(),
    note,
    sections: sectionRows.map(sectionRowToPublic),
    widgets: widgetRows.map(widgetRowToPublic),
    navigation,
    footer,
    general,
    alert,
    weather,
  };
}

export async function getActiveSnapshot(): Promise<PortalSnapshotData | null> {
  const row = await db.homepageSnapshot.findFirst({ where: { isActive: true }, orderBy: { version: "desc" } });
  if (!row) return null;
  try {
    return JSON.parse(row.data) as PortalSnapshotData;
  } catch {
    return null;
  }
}

export async function publishHomepages(note: string | null): Promise<PortalSnapshotData> {
  const latest = await db.homepageSnapshot.findFirst({ orderBy: { version: "desc" } });
  const version = (latest?.version ?? 0) + 1;
  const data = await buildSnapshotData(version, note);
  await db.homepageSnapshot.updateMany({ where: { isActive: true }, data: { isActive: false } });
  await db.homepageSnapshot.create({ data: { version, note, data: JSON.stringify(data), isActive: true } });
  // scope published values follow the snapshot
  for (const scope of ["general", "alert", "weather", "navigation", "footer"] as SiteConfigScope[]) {
    await publishScope(scope);
  }
  // Published content changed → public portal responses must not serve stale
  // cached copies (homepage config, content feed, evacuation mode, frontpages).
  invalidateCache("public:");
  return data;
}

/** Restore draft rows + scope drafts from a previous snapshot, then re-publish it. */
export async function restoreSnapshot(snapshotId: string): Promise<PortalSnapshotData | null> {
  const row = await db.homepageSnapshot.findUnique({ where: { id: snapshotId } });
  if (!row) return null;
  let data: PortalSnapshotData;
  try {
    data = JSON.parse(row.data) as PortalSnapshotData;
  } catch {
    return null;
  }
  await db.homepageSection.deleteMany({});
  await db.dashboardWidget.deleteMany({});
  for (const s of data.sections) {
    await db.homepageSection.create({
      data: {
        sectionKey: s.key,
        template: s.template,
        name: s.name,
        heading: s.heading,
        subtitle: s.subtitle,
        description: s.description,
        status: s.status,
        displayOrder: s.order,
        config: JSON.stringify(s.config),
      },
    });
  }
  for (const w of data.widgets) {
    await db.dashboardWidget.create({
      data: {
        widgetKey: w.key,
        type: w.type,
        title: w.title,
        displayOrder: w.order,
        enabled: w.enabled,
        config: JSON.stringify(w.config),
      },
    });
  }
  await saveDraftConfig("navigation", data.navigation);
  await saveDraftConfig("footer", data.footer);
  await saveDraftConfig("general", data.general);
  await saveDraftConfig("alert", data.alert);
  await saveDraftConfig("weather", data.weather);
  return publishHomepages(`Restored from version ${row.version}`);
}

/** Wipe homepage configuration and reseed defaults, then publish. */
export async function resetHomepage(): Promise<PortalSnapshotData> {
  await db.homepageSection.deleteMany({});
  await db.dashboardWidget.deleteMany({});
  await seedPortalConfig();
  return publishHomepages("Homepage reset to defaults");
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

export async function seedPortalConfig(): Promise<void> {
  const existingSections = await db.homepageSection.count();
  if (existingSections === 0) {
    for (let i = 0; i < DEFAULT_SECTIONS.length; i++) {
      const def = DEFAULT_SECTIONS[i];
      await db.homepageSection.create({
        data: {
          sectionKey: def.key,
          template: def.template,
          name: def.name,
          heading: def.heading,
          subtitle: def.subtitle ?? null,
          description: def.description ?? null,
          status: def.status ?? "ACTIVE",
          displayOrder: i + 1,
          config: JSON.stringify(def.config),
        },
      });
    }
  }
  const existingWidgets = await db.dashboardWidget.count();
  if (existingWidgets === 0) {
    for (let i = 0; i < DEFAULT_WIDGETS.length; i++) {
      const def = DEFAULT_WIDGETS[i];
      await db.dashboardWidget.create({
        data: {
          widgetKey: def.key,
          type: def.type,
          title: def.title,
          displayOrder: i + 1,
          enabled: def.enabled ?? true,
          config: JSON.stringify(def.config),
        },
      });
    }
  }
  // scope defaults (only when missing)
  for (const scope of ["general", "operational", "weather", "alert", "navigation", "footer"] as SiteConfigScope[]) {
    const row = await db.siteConfig.findUnique({ where: { scope } });
    const json = JSON.stringify(SCOPE_DEFAULTS[scope]);
    if (!row) {
      await db.siteConfig.create({ data: { scope, draft: json, published: json } });
    }
  }
}

export async function seedPortalContent(): Promise<void> {
  if ((await db.emergencyHotline.count()) === 0) {
    for (const h of SEED_HOTLINES) await db.emergencyHotline.create({ data: h });
  }
  if ((await db.tickerMessage.count()) === 0) {
    for (const t of SEED_TICKER) await db.tickerMessage.create({ data: t });
  }
  if ((await db.preparednessTopic.count()) === 0) {
    for (const p of SEED_PREPAREDNESS) await db.preparednessTopic.create({ data: p });
  }
  if ((await db.announcement.count()) === 0) {
    for (const a of SEED_ANNOUNCEMENTS) await db.announcement.create({ data: { ...a, pinned: true } });
  }
}

/**
 * Guarantees the public portal always has a published configuration:
 * seeds defaults when the tables are empty, then publishes if no active
 * snapshot exists.
 */
export async function ensureBootstrap(): Promise<void> {
  const active = await getActiveSnapshot();
  if (active) return;
  await seedPortalConfig();
  await seedPortalContent();
  await publishHomepages("Initial publication");
}

// ---------------------------------------------------------------------------
// Draft change detection
// ---------------------------------------------------------------------------

export async function hasDraftChanges(): Promise<boolean> {
  const active = await getActiveSnapshot();
  if (!active) return true;
  const draft = await buildSnapshotData(active.version, null);
  const strip = (d: PortalSnapshotData) =>
    JSON.stringify({
      sections: d.sections.map((s) => ({ key: s.key, template: s.template, heading: s.heading, subtitle: s.subtitle, description: s.description, status: s.status, order: s.order, config: s.config })),
      widgets: d.widgets.map((w) => ({ key: w.key, type: w.type, title: w.title, order: w.order, enabled: w.enabled, config: w.config })),
      navigation: d.navigation,
      footer: d.footer,
      general: d.general,
      alert: d.alert,
      weather: d.weather,
    });
  return strip(active) !== strip(draft);
}

// ---------------------------------------------------------------------------
// Public homepage response assembly
// ---------------------------------------------------------------------------

export async function buildHomepageResponse(): Promise<HomepageResponse> {
  await ensureBootstrap();
  const [snapshot, operational] = await Promise.all([
    getActiveSnapshot(),
    getPublishedConfig<OperationalSettings>("operational"),
  ]);
  const data = snapshot ?? (await publishHomepages("Bootstrap"));
  const mode = effectiveMode(operational);
  const emergency = mode !== "NORMAL";
  const now = new Date();
  const sections = data.sections
    .filter((s) => s.status === "ACTIVE")
    .filter((s) => (emergency ? s.config.typhoonMode !== false : s.config.normalMode !== false))
    .filter((s) => sectionInSchedule(s.config, now));
  const widgets = data.widgets
    .filter((w) => w.enabled)
    .filter((w) => (emergency ? w.config.typhoonMode !== false : w.config.normalMode !== false));
  return {
    ok: true,
    version: data.version,
    publishedAt: data.createdAt,
    mode,
    visualMode: visualModeOf(mode),
    operational,
    general: data.general,
    // Older snapshots may predate the alert scope — fall back to defaults.
    alert: data.alert ?? DEFAULT_ALERT,
    sections,
    widgets,
    navigation: data.navigation,
    footer: data.footer,
    serverTime: now.toISOString(),
  };
}

/** Section template default lookup (used by the create-section API). */
export { templateDefaultConfig };
