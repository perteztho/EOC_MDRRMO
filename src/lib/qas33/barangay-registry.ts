// QAS33 — Barangay public frontpage registry.
//
// Canonical slug + identity color theme for each of the 33 barangays of
// Pio Duran, Albay. Slugs power the public URLs (/barangay/agol, …) and the
// theme colors brand each barangay frontpage (CSS variables --brgy-primary /
// --brgy-accent in the frontpage design). Codes mirror the official
// brgy_profile numbering: PD-BRG-001..005 = Barangay I..V (poblacion),
// PD-BRG-006..033 = Agol..Tibabo (alphabetical).

export interface BarangayTheme {
  /** Primary brand color — dark enough for white text. */
  primary: string;
  /** Darker shade for gradients/hover. */
  primaryDark: string;
  /** Accent — gold/amber family, used for highlights and the seal ring. */
  accent: string;
}

export interface BarangayRegistryEntry {
  code: string; // PD-BRG-001
  name: string; // exact DB name
  slug: string; // agol
  theme: BarangayTheme;
}

/** "Poblacion Centro" → "poblacion-centro" (also folds ñ→n, strips symbols). */
export function slugifyBarangay(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Normalize a user-supplied slug candidate (URL segment or barangay name). */
export function normalizeBarangaySlug(input: string): string {
  return slugifyBarangay(input).replace(/^-+|-+$/g, "");
}

// 33 hand-picked identity palettes — every barangay gets a distinct primary
// (green/teal/cyan/amber/rust/maroon/plum/violet/slate…) with a warm accent.
export const BARANGAY_REGISTRY: BarangayRegistryEntry[] = [
  { code: "PD-BRG-001", name: "Barangay I", slug: "barangay-i", theme: { primary: "#9D174D", primaryDark: "#831843", accent: "#FCD34D" } },
  { code: "PD-BRG-002", name: "Barangay II", slug: "barangay-ii", theme: { primary: "#7C2D12", primaryDark: "#5C2510", accent: "#FDE68A" } },
  { code: "PD-BRG-003", name: "Barangay III", slug: "barangay-iii", theme: { primary: "#065F46", primaryDark: "#064E3B", accent: "#D97706" } },
  { code: "PD-BRG-004", name: "Barangay IV", slug: "barangay-iv", theme: { primary: "#9A3412", primaryDark: "#7C2D12", accent: "#FCD34D" } },
  { code: "PD-BRG-005", name: "Barangay V", slug: "barangay-v", theme: { primary: "#5B21B6", primaryDark: "#4C1D95", accent: "#FACC15" } },
  { code: "PD-BRG-006", name: "Agol", slug: "agol", theme: { primary: "#0B5D3E", primaryDark: "#073E2A", accent: "#E8A317" } },
  { code: "PD-BRG-007", name: "Alabangpuro", slug: "alabangpuro", theme: { primary: "#0E7490", primaryDark: "#155E75", accent: "#FACC15" } },
  { code: "PD-BRG-008", name: "Banawan", slug: "banawan", theme: { primary: "#166534", primaryDark: "#14532D", accent: "#FBBF24" } },
  { code: "PD-BRG-009", name: "Basicao Coastal", slug: "basicao-coastal", theme: { primary: "#075985", primaryDark: "#0C4A6E", accent: "#FDBA74" } },
  { code: "PD-BRG-010", name: "Basicao Interior", slug: "basicao-interior", theme: { primary: "#3F6212", primaryDark: "#365314", accent: "#FDE047" } },
  { code: "PD-BRG-011", name: "Binodegahan", slug: "binodegahan", theme: { primary: "#BE185D", primaryDark: "#9D174D", accent: "#FEF08A" } },
  { code: "PD-BRG-012", name: "Buenavista", slug: "buenavista", theme: { primary: "#155E75", primaryDark: "#164E63", accent: "#F59E0B" } },
  { code: "PD-BRG-013", name: "Buyo", slug: "buyo", theme: { primary: "#134E4A", primaryDark: "#0F3D3A", accent: "#FBBF24" } },
  { code: "PD-BRG-014", name: "Caratagan", slug: "caratagan", theme: { primary: "#854D0E", primaryDark: "#713F12", accent: "#FEF3C7" } },
  { code: "PD-BRG-015", name: "Cuyaoyao", slug: "cuyaoyao", theme: { primary: "#334155", primaryDark: "#1E293B", accent: "#F59E0B" } },
  { code: "PD-BRG-016", name: "Flores", slug: "flores", theme: { primary: "#A21CAF", primaryDark: "#86198F", accent: "#FDE68A" } },
  { code: "PD-BRG-017", name: "La Medalla", slug: "la-medalla", theme: { primary: "#15803D", primaryDark: "#166534", accent: "#FCD34D" } },
  { code: "PD-BRG-018", name: "Lawinon", slug: "lawinon", theme: { primary: "#B45309", primaryDark: "#92400E", accent: "#FEF9C3" } },
  { code: "PD-BRG-019", name: "Macasitas", slug: "macasitas", theme: { primary: "#0F766E", primaryDark: "#0B5C56", accent: "#FBBF24" } },
  { code: "PD-BRG-020", name: "Malapay", slug: "malapay", theme: { primary: "#86198F", primaryDark: "#701A75", accent: "#FDE047" } },
  { code: "PD-BRG-021", name: "Malidong", slug: "malidong", theme: { primary: "#065986", primaryDark: "#084D70", accent: "#FCD34D" } },
  { code: "PD-BRG-022", name: "Mamlad", slug: "mamlad", theme: { primary: "#57534E", primaryDark: "#44403C", accent: "#FBBF24" } },
  { code: "PD-BRG-023", name: "Marigondon", slug: "marigondon", theme: { primary: "#BE123C", primaryDark: "#9F1239", accent: "#FDE68A" } },
  { code: "PD-BRG-024", name: "Matanglad", slug: "matanglad", theme: { primary: "#4D7C0F", primaryDark: "#3F6212", accent: "#FEF08A" } },
  { code: "PD-BRG-025", name: "Nablangbulod", slug: "nablangbulod", theme: { primary: "#7E22CE", primaryDark: "#6B21A8", accent: "#FDE047" } },
  { code: "PD-BRG-026", name: "Oringon", slug: "oringon", theme: { primary: "#0C4A6E", primaryDark: "#0A3D5C", accent: "#FDBA74" } },
  { code: "PD-BRG-027", name: "Palapas", slug: "palapas", theme: { primary: "#047857", primaryDark: "#065F46", accent: "#FCD34D" } },
  { code: "PD-BRG-028", name: "Panganiran", slug: "panganiran", theme: { primary: "#831843", primaryDark: "#6B1730", accent: "#FDE68A" } },
  { code: "PD-BRG-029", name: "Rawis", slug: "rawis", theme: { primary: "#0369A1", primaryDark: "#075985", accent: "#FDE047" } },
  { code: "PD-BRG-030", name: "Salvacion", slug: "salvacion", theme: { primary: "#713F12", primaryDark: "#5C3717", accent: "#FEF3C7" } },
  { code: "PD-BRG-031", name: "Santo Cristo", slug: "santo-cristo", theme: { primary: "#991B1B", primaryDark: "#7F1D1D", accent: "#FCD34D" } },
  { code: "PD-BRG-032", name: "Sukip", slug: "sukip", theme: { primary: "#1F2937", primaryDark: "#111827", accent: "#FBBF24" } },
  { code: "PD-BRG-033", name: "Tibabo", slug: "tibabo", theme: { primary: "#C2410C", primaryDark: "#9A3412", accent: "#FEF08A" } },
];

const BY_SLUG = new Map(BARANGAY_REGISTRY.map((e) => [e.slug, e]));
const BY_NAME = new Map(BARANGAY_REGISTRY.map((e) => [e.name.toLowerCase(), e]));

export function registryBySlug(slug: string): BarangayRegistryEntry | null {
  return BY_SLUG.get(normalizeBarangaySlug(slug)) ?? null;
}

export function registryByName(name: string): BarangayRegistryEntry | null {
  return BY_NAME.get(name.trim().toLowerCase()) ?? BY_SLUG.get(slugifyBarangay(name)) ?? null;
}

/** Bare display name — strips a leading "Barangay" so "Barangay III" → "III". */
export function bareBarangayName(name: string): string {
  const stripped = name.trim().replace(/^barangay\s+/i, "").trim();
  return stripped || name.trim();
}

/** Two-letter seal monogram — "BU" for Buenavista, "PC" for Poblacion Centro. */
export function barangayMonogram(name: string): string {
  const bare = bareBarangayName(name);
  const words = bare.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "PD";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
