// QAS33 Task 31 — Replace barangay profile + purok data with the REAL data dump
// (brgy_profile: 33 records, brgy_per_purok_profile: 188 records).
//
// What it does:
//   1. Renumber barangay codes to the official scheme (pd-brgy-01..05 = Barangay I..V,
//      pd-brgy-06..33 = Agol..Tibabo). Only PD-BRG-001..008 change assignment —
//      two-phase rotation to respect the unique constraint.
//   2. Fills the real profile: vision / mission / goals / objectives / logo URL.
//   3. Replaces ALL puroks (fake seed) with the 188 real puroks + demographics
//      (households, families, male/female, seniors, PWD, solo parents, 4Ps).
//   4. Recomputes Barangay population / households / purok count from the purok sums.
//   5. Updates BarangayBoundary (lat/lng, coastal/upland/urban) and the 2026
//      BarangayReportedSubtotal with real sums (fabricated figures zeroed).
//   6. Renames storage folders for renumbered codes and rewrites
//      SubmissionFile/StoredFile storageKey paths to match.
//
// Run: bun run scripts/update-brgy-real-data.ts
import { promises as fs } from "fs";
import path from "path";
import { db } from "../src/lib/db";

// ---------------------------------------------------------------------------
// REAL DATA — brgy_profile (33 records)
// ---------------------------------------------------------------------------

interface BrgyProfile {
  brgyId: string; // pd-brgy-XX (official)
  name: string; // dump barangay_name
  locArea: "up-land" | "coastal";
  cls: "rural" | "urban";
  vision: string;
  mission: string;
  goals: string;
  objectives: string;
  logo: string;
  lat: number;
  lng: number;
}

const PROFILES: BrgyProfile[] = [
  { brgyId: "pd-brgy-06", name: "Agol", locArea: "up-land", cls: "rural", vision: "A productive upland farming community.", mission: "To uplift farmers' livelihood and protect natural resources.", goals: "Improve agricultural productivity and rural welfare.", objectives: "Implement farming training, road improvements, and health services.", logo: "https://i.ibb.co/8nZ1Tc8Y/agol.png", lat: 13.048, lng: 123.456 },
  { brgyId: "pd-brgy-07", name: "Alabangpuro", locArea: "up-land", cls: "rural", vision: "A peaceful and progressive upland community.", mission: "To promote sustainable agriculture and rural development.", goals: "Enhance farming and basic social services.", objectives: "Provide farm inputs, training, and access to health and education.", logo: "https://i.ibb.co/r2Mb224m/ALABANGPURO-SEAL.png", lat: 13.023, lng: 123.4462 },
  { brgyId: "pd-brgy-08", name: "Banawan", locArea: "coastal", cls: "urban", vision: "A united coastal urban community with sustainable growth.", mission: "To deliver quality services and promote safe coastal living.", goals: "Improve public services and coastal protection.", objectives: "Implement flood control, livelihood, and youth programs.", logo: "https://i.ibb.co/Pv9Rmm22/Banawan.png", lat: 13.066, lng: 123.455 },
  { brgyId: "pd-brgy-01", name: "Barangay I", locArea: "coastal", cls: "urban", vision: "A progressive coastal community with a thriving economy.", mission: "To promote sustainable coastal development and quality services for all residents.", goals: "Improve livelihood and coastal resource management.", objectives: "Implement coastal clean-up, livelihood training, and disaster preparedness programs.", logo: "https://i.ibb.co/YFsRjzrd/barangay1.png", lat: 13.0292, lng: 123.4441 },
  { brgyId: "pd-brgy-02", name: "Barangay II", locArea: "coastal", cls: "urban", vision: "A safe, united, and progressive coastal barangay.", mission: "To deliver responsive public services through active community engagement.", goals: "Strengthen local economy and disaster resilience.", objectives: "Conduct coastal protection, skills training, and infrastructure projects.", logo: "https://i.ibb.co/ZZHRC6C/barangay2.png", lat: 13.0305, lng: 123.445 },
  { brgyId: "pd-brgy-03", name: "Barangay III", locArea: "coastal", cls: "urban", vision: "A model urban coastal barangay with empowered citizens.", mission: "To provide inclusive and transparent governance to all residents.", goals: "Promote sustainable urban-coastal development.", objectives: "Improve drainage, fisheries support, and health services.", logo: "https://i.ibb.co/sJm360Zh/barangay3.png", lat: 13.028, lng: 123.4453 },
  { brgyId: "pd-brgy-04", name: "Barangay IV", locArea: "coastal", cls: "urban", vision: "A vibrant coastal community built on unity and resilience.", mission: "To advance sustainable coastal development through cooperation.", goals: "Enhance livelihood and coastal safety.", objectives: "Roll out coastal rehabilitation, livelihood programs, and youth activities.", logo: "https://i.ibb.co/ccDywr4f/barangay4.png", lat: 13.0276, lng: 123.4432 },
  { brgyId: "pd-brgy-05", name: "Barangay V", locArea: "coastal", cls: "urban", vision: "A peaceful and self-reliant coastal barangay.", mission: "To promote inclusive growth and responsive public service.", goals: "Deliver better services and livelihood opportunities.", objectives: "Support fisheries, tourism, and infrastructure development.", logo: "https://i.ibb.co/Q3kWrvhY/barangay5.png", lat: 13.03, lng: 123.4428 },
  { brgyId: "pd-brgy-09", name: "Basicao Coastal", locArea: "coastal", cls: "rural", vision: "A resilient and thriving coastal community.", mission: "To promote fisheries-based livelihood and community welfare.", goals: "Strengthen fisheries and disaster preparedness.", objectives: "Conduct mangrove planting, fishery training, and relief programs.", logo: "https://i.ibb.co/gZJD6JJK/basicao-coastal.png", lat: 13.053, lng: 123.461 },
  { brgyId: "pd-brgy-10", name: "Basicao Interior", locArea: "up-land", cls: "rural", vision: "A progressive upland farming community.", mission: "To develop sustainable agriculture and rural infrastructure.", goals: "Improve farm productivity and rural services.", objectives: "Build farm-to-market roads and provide agricultural support.", logo: "https://i.ibb.co/twGQc7QS/basicao-Interior.png", lat: 13.052, lng: 123.453 },
  { brgyId: "pd-brgy-11", name: "Binodegahan", locArea: "up-land", cls: "rural", vision: "A peaceful and productive upland barangay.", mission: "To promote rural development through farming and cooperation.", goals: "Increase farm yields and household income.", objectives: "Distribute farm inputs, training, and basic services.", logo: "https://i.ibb.co/V0ZbBz9F/binodegahan.png", lat: 13.011, lng: 123.451 },
  { brgyId: "pd-brgy-12", name: "Buenavista", locArea: "coastal", cls: "rural", vision: "A beautiful coastal community with thriving fisheries.", mission: "To protect coastal resources and improve fisherfolk welfare.", goals: "Strengthen coastal economy and safety.", objectives: "Implement fishery support, coastal protection, and health programs.", logo: "https://i.ibb.co/KcNvHjG5/buenavista.png", lat: 13.06, lng: 123.452 },
  { brgyId: "pd-brgy-13", name: "Buyo", locArea: "up-land", cls: "rural", vision: "A productive and peaceful upland farming community.", mission: "To promote agricultural sustainability and community growth.", goals: "Enhance farming income and basic services.", objectives: "Provide seeds, training, and farm-to-market road support.", logo: "https://i.ibb.co/8DH9xMPj/buyo.png", lat: 13.024, lng: 123.438 },
  { brgyId: "pd-brgy-14", name: "Caratagan", locArea: "up-land", cls: "urban", vision: "A model upland urban community.", mission: "To deliver efficient services and promote inclusive growth.", goals: "Improve infrastructure and social services.", objectives: "Build roads, health stations, and livelihood centers.", logo: "https://i.ibb.co/rfsqgg2J/caratagan.png", lat: 13.012, lng: 123.442 },
  { brgyId: "pd-brgy-15", name: "Cuyaoyao", locArea: "up-land", cls: "rural", vision: "A peaceful and self-reliant upland community.", mission: "To uplift rural welfare through agriculture and unity.", goals: "Promote sustainable farming and community cooperation.", objectives: "Conduct values formation, training, and farm support.", logo: "https://i.ibb.co/QF0KtLZ8/cuyaoyao.png", lat: 13.006, lng: 123.445 },
  { brgyId: "pd-brgy-16", name: "Flores", locArea: "up-land", cls: "rural", vision: "A thriving and peaceful upland community.", mission: "To promote rural development and agricultural progress.", goals: "Enhance farming productivity and basic services.", objectives: "Build farm roads, water systems, and provide training.", logo: "https://i.ibb.co/7dgDBGsC/flores.png", lat: 13.051, lng: 123.444 },
  { brgyId: "pd-brgy-17", name: "La Medalla", locArea: "up-land", cls: "urban", vision: "A progressive upland urban barangay.", mission: "To deliver quality public services for all residents.", goals: "Improve infrastructure and community welfare.", objectives: "Construct roads, drainage, and livelihood facilities.", logo: "https://i.ibb.co/23kkhF17/la-medalla.png", lat: 13.039, lng: 123.452 },
  { brgyId: "pd-brgy-18", name: "Lawinon", locArea: "up-land", cls: "rural", vision: "A peaceful and productive upland community.", mission: "To promote agricultural growth and community unity.", goals: "Improve farm income and access to services.", objectives: "Provide seeds, training, and farm-to-market roads.", logo: "https://i.ibb.co/T57fjPV/lawinon.png", lat: 13.058, lng: 123.439 },
  { brgyId: "pd-brgy-19", name: "Macasitas", locArea: "up-land", cls: "rural", vision: "A self-sufficient upland farming community.", mission: "To uplift farmers and protect the environment.", goals: "Enhance agricultural productivity and rural welfare.", objectives: "Implement organic farming, reforestation, and training.", logo: "https://i.ibb.co/vCmb6Xn1/macasitas.png", lat: 13.033, lng: 123.436 },
  { brgyId: "pd-brgy-20", name: "Malapay", locArea: "up-land", cls: "rural", vision: "A thriving upland farming community.", mission: "To promote sustainable agriculture and community progress.", goals: "Improve rural economy and basic services.", objectives: "Support farmers, build roads, and deliver health services.", logo: "https://i.ibb.co/7NpJFRFb/malapay.png", lat: 13.037, lng: 123.433 },
  { brgyId: "pd-brgy-21", name: "Malidong", locArea: "coastal", cls: "rural", vision: "A resilient and peaceful coastal community.", mission: "To protect coastal resources and improve fisherfolk welfare.", goals: "Strengthen fisheries and disaster preparedness.", objectives: "Conduct mangrove planting, fishery training, and relief.", logo: "https://i.ibb.co/99Df4xDF/malidong.png", lat: 13.052, lng: 123.435 },
  { brgyId: "pd-brgy-22", name: "Mamlad", locArea: "up-land", cls: "rural", vision: "A productive and peaceful upland community.", mission: "To promote farming and rural development.", goals: "Enhance agricultural income and basic services.", objectives: "Provide farm support, training, and rural infrastructure.", logo: "https://i.ibb.co/7xM2ntRd/mamlad.png", lat: 13.018, lng: 123.436 },
  { brgyId: "pd-brgy-23", name: "Marigondon", locArea: "coastal", cls: "rural", vision: "A thriving coastal community with strong fisheries.", mission: "To develop sustainable coastal livelihood and welfare.", goals: "Improve fishery productivity and coastal protection.", objectives: "Implement coastal rehab, fishery support, and health programs.", logo: "https://i.ibb.co/99t3CqQn/marigondon.png", lat: 13.045, lng: 123.438 },
  { brgyId: "pd-brgy-24", name: "Matanglad", locArea: "up-land", cls: "rural", vision: "A progressive and united upland farming community.", mission: "To promote agricultural growth and community welfare.", goals: "Improve farm income and rural services.", objectives: "Distribute farm inputs, training, and infrastructure support.", logo: "https://i.ibb.co/cKctSV34/matanglad.png", lat: 13.064, lng: 123.46 },
  { brgyId: "pd-brgy-25", name: "Nablangbulod", locArea: "up-land", cls: "rural", vision: "A peaceful and productive upland barangay.", mission: "To uplift rural welfare through sustainable farming.", goals: "Enhance agriculture and community participation.", objectives: "Provide seeds, training, and basic social services.", logo: "https://i.ibb.co/cKVBDsnv/nablangbulod.png", lat: 13.064, lng: 123.432 },
  { brgyId: "pd-brgy-26", name: "Oringon", locArea: "up-land", cls: "rural", vision: "A self-reliant and progressive upland community.", mission: "To promote agriculture and rural development.", goals: "Improve farm productivity and access to services.", objectives: "Build roads, water systems, and livelihood programs.", logo: "https://i.ibb.co/k2BhfSSV/oringon.png", lat: 13.018, lng: 123.449 },
  { brgyId: "pd-brgy-27", name: "Palapas", locArea: "up-land", cls: "rural", vision: "A peaceful upland community with strong farming.", mission: "To develop sustainable agriculture and community welfare.", goals: "Increase farm income and basic services.", objectives: "Provide farm support, training, and infrastructure projects.", logo: "https://i.ibb.co/8n874CM2/palapas.png", lat: 13.04, lng: 123.443 },
  { brgyId: "pd-brgy-28", name: "Panganiran", locArea: "up-land", cls: "rural", vision: "A thriving and peaceful upland barangay.", mission: "To promote agricultural growth and community unity.", goals: "Enhance farm productivity and rural services.", objectives: "Conduct training, farm support, and road projects.", logo: "https://i.ibb.co/27k4K1Fc/panganiran.png", lat: 13.059, lng: 123.462 },
  { brgyId: "pd-brgy-29", name: "Rawis", locArea: "up-land", cls: "rural", vision: "A productive and self-sufficient upland community.", mission: "To promote farming and rural development.", goals: "Improve agricultural income and basic services.", objectives: "Provide seeds, training, and farm infrastructure.", logo: "https://i.ibb.co/KzFPqq9N/rawis.png", lat: 13.0345, lng: 123.447 },
  { brgyId: "pd-brgy-30", name: "Salvacion", locArea: "up-land", cls: "rural", vision: "A peaceful and progressive upland community.", mission: "To uplift rural welfare through agriculture and unity.", goals: "Enhance farming and community cooperation.", objectives: "Support farmers, build roads, and provide social services.", logo: "https://i.ibb.co/m5RHSkmJ/salvacion.png", lat: 13.057, lng: 123.446 },
  { brgyId: "pd-brgy-31", name: "Sto. Cristo", locArea: "up-land", cls: "rural", vision: "A faithful and progressive upland community.", mission: "To promote sustainable farming and community welfare.", goals: "Improve farm income and basic services.", objectives: "Provide farm inputs, health programs, and infrastructure.", logo: "https://i.ibb.co/fdn1s5sp/sto-cristo.png", lat: 13.026, lng: 123.43 },
  { brgyId: "pd-brgy-32", name: "Sukip", locArea: "up-land", cls: "rural", vision: "A peaceful and productive upland farming barangay.", mission: "To develop sustainable agriculture and community growth.", goals: "Increase farm productivity and rural welfare.", objectives: "Provide training, farm inputs, and basic services.", logo: "https://i.ibb.co/YTZmXp6D/sukip.png", lat: 13.043, lng: 123.428 },
  { brgyId: "pd-brgy-33", name: "Tibabo", locArea: "up-land", cls: "rural", vision: "A thriving and united upland community.", mission: "To promote agriculture and rural development.", goals: "Enhance farm income and basic services.", objectives: "Support farmers, build roads, and deliver health services.", logo: "https://i.ibb.co/7JZ0j6Vr/tibabo.png", lat: 13.0455, lng: 123.448 },
];

// ---------------------------------------------------------------------------
// REAL DATA — brgy_per_purok_profile (188 records)
// [brgyId, purokName, hh, extFam, fam, m, f, pop, elderM, elderF, elderTot, pwdM, pwdF, pwdTot, spM, spF, spTot, 4ps|null]
// ---------------------------------------------------------------------------

type PurokRow = [string, string, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number | null];

const PUROKS: PurokRow[] = [
  // Agol (pd-brgy-06)
  ["pd-brgy-06", "PUROK 1", 105, 2, 107, 175, 175, 350, 19, 21, 40, 0, 0, 0, 0, 2, 2, 37],
  ["pd-brgy-06", "PUROK 2", 175, 4, 175, 664, 336, 1000, 31, 49, 80, 5, 2, 7, 1, 3, 4, 67],
  ["pd-brgy-06", "PUROK 3", 80, 3, 83, 310, 150, 460, 20, 22, 42, 3, 1, 4, 0, 4, 4, 29],
  // Alabangpuro (pd-brgy-07)
  ["pd-brgy-07", "Macitrus", 74, 15, 89, 157, 134, 291, 12, 13, 25, 4, 2, 6, 0, 2, 2, 14],
  ["pd-brgy-07", "Lumang Pavillion", 63, 18, 81, 152, 146, 298, 12, 12, 24, 5, 5, 10, 2, 3, 5, 24],
  ["pd-brgy-07", "Centro", 65, 21, 86, 141, 122, 263, 13, 15, 28, 8, 1, 9, 4, 9, 13, 20],
  ["pd-brgy-07", "Kurbada", 50, 14, 64, 109, 107, 216, 8, 7, 15, 1, 1, 2, 3, 3, 6, 14],
  // Banawan (pd-brgy-08)
  ["pd-brgy-08", "Rizal", 109, 5, 132, 171, 187, 358, 12, 26, 38, 2, 2, 4, 2, 8, 10, 7],
  ["pd-brgy-08", "Sto. Niño", 116, 13, 115, 213, 223, 436, 16, 25, 41, 4, 4, 8, 2, 6, 8, 33],
  ["pd-brgy-08", "Rose", 34, 3, 46, 82, 79, 161, 6, 9, 15, 1, 2, 3, 0, 2, 2, 7],
  ["pd-brgy-08", "New Road", 20, 4, 31, 45, 40, 85, 4, 4, 8, 2, 1, 3, 1, 1, 2, 6],
  ["pd-brgy-08", "Dalupapa", 96, 2, 123, 222, 196, 418, 20, 15, 35, 1, 2, 3, 2, 1, 1, 3],
  ["pd-brgy-08", "Islawter", 86, 6, 110, 175, 185, 360, 15, 18, 33, 4, 5, 9, 0, 1, 1, 8],
  ["pd-brgy-08", "Manga", 72, 10, 100, 150, 160, 310, 10, 15, 25, 1, 2, 3, 3, 5, 8, 19],
  ["pd-brgy-08", "Busilak", 172, 5, 216, 307, 407, 714, 26, 28, 54, 2, 3, 5, 0, 10, 10, 45],
  ["pd-brgy-08", "Lagaan", 178, 37, 196, 409, 409, 918, 37, 39, 76, 6, 7, 13, 5, 11, 16, 68],
  // Barangay I (pd-brgy-01)
  ["pd-brgy-01", "PUROK 1", 146, 17, 163, 347, 328, 675, 30, 27, 57, 4, 5, 9, 0, 4, 4, 53],
  ["pd-brgy-01", "PUROK 2", 117, 13, 130, 261, 269, 530, 23, 34, 57, 5, 2, 7, 1, 5, 6, 35],
  ["pd-brgy-01", "PUROK 3", 194, 31, 225, 496, 414, 910, 36, 42, 78, 5, 10, 15, 0, 7, 7, 80],
  ["pd-brgy-01", "PUROK 4", 148, 23, 171, 306, 354, 660, 25, 37, 62, 9, 4, 13, 0, 11, 11, 47],
  ["pd-brgy-01", "PUROK 5", 210, 27, 237, 515, 518, 1033, 32, 39, 71, 8, 6, 15, 0, 7, 7, 44],
  ["pd-brgy-01", "PUROK 6", 180, 18, 198, 398, 391, 789, 27, 29, 56, 5, 2, 7, 0, 3, 3, 56],
  ["pd-brgy-01", "PUROK 7", 93, 10, 104, 195, 184, 379, 14, 16, 30, 2, 2, 4, 0, 3, 3, 19],
  // Barangay II (pd-brgy-02)
  ["pd-brgy-02", "PUROK 1", 46, 3, 49, 117, 116, 233, 7, 14, 21, 6, 4, 10, 0, 6, 6, 15],
  ["pd-brgy-02", "PUROK 2", 51, 7, 58, 140, 113, 253, 8, 14, 22, 4, 6, 10, 2, 2, 4, 19],
  ["pd-brgy-02", "PUROK 3", 51, 10, 61, 89, 97, 186, 8, 17, 25, 10, 4, 14, 0, 5, 5, 15],
  ["pd-brgy-02", "PUROK 4", 50, 12, 62, 125, 125, 250, 7, 20, 27, 7, 9, 16, 2, 2, 4, 22],
  ["pd-brgy-02", "PUROK 5", 55, 11, 66, 137, 136, 273, 14, 10, 24, 8, 2, 10, 0, 4, 4, 15],
  ["pd-brgy-02", "PUROK 6", 52, 19, 71, 159, 172, 33, 5, 17, 22, 3, 3, 6, 0, 4, 4, 4],
  // Barangay III (pd-brgy-03)
  ["pd-brgy-03", "Timon-timon", 35, 5, 40, 79, 84, 163, 10, 9, 19, 3, 0, 3, 1, 0, 1, 10],
  ["pd-brgy-03", "Bangus", 51, 2, 53, 112, 115, 227, 14, 23, 37, 7, 4, 11, 0, 9, 9, 4],
  ["pd-brgy-03", "Mayamaya", 50, 6, 56, 124, 123, 247, 14, 19, 33, 5, 3, 8, 1, 1, 2, 5],
  ["pd-brgy-03", "Bangkulis", 31, 0, 31, 53, 61, 114, 11, 13, 24, 2, 2, 4, 0, 0, 0, 1],
  ["pd-brgy-03", "Goldfish", 38, 0, 38, 64, 53, 117, 13, 10, 23, 1, 1, 1, 0, 0, 0, 1],
  ["pd-brgy-03", "Lapulapu", 24, 0, 24, 64, 54, 118, 2, 3, 5, 1, 1, 1, 1, 1, 1, 10],
  // Barangay IV (pd-brgy-04)
  ["pd-brgy-04", "Waterlily", 48, 7, 55, 121, 81, 202, 15, 17, 32, 5, 5, 10, 2, 2, 4, 11],
  ["pd-brgy-04", "Rose", 71, 5, 76, 150, 132, 282, 14, 9, 23, 4, 5, 9, 2, 2, 4, 28],
  ["pd-brgy-04", "Rosal", 72, 27, 101, 139, 145, 284, 19, 22, 41, 8, 1, 9, 3, 10, 13, 20],
  ["pd-brgy-04", "Sampaguita", 46, 1, 47, 68, 80, 148, 5, 7, 12, 1, 2, 3, 1, 4, 5, 9],
  ["pd-brgy-04", "Sunflower", 54, 7, 61, 119, 112, 231, 9, 14, 33, 4, 2, 6, 3, 8, 11, 20],
  ["pd-brgy-04", "Gumamela", 48, 7, 55, 77, 94, 171, 9, 9, 18, 1, 2, 3, 0, 6, 6, 8],
  ["pd-brgy-04", "Orchids", 91, 15, 106, 190, 182, 372, 11, 15, 26, 11, 7, 18, 2, 6, 8, 30],
  // Barangay V (pd-brgy-05)
  ["pd-brgy-05", "PUROK 1", 86, 10, 76, 212, 180, 392, 68, 65, 133, 6, 3, 9, 2, 4, 6, 46],
  ["pd-brgy-05", "PUROK 2", 76, 8, 68, 149, 142, 291, 42, 49, 91, 2, 2, 4, 3, 2, 5, 23],
  ["pd-brgy-05", "PUROK 3", 48, 10, 38, 111, 110, 221, 5, 18, 23, 2, 0, 2, 6, 1, 7, 17],
  ["pd-brgy-05", "PUROK 4", 65, 15, 50, 123, 143, 266, 14, 20, 34, 5, 8, 13, 4, 2, 6, 36],
  ["pd-brgy-05", "PUROK 5", 44, 7, 37, 89, 100, 189, 12, 15, 27, 2, 1, 3, 2, 0, 2, 15],
  ["pd-brgy-05", "PUROK 6", 67, 6, 61, 142, 129, 271, 9, 11, 20, 2, 2, 4, 6, 3, 9, 27],
  ["pd-brgy-05", "PUROK 7", 164, 122, 171, 225, 325, 550, 14, 22, 36, 1, 2, 3, 11, 7, 18, 81],
  // Basicao Coastal (pd-brgy-09)
  ["pd-brgy-09", "Zone1", 92, 9, 111, 215, 210, 425, 13, 21, 34, 4, 4, 8, 4, 4, 8, 28],
  ["pd-brgy-09", "Tinago", 70, 16, 86, 196, 175, 371, 10, 12, 22, 1, 2, 3, 1, 2, 3, 33],
  ["pd-brgy-09", "Centro", 50, 15, 65, 136, 125, 261, 10, 21, 31, 1, 2, 3, 0, 5, 0, 19],
  ["pd-brgy-09", "Puro", 67, 7, 74, 147, 126, 273, 11, 11, 22, 2, 0, 2, 1, 1, 2, 27],
  ["pd-brgy-09", "Sabang", 74, 4, 78, 181, 148, 329, 8, 13, 21, 6, 2, 8, 1, 2, 3, 34],
  ["pd-brgy-09", "Miligan", 108, 4, 112, 213, 223, 436, 19, 22, 41, 4, 3, 7, 0, 1, 1, 45],
  ["pd-brgy-09", "Upland", 80, 7, 87, 231, 209, 440, 7, 8, 15, 0, 1, 1, 1, 1, 2, 50],
  // Basicao Interior (pd-brgy-10)
  ["pd-brgy-10", "PUROK 1", 24, 4, 28, 67, 49, 116, 29, 34, 63, 2, 0, 2, 0, 1, 1, 11],
  ["pd-brgy-10", "PUROK 2", 25, 2, 28, 57, 53, 110, 21, 23, 44, 1, 1, 2, 2, 3, 5, 12],
  ["pd-brgy-10", "PUROK 3", 25, 3, 25, 54, 41, 95, 21, 21, 42, 2, 0, 2, 0, 2, 2, 9],
  ["pd-brgy-10", "PUROK 4", 19, 6, 24, 52, 50, 102, 23, 24, 47, 1, 3, 4, 2, 5, 7, 8],
  ["pd-brgy-10", "PUROK 5", 14, 0, 14, 24, 22, 46, 13, 13, 26, 5, 0, 5, 0, 3, 3, 4],
  ["pd-brgy-10", "PUROK 6", 19, 3, 25, 37, 43, 80, 22, 2, 24, 0, 1, 1, 1, 2, 3, 8],
  ["pd-brgy-10", "PUROK 7", 29, 1, 32, 64, 63, 127, 31, 33, 64, 0, 1, 1, 1, 0, 1, 13],
  // Binodegahan (pd-brgy-11)
  ["pd-brgy-11", "PUROK 1", 98, 5, 103, 250, 206, 456, 12, 25, 37, 2, 1, 3, 3, 4, 7, 28],
  ["pd-brgy-11", "PUROK 2", 105, 10, 115, 220, 230, 450, 10, 28, 38, 3, 2, 5, 1, 6, 7, 36],
  ["pd-brgy-11", "PUROK 3", 95, 7, 102, 245, 204, 449, 15, 30, 45, 5, 2, 7, 1, 3, 4, 31],
  ["pd-brgy-11", "PUROK 4", 112, 12, 124, 265, 248, 513, 28, 30, 58, 5, 6, 11, 1, 6, 7, 33],
  ["pd-brgy-11", "PUROK 5", 85, 10, 95, 240, 190, 430, 13, 1, 28, 3, 6, 9, 0, 4, 4, 14],
  ["pd-brgy-11", "PUROK 6", 106, 13, 119, 238, 250, 488, 25, 32, 7, 1, 3, 4, 2, 0, 2, 42],
  ["pd-brgy-11", "PUROK 7", 95, 10, 105, 210, 215, 425, 15, 20, 35, 6, 4, 10, 2, 3, 5, 28],
  // Buenavista (pd-brgy-12)
  ["pd-brgy-12", "PUROK 1", 24, 4, 28, 30, 33, 63, 17, 12, 29, 2, 2, 4, 0, 2, 2, 8],
  ["pd-brgy-12", "PUROK 2", 35, 7, 42, 57, 51, 108, 25, 27, 52, 0, 0, 0, 0, 1, 1, 13],
  ["pd-brgy-12", "PUROK 3", 75, 16, 90, 101, 116, 217, 76, 70, 146, 3, 3, 6, 4, 4, 8, 0],
  ["pd-brgy-12", "PUROK 4", 43, 8, 49, 109, 100, 209, 35, 45, 80, 2, 0, 2, 0, 1, 1, 19],
  ["pd-brgy-12", "PUROK 5", 39, 7, 46, 101, 77, 178, 39, 26, 65, 1, 2, 3, 0, 1, 1, 11],
  ["pd-brgy-12", "PUROK 6", 19, 3, 22, 31, 23, 54, 24, 15, 39, 1, 1, 2, 0, 2, 2, 8],
  ["pd-brgy-12", "PUROK 7", 42, 9, 51, 124, 103, 227, 62, 41, 103, 1, 0, 1, 3, 2, 5, 21],
  // Buyo (pd-brgy-13)
  ["pd-brgy-13", "PUROK 1", 62, 4, 72, 181, 175, 356, 8, 10, 18, 6, 5, 11, 2, 2, 4, 26],
  ["pd-brgy-13", "PUROK 2", 39, 3, 41, 98, 85, 183, 9, 9, 16, 1, 2, 3, 2, 2, 3, 13],
  ["pd-brgy-13", "PUROK 3", 9, 3, 10, 20, 24, 44, 1, 1, 1, 0, 3, 3, 3, 1, 2, 9],
  // Caratagan (pd-brgy-14)
  ["pd-brgy-14", "PUROK 1", 96, 27, 123, 205, 206, 411, 14, 26, 40, 6, 3, 9, 7, 3, 10, 9],
  ["pd-brgy-14", "PUROK 2", 260, 26, 286, 564, 577, 1141, 51, 62, 113, 19, 13, 32, 11, 8, 19, 45],
  ["pd-brgy-14", "Lantad", 212, 35, 247, 482, 461, 943, 39, 35, 74, 5, 10, 15, 6, 4, 10, 85],
  ["pd-brgy-14", "PUROK 4", 112, 12, 124, 227, 245, 472, 29, 43, 72, 5, 7, 12, 3, 1, 4, 12],
  ["pd-brgy-14", "Riverside", 88, 12, 100, 173, 184, 357, 16, 32, 48, 8, 2, 10, 4, 2, 6, 17],
  ["pd-brgy-14", "PUROK 6", 140, 18, 158, 312, 291, 603, 32, 31, 63, 6, 6, 12, 9, 3, 12, 41],
  ["pd-brgy-14", "7-CSAP", 368, 46, 414, 859, 850, 1709, 46, 73, 119, 11, 10, 21, 12, 8, 20, 120],
  // Cuyaoyao (pd-brgy-15)
  ["pd-brgy-15", "PUROK 1", 144, 10, 154, 332, 303, 635, 36, 41, 77, 1, 5, 6, 1, 10, 11, 38],
  ["pd-brgy-15", "PUROK 2", 62, 6, 68, 118, 146, 264, 15, 10, 25, 0, 2, 2, 1, 4, 5, 15],
  ["pd-brgy-15", "PUROK 3", 80, 0, 80, 161, 179, 340, 18, 18, 36, 3, 0, 3, 0, 1, 1, 18],
  ["pd-brgy-15", "PUROK 4", 139, 0, 139, 296, 266, 562, 23, 27, 50, 3, 2, 5, 0, 2, 2, 31],
  ["pd-brgy-15", "PUROK 5", 89, 0, 89, 187, 189, 376, 14, 12, 26, 1, 1, 2, 0, 1, 1, 21],
  // Flores (pd-brgy-16)
  ["pd-brgy-16", "Sumoknong", 62, 6, 68, 151, 126, 354, 2, 6, 17, 1, 0, 2, 0, 3, 3, 27],
  ["pd-brgy-16", "Centro", 63, 6, 71, 178, 156, 303, 11, 8, 14, 2, 1, 3, 0, 1, 1, 22],
  ["pd-brgy-16", "Kagungcungan", 29, 0, 33, 56, 69, 113, 3, 7, 15, 0, 2, 1, 0, 2, 2, 10],
  ["pd-brgy-16", "Tinago", 26, 1, 27, 34, 64, 107, 5, 4, 14, 0, 1, 3, 0, 0, 0, 9],
  ["pd-brgy-16", "Binangkuan", 57, 5, 65, 161, 207, 322, 8, 4, 16, 2, 2, 3, 0, 3, 3, 35],
  ["pd-brgy-16", "Rawis", 41, 5, 49, 99, 115, 212, 6, 5, 11, 3, 1, 3, 0, 1, 1, 17],
  ["pd-brgy-16", "Ologon", 45, 3, 50, 119, 126, 250, 5, 7, 11, 3, 2, 2, 0, 4, 4, 26],
  // La Medalla (pd-brgy-17)
  ["pd-brgy-17", "PUROK 1", 106, 9, 112, 239, 240, 479, 14, 25, 39, 2, 3, 5, 0, 4, 4, 32],
  ["pd-brgy-17", "PUROK 2", 76, 10, 86, 165, 155, 320, 11, 17, 28, 3, 1, 4, 3, 4, 7, 18],
  ["pd-brgy-17", "PUROK 3", 90, 13, 102, 195, 188, 383, 18, 15, 33, 2, 2, 4, 0, 3, 3, 29],
  ["pd-brgy-17", "PUROK 4", 97, 6, 103, 199, 185, 384, 12, 22, 34, 2, 1, 3, 4, 2, 6, 33],
  ["pd-brgy-17", "PUROK 5", 72, 8, 76, 173, 154, 327, 16, 15, 31, 2, 2, 4, 2, 4, 6, 30],
  ["pd-brgy-17", "PUROK 6", 21, 4, 25, 59, 53, 112, 3, 4, 7, 1, 1, 2, 1, 3, 4, 12],
  ["pd-brgy-17", "PUROK 7", 69, 13, 81, 148, 149, 297, 22, 14, 36, 3, 3, 6, 2, 2, 4, 17],
  // Lawinon (pd-brgy-18)
  ["pd-brgy-18", "PUROK 1", 73, 14, 87, 235, 204, 439, 0, 9, 9, 6, 5, 11, 1, 5, 6, 44],
  ["pd-brgy-18", "PUROK 2", 118, 6, 117, 263, 253, 516, 20, 20, 40, 9, 9, 18, 3, 8, 9, 56],
  ["pd-brgy-18", "Batbat", 74, 10, 84, 211, 174, 385, 6, 6, 18, 3, 4, 7, 1, 2, 3, 40],
  ["pd-brgy-18", "Sitio Lada", 64, 2, 66, 138, 147, 281, 11, 11, 18, 2, 1, 3, 0, 1, 1, 21],
  // Macasitas (pd-brgy-19)
  ["pd-brgy-19", "Iraya", 24, 0, 28, 44, 48, 92, 5, 6, 11, 0, 0, 0, 0, 0, 0, 14],
  ["pd-brgy-19", "Centro", 59, 0, 75, 163, 128, 291, 7, 13, 20, 3, 0, 3, 0, 0, 0, 14],
  ["pd-brgy-19", "Junior", 36, 0, 36, 73, 67, 140, 5, 7, 12, 3, 2, 5, 0, 0, 0, 14],
  ["pd-brgy-19", "Bagagong", 19, 0, 20, 31, 35, 66, 3, 4, 7, 0, 0, 0, 0, 0, 0, 18],
  // Malapay (pd-brgy-20)
  ["pd-brgy-20", "PUROK 1", 76, 8, 83, 191, 168, 359, 15, 18, 33, 2, 2, 4, 1, 2, 3, 30],
  ["pd-brgy-20", "PUROK 2", 45, 6, 52, 96, 95, 191, 12, 14, 26, 2, 0, 2, 1, 1, 2, 9],
  ["pd-brgy-20", "PUROK 3", 83, 7, 90, 183, 181, 364, 13, 22, 35, 5, 3, 8, 0, 4, 4, 27],
  ["pd-brgy-20", "PUROK 4", 66, 4, 70, 136, 120, 256, 11, 16, 27, 3, 3, 6, 0, 8, 3, 22],
  // Malidong (pd-brgy-21)
  ["pd-brgy-21", "P-1 Cagbatano", 106, 27, 134, 249, 249, 498, 24, 27, 51, 4, 0, 4, 2, 5, 7, 56],
  ["pd-brgy-21", "P-2 Cagbatano", 80, 10, 89, 178, 162, 340, 20, 18, 38, 3, 2, 5, 0, 5, 5, 41],
  ["pd-brgy-21", "P-3 Cagbatano", 80, 12, 93, 168, 166, 334, 13, 18, 31, 2, 0, 2, 0, 2, 2, 23],
  ["pd-brgy-21", "P-4 Cagbatano", 23, 8, 31, 62, 67, 129, 4, 6, 10, 0, 1, 1, 1, 1, 2, 19],
  ["pd-brgy-21", "P-1 Malidong", 59, 6, 63, 126, 112, 238, 16, 13, 29, 0, 0, 0, 0, 0, 0, 38],
  ["pd-brgy-21", "P-2 Malidong", 31, 7, 37, 90, 73, 163, 6, 3, 9, 3, 0, 3, 0, 1, 1, 35],
  ["pd-brgy-21", "P-3 Malidong", 45, 14, 54, 136, 120, 256, 5, 9, 14, 2, 2, 4, 1, 1, 2, 30],
  ["pd-brgy-21", "P-4 Malidong", 65, 5, 64, 159, 178, 337, 5, 8, 13, 0, 0, 0, 1, 1, 2, 70],
  // Mamlad (pd-brgy-22)
  ["pd-brgy-22", "PUROK 1", 29, 0, 29, 64, 59, 123, 2, 3, 5, 0, 1, 1, 1, 2, 3, 14],
  ["pd-brgy-22", "PUROK 2", 14, 0, 14, 27, 21, 48, 2, 2, 4, 0, 0, 0, 1, 1, 2, 6],
  ["pd-brgy-22", "PUROK 3", 41, 0, 41, 93, 87, 180, 9, 5, 14, 3, 0, 3, 2, 3, 5, 20],
  ["pd-brgy-22", "PUROK 4", 15, 0, 15, 39, 32, 71, 5, 1, 6, 0, 2, 2, 0, 2, 2, 6],
  ["pd-brgy-22", "PUROK 5", 22, 0, 22, 56, 36, 92, 2, 2, 4, 0, 0, 0, 4, 0, 4, 9],
  // Marigondon (pd-brgy-23)
  ["pd-brgy-23", "PUROK 1", 125, 12, 144, 252, 232, 484, 16, 27, 43, 8, 3, 11, 1, 3, 4, 21],
  ["pd-brgy-23", "PUROK 2", 91, 8, 112, 229, 200, 429, 25, 26, 51, 5, 2, 7, 0, 5, 5, 20],
  ["pd-brgy-23", "PUROK 3", 69, 9, 82, 186, 169, 335, 14, 19, 33, 4, 1, 5, 0, 5, 5, 22],
  ["pd-brgy-23", "PUROK 4", 70, 11, 88, 181, 152, 333, 9, 11, 20, 1, 6, 7, 1, 1, 2, 18],
  // Matanglad (pd-brgy-24)
  ["pd-brgy-24", "PUROK 1", 46, 0, 46, 92, 92, 184, 2, 7, 14, 2, 0, 2, 0, 1, 1, 9],
  ["pd-brgy-24", "PUROK 2", 40, 0, 40, 79, 75, 154, 8, 11, 19, 2, 3, 5, 0, 0, 0, 14],
  ["pd-brgy-24", "PUROK 3", 26, 2, 28, 79, 78, 157, 6, 6, 10, 3, 0, 3, 2, 0, 2, 12],
  ["pd-brgy-24", "PUROK 4", 19, 5, 24, 48, 40, 88, 2, 3, 5, 2, 0, 2, 1, 1, 2, 6],
  ["pd-brgy-24", "PUROK 5", 21, 1, 22, 44, 43, 87, 6, 5, 11, 1, 2, 3, 0, 1, 1, 6],
  ["pd-brgy-24", "PUROK 6", 35, 0, 35, 77, 73, 150, 9, 6, 15, 0, 1, 1, 0, 0, 0, 12],
  ["pd-brgy-24", "PUROK 7", 23, 1, 24, 54, 39, 93, 2, 2, 4, 0, 2, 2, 0, 1, 1, 10],
  // Nablangbulod (pd-brgy-25)
  ["pd-brgy-25", "PUROK 1", 51, 1, 52, 109, 96, 205, 16, 10, 26, 0, 1, 1, 0, 0, 0, 20],
  ["pd-brgy-25", "PUROK 2", 65, 2, 67, 153, 116, 269, 8, 14, 22, 3, 1, 4, 0, 4, 4, 23],
  ["pd-brgy-25", "PUROK 3", 29, 0, 29, 53, 56, 109, 6, 8, 14, 0, 0, 0, 0, 1, 1, 18],
  ["pd-brgy-25", "PUROK 4", 45, 0, 45, 97, 85, 182, 4, 6, 10, 0, 0, 0, 1, 0, 1, 21],
  // Oringon (pd-brgy-26)
  ["pd-brgy-26", "PUROK 1", 76, 11, 87, 220, 398, 398, 15, 12, 27, 2, 3, 5, 4, 4, 8, 67],
  ["pd-brgy-26", "PUROK 2", 38, 3, 41, 87, 168, 168, 6, 7, 13, 1, 1, 2, 1, 1, 2, null],
  ["pd-brgy-26", "PUROK 3", 27, 0, 27, 58, 103, 103, 9, 10, 19, 0, 0, 3, 0, 1, 1, null],
  // Palapas (pd-brgy-27)
  ["pd-brgy-27", "Centro", 91, 16, 107, 209, 189, 398, 14, 18, 32, 1, 1, 2, 2, 3, 5, 18],
  ["pd-brgy-27", "Pantay", 34, 8, 42, 80, 72, 152, 7, 8, 15, 1, 1, 2, 0, 0, 0, 6],
  ["pd-brgy-27", "Garcia", 64, 11, 75, 137, 147, 284, 5, 7, 12, 0, 1, 1, 0, 2, 2, 13],
  ["pd-brgy-27", "Kurbada", 93, 30, 123, 199, 224, 423, 17, 26, 43, 2, 2, 4, 0, 3, 3, 24],
  ["pd-brgy-27", "Layon", 26, 1, 27, 56, 54, 110, 5, 3, 8, 0, 2, 2, 1, 0, 1, 9],
  ["pd-brgy-27", "Papantayan 1", 20, 1, 21, 35, 36, 71, 4, 5, 9, 0, 0, 0, 0, 0, 0, 5],
  ["pd-brgy-27", "Papantayan 2", 30, 3, 33, 67, 68, 135, 5, 4, 9, 0, 0, 0, 0, 1, 1, 10],
  // Panganiran (pd-brgy-28)
  ["pd-brgy-28", "PUROK 1", 21, 0, 21, 41, 41, 82, 3, 4, 7, 1, 1, 2, 0, 0, 0, 9],
  ["pd-brgy-28", "PUROK 2", 20, 0, 20, 40, 37, 77, 3, 3, 6, 1, 1, 2, 0, 2, 2, 4],
  ["pd-brgy-28", "PUROK 3", 10, 1, 11, 21, 24, 45, 2, 2, 4, 0, 1, 1, 0, 1, 1, 3],
  ["pd-brgy-28", "PUROK 4", 61, 6, 67, 140, 125, 265, 12, 10, 22, 0, 4, 4, 1, 2, 3, 31],
  ["pd-brgy-28", "PUROK 5", 18, 2, 20, 37, 38, 75, 2, 3, 5, 0, 1, 1, 0, 1, 1, 8],
  ["pd-brgy-28", "PUROK 6", 15, 0, 15, 23, 24, 47, 3, 3, 6, 1, 3, 3, 1, 1, 2, 6],
  ["pd-brgy-28", "PUROK 7", 17, 0, 17, 34, 21, 55, 4, 4, 8, 0, 0, 0, 0, 0, 0, 3],
  // Rawis (pd-brgy-29)
  ["pd-brgy-29", "PUROK 1", 88, 11, 99, 202, 173, 375, 10, 17, 27, 1, 1, 2, 0, 1, 1, 29],
  ["pd-brgy-29", "PUROK 2", 52, 9, 61, 120, 109, 229, 10, 13, 23, 1, 3, 4, 0, 0, 0, 18],
  ["pd-brgy-29", "PUROK 3", 28, 4, 32, 63, 72, 135, 4, 3, 7, 0, 1, 1, 0, 0, 3, 5],
  ["pd-brgy-29", "PUROK 4", 40, 6, 46, 91, 107, 198, 6, 7, 13, 0, 1, 1, 1, 3, 1, 12],
  ["pd-brgy-29", "PUROK 5", 33, 2, 35, 83, 87, 170, 7, 9, 16, 1, 2, 3, 0, 2, 2, 10],
  // Salvacion (pd-brgy-30)
  ["pd-brgy-30", "PUROK 1A", 42, 3, 45, 103, 98, 201, 6, 9, 14, 1, 0, 1, 1, 4, 5, 14],
  ["pd-brgy-30", "PUROK 1B", 24, 3, 27, 50, 94, 144, 4, 5, 9, 0, 1, 1, 0, 1, 1, 3],
  ["pd-brgy-30", "PUROK 2", 26, 3, 29, 49, 44, 93, 3, 4, 7, 1, 0, 1, 0, 1, 1, 6],
  ["pd-brgy-30", "PUROK 3 & 4", 25, 3, 28, 37, 24, 61, 6, 2, 8, 0, 0, 0, 0, 0, 0, 4],
  ["pd-brgy-30", "PUROK 5", 15, 2, 17, 47, 38, 85, 2, 1, 3, 2, 2, 4, 0, 1, 1, 5],
  ["pd-brgy-30", "PUROK 6A", 30, 3, 33, 78, 57, 135, 2, 7, 9, 1, 0, 1, 3, 3, 6, 12],
  ["pd-brgy-30", "PUROK 6B", 8, 1, 9, 36, 40, 76, 0, 1, 1, 0, 0, 0, 0, 0, 0, 2],
  // Sto. Cristo (pd-brgy-31)
  ["pd-brgy-31", "PUROK 1", 14, 1, 13, 22, 14, 36, 5, 4, 9, 0, 1, 0, 0, 0, 0, 4],
  ["pd-brgy-31", "PUROK 2", 24, 1, 26, 51, 48, 99, 2, 5, 7, 0, 1, 0, 0, 0, 0, 10],
  ["pd-brgy-31", "PUROK 3", 52, 5, 58, 139, 109, 248, 12, 12, 24, 2, 3, 0, 0, 0, 0, 30],
  ["pd-brgy-31", "PUROK 4", 37, 4, 41, 72, 69, 140, 7, 5, 12, 4, 0, 0, 0, 0, 0, 15],
  // Sukip (pd-brgy-32)
  ["pd-brgy-32", "Paray", 32, 0, 35, 79, 75, 154, 22, 25, 47, 0, 0, 0, 0, 4, 4, 14],
  ["pd-brgy-32", "Lada", 64, 1, 65, 158, 127, 285, 55, 46, 101, 2, 1, 3, 1, 1, 2, 30],
  ["pd-brgy-32", "Mais", 59, 1, 60, 60, 75, 141, 63, 58, 121, 3, 3, 6, 2, 2, 4, 27],
  ["pd-brgy-32", "Bawang", 65, 0, 65, 143, 122, 265, 70, 78, 148, 3, 1, 4, 2, 2, 4, 26],
  ["pd-brgy-32", "Kamote", 31, 0, 31, 56, 54, 110, 16, 18, 34, 1, 0, 1, 1, 1, 2, 11],
  // Tibabo (pd-brgy-33)
  ["pd-brgy-33", "PUROK 1", 48, 0, 48, 114, 111, 225, 8, 13, 21, 2, 4, 6, 0, 2, 2, 20],
  ["pd-brgy-33", "PUROK 2", 48, 0, 48, 94, 114, 208, 7, 8, 15, 3, 3, 6, 0, 1, 1, 14],
  ["pd-brgy-33", "PUROK 3", 67, 0, 67, 135, 146, 281, 13, 16, 29, 1, 0, 1, 1, 2, 3, 21],
  ["pd-brgy-33", "PUROK 4", 23, 0, 23, 49, 41, 90, 2, 13, 15, 0, 1, 1, 0, 1, 1, null],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** pd-brgy-06 → PD-BRG-006 */
function officialCode(brgyId: string): string {
  const n = Number(brgyId.replace(/\D/g, ""));
  return `PD-BRG-${String(n).padStart(3, "0")}`;
}

/** Normalize dump barangay name → DB name ("Sto. Cristo" → "Santo Cristo"). */
function normalizeName(name: string): string {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (n === "sto. cristo" || n === "sto cristo" || n === "santo-cristo") return "santo cristo";
  return n;
}

/** Display-friendly purok name: "PUROK 3 & 4" → "Purok 3 & 4", "Zone1" → "Zone 1". */
function prettyPurokName(raw: string): string {
  let name = raw.trim().replace(/\s+/g, " ");
  name = name.replace(/^purok\s+/i, (m) => "Purok ");
  name = name.replace(/^zone(\d)$/i, "Zone $1");
  return name;
}

const UPLOADS_DIR = path.join(process.cwd(), "db", "storage", "uploads");

/** Recursively rename every folder named `from` to `to` under UPLOADS_DIR (depth-first). */
async function renameFolders(from: string, to: string): Promise<number> {
  let renamed = 0;
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      if (e.isDirectory() && e.name === from) {
        await fs.rename(full, path.join(dir, to));
        renamed += 1;
      }
    }
  }
  await walk(UPLOADS_DIR);
  return renamed;
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

async function main() {
  const barangays = await db.barangay.findMany();
  console.log(`Loaded ${barangays.length} barangays, ${PROFILES.length} real profiles, ${PUROKS.length} real purok rows.`);

  // --- 1. Match profiles to DB rows by normalized name -----------------------
  const byName = new Map(barangays.map((b) => [normalizeName(b.name), b]));
  const matches = PROFILES.map((p) => {
    const row = byName.get(normalizeName(p.name));
    if (!row) throw new Error(`No DB barangay matches dump entry "${p.name}" (${p.brgyId})`);
    return { profile: p, row };
  });
  if (new Set(matches.map((m) => m.row.id)).size !== 33) throw new Error("Duplicate barangay match — aborting.");
  console.log("✓ All 33 profiles matched to DB barangays by name.");

  const newCodeById = new Map(matches.map((m) => [m.row.id, officialCode(m.profile.brgyId)]));

  // --- 2. Purok rows grouped by official brgy id -----------------------------
  const puroksByBrgyId = new Map<string, PurokRow[]>();
  for (const r of PUROKS) {
    const list = puroksByBrgyId.get(r[0]) ?? [];
    list.push(r);
    puroksByBrgyId.set(r[0], list);
  }

  // --- 3. Replace puroks + demographics (real data) ---------------------------
  const deleted = await db.purok.deleteMany({});
  console.log(`✓ Deleted ${deleted.count} old (seed) puroks.`);
  let purokCount = 0;
  for (const { profile, row } of matches) {
    const rows = puroksByBrgyId.get(profile.brgyId) ?? [];
    let order = 0;
    for (const r of rows) {
      const [, rawName, hh, extFam, fam, m, f, pop, eM, eF, eT, pM, pF, pT, sM, sF, sT, fourPs] = r;
      await db.purok.create({
        data: {
          barangayId: row.id,
          code: `${officialCode(profile.brgyId)}-P${String(++order).padStart(2, "0")}`,
          name: prettyPurokName(rawName),
          zoneLeader: null,
          order: order - 1,
          active: true,
          demographics: {
            create: {
              households: hh,
              families: fam,
              population: pop,
              male: m,
              female: f,
              age60plus: eT,
              pwd: pT,
              soloParents: sT,
              extendedFamilies: extFam,
              seniorMale: eM,
              seniorFemale: eF,
              pwdMale: pM,
              pwdFemale: pF,
              soloParentMale: sM,
              soloParentFemale: sF,
              fourPs,
            },
          },
        },
      });
      purokCount += 1;
    }
  }
  console.log(`✓ Inserted ${purokCount} real puroks with demographics.`);

  // --- 4. Update barangay profiles: VMG, logo, recomputed totals --------------
  for (const { profile, row } of matches) {
    const rows = puroksByBrgyId.get(profile.brgyId) ?? [];
    const sum = (i: number) => rows.reduce((a, r) => a + (r[i] as number), 0);
    const population = sum(7);
    const households = sum(2);
    await db.barangay.update({
      where: { id: row.id },
      data: {
        vision: profile.vision,
        mission: profile.mission,
        goals: profile.goals,
        objectives: profile.objectives,
        logoUrl: profile.logo,
        population,
        households,
        puroks: rows.length,
      },
    });
    // Boundary: real coordinates + classification
    await db.barangayBoundary.upsert({
      where: { barangayId: row.id },
      create: {
        barangayId: row.id,
        latitude: profile.lat,
        longitude: profile.lng,
        coastal: profile.locArea === "coastal",
        upland: profile.locArea === "up-land",
        urban: profile.cls === "urban",
      },
      update: {
        latitude: profile.lat,
        longitude: profile.lng,
        coastal: profile.locArea === "coastal",
        upland: profile.locArea === "up-land",
        urban: profile.cls === "urban",
      },
    });
    // Reported subtotal (2026): real sums; fabricated figures zeroed
    const seniors = sum(10);
    const pwd = sum(13);
    const male = sum(5);
    const female = sum(6);
    const families = sum(4);
    const soloParents = sum(16);
    await db.barangayReportedSubtotal.upsert({
      where: { barangayId_year: { barangayId: row.id, year: 2026 } },
      create: {
        barangayId: row.id,
        year: 2026,
        population,
        households,
        families,
        purokCount: rows.length,
        male,
        female,
        seniorCount: seniors,
        pwdCount: pwd,
        soloParentCount: soloParents,
      },
      update: {
        population,
        households,
        families,
        purokCount: rows.length,
        male,
        female,
        seniorCount: seniors,
        pwdCount: pwd,
        soloParentCount: soloParents,
        pregnantCount: 0,
        floodProneHouseholds: 0,
        landslideProneHouseholds: 0,
        stormSurgeProneHouseholds: 0,
        farmingHouseholds: 0,
        fishingHouseholds: 0,
        evacuationCapacity: 0,
      },
    });
  }
  console.log("✓ Updated 33 barangay profiles (VMG, logo, real totals) + boundaries + 2026 reported subtotals.");

  // --- 5. Renumber codes (two-phase for the 8 that move) ----------------------
  const moves: Array<{ id: string; from: string; to: string }> = [];
  for (const b of barangays) {
    const to = newCodeById.get(b.id);
    if (to && to !== b.code) moves.push({ id: b.id, from: b.code, to });
  }
  if (moves.length > 0) {
    // Phase A: to temporary codes
    for (const mv of moves) {
      await db.barangay.update({ where: { id: mv.id }, data: { code: `TMP31-${mv.from}` } });
    }
    // Phase A2: storage folders to temporary names + storageKey strings
    for (const mv of moves) {
      const n = await renameFolders(mv.from, `TMP31-${mv.from}`);
      if (n > 0) console.log(`  folder ${mv.from} → TMP31-${mv.from} (${n} folder(s))`);
    }
    await rewriteStorageKeys(moves.map((m) => ({ from: m.from, to: `TMP31-${m.from}` })));
    // Phase B: to final codes
    for (const mv of moves) {
      await db.barangay.update({ where: { id: mv.id }, data: { code: mv.to } });
    }
    for (const mv of moves) {
      const n = await renameFolders(`TMP31-${mv.from}`, mv.to);
      if (n > 0) console.log(`  folder TMP31-${mv.from} → ${mv.to} (${n} folder(s))`);
    }
    await rewriteStorageKeys(moves.map((m) => ({ from: `TMP31-${m.from}`, to: m.to })));
    console.log(`✓ Renumbered ${moves.length} barangay codes:`);
    for (const mv of moves) console.log(`  ${mv.from} → ${mv.to}`);
  } else {
    console.log("• Barangay codes already match the official scheme — no renumbering needed.");
  }

  // --- 6. Summary -------------------------------------------------------------
  const finalRows = await db.barangay.findMany({ orderBy: { code: "asc" }, include: { purokZones: { include: { demographics: true } } } });
  const totalPop = finalRows.reduce((a, b) => a + (b.population ?? 0), 0);
  const totalPuroks = finalRows.reduce((a, b) => a + b.purokZones.length, 0);
  console.log("\n=== FINAL STATE ===");
  for (const b of finalRows) {
    const seniors = b.purokZones.reduce((a, p) => a + (p.demographics?.age60plus ?? 0), 0);
    console.log(
      `${b.code} | ${b.name.padEnd(18)} | pop ${String(b.population).padStart(5)} | hh ${String(b.households).padStart(4)} | puroks ${b.purokZones.length} | seniors ${seniors} | logo ${b.logoUrl ? "✓" : "—"}`
    );
  }
  console.log(`TOTAL population: ${totalPop.toLocaleString()} | puroks: ${totalPuroks}`);
  await db.$disconnect();
}

/** Rewrite `/PD-BRG-XXX/` segments in SubmissionFile + StoredFile storage keys. */
async function rewriteStorageKeys(mappings: Array<{ from: string; to: string }>) {
  for (const { from, to } of mappings) {
    const needle = `/${from}/`;
    const repl = `/${to}/`;
    const subs = await db.submissionFile.findMany({ where: { storageKey: { contains: needle } } });
    for (const s of subs) {
      await db.submissionFile.update({ where: { id: s.id }, data: { storageKey: s.storageKey.split(needle).join(repl) } });
    }
    const stored = await db.storedFile.findMany({ where: { storageKey: { contains: needle } } });
    for (const s of stored) {
      await db.storedFile.update({ where: { id: s.id }, data: { storageKey: s.storageKey.split(needle).join(repl) } });
    }
  }
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
