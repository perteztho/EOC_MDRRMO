// QAS33 Public Portal — shared types & contracts
// Single source of truth used by the public frontend (src/components/portal/*),
// the admin builder (src/components/qas33/public-site-manager family) and the
// API routes (src/app/api/public/*, src/app/api/admin/portal/*).

// ---------------------------------------------------------------------------
// Operational modes
// ---------------------------------------------------------------------------

export type OperationalMode = "NORMAL" | "TYPHOON" | "EMERGENCY";

/** Visual operating theme for the public site (TYPHOON & EMERGENCY share the urgent look). */
export type VisualMode = "normal" | "emergency";

export const visualModeOf = (mode: OperationalMode): VisualMode =>
  mode === "NORMAL" ? "normal" : "emergency";

// ---------------------------------------------------------------------------
// Section templates
// ---------------------------------------------------------------------------

export type SectionTemplate =
  | "hero"
  | "alertBanner"
  | "weather"
  | "forecast"
  | "announcements"
  | "ticker"
  | "hotlines"
  | "quickActions"
  | "dashboard"
  | "evacuation"
  | "evacuationMap"
  | "satelliteMap"
  | "preparedness"
  | "hazard"
  | "news"
  | "stats"
  | "links"
  | "residentSignup"
  | "custom";

export interface TemplateMeta {
  template: SectionTemplate;
  name: string;
  description: string;
  icon: string; // lucide icon name
}

export const SECTION_TEMPLATES: TemplateMeta[] = [
  { template: "hero", name: "Hero / Status Dashboard", description: "Large hero banner with operational status, weather summary and primary action buttons.", icon: "shield-check" },
  { template: "alertBanner", name: "Active Alert Banner", description: "Displays currently active public alerts with severity colors. Auto-hides when empty.", icon: "siren" },
  { template: "weather", name: "Live Weather & 7-Day Outlook", description: "Merged weather center: observed Pio Duran AWS conditions plus the 7-day OpenWeatherMap forecast.", icon: "thermometer" },
  { template: "forecast", name: "7-Day Forecast (standalone)", description: "Standalone daily forecast block powered by OpenWeatherMap with rain probability. The merged Live Weather & 7-Day Outlook section already includes this.", icon: "cloud-sun" },
  { template: "announcements", name: "Announcement Center", description: "Public announcements with categories, priority badges and expiry.", icon: "megaphone" },
  { template: "ticker", name: "Broadcast Ticker", description: "Scrolling broadcast message strip (also available under the header).", icon: "radio" },
  { template: "hotlines", name: "Emergency Contacts", description: "Grid of emergency hotline cards with click-to-call.", icon: "phone-call" },
  { template: "quickActions", name: "Quick Actions", description: "Large action tiles — report incident, hotlines, evacuation info, preparedness.", icon: "zap" },
  { template: "dashboard", name: "Public Dashboard", description: "Modular widget dashboard (status, weather, alerts, hotlines, quick links).", icon: "layout-dashboard" },
  { template: "evacuation", name: "Evacuation Centers", description: "Directory of evacuation centers with capacity and status.", icon: "map-pin" },
  { template: "evacuationMap", name: "Evacuation Map (embedded)", description: "Interactive evacuation center map embedded on the homepage.", icon: "map" },
  { template: "satelliteMap", name: "Interactive Satellite Map", description: "Live satellite map (Esri World Imagery) with streets toggle, evacuation center markers and admin-uploaded GeoJSON/KML overlay layers.", icon: "satellite" },
  { template: "preparedness", name: "Preparedness / Safety", description: "Before / During / After safety cards per hazard type.", icon: "hard-hat" },
  { template: "hazard", name: "Hazard Information", description: "Hazard profile cards for the municipality (typhoon, flood, landslide, surge, quake).", icon: "triangle-alert" },
  { template: "news", name: "News & Updates", description: "News cards with thumbnails, categories and read-more.", icon: "newspaper" },
  { template: "stats", name: "Statistics", description: "Municipal DRRM statistics (barangays, population, plan compliance).", icon: "bar-chart-3" },
  { template: "links", name: "Government / Partner Links", description: "Logo/link grid to government agencies and partners.", icon: "landmark" },
  { template: "residentSignup", name: "Resident Account Registration", description: "Public form where residents create a QAS33 resident account (name, barangay, purok, contact). Accounts feed the barangay certificate auto-fill directory.", icon: "user-plus" },
  { template: "custom", name: "Custom Information", description: "Free-form information section with configurable rich content blocks.", icon: "info" },
];

// ---------------------------------------------------------------------------
// Section links (visual link selector)
// ---------------------------------------------------------------------------

export type LinkKind = "none" | "anchor" | "url" | "modal" | "app";

export interface SectionLinkConfig {
  kind: LinkKind;
  /** Homepage section anchor, e.g. "weather" → /#weather */
  anchor?: string;
  /** External or custom URL */
  url?: string;
  /** Built-in modal target */
  modal?: "hotlines" | "report" | "login-admin" | "login-barangay";
  /** Built-in app route */
  app?: "verify";
  target?: "same" | "new";
}

export const LINK_KIND_LABELS: Record<LinkKind, string> = {
  none: "No link",
  anchor: "Homepage section (scroll)",
  url: "External / custom URL",
  modal: "Open a modal",
  app: "App route",
};

// ---------------------------------------------------------------------------
// Section configuration (stored as JSON in HomepageSection.config)
// ---------------------------------------------------------------------------

export interface SectionItem {
  label: string;
  description?: string;
  icon?: string;
  link?: SectionLinkConfig;
  color?: string; // token key, see PORTAL_COLORS
  value?: string; // for stats template
  sub?: string; // secondary value for stats
}

export interface SectionConfig {
  // visibility
  visibleDesktop: boolean;
  visibleTablet: boolean;
  visibleMobile: boolean;
  normalMode: boolean;
  typhoonMode: boolean;
  // layout
  layout: "container" | "wide" | "full";
  columns: { desktop: number; tablet: number; mobile: number };
  // background
  bgStyle: "default" | "light" | "muted" | "primary" | "dark" | "gradient" | "emergency" | "custom";
  bgColor?: string;
  bgImage?: string;
  overlayOpacity?: number; // 0-90 (%)
  // style
  paddingY: "sm" | "md" | "lg" | "xl";
  cardRadius: "none" | "sm" | "md" | "lg" | "xl";
  shadow: "none" | "sm" | "md" | "lg";
  animation: "none" | "fade" | "slide-up";
  icon?: string; // lucide icon name
  // CTA
  ctaEnabled: boolean;
  ctaLabel?: string;
  ctaLink?: SectionLinkConfig;
  // section-level link
  link?: SectionLinkConfig;
  // schedule (ISO strings)
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
  // template-specific content (links/stats/partners lists, custom blocks…)
  items?: SectionItem[];
  data?: Record<string, unknown>;
  // safe custom class from a small whitelist
  cssClass?: string;
}

export const DEFAULT_SECTION_CONFIG: SectionConfig = {
  visibleDesktop: true,
  visibleTablet: true,
  visibleMobile: true,
  normalMode: true,
  typhoonMode: true,
  layout: "container",
  columns: { desktop: 3, tablet: 2, mobile: 1 },
  bgStyle: "default",
  bgColor: "",
  bgImage: "",
  overlayOpacity: 30,
  paddingY: "md",
  cardRadius: "lg",
  shadow: "sm",
  animation: "fade",
  ctaEnabled: false,
  ctaLabel: "",
  scheduleStart: null,
  scheduleEnd: null,
  items: [],
  data: {},
  cssClass: "",
};

export type SectionStatus = "ACTIVE" | "HIDDEN" | "DRAFT";

export interface PublicSection {
  id: string;
  key: string;
  template: SectionTemplate;
  name: string;
  heading: string;
  subtitle: string | null;
  description: string | null;
  status: SectionStatus;
  order: number;
  config: SectionConfig;
}

// ---------------------------------------------------------------------------
// Dashboard widgets
// ---------------------------------------------------------------------------

export type WidgetType =
  | "status"
  | "alerts"
  | "weather"
  | "forecast"
  | "hotlines"
  | "incidents"
  | "evacuation"
  | "announcements"
  | "ticker"
  | "preparedness"
  | "hazard"
  | "contacts"
  | "quicklinks"
  | "custom";

export interface WidgetMeta {
  type: WidgetType;
  name: string;
  description: string;
  icon: string;
}

export const WIDGET_TYPES: WidgetMeta[] = [
  { type: "status", name: "Operational Status", description: "Current operational mode with status indicator.", icon: "activity" },
  { type: "alerts", name: "Active Alerts", description: "Active public alerts with severity.", icon: "siren" },
  { type: "weather", name: "Pio Duran AWS", description: "Live observed conditions from the AWS.", icon: "thermometer" },
  { type: "forecast", name: "Forecast Summary", description: "Compact multi-day forecast.", icon: "cloud-sun" },
  { type: "hotlines", name: "Emergency Hotlines", description: "Top hotline numbers.", icon: "phone-call" },
  { type: "incidents", name: "Response Status", description: "Public incident statistics.", icon: "life-buoy" },
  { type: "evacuation", name: "Evacuation Info", description: "Evacuation center summary.", icon: "map-pin" },
  { type: "announcements", name: "Announcements", description: "Latest public announcements.", icon: "megaphone" },
  { type: "ticker", name: "Broadcast", description: "Latest broadcast messages.", icon: "radio" },
  { type: "preparedness", name: "Preparedness Tips", description: "Rotating safety tips.", icon: "hard-hat" },
  { type: "hazard", name: "Hazard Brief", description: "Municipal hazard profile summary.", icon: "triangle-alert" },
  { type: "contacts", name: "Emergency Contacts", description: "Key contacts with call buttons.", icon: "contact" },
  { type: "quicklinks", name: "Quick Links", description: "Configurable quick link list.", icon: "link" },
  { type: "custom", name: "Custom Widget", description: "Build your own widget — custom content blocks, icon, theme colors, card style and size. Fully configurable and deployable.", icon: "layout-template" },
];

// Widget appearance theme (accent color)
export type WidgetTheme = "blue" | "gold" | "emerald" | "red" | "violet" | "slate" | "dark";

// Widget card visual style
export type WidgetCardStyle = "glass" | "solid" | "outline" | "gradient";

export const WIDGET_THEMES: Array<{ key: WidgetTheme; label: string; swatch: string }> = [
  { key: "blue", label: "Government Blue", swatch: "#042189" },
  { key: "gold", label: "Sun Gold", swatch: "#fccf03" },
  { key: "emerald", label: "Emergency Green", swatch: "#059669" },
  { key: "red", label: "Alert Red", swatch: "#dc2626" },
  { key: "violet", label: "Violet", swatch: "#7c3aed" },
  { key: "slate", label: "Neutral Slate", swatch: "#475569" },
  { key: "dark", label: "Deep Navy", swatch: "#0f172a" },
];

export const WIDGET_CARD_STYLES: Array<{ key: WidgetCardStyle; label: string; description: string }> = [
  { key: "glass", label: "Glass", description: "Frosted translucent card (matches the portal glassmorphism)." },
  { key: "solid", label: "Solid", description: "Solid themed background with white text." },
  { key: "outline", label: "Outline", description: "Clean bordered card with themed accents." },
  { key: "gradient", label: "Gradient", description: "Themed gradient background with white text." },
];

export type WidgetSize = "small" | "wide" | "large" | "tall";

export const WIDGET_SIZES: Array<{ key: WidgetSize; label: string; description: string }> = [
  { key: "small", label: "Small", description: "Standard quarter-width card (1 of 4 columns)." },
  { key: "wide", label: "Wide", description: "Half-width card (2 of 4 columns)." },
  { key: "large", label: "Large", description: "Full-width card (4 of 4 columns)." },
  { key: "tall", label: "Tall", description: "Quarter-width card spanning two rows (list-friendly)." },
];

// Custom-widget content block (only used by the "custom" widget type)
export interface CustomWidgetBlock {
  kind: "text" | "stat" | "link" | "bullet";
  label?: string; // stat label / link label / bullet text
  value?: string; // stat value / text body
  icon?: string;
  link?: SectionLinkConfig;
}

export interface WidgetConfig {
  size: WidgetSize;
  icon?: string;
  ctaLabel?: string;
  link?: SectionLinkConfig;
  refreshSec?: number;
  normalMode: boolean;
  typhoonMode: boolean;
  visibleMobile: boolean;
  visibleDesktop: boolean;
  items?: SectionItem[]; // used by quicklinks
  // --- appearance (all widget types; primarily for custom widgets) ---
  theme?: WidgetTheme; // accent color
  cardStyle?: WidgetCardStyle; // glass | solid | outline | gradient
  bodyText?: string; // custom widget body paragraph
  blocks?: CustomWidgetBlock[]; // custom widget content blocks
  deployable?: boolean; // custom widgets: show the Deploy/Undeploy quick action
}

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  size: "small",
  refreshSec: 120,
  normalMode: true,
  typhoonMode: true,
  visibleMobile: true,
  visibleDesktop: true,
  items: [],
  theme: "blue",
  cardStyle: "glass",
  bodyText: "",
  blocks: [],
};

export interface PublicWidget {
  id: string;
  key: string;
  type: WidgetType;
  title: string;
  order: number;
  enabled: boolean;
  config: WidgetConfig;
}

// ---------------------------------------------------------------------------
// Settings scopes (SiteConfig rows; draft vs published JSON)
// ---------------------------------------------------------------------------

export interface GeneralSettings {
  siteTitle: string;
  siteDescription: string;
  logoText: string; // short brand text, e.g. "MDRRMO"
  tagline: string; // e.g. "Pio Duran, Albay"
  hotline: string; // primary hotline displayed in header/footer
  officeAddress: string;
  officeHours: string;
  contactEmail: string;
  contactPhone: string;
  facebookUrl: string;
  youtubeUrl: string;
  privacyUrl: string;
  termsUrl: string;
  accessibilityNote: string;
}

export interface OperationalSettings {
  mode: OperationalMode;
  normalTitle: string;
  normalDescription: string;
  emergencyTitle: string;
  emergencyDescription: string;
  showPublicIndicator: boolean;
  bannerEnabled: boolean;
  bannerText: string;
  // optional scheduled override
  scheduledEnabled: boolean;
  scheduledMode: OperationalMode;
  scheduledStart: string; // ISO datetime-local
  scheduledEnd: string;
}

export interface WeatherSettings {
  awsEnabled: boolean;
  weatherlinkApiKey: string;
  weatherlinkApiSecret: string;
  weatherlinkStationId: string;
  awsRefreshMin: number;
  owmEnabled: boolean;
  owmApiKey: string;
  lat: number;
  lon: number;
  forecastRefreshMin: number;
  /** Automatic fallback to the keyless Open-Meteo service whenever the primary
   *  provider (WeatherLink / OpenWeatherMap) is not configured or unreachable.
   *  Keeps the public panels showing REAL live data instead of "unavailable". */
  openMeteoFallback: boolean;
  showUv: boolean;
  showPressure: boolean;
  showVisibility: boolean;
  showWind: boolean;
  showRain: boolean;
}

export interface AlertSettings {
  defaultPriority: string;
  criticalColor: string;
  warningColor: string;
  advisoryColor: string;
  infoColor: string;
  autoExpireHours: number;
  showInHero: boolean;
  heroMaxAlerts: number;
}

export interface NavItemConfig {
  id: string;
  label: string;
  link: SectionLinkConfig;
  visible: boolean;
}

export interface NavigationSettings {
  items: NavItemConfig[];
}

export interface FooterLink {
  label: string;
  link: SectionLinkConfig;
}

export interface FooterColumn {
  id: string;
  title: string;
  links: FooterLink[];
}

export interface FooterSettings {
  columns: FooterColumn[];
  showHotlineStrip: boolean;
  partners: { label: string; url?: string }[];
  copyrightNote: string;
}

export type SiteConfigScope = "general" | "operational" | "weather" | "alert" | "navigation" | "footer";

export const SITE_CONFIG_SCOPES: SiteConfigScope[] = ["general", "operational", "weather", "alert", "navigation", "footer"];

// ---------------------------------------------------------------------------
// Public DTOs (content)
// ---------------------------------------------------------------------------

export interface AnnouncementDTO {
  id: string;
  title: string;
  category: string;
  priority: string;
  content: string;
  imageUrl: string | null;
  attachmentUrl: string | null;
  publishAt: string;
  expiresAt: string | null;
  areas: string | null;
  featured: boolean;
  pinned: boolean;
  linkUrl: string | null;
}

export interface TickerDTO {
  id: string;
  message: string;
  priority: string;
  icon: string | null;
}

export interface AlertDTO {
  id: string;
  title: string;
  level: string;
  message: string;
  linkUrl: string | null;
  createdAt: string;
}

export interface HotlineDTO {
  id: string;
  agency: string;
  serviceType: string;
  phone: string;
  icon: string;
  category: string;
}

export interface NewsDTO {
  id: string;
  title: string;
  category: string;
  summary: string | null;
  content: string;
  thumbnailUrl: string | null;
  publishAt: string;
  featured: boolean;
  pinned: boolean;
  linkUrl: string | null;
}

export interface PreparednessDTO {
  id: string;
  title: string;
  hazard: string;
  phase: string;
  content: string;
  icon: string | null;
  linkUrl: string | null;
}

export interface EvacuationDTO {
  id: string;
  name: string;
  barangay: string;
  address: string | null;
  capacity: number | null;
  status: string;
  notes: string | null;
}

export interface BarangayRef {
  code: string;
  name: string;
}

export interface PortalStats {
  barangays: number;
  population: number;
  households: number;
  approvedPlans: number;
  totalSubmissions: number;
}

export interface PortalContentResponse {
  ok: true;
  announcements: AnnouncementDTO[];
  ticker: TickerDTO[];
  alerts: AlertDTO[];
  hotlines: HotlineDTO[];
  news: NewsDTO[];
  preparedness: PreparednessDTO[];
  evacuation: EvacuationDTO[];
  barangays: BarangayRef[];
  stats: PortalStats;
}

// ---------------------------------------------------------------------------
// Weather DTOs
// ---------------------------------------------------------------------------

export interface AwsWeatherData {
  temperature: number | null;
  feelsLike: number | null;
  humidity: number | null;
  rainfall: number | null; // daily total, mm
  rainRate: number | null; // mm/h
  windSpeed: number | null; // km/h
  windDir: string | null;
  windDirDeg: number | null;
  pressure: number | null; // hPa
  uv: number | null;
  visibility: number | null; // km
  condition: string | null;
}

export interface AwsWeatherResponse {
  ok: true;
  available: boolean;
  source: string;
  observedAt: string | null;
  fetchedAt: string;
  stale: boolean;
  reason?: "not_configured" | "upstream_error" | "disabled";
  message?: string;
  data: AwsWeatherData | null;
}

export interface ForecastDay {
  date: string; // YYYY-MM-DD
  dayName: string;
  icon: string; // OpenWeatherMap icon code
  condition: string;
  high: number;
  low: number;
  rainProb: number; // %
  rainMm: number | null;
  wind: number | null; // km/h
  humidity: number | null; // %
}

export interface ForecastResponse {
  ok: true;
  available: boolean;
  source: string;
  locationLabel: string;
  fetchedAt: string;
  days: ForecastDay[];
  reason?: "not_configured" | "upstream_error" | "disabled";
  message?: string;
}

// ---------------------------------------------------------------------------
// Homepage published payload (GET /api/public/homepage)
// ---------------------------------------------------------------------------

export interface HomepageResponse {
  ok: true;
  version: number;
  publishedAt: string;
  mode: OperationalMode;
  visualMode: VisualMode;
  operational: OperationalSettings;
  general: GeneralSettings;
  /** Published alert-scope settings (hero alert visibility + colors). */
  alert: AlertSettings;
  sections: PublicSection[];
  widgets: PublicWidget[];
  navigation: NavigationSettings;
  footer: FooterSettings;
  serverTime: string;
}

// ---------------------------------------------------------------------------
// Incident reporting
// ---------------------------------------------------------------------------

export const INCIDENT_TYPES = [
  "FLOOD",
  "LANDSLIDE",
  "FIRE",
  "EARTHQUAKE",
  "TYPHOON_DAMAGE",
  "STORM_SURGE",
  "VEHICULAR_ACCIDENT",
  "MEDICAL_EMERGENCY",
  "MISSING_PERSON",
  "RESCUE_REQUEST",
  "ROAD_OBSTRUCTION",
  "FALLEN_TREE",
  "ELECTRICAL_HAZARD",
  "COASTAL_EMERGENCY",
  "OTHER",
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_TYPE_LABELS: Record<string, string> = {
  FLOOD: "Flood",
  LANDSLIDE: "Landslide",
  FIRE: "Fire",
  EARTHQUAKE: "Earthquake",
  TYPHOON_DAMAGE: "Typhoon Damage",
  STORM_SURGE: "Storm Surge",
  VEHICULAR_ACCIDENT: "Vehicular Accident",
  MEDICAL_EMERGENCY: "Medical Emergency",
  MISSING_PERSON: "Missing Person",
  RESCUE_REQUEST: "Rescue Request",
  ROAD_OBSTRUCTION: "Road Obstruction",
  FALLEN_TREE: "Fallen Tree",
  ELECTRICAL_HAZARD: "Electrical Hazard",
  COASTAL_EMERGENCY: "Coastal Emergency",
  OTHER: "Other",
};

export const URGENCY_LEVELS = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;

export interface IncidentSubmitResponse {
  ok: true;
  referenceNo: string;
  status: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Admin DTOs
// ---------------------------------------------------------------------------

export interface AdminSection extends PublicSection {
  updatedAt: string;
}

export interface AdminWidget extends PublicWidget {
  updatedAt: string;
}

export interface SnapshotInfo {
  id: string;
  version: number;
  note: string | null;
  createdAt: string;
  isActive: boolean;
}

export interface PublishStateResponse {
  ok: true;
  active: SnapshotInfo | null;
  snapshots: SnapshotInfo[];
  hasDraftChanges: boolean;
}

export interface AdminConfigResponse {
  ok: true;
  scopes: Record<string, unknown>; // scope → draft value (weather keys masked)
  publishedAt: string | null;
  activeVersion: number | null;
  hasDraftChanges: boolean;
}

// ---------------------------------------------------------------------------
// Shared label/color helpers
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "General Announcement",
  WEATHER_ADVISORY: "Weather Advisory",
  DISASTER_ADVISORY: "Disaster Advisory",
  EVACUATION: "Evacuation Notice",
  SUSPENSION: "Class / Work Suspension",
  PUBLIC_SAFETY: "Public Safety",
  ROAD_ADVISORY: "Road / Traffic Advisory",
  RELIEF_OPERATION: "Relief Operation",
  EMERGENCY_ALERT: "Emergency Alert",
};

export const PRIORITY_ORDER = ["CRITICAL", "HIGH", "NORMAL", "LOW"];

export const HAZARDS = ["GENERAL", "TYPHOON", "FLOOD", "LANDSLIDE", "EARTHQUAKE", "STORM_SURGE", "FIRE"] as const;

export const PHASES = ["BEFORE", "DURING", "AFTER"] as const;

// ---------------------------------------------------------------------------
// Content manager definitions (drive BOTH admin forms and server validation)
// ---------------------------------------------------------------------------

export type ContentFieldType = "text" | "textarea" | "select" | "number" | "boolean" | "datetime" | "url";

export interface ContentFieldDef {
  name: string;
  label: string;
  type: ContentFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  max?: number;
  default?: string | number | boolean;
}

export interface ContentTypeDef {
  key: string;
  label: string;
  pluralLabel: string;
  icon: string;
  description: string;
  fields: ContentFieldDef[];
  listFields: string[]; // columns shown in the admin table
}

const opt = (v: string, l: string) => ({ value: v, label: l });

export const CONTENT_TYPES: ContentTypeDef[] = [
  {
    key: "announcements",
    label: "Announcement",
    pluralLabel: "Announcements",
    icon: "megaphone",
    description: "Public announcements shown in the Announcement Center and hero area.",
    listFields: ["title", "category", "priority", "status", "publishAt"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 200 },
      {
        name: "category", label: "Category", type: "select", default: "GENERAL",
        options: Object.entries(CATEGORY_LABELS).map(([v, l]) => opt(v, l)),
      },
      {
        name: "priority", label: "Priority", type: "select", default: "NORMAL",
        options: [opt("CRITICAL", "Critical"), opt("HIGH", "High"), opt("NORMAL", "Normal"), opt("LOW", "Low")],
      },
      { name: "content", label: "Content", type: "textarea", required: true, max: 5000, help: "Plain text. Line breaks are preserved." },
      { name: "imageUrl", label: "Image URL", type: "url", max: 500 },
      { name: "attachmentUrl", label: "Attachment URL", type: "url", max: 500 },
      { name: "publishAt", label: "Publication date", type: "datetime", default: "now" },
      { name: "expiresAt", label: "Expiration date (optional)", type: "datetime" },
      { name: "areas", label: "Affected barangays / areas", type: "text", max: 300, placeholder: "e.g. Poblacion Centro, Ilawod, Pawa", help: "Comma-separated. Leave blank for municipality-wide." },
      {
        name: "status", label: "Status", type: "select", default: "PUBLISHED",
        options: [opt("DRAFT", "Draft"), opt("PUBLISHED", "Published"), opt("ARCHIVED", "Archived")],
      },
      { name: "featured", label: "Featured", type: "boolean", default: false },
      { name: "pinned", label: "Pinned to top", type: "boolean", default: false },
      { name: "showOnHomepage", label: "Show on homepage", type: "boolean", default: true },
      { name: "linkUrl", label: "Link destination (optional)", type: "url", max: 500 },
    ],
  },
  {
    key: "ticker",
    label: "Ticker message",
    pluralLabel: "Broadcast Ticker",
    icon: "radio",
    description: "Scrolling broadcast messages shown beneath the navigation.",
    listFields: ["message", "priority", "active", "displayOrder"],
    fields: [
      { name: "message", label: "Message", type: "text", required: true, max: 300 },
      {
        name: "priority", label: "Priority", type: "select", default: "NORMAL",
        options: [opt("NORMAL", "Normal"), opt("HIGH", "High"), opt("EMERGENCY", "Emergency")],
      },
      { name: "icon", label: "Icon (lucide name)", type: "text", max: 40, placeholder: "shield-check" },
      { name: "active", label: "Active", type: "boolean", default: true },
      { name: "displayOrder", label: "Display order", type: "number", default: 0 },
      { name: "startsAt", label: "Start showing (optional)", type: "datetime" },
      { name: "endsAt", label: "Stop showing (optional)", type: "datetime" },
    ],
  },
  {
    key: "hotlines",
    label: "Hotline",
    pluralLabel: "Emergency Hotlines",
    icon: "phone-call",
    description: "Emergency contact directory used by the hotline modal and sections.",
    listFields: ["agency", "serviceType", "phone", "visible", "displayOrder"],
    fields: [
      { name: "agency", label: "Agency / Office", type: "text", required: true, max: 120 },
      { name: "serviceType", label: "Service type", type: "text", required: true, max: 120, placeholder: "e.g. Fire & rescue" },
      { name: "phone", label: "Phone number", type: "text", required: true, max: 40, placeholder: "(052) 000-0000 or 911" },
      { name: "icon", label: "Icon (lucide name)", type: "text", max: 40, default: "phone" },
      { name: "category", label: "Category", type: "text", max: 40, default: "EMERGENCY" },
      { name: "displayOrder", label: "Display order", type: "number", default: 0 },
      { name: "visible", label: "Visible", type: "boolean", default: true },
    ],
  },
  {
    key: "alerts",
    label: "Alert",
    pluralLabel: "Public Alerts",
    icon: "siren",
    description: "Active public alerts displayed in the alert banner and hero area.",
    listFields: ["title", "level", "active", "createdAt"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 200 },
      {
        name: "level", label: "Severity level", type: "select", default: "ADVISORY",
        options: [opt("INFO", "Info"), opt("ADVISORY", "Advisory"), opt("WARNING", "Warning"), opt("CRITICAL", "Critical")],
      },
      { name: "message", label: "Message", type: "textarea", required: true, max: 1000 },
      { name: "active", label: "Active", type: "boolean", default: true },
      { name: "linkUrl", label: "More info link (optional)", type: "url", max: 500 },
      { name: "startsAt", label: "Start (optional)", type: "datetime" },
      { name: "expiresAt", label: "Expires (optional)", type: "datetime" },
    ],
  },
  {
    key: "news",
    label: "News article",
    pluralLabel: "News & Updates",
    icon: "newspaper",
    description: "News and public updates shown in the News section.",
    listFields: ["title", "category", "status", "publishAt"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 200 },
      {
        name: "category", label: "Category", type: "select", default: "GENERAL",
        options: [opt("GENERAL", "General"), opt("DRILL", "Drill / Exercise"), opt("RESPONSE", "Response Operations"), opt("TRAINING", "Training & Capacity Building"), opt("PROGRAM", "Program & Advocacy"), opt("AWARD", "Recognition")],
      },
      { name: "summary", label: "Summary", type: "textarea", max: 400, help: "Short excerpt shown on cards." },
      { name: "content", label: "Full story", type: "textarea", required: true, max: 8000 },
      { name: "thumbnailUrl", label: "Thumbnail image URL", type: "url", max: 500 },
      { name: "publishAt", label: "Publication date", type: "datetime", default: "now" },
      { name: "featured", label: "Featured", type: "boolean", default: false },
      { name: "pinned", label: "Pinned", type: "boolean", default: false },
      {
        name: "status", label: "Status", type: "select", default: "PUBLISHED",
        options: [opt("DRAFT", "Draft"), opt("PUBLISHED", "Published"), opt("ARCHIVED", "Archived")],
      },
      { name: "linkUrl", label: "External link (optional)", type: "url", max: 500 },
    ],
  },
  {
    key: "preparedness",
    label: "Safety topic",
    pluralLabel: "Preparedness & Safety",
    icon: "hard-hat",
    description: "Before / During / After safety cards per hazard.",
    listFields: ["title", "hazard", "phase", "visible", "displayOrder"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 160 },
      {
        name: "hazard", label: "Hazard", type: "select", default: "GENERAL",
        options: [
          opt("GENERAL", "General"), opt("TYPHOON", "Typhoon"), opt("FLOOD", "Flood"), opt("LANDSLIDE", "Landslide"),
          opt("EARTHQUAKE", "Earthquake"), opt("STORM_SURGE", "Storm Surge"), opt("FIRE", "Fire"),
        ],
      },
      {
        name: "phase", label: "Phase", type: "select", default: "BEFORE",
        options: [opt("BEFORE", "Before"), opt("DURING", "During"), opt("AFTER", "After")],
      },
      { name: "content", label: "Safety steps", type: "textarea", required: true, max: 2000 },
      { name: "icon", label: "Icon (lucide name)", type: "text", max: 40 },
      { name: "displayOrder", label: "Display order", type: "number", default: 0 },
      { name: "visible", label: "Visible", type: "boolean", default: true },
      { name: "linkUrl", label: "More info link (optional)", type: "url", max: 500 },
    ],
  },
  {
    key: "evacuation",
    label: "Evacuation center",
    pluralLabel: "Evacuation Centers",
    icon: "map-pin",
    description: "Directory of evacuation centers with capacity and status (quick directory editor — full management lives in Evacuation Management).",
    listFields: ["name", "barangay", "status", "capacity", "visible"],
    fields: [
      { name: "name", label: "Center name", type: "text", required: true, max: 200 },
      { name: "barangay", label: "Barangay", type: "text", required: true, max: 80 },
      { name: "address", label: "Address / landmark", type: "text", max: 200 },
      {
        name: "facilityType", label: "Facility type", type: "select", default: "SCHOOL",
        options: [opt("SCHOOL", "School"), opt("BARANGAY_HALL", "Barangay Hall"), opt("GYMNASIUM", "Gymnasium"), opt("COVERED_COURT", "Covered Court"), opt("CHURCH", "Church / Chapel"), opt("EVAC_SITE", "Designated Evacuation Site"), opt("OTHER", "Other")],
      },
      { name: "contactPerson", label: "Contact person", type: "text", max: 120 },
      { name: "contactNumber", label: "Contact number", type: "text", max: 30 },
      { name: "capacity", label: "Capacity (persons)", type: "number", default: 0 },
      { name: "currentOccupants", label: "Current occupants", type: "number", default: 0 },
      {
        name: "status", label: "Status", type: "select", default: "OPEN",
        options: [opt("OPEN", "Open"), opt("NEAR_CAPACITY", "Near Capacity"), opt("FULL", "Full"), opt("CLOSED", "Closed"), opt("PREPARING", "Preparing")],
      },
      { name: "notes", label: "Notes", type: "textarea", max: 500 },
      { name: "displayOrder", label: "Display order", type: "number", default: 0 },
      { name: "visible", label: "Visible", type: "boolean", default: true },
    ],
  },
];

export const CONTENT_TYPE_KEYS = CONTENT_TYPES.map((t) => t.key);

export function getContentTypeDef(key: string): ContentTypeDef | undefined {
  return CONTENT_TYPES.find((t) => t.key === key);
}
