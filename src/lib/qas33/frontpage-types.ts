// QAS33 — Barangay frontpage content model.
//
// The editable JSON document stored in BarangayFrontpage.content and rendered
// by the public barangay frontpage (/barangay/<slug>). Structure mirrors the
// uploaded "barangay_portal.html" single-file website design: tagline, hero,
// profile (history / vision / mission / goals / objectives), announcements,
// services, events, contact and statistics. When no saved row exists the
// frontpage serves buildDefaultFrontpageContent() derived from the Barangay
// record; the barangay portal user (who administers the page) can override
// everything through the Frontpage manager.

export interface FrontpageAnnouncement {
  id: string;
  title: string;
  category: string;
  date: string; // YYYY-MM-DD
  content: string;
  pinned: boolean;
}

export interface FrontpageEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string;
  venue: string;
  description: string;
}

export interface FrontpageService {
  id: string;
  title: string;
  desc: string;
  fee: string;
  processingTime: string;
  requirements: string[];
  icon: string; // emoji or lucide-free glyph
}

export interface FrontpageContact {
  phone: string;
  mobile: string;
  email: string;
  facebook: string;
  officeHours: string;
  emergency: string;
}

export interface FrontpageStats {
  population: number;
  households: number;
  puroks: number;
  voters: number;
  seniors: number;
  pwd: number;
  clearancesIssued: number;
}

export interface FrontpageTheme {
  primary: string; // hex
  accent: string; // hex
}

export interface BarangayFrontpageContent {
  tagline: string;
  welcomeMessage: string;
  history: string;
  vision: string;
  mission: string;
  goals: string[];
  objectives: string[];
  logoUrl: string; // "" = auto monogram seal
  heroImage: string; // photo URL ("" = municipal default photo: noontime desktop / portrait mobile)
  address: string; // "" = auto "Barangay X, Pio Duran, Albay"
  contact: FrontpageContact;
  statistics: FrontpageStats;
  announcements: FrontpageAnnouncement[];
  events: FrontpageEvent[];
  services: FrontpageService[];
  theme: FrontpageTheme | null; // null = registry default for this barangay
}

// ---------------------------------------------------------------------------
// Limits (validated server-side in frontpage-service.ts)
// ---------------------------------------------------------------------------

export const FRONTPAGE_LIMITS = {
  tagline: 220,
  welcomeMessage: 600,
  history: 2400,
  vision: 900,
  mission: 900,
  listItem: 320,
  listItems: 10,
  announcementTitle: 160,
  announcementContent: 1600,
  announcements: 24,
  eventTitle: 160,
  eventDesc: 500,
  events: 24,
  serviceTitle: 120,
  serviceDesc: 400,
  services: 12,
  requirements: 8,
  requirement: 140,
  contactField: 160,
  emergency: 300,
  address: 220,
  url: 500,
  statsMax: 5_000_000,
} as const;

/** Standard barangay services seeded for every frontpage (fee/time defaults). */
const DEFAULT_SERVICES: FrontpageService[] = [
  {
    id: "svc-clearance",
    title: "Barangay Clearance",
    desc: "For employment, ID, school, or legal use.",
    fee: "₱50",
    processingTime: "15 mins",
    requirements: ["Valid ID", "Proof of residency (bill/lease)", "Cedula"],
    icon: "📄",
  },
  {
    id: "svc-residency",
    title: "Certificate of Residency",
    desc: "Proof you reside in the barangay.",
    fee: "₱30",
    processingTime: "15 mins",
    requirements: ["Valid ID", "Purok leader endorsement"],
    icon: "🏠",
  },
  {
    id: "svc-indigency",
    title: "Certificate of Indigency",
    desc: "For scholarships, medical & legal aid.",
    fee: "Free",
    processingTime: "20 mins",
    requirements: ["Valid ID", "Interview with social worker"],
    icon: "🤝",
  },
  {
    id: "svc-business",
    title: "Business Permit (New/Renewal)",
    desc: "For sari-sari stores, stalls & home business.",
    fee: "₱200+",
    processingTime: "1 day",
    requirements: ["DTI/SEC cert", "Lease/consent", "Brgy. clearance"],
    icon: "🏪",
  },
  {
    id: "svc-blotter",
    title: "Blotter / Incident Report",
    desc: "File complaints & request blotter copies.",
    fee: "Free",
    processingTime: "30 mins",
    requirements: ["Valid ID", "Incident details/witness"],
    icon: "🛡️",
  },
  {
    id: "svc-assistance",
    title: "Senior / PWD / Solo Parent Assistance",
    desc: "ID processing, pension & aid referrals.",
    fee: "Free",
    processingTime: "Same day",
    requirements: ["Birth cert / medical cert", "2x2 photo", "Application form"],
    icon: "❤️",
  },
];

export interface DefaultFrontpageBarangay {
  name: string; // exact DB name, e.g. "Agol" or "Barangay III"
  captain: string | null;
  population: number | null;
  households: number | null;
  puroks: number | null;
  clearancesIssued: number; // ServiceDocument count for this barangay
  // Real barangay profile data (brgy_profile + purok demographic sums)
  vision?: string | null;
  mission?: string | null;
  goals?: string | null;
  objectives?: string | null;
  logoUrl?: string | null;
  seniors?: number | null;
  pwd?: number | null;
}

/** Registry/DB-derived default content — served before the barangay saves edits. */
export function buildDefaultFrontpageContent(b: DefaultFrontpageBarangay): BarangayFrontpageContent {
  const bare = b.name.trim().replace(/^barangay\s+/i, "") || b.name.trim();
  const today = new Date().toISOString().slice(0, 10);
  return {
    tagline: "Serbisyong tapat, mabilis at may malasakit — para sa bawat pamilya.",
    welcomeMessage: `Welcome to the online portal of Barangay ${bare}, Pio Duran, Albay. Access announcements, request documents, verify residency, and reach your council — all in one place.`,
    history: `Barangay ${bare} is one of the 33 barangays of the Municipality of Pio Duran, Province of Albay (Region V — Bicol). Guided by the Municipal DRRM Office through the QAS33 program, the barangay maintains its Barangay Disaster Risk Reduction and Management Plan (BDRRMP) and Barangay Development Plan (BDP), and works continuously toward a safe, inclusive and progressive community.`,
    vision:
      b.vision?.trim() ||
      `A safe, inclusive and progressive Barangay ${bare} where every family enjoys responsive governance, sustainable livelihood and a healthy environment.`,
    mission:
      b.mission?.trim() ||
      "To deliver fast, honest and people-centered public service through transparent leadership, empowered puroks and active citizen participation.",
    goals: [b.goals?.trim() || `Accelerate the inclusive development and welfare of every family in Barangay ${bare}.`],
    objectives: [
      b.objectives?.trim() ||
        "Implement programs, projects and activities that respond to the needs of every purok and sector of the barangay.",
    ],
    logoUrl: b.logoUrl?.trim() || "",
    heroImage: "",
    address: "",
    contact: {
      phone: "",
      mobile: "",
      email: "",
      facebook: "",
      officeHours: "Mon–Fri 8:00 AM – 5:00 PM",
      emergency: "For emergencies, call the MDRRMO hotline or 911.",
    },
    statistics: {
      population: b.population ?? 0,
      households: b.households ?? 0,
      puroks: b.puroks ?? 0,
      voters: 0,
      seniors: b.seniors ?? 0,
      pwd: b.pwd ?? 0,
      clearancesIssued: b.clearancesIssued,
    },
    announcements: [
      {
        id: "ann-welcome",
        title: `Welcome to the Barangay ${bare} portal`,
        category: "Advisory",
        date: today,
        content: `This is the official public frontpage of Barangay ${bare}, Pio Duran, Albay. Announcements, services, events and contact details will be published here by the barangay. Maraming salamat po!`,
        pinned: true,
      },
    ],
    events: [],
    services: DEFAULT_SERVICES,
    theme: null,
  };
}

/** Deep-merge a saved (possibly partial/legacy) content doc over fresh defaults. */
export function mergeFrontpageContent(
  defaults: BarangayFrontpageContent,
  saved: Partial<BarangayFrontpageContent> | null | undefined
): BarangayFrontpageContent {
  if (!saved || typeof saved !== "object") return defaults;
  return {
    ...defaults,
    ...saved,
    contact: { ...defaults.contact, ...(saved.contact ?? {}) },
    statistics: { ...defaults.statistics, ...(saved.statistics ?? {}) },
    announcements: Array.isArray(saved.announcements) ? saved.announcements : defaults.announcements,
    events: Array.isArray(saved.events) ? saved.events : defaults.events,
    services: Array.isArray(saved.services) && saved.services.length > 0 ? saved.services : defaults.services,
    goals: Array.isArray(saved.goals) ? saved.goals : defaults.goals,
    objectives: Array.isArray(saved.objectives) ? saved.objectives : defaults.objectives,
    theme:
      saved.theme && typeof saved.theme === "object" && /^#[0-9a-fA-F]{6}$/.test(saved.theme.primary ?? "")
        ? { primary: saved.theme.primary, accent: saved.theme.accent ?? defaults.theme?.accent ?? "#E8A317" }
        : null,
  };
}
