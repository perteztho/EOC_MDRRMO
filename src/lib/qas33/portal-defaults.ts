// QAS33 Public Portal — default configuration & seed content
// Used by the seed script, the "Reset Homepage" action and the template library.

import type {
  SectionConfig,
  SectionItem,
  SectionTemplate,
  WidgetConfig,
  WidgetType,
  GeneralSettings,
  OperationalSettings,
  WeatherSettings,
  AlertSettings,
  NavigationSettings,
  FooterSettings,
} from "./portal-types";
import { DEFAULT_SECTION_CONFIG, DEFAULT_WIDGET_CONFIG } from "./portal-types";

// ---------------------------------------------------------------------------
// Settings defaults
// ---------------------------------------------------------------------------

export const DEFAULT_GENERAL: GeneralSettings = {
  siteTitle: "MDRRMO Pio Duran — Official Public Portal",
  siteDescription:
    "Official disaster risk reduction and management information portal of the Municipal DRRM Office of Pio Duran, Albay — emergency hotlines, live weather, public advisories, evacuation information and preparedness guides.",
  logoText: "MDRRMO",
  tagline: "Pio Duran, Albay",
  hotline: "(052) 000-0000",
  officeAddress: "Municipal Hall, Poblacion Centro, Pio Duran, Albay",
  officeHours: "Monday–Friday 8:00 AM – 5:00 PM · Operations Center 24/7",
  contactEmail: "mdrrmo@pioduran.gov.ph",
  contactPhone: "(052) 000-0000",
  facebookUrl: "",
  youtubeUrl: "",
  privacyUrl: "",
  termsUrl: "",
  accessibilityNote: "This portal is designed for accessibility. For assistance, contact the MDRRMO office.",
};

export const DEFAULT_OPERATIONAL: OperationalSettings = {
  mode: "NORMAL",
  normalTitle: "NORMAL OPERATION",
  normalDescription: "All systems are operating under normal conditions. The Operations Center monitors hazards 24/7.",
  emergencyTitle: "ACTIVE TYPHOON / EMERGENCY OPERATION",
  emergencyDescription:
    "The MDRRMO Emergency Operations Center is actively responding. Follow official advisories and instructions from local authorities.",
  showPublicIndicator: true,
  bannerEnabled: true,
  bannerText:
    "EMERGENCY OPERATIONS ARE ACTIVE — Monitor official advisories and follow instructions from authorities. For urgent assistance, call the MDRRMO hotline.",
  scheduledEnabled: false,
  scheduledMode: "TYPHOON",
  scheduledStart: "",
  scheduledEnd: "",
};

export const DEFAULT_WEATHER: WeatherSettings = {
  awsEnabled: true,
  weatherlinkApiKey: "",
  weatherlinkApiSecret: "",
  weatherlinkStationId: "",
  awsRefreshMin: 5,
  owmEnabled: true,
  owmApiKey: "",
  lat: 13.0678,
  lon: 123.4575,
  forecastRefreshMin: 15,
  openMeteoFallback: true,
  showUv: true,
  showPressure: true,
  showVisibility: true,
  showWind: true,
  showRain: true,
};

export const DEFAULT_ALERT: AlertSettings = {
  defaultPriority: "ADVISORY",
  criticalColor: "#dc2626",
  warningColor: "#ea580c",
  advisoryColor: "#ca8a04",
  infoColor: "#042189",
  autoExpireHours: 48,
  showInHero: true,
  heroMaxAlerts: 3,
};

export const DEFAULT_NAVIGATION: NavigationSettings = {
  items: [
    { id: "nav-home", label: "Home", link: { kind: "anchor", anchor: "home" }, visible: true },
    { id: "nav-about", label: "About", link: { kind: "anchor", anchor: "about" }, visible: true },
    { id: "nav-preparedness", label: "Preparedness", link: { kind: "anchor", anchor: "preparedness" }, visible: true },
    { id: "nav-emergency", label: "Emergency Response", link: { kind: "anchor", anchor: "emergency" }, visible: true },
    { id: "nav-resources", label: "Resources", link: { kind: "anchor", anchor: "resources" }, visible: true },
    { id: "nav-news", label: "News & Updates", link: { kind: "anchor", anchor: "news" }, visible: true },
    { id: "nav-contact", label: "Contact", link: { kind: "anchor", anchor: "contact" }, visible: true },
  ],
};

export const DEFAULT_FOOTER: FooterSettings = {
  columns: [
    {
      id: "fc-quick",
      title: "Quick Links",
      links: [
        { label: "Home", link: { kind: "anchor", anchor: "home" } },
        { label: "Announcements", link: { kind: "anchor", anchor: "announcements" } },
        { label: "Live Weather", link: { kind: "anchor", anchor: "weather" } },
        { label: "News & Updates", link: { kind: "anchor", anchor: "news" } },
        { label: "Preparedness", link: { kind: "anchor", anchor: "preparedness" } },
      ],
    },
    {
      id: "fc-emergency",
      title: "Emergency",
      links: [
        { label: "Report an Incident", link: { kind: "modal", modal: "report" } },
        { label: "Emergency Hotlines", link: { kind: "modal", modal: "hotlines" } },
        { label: "Evacuation Centers", link: { kind: "anchor", anchor: "evacuation" } },
        { label: "Hazard Information", link: { kind: "anchor", anchor: "hazards" } },
      ],
    },
    {
      id: "fc-gov",
      title: "Government Links",
      links: [
        { label: "DOST-PAGASA", link: { kind: "url", url: "https://www.pagasa.dost.gov.ph", target: "new" } },
        { label: "NDRRMC", link: { kind: "url", url: "http://www.ndrrmc.gov.ph", target: "new" } },
        { label: "DILG", link: { kind: "url", url: "https://www.dilg.gov.ph", target: "new" } },
        { label: "PHIVOLCS", link: { kind: "url", url: "https://www.phivolcs.dost.gov.ph", target: "new" } },
        { label: "Province of Albay", link: { kind: "url", url: "https://albay.gov.ph", target: "new" } },
      ],
    },
  ],
  showHotlineStrip: true,
  partners: [
    { label: "DILG Region V" },
    { label: "OCD Region V" },
    { label: "PDRRMO Albay" },
    { label: "BFP" },
    { label: "PNP" },
    { label: "Philippine Coast Guard" },
    { label: "DOST-PAGASA" },
    { label: "PHIVOLCS" },
  ],
  copyrightNote: "",
};

// ---------------------------------------------------------------------------
// Template-specific config defaults
// ---------------------------------------------------------------------------

const cfg = (over: Partial<SectionConfig>): SectionConfig => ({
  ...DEFAULT_SECTION_CONFIG,
  ...over,
  columns: { ...DEFAULT_SECTION_CONFIG.columns, ...(over.columns ?? {}) },
});

/** Config defaults applied when an admin adds a section from the template library. */
export function templateDefaultConfig(template: SectionTemplate): SectionConfig {
  switch (template) {
    case "hero":
      return cfg({ layout: "full", bgStyle: "gradient", paddingY: "xl", normalMode: true, typhoonMode: true, animation: "fade" });
    case "alertBanner":
      return cfg({ layout: "full", bgStyle: "custom", bgColor: "#fef2f2", paddingY: "sm", cardRadius: "md", shadow: "none" });
    case "weather":
      return cfg({ bgStyle: "light", columns: { desktop: 4, tablet: 2, mobile: 2 } });
    case "satelliteMap":
      return cfg({ layout: "wide", paddingY: "md", bgStyle: "default" });
    case "forecast":
      return cfg({ bgStyle: "default", paddingY: "md" });
    case "announcements":
      return cfg({ bgStyle: "default", columns: { desktop: 2, tablet: 1, mobile: 1 } });
    case "ticker":
      return cfg({ layout: "full", bgStyle: "primary", paddingY: "sm", shadow: "none" });
    case "hotlines":
      return cfg({ bgStyle: "light", columns: { desktop: 4, tablet: 2, mobile: 1 } });
    case "quickActions":
      return cfg({ bgStyle: "default", columns: { desktop: 4, tablet: 2, mobile: 2 }, cardRadius: "xl" });
    case "dashboard":
      return cfg({ bgStyle: "muted", paddingY: "lg" });
    case "evacuation":
      return cfg({ bgStyle: "default", columns: { desktop: 3, tablet: 2, mobile: 1 } });
    case "preparedness":
      return cfg({ bgStyle: "light", columns: { desktop: 3, tablet: 2, mobile: 1 } });
    case "hazard":
      return cfg({ bgStyle: "default", columns: { desktop: 3, tablet: 2, mobile: 1 } });
    case "news":
      return cfg({ bgStyle: "default", columns: { desktop: 3, tablet: 2, mobile: 1 } });
    case "stats":
      return cfg({ bgStyle: "primary", paddingY: "lg", columns: { desktop: 4, tablet: 2, mobile: 2 }, shadow: "none" });
    case "links":
      return cfg({ bgStyle: "default", columns: { desktop: 5, tablet: 3, mobile: 2 } });
    case "residentSignup":
      return cfg({ bgStyle: "light", paddingY: "lg", icon: "user-plus" });
    case "custom":
      return cfg({ bgStyle: "default" });
    default:
      return cfg({});
  }
}

export interface DefaultSectionDef {
  key: string;
  template: SectionTemplate;
  name: string;
  heading: string;
  subtitle?: string;
  description?: string;
  status?: "ACTIVE" | "HIDDEN" | "DRAFT";
  config: SectionConfig;
}

// ---------------------------------------------------------------------------
// Default homepage sections
// ---------------------------------------------------------------------------

const GOV_LINK_ITEMS: SectionItem[] = [
  { label: "DOST-PAGASA", description: "Weather forecasts, advisories & warnings", icon: "cloud-sun", link: { kind: "url", url: "https://www.pagasa.dost.gov.ph", target: "new" } },
  { label: "NDRRMC", description: "National Disaster Risk Reduction & Management Council", icon: "shield", link: { kind: "url", url: "http://www.ndrrmc.gov.ph", target: "new" } },
  { label: "OCD Region V", description: "Office of Civil Defense — Bicol Region", icon: "landmark", link: { kind: "url", url: "https://ocd.gov.ph", target: "new" } },
  { label: "DILG", description: "Department of the Interior and Local Government", icon: "building-2", link: { kind: "url", url: "https://www.dilg.gov.ph", target: "new" } },
  { label: "DSWD", description: "Department of Social Welfare & Development", icon: "hand-heart", link: { kind: "url", url: "https://www.dswd.gov.ph", target: "new" } },
  { label: "DOH", description: "Department of Health", icon: "heart-pulse", link: { kind: "url", url: "https://doh.gov.ph", target: "new" } },
  { label: "PHIVOLCS", description: "Volcanology, seismology & earthquake info", icon: "mountain", link: { kind: "url", url: "https://www.phivolcs.dost.gov.ph", target: "new" } },
  { label: "MGB", description: "Geohazard maps & assessments", icon: "map", link: { kind: "url", url: "https://mgb.gov.ph", target: "new" } },
  { label: "DepEd", description: "Class suspension bulletins", icon: "graduation-cap", link: { kind: "url", url: "https://www.deped.gov.ph", target: "new" } },
  { label: "Province of Albay", description: "Provincial Government of Albay", icon: "landmark", link: { kind: "url", url: "https://albay.gov.ph", target: "new" } },
];

const HAZARD_ITEMS: SectionItem[] = [
  { label: "Typhoon", description: "Strong winds and heavy rainfall. Pio Duran lies within the frequent typhoon corridor of the Bicol Region.", icon: "wind", color: "blue" },
  { label: "Flood", description: "Low-lying and riverside barangays are prone to flooding during prolonged heavy rainfall.", icon: "waves", color: "cyan" },
  { label: "Landslide", description: "Sloping upland areas may experience landslides during intense and prolonged rains.", icon: "mountain", color: "amber" },
  { label: "Storm Surge", description: "Coastal barangays facing Ragay Gulf can be affected by storm surge during typhoons.", icon: "water", color: "teal" },
  { label: "Earthquake", description: "Albay lies near active earthquake generators. Be ready to Duck, Cover and Hold.", icon: "activity", color: "orange" },
  { label: "Fire", description: "Residential and dry-season grass fires. Practice fire safety at home and in the workplace.", icon: "flame", color: "red" },
];

export const DEFAULT_SECTIONS: DefaultSectionDef[] = [
  {
    key: "home",
    template: "hero",
    name: "Hero — Status Dashboard",
    heading: "Municipal Disaster Risk Reduction & Management Office",
    subtitle: "Pio Duran, Albay",
    description:
      "Serving all 33 barangays with 24/7 hazard monitoring, emergency response, and disaster preparedness. This is the official public information portal of the MDRRMO.",
    config: cfg({
      layout: "full",
      bgStyle: "gradient",
      paddingY: "xl",
      ctaEnabled: true,
      ctaLabel: "Read Public Advisories",
      ctaLink: { kind: "anchor", anchor: "announcements" },
      data: { heroNote: "Monitor this portal for official advisories, suspension announcements and emergency information." },
    }),
  },
  {
    key: "weather",
    template: "weather",
    name: "Live Weather & 7-Day Outlook",
    heading: "Live Weather & 7-Day Outlook",
    subtitle: "Observed at Pio Duran AWS + OpenWeatherMap 7-day forecast",
    description:
      "Current observed conditions from the municipal automatic weather station together with the 7-day outlook — one complete weather picture. Never fabricated; always verify with PAGASA.",
    config: cfg({ bgStyle: "light", ctaEnabled: false }),
  },
  {
    key: "map",
    template: "satelliteMap",
    name: "Interactive Map — Pio Duran",
    heading: "Pio Duran Interactive Map",
    subtitle: "Live satellite view · evacuation centers · hazard overlays",
    config: cfg({ layout: "wide", paddingY: "md", bgStyle: "default" }),
  },
  {
    key: "alerts",
    template: "alertBanner",
    name: "Active Alerts Banner",
    heading: "Active Alerts",
    config: cfg({ layout: "full", bgStyle: "custom", bgColor: "", paddingY: "sm", shadow: "none" }),
  },
  {
    key: "emergency",
    template: "quickActions",
    name: "Emergency Response — Quick Actions",
    heading: "Emergency Response",
    subtitle: "Immediate actions during an emergency",
    description: "Report an incident, reach emergency services, or find safety information quickly.",
    config: cfg({
      columns: { desktop: 4, tablet: 2, mobile: 2 },
      cardRadius: "xl",
      items: [
        { label: "Send an Emergency Report", description: "Report an incident to the MDRRMO", icon: "siren", color: "red", link: { kind: "modal", modal: "report" } },
        { label: "Emergency Hotlines", description: "Call the right agency fast", icon: "phone-call", color: "amber", link: { kind: "modal", modal: "hotlines" } },
        { label: "Evacuation Information", description: "Centers, status & routes", icon: "map-pin", color: "blue", link: { kind: "anchor", anchor: "evacuation" } },
        { label: "Preparedness Guides", description: "Before, during & after a hazard", icon: "shield-check", color: "green", link: { kind: "anchor", anchor: "preparedness" } },
      ],
    }),
  },
  {
    key: "dashboard",
    template: "dashboard",
    name: "Public Dashboard",
    heading: "Public Dashboard",
    subtitle: "Live municipal DRRM dashboard",
    config: cfg({ bgStyle: "muted", paddingY: "lg" }),
  },
  {
    key: "announcements",
    template: "announcements",
    name: "Public Announcement Center",
    heading: "Public Announcements",
    subtitle: "Official announcements from the MDRRMO",
    description: "Advisories, suspension notices, evacuation notices and other public announcements.",
    config: cfg({ columns: { desktop: 2, tablet: 1, mobile: 1 } }),
  },
  {
    key: "about",
    template: "custom",
    name: "About the MDRRMO",
    heading: "About the MDRRMO",
    subtitle: "Mandated under Republic Act No. 10121",
    description:
      "The Municipal Disaster Risk Reduction and Management Office (MDRRMO) leads the implementation of disaster risk reduction and management programs of the Municipality of Pio Duran — covering prevention and mitigation, preparedness, response, and recovery and rehabilitation across all 33 barangays.",
    config: cfg({
      bgStyle: "light",
      items: [
        { label: "Hazard Monitoring", description: "24/7 monitoring of weather, seismic and geologic hazards through the Operations Center and linkages with PAGASA, PHIVOLCS and the PDRRMO.", icon: "radar" },
        { label: "Emergency Response", description: "Search and rescue coordination, evacuation management, and emergency assistance during disasters and emergencies.", icon: "life-buoy" },
        { label: "Preparedness Programs", description: "Barangay DRRM planning, trainings, drills, IEC campaigns and family preparedness advocacy.", icon: "graduation-cap" },
        { label: "Recovery & Rehabilitation", description: "Post-disaster needs assessment, relief operations and rehabilitation support for affected families.", icon: "hand-heart" },
      ],
    }),
  },
  {
    key: "evacuation",
    template: "evacuation",
    name: "Evacuation Centers",
    heading: "Evacuation Centers",
    subtitle: "Designated evacuation areas and their status",
    description: "Status is updated by the MDRRMO during emergencies. Follow the instructions of your barangay officials.",
    config: cfg({ columns: { desktop: 3, tablet: 2, mobile: 1 } }),
  },
  {
    key: "preparedness",
    template: "preparedness",
    name: "Preparedness & Safety",
    heading: "Preparedness & Safety",
    subtitle: "What to do before, during and after a disaster",
    description: "Learn the essential safety steps for the hazards that affect our municipality.",
    config: cfg({ bgStyle: "light", columns: { desktop: 3, tablet: 2, mobile: 1 } }),
  },
  {
    key: "hazards",
    template: "hazard",
    name: "Hazard Information",
    heading: "Hazards in Pio Duran",
    subtitle: "Know the risks in your area",
    description: "Understanding your hazards is the first step to preparedness.",
    config: cfg({ columns: { desktop: 3, tablet: 2, mobile: 1 }, items: HAZARD_ITEMS }),
  },
  {
    key: "news",
    template: "news",
    name: "News & Updates",
    heading: "News & Public Updates",
    subtitle: "Latest from the MDRRMO",
    config: cfg({ columns: { desktop: 3, tablet: 2, mobile: 1 } }),
  },
  {
    key: "stats",
    template: "stats",
    name: "Municipal DRRM Statistics",
    heading: "Pio Duran DRRM at a Glance",
    config: cfg({ bgStyle: "primary", paddingY: "lg", columns: { desktop: 4, tablet: 2, mobile: 2 }, shadow: "none" }),
  },
  {
    key: "resources",
    template: "links",
    name: "Government Resources & Links",
    heading: "Resources & Official Links",
    subtitle: "Official information sources",
    description: "Access official government information related to disaster risk reduction.",
    config: cfg({ columns: { desktop: 5, tablet: 3, mobile: 2 }, items: GOV_LINK_ITEMS }),
  },
  {
    key: "partners",
    template: "links",
    name: "Partner Agencies",
    heading: "Partners in DRRM",
    status: "HIDDEN",
    config: cfg({
      bgStyle: "muted",
      columns: { desktop: 4, tablet: 3, mobile: 2 },
      items: [
        { label: "DILG Region V", icon: "building-2" },
        { label: "OCD Region V", icon: "landmark" },
        { label: "PDRRMO Albay", icon: "shield" },
        { label: "BFP Pio Duran", icon: "flame" },
        { label: "PNP Pio Duran", icon: "shield" },
        { label: "Philippine Coast Guard", icon: "anchor" },
        { label: "DOST-PAGASA", icon: "cloud-sun" },
        { label: "PHIVOLCS", icon: "mountain" },
      ],
    }),
  },
  {
    key: "contact",
    template: "custom",
    name: "Contact & Visit",
    heading: "Contact the MDRRMO",
    subtitle: "We are here to serve",
    description:
      "Visit our office at the Municipal Hall, or reach us through the contact details below. For emergencies, always use the hotline.",
    config: cfg({
      items: [
        { label: "Office Address", description: "Municipal Hall, Poblacion Centro, Pio Duran, Albay", icon: "map-pin" },
        { label: "Office Hours", description: "Monday–Friday 8:00 AM – 5:00 PM · Operations Center is open 24/7", icon: "clock" },
        { label: "Telephone", description: "(052) 000-0000", icon: "phone" },
        { label: "Email", description: "mdrrmo@pioduran.gov.ph", icon: "mail" },
      ],
    }),
  },
];

// ---------------------------------------------------------------------------
// Default dashboard widgets
// ---------------------------------------------------------------------------

const wcfg = (over: Partial<WidgetConfig>): WidgetConfig => ({ ...DEFAULT_WIDGET_CONFIG, ...over });

export interface DefaultWidgetDef {
  key: string;
  type: WidgetType;
  title: string;
  enabled?: boolean;
  config: WidgetConfig;
}

export const DEFAULT_WIDGETS: DefaultWidgetDef[] = [
  { key: "w-status", type: "status", title: "Operational Status", config: wcfg({ size: "wide", icon: "activity" }) },
  { key: "w-weather", type: "weather", title: "Pio Duran AWS", config: wcfg({ size: "small", icon: "thermometer", refreshSec: 300, ctaLabel: "View live weather", link: { kind: "anchor", anchor: "weather" } }) },
  { key: "w-alerts", type: "alerts", title: "Active Alerts", config: wcfg({ size: "small", icon: "siren", ctaLabel: "View details", link: { kind: "anchor", anchor: "alerts" } }) },
  { key: "w-hotlines", type: "hotlines", title: "Emergency Hotlines", config: wcfg({ size: "small", icon: "phone-call", ctaLabel: "All hotlines", link: { kind: "modal", modal: "hotlines" } }) },
  { key: "w-announcements", type: "announcements", title: "Latest Announcements", config: wcfg({ size: "wide", icon: "megaphone", ctaLabel: "View all", link: { kind: "anchor", anchor: "announcements" } }) },
  { key: "w-evacuation", type: "evacuation", title: "Evacuation Information", config: wcfg({ size: "small", icon: "map-pin", ctaLabel: "View centers", link: { kind: "anchor", anchor: "evacuation" } }) },
  { key: "w-preparedness", type: "preparedness", title: "Preparedness Tips", config: wcfg({ size: "small", icon: "hard-hat", ctaLabel: "Safety guides", link: { kind: "anchor", anchor: "preparedness" } }) },
  { key: "w-quicklinks", type: "quicklinks", title: "Quick Links", config: wcfg({ size: "small", icon: "link", items: [
    { label: "Report an Incident", icon: "siren", link: { kind: "modal", modal: "report" } },
    { label: "Emergency Hotlines", icon: "phone-call", link: { kind: "modal", modal: "hotlines" } },
    { label: "7-Day Forecast", icon: "cloud-sun", link: { kind: "anchor", anchor: "forecast" } },
    { label: "Government Links", icon: "landmark", link: { kind: "anchor", anchor: "resources" } },
  ] }) },
];

// ---------------------------------------------------------------------------
// Seed content (hotlines / ticker / preparedness / welcome announcement)
// NOTE: hotline numbers are PLACEHOLDERS — administrators must verify and
// replace them with the official municipal numbers before relying on them.
// ---------------------------------------------------------------------------

export const SEED_HOTLINES = [
  { agency: "MDRRMO Pio Duran", serviceType: "Operations Center — 24/7", phone: "(052) 000-0000", icon: "shield-check", category: "MDRRMO", displayOrder: 1, priority: 100 },
  { agency: "National Emergency Hotline", serviceType: "All emergencies (nationwide)", phone: "911", icon: "phone-call", category: "NATIONAL", displayOrder: 2, priority: 90 },
  { agency: "Bureau of Fire Protection (BFP)", serviceType: "Fire & rescue — Pio Duran", phone: "(052) 000-0000", icon: "flame", category: "FIRE", displayOrder: 3, priority: 80 },
  { agency: "Philippine National Police (PNP)", serviceType: "Police assistance — Pio Duran", phone: "(052) 000-0000", icon: "shield", category: "POLICE", displayOrder: 4, priority: 70 },
  { agency: "Municipal Health Office (MHO)", serviceType: "Medical & health emergencies", phone: "(052) 000-0000", icon: "heart-pulse", category: "MEDICAL", displayOrder: 5, priority: 60 },
  { agency: "MSWDO", serviceType: "Social welfare & child protection", phone: "(052) 000-0000", icon: "hand-heart", category: "SOCIAL", displayOrder: 6, priority: 50 },
  { agency: "Philippine Coast Guard", serviceType: "Coastal & maritime emergencies", phone: "(052) 000-0000", icon: "anchor", category: "MARITIME", displayOrder: 7, priority: 40 },
  { agency: "PDRRMO Albay", serviceType: "Provincial DRRM assistance", phone: "(052) 000-0000", icon: "landmark", category: "PROVINCIAL", displayOrder: 8, priority: 30 },
];

export const SEED_TICKER = [
  { message: "MDRRMO Pio Duran Operations Center is on standby 24/7 — for emergencies, call the MDRRMO hotline or 911.", priority: "NORMAL", icon: "shield-check", displayOrder: 1 },
  { message: "Prepare your family Go Bag and monitor official PAGASA advisories, especially during the rainy season.", priority: "NORMAL", icon: "cloud-sun", displayOrder: 2 },
];

export const SEED_PREPAREDNESS = [
  { title: "Before a Typhoon", hazard: "TYPHOON", phase: "BEFORE", icon: "wind", displayOrder: 1, content: "Prepare a family Go Bag (water, food, flashlight, medicines, documents). Charge devices and secure loose items outdoors. Monitor PAGASA advisories and local announcements. Know your nearest evacuation center and the safest route to it." },
  { title: "During a Typhoon", hazard: "TYPHOON", phase: "DURING", icon: "wind", displayOrder: 2, content: "Stay indoors, away from windows. Do not wade through floodwater. Turn off electricity and gas if flooding threatens your home. Keep your radio or phone tuned to official advisories. Evacuate early when advised — do not wait for the situation to worsen." },
  { title: "After a Typhoon", hazard: "TYPHOON", phase: "AFTER", icon: "wind", displayOrder: 3, content: "Wait for the official all-clear before returning home. Watch for fallen power lines, broken glass and structurally damaged buildings. Report hazards to the MDRRMO. Boil drinking water if the supply was disrupted." },
  { title: "Before a Flood", hazard: "FLOOD", phase: "BEFORE", icon: "waves", displayOrder: 4, content: "Learn if your area is flood-prone. Prepare to elevate or move valuables and appliances. Identify higher ground near your home and plan your evacuation route. Keep emergency contacts accessible." },
  { title: "During a Flood", hazard: "FLOOD", phase: "DURING", icon: "waves", displayOrder: 5, content: "Never walk or drive through moving floodwater — six inches can knock you down. Switch off electricity at the main switch if water enters your home. Move to higher ground immediately and follow evacuation advisories." },
  { title: "After a Flood", hazard: "FLOOD", phase: "AFTER", icon: "waves", displayOrder: 6, content: "Avoid contact with floodwater — it may be contaminated. Do not use wet electrical appliances. Clean and disinfect everything that got wet. Report damage to your barangay officials for assessment." },
  { title: "During an Earthquake", hazard: "EARTHQUAKE", phase: "DURING", icon: "activity", displayOrder: 7, content: "DUCK under a sturdy table, COVER your head and neck, and HOLD until the shaking stops. Stay away from windows and falling objects. If outdoors, move to an open area away from buildings and power lines. Do not use elevators." },
  { title: "After an Earthquake", hazard: "EARTHQUAKE", phase: "AFTER", icon: "activity", displayOrder: 8, content: "Expect aftershocks. Check yourself and others for injuries. Check for gas leaks, structural damage and electrical hazards before re-entering buildings. Use stairs, not elevators. Follow official advisories for tsunami warnings if you are in a coastal area." },
  { title: "Landslide Safety", hazard: "LANDSLIDE", phase: "DURING", icon: "mountain", displayOrder: 9, content: "Watch for cracks in the ground, tilting trees or new springs on slopes — signs of possible landslides. During heavy rains in landslide-prone areas, evacuate early. If a landslide begins, move quickly sideways away from its path." },
  { title: "Storm Surge Safety", hazard: "STORM_SURGE", phase: "DURING", icon: "water", displayOrder: 10, content: "Coastal residents must evacuate to higher ground as soon as a storm surge warning is raised — surges can rise rapidly. Never watch big waves from the shore. Follow barangay officials' instructions immediately." },
  { title: "Fire Safety at Home", hazard: "FIRE", phase: "BEFORE", icon: "flame", displayOrder: 11, content: "Do not leave cooking unattended. Keep lighters and matches away from children. Unplug appliances when not in use and avoid overloading outlets. Plan at least two escape routes from your home and agree on a family meeting point." },
  { title: "During a Fire", hazard: "FIRE", phase: "DURING", icon: "flame", displayOrder: 12, content: "Get out immediately — belongings can be replaced. Stay low under smoke. Close doors behind you to slow the spread. Once out, stay out and call the BFP. Never use elevators during a fire." },
];

export const SEED_ANNOUNCEMENTS = [
  {
    title: "Welcome to the official MDRRMO Pio Duran Public Portal",
    category: "GENERAL",
    priority: "NORMAL",
    pinned: true,
    featured: true,
    content:
      "Welcome to the official public information portal of the Municipal Disaster Risk Reduction and Management Office of Pio Duran, Albay. This portal provides emergency hotlines, live weather observations, public advisories, evacuation information, and preparedness guides for all 33 barangays. Save this page and monitor it during normal conditions and emergencies. For life-threatening emergencies, call the hotline or 911 immediately.",
  },
];
