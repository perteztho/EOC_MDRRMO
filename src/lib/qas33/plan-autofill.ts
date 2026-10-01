// QAS33 Plan Builder auto-fill — maps the municipal barangay database
// (profile, officials, puroks + CBMS-style demographics, boundary, reported
// subtotals) onto BDRRM_PLAN v6 / BDP_PLAN v3 builder field keys.
// Values are returned pre-sanitized against the builder's field definitions,
// so the caller can merge them straight into the plan valuesJson.
import { db } from "@/lib/db";
import type { PlanSectionClient } from "./types";
import { sanitizePlanValues } from "./plan-service";

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

export const AUTOFILL_SOURCES = [
  "Barangay profile (QAS33)",
  "PSA 2020 Census figures via barangay records",
  "Purok demographics (CBMS-style)",
  "Barangay boundary profile",
  "BDRRMC / Sangguniang Barangay roster",
];

/** Map an official's committee chairmanship to the closest BDRRMC position option. */
function bdrrmcPositionFor(position: string, committee?: string | null): string {
  if (position === "PUNONG_BARANGAY") return "Punong Barangay (Chairperson)";
  if (position === "SK_CHAIRPERSON") return "SK Chairperson";
  if (position === "SECRETARY") return "Barangay Secretary";
  if (position === "TREASURER") return "Barangay Treasurer";
  // Kagawad — pick the committee-matched option from BDRRMC_POSITIONS
  const c = (committee ?? "").toLowerCase();
  if (c.includes("drrm") || c.includes("disaster")) return "Kagawad — DRRM Committee Chair";
  if (c.includes("infrastructure") || c.includes("public works")) return "Kagawad — Infrastructure";
  if (c.includes("health") || c.includes("sanitation")) return "Kagawad — Health & Sanitation";
  if (c.includes("peace") || c.includes("order")) return "Kagawad — Peace & Order";
  if (c.includes("environment") || c.includes("kalikasan")) return "Kagawad — Environment";
  if (c.includes("livelihood") || c.includes("cooperative")) return "Kagawad — Livelihood";
  if (c.includes("education") || c.includes("culture")) return "Kagawad — Education";
  return "Kagawad — DRRM Committee Chair";
}

/** Drop scalar number values of 0 (treated as "unknown / not reported"). */
function num(v: number | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (!Number.isFinite(v)) return undefined;
  if (v === 0) return undefined;
  return v;
}

/** Drop a table row whose every cell is empty ("" / null / undefined). */
function dropEmptyRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.filter((row) =>
    Object.values(row).some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "")
  );
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildAutofillValues(
  barangayId: string,
  builderCode: string,
  planYear?: number
): Promise<{ values: Record<string, unknown>; sources: string[] }> {
  const barangay = await db.barangay.findUnique({
    where: { id: barangayId },
    include: {
      officials: { where: { active: true }, orderBy: { order: "asc" } },
      purokZones: { where: { active: true }, orderBy: { order: "asc" }, include: { demographics: true } },
      boundary: true,
      reportedSubtotals: { orderBy: { year: "desc" } },
    },
  });
  if (!barangay) return { values: {}, sources: [] };

  // Latest reported subtotal — prefer the plan year, else the latest available.
  const sub =
    barangay.reportedSubtotals.find((s) => s.year === (planYear ?? 0)) ?? barangay.reportedSubtotals[0] ?? null;

  const puroks = barangay.purokZones;
  const boundary = barangay.boundary;
  const captain = barangay.captain ?? barangay.officials.find((o) => o.position === "PUNONG_BARANGAY")?.name ?? null;

  // Purok demographic sums
  const demoSum = (pick: (d: NonNullable<(typeof puroks)[number]["demographics"]>) => number) =>
    puroks.reduce((acc, p) => acc + (p.demographics ? pick(p.demographics) : 0), 0);

  const raw: Record<string, unknown> = {};

  if (builderCode === "BDRRM_PLAN") {
    // ---- VMGO + Part I -------------------------------------------------------
    if (planYear) raw.plan_coverage = `${planYear} to ${planYear + 2}`;
    if (captain) raw.punong_barangay = captain;
    if (barangay.vision?.trim()) raw.vision = barangay.vision.trim();
    const landArea = boundary?.areaHa ?? barangay.landArea ?? sub?.landAreaHa ?? null;
    if (num(landArea) !== undefined) raw.land_area = landArea as number;
    const purokCount = barangay.puroks ?? (puroks.length > 0 ? puroks.length : sub?.purokCount ?? null);
    if (num(purokCount) !== undefined) raw.purok_count = purokCount as number;
    if (boundary) {
      raw.classification = boundary.urban
        ? "Urban / Poblacion"
        : boundary.coastal
          ? "Coastal / Baybayin"
          : boundary.upland
            ? "Upland / Matataas na lugar"
            : "Rural lowland / Kanayunan";
    }

    // Demographics (subtotal first, barangay profile as fallback)
    const population = sub?.population ?? barangay.population ?? null;
    const households = sub?.households ?? barangay.households ?? null;
    if (num(population) !== undefined) raw.population_total = population as number;
    if (num(households) !== undefined) raw.households_total = households as number;
    if (num(sub?.families) !== undefined && sub) raw.families_total = sub.families;
    if (num(sub?.male) !== undefined && sub) raw.male_count = sub.male;
    if (num(sub?.female) !== undefined && sub) raw.female_count = sub.female;
    if (num(sub?.seniorCount) !== undefined && sub) raw.senior_citizens = sub.seniorCount;
    if (num(sub?.pwdCount) !== undefined && sub) raw.pwd_count = sub.pwdCount;
    if (num(sub?.pregnantCount) !== undefined && sub) raw.pregnant_lactating = sub.pregnantCount;
    if (num(sub?.soloParentCount) !== undefined && sub) raw.solo_parents = sub.soloParentCount;
    const childrenU5 = demoSum((d) => d.age0to4);
    if (childrenU5 > 0) raw.children_u5 = childrenU5;

    if (puroks.length > 0) {
      raw.population_by_purok = puroks.map((p) => ({
        purok: p.name,
        households: p.demographics?.households ?? null,
        population: p.demographics?.population ?? null,
        zoneLeader: p.zoneLeader ?? "",
      }));
    }

    // ---- Socio-economic ----------------------------------------------------
    if (num(sub?.farmingHouseholds) !== undefined && sub) raw.farming_households = sub.farmingHouseholds;
    if (num(sub?.fishingHouseholds) !== undefined && sub) raw.fishing_households = sub.fishingHouseholds;

    // ---- Hazard-prone areas (only genuinely reported figures) -------------
    if (sub) {
      const hazardRows: Array<Record<string, unknown>> = [];
      if (sub.floodProneHouseholds > 0)
        hazardRows.push({ purok: "All puroks", hazards: "Flood", households: sub.floodProneHouseholds, riskLevel: "High" });
      if (sub.landslideProneHouseholds > 0)
        hazardRows.push({ purok: "All puroks", hazards: "Landslide", households: sub.landslideProneHouseholds, riskLevel: "High" });
      if (sub.stormSurgeProneHouseholds > 0)
        hazardRows.push({ purok: "All puroks", hazards: "Storm Surge", households: sub.stormSurgeProneHouseholds, riskLevel: "High" });
      if (hazardRows.length > 0) raw.hazard_prone_areas = hazardRows;
    }

    // ---- BDRRMC composition (Sangguniang Barangay roster) -------------------
    if (barangay.officials.length > 0) {
      raw.bdrrmc_composition = barangay.officials.map((o) => ({
        position: bdrrmcPositionFor(o.position, o.committee),
        name: o.name,
        contact: "",
        assignment: o.committee ?? "",
      }));
    }

    // ---- EWS purok disseminators -------------------------------------------
    if (puroks.length > 0) {
      raw.purok_dissemination = puroks.map((p) => ({
        purok: p.name,
        leader: p.zoneLeader ?? "",
        contact: "",
        alternate: "",
      }));
    }

    // ---- Certification -----------------------------------------------------
    if (captain) raw.noted_by = captain;
    const treasurer = barangay.officials.find((o) => o.position === "TREASURER")?.name;
    if (treasurer) raw.barangay_treasurer = treasurer;
    const secretary = barangay.officials.find((o) => o.position === "SECRETARY")?.name;
    if (secretary) raw.prepared_by = `${secretary} — BDRRMC Secretariat`;
  } else if (builderCode === "BDP_PLAN") {
    // ---- I. Executive Summary + II. General Information --------------------
    if (planYear) raw.plan_period = `${planYear} - ${planYear + 2}`;
    raw.region = "REGION V - Bicol";
    raw.province = "ALBAY";
    raw.municipality = "PIO DURAN";
    if (captain) raw.punong_barangay = captain;
    if (barangay.vision?.trim()) raw.vision_statement = barangay.vision.trim();
    if (barangay.mission?.trim()) raw.mission_statement = barangay.mission.trim();
    const secretary = barangay.officials.find((o) => o.position === "SECRETARY")?.name;
    if (secretary) {
      raw.barangay_secretary = secretary;
      raw.prepared_by = `${secretary} — BDC Secretariat`;
    }
    const purokCountBdp = barangay.puroks ?? (puroks.length > 0 ? puroks.length : sub?.purokCount ?? null);
    if (num(purokCountBdp) !== undefined) raw.purok_count = purokCountBdp as number;
    if (sub && num(sub.seniorCount) !== undefined) raw.senior_citizens = sub.seniorCount;
    if (sub && num(sub.pwdCount) !== undefined) raw.pwd_count = sub.pwdCount;

    // ---- History, location & land use --------------------------------------
    if (boundary) {
      if (boundary.north) raw.boundary_north = boundary.north;
      if (boundary.south) raw.boundary_south = boundary.south;
      if (boundary.east) raw.boundary_east = boundary.east;
      if (boundary.west) raw.boundary_west = boundary.west;
      if (boundary.coastal) raw.topography = "Coastal / Baybayin";
      else if (boundary.upland) raw.topography = "Hilly to mountainous / Burol-bundok";
      else if (boundary.urban) raw.topography = "Flat / Plain / Patag";
    }
    const landArea = boundary?.areaHa ?? sub?.landAreaHa ?? null;
    if (num(landArea) !== undefined) raw.land_area = landArea as number;

    // ---- Demographics -------------------------------------------------------
    const population = sub?.population ?? barangay.population ?? null;
    const households = sub?.households ?? barangay.households ?? null;
    if (num(population) !== undefined) raw.population_total = population as number;
    if (num(households) !== undefined) raw.households_total = households as number;
    if (num(sub?.male) !== undefined && sub) raw.male_count = sub.male;
    if (num(sub?.female) !== undefined && sub) raw.female_count = sub.female;
    if (population && households && households > 0) {
      raw.avg_household_size = Math.round((population / households) * 100) / 100;
    }

    const ageSums: Record<string, number> = {
      "0-5 years old": demoSum((d) => d.age0to4),
      "6-12 years old": demoSum((d) => d.age5to11),
      "13-17 years old": demoSum((d) => d.age12to17),
      "60 years old and above": demoSum((d) => d.age60plus),
    };
    const ageRows = Object.entries(ageSums)
      .filter(([, total]) => total > 0)
      .map(([bracket, total]) => ({ bracket, male: "", female: "", total }));
    if (ageRows.length > 0) raw.age_structure = ageRows;

    if (puroks.length > 0) {
      raw.population_by_purok = puroks.map((p) => ({
        purok: p.name,
        households: p.demographics?.households ?? null,
        population: p.demographics?.population ?? null,
      }));
    }

    const schoolAge = demoSum((d) => d.age5to11) + demoSum((d) => d.age12to17);
    if (schoolAge > 0) raw.school_age = schoolAge;

    // ---- Economic profile ----------------------------------------------------
    if (num(sub?.farmingHouseholds) !== undefined && sub) raw.farming_households = sub.farmingHouseholds;
    if (num(sub?.fishingHouseholds) !== undefined && sub) raw.fishing_households = sub.fishingHouseholds;

    // ---- Institutional / certification ---------------------------------------
    if (captain) raw.noted_by = captain;
  }

  // Drop table rows whose cells are all empty, then sanitize against the
  // builder's field definitions (whitelist keys, clamp types).
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      const rows = dropEmptyRows(value as Array<Record<string, unknown>>);
      if (rows.length > 0) cleaned[key] = rows;
    } else if (value !== "" && value !== null && value !== undefined) {
      cleaned[key] = value;
    }
  }

  return { values: cleaned, sources: [...AUTOFILL_SOURCES] };
}

/** Build + sanitize in one step (sections from the builder template). */
export async function buildSanitizedAutofill(
  barangayId: string,
  builderCode: string,
  sections: PlanSectionClient[],
  planYear?: number
): Promise<{ values: Record<string, unknown>; sources: string[] }> {
  const { values, sources } = await buildAutofillValues(barangayId, builderCode, planYear);
  return { values: sanitizePlanValues(sections, values), sources };
}
