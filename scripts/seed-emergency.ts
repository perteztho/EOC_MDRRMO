/**
 * QAS33 — Seed the Emergency Modules (Evacuation Management + News & Public
 * Updates + Communication settings). IDEMPOTENT:
 *  - news categories: upsert by key, skip existing
 *  - evacuation centers: REAL MDRRMO inventory (17 GPS-verified centers);
 *    inserted when the table is empty, or when run with --replace
 *  - news posts: only inserted when no PUBLISHED posts exist
 *  - communication settings: created only when the scope row is missing
 *
 * Run: bun scripts/seed-emergency.ts            (idempotent)
 * Run: bun scripts/seed-emergency.ts --replace  (force-replace centers)
 */
import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_COMMUNICATION_SETTINGS,
  NEWS_CATEGORY_SEEDS,
} from "../src/lib/qas33/emergency-types";
import { sanitizeRichText } from "../src/lib/qas33/rich-text";

const prisma = new PrismaClient();

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  EMERGENCY_ALERT: "red",
  PUBLIC_ADVISORY: "amber",
  WEATHER_UPDATE: "sky",
  EVACUATION_UPDATE: "orange",
  DISASTER_PREPAREDNESS: "emerald",
  MDRRMO_NEWS: "gov-blue",
  COMMUNITY_ACTIVITIES: "teal",
  TRAINING_DRILLS: "violet",
  RELIEF_OPERATIONS: "cyan",
  GOVERNMENT_ANNOUNCEMENT: "slate",
  GENERAL_INFO: "rose",
};

interface CenterSeed {
  name: string;
  barangay: string; // official barangay name (matches Barangay table)
  facilityType: string;
  latitude: number;
  longitude: number;
  landAreaSqm: number; // land area (sqm)
  capacityFamilies: number; // rated capacity (families)
  capacityIndividuals: number; // rated capacity (individuals)
  contactPerson: string;
  accessiblePwd?: boolean; // PWD accessible (YES)
  washFacilities?: boolean; // WASH / toilet facilities (YES)
  address?: string; // optional custom address override
  specialNotes?: string;
}

// REAL DATA — MDRRMO Pio Duran Evacuation Center profile (17 designated
// centers, GPS-verified). Replaces the former placeholder/demo centers.
// Source: MDRRMO evacuation center inventory encoding sheet.
const CENTER_SEEDS: CenterSeed[] = [
  {
    name: "Municipal Evacuation Center",
    barangay: "Caratagan",
    facilityType: "MUNICIPAL_EVAC_CENTER",
    latitude: 13.0494,
    longitude: 123.454,
    landAreaSqm: 1969,
    capacityFamilies: 196,
    capacityIndividuals: 588,
    contactPerson: "Melinda B. Añasco",
    address: "Poblacion / Brgy. Caratagan, Pio Duran, Albay",
    specialNotes: "Primary municipal evacuation center serving the Poblacion area and Brgy. Caratagan.",
  },
  {
    name: "7th Day Adventist",
    barangay: "Caratagan",
    facilityType: "CHURCH_SCHOOL",
    latitude: 13.0464,
    longitude: 123.4552,
    landAreaSqm: 577,
    capacityFamilies: 39,
    capacityIndividuals: 129,
    contactPerson: "Benedicta Millamina",
  },
  {
    name: "West Coast College",
    barangay: "Banawan",
    facilityType: "SCHOOL",
    latitude: 13.0377,
    longitude: 123.4505,
    landAreaSqm: 599,
    capacityFamilies: 10,
    capacityIndividuals: 24,
    contactPerson: "Benedicta Millamina",
  },
  {
    name: "Binodegahan Elementary School",
    barangay: "Binodegahan",
    facilityType: "SCHOOL",
    latitude: 13.0614,
    longitude: 123.4583,
    landAreaSqm: 746,
    capacityFamilies: 55,
    capacityIndividuals: 148,
    contactPerson: "Benedicta Millamina",
  },
  {
    name: "La Medalla Elementary School",
    barangay: "La Medalla",
    facilityType: "SCHOOL",
    latitude: 13.0475,
    longitude: 123.445,
    landAreaSqm: 1193,
    capacityFamilies: 155,
    capacityIndividuals: 335,
    contactPerson: "Melinda B. Añasco",
  },
  {
    name: "La Medalla Multi-Purpose Hall",
    barangay: "La Medalla",
    facilityType: "MULTI_PURPOSE_HALL",
    latitude: 13.047,
    longitude: 123.4442,
    landAreaSqm: 192,
    capacityFamilies: 21,
    capacityIndividuals: 50,
    contactPerson: "Melinda B. Añasco",
  },
  {
    name: "La Medalla High School",
    barangay: "La Medalla",
    facilityType: "SCHOOL",
    latitude: 13.0471,
    longitude: 123.4443,
    landAreaSqm: 980,
    capacityFamilies: 67,
    capacityIndividuals: 217,
    contactPerson: "Benedicta Millamina",
  },
  {
    name: "La Medalla Daycare Center",
    barangay: "La Medalla",
    facilityType: "SCHOOL",
    latitude: 13.0471,
    longitude: 123.4442,
    landAreaSqm: 214,
    capacityFamilies: 17,
    capacityIndividuals: 47,
    contactPerson: "Melinda B. Añasco",
  },
  {
    name: "NCDC",
    barangay: "Caratagan",
    facilityType: "SCHOOL",
    latitude: 13.044,
    longitude: 123.4562,
    landAreaSqm: 269,
    capacityFamilies: 15,
    capacityIndividuals: 48,
    contactPerson: "Melinda B. Añasco",
  },
  {
    name: "Municipal Building",
    barangay: "Caratagan",
    facilityType: "MUNICIPAL_BUILDING",
    latitude: 13.0442,
    longitude: 123.4563,
    landAreaSqm: 857,
    capacityFamilies: 20,
    capacityIndividuals: 34,
    contactPerson: "Benedicta Millamina",
    specialNotes: "Municipal hall compound — last-resort evacuation area for municipal employees and nearby residents.",
  },
  {
    name: "Pio Duran National High School",
    barangay: "Binodegahan",
    facilityType: "SCHOOL",
    latitude: 13.0664,
    longitude: 123.4604,
    landAreaSqm: 5311,
    capacityFamilies: 204,
    capacityIndividuals: 665,
    contactPerson: "Melinda B. Añasco",
    specialNotes: "Largest designated evacuation center by area and capacity in the municipality.",
  },
  {
    name: "Agol Elementary School",
    barangay: "Agol",
    facilityType: "SCHOOL",
    latitude: 13.0867,
    longitude: 123.4617,
    landAreaSqm: 2756,
    capacityFamilies: 26,
    capacityIndividuals: 83,
    contactPerson: "Benedicta Millamina",
  },
  {
    name: "Cuyaoyao Elementary School",
    barangay: "Cuyaoyao",
    facilityType: "SCHOOL",
    latitude: 13.0974,
    longitude: 123.4629,
    landAreaSqm: 1486,
    capacityFamilies: 27,
    capacityIndividuals: 76,
    contactPerson: "Melinda B. Añasco",
  },
  {
    name: "Dr. Garcia Elementary School",
    barangay: "Palapas",
    facilityType: "SCHOOL",
    latitude: 13.1122,
    longitude: 123.4699,
    landAreaSqm: 1596,
    capacityFamilies: 41,
    capacityIndividuals: 152,
    contactPerson: "Melinda B. Añasco",
  },
  {
    name: "RHU Building",
    barangay: "Caratagan",
    facilityType: "RHU",
    latitude: 13.0438,
    longitude: 123.4562,
    landAreaSqm: 346,
    capacityFamilies: 4,
    capacityIndividuals: 13,
    contactPerson: "Benedicta Millamina",
    specialNotes: "Rural Health Unit building — reserved mainly for medical cases and vulnerable evacuees needing health monitoring.",
  },
  {
    name: "Brgy. 3 Child Development Center",
    barangay: "Barangay III",
    facilityType: "SCHOOL",
    latitude: 13.029645,
    longitude: 123.445897,
    landAreaSqm: 86,
    capacityFamilies: 8,
    capacityIndividuals: 17,
    contactPerson: "Melinda B. Añasco",
  },
  {
    name: "Brgy. 3 Barangay Hall",
    barangay: "Barangay III",
    facilityType: "BARANGAY_HALL",
    latitude: 13.029645,
    longitude: 123.445897,
    landAreaSqm: 125,
    capacityFamilies: 20,
    capacityIndividuals: 50,
    contactPerson: "Melinda B. Añasco",
  },
];

interface PostSeed {
  title: string;
  category: string;
  author: string;
  summary: string;
  content: string;
  publishAt: Date;
  status?: string;
  featured?: boolean;
  pinned?: boolean;
  emergency?: boolean;
  tags: string[];
}

const POST_SEEDS: PostSeed[] = [
  {
    title: "PAGASA Habagat Advisory: Monsoon Rains Over Albay — August 2026",
    category: "WEATHER_UPDATE",
    author: "Noel F. Ordona",
    summary:
      "The enhanced Southwest Monsoon (Habagat) will bring moderate to heavy rains over Albay through the weekend. Residents of flood- and landslide-prone areas are advised to stay alert.",
    content: `<p>The Philippine Atmospheric, Geophysical and Astronomical Services Administration (PAGASA) has issued an advisory for the enhanced Southwest Monsoon (Habagat) affecting the Bicol Region, including the Province of Albay. Moderate to heavy monsoon rains are expected over Pio Duran and neighboring municipalities through the weekend, with possible occasional intense bursts along coastal and upland zones.</p>
<p>Under these conditions, flooding remains possible in low-lying barangays and near river channels, while rain-induced landslides may occur in steeply sloped, upland areas. Fisherfolk and small boat operators are advised not to venture out to sea over Burias Pass due to rough sea conditions associated with the monsoon surge.</p>
<p>The MDRRMO Pio Duran is closely monitoring the situation together with the Provincial DRRMO and the Albay Public Safety and Emergency Management Office (APSEMO). Pre-emptive evacuation may be called for high-risk households once rainfall thresholds are reached. Keep battery-powered radios and mobile phones charged, and follow only official advisories from the Municipal Disaster Risk Reduction and Management Office.</p>`,
    publishAt: daysAgo(3),
    featured: true,
    pinned: true,
    tags: ["PAGASA", "Habagat", "Weather Advisory", "Albay"],
  },
  {
    title: "Quarterly Earthquake Drill Scheduled for All Pio Duran Schools",
    category: "DISASTER_PREPAREDNESS",
    author: "Jun Carlo Anasco",
    summary:
      "All public elementary and high schools in the municipality will conduct the 3rd Quarter National Simultaneous Earthquake Drill (NSED) with duck-cover-hold exercises and evacuation routes practice.",
    content: `<p>The MDRRMO Pio Duran, in coordination with the Department of Education (DepEd) Ligao City Division, will conduct the quarterly National Simultaneous Earthquake Drill (NSED) across all public elementary and high schools in the municipality. The drill exercises the duck-cover-hold procedure, orderly classroom evacuation, headcount protocols, and the activation of school-based incident command posts.</p>
<p>Teachers and school DRRM coordinators are reminded to review their evacuation route maps, assembly areas, and buddy systems before the drill. First aid kits, fire extinguishers, and emergency communication cards must be checked and restocked where needed.</p>
<p>Parents are encouraged to discuss the drill with their children at home. Practicing the same actions — drop, cover, and hold on — helps build muscle memory that saves lives during a real earthquake.</p>`,
    publishAt: daysAgo(9),
    tags: ["Earthquake Drill", "NSED", "Schools", "Preparedness"],
  },
  {
    title: "MDRRMO Pio Duran Conducts BDRRMC Refresher Training",
    category: "MDRRMO_NEWS",
    author: "Noel F. Ordona",
    summary:
      "More than 120 members of Barangay DRRM Committees from all 33 barangays completed a two-day refresher training on RA 10121, early warning, and evacuation center management.",
    content: `<p>The Municipal Disaster Risk Reduction and Management Office (MDRRMO) of Pio Duran successfully conducted a two-day refresher training for Barangay Disaster Risk Reduction and Management Committee (BDRRMC) members. More than 120 participants from all 33 barangays attended the training held at the municipal gymnasium.</p>
<p>The training covered the roles and responsibilities of BDRRMCs under Republic Act 10121, standard operating procedures for early warning dissemination, house-to-house pre-emptive evacuation, evacuation center management, and rapid damage assessment and needs analysis (RDANA). Workshop activities used real hazard maps of Pio Duran, including flood-prone, landslide-prone, and storm surge-prone zones identified in the municipal hazard assessment.</p>
<p>The refresher course is part of the municipality's continuing capacity development program and supports the ongoing rollout of the QAS33 Barangay DRRM Plan system, which standardizes plan preparation, review, and approval across all barangays.</p>`,
    publishAt: daysAgo(15),
    tags: ["BDRRMC", "Training", "RA 10121", "Capacity Building"],
  },
  {
    title: "Family Food Packs Prepositioned for 33 Barangays",
    category: "RELIEF_OPERATIONS",
    author: "Jun Carlo Anasco",
    summary:
      "The municipal government has prepositioned family food packs and non-food relief items in strategic locations ahead of the typhoon season, sufficient for the first 48 hours of response.",
    content: `<p>As part of preparedness measures for the typhoon season, the Municipal Government of Pio Duran through the MDRRMO has prepositioned family food packs (FFPs) and non-food items in strategic warehouses and barangay staging areas across the municipality. Stock levels are calibrated to cover the first 48 hours of relief operations for affected families.</p>
<p>Each family food pack contains rice, canned goods, noodles, coffee, and other essential food items good for a family of five for about two days. Non-food items include hygiene kits, sleeping mats, blankets, and emergency shelter tarps. The Social Welfare and Development Office (MSWDO) leads repacking with support from barangay volunteers and the Pio Duran chapter of the Philippine Red Cross.</p>
<p>Barangay captains may request replenishment or reallocation of prepositioned stocks through the MDRRMO Operations Center. Inventory is tracked per barangay to ensure fair and transparent distribution during emergencies.</p>`,
    publishAt: daysAgo(21),
    tags: ["Relief", "Food Packs", "Prepositioning", "Typhoon Season"],
  },
  {
    title: "Evacuation Centers Inspected and Readied for Typhoon Season",
    category: "EVACUATION_UPDATE",
    author: "Noel F. Ordona",
    summary:
      "All designated evacuation centers passed the joint pre-typhoon inspection. Water, sanitation, electrical, and accessibility readiness have been verified and are now tracked live on the QAS33 evacuation dashboard.",
    content: `<p>The MDRRMO Pio Duran, together with the Municipal Engineering Office, MSWDO, and municipal health personnel, has completed the annual pre-typhoon inspection of all 17 designated evacuation centers in the municipality. Inspection teams verified structural integrity, water and sanitation (WASH) facilities, electrical safety, ventilation, cooking areas, and accessibility for persons with disabilities, senior citizens, pregnant women, and other vulnerable sectors.</p>
<p>The inspection results — including each center's capacity in families and individuals, GPS location, land area, and current status — are now encoded in the QAS33 Evacuation Management system. The public evacuation page shows live status updates and an interactive map so families can identify the nearest open center with available slots during an emergency.</p>
<p>All 17 centers passed inspection and are ready to receive evacuees, with a combined rated capacity of 925 families (2,676 individuals). Center managers are reminded to update occupancy counts at least twice daily once centers are activated.</p>`,
    publishAt: daysAgo(27),
    featured: true,
    emergency: true,
    tags: ["Evacuation Centers", "Inspection", "Typhoon Season", "WASH"],
  },
  {
    title: "Barangay DRRM Plan Review and Approval Schedule for Q4 2026",
    category: "GENERAL_INFO",
    author: "Jun Carlo Anasco",
    summary:
      "DRAFT: Target review and approval calendar for barangay BDRRM Plans submitted through the QAS33 system in the fourth quarter of 2026.",
    content: `<p>The MDRRMO is finalizing the review and approval calendar for barangay BDRRM Plans submitted through the QAS33 system for plan year 2026. The draft schedule assigns weekly review batches per cluster of barangays, followed by the MDRRMO Officer's approval and the generation of the signed plan documents.</p>
<p>Barangay secretariats are advised to complete their plan drafts on the Plan Builders module at least one week before their assigned review week. This post is still a draft and will be published once the calendar is confirmed.</p>`,
    publishAt: daysAgo(1),
    status: "DRAFT",
    tags: ["BDRRM Plan", "QAS33", "Schedule"],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let seeded = false;

  // 1. News categories -------------------------------------------------------
  let categoriesCreated = 0;
  for (const seed of NEWS_CATEGORY_SEEDS) {
    const existing = await prisma.newsCategory.findUnique({ where: { key: seed.key } });
    if (existing) {
      console.log(`✓ category ${seed.key} already present — skipped`);
      continue;
    }
    await prisma.newsCategory.create({
      data: {
        key: seed.key,
        name: seed.name,
        description: `${seed.name} updates from the MDRRMO of Pio Duran, Albay.`,
        color: CATEGORY_COLORS[seed.key] ?? "gov-blue",
        emergency: seed.emergency,
        displayOrder: seed.order,
        active: true,
      },
    });
    categoriesCreated++;
  }
  if (categoriesCreated) {
    console.log(`✚ seeded ${categoriesCreated} news categories`);
    seeded = true;
  }

  // 2. Evacuation centers (real MDRRMO data) --------------------------------
  // Default: only insert when the table is empty (idempotent).
  // --replace: wipe existing centers (incl. their logs/history) and re-insert
  // the real center inventory — used to replace old placeholder rows.
  const replaceCenters = process.argv.includes("--replace");
  let centerCount = await prisma.evacuationCenter.count();
  if (replaceCenters && centerCount > 0) {
    const delResult = await prisma.evacuationCenter.deleteMany({});
    console.log(`⟲ --replace: removed ${delResult.count} evacuation center row(s) (logs/history cascaded)`);
    centerCount = 0;
  }
  if (centerCount === 0) {
    const barangays = await prisma.barangay.findMany({ select: { id: true, name: true } });
    const barangayByName = new Map(barangays.map((b) => [b.name.toLowerCase(), b]));

    let order = 0;
    for (const seed of CENTER_SEEDS) {
      order++;
      const brgy = barangayByName.get(seed.barangay.toLowerCase());

      await prisma.evacuationCenter.create({
        data: {
          code: `PD-EVC-${String(order).padStart(3, "0")}`,
          name: seed.name,
          barangay: seed.barangay,
          barangayId: brgy?.id ?? null,
          address: seed.address ?? `${seed.barangay}, Pio Duran, Albay`,
          latitude: seed.latitude,
          longitude: seed.longitude,
          contactPerson: seed.contactPerson,
          contactNumber: null,
          facilityType: seed.facilityType,
          capacity: seed.capacityIndividuals,
          capacityFamilies: seed.capacityFamilies,
          landAreaSqm: seed.landAreaSqm,
          currentOccupants: 0,
          accessibleFacilities: seed.accessiblePwd === false ? null : "PWD-accessible",
          waterStatus: "AVAILABLE",
          electricityStatus: "AVAILABLE",
          washStatus: seed.washFacilities === false ? "LIMITED" : "AVAILABLE",
          sleepingArea: true,
          vehicleAccess: true,
          status: "OPEN",
          statusOverride: false,
          specialNotes: seed.specialNotes ?? null,
          lastUpdatedBy: "MDRRMO encoding",
          displayOrder: order,
          visible: true,
        },
      });
    }
    const totals = CENTER_SEEDS.reduce(
      (acc, s) => ({ fam: acc.fam + s.capacityFamilies, ind: acc.ind + s.capacityIndividuals }),
      { fam: 0, ind: 0 }
    );
    console.log(
      `✚ seeded ${CENTER_SEEDS.length} REAL evacuation centers (all OPEN, 0 occupants) — ` +
        `totals: ${totals.fam} families / ${totals.ind} individuals`
    );
    seeded = true;
  } else {
    console.log(`✓ evacuation centers already present (${centerCount}) — skipped (use --replace to force)`);
  }

  // 3. News posts (only when no published posts exist) ----------------------
  const publishedCount = await prisma.newsArticle.count({ where: { status: "PUBLISHED" } });
  if (publishedCount === 0) {
    const categories = await prisma.newsCategory.findMany();
    const catByKey = new Map(categories.map((c) => [c.key, c]));
    let postsCreated = 0;
    for (const seed of POST_SEEDS) {
      const category = catByKey.get(seed.category);
      const created = await prisma.newsArticle.create({
        data: {
          title: seed.title,
          category: seed.category,
          categoryId: category?.id ?? null,
          summary: seed.summary,
          content: sanitizeRichText(seed.content, 60000),
          author: seed.author,
          tags: seed.tags.join(","),
          publishAt: seed.publishAt,
          targetAudience: "ALL",
          pushEnabled: false,
          emergency: seed.emergency === true,
          featured: seed.featured === true,
          pinned: seed.pinned === true,
          status: seed.status ?? "PUBLISHED",
          createdByName: seed.author,
        },
      });
      postsCreated++;
      console.log(`  ↳ ${created.status} · ${seed.category} · "${created.title}"`);
    }
    console.log(`✚ seeded ${postsCreated} news posts (${POST_SEEDS.filter((p) => p.status !== "DRAFT").length} published, 1 draft)`);
    seeded = true;
  } else {
    console.log(`✓ published news posts already present (${publishedCount}) — skipped`);
  }

  // 3b. Keep the already-published evacuation inspection article consistent
  // with the real center inventory (only when it still carries demo copy).
  if (replaceCenters) {
    const legacy = await prisma.newsArticle.findFirst({
      where: { content: { contains: "Two centers are undergoing minor repairs" } },
      select: { id: true, title: true },
    });
    if (legacy) {
      const inspectionPost = POST_SEEDS.find((p) => p.title === "Evacuation Centers Inspected and Readied for Typhoon Season");
      if (inspectionPost) {
        await prisma.newsArticle.update({
          where: { id: legacy.id },
          data: { content: sanitizeRichText(inspectionPost.content, 60000) },
        });
        console.log(`↺ updated existing news article to match the real 17-center inventory: "${legacy.title}"`);
      }
    }
  }

  // 4. Communication settings -------------------------------------------------
  const commRow = await prisma.siteConfig.findUnique({ where: { scope: "communication" } });
  if (!commRow) {
    await prisma.siteConfig.create({
      data: {
        scope: "communication",
        draft: "{}",
        published: JSON.stringify(DEFAULT_COMMUNICATION_SETTINGS),
      },
    });
    console.log("✚ created communication settings scope with defaults");
    seeded = true;
  } else {
    console.log("✓ communication settings already present — skipped");
  }

  // 5. Audit ------------------------------------------------------------------
  if (seeded) {
    await prisma.auditLog.create({
      data: {
        actorType: "SYSTEM",
        actorName: "System",
        action: "EMERGENCY_MODULES_SEEDED",
        detail: "Seeded news categories, evacuation centers, news posts and default communication settings.",
      },
    });
    console.log("✓ audit log recorded (EMERGENCY_MODULES_SEEDED)");
  } else {
    console.log("✓ nothing to seed — all sections already present (idempotent skip)");
  }

  // Summary
  const [centers, cats, posts, ann] = await Promise.all([
    prisma.evacuationCenter.count(),
    prisma.newsCategory.count(),
    prisma.newsArticle.count(),
    prisma.evacuationAnnouncement.count(),
  ]);
  console.log(`\nDatabase totals: ${centers} evacuation centers · ${cats} news categories · ${posts} news articles · ${ann} evacuation announcements`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
