import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, requireAdmin } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import {
  getDraftConfig,
  hasDraftChanges,
  publishScope,
  sanitizeHexColor,
  sanitizeText,
  sanitizeUrl,
  saveDraftConfig,
  saveOperationalLive,
} from "@/lib/qas33/portal-server";
import type {
  AlertSettings,
  FooterSettings,
  GeneralSettings,
  NavigationSettings,
  OperationalSettings,
  SectionLinkConfig,
  SiteConfigScope,
  WeatherSettings,
} from "@/lib/qas33/portal-types";
import { SITE_CONFIG_SCOPES } from "@/lib/qas33/portal-types";

// GET  — all scope drafts (weather keys masked) + publish state
// PUT  — save one scope draft  { scope, value }
// POST — { action: "set-mode", mode } — immediate live operational mode switch

const KEY_MASK = "••••••••";

function maskWeatherKeys(value: WeatherSettings): WeatherSettings {
  return {
    ...value,
    weatherlinkApiKey: value.weatherlinkApiKey ? KEY_MASK : "",
    weatherlinkApiSecret: value.weatherlinkApiSecret ? KEY_MASK : "",
    owmApiKey: value.owmApiKey ? KEY_MASK : "",
  };
}

export async function GET() {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [general, operational, weather, alert, navigation, footer, active, dirty] = await Promise.all([
      getDraftConfig<GeneralSettings>("general"),
      getDraftConfig<OperationalSettings>("operational"),
      getDraftConfig<WeatherSettings>("weather"),
      getDraftConfig<AlertSettings>("alert"),
      getDraftConfig<NavigationSettings>("navigation"),
      getDraftConfig<FooterSettings>("footer"),
      db.homepageSnapshot.findFirst({ where: { isActive: true } }),
      hasDraftChanges(),
    ]);
    return NextResponse.json({
      ok: true,
      scopes: {
        general,
        operational,
        weather: maskWeatherKeys(weather),
        alert,
        navigation,
        footer,
      },
      publishedAt: active?.createdAt ? active.createdAt.toISOString() : null,
      activeVersion: active?.version ?? null,
      hasDraftChanges: dirty,
    });
  } catch (e) {
    console.error("config GET failed", e);
    return NextResponse.json({ error: "Failed to load settings." }, { status: 500 });
  }
}

function sanitizeGeneral(v: Record<string, unknown>): GeneralSettings {
  return {
    siteTitle: sanitizeText(v.siteTitle, 120),
    siteDescription: sanitizeText(v.siteDescription, 400),
    logoText: sanitizeText(v.logoText, 20),
    tagline: sanitizeText(v.tagline, 60),
    hotline: sanitizeText(v.hotline, 40),
    officeAddress: sanitizeText(v.officeAddress, 200),
    officeHours: sanitizeText(v.officeHours, 120),
    contactEmail: sanitizeText(v.contactEmail, 120),
    contactPhone: sanitizeText(v.contactPhone, 40),
    facebookUrl: sanitizeUrl(v.facebookUrl),
    youtubeUrl: sanitizeUrl(v.youtubeUrl),
    privacyUrl: sanitizeUrl(v.privacyUrl),
    termsUrl: sanitizeUrl(v.termsUrl),
    accessibilityNote: sanitizeText(v.accessibilityNote, 300),
  };
}

function sanitizeOperational(v: Record<string, unknown>): OperationalSettings {
  const mode = ["NORMAL", "TYPHOON", "EMERGENCY"].includes(String(v.mode)) ? (v.mode as OperationalSettings["mode"]) : "NORMAL";
  const scheduledMode = ["NORMAL", "TYPHOON", "EMERGENCY"].includes(String(v.scheduledMode))
    ? (v.scheduledMode as OperationalSettings["scheduledMode"])
    : "TYPHOON";
  return {
    mode,
    normalTitle: sanitizeText(v.normalTitle, 80),
    normalDescription: sanitizeText(v.normalDescription, 400),
    emergencyTitle: sanitizeText(v.emergencyTitle, 80),
    emergencyDescription: sanitizeText(v.emergencyDescription, 400),
    showPublicIndicator: v.showPublicIndicator !== false,
    bannerEnabled: v.bannerEnabled !== false,
    bannerText: sanitizeText(v.bannerText, 300),
    scheduledEnabled: v.scheduledEnabled === true,
    scheduledMode,
    scheduledStart: sanitizeText(v.scheduledStart, 30),
    scheduledEnd: sanitizeText(v.scheduledEnd, 30),
  };
}

function sanitizeWeather(current: WeatherSettings, v: Record<string, unknown>): WeatherSettings {
  // MASKED keys round-trip: keep the stored value when the mask comes back
  const apiKey = typeof v.weatherlinkApiKey === "string" && v.weatherlinkApiKey !== KEY_MASK ? sanitizeText(v.weatherlinkApiKey, 120) : current.weatherlinkApiKey;
  const apiSecret = typeof v.weatherlinkApiSecret === "string" && v.weatherlinkApiSecret !== KEY_MASK ? sanitizeText(v.weatherlinkApiSecret, 120) : current.weatherlinkApiSecret;
  const owmKey = typeof v.owmApiKey === "string" && v.owmApiKey !== KEY_MASK ? sanitizeText(v.owmApiKey, 120) : current.owmApiKey;
  const num = (x: unknown, f: number, min: number, max: number) => {
    const n = Number(x);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : f;
  };
  return {
    awsEnabled: v.awsEnabled !== false,
    weatherlinkApiKey: apiKey,
    weatherlinkApiSecret: apiSecret,
    weatherlinkStationId: sanitizeText(v.weatherlinkStationId, 40),
    awsRefreshMin: Math.round(num(v.awsRefreshMin, current.awsRefreshMin, 1, 60)),
    owmEnabled: v.owmEnabled !== false,
    owmApiKey: owmKey,
    lat: num(v.lat, current.lat, -90, 90),
    lon: num(v.lon, current.lon, -180, 180),
    forecastRefreshMin: Math.round(num(v.forecastRefreshMin, current.forecastRefreshMin, 5, 180)),
    openMeteoFallback: v.openMeteoFallback !== false,
    showUv: v.showUv !== false,
    showPressure: v.showPressure !== false,
    showVisibility: v.showVisibility !== false,
    showWind: v.showWind !== false,
    showRain: v.showRain !== false,
  };
}

function sanitizeAlert(v: Record<string, unknown>): AlertSettings {
  return {
    defaultPriority: sanitizeText(v.defaultPriority, 20),
    criticalColor: sanitizeHexColor(v.criticalColor),
    warningColor: sanitizeHexColor(v.warningColor),
    advisoryColor: sanitizeHexColor(v.advisoryColor),
    infoColor: sanitizeHexColor(v.infoColor),
    autoExpireHours: Number.isFinite(Number(v.autoExpireHours)) ? Math.min(720, Math.max(1, Math.round(Number(v.autoExpireHours)))) : 48,
    showInHero: v.showInHero !== false,
    heroMaxAlerts: Number.isFinite(Number(v.heroMaxAlerts)) ? Math.min(6, Math.max(0, Math.round(Number(v.heroMaxAlerts)))) : 3,
  };
}

function sanitizeLinkValue(link: unknown): SectionLinkConfig | undefined {
  if (!link || typeof link !== "object") return undefined;
  const l = link as Record<string, unknown>;
  const kind = String(l.kind ?? "none");
  if (!"none anchor url modal app".split(" ").includes(kind)) return { kind: "none" };
  const out: SectionLinkConfig = { kind: kind as SectionLinkConfig["kind"] };
  if (kind === "anchor") out.anchor = sanitizeText(l.anchor, 60).replace(/[^a-zA-Z0-9-_]/g, "");
  if (kind === "url") out.url = sanitizeUrl(l.url);
  if (kind === "modal" && ["hotlines", "report", "login-admin", "login-barangay"].includes(String(l.modal))) out.modal = l.modal as SectionLinkConfig["modal"];
  if (kind === "app") out.app = "verify";
  out.target = l.target === "new" ? "new" : "same";
  return out;
}

function sanitizeNavigation(v: Record<string, unknown>): NavigationSettings {
  const items = Array.isArray(v.items)
    ? v.items.slice(0, 12).map((it, i) => {
        const item = (it ?? {}) as Record<string, unknown>;
        return {
          id: sanitizeText(item.id, 40) || `nav-${i + 1}`,
          label: sanitizeText(item.label, 40) || `Link ${i + 1}`,
          link: sanitizeLinkValue(item.link) ?? { kind: "none" },
          visible: item.visible !== false,
        } as NavigationSettings["items"][number];
      })
    : [];
  return { items };
}

function sanitizeFooter(v: Record<string, unknown>): FooterSettings {
  const columns = Array.isArray(v.columns)
    ? v.columns.slice(0, 4).map((c, ci) => {
        const col = (c ?? {}) as Record<string, unknown>;
        const links = Array.isArray(col.links)
          ? col.links.slice(0, 10).map((l) => {
              const link = (l ?? {}) as Record<string, unknown>;
              return {
                label: sanitizeText(link.label, 60) || "Link",
                link: sanitizeLinkValue(link.link) ?? { kind: "none" },
              };
            })
          : [];
        return {
          id: sanitizeText(col.id, 40) || `fc-${ci + 1}`,
          title: sanitizeText(col.title, 60) || `Column ${ci + 1}`,
          links,
        };
      })
    : [];
  const partners = Array.isArray(v.partners)
    ? v.partners.slice(0, 16).map((p) => {
        const partner = (p ?? {}) as Record<string, unknown>;
        return { label: sanitizeText(partner.label, 60) || "Partner", url: sanitizeUrl(partner.url) || undefined };
      })
    : [];
  return {
    columns,
    showHotlineStrip: v.showHotlineStrip !== false,
    partners,
    copyrightNote: sanitizeText(v.copyrightNote, 200),
  };
}

export async function PUT(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as { scope?: string; value?: Record<string, unknown> };
    const scope = String(body.scope ?? "") as SiteConfigScope;
    if (!SITE_CONFIG_SCOPES.includes(scope)) return NextResponse.json({ error: "Unknown settings scope." }, { status: 400 });
    const value = body.value ?? {};

    if (scope === "general") {
      await saveDraftConfig("general", sanitizeGeneral(value));
    } else if (scope === "operational") {
      // operational settings are LIVE (draft + published simultaneously)
      const current = await getDraftConfig<OperationalSettings>("operational");
      const next = { ...sanitizeOperational({ ...current, ...value }) };
      // a mode set through the dedicated action wins over form state
      next.mode = current.mode;
      await saveOperationalLive(next);
    } else if (scope === "weather") {
      const current = await getDraftConfig<WeatherSettings>("weather");
      await saveDraftConfig("weather", sanitizeWeather(current, value));
    } else if (scope === "alert") {
      await saveDraftConfig("alert", sanitizeAlert(value));
    } else if (scope === "navigation") {
      await saveDraftConfig("navigation", sanitizeNavigation(value));
    } else if (scope === "footer") {
      await saveDraftConfig("footer", sanitizeFooter(value));
    }

    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "PORTAL_SETTINGS_SAVED",
      detail: `Draft settings saved (scope: ${scope})`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("config PUT failed", e);
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as { action?: string; mode?: string };
    if (body.action !== "set-mode") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    const mode = String(body.mode ?? "");
    if (!["NORMAL", "TYPHOON", "EMERGENCY"].includes(mode)) {
      return NextResponse.json({ error: "Invalid operational mode." }, { status: 400 });
    }
    const current = await getDraftConfig<OperationalSettings>("operational");
    await saveOperationalLive({ ...current, mode: mode as OperationalSettings["mode"] });
    await logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin.name,
      action: "PORTAL_MODE_SWITCHED",
      detail: `Operational mode switched to ${mode} (live)`,
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true, mode });
  } catch (e) {
    console.error("config POST failed", e);
    return NextResponse.json({ error: "Operation failed." }, { status: 500 });
  }
}
