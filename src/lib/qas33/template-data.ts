// QAS33 template seed data: BDRRMP sections & fields (English + Tagalog)
// Based on the standard Barangay DRRM Plan structure (LDRRMF / DILG / OCD guidance)
import type { SectionDef } from "./types";

export const BARANGAYS_OF_PIO_DURAN: Array<{ name: string; captain: string }> = [
  { name: "Agol", captain: "Gilberto N. Tated" },
  { name: "Alabangpuro", captain: "Alfredo W. Trinidad" },
  { name: "Banawan", captain: "Nenita R. Caraos" },
  { name: "Barangay I", captain: "Imelda M. Bañadera" },
  { name: "Barangay II", captain: "Herminigildo Q. Placer" },
  { name: "Barangay III", captain: "Virgilio K. Querubin" },
  { name: "Barangay IV", captain: "Merlinda S. Malanyaon" },
  { name: "Barangay V", captain: "Dominador V. Rances" },
  { name: "Basicao Coastal", captain: "Santiago J. Sarte" },
  { name: "Basicao Interior", captain: "Andres V. Pamplona" },
  { name: "Binodegahan", captain: "Loida Y. Balmes" },
  { name: "Buenavista", captain: "Pablo H. Remo" },
  { name: "Buyo", captain: "Leonor C. Marañon" },
  { name: "Caratagan", captain: "Leonor L. Sapin" },
  { name: "Cuyaoyao", captain: "Efren C. Lubrin" },
  { name: "Flores", captain: "Virgilio I. Saavedra" },
  { name: "La Medalla", captain: "Divina M. Hitalia" },
  { name: "Lawinon", captain: "Virgilio Z. Caraos" },
  { name: "Macasitas", captain: "Andres B. Grageda" },
  { name: "Malapay", captain: "Norma R. Sablayani" },
  { name: "Malidong", captain: "Salvador F. Monares" },
  { name: "Mamlad", captain: "Lorenzo S. Monares" },
  { name: "Marigondon", captain: "Norma A. Dolina" },
  { name: "Matanglad", captain: "Nestor Y. Jamisola" },
  { name: "Nablangbulod", captain: "Jose W. Galicia" },
  { name: "Oringon", captain: "Efren Z. Sarte" },
  { name: "Palapas", captain: "Marivic D. Reyes" },
  { name: "Panganiran", captain: "Bartolome Y. Navarro" },
  { name: "Rawis", captain: "Vilma I. Samson" },
  { name: "Salvacion", captain: "Andres X. Simeon" },
  { name: "Santo Cristo", captain: "Sonia I. Guarte" },
  { name: "Sukip", captain: "Renato W. Fernandez" },
  { name: "Tibabo", captain: "Nimfa Y. Olarte" },
];

const HAZARDS = [
  "Typhoon / Bagyo",
  "Flood / Baha",
  "Landslide / Pagguho ng lupa",
  "Earthquake / Lindol",
  "Storm Surge / Daluyong",
  "Tsunami / Malakas na alon",
  "Fire / Sunog",
  "Drought / Tagtuyot",
];

const WARN_METHODS = [
  "Two-way radio / Radyo",
  "SMS / Text blast",
  "Siren / Serena",
  "Barangay bell / Kampana",
  "House-to-house / Bahay-bahay",
  "Social media / Social media",
  "Public address system / Megaphone",
];

export const SECTION_DEFS: SectionDef[] = [
  {
    key: "barangay_profile",
    order: 1,
    titleEn: "Barangay Profile",
    titleTl: "Profile ng Barangay",
    descEn: "Basic demographic and contact information of the barangay.",
    descTl: "Pangunahing impormasyon ng barangay tungkol sa demograpiya at kontak.",
    icon: "landmark",
    requiresUpload: false,
    required: true,
    fields: [
      { key: "barangay_captain", type: "text", labelEn: "Barangay Captain", labelTl: "Punong Barangay", required: true, width: "half" },
      { key: "contact_number", type: "text", labelEn: "Contact Number", labelTl: "Numero ng Kontak", required: true, width: "half", placeholder: "09XX XXX XXXX" },
      { key: "population_total", type: "number", labelEn: "Total Population (latest census)", labelTl: "Kabuuang Populasyon (pinakabagong senso)", required: true, width: "half" },
      { key: "households_total", type: "number", labelEn: "Number of Households", labelTl: "Bilang ng mga Sambahayan", required: true, width: "half" },
      { key: "puroks_count", type: "number", labelEn: "Number of Puroks", labelTl: "Bilang ng mga Purok", required: true, width: "half" },
      { key: "land_area", type: "number", labelEn: "Land Area", labelTl: "Lawak ng Lupa", required: false, unit: "hectares / ektarya", width: "half" },
      { key: "senior_citizens", type: "number", labelEn: "Senior Citizens", labelTl: "Mga Nakatatanda", required: true, width: "half" },
      { key: "pwd_count", type: "number", labelEn: "Persons with Disability (PWD)", labelTl: "Mga May Kapansanan (PWD)", required: true, width: "half" },
      { key: "children_below5", type: "number", labelEn: "Children below 5 years old", labelTl: "Mga Batang Mababa sa 5 Taong Gulang", required: true, width: "half" },
      { key: "pregnant_women", type: "number", labelEn: "Pregnant / Lactating Women", labelTl: "Mga Buntis / Nagpapasuso", required: true, width: "half" },
      { key: "major_livelihood", type: "text", labelEn: "Major Source of Livelihood", labelTl: "Pangunahing Pagkakakitaan", required: true, width: "full", helpEn: "e.g., farming, fishing, small business", helpTl: "hal. pagsasaka, pangingisda, maliit na negosyo" },
    ],
  },
  {
    key: "hazard_assessment",
    order: 2,
    titleEn: "Hazard Assessment",
    titleTl: "Pagsusuri sa mga Panganib",
    descEn: "Purok-based identification of hazards that threaten the barangay.",
    descTl: "Pagsusuri batay sa purok ng mga panganib na nagbabanta sa barangay.",
    icon: "cloud-lightning",
    requiresUpload: true,
    uploadLabelEn: "Purok-Based Hazard Risk Assessment / Hazard Map",
    uploadLabelTl: "Pagsusuri sa Panganib Batay sa Purok / Mapa ng Panganib",
    uploadFormats: "pdf,jpg,jpeg,png,doc,docx",
    uploadMaxMB: 10,
    required: true,
    fields: [
      { key: "hazards_present", type: "checkbox", labelEn: "Hazards present in the barangay", labelTl: "Mga panganib na nararanasan sa barangay", required: true, options: HAZARDS, width: "full", helpEn: "Check all hazards that affect your barangay.", helpTl: "Tsek ang lahat ng panganib na nakakaapekto sa inyong barangay." },
      { key: "affected_puroks", type: "textarea", labelEn: "Puroks most exposed to hazards", labelTl: "Mga purok na pinaka-expose sa panganib", required: true, width: "full", placeholder: "Purok 1 - flood; Purok 3, 4 - landslide; Purok 5 - storm surge..." },
      { key: "households_at_risk_typhoon", type: "number", labelEn: "Households at risk - Typhoon", labelTl: "Sambahayang nasa panganib - Bagyo", required: true, width: "half" },
      { key: "households_at_risk_flood", type: "number", labelEn: "Households at risk - Flood", labelTl: "Sambahayang nasa panganib - Baha", required: true, width: "half" },
      { key: "households_at_risk_landslide", type: "number", labelEn: "Households at risk - Landslide", labelTl: "Sambahayang nasa panganib - Pagguho", required: false, width: "half" },
      { key: "households_at_risk_others", type: "number", labelEn: "Households at risk - Other hazards", labelTl: "Sambahayang nasa panganib - Iba pang panganib", required: false, width: "half" },
      { key: "hazard_history", type: "textarea", labelEn: "Hazard events experienced in the past 5 years", labelTl: "Mga kalamidad na naranasan sa nakalipas na 5 taon", required: true, width: "full", helpEn: "Include the year and brief description of damages.", helpTl: "Isama ang taon at maikling paglalarawan ng pinsala." },
    ],
  },
  {
    key: "vulnerability_assessment",
    order: 3,
    titleEn: "Vulnerability Assessment",
    titleTl: "Pagsusuri sa Kahinaan",
    descEn: "Identification of vulnerable groups and exposed critical facilities.",
    descTl: "Pagtukoy sa mga marupok na grupo at mahahalagang pasilidad na nasa panganib.",
    icon: "users",
    requiresUpload: false,
    required: true,
    fields: [
      { key: "vulnerable_groups", type: "textarea", labelEn: "Vulnerable groups and their locations", labelTl: "Mga marupok na grupo at kanilang lokasyon", required: true, width: "full", placeholder: "Senior citizens concentrated in Purok 2; informal settlers along the river..." },
      { key: "critical_infrastructures", type: "textarea", labelEn: "Critical infrastructure at risk", labelTl: "Mahahalagang imprastruktura na nasa panganib", required: true, width: "full", placeholder: "Barangay hall, elementary school, health station, bridge, water source..." },
      { key: "vulnerable_houses", type: "number", labelEn: "Houses made of light materials", labelTl: "Mga bahay na yari sa magagaan na materyales", required: true, width: "half" },
      { key: "vulnerability_notes", type: "textarea", labelEn: "Additional vulnerability notes", labelTl: "Karagdagang tala ukol sa kahinaan", required: false, width: "full" },
    ],
  },
  {
    key: "capacity_assessment",
    order: 4,
    titleEn: "Capacity Assessment",
    titleTl: "Pagsusuri sa Kakayahan",
    descEn: "Existing capacities, resources and organizational readiness.",
    descTl: "Mga kasalukuyang kakayahan, yaman at kahandaan ng organisasyon.",
    icon: "shield-check",
    requiresUpload: false,
    required: true,
    fields: [
      { key: "bdrrmc_organized", type: "radio", labelEn: "Is the BDRRMC organized and functional?", labelTl: "Nakabuo at gumagana ba ang BDRRMC?", required: true, options: ["Yes / Oo", "No / Hindi"], width: "half" },
      { key: "bdrrmc_trained", type: "radio", labelEn: "Are BDRRMC members trained (e.g., BDRRM training)?", labelTl: "May kinalaman sa pagsasanay ba ang mga miyembro ng BDRRMC?", required: true, options: ["Yes / Oo", "No / Hindi", "Partially / Bahagya"], width: "half" },
      { key: "early_warning_system", type: "select", labelEn: "Available early warning system", labelTl: "Umiiral na sistema ng maagang babala", required: true, options: ["None / Wala", "Radio / Radyo", "Text blast / Text blast", "Siren / Serena", "Combined / Pinagsama"], width: "half" },
      { key: "evacuation_centers_count", type: "number", labelEn: "Number of designated evacuation sites", labelTl: "Bilang ng itinalagang lugar ng ebakuasyon", required: true, width: "half" },
      { key: "equipment_available", type: "textarea", labelEn: "Available rescue / response equipment", labelTl: "Mga gamit sa pagliligtas at pagtugon", required: true, width: "full", placeholder: "Life vests, ropes, flashlights, first aid kits, megaphone..." },
      { key: "drrm_budget", type: "number", labelEn: "Allocated BDRRM budget for the year", labelTl: "Itinalagang badyet ng BDRRM para sa taon", required: true, unit: "PHP", width: "half" },
      { key: "capacity_gaps", type: "textarea", labelEn: "Identified capacity gaps / needs", labelTl: "Natukoy na kakulangan / pangangailangan", required: false, width: "full" },
    ],
  },
  {
    key: "risk_assessment",
    order: 5,
    titleEn: "Risk Assessment Summary",
    titleTl: "Buod ng Pagsusuri sa Panganib",
    descEn: "Overall risk level per hazard based on hazard, vulnerability and capacity.",
    descTl: "Kabuuang antas ng panganib bawat hazard batay sa panganib, kahinaan at kakayahan.",
    icon: "gauge",
    requiresUpload: true,
    uploadLabelEn: "Barangay Risk Map",
    uploadLabelTl: "Mapa ng Panganib ng Barangay",
    uploadFormats: "pdf,jpg,jpeg,png",
    uploadMaxMB: 10,
    required: true,
    fields: [
      { key: "risk_typhoon", type: "radio", labelEn: "Risk level - Typhoon", labelTl: "Antas ng panganib - Bagyo", required: true, options: ["Low / Mababa", "Moderate / Katamtaman", "High / Mataas"], width: "half" },
      { key: "risk_flood", type: "radio", labelEn: "Risk level - Flood", labelTl: "Antas ng panganib - Baha", required: true, options: ["Low / Mababa", "Moderate / Katamtaman", "High / Mataas"], width: "half" },
      { key: "risk_landslide", type: "radio", labelEn: "Risk level - Landslide", labelTl: "Antas ng panganib - Pagguho ng lupa", required: false, options: ["Low / Mababa", "Moderate / Katamtaman", "High / Mataas"], width: "half" },
      { key: "risk_earthquake", type: "radio", labelEn: "Risk level - Earthquake", labelTl: "Antas ng panganib - Lindol", required: true, options: ["Low / Mababa", "Moderate / Katamtaman", "High / Mataas"], width: "half" },
      { key: "overall_risk_level", type: "radio", labelEn: "Overall barangay risk level", labelTl: "Kabuuang antas ng panganib ng barangay", required: true, options: ["Low / Mababa", "Moderate / Katamtaman", "High / Mataas"], width: "half" },
      { key: "risk_summary", type: "textarea", labelEn: "Risk assessment summary / explanation", labelTl: "Buod / paliwanag ng pagsusuri sa panganib", required: true, width: "full" },
    ],
  },
  {
    key: "bdrrmc_structure",
    order: 6,
    titleEn: "Barangay DRRM Committee (BDRRMC)",
    titleTl: "Komite ng BDRRM sa Barangay (BDRRMC)",
    descEn: "Composition of the Barangay Disaster Risk Reduction and Management Committee.",
    descTl: "Komposisyon ng Komite ng BDRRM sa Barangay.",
    icon: "sitemap",
    requiresUpload: true,
    uploadLabelEn: "Sangguniang Barangay Resolution creating/reconstituting the BDRRMC",
    uploadLabelTl: "Resolusyon ng Sangguniang Barangay sa pagbuo/muling pagbuo ng BDRRMC",
    uploadFormats: "pdf,jpg,jpeg,png,doc,docx",
    uploadMaxMB: 10,
    required: true,
    fields: [
      { key: "bdrrmc_chair", type: "text", labelEn: "BDRRMC Chairperson (Punong Barangay)", labelTl: "Pangulo ng BDRRMC (Punong Barangay)", required: true, width: "half" },
      { key: "bdrrmc_vice", type: "text", labelEn: "Vice Chairperson", labelTl: "Pangalawang Pangulo", required: false, width: "half" },
      { key: "response_team_lead", type: "text", labelEn: "Barangay Response Team Leader", labelTl: "Pinuno ng Koponan ng Pagtugon", required: true, width: "half" },
      { key: "bdrrmc_meeting_freq", type: "select", labelEn: "BDRRMC meeting frequency", labelTl: "Dalas ng pagpupulong ng BDRRMC", required: true, options: ["Monthly / Buwanan", "Quarterly / Kada-isang kuwatro", "Semi-annual / Kada-anim na buwan", "As needed / Kung kinakailangan"], width: "half" },
      { key: "bdrrmc_members", type: "textarea", labelEn: "BDRRMC members and designations", labelTl: "Mga miyembro ng BDRRMC at kanilang katungkulan", required: true, width: "full", placeholder: "Name - Designation (one per line)" },
    ],
  },
  {
    key: "thematic_areas",
    order: 7,
    titleEn: "DRRM Programs & Activities (4 Thematic Areas)",
    titleTl: "Mga Programa at Gawain ng DRRM (4 na Tematikong Lugar)",
    descEn: "Planned programs, activities and budgets under the four DRRM thematic areas.",
    descTl: "Mga nakaplanong programa, gawain at badyet sa ilalim ng apat na tematikong lugar ng DRRM.",
    icon: "layout-grid",
    requiresUpload: false,
    required: true,
    fields: [
      { key: "prevention_activities", type: "textarea", labelEn: "1. Prevention & Mitigation - programs/activities", labelTl: "1. Pag-iwas at Pagpapababa ng Panganib - mga programa/gawain", required: true, width: "full" },
      { key: "prevention_budget", type: "number", labelEn: "Prevention & Mitigation budget", labelTl: "Badyet para sa Pag-iwas at Pagpapababa ng Panganib", required: true, unit: "PHP", width: "half" },
      { key: "preparedness_activities", type: "textarea", labelEn: "2. Preparedness - programs/activities", labelTl: "2. Paghahanda - mga programa/gawain", required: true, width: "full" },
      { key: "preparedness_budget", type: "number", labelEn: "Preparedness budget", labelTl: "Badyet para sa Paghahanda", required: true, unit: "PHP", width: "half" },
      { key: "response_activities", type: "textarea", labelEn: "3. Response - programs/activities", labelTl: "3. Pagtugon - mga programa/gawain", required: true, width: "full" },
      { key: "response_budget", type: "number", labelEn: "Response budget", labelTl: "Badyet para sa Pagtugon", required: true, unit: "PHP", width: "half" },
      { key: "rehab_activities", type: "textarea", labelEn: "4. Rehabilitation & Recovery - programs/activities", labelTl: "4. Pagsasaayos at Pagbangon - mga programa/gawain", required: true, width: "full" },
      { key: "rehab_budget", type: "number", labelEn: "Rehabilitation & Recovery budget", labelTl: "Badyet para sa Pagsasaayos at Pagbangon", required: true, unit: "PHP", width: "half" },
    ],
  },
  {
    key: "evacuation_plan",
    order: 8,
    titleEn: "Evacuation Plan",
    titleTl: "Plano ng Ebakuasyon",
    descEn: "Designated evacuation sites, routes and procedures.",
    descTl: "Mga itinalagang lugar ng ebakuasyon, ruta at pamamaraan.",
    icon: "tent",
    requiresUpload: true,
    uploadLabelEn: "Evacuation Map / Site Photos",
    uploadLabelTl: "Mapa ng Ebakuasyon / Mga Larawan ng Lugar",
    uploadFormats: "pdf,jpg,jpeg,png",
    uploadMaxMB: 10,
    required: true,
    fields: [
      { key: "evacuation_sites", type: "textarea", labelEn: "Designated evacuation sites and capacity", labelTl: "Mga itinalagang lugar ng ebakuasyon at kapasidad", required: true, width: "full", placeholder: "Barangay Hall - 50 families; Elementary School - 200 families..." },
      { key: "evacuation_routes", type: "textarea", labelEn: "Evacuation routes per purok", labelTl: "Mga ruta ng ebakuasyon bawat purok", required: true, width: "full" },
      { key: "evacuation_procedures", type: "textarea", labelEn: "Evacuation procedures", labelTl: "Mga pamamaraan ng ebakuasyon", required: true, width: "full", helpEn: "From warning issuance to arrival at evacuation site.", helpTl: "Mula sa pagbibigay ng babala hanggang pagdating sa lugar ng ebakuasyon." },
      { key: "transport_resources", type: "textarea", labelEn: "Available transport resources", labelTl: "Mga magagamit na sasakyan", required: false, width: "full" },
      { key: "special_needs_protocol", type: "textarea", labelEn: "Assistance protocol for elderly, PWD, pregnant women, children", labelTl: "Protokol ng tulong para sa nakatatanda, PWD, buntis at mga bata", required: true, width: "full" },
    ],
  },
  {
    key: "early_warning",
    order: 9,
    titleEn: "Early Warning & Communication",
    titleTl: "Maagang Babala at Komunikasyon",
    descEn: "How warnings are received and disseminated in the barangay.",
    descTl: "Paano natatanggap at naipapalaganap ang mga babala sa barangay.",
    icon: "megaphone",
    requiresUpload: false,
    required: true,
    fields: [
      { key: "warning_methods", type: "checkbox", labelEn: "Warning dissemination methods used", labelTl: "Mga paraan ng pagpapalaganap ng babala", required: true, options: WARN_METHODS, width: "full" },
      { key: "warning_source", type: "text", labelEn: "Primary source of warnings", labelTl: "Pangunahing pinagmulan ng mga babala", required: true, width: "half", placeholder: "MDRRMO, PAGASA, OCD..." },
      { key: "responsible_officials", type: "textarea", labelEn: "Officials responsible for dissemination", labelTl: "Mga opisyal na responsable sa pagpapalaganap", required: true, width: "full" },
      { key: "communication_gaps", type: "textarea", labelEn: "Communication gaps / needs", labelTl: "Mga kakulangan / pangangailangan sa komunikasyon", required: false, width: "full" },
    ],
  },
  {
    key: "budget_aip",
    order: 10,
    titleEn: "Annual Investment Plan & Budget",
    titleTl: "Taunang Plano ng Pamumuhunan at Badyet",
    descEn: "BDRRM fund allocation consistent with the 5% LDRRMF.",
    descTl: "Itinalagang pondo ng BDRRM ayon sa 5% LDRRMF.",
    icon: "wallet",
    requiresUpload: false,
    required: true,
    fields: [
      { key: "fund_source", type: "text", labelEn: "Source of fund", labelTl: "Pinagkukunan ng pondo", required: true, width: "half", placeholder: "5% Local DRRM Fund (LDRRMF)" },
      { key: "total_bdrrm_fund", type: "number", labelEn: "Total BDRRM fund", labelTl: "Kabuuang pondo ng BDRRM", required: true, unit: "PHP", width: "half" },
      { key: "quick_response_fund", type: "number", labelEn: "Quick Response Fund (QRF) allocation", labelTl: "Itinalagang Pondo para sa Mabilis na Pagtugon (QRF)", required: true, unit: "PHP", width: "half" },
      { key: "budget_remarks", type: "textarea", labelEn: "Budget remarks / planned utilization", labelTl: "Mga tala sa badyet / planadong paggamit", required: false, width: "full" },
    ],
  },
  {
    key: "supporting_docs",
    order: 11,
    titleEn: "Supporting Documents",
    titleTl: "Mga Suportang Dokumento",
    descEn: "Optional attachments: photos, MOAs, certifications, trainings attended, and other reference documents.",
    descTl: "Opsyonal na mga kalakip: mga larawan, MOA, sertipiko, pinuntahang pagsasanay at iba pang dokumento.",
    icon: "paperclip",
    requiresUpload: true,
    uploadLabelEn: "Additional supporting documents (photos, MOAs, certificates, etc.)",
    uploadLabelTl: "Karagdagang mga suportang dokumento (larawan, MOA, sertipiko, atbp.)",
    uploadFormats: "pdf,jpg,jpeg,png,doc,docx,xls,xlsx",
    uploadMaxMB: 10,
    required: false,
    fields: [],
  },
];

export const TUTORIAL_DEFS = [
  {
    key: "getting_started",
    titleEn: "Getting Started with QAS33",
    titleTl: "Paano Magsimula sa QAS33",
    bodyEn: `Welcome to QAS33, the official BDRRMP portal of the Municipality of Pio Duran.

**What you need before starting:**
1. Your Barangay Code (e.g., PD-BRG-014) and Access PIN issued by the MDRRMO.
2. Your purok-based hazard risk assessment and other supporting documents.

**Steps:**
1. Log in using your Barangay Code and PIN. You will be asked to change your temporary PIN on first login.
2. Select your preferred template language (English or Tagalog). The language affects the forms, instructions and the final document.
3. Complete each section of the BDRRMP form and upload the required documents.
4. Validate, preview, and submit.

If you encounter problems, contact the MDRRMO office.`,
    bodyTl: `Maligayang pagdating sa QAS33, ang opisyal na portal ng BDRRMP ng Munisipyo ng Pio Duran.

**Mga kailangan bago magsimula:**
1. Ang inyong Barangay Code (hal. PD-BRG-014) at Access PIN na ibinigay ng MDRRMO.
2. Ang pagsusuri sa panganib batay sa purok at iba pang suportang dokumento.

**Mga hakbang:**
1. Mag-login gamit ang inyong Barangay Code at PIN. Hihilingin sa inyo na palitan ang pansamantalang PIN sa unang pag-login.
2. Piliin ang nais na wika ng template (Ingles o Tagalog). Ang wika ang tutukoy sa anyo ng form, instruksyon at huling dokumento.
3. Punan ang bawat bahagi ng form ng BDRRMP at i-upload ang mga kinakailangang dokumento.
4. Suriin, tingnan ang preview, at isumite.

Kung may problema, makipag-ugnayan sa opisina ng MDRRMO.`,
  },
  {
    key: "filling_forms",
    titleEn: "Filling Out the BDRRMP Form",
    titleTl: "Pagpuno ng Form ng BDRRMP",
    bodyEn: `The BDRRMP form has 11 sections. Your progress is computed automatically as you complete each section.

**Tips:**
- Fields marked with a red asterisk (*) are required.
- Answers are saved as drafts automatically — you can log out and continue anytime.
- Use realistic numbers from your latest census and hazard assessment.
- The households at risk in the Hazard Assessment should match your purok-based risk assessment.

**Completion guide:**
- A section turns green when all required fields are filled and required documents are uploaded.
- Reach 100% completion and a "Ready for Submission" status before submitting.`,
    bodyTl: `Ang form ng BDRRMP ay may 11 na bahagi. Awtomatikong kinakalkula ang progreso habang tinatapos ninyo ang bawat bahagi.

**Mga paalala:**
- Ang mga field na may pulang asterisk (*) ay kinakailangan.
- Awtomatikong naka-save ang sagot bilang burador — maaari kayong lumabas at ipagpatuloy ito anumang oras.
- Gumamit ng makatotohanang bilang mula sa pinakabagong senso at pagsusuri sa panganib.
- Ang bilang ng sambahayang nasa panganib sa Pagsusuri sa mga Panganib ay dapat tumugma sa inyong pagsusuri batay sa purok.

**Gabay sa pagkumpleto:**
- Berde ang bahagi kapag napunan na ang lahat ng kinakailangang field at nai-upload ang mga dokumento.
- Abutin ang 100% at ang status na "Handa nang Isumite" bago mag-submit.`,
  },
  {
    key: "uploading_docs",
    titleEn: "Uploading Supporting Documents",
    titleTl: "Pag-upload ng mga Suportang Dokumento",
    bodyEn: `Each section that requires documents has an upload area.

**Accepted formats:** PDF, JPG, PNG, DOC, DOCX (10 MB maximum per file).

**To upload:**
1. Open the section and find the upload area.
2. Click "Upload File" and choose your document.
3. The file will be validated and attached to that section.

**To replace a file** (for example, when MDRRMO requests a revision), simply upload the revised file. Your previous uploads remain in the version history.`,
    bodyTl: `Ang bawat bahagi na nangangailangan ng dokumento ay may lugar para sa pag-upload.

**Tinatanggap na format:** PDF, JPG, PNG, DOC, DOCX (hanggang 10 MB bawat file).

**Paano mag-upload:**
1. Buksan ang bahagi at hanapin ang lugar ng pag-upload.
2. I-click ang "Upload File" at piliin ang inyong dokumento.
3. Masusuri ang file at maiikabit sa bahaging iyon.

**Upang mapalitan ang isang file** (hal. kapag hiniling ng MDRRMO ang pagbabago), i-upload lamang ang binagong file. Mananatili ang inyong mga naunang upload sa kasaysayan ng bersyon.`,
  },
  {
    key: "submitting_tracking",
    titleEn: "Submitting & Tracking Your BDRRMP",
    titleTl: "Pags-submit at Pagsubaybay ng BDRRMP",
    bodyEn: `Before submitting, run the Pre-Submission Check. You can only submit when all required sections are complete.

**When you submit:**
- You certify that the information is complete and accurate.
- The MDRRMO receives your BDRRMP in their review queue.

**Tracking statuses:**
- SUBMITTED → received by MDRRMO
- UNDER REVIEW → MDRRMO is reviewing
- NEEDS REVISION → corrections required (see comments)
- APPROVED → passed evaluation
- READY FOR DOWNLOAD → final signed PDF available

Every status change sends you a notification.`,
    bodyTl: `Bago mag-submit, patakbuhin ang Pagsusuri Bago Mag-submit. Maaari lamang mag-submit kapag kumpleto ang lahat ng kinakailangang bahagi.

**Kapag nag-submit kayo:**
- Sinisiguro ninyong kumpleto at tama ang impormasyon.
- Matatanggap ng MDRRMO ang inyong BDRRMP sa kanilang pila ng pagsusuri.

**Mga status na tukuyin:**
- NAISUMITE NA → natanggap ng MDRRMO
- SINUSUSURI → sinusuri ng MDRRMO
- KAILANGANG BAGUHIN → may mga pagwawasto (tingnan ang mga komento)
- APRUBADO → pumasa sa pagsusuri
- MAAARI NANG I-DOWNLOAD → available na ang huling nilagdaang PDF

Bawat pagbabago ng status ay nagpapadala ng abiso.`,
  },
  {
    key: "responding_comments",
    titleEn: "Responding to MDRRMO Comments",
    titleTl: "Pagsagot sa mga Komento ng MDRRMO",
    bodyEn: `When the MDRRMO requires revisions, you will receive a notification and see comments on specific sections.

**To revise:**
1. Open "Review Comments" to read the MDRRMO comments per section.
2. Update the affected form fields and/or upload revised files.
3. Resubmit. Your new submission becomes Version 2 (and so on).

All previous versions are preserved. The MDRRMO reviews your latest version.`,
    bodyTl: `Kapag nag-require ang MDRRMO ng mga pagbabago, makakatanggap kayo ng abiso at makikita ang mga komento sa mga partikular na bahagi.

**Paano mag-rebisa:**
1. Buksan ang "Mga Komento ng Pagsusuri" upang basahin ang mga komento ng MDRRMO bawat bahagi.
2. I-update ang mga apektadong field at/o i-upload ang binagong mga file.
3. Muling isumite. Ang bagong submission ay magiging Bersyon 2 (at iba pa).

Nananatiling nakatabi ang lahat ng naunang bersyon. Ang pinakabagong bersyon ang susuriin ng MDRRMO.`,
  },
];
