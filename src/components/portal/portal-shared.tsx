"use client";

// QAS33 Public Portal — shared building blocks
// Icons, status styles, SectionShell, grid column maps, link resolution,
// loading/empty/unavailable states and small formatting helpers.

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  Anchor,
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock,
  Cloud,
  Crosshair,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  Copy,
  Download,
  Droplet,
  Droplets,
  ExternalLink,
  Eye,
  EyeOff,
  Facebook,
  FileJson,
  FileText,
  Flame,
  Gauge,
  Globe,
  GraduationCap,
  HandHeart,
  HardHat,
  HeartPulse,
  House,
  Image,
  Info,
  Landmark,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Link as LinkIcon,
  LocateFixed,
  LogIn,
  LogOut,
  Mail,
  Map,
  MapPinned,
  MapPin,
  Megaphone,
  Menu,
  MessageSquareWarning,
  Moon,
  Mountain,
  Navigation,
  Newspaper,
  Package,
  Phone,
  PhoneCall,
  Pin,
  Radar,
  Radio,
  RefreshCw,
  Satellite,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Siren,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Thermometer,
  TriangleAlert,
  Truck,
  Umbrella,
  Upload,
  User,
  UserPlus,
  UserCheck,
  LayoutTemplate,
  Users,
  Waves,
  WifiOff,
  Wind,
  X,
  Youtube,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PublicSection, SectionLinkConfig, SectionTemplate } from "@/lib/qas33/portal-types";

// ---------------------------------------------------------------------------
// Icon registry (static lucide lookup — unknown names fall back to CircleAlert)
// ---------------------------------------------------------------------------

const ICONS: Record<string, LucideIcon> = {
  "shield-check": ShieldCheck,
  shield: Shield,
  home: House,
  phone: Phone,
  "phone-call": PhoneCall,
  siren: Siren,
  thermometer: Thermometer,
  "cloud-sun": CloudSun,
  "cloud-rain": CloudRain,
  "cloud-lightning": CloudLightning,
  sun: Sun,
  droplets: Droplets,
  droplet: Droplet,
  wind: Wind,
  waves: Waves,
  water: Waves, // lucide 0.525 has no `Water` glyph — reuse Waves
  mountain: Mountain,
  flame: Flame,
  activity: Activity,
  "map-pin": MapPin,
  map: Map,
  landmark: Landmark,
  "building-2": Building2,
  megaphone: Megaphone,
  radio: Radio,
  newspaper: Newspaper,
  "hard-hat": HardHat,
  zap: Zap,
  "layout-dashboard": LayoutDashboard,
  "bar-chart-3": BarChart3,
  link: LinkIcon,
  info: Info,
  users: Users,
  user: User,
  "heart-pulse": HeartPulse,
  "hand-heart": HandHeart,
  anchor: Anchor,
  "graduation-cap": GraduationCap,
  clock: Clock,
  mail: Mail,
  truck: Truck,
  "life-buoy": LifeBuoy,
  "alert-triangle": TriangleAlert,
  "triangle-alert": TriangleAlert,
  check: Check,
  x: X,
  "chevron-right": ChevronRight,
  "chevron-down": ChevronDown,
  "arrow-right": ArrowRight,
  "external-link": ExternalLink,
  menu: Menu,
  "log-in": LogIn,
  "log-out": LogOut,
  copy: Copy,
  "refresh-cw": RefreshCw,
  "wifi-off": WifiOff,
  search: Search,
  send: Send,
  camera: Camera,
  image: Image,
  "locate-fixed": LocateFixed,
  "file-text": FileText,
  download: Download,
  eye: Eye,
  "eye-off": EyeOff,
  pin: Pin,
  star: Star,
  facebook: Facebook,
  youtube: Youtube,
  globe: Globe,
  radar: Radar,
  "message-square-warning": MessageSquareWarning,
  sparkles: Sparkles,
  calendar: Calendar,
  package: Package,
  umbrella: Umbrella,
  snowflake: Snowflake,
  moon: Moon,
  cloud: Cloud,
  "cloud-fog": CloudFog,
  "cloud-drizzle": CloudDrizzle,
  "cloud-snow": CloudSnow,
  "cloud-hail": CloudHail,
  gauge: Gauge,
  satellite: Satellite,
  layers: Layers,
  upload: Upload,
  "file-json": FileJson,
  crosshair: Crosshair,
  navigation: Navigation,
  "map-pinned": MapPinned,
  "user-plus": UserPlus,
  "user-check": UserCheck,
  "layout-template": LayoutTemplate,
};

export function PortalIcon({ name, className }: { name?: string | null; className?: string }) {
  const Comp = (name && ICONS[name]) || CircleAlert;
  return <Comp aria-hidden="true" className={className} />;
}

// ---------------------------------------------------------------------------
// Status / level styles
// ---------------------------------------------------------------------------

export interface LevelStyle {
  label: string;
  /** badge / chip classes */
  badge: string;
  /** solid bar or dot classes */
  solid: string;
  /** left border accent */
  border: string;
}

const mk = (label: string, badge: string, solid: string, border: string): LevelStyle => ({
  label,
  badge,
  solid,
  border,
});

/** Alert severity levels. */
export const LEVEL_STYLES: Record<string, LevelStyle> = {
  INFO: mk("Info", "border-blue-200 bg-blue-50 text-blue-800", "bg-blue-600", "border-blue-500"),
  ADVISORY: mk("Advisory", "border-amber-200 bg-amber-50 text-amber-800", "bg-amber-500", "border-amber-500"),
  WARNING: mk("Warning", "border-orange-200 bg-orange-50 text-orange-800", "bg-orange-600", "border-orange-500"),
  CRITICAL: mk("Critical", "border-red-200 bg-red-50 text-red-800", "bg-red-600", "border-red-600"),
};

/** Announcement / ticker priority. */
export const PRIORITY_STYLES: Record<string, LevelStyle> = {
  CRITICAL: mk("Critical", "border-red-200 bg-red-50 text-red-800", "bg-red-600", "border-red-600"),
  EMERGENCY: mk("Urgent", "border-red-200 bg-red-50 text-red-800", "bg-red-600", "border-red-600"),
  HIGH: mk("High", "border-amber-200 bg-amber-50 text-amber-900", "bg-amber-500", "border-amber-500"),
  NORMAL: mk("Normal", "border-slate-200 bg-slate-50 text-slate-700", "bg-slate-400", "border-slate-300"),
  LOW: mk("Low", "border-slate-200 bg-slate-50 text-slate-500", "bg-slate-300", "border-slate-200"),
};

/** Evacuation center status. */
export const STATUS_STYLES: Record<string, LevelStyle> = {
  OPEN: mk("Open", "border-emerald-200 bg-emerald-50 text-emerald-800", "bg-emerald-500", "border-emerald-500"),
  LIMITED: mk("Limited", "border-amber-200 bg-amber-50 text-amber-800", "bg-amber-500", "border-amber-500"),
  FULL: mk("Full", "border-red-200 bg-red-50 text-red-800", "bg-red-600", "border-red-600"),
  CLOSED: mk("Closed", "border-slate-200 bg-slate-100 text-slate-600", "bg-slate-400", "border-slate-300"),
};

/** Preparedness phase. */
export const PHASE_STYLES: Record<string, LevelStyle> = {
  BEFORE: mk("Before", "border-blue-200 bg-blue-50 text-blue-800", "bg-blue-600", "border-blue-500"),
  DURING: mk("During", "border-amber-200 bg-amber-50 text-amber-800", "bg-amber-500", "border-amber-500"),
  AFTER: mk("After", "border-emerald-200 bg-emerald-50 text-emerald-800", "bg-emerald-500", "border-emerald-500"),
};

/** Incident report urgency. */
export const URGENCY_STYLES: Record<string, LevelStyle> = {
  LOW: mk("Low", "border-slate-300 bg-slate-50 text-slate-700", "bg-slate-400", "border-slate-300"),
  MODERATE: mk("Moderate", "border-blue-300 bg-blue-50 text-blue-800", "bg-blue-600", "border-blue-500"),
  HIGH: mk("High", "border-orange-300 bg-orange-50 text-orange-800", "bg-orange-500", "border-orange-500"),
  CRITICAL: mk("Critical", "border-red-300 bg-red-50 text-red-800", "bg-red-600", "border-red-600"),
};

/** Announcement category chips. */
export const CATEGORY_STYLES: Record<string, { label: string; badge: string }> = {
  GENERAL: { label: "General Announcement", badge: "border-slate-200 bg-slate-50 text-slate-700" },
  WEATHER_ADVISORY: { label: "Weather Advisory", badge: "border-blue-200 bg-blue-50 text-blue-800" },
  DISASTER_ADVISORY: { label: "Disaster Advisory", badge: "border-orange-200 bg-orange-50 text-orange-800" },
  EVACUATION: { label: "Evacuation Notice", badge: "border-red-200 bg-red-50 text-red-800" },
  SUSPENSION: { label: "Class / Work Suspension", badge: "border-violet-200 bg-violet-50 text-violet-800" },
  PUBLIC_SAFETY: { label: "Public Safety", badge: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  ROAD_ADVISORY: { label: "Road / Traffic Advisory", badge: "border-amber-200 bg-amber-50 text-amber-800" },
  RELIEF_OPERATION: { label: "Relief Operation", badge: "border-teal-200 bg-teal-50 text-teal-800" },
  EMERGENCY_ALERT: { label: "Emergency Alert", badge: "border-red-200 bg-red-50 text-red-800" },
};

export function levelStyle(map: Record<string, LevelStyle>, key: string | null | undefined): LevelStyle {
  return (key && map[key]) || map.NORMAL || LEVEL_STYLES.INFO;
}

/** Colored tint presets for icon circles (quick actions / hazard cards). */
export const TINT_STYLES: Record<string, { circle: string; ring: string }> = {
  red: { circle: "bg-red-50 text-emergency-red", ring: "border-red-200" },
  amber: { circle: "bg-amber-50 text-amber-600", ring: "border-amber-200" },
  blue: { circle: "bg-gov-blue-50 text-gov-blue", ring: "border-gov-blue-100" },
  green: { circle: "bg-emerald-50 text-emerald-700", ring: "border-emerald-200" },
  emerald: { circle: "bg-emerald-50 text-emerald-700", ring: "border-emerald-200" },
  cyan: { circle: "bg-cyan-50 text-cyan-700", ring: "border-cyan-200" },
  teal: { circle: "bg-teal-50 text-teal-700", ring: "border-teal-200" },
  orange: { circle: "bg-orange-50 text-orange-600", ring: "border-orange-200" },
  slate: { circle: "bg-slate-100 text-slate-600", ring: "border-slate-200" },
};

// ---------------------------------------------------------------------------
// Section background / padding helpers
// ---------------------------------------------------------------------------

export function isDarkSection(bgStyle: string): boolean {
  return bgStyle === "primary" || bgStyle === "dark" || bgStyle === "gradient" || bgStyle === "emergency";
}

const PADDING_Y: Record<string, string> = {
  sm: "py-6 md:py-8",
  md: "py-8 md:py-10",
  lg: "py-10 md:py-12",
  xl: "py-12 md:py-16",
};

const CONTAINER_WIDTH: Record<string, string> = {
  container: "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8",
  wide: "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8",
  full: "w-full px-4 sm:px-6 lg:px-8",
};

function sectionBg(section: PublicSection): { className?: string; style?: React.CSSProperties } {
  const { bgStyle, bgColor } = section.config;
  switch (bgStyle) {
    case "light":
      return { className: "bg-gov-blue-50/70" };
    case "muted":
      return { className: "bg-slate-100/60" };
    case "primary":
      return { className: "bg-gov-blue text-white" };
    case "dark":
      return { className: "bg-gov-blue-deep text-white" };
    case "gradient":
      return { className: "bg-gradient-to-br from-gov-blue-deep via-gov-blue to-gov-blue-700 text-white" };
    case "emergency":
      return {
        className: "bg-gradient-to-br from-red-950 via-emergency-red-dark to-gov-blue-deep text-white",
      };
    case "custom":
      if (bgColor) {
        return { style: { backgroundColor: bgColor }, className: hexIsLight(bgColor) ? "text-slate-900" : "text-white" };
      }
      return {}; // transparent — page gradient shows through
    default:
      return {}; // transparent — page gradient shows through (glass cards float on it)
  }
}

/** Rough luminance check for custom hex backgrounds (default = dark text). */
function hexIsLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 145;
}

/** Short uppercase eyebrow label per template. */
export const TEMPLATE_EYEBROWS: Record<SectionTemplate, string> = {
  hero: "OFFICIAL PUBLIC INFORMATION PORTAL",
  alertBanner: "PUBLIC ALERTS",
  weather: "LIVE WEATHER & 7-DAY OUTLOOK",
  forecast: "7-DAY OUTLOOK",
  announcements: "PUBLIC ANNOUNCEMENTS",
  ticker: "BROADCAST",
  hotlines: "EMERGENCY CONTACTS",
  quickActions: "EMERGENCY RESPONSE",
  dashboard: "PUBLIC DASHBOARD",
  evacuation: "EVACUATION INFORMATION",
  evacuationMap: "EVACUATION MAP — LIVE",
  satelliteMap: "INTERACTIVE MUNICIPAL MAP",
  preparedness: "PREPAREDNESS & SAFETY",
  hazard: "HAZARD PROFILE",
  news: "NEWS & UPDATES",
  stats: "MUNICIPAL STATISTICS",
  links: "OFFICIAL LINKS",
  residentSignup: "RESIDENT REGISTRATION",
  custom: "INFORMATION",
};

// ---------------------------------------------------------------------------
// Grid columns (STATIC Tailwind class map — must be literal for the compiler)
// ---------------------------------------------------------------------------

type GridMap = Record<string, string>;

const GRID_COLS: GridMap = {
  // mobile 1
  "1-1-1": "grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1",
  "1-1-2": "grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2",
  "1-1-3": "grid grid-cols-1 md:grid-cols-1 lg:grid-cols-3",
  "1-1-4": "grid grid-cols-1 md:grid-cols-1 lg:grid-cols-4",
  "1-1-5": "grid grid-cols-1 md:grid-cols-1 lg:grid-cols-5",
  "1-1-6": "grid grid-cols-1 md:grid-cols-1 lg:grid-cols-6",
  "1-2-1": "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1",
  "1-2-2": "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2",
  "1-2-3": "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  "1-2-4": "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  "1-2-5": "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5",
  "1-2-6": "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6",
  "1-3-1": "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1",
  "1-3-2": "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-2",
  "1-3-3": "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3",
  "1-3-4": "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4",
  "1-3-5": "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5",
  "1-3-6": "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6",
  "1-4-1": "grid grid-cols-1 md:grid-cols-4 lg:grid-cols-1",
  "1-4-2": "grid grid-cols-1 md:grid-cols-4 lg:grid-cols-2",
  "1-4-3": "grid grid-cols-1 md:grid-cols-4 lg:grid-cols-3",
  "1-4-4": "grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4",
  "1-4-5": "grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5",
  "1-4-6": "grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6",
  // mobile 2
  "2-1-1": "grid grid-cols-2 md:grid-cols-1 lg:grid-cols-1",
  "2-1-2": "grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2",
  "2-1-3": "grid grid-cols-2 md:grid-cols-1 lg:grid-cols-3",
  "2-1-4": "grid grid-cols-2 md:grid-cols-1 lg:grid-cols-4",
  "2-1-5": "grid grid-cols-2 md:grid-cols-1 lg:grid-cols-5",
  "2-1-6": "grid grid-cols-2 md:grid-cols-1 lg:grid-cols-6",
  "2-2-1": "grid grid-cols-2 md:grid-cols-2 lg:grid-cols-1",
  "2-2-2": "grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2",
  "2-2-3": "grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3",
  "2-2-4": "grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4",
  "2-2-5": "grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5",
  "2-2-6": "grid grid-cols-2 md:grid-cols-2 lg:grid-cols-6",
  "2-3-1": "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-1",
  "2-3-2": "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2",
  "2-3-3": "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3",
  "2-3-4": "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  "2-3-5": "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
  "2-3-6": "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  "2-4-1": "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-1",
  "2-4-2": "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2",
  "2-4-3": "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-3",
  "2-4-4": "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4",
  "2-4-5": "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5",
  "2-4-6": "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6",
};

/** Static Tailwind class for a responsive grid. Falls back to 1/2/3. */
export function gridColsClass(mobile: number, tablet: number, desktop: number): string {
  const key = `${Math.min(2, Math.max(1, mobile))}-${Math.min(4, Math.max(1, tablet))}-${Math.min(
    6,
    Math.max(1, desktop)
  )}`;
  return GRID_COLS[key] || GRID_COLS["1-2-3"];
}

// ---------------------------------------------------------------------------
// Link resolution
// ---------------------------------------------------------------------------

export interface PortalLinkCtx {
  onOpenModal: (modal: "hotlines" | "report") => void;
  onOpenLogin?: (kind: "admin" | "barangay") => void;
  onOpenApp?: (app: "verify") => void;
}

export type ResolvedLink =
  | { kind: "none" }
  | { kind: "anchor"; anchor: string }
  | { kind: "url"; url: string; newTab: boolean }
  | { kind: "action"; action: "hotlines" | "report" | "login-admin" | "login-barangay" | "verify" };

export function resolveLink(link: SectionLinkConfig | null | undefined, ctx: PortalLinkCtx): ResolvedLink {
  if (!link) return { kind: "none" };
  switch (link.kind) {
    case "anchor":
      return link.anchor ? { kind: "anchor", anchor: link.anchor } : { kind: "none" };
    case "url":
      return link.url ? { kind: "url", url: link.url, newTab: link.target === "new" } : { kind: "none" };
    case "modal": {
      if (!link.modal) return { kind: "none" };
      if (link.modal === "hotlines" || link.modal === "report") return { kind: "action", action: link.modal };
      if (link.modal === "login-admin" || link.modal === "login-barangay") return { kind: "action", action: link.modal };
      return { kind: "none" };
    }
    case "app":
      return link.app === "verify" ? { kind: "action", action: "verify" } : { kind: "none" };
    default:
      return { kind: "none" };
  }
}

export function scrollToAnchor(anchor: string) {
  const el = document.getElementById(anchor);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    // fall back to the top of the page for unknown anchors
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

interface LinkActionProps {
  link: SectionLinkConfig | null | undefined;
  ctx: PortalLinkCtx;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  title?: string;
  /** Called when the link action is triggered (before the action runs). */
  onClick?: () => void;
}

/** Renders an anchor link as a button (scroll), <a> (url) or action button (modal/app). */
export function LinkAction({ link, ctx, className, children, ariaLabel, title, onClick }: LinkActionProps) {
  const resolved = resolveLink(link, ctx);
  if (resolved.kind === "none") {
    return <span className={className}>{children}</span>;
  }
  if (resolved.kind === "url") {
    return (
      <a
        href={resolved.url}
        target={resolved.newTab ? "_blank" : undefined}
        rel={resolved.newTab ? "noopener noreferrer" : undefined}
        className={className}
        aria-label={ariaLabel}
        title={title}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }
  const handle = () => {
    onClick?.();
    if (resolved.kind === "anchor") {
      scrollToAnchor(resolved.anchor);
    } else if (resolved.kind === "action") {
      if (resolved.action === "hotlines" || resolved.action === "report") ctx.onOpenModal(resolved.action);
      else if (resolved.action === "login-admin") ctx.onOpenLogin?.("admin");
      else if (resolved.action === "login-barangay") ctx.onOpenLogin?.("barangay");
      else if (resolved.action === "verify") ctx.onOpenApp?.("verify");
    }
  };
  return (
    <button type="button" onClick={handle} className={className} aria-label={ariaLabel} title={title}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SectionShell — common <section> wrapper + header
// ---------------------------------------------------------------------------

interface SectionShellProps {
  section: PublicSection;
  children: React.ReactNode;
  /** Optional custom header; defaults to the standard section header. */
  header?: React.ReactNode;
  /** Hide the default header entirely (slim sections like alert banners). */
  hideHeader?: boolean;
  linkCtx: PortalLinkCtx;
  dark?: boolean;
}

export function SectionShell({ section, children, header, hideHeader, linkCtx, dark }: SectionShellProps) {
  const cfg = section.config;
  const bg = sectionBg(section);
  const onDark = dark ?? isDarkSection(cfg.bgStyle);
  const anim = cfg.animation === "fade" ? "portal-anim-fade" : cfg.animation === "slide-up" ? "portal-anim-slide-up" : "";
  const width = CONTAINER_WIDTH[cfg.layout] || CONTAINER_WIDTH.container;

  const defaultHeader = hideHeader ? null : (
    <SectionHeader section={section} linkCtx={linkCtx} dark={onDark} />
  );

  return (
    <section
      id={section.key}
      aria-label={section.name || section.heading}
      className={cn(
        "relative scroll-mt-28 overflow-hidden",
        PADDING_Y[cfg.paddingY] || PADDING_Y.md,
        bg.className,
        cfg.cssClass || undefined,
        anim
      )}
      style={bg.style}
    >
      {cfg.bgImage ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${cfg.bgImage})` }}
        />
      ) : null}
      {cfg.bgImage ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: onDark ? "#020f3f" : "#ffffff",
            opacity: (cfg.overlayOpacity ?? 30) / 100,
          }}
        />
      ) : null}
      <div className={cn("relative", width)}>
        {header !== undefined ? header : defaultHeader}
        {children}
      </div>
    </section>
  );
}

export function SectionHeader({
  section,
  linkCtx,
  dark,
}: {
  section: PublicSection;
  linkCtx: PortalLinkCtx;
  dark: boolean;
}) {
  const cfg = section.config;
  const eyebrow = section.template === "hero" ? section.subtitle || "" : TEMPLATE_EYEBROWS[section.template] || "";
  if (!section.heading && !section.description && !section.subtitle && !cfg.ctaEnabled) return null;

  const cta =
    cfg.ctaEnabled && cfg.ctaLink && cfg.ctaLabel ? (
      <LinkAction
        link={cfg.ctaLink}
        ctx={linkCtx}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2",
          dark
            ? "border-white/30 text-white hover:border-gov-gold hover:text-gov-gold"
            : "border-slate-300 text-gov-blue hover:border-gov-gold hover:bg-gov-gold/10"
        )}
      >
        {cfg.ctaLabel}
        <ChevronRight aria-hidden="true" className="size-4" />
      </LinkAction>
    ) : null;

  return (
    <div className="mb-5 flex flex-col gap-4 md:mb-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p
            className={cn(
              "flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]",
              dark ? "text-gov-gold" : "text-gov-blue"
            )}
          >
            {cfg.icon ? (
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-md",
                  dark ? "bg-white/10 text-gov-gold" : "bg-gov-gold/15 text-gov-blue"
                )}
              >
                <PortalIcon name={cfg.icon} className="size-3.5" />
              </span>
            ) : (
              <span aria-hidden="true" className={cn("h-0.5 w-6 rounded-full", dark ? "bg-gov-gold" : "bg-gov-gold")} />
            )}
            {eyebrow}
          </p>
        ) : null}
        <h2
          className={cn(
            "mt-2 text-xl font-bold tracking-tight md:text-2xl",
            dark ? "text-white" : "text-gov-blue-deep"
          )}
        >
          {section.heading}
        </h2>
        {section.subtitle ? (
          <p className={cn("mt-1.5 font-medium", dark ? "text-gov-gold" : "text-gov-blue")}>{section.subtitle}</p>
        ) : null}
        {section.description ? (
          <p className={cn("mt-2 leading-relaxed", dark ? "text-slate-200/85" : "text-slate-600")}>
            {section.description}
          </p>
        ) : null}
      </div>
      {cta ? <div className="shrink-0">{cta}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async / empty states
// ---------------------------------------------------------------------------

export function PortalSkeleton({ className }: { className?: string }) {
  return <Skeleton className={className} />;
}

export function SectionSkeleton({ cards = 3, className }: { cards?: number; className?: string }) {
  return (
    <div className={cn("space-y-4", className)} aria-busy="true" aria-label="Loading content">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="rounded-2xl portal-glass p-6">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="mt-4 h-5 w-3/4 rounded" />
            <Skeleton className="mt-3 h-3 w-full rounded" />
            <Skeleton className="mt-2 h-3 w-5/6 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl portal-glass px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-gov-blue-50 text-gov-blue">
        <PortalIcon name={icon || "info"} className="size-7" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-slate-800">{title}</h3>
      {message ? <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">{message}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function UnavailableCard({
  title,
  message,
  onRetry,
  compact,
}: {
  title: string;
  message?: string | null;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl portal-glass text-center",
        compact ? "px-4 py-8" : "px-6 py-14"
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-200/80 text-slate-500">
        <WifiOff aria-hidden="true" className="size-6" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-slate-700">{title}</h3>
      {message ? (
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">{message}</p>
      ) : null}
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-4 h-10 gap-2 border-slate-300 text-slate-700 hover:border-gov-blue hover:text-gov-blue"
        >
          <RefreshCw aria-hidden="true" className="size-3.5" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Refresh triggers (custom events — the data owner (portal-app) listens)
// ---------------------------------------------------------------------------

export const PORTAL_REFRESH_EVENT = "qas33:portal-refresh";

/** Asks the portal app to re-fetch a live resource (used by retry buttons). */
export function triggerPortalRefresh(kind: "weather" | "forecast") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PORTAL_REFRESH_EVENT, { detail: kind }));
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatDateTimePH(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    if (!Number.isFinite(diff)) return "—";
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
    return formatDateTimePH(iso);
  } catch {
    return "—";
  }
}

/** Extracts digits from a display phone number for tel: links. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Phone-number digits only (used for display in compact contexts). */
export function compactNumber(value: number): string {
  return value.toLocaleString("en-PH");
}

// Re-export for convenience in other portal files.
export { AlertTriangle, TriangleAlert };
