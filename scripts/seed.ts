// QAS33 seed script — run with: bun scripts/seed.ts
import { randomBytes, scryptSync, createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import zlib from "zlib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { db } from "../src/lib/db";
import { SECTION_DEFS, TUTORIAL_DEFS, BARANGAYS_OF_PIO_DURAN } from "../src/lib/qas33/template-data";
import { buildDocId } from "../src/lib/qas33/server";

function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const daysAgo = (d: number, h = 9, m = 0) => {
  const dt = new Date(Date.now() - d * 86400000);
  dt.setHours(h, m, 0, 0);
  return dt;
};

const STORAGE_ROOT = path.join(process.cwd(), "db", "storage");

async function makePlaceholderPdf(title: string, subtitle: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 0, y: 741.89, width: 595.28, height: 100, color: rgb(0.055, 0.42, 0.27) });
  page.drawText("QAS33 — MDRRMO PIO DURAN", { x: 50, y: 800, size: 10, font: bold, color: rgb(1, 1, 1) });
  page.drawText(title, { x: 50, y: 775, size: 14, font: bold, color: rgb(1, 1, 1) });
  page.drawText(subtitle, { x: 50, y: 700, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("[ Seeded reference document for QAS33 demonstration ]", { x: 50, y: 680, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

function fullValues(
  brgy: { name: string; captain: string },
  i: number,
  council?: CouncilMember[]
): Record<string, unknown> {
  const pop = 1400 + ((i * 137) % 1800);
  const hh = Math.round(pop / 4.6);
  const vice = council?.find((o) => o.position === "KAGAWAD");
  const sk = council?.find((o) => o.position === "SK_CHAIRPERSON");
  const sec = council?.find((o) => o.position === "SECRETARY");
  const treas = council?.find((o) => o.position === "TREASURER");
  return {
    barangay_captain: brgy.captain,
    contact_number: `0917 555 0${String(10 + i).padStart(2, "0")}`,
    population_total: pop,
    households_total: hh,
    puroks_count: 7,
    land_area: 320 + ((i * 53) % 400),
    senior_citizens: Math.round(pop * 0.09),
    pwd_count: Math.round(pop * 0.012),
    children_below5: Math.round(pop * 0.11),
    pregnant_women: Math.round(pop * 0.024),
    major_livelihood: "Farming (rice, coconut) and coastal fishing",
    hazards_present: ["Typhoon / Bagyo", "Flood / Baha", "Landslide / Pagguho ng lupa", "Earthquake / Lindol"],
    affected_puroks:
      "Purok 1, 2, 3 — flooding along the river; Purok 5, 6 — slope areas prone to landslide; Purok 7 (coastal) — storm surge during typhoons",
    households_at_risk_typhoon: Math.round(hh * 0.85),
    households_at_risk_flood: Math.round(hh * 0.38),
    households_at_risk_landslide: Math.round(hh * 0.14),
    households_at_risk_others: Math.round(hh * 0.05),
    hazard_history:
      "Nov 2020 — Typhoon Rolly (Goni): 46 houses damaged, Purok 1–3 flooded for 3 days. Dec 2021 — Typhoon Odette (Rai): coastal purok storm surge, fishing boats lost. Jul 2023 — Habagat monsoon: minor landslide at Purok 5.",
    vulnerable_groups:
      "Senior citizens (Purok 2, 4 — far from evacuation center); PWDs (12 in Purok 1, 3); pregnant/lactating women; children below 5; informal settler families along riverbank (Purok 3)",
    critical_infrastructures:
      "Barangay hall and health station (Purok 4); elementary school (Purok 5 — also the main evacuation center); spillway bridge (Purok 1–2 access); water level gauge; barangay daycare center",
    vulnerable_houses: Math.round(hh * 0.22),
    vulnerability_notes:
      "Riverbank erosion continues to threaten Purok 3. Power interruption during typhoons isolates coastal Purok 7.",
    bdrrmc_organized: "Yes / Oo",
    bdrrmc_trained: "Yes / Oo",
    early_warning_system: "Combined / Pinagsama",
    evacuation_centers_count: 2,
    equipment_available:
      "15 life vests, 3 ropes (50m), 10 flashlights, 2 first aid kits, 2 megaphones, 1 generator, 20 rescue boots",
    drrm_budget: 85000,
    capacity_gaps:
      "Needs additional water rescue equipment and training; no dedicated ambulance; communication relies on personal cellphones.",
    risk_typhoon: "High / Mataas",
    risk_flood: "High / Mataas",
    risk_landslide: "Moderate / Katamtaman",
    risk_earthquake: "Moderate / Katamtaman",
    overall_risk_level: "High / Mataas",
    risk_summary:
      "The barangay is highly exposed to typhoon and flooding due to its river system and low-lying puroks. Landslide risk is moderate in upland puroks. Capacity is improving but equipment gaps remain.",
    bdrrmc_chair: brgy.captain,
    bdrrmc_vice: vice ? `Kagawad ${vice.name}` : "Kagawad Rogelio P. Mendoza",
    response_team_lead: "Brgy. Tanod Chief Danilo C. Farinas",
    bdrrmc_meeting_freq: "Monthly / Buwanan",
    bdrrmc_members: council
      ? `${brgy.captain} — Chairperson\nKagawad ${vice?.name ?? ""} — Vice Chairperson (${vice?.committee ?? "Committee"})\n${sk?.name ?? "SK Chairperson"} — SK Chairperson (Youth Affairs)\n${sec?.name ?? "Barangay Secretary"} — Secretary (Secretariat)\n${treas?.name ?? "Barangay Treasurer"} — Treasurer (Finance)\nBrgy. Tanod Chief — Response Team\nBHW — Health and Nutrition\nPTA President — Education\nCVO President — Livelihood`
      : `${brgy.captain} — Chairperson\nKagawad Rogelio P. Mendoza — Vice Chairperson\nSK Chairperson — Youth representative\nBarangay Secretary — Secretariat\nBarangay Treasurer — Finance\nBrgy. Tanod Chief — Response Team\nBHW — Health and Nutrition\nPTA President — Education\nCVO President — Livelihood`,
    prevention_activities:
      "Quarterly drainage canal cleaning (all puroks); riverbank planting of bamboos and mangroves; zoning enforcement along danger zones; IEC campaigns on waste management to prevent clogged drainage",
    prevention_budget: 20000,
    preparedness_activities:
      "Quarterly BDRRMC meetings and drills (earthquake, flood); pre-positioning of relief goods before typhoon season; family disaster preparedness orientation per purok; maintenance of early warning equipment",
    preparedness_budget: 25000,
    response_activities:
      "Activation of Barangay Emergency Operations; pre-emptive evacuation of Purok 1–3 and 7; establishment of evacuation center management team; relief distribution; damage assessment and reporting to MDRRMO",
    response_budget: 20000,
    rehab_activities:
      "Cash-for-work debris clearing; repair of damaged houses using local materials; psychosocial support sessions; livelihood assistance for affected fisherfolk and farmers",
    rehab_budget: 20000,
    evacuation_sites:
      "Barangay Elementary School (main — capacity 180 families / 3 classrooms + covered court); Barangay Hall multipurpose building (capacity 60 families)",
    evacuation_routes:
      "Purok 1–3: main barangay road to elementary school (500m, passable by tricycle); Purok 4–6: provincial road to barangay hall; Purok 7: coastal road to school (alternate: upland trail during storm surge)",
    evacuation_procedures:
      "1) MDRRMO/PAGASA warning received by Punong Barangay; 2) dissemination via text blast, bell and house-to-house; 3) pre-emptive evacuation ordered at PSWS #2 / critical water level; 4) purok leaders lead families to assigned sites; 5) headcount and registration by BDRRMC secretariat; 6) reporting to MDRRMO.",
    transport_resources: "2 barangay service tricycles, 1 dump truck (upon request from municipal pool), 4 motorbancas for coastal purok",
    special_needs_protocol:
      "Purok leaders maintain a masterlist of senior citizens, PWDs and pregnant women; buddy-system assignments; priority evacuation and separate sleeping area at the evacuation center; BHW attends to medical needs.",
    warning_methods: ["SMS / Text blast", "Barangay bell / Kampana", "House-to-house / Bahay-bahay", "Public address system / Megaphone"],
    warning_source: "MDRRMO Pio Duran / PAGASA weather advisories",
    responsible_officials:
      "Punong Barangay (overall); Barangay Secretary (message relay to purok leaders); purok leaders (house-to-house); SK (social media announcements)",
    communication_gaps: "No dedicated two-way radio; mountain purok has weak cellular signal.",
    fund_source: "5% Local DRRM Fund (LDRRMF)",
    total_bdrrm_fund: 85000,
    quick_response_fund: 30000,
    budget_remarks: "Allocated per thematic area: P20k prevention, P25k preparedness, P20k response, P20k rehabilitation. QRF reserved from the general fund.",
  };
}

function draftValues(brgy: { name: string; captain: string }, i: number): Record<string, unknown> {
  const pop = 1400 + ((i * 137) % 1800);
  return {
    barangay_captain: brgy.captain,
    contact_number: `0918 555 0${String(10 + i).padStart(2, "0")}`,
    population_total: pop,
    households_total: Math.round(pop / 4.6),
    puroks_count: 7,
    senior_citizens: Math.round(pop * 0.09),
    pwd_count: Math.round(pop * 0.012),
    children_below5: Math.round(pop * 0.11),
    pregnant_women: Math.round(pop * 0.024),
    major_livelihood: "Farming and fishing",
    hazards_present: ["Typhoon / Bagyo", "Flood / Baha"],
    affected_puroks: "Purok 1 and 2 — flooding",
    households_at_risk_typhoon: Math.round(pop / 4.6 * 0.8),
    households_at_risk_flood: Math.round(pop / 4.6 * 0.3),
    hazard_history: "2020 Typhoon Rolly — flooded puroks for 2 days.",
  };
}

// ---- Barangay council (Sangguniang Barangay) data ----
// NOTE: The official list PDF (official-list_05_2026-09-24.pdf) was not found on
// the server, so council member names below are realistic placeholders. They can
// be corrected at any time via Database Management (System Administrator).
// Punong Barangay names are carried over from the barangay list.
const MALE_NAMES = [
  "Alfredo", "Andres", "Antonio", "Arnel", "Arturo", "Bienvenido", "Bonifacio", "Cesar",
  "Cristino", "Danilo", "Dionisio", "Edgardo", "Elpidio", "Emmanuel", "Ernesto", "Federico",
  "Fernando", "Francisco", "Gilbert", "Gregorio", "Herbert", "Jhonar", "Joel", "Jorge",
  "Jose", "Joven", "Leandro", "Lorenzo", "Marlon", "Melchor", "Nestor", "Orlando",
  "Oscar", "Rafael", "Ramon", "Renato", "Rey", "Ricardo", "Robert", "Rogelio",
  "Rolando", "Rommel", "Ronnie", "Rufino", "Salvador", "Teodoro", "Vicente", "Wenceslao",
];
const FEMALE_NAMES = [
  "Aleli", "Alicia", "Amelia", "Anastacia", "Angelita", "Antonietta", "Aurora", "Carmelita",
  "Cecilia", "Charito", "Cristina", "Dahlia", "Dominga", "Editha", "Elvira", "Esperanza",
  "Estrella", "Evangeline", "Felicitas", "Geraldine", "Gloria", "Herminia", "Imelda", "Jocelyn",
  "Jocasta", "Josefina", "Ligaya", "Loida", "Lourdes", "Ma. Theresa", "Maricel", "Marilou",
  "Marites", "Melinda", "Merlinda", "Nenita", "Norma", "Paz", "Perlita", "Raquel",
  "Remedios", "Rosalinda", "Rowena", "Socorro", "Susana", "Teresita", "Wilma",
];
const SURNAMES = [
  "Azada", "Baclao", "Balmes", "Barrameda", "Bascug", "Bataller", "Bermundo", "Bicol",
  "Borejon", "Borlagdatan", "Bulan", "Bustamante", "Cabrera", "Cardinale", "Carredo", "Celso",
  "Daep", "Dela Cruz", "Dela Peña", "Dianela", "Espinas", "Fernandez", "Ferraren", "Flores",
  "Garcia", "Gestiada", "Glorioso", "Gonzaga", "Gonzales", "Grageda", "Guerrero", "Gutierrez",
  "Ibarra", "Ilagan", "Jamilano", "Jimenez", "Lansangan", "Llagas", "Llona", "Lorzano",
  "Madrideo", "Mancilla", "Marcaida", "Mendoza", "Mintu", "Mirandilla", "Molina", "Monzales",
  "Morales", "Nava", "Navarro", "Ocampo", "Olalia", "Olivan", "Ondiano", "Ortega",
  "Osorio", "Pascua", "Peligro", "Perez", "Piamonte", "Pura", "Ranara", "Rances",
  "Rañola", "Reyes", "Rosales", "Salazar", "Salceda", "Salvador", "Samlao", "Santos",
  "Sarinas", "Solano", "Solmirano", "Soria", "Tapel", "Tenedero", "Tible", "Tolentino",
  "Toribio", "Trillanes", "Tuazon", "Valdez", "Vargas", "Velasco", "Vergara", "Vicaldo",
  "Villamor", "Villanueva", "Ybañez", "Zantua", "Ziga",
];
const COMMITTEES = [
  "Peace & Order / Kapayapaan at Kaayusan",
  "Health & Sanitation / Kalusugan at Sanitasyon",
  "Education & Culture / Edukasyon at Kultura",
  "Infrastructure & Public Works / Imprastruktura",
  "Environment / Pangangalaga sa Kapaligiran",
  "Livelihood & Cooperatives / Kabuhayan",
  "Youth & Sports / Kabataan at Isports",
];
const INITIALS = ["A.", "B.", "C.", "D.", "E.", "F.", "G.", "H.", "J.", "L.", "M.", "N.", "P.", "R.", "S.", "T.", "V."];

interface CouncilMember {
  name: string;
  position: string;
  committee: string | null;
  order: number;
}

// Deterministic, realistic placeholder council for barangay index i
function councilFor(i: number, captain: string): CouncilMember[] {
  const used = new Set<string>([captain]);
  const make = (isFemale: boolean, seed: number): string => {
    const given = isFemale ? FEMALE_NAMES : MALE_NAMES;
    for (let attempt = 0; attempt < 300; attempt++) {
      const g = given[(seed * 7 + attempt * 11 + i) % given.length];
      const s = SURNAMES[(seed * 13 + attempt * 17 + i * 3) % SURNAMES.length];
      const m = INITIALS[(seed + attempt * 5 + i) % INITIALS.length];
      const name = `${g} ${m} ${s}`;
      if (!used.has(name)) {
        used.add(name);
        return name;
      }
    }
    return `${isFemale ? FEMALE_NAMES[0] : MALE_NAMES[0]} Z. ${SURNAMES[seed % SURNAMES.length]}`;
  };
  return [
    { name: captain, position: "PUNONG_BARANGAY", committee: null, order: 0 },
    ...COMMITTEES.map(
      (committee, k): CouncilMember => ({
        name: make(k % 2 === 1, i * 10 + k), // alternate genders across kagawads
        position: "KAGAWAD",
        committee,
        order: k + 1,
      })
    ),
    { name: make(true, i * 10 + 7), position: "SK_CHAIRPERSON", committee: "Sangguniang Kabataan / Youth Affairs", order: 8 },
    { name: make(true, i * 10 + 8), position: "SECRETARY", committee: "Secretariat", order: 9 },
    { name: make(false, i * 10 + 9), position: "TREASURER", committee: "Finance", order: 10 },
  ];
}

function draftValues2(brgy: { name: string; captain: string }, i: number): Record<string, unknown> {
  return {
    ...draftValues(brgy, i),
    vulnerable_groups: "Senior citizens in Purok 2; families along the creek in Purok 1",
    critical_infrastructures: "Barangay hall, day care center, spillway",
    vulnerable_houses: 60,
    bdrrmc_organized: "Yes / Oo",
    bdrrmc_trained: "Partially / Bahagya",
    early_warning_system: "Text blast / Text blast",
    evacuation_centers_count: 1,
    equipment_available: "5 life vests, 2 flashlights, 1 first aid kit",
    drrm_budget: 45000,
  };
}

async function writeFile(key: string, buf: Buffer) {
  const abs = path.join(STORAGE_ROOT, key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf);
}

// Simple PNG generator (RGBA -> RGB truecolor, no interlace) for demo photos
function pngChunk(type: Buffer, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([type, data]);
  const crcTable: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([len, body, crcBuf]);
}

async function makePlaceholderPng(w: number, h: number, seedLabel: string): Promise<Buffer> {
  const rows: Buffer[] = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      // emerald-tinted gradient with soft diagonal bands
      const t = (x / w + y / h) / 2;
      const band = Math.sin((x + y) / 28 + seedLabel.length) * 0.06;
      const r = Math.round(18 + 40 * t + band * 255) & 0xff;
      const g = Math.round(120 + 90 * t + band * 255) & 0xff;
      const b = Math.round(70 + 50 * t) & 0xff;
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk(Buffer.from("IHDR"), ihdr),
    pngChunk(Buffer.from("IDAT"), zlib.deflateSync(Buffer.concat(rows))),
    pngChunk(Buffer.from("IEND"), Buffer.alloc(0)),
  ]);
}

async function main() {
  console.log("Seeding QAS33 database...");

  // Wipe (FK-safe order)
  await db.downloadLog.deleteMany();
  await db.generatedDocument.deleteMany();
  await db.storedFile.deleteMany();
  await db.rating.deleteMany();
  await db.reviewComment.deleteMany();
  await db.review.deleteMany();
  await db.submissionVersion.deleteMany();
  await db.submissionFile.deleteMany();
  await db.submission.deleteMany();
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.session.deleteMany();
  await db.barangayCredential.deleteMany();
  await db.barangayOfficial.deleteMany();
  await db.barangay.deleteMany();
  await db.adminUser.deleteMany();
  await db.templateSection.deleteMany();
  await db.tutorial.deleteMany();
  await db.ratingCriterion.deleteMany();
  await db.systemSetting.deleteMany();
  await fs.rm(path.join(STORAGE_ROOT, "uploads"), { recursive: true, force: true }).catch(() => undefined);
  await fs.rm(path.join(STORAGE_ROOT, "generated"), { recursive: true, force: true }).catch(() => undefined);

  // Admin users — three console roles:
  //   MDRRMO Officer (review + approve), MDRRMO Staff (assist review),
  //   System Administrator (default admin: roles, settings, database)
  const mdrrmo = await db.adminUser.create({
    data: {
      username: "mdrrmo",
      passwordHash: hashSecret("PioDuran2026!"),
      name: "Noel F. Ordona",
      position: "Municipal DRRM Officer",
      role: "MDRRMO_OFFICER",
      lastLoginAt: daysAgo(0, 8, 30),
    },
  });
  await db.adminUser.create({
    data: {
      username: "sysadmin",
      passwordHash: hashSecret("SysAdmin2026!"),
      name: "Tho Pogi",
      position: "ICT Administrator / System Administrator",
      role: "SYSTEM_ADMIN",
    },
  });
  const staff = await db.adminUser.create({
    data: {
      username: "staff",
      passwordHash: hashSecret("Staff2026!"),
      name: "Jun Carlo Anasco",
      position: "MDRRMO Staff",
      role: "MDRRMO_STAFF",
      lastLoginAt: daysAgo(0, 7, 45),
    },
  });

  // Barangays + credentials + councils (Sangguniang Barangay members)
  const barangays: Array<{ id: string; code: string; name: string }> = [];
  const councils: CouncilMember[][] = [];
  for (let i = 0; i < BARANGAYS_OF_PIO_DURAN.length; i++) {
    const b = BARANGAYS_OF_PIO_DURAN[i];
    const code = `PD-BRG-${String(i + 1).padStart(3, "0")}`;
    const created = await db.barangay.create({
      data: {
        code,
        name: b.name,
        captain: b.captain,
        population: 1400 + ((i * 137) % 1800),
        households: Math.round((1400 + ((i * 137) % 1800)) / 4.6),
        puroks: 7,
        credential: {
          create: {
            pinHash: hashSecret(`QAS33-${String(i + 1).padStart(3, "0")}`),
            // Accounts that never signed in keep a PENDING temporary PIN —
            // MDRRMO/Staff/SysAdmin can print the credential handout for them
            // (Credentials module). Barangays that already signed in have set
            // their own PIN (tempPin cleared, not printable — regeneration
            // issues a new one). Albasan (i=0) demonstrates first-time change.
            tempPin: i < 8 && i !== 0 ? null : `QAS33-${String(i + 1).padStart(3, "0")}`,
            mustChangePin: i === 0 || i >= 8,
            active: true,
            lastLoginAt: i < 8 ? daysAgo(1, 10, 15) : null,
          },
        },
      },
    });
    const council = councilFor(i, b.captain);
    await db.barangayOfficial.createMany({
      data: council.map((o) => ({
        barangayId: created.id,
        name: o.name,
        position: o.position,
        committee: o.committee,
        order: o.order,
      })),
    });
    barangays.push({ id: created.id, code, name: created.name });
    councils.push(council);
  }

  // Template sections
  for (const s of SECTION_DEFS) {
    await db.templateSection.create({
      data: {
        key: s.key,
        order: s.order,
        titleEn: s.titleEn,
        titleTl: s.titleTl,
        descEn: s.descEn,
        descTl: s.descTl,
        icon: s.icon,
        requiresUpload: s.requiresUpload,
        uploadLabelEn: s.uploadLabelEn,
        uploadLabelTl: s.uploadLabelTl,
        uploadFormats: s.uploadFormats,
        uploadMaxMB: s.uploadMaxMB,
        required: s.required,
        fieldsJson: JSON.stringify(s.fields),
      },
    });
  }

  // Tutorials
  for (const t of TUTORIAL_DEFS) {
    await db.tutorial.create({ data: { key: t.key, titleEn: t.titleEn, titleTl: t.titleTl, bodyEn: t.bodyEn, bodyTl: t.bodyTl, order: TUTORIAL_DEFS.indexOf(t) + 1 } });
  }

  // Rating criteria
  const criteriaData = [
    { key: "completeness", name: "Completeness", maxScore: 25, order: 1 },
    { key: "accuracy", name: "Accuracy", maxScore: 25, order: 2 },
    { key: "compliance", name: "Compliance", maxScore: 25, order: 3 },
    { key: "supporting_docs", name: "Supporting Documents", maxScore: 25, order: 4 },
  ];
  for (const c of criteriaData) {
    await db.ratingCriterion.create({ data: c });
  }

  // Settings
  const settingsMap: Record<string, string> = {
    planYear: JSON.stringify(2026),
    signatoryName: JSON.stringify("Noel F. Ordona"),
    signatoryPosition: JSON.stringify("Municipal Disaster Risk Reduction and Management Officer"),
    municipality: JSON.stringify("Pio Duran"),
    province: JSON.stringify("Albay"),
    region: JSON.stringify("Bicol Region (Region V)"),
    motto: JSON.stringify("Faster. Simpler. Transparent."),
  };
  for (const [key, value] of Object.entries(settingsMap)) {
    await db.systemSetting.create({ data: { key, value } });
  }

  const YEAR = 2026;
  const getSubmission = async (idx: number) => {
    const b = barangays[idx];
    return db.submission.upsert({
      where: { barangayId_year: { barangayId: b.id, year: YEAR } },
      create: { barangayId: b.id, year: YEAR },
      update: {},
    });
  };

  const uploadReqFiles = async (
    submissionId: string,
    brgyCode: string,
    brgyName: string,
    status: string,
    uploadedAt: Date,
    version: number
  ) => {
    const uploadSections = ["hazard_assessment", "risk_assessment", "bdrrmc_structure", "evacuation_plan"];
    for (const sk of uploadSections) {
      const def = SECTION_DEFS.find((s) => s.key === sk)!;
      const title = def.uploadLabelEn || def.titleEn;
      const buf = await makePlaceholderPdf(title, `Barangay ${brgyName} — ${title}`);
      const filename = `${sk}_${brgyCode}.pdf`;
      const storageKey = path.join("uploads", brgyCode, submissionId, `${randomBytes(6).toString("hex")}-${filename}`);
      await writeFile(storageKey, buf);
      await db.submissionFile.create({
        data: {
          submissionId,
          sectionKey: sk,
          filename,
          storageKey,
          mimeType: "application/pdf",
          size: buf.length,
          version,
          status,
          uploadedBy: `Barangay ${brgyName}`,
          uploadedAt,
        },
      });
    }
  };

  const audit = (actorType: string, actorName: string, action: string, detail: string, barangayId?: string, at?: Date) =>
    db.auditLog.create({
      data: {
        actorType: actorName.includes("System") ? "SYSTEM" : (actorType as "BARANGAY" | "ADMIN" | "SYSTEM"),
        actorName,
        action,
        detail,
        barangayId: barangayId ?? null,
        ip: "10.0.0." + (Math.floor(Math.random() * 200) + 2),
        createdAt: at ?? new Date(),
      },
    });

  // ============ DEMO SUBMISSIONS ============

  // --- [0] Albasan: DRAFT (Tagalog), partial, 1 file
  {
    const sub = await getSubmission(0);
    const vals = draftValues(BARANGAYS_OF_PIO_DURAN[0], 0);
    await db.submission.update({
      where: { id: sub.id },
      data: { status: "DRAFT", templateLang: "TL", valuesJson: JSON.stringify(vals), progress: 25, version: 0 },
    });
    const buf = await makePlaceholderPdf("Purok-Based Hazard Risk Assessment", "Barangay Albasan — draft hazard assessment");
    const storageKey = path.join("uploads", barangays[0].code, sub.id, `${randomBytes(6).toString("hex")}-hazard_assessment.pdf`);
    await writeFile(storageKey, buf);
    await db.submissionFile.create({
      data: { submissionId: sub.id, sectionKey: "hazard_assessment", filename: "hazard_assessment_PD-BRG-001.pdf", storageKey, mimeType: "application/pdf", size: buf.length, version: 1, status: "PENDING", uploadedBy: "Barangay Albasan", uploadedAt: daysAgo(2, 10, 30) },
    });
    await audit("BARANGAY", "Barangay Albasan", "LOGGED_IN", "First-time login — temporary PIN changed", barangays[0].id, daysAgo(3, 9, 0));
    await audit("BARANGAY", "Barangay Albasan", "TEMPLATE_SELECTED", "Selected Tagalog template", barangays[0].id, daysAgo(3, 9, 5));
    await audit("BARANGAY", "Barangay Albasan", "UPLOADED_FILE", "Uploaded: hazard_assessment_PD-BRG-001.pdf", barangays[0].id, daysAgo(2, 10, 30));
  }

  // --- [1] Bacong: SUBMITTED v1 (English), complete
  {
    const sub = await getSubmission(1);
    const vals = fullValues(BARANGAYS_OF_PIO_DURAN[1], 1, councils[1]);
    const at = daysAgo(4, 14, 12);
    await db.submission.update({
      where: { id: sub.id },
      data: { status: "SUBMITTED", templateLang: "EN", valuesJson: JSON.stringify(vals), progress: 100, version: 1, submittedAt: at },
    });
    await uploadReqFiles(sub.id, barangays[1].code, barangays[1].name, "PENDING", daysAgo(4, 13, 40), 1);
    await db.submissionVersion.create({ data: { submissionId: sub.id, version: 1, valuesJson: JSON.stringify(vals), filesJson: "[]", note: "Initial submission", submittedAt: at } });
    await db.notification.create({ data: { audience: "ADMIN", type: "SUBMITTED", title: "New submission", body: `Barangay Bacong submitted BDRRMP ${YEAR} (v1) for review.`, link: "submissions", createdAt: at } });
    await audit("BARANGAY", "Barangay Bacong", "SUBMITTED", `Submitted BDRRMP ${YEAR} version 1`, barangays[1].id, at);
  }

  // --- [2] Bagumbayan: UNDER_REVIEW v1
  {
    const sub = await getSubmission(2);
    const vals = fullValues(BARANGAYS_OF_PIO_DURAN[2], 2, councils[2]);
    const at = daysAgo(5, 9, 20);
    await db.submission.update({
      where: { id: sub.id },
      data: { status: "UNDER_REVIEW", templateLang: "EN", valuesJson: JSON.stringify(vals), progress: 100, version: 1, submittedAt: daysAgo(6, 15, 2), underReviewAt: at },
    });
    await uploadReqFiles(sub.id, barangays[2].code, barangays[2].name, "PENDING", daysAgo(6, 14, 30), 1);
    await db.submissionVersion.create({ data: { submissionId: sub.id, version: 1, valuesJson: JSON.stringify(vals), filesJson: "[]", note: "Initial submission", submittedAt: daysAgo(6, 15, 2) } });
    await db.review.create({ data: { submissionId: sub.id, version: 1, reviewerId: mdrrmo.id, reviewerName: mdrrmo.name, action: "START_REVIEW", createdAt: at } });
    await audit("BARANGAY", "Barangay Bagumbayan", "SUBMITTED", `Submitted BDRRMP ${YEAR} version 1`, barangays[2].id, daysAgo(6, 15, 2));
    await audit("ADMIN", mdrrmo.name, "STARTED_REVIEW", "Opened submission for review — Bagumbayan", barangays[2].id, at);
  }

  // --- [3] Baliana: NEEDS_REVISION v1 with comments
  {
    const sub = await getSubmission(3);
    const vals = fullValues(BARANGAYS_OF_PIO_DURAN[3], 3, councils[3]);
    const at = daysAgo(1, 16, 45);
    await db.submission.update({
      where: { id: sub.id },
      data: { status: "NEEDS_REVISION", templateLang: "EN", valuesJson: JSON.stringify(vals), progress: 100, version: 1, submittedAt: daysAgo(3, 10, 5), underReviewAt: daysAgo(2, 8, 30) },
    });
    await uploadReqFiles(sub.id, barangays[3].code, barangays[3].name, "PENDING", daysAgo(3, 9, 40), 1);
    await db.submissionVersion.create({ data: { submissionId: sub.id, version: 1, valuesJson: JSON.stringify(vals), filesJson: "[]", note: "Initial submission", submittedAt: daysAgo(3, 10, 5) } });
    const review = await db.review.create({
      data: { submissionId: sub.id, version: 1, reviewerId: mdrrmo.id, reviewerName: mdrrmo.name, action: "REVISION_REQUESTED", overallComment: "Please correct the flagged items and resubmit within the week.", createdAt: at },
    });
    await db.reviewComment.createMany({
      data: [
        { reviewId: review.id, sectionKey: "hazard_assessment", comment: "Please update the number of households affected by flooding — the figure must match your purok-based risk assessment (Purok 1–3).", requiresRevision: true, createdAt: at },
        { reviewId: review.id, sectionKey: "evacuation_plan", comment: "Specify the alternate route for Purok 7 during storm surge and include the capacity of each evacuation site.", requiresRevision: true, createdAt: at },
      ],
    });
    await db.submissionFile.updateMany({ where: { submissionId: sub.id, sectionKey: { in: ["hazard_assessment", "evacuation_plan"] } }, data: { status: "NEEDS_REVISION" } });
    await db.notification.create({ data: { barangayId: barangays[3].id, audience: "BARANGAY", type: "REVISION", title: "BDRRMP needs revision", body: "The MDRRMO requested revisions on 2 sections: Hazard Assessment and Evacuation Plan. Please see the comments.", link: "comments", createdAt: at } });
    await audit("ADMIN", mdrrmo.name, "REVISION_REQUESTED", "Requested revision with 2 section comments — Baliana", barangays[3].id, at);
  }

  // --- [4] Banawang: NOT_STARTED (template TL selected)
  {
    const sub = await getSubmission(4);
    await db.submission.update({ where: { id: sub.id }, data: { status: "NOT_STARTED", templateLang: "TL", progress: 0 } });
    await audit("BARANGAY", "Barangay Banawang", "TEMPLATE_SELECTED", "Selected Tagalog template", barangays[4].id, daysAgo(1, 11, 0));
  }

  // --- [5] Buenavista: READY_FOR_DOWNLOAD (v2 approved, rated, signed, PDF generated)
  {
    const sub = await getSubmission(5);
    const vals = fullValues(BARANGAYS_OF_PIO_DURAN[5], 5, councils[5]);
    const submittedV1 = daysAgo(9, 10, 0);
    const reviewV1 = daysAgo(8, 13, 30);
    const resubmitted = daysAgo(7, 9, 15);
    const approvedAt = daysAgo(7, 15, 40);
    const ratedAt = daysAgo(7, 15, 35);
    const finalizedAt = daysAgo(7, 15, 45);
    await db.submission.update({
      where: { id: sub.id },
      data: { status: "READY_FOR_DOWNLOAD", templateLang: "TL", valuesJson: JSON.stringify(vals), progress: 100, version: 2, submittedAt: submittedV1, resubmittedAt: resubmitted, underReviewAt: daysAgo(8, 13, 0), approvedAt, finalizedAt: finalizedAt },
    });
    await uploadReqFiles(sub.id, barangays[5].code, barangays[5].name, "APPROVED", submittedV1, 1);
    await db.submissionVersion.create({ data: { submissionId: sub.id, version: 1, valuesJson: JSON.stringify({ ...vals, risk_summary: "draft summary" }), filesJson: "[]", note: "Initial submission", submittedAt: submittedV1 } });
    await db.submissionVersion.create({ data: { submissionId: sub.id, version: 2, valuesJson: JSON.stringify(vals), filesJson: "[]", note: "Revised per MDRRMO comments", submittedAt: resubmitted } });
    const review1 = await db.review.create({
      data: { submissionId: sub.id, version: 1, reviewerId: mdrrmo.id, reviewerName: mdrrmo.name, action: "REVISION_REQUESTED", overallComment: "Good initial submission. Please refine the risk summary and complete the rehabilitation activities.", createdAt: reviewV1 },
    });
    await db.reviewComment.create({ data: { reviewId: review1.id, sectionKey: "risk_assessment", comment: "Please elaborate the risk summary — include the basis for the overall risk level.", requiresRevision: true, createdAt: reviewV1 } });
    const review2 = await db.review.create({
      data: { submissionId: sub.id, version: 2, reviewerId: mdrrmo.id, reviewerName: mdrrmo.name, action: "APPROVED", overallComment: "Complete, accurate and compliant. Well done!", createdAt: approvedAt },
    });
    await db.reviewComment.create({ data: { reviewId: review2.id, sectionKey: "hazard_assessment", comment: "Hazard data is consistent with the purok-based assessment. Approved.", requiresRevision: false, createdAt: approvedAt } });
    await db.rating.create({
      data: {
        submissionId: sub.id,
        scoresJson: JSON.stringify({ completeness: 25, accuracy: 22, compliance: 25, supporting_docs: 20 }),
        total: 92,
        remarks: "Excellent plan. Strengthen the supporting documents (geo-hazard map) next cycle.",
        ratedBy: mdrrmo.id,
        ratedByName: mdrrmo.name,
        createdAt: ratedAt,
      },
    });
    // Generate final document
    const docId = buildDocId(barangays[5].code, YEAR, 2);
    const { generateBdrrmpPdf } = await import("../src/lib/qas33/pdf");
    const signatureHash = createHash("sha256").update(`${docId}|${barangays[5].id}|${mdrrmo.name}|${finalizedAt.toISOString()}`).digest("hex");
    const pdfBuf = await generateBdrrmpPdf({
      barangay: { name: barangays[5].name, code: barangays[5].code },
      submission: { year: YEAR, version: 2, lang: "TL", values: vals },
      sections: SECTION_DEFS,
      docId,
      rating: { total: 92, maxTotal: 100, remarks: "Excellent plan. Strengthen the supporting documents (geo-hazard map) next cycle." },
      signature: { signedBy: mdrrmo.name, position: "Municipal Disaster Risk Reduction and Management Officer", signedAt: finalizedAt, signatureHash },
      settings: { municipality: "Pio Duran", province: "Albay" },
      verifyUrl: `https://qas33.pioduran.gov.ph/?verify=${docId}`,
      approvedAt,
    });
    const docKey = path.join("generated", `${docId}.pdf`);
    await writeFile(docKey, pdfBuf);
    await db.generatedDocument.create({
      data: { submissionId: sub.id, docId, version: 2, fileKey: docKey, lang: "TL", signed: true, signedBy: mdrrmo.name, signedAt: finalizedAt, signatureHash, generatedAt: finalizedAt },
    });
    await db.notification.create({ data: { barangayId: barangays[5].id, audience: "BARANGAY", type: "FINALIZED", title: "Final BDRRMP ready for download", body: `Your BDRRMP ${YEAR} was approved and signed. Document ID: ${docId}. You may now download the final PDF.`, link: "documents", createdAt: finalizedAt } });
    await audit("BARANGAY", "Barangay Buenavista", "SUBMITTED", `Submitted BDRRMP ${YEAR} version 1`, barangays[5].id, submittedV1);
    await audit("ADMIN", mdrrmo.name, "REVISION_REQUESTED", "Requested revision on Risk Assessment — Buenavista", barangays[5].id, reviewV1);
    await audit("BARANGAY", "Barangay Buenavista", "RESUBMITTED", `Resubmitted BDRRMP ${YEAR} version 2`, barangays[5].id, resubmitted);
    await audit("ADMIN", mdrrmo.name, "RATED", "Evaluation saved: 92/100 — Buenavista", barangays[5].id, ratedAt);
    await audit("ADMIN", mdrrmo.name, "APPROVED", `Approved BDRRMP ${YEAR} v2 — Buenavista`, barangays[5].id, approvedAt);
    await audit("SYSTEM", "System", "FINALIZED", `Generated final document ${docId} with authorized signature`, barangays[5].id, finalizedAt);
    console.log(`  Generated sample final document: ${docId} (${pdfBuf.length} bytes)`);
  }

  // --- [6] Caratagan: RESUBMITTED v2
  {
    const sub = await getSubmission(6);
    const vals = fullValues(BARANGAYS_OF_PIO_DURAN[6], 6, councils[6]);
    const submittedV1 = daysAgo(8, 11, 0);
    const reviewV1 = daysAgo(7, 14, 20);
    const resubmitted = daysAgo(0, 8, 50);
    await db.submission.update({
      where: { id: sub.id },
      data: { status: "RESUBMITTED", templateLang: "EN", valuesJson: JSON.stringify(vals), progress: 100, version: 2, submittedAt: submittedV1, resubmittedAt: resubmitted, underReviewAt: daysAgo(7, 14, 0) },
    });
    await uploadReqFiles(sub.id, barangays[6].code, barangays[6].name, "PENDING", submittedV1, 1);
    const hazardFile = await db.submissionFile.findFirst({ where: { submissionId: sub.id, sectionKey: "hazard_assessment" } });
    if (hazardFile) {
      const buf = await makePlaceholderPdf("Purok-Based Hazard Risk Assessment (Revised)", "Barangay Caratagan — corrected household figures");
      const storageKey = path.join("uploads", barangays[6].code, sub.id, `${randomBytes(6).toString("hex")}-hazard_assessment_revised.pdf`);
      await writeFile(storageKey, buf);
      await db.submissionFile.create({ data: { submissionId: sub.id, sectionKey: "hazard_assessment", filename: "hazard_assessment_revised.pdf", storageKey, mimeType: "application/pdf", size: buf.length, version: 2, status: "PENDING", uploadedBy: "Barangay Caratagan", uploadedAt: resubmitted } });
    }
    await db.submissionVersion.create({ data: { submissionId: sub.id, version: 1, valuesJson: JSON.stringify({ ...vals, vulnerable_houses: 40 }), filesJson: "[]", note: "Initial submission", submittedAt: submittedV1 } });
    await db.submissionVersion.create({ data: { submissionId: sub.id, version: 2, valuesJson: JSON.stringify(vals), filesJson: "[]", note: "Revised per MDRRMO comments", submittedAt: resubmitted } });
    const review1 = await db.review.create({
      data: { submissionId: sub.id, version: 1, reviewerId: mdrrmo.id, reviewerName: mdrrmo.name, action: "REVISION_REQUESTED", overallComment: "Update vulnerable house count and revise the hazard assessment.", createdAt: reviewV1 },
    });
    await db.reviewComment.create({ data: { reviewId: review1.id, sectionKey: "vulnerability_assessment", comment: "Number of houses made of light materials appears underestimated based on your latest census. Please verify.", requiresRevision: true, createdAt: reviewV1 } });
    await db.notification.create({ data: { barangayId: barangays[6].id, audience: "BARANGAY", type: "REVISION", title: "BDRRMP needs revision", body: "The MDRRMO requested a revision on Vulnerability Assessment. Please see the comment and resubmit.", link: "comments", createdAt: reviewV1 } });
    await db.notification.create({ data: { audience: "ADMIN", type: "SUBMITTED", title: "Resubmission received", body: `Barangay Caratagan resubmitted BDRRMP ${YEAR} (v2) for re-review.`, link: "submissions", createdAt: resubmitted } });
    await audit("BARANGAY", "Barangay Caratagan", "RESUBMITTED", `Resubmitted BDRRMP ${YEAR} version 2`, barangays[6].id, resubmitted);
  }

  // --- [7] Cuyaoyao: DRAFT ~55% (English)
  {
    const sub = await getSubmission(7);
    const vals = draftValues2(BARANGAYS_OF_PIO_DURAN[7], 7);
    await db.submission.update({
      where: { id: sub.id },
      data: { status: "DRAFT", templateLang: "EN", valuesJson: JSON.stringify(vals), progress: 36, version: 0 },
    });
    const buf = await makePlaceholderPdf("Barangay Risk Map", "Barangay Cuyaoyao — initial risk map");
    const storageKey = path.join("uploads", barangays[7].code, sub.id, `${randomBytes(6).toString("hex")}-risk_map.pdf`);
    await writeFile(storageKey, buf);
    await db.submissionFile.create({ data: { submissionId: sub.id, sectionKey: "risk_assessment", filename: "risk_map_PD-BRG-008.pdf", storageKey, mimeType: "application/pdf", size: buf.length, version: 1, status: "PENDING", uploadedBy: "Barangay Cuyaoyao", uploadedAt: daysAgo(1, 13, 22) } });
    await audit("BARANGAY", "Barangay Cuyaoyao", "SAVED_DRAFT", "Saved draft BDRRMP (36% complete)", barangays[7].id, daysAgo(1, 13, 25));
  }

  // --- Remaining 25: NOT_STARTED
  for (let i = 8; i < barangays.length; i++) {
    await getSubmission(i);
  }

  // Admin overview notifications
  await db.notification.create({ data: { audience: "ADMIN", type: "SYSTEM", title: "Welcome to QAS33", body: `BDRRMP ${YEAR} cycle is open. 33 barangays are onboarded and credentials have been issued.`, createdAt: daysAgo(14, 8, 0) } });

  // --- File Library samples (documents & images from all user types) ---
  {
    const officerMemo = await makePlaceholderPdf("Memorandum No. 2026-01", "BDRRMP 2026 Submission Timeline & Requirements");
    let key = path.join("uploads", "library", "mdrrmo", `${randomBytes(6).toString("hex")}-Memorandum_BDRRMP2026_Timeline.pdf`);
    await writeFile(key, officerMemo);
    await db.storedFile.create({ data: { ownerType: "ADMIN", adminId: mdrrmo.id, ownerName: `${mdrrmo.name} (MDRRMO Officer)`, category: "Correspondence", title: "Memorandum: BDRRMP 2026 Submission Timeline", description: "Submission deadlines and required attachments for the 2026 BDRRMP cycle.", originalName: "Memorandum_BDRRMP2026_Timeline.pdf", storageKey: key, mimeType: "application/pdf", kind: "DOCUMENT", size: officerMemo.length, downloads: 4, createdAt: daysAgo(13, 9, 0) } });

    const staffQat = await makePlaceholderPdf("QAT Orientation", "Quality Assurance Team — BDRRM Plan Evaluation Guide");
    key = path.join("uploads", "library", "staff", `${randomBytes(6).toString("hex")}-QAT_Orientation_BDRRM_Plan.pdf`);
    await writeFile(key, staffQat);
    await db.storedFile.create({ data: { ownerType: "ADMIN", adminId: staff.id, ownerName: `${staff.name} (MDRRMO Staff)`, category: "Report", title: "QAT Orientation — BDRRM Plan Evaluation", description: "Reference slides used during the QAT orientation for evaluating BDRRM plans.", originalName: "QAT_Orientation_BDRRM_Plan.pdf", storageKey: key, mimeType: "application/pdf", kind: "DOCUMENT", size: staffQat.length, downloads: 2, createdAt: daysAgo(10, 14, 30) } });

    // Buenavista (PD-BRG-006) — evacuation center photo + assembly resolution
    const evacPhoto = await makePlaceholderPng(480, 320, "evac");
    key = path.join("uploads", "library", "PD-BRG-006", `${randomBytes(6).toString("hex")}-evacuation_center_photo.png`);
    await writeFile(key, evacPhoto);
    await db.storedFile.create({ data: { ownerType: "BARANGAY", barangayId: barangays[5].id, ownerName: `Barangay ${barangays[5].name}`, category: "Photo / Documentation", title: "Buenavista Central School Evacuation Center", description: "Designated evacuation center — capacity 45 families. Photo taken during the Q1 inspection.", originalName: "evacuation_center_photo.png", storageKey: key, mimeType: "image/png", kind: "IMAGE", size: evacPhoto.length, downloads: 1, createdAt: daysAgo(6, 10, 15) } });

    const resolution = await makePlaceholderPdf("Sangguniang Barangay Resolution No. 012-2026", "Barangay Buenavista — Adopting the Barangay DRRM Plan");
    key = path.join("uploads", "library", "PD-BRG-006", `${randomBytes(6).toString("hex")}-SB_Resolution_012-2026.pdf`);
    await writeFile(key, resolution);
    await db.storedFile.create({ data: { ownerType: "BARANGAY", barangayId: barangays[5].id, ownerName: `Barangay ${barangays[5].name}`, category: "Supporting Document", title: "SB Resolution No. 012-2026 (Adopting the BDRRMP)", description: "Sangguniang Barangay resolution adopting the Barangay DRRM Plan for 2026.", originalName: "SB_Resolution_012-2026.pdf", storageKey: key, mimeType: "application/pdf", kind: "DOCUMENT", size: resolution.length, downloads: 0, createdAt: daysAgo(3, 15, 40) } });

    // Baliana (PD-BRG-004) — flood documentation photo
    const floodPhoto = await makePlaceholderPng(480, 320, "flood");
    key = path.join("uploads", "library", "PD-BRG-004", `${randomBytes(6).toString("hex")}-flood_documentation_purok_3.png`);
    await writeFile(key, floodPhoto);
    await db.storedFile.create({ data: { ownerType: "BARANGAY", barangayId: barangays[3].id, ownerName: `Barangay ${barangays[3].name}`, category: "Photo / Documentation", title: "Flood Documentation — Purok 3", description: "Knee-deep flooding along the barangay road during the December habagat. Attached to the hazard assessment.", originalName: "flood_documentation_purok_3.png", storageKey: key, mimeType: "image/png", kind: "IMAGE", size: floodPhoto.length, downloads: 3, createdAt: daysAgo(9, 11, 5) } });
  }

  const count = await db.barangay.count();
  console.log(`Seed complete: ${count} barangays, ${await db.barangayOfficial.count()} council officials, ${await db.submission.count()} submissions, ${await db.storedFile.count()} library files, ${await db.auditLog.count()} audit entries.`);
  console.log("Barangay login demo: PD-BRG-006 / QAS33-006 (Buenavista — final doc ready)");
  console.log("MDRRMO Officer: mdrrmo / PioDuran2026! (Noel F. Ordona — review & approve)");
  console.log("MDRRMO Staff: staff / Staff2026! (Jun Carlo Anasco — assists review)");
  console.log("System Admin (default): sysadmin / SysAdmin2026! (Tho Pogi — roles, settings, database)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
