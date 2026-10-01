// QAS33 Plan Builder export — PDF (pdf-lib) + DOCX (docx) generators for
// BDRRM_PLAN / BDP_PLAN barangay plan documents, plus shared data loaders.
//
// Output mirrors the OFFICIAL municipal templates:
//   • Official cover page (Republic of the Philippines / DILG / Office of the
//     Punong Barangay / BDRRMC or BDC / plan title / CY / location line / notes)
//   • Body follows the official part structure (Roman-numeral part bands +
//     lettered/numbered sub-sections) driven by the seeded template sections
//   • Final APPROVAL & SIGNATORIES page: Prepared by → Noted by (Punong
//     Barangay) → Reviewed & Approved by (MDRRMO) → APPROVED BY THE PROVINCIAL
//     DRRM OFFICER (name + date; PENDING watermark until recorded).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { BarangayPlan, PlanBuilder, PlanBuilderSection } from "@prisma/client";
import { db } from "@/lib/db";
import type { PlanFieldDef, PlanSectionClient } from "./types";

// ---------------------------------------------------------------------------
// Input shape + loaders
// ---------------------------------------------------------------------------

export interface PlanExportInput {
  plan: BarangayPlan;
  builder: PlanBuilder;
  sections: PlanSectionClient[];
  barangay: { code: string; name: string; captain?: string | null };
}

function toSections(builder: { sections: PlanBuilderSection[] }): PlanSectionClient[] {
  return builder.sections.map((s) => ({
    code: s.code,
    order: s.order,
    group: s.groupEn,
    title: s.titleEn,
    desc: s.descEn,
    icon: s.icon,
    required: s.required,
    fields: JSON.parse(s.fieldsJson || "[]") as PlanFieldDef[],
  }));
}

export async function loadPlanExportDataByPlanId(planId: string): Promise<PlanExportInput | null> {
  const plan = await db.barangayPlan.findUnique({
    where: { id: planId },
    include: { builder: { include: { sections: { orderBy: { order: "asc" } } } }, barangay: true },
  });
  if (!plan) return null;
  return {
    plan,
    builder: plan.builder,
    sections: toSections(plan.builder),
    barangay: { code: plan.barangay.code, name: plan.barangay.name, captain: plan.barangay.captain },
  };
}

export async function loadPlanExportDataForBarangay(
  barangayId: string,
  builderCode: string,
  year: number
): Promise<PlanExportInput | null> {
  const plan = await db.barangayPlan.findUnique({
    where: { barangayId_builderCode_year: { barangayId, builderCode, year } },
    include: { builder: { include: { sections: { orderBy: { order: "asc" } } } }, barangay: true },
  });
  if (!plan) return null;
  return {
    plan,
    builder: plan.builder,
    sections: toSections(plan.builder),
    barangay: { code: plan.barangay.code, name: plan.barangay.name, captain: plan.barangay.captain },
  };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  DRAFT: "Draft",
  COMPLETED: "Completed",
  SUBMITTED: "Submitted for Approval",
  APPROVED: "APPROVED — MDRRMO",
  PROVINCE_APPROVED: "APPROVED — Provincial DRRM Officer",
  RETURNED: "Returned for Revision",
};

export function planStatusText(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** pdf-lib standard fonts encode WinAnsi only — map common Unicode to ASCII-safe. */
export function toWinAnsi(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/₱/g, "PHP ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•·]/g, "-")
    .replace(/\u00A0/g, " ")
    // strip anything the WinAnsi codec still cannot encode (CJK, emoji, …)
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, "");
}

function parseValues(plan: BarangayPlan): Record<string, unknown> {
  try {
    return JSON.parse(plan.valuesJson || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Scalar field value → display lines ("—" when empty). */
function scalarLines(v: unknown, unit?: string): string[] {
  if (v === null || v === undefined || v === "") return ["—"];
  if (Array.isArray(v)) return v.length > 0 ? v.map((x) => `- ${String(x)}`) : ["—"];
  if (typeof v === "number") {
    const n = Number.isInteger(v) ? v.toLocaleString("en-US") : String(v);
    return [unit ? `${n} ${unit}` : n];
  }
  return [String(v)];
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("en-US") : String(v);
  return String(v);
}

function tableRows(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
}

function nonEmptyRows(v: unknown): Array<Record<string, unknown>> {
  return tableRows(v).filter((r) =>
    Object.values(r).some((c) => c !== null && c !== undefined && String(c).trim() !== "")
  );
}

// ---------------------------------------------------------------------------
// Official template text constants
// ---------------------------------------------------------------------------

/** Standard legal basis printed in BDRRMP Part IV (before the local references). */
const BDRRM_LEGAL_INTERNATIONAL =
  'International: SENDAI Framework for Disaster Risk Reduction, Paragraph 33 - "National and local government ' +
  'shall prepare or review and periodically update disaster preparedness and contingency policies, plans and programs."';
const BDRRM_LEGAL_NATIONAL =
  "National: RA 10121 (Philippine Disaster Risk Reduction and Management Act); NDRRMC-NSC JMC No. 1, s. 2016; " +
  "RA 10821 (Children's Emergency Relief and Protection Act); RA 9729 (Climate Change Act); RA 10174 (People's " +
  "Survival Fund); DILG Memorandum Circulars related to DRRM; NEDA's \"We Recover as One\" Policy.";
const BDRRM_LEGAL_LOCAL_PREFIX =
  "Local: Executive Order organizing the BDRRMC; Barangay Resolution adopting the BDRRM Plan; Barangay Ordinance on " +
  "BDRRM Fund utilization.";

const BDRRM_ANNEXES = [
  "Sangguniang Barangay Resolution adopting the BDRRM Plan",
  "Sangguniang Barangay Ordinance on the Utilization of BDRRM Fund",
  "Executive Order on the Creation and Composition of the BDRRMC",
  "Specific Members of the Committee and other Partners (Directory)",
  "Memorandum of Agreement (MOA) / Memorandum of Understanding (MOU) with partners",
  "Protocols (Communication, Relief, Response, etc.)",
  "Contingency Plan",
  "Photo documentation",
  "Others",
];

/** "Barangay III" stays as-is; other names get the "Barangay " prefix. */
function barangayLabel(name: string): string {
  const n = name.trim();
  if (/^barangay\b/i.test(n)) return n;
  return `Barangay ${n}`;
}

/** Cover-page + signature-page strings per builder. */
function officialCover(builderCode: string, barangayName: string, planYear: number, values: Record<string, unknown>) {
  const coverage = String(values.plan_coverage ?? "").trim();
  if (builderCode === "BDP_PLAN") {
    const cy = coverage || `20${String(planYear % 100).padStart(2, "0")} - 20${String((planYear + 2) % 100).padStart(2, "0")}`;
    return {
      republicLines: ["Republic of the Philippines", "Department of the Interior and Local Government", "", "OFFICE OF THE PUNONG BARANGAY", "BARANGAY DEVELOPMENT COUNCIL (BDC)"],
      title: "BARANGAY DEVELOPMENT PLAN (BDP)",
      subtitle: `CY ${cy}`,
      location: `${barangayLabel(barangayName)} - PIO DURAN - ALBAY - REGION V - Bicol`,
      pursuant: "(Pursuant to DILG Memorandum Circular No. 2020-228)",
      preparedLine: "Prepared by the Barangay Development Council",
      bodyFooterTitle: "Barangay Development Plan (BDP)",
    };
  }
  const period = coverage || `${planYear} - ${planYear + 2}`;
  return {
    republicLines: ["Republic of the Philippines", "Department of the Interior and Local Government", "", "OFFICE OF THE PUNONG BARANGAY", "BARANGAY DISASTER RISK REDUCTION AND MANAGEMENT COUNCIL (BDRRMC)"],
    title: "BARANGAY DISASTER RISK REDUCTION\nAND MANAGEMENT PLAN",
    subtitle: "",
    location: `${barangayLabel(barangayName)}, PIO DURAN\nALBAY, REGION V - Bicol`,
    pursuant: "",
    preparedLine: "Prepared following the BDRRM Plan and Committee Technical Guide",
    periodLine: `Plan Period: ${period}`,
    bodyFooterTitle: "Barangay BDRRM Plan",
  };
}

// ===========================================================================
// PDF (pdf-lib)
// ===========================================================================

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const CONTENT_W = A4[0] - MARGIN * 2;
const FOOTER_Y = 56; // content must stay above this

const GOV_BLUE = rgb(0x04 / 255, 0x21 / 255, 0x89 / 255);
const SLATE_900 = rgb(0x0f / 255, 0x17 / 255, 0x2a / 255);
const SLATE_700 = rgb(0x33 / 255, 0x41 / 255, 0x55 / 255);
const SLATE_500 = rgb(0x64 / 255, 0x74 / 255, 0x8b / 255);
const SLATE_400 = rgb(0x94 / 255, 0xa3 / 255, 0xb8 / 255);
const SLATE_200 = rgb(0xe2 / 255, 0xe8 / 255, 0xf0 / 255);
const GOLD = rgb(0xfd / 255, 0xc9 / 255, 0x4a / 255);
const TEAL = rgb(0x0f / 255, 0x7a / 255, 0x6e / 255);
const AMBER = rgb(0xb4 / 255, 0x6a / 255, 0x00 / 255);
const WHITE = rgb(1, 1, 1);

function wrapPdf(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      let piece = w;
      while (font.widthOfTextAtSize(piece, size) > maxWidth && piece.length > 1) {
        let cut = piece.length;
        while (cut > 1 && font.widthOfTextAtSize(piece.slice(0, cut), size) > maxWidth) cut--;
        lines.push(piece.slice(0, cut));
        piece = piece.slice(cut);
      }
      line = piece;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** Column widths proportional to label length, capped to the content width. */
function colWidths(labels: string[], total: number): number[] {
  const weights = labels.map((l) => Math.max(8, l.length));
  const sum = weights.reduce((a, b) => a + b, 0);
  const MIN = 46;
  let widths = weights.map((w) => Math.max(MIN, (w / sum) * total));
  const wsum = widths.reduce((a, b) => a + b, 0);
  if (wsum > 0) widths = widths.map((w) => (w / wsum) * total);
  return widths;
}

export async function generatePlanPdf(input: PlanExportInput): Promise<Uint8Array> {
  const { plan, builder, sections, barangay } = input;
  const values = parseValues(plan);
  const statusText = planStatusText(plan.status);
  const isBdp = builder.code === "BDP_PLAN";
  const cover = officialCover(builder.code, barangay.name, plan.year, values);
  const provinceApproved = plan.status === "PROVINCE_APPROVED" && !!plan.provincialApprovedBy;

  const pdf = await PDFDocument.create();
  pdf.setTitle(toWinAnsi(`${builder.titleEn} ${plan.year} - ${barangay.name}`));
  pdf.setAuthor("QAS33 - MDRRMO Pio Duran");
  pdf.setSubject(toWinAnsi(plan.docRef ?? "DRAFT"));

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  const newPage = () => {
    page = pdf.addPage(A4);
    pages.push(page);
    y = A4[1] - MARGIN;
  };

  const ensure = (needed: number) => {
    if (y - needed < FOOTER_Y) newPage();
  };

  const drawTextW = (
    text: string,
    opts: { x: number; y: number; size: number; f: PDFFont; color?: ReturnType<typeof rgb>; maxWidth?: number }
  ) => {
    page.drawText(toWinAnsi(text), {
      x: opts.x,
      y: opts.y,
      size: opts.size,
      font: opts.f,
      color: opts.color ?? SLATE_900,
      ...(opts.maxWidth ? { maxWidth: opts.maxWidth } : {}),
    });
  };

  const drawCentered = (text: string, opts: { y: number; size: number; f: PDFFont; color?: ReturnType<typeof rgb> }) => {
    const t = toWinAnsi(text);
    const w = opts.f.widthOfTextAtSize(t, opts.size);
    drawTextW(text, { x: (A4[0] - w) / 2, y: opts.y, size: opts.size, f: opts.f, color: opts.color });
  };

  // ---- Official cover page ---------------------------------------------------
  newPage();
  // Top rules (official document feel)
  page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: GOV_BLUE });
  page.drawRectangle({ x: 0, y: A4[1] - 9, width: A4[0], height: 2.5, color: GOLD });

  y = A4[1] - 64;
  for (const line of cover.republicLines) {
    if (line) drawCentered(line, { y, size: line === line.toUpperCase() && line.length > 20 ? 10 : 10.5, f: line.startsWith("OFFICE") || line.startsWith("BARANGAY DISASTER") || line.startsWith("BARANGAY DEVELOPMENT") ? bold : font });
    y -= 16;
  }
  y -= 26;

  // Plan title
  for (const titleLine of cover.title.split("\n")) {
    drawCentered(titleLine, { y, size: 17, f: bold, color: GOV_BLUE });
    y -= 23;
  }
  y -= 8;
  if (cover.subtitle) {
    drawCentered(cover.subtitle, { y, size: 13, f: bold });
    y -= 20;
  }
  for (const locLine of cover.location.split("\n")) {
    drawCentered(locLine, { y, size: 11.5, f: bold });
    y -= 17;
  }
  if (cover.periodLine) {
    y -= 2;
    drawCentered(cover.periodLine, { y, size: 11.5, f: font });
    y -= 18;
  }
  y -= 6;
  if (cover.pursuant) {
    drawCentered(cover.pursuant, { y, size: 9.5, f: font, color: SLATE_500 });
    y -= 18;
  }

  y -= 20;
  drawCentered("Purok Boundary Map available in the MDRRMO Google Drive map inventory", { y, size: 9, f: font, color: SLATE_400 });
  y -= 34;

  // Status stamp box
  const stampText = provinceApproved
    ? "APPROVED"
    : plan.status === "APPROVED"
      ? "APPROVED BY MDRRMO - PENDING PROVINCIAL APPROVAL"
      : plan.status === "SUBMITTED"
        ? "SUBMITTED - PENDING MDRRMO REVIEW"
        : statusText.toUpperCase();
  const stampW = bold.widthOfTextAtSize(toWinAnsi(stampText), 10) + 28;
  const stampH = 26;
  const stampX = (A4[0] - stampW) / 2;
  page.drawRectangle({
    x: stampX,
    y: y - stampH,
    width: stampW,
    height: stampH,
    color: provinceApproved ? TEAL : plan.status === "APPROVED" ? GOLD : SLATE_200,
    opacity: 0.16,
    borderColor: provinceApproved ? TEAL : plan.status === "APPROVED" ? GOLD : SLATE_400,
    borderWidth: 1,
  });
  drawCentered(stampText, { y: y - stampH + 9, size: 10, f: bold, color: provinceApproved ? TEAL : plan.status === "APPROVED" ? AMBER : SLATE_700 });
  y -= stampH + 16;

  drawCentered(cover.preparedLine, { y, size: 10, f: bold, color: SLATE_700 });
  y -= 16;
  drawCentered(`${barangayLabel(barangay.name)} (${barangay.code}) - Municipality of Pio Duran, Province of Albay`, { y, size: 8.5, f: font, color: SLATE_500 });

  // System metadata box (bottom of cover)
  const metaY = 150;
  page.drawLine({ start: { x: MARGIN, y: metaY + 58 }, end: { x: A4[0] - MARGIN, y: metaY + 58 }, thickness: 0.8, color: SLATE_200 });
  drawTextW("QAS33 SYSTEM RECORD", { x: MARGIN, y: metaY + 44, size: 7.5, f: bold, color: SLATE_400 });
  const metaRows: Array<[string, string]> = [
    ["Status", statusText],
    ["Progress", `${plan.progress}% of required fields completed`],
    [
      "Submitted",
      plan.submittedAt
        ? `${fmtDateTime(plan.submittedAt)}${plan.submittedByName ? ` by ${plan.submittedByName}` : ""}`
        : "Not yet submitted",
    ],
    ["MDRRMO Review", plan.reviewedAt ? `${fmtDateTime(plan.reviewedAt)} by ${plan.reviewedBy}` : "—"],
    [
      "Provincial Approval",
      plan.provincialApprovedAt
        ? `${fmtDate(plan.provincialApprovedAt)} by ${plan.provincialApprovedBy}`
        : "Pending — required to finalize this document",
    ],
    ["Document Ref", plan.docRef ?? "DRAFT (reference number issued on approval)"],
  ];
  let my = metaY + 30;
  for (const [k, v] of metaRows) {
    drawTextW(k.toUpperCase(), { x: MARGIN, y: my, size: 7, f: bold, color: SLATE_400 });
    drawTextW(v, { x: MARGIN + 118, y: my, size: 8, f: font, color: SLATE_700 });
    my -= 12.5;
  }
  if (plan.reviewNote) {
    drawTextW(`MDRRMO NOTE: ${plan.reviewNote.slice(0, 130)}`, { x: MARGIN, y: my, size: 7, f: font, color: SLATE_500, maxWidth: CONTENT_W });
    my -= 12;
  }

  // ---- Body: sections --------------------------------------------------------
  const renderTable = (field: PlanFieldDef, raw: unknown) => {
    const cols = field.columns ?? [];
    if (cols.length === 0) return;
    const rows = nonEmptyRows(raw);
    ensure(30);
    drawTextW(field.labelEn.toUpperCase(), { x: MARGIN, y, size: 8, f: bold, color: SLATE_500 });
    y -= 8;

    const widths = colWidths(cols.map((c) => c.labelEn), CONTENT_W);
    const padX = 4;
    const padY = 3;

    const drawHeaderRow = () => {
      const h = 16;
      ensure(h + 8);
      page.drawRectangle({ x: MARGIN, y: y - h + 4, width: CONTENT_W, height: h, color: GOV_BLUE, opacity: 0.1 });
      let x = MARGIN;
      cols.forEach((c, i) => {
        page.drawRectangle({
          x,
          y: y - h + 4,
          width: widths[i],
          height: h,
          borderColor: SLATE_200,
          borderWidth: 0.5,
        });
        drawTextW(c.labelEn.toUpperCase(), {
          x: x + padX,
          y: y - h + 9,
          size: 8,
          f: bold,
          color: SLATE_700,
          maxWidth: widths[i] - padX * 2,
        });
        x += widths[i];
      });
      y -= h + 4;
    };

    drawHeaderRow();

    if (rows.length === 0) {
      ensure(14);
      drawTextW("- no entries -", { x: MARGIN + 6, y, size: 8, f: font, color: SLATE_400 });
      y -= 16;
      return;
    }

    for (const row of rows) {
      const cellLines = cols.map((c, i) => wrapPdf(cellText(row[c.key]) || " ", font, 8, widths[i] - padX * 2));
      const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
      const rowH = maxLines * 10 + padY * 2;
      if (y - rowH < FOOTER_Y) {
        newPage();
        drawHeaderRow();
      }
      let x = MARGIN;
      cols.forEach((c, i) => {
        page.drawRectangle({ x, y: y - rowH, width: widths[i], height: rowH, borderColor: SLATE_200, borderWidth: 0.5 });
        let ty = y - padY - 7;
        for (const line of cellLines[i]) {
          drawTextW(line, { x: x + padX, y: ty, size: 8, f: font, color: SLATE_900, maxWidth: widths[i] - padX * 2 });
          ty -= 10;
        }
        x += widths[i];
      });
      y -= rowH;
    }
    y -= 10;
  };

  const renderScalar = (label: string, lines: string[]) => {
    const wrapped = lines.flatMap((l) => wrapPdf(l, font, 10, CONTENT_W - 4));
    ensure(24 + wrapped.length * 13);
    drawTextW(label.toUpperCase(), { x: MARGIN, y, size: 8, f: bold, color: SLATE_500 });
    y -= 12;
    for (const line of wrapped) {
      ensure(14);
      const isEmpty = line === "—";
      drawTextW(line, { x: MARGIN + 6, y, size: 10, f: font, color: isEmpty ? SLATE_400 : SLATE_900 });
      y -= 13;
    }
    y -= 6;
  };

  let lastGroup: string | null = null;
  for (const section of sections) {
    // Part band when the group changes (official Roman-numeral parts)
    if (section.group && section.group !== lastGroup) {
      lastGroup = section.group;
      ensure(40);
      page.drawRectangle({ x: MARGIN, y: y - 14, width: CONTENT_W, height: 20, color: SLATE_700 });
      drawTextW(section.group.toUpperCase(), { x: MARGIN + 8, y: y - 8, size: 9, f: bold, color: WHITE });
      y -= 34;
    }
    ensure(46);
    drawTextW(section.title, { x: MARGIN, y, size: 12, f: bold, color: SLATE_900 });
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.6, color: SLATE_200 });
    y -= 16;

    // BDRRMP Part IV — print the standard legal basis before the local fields
    if (section.code === "bdrrm_s10_legal") {
      renderScalar("International", [BDRRM_LEGAL_INTERNATIONAL]);
      renderScalar("National", [BDRRM_LEGAL_NATIONAL]);
      const localVal = String(values.legal_local ?? "").trim();
      renderScalar("Local", [localVal ? `${BDRRM_LEGAL_LOCAL_PREFIX} ${localVal}` : `${BDRRM_LEGAL_LOCAL_PREFIX} (references to be provided)`]);
      for (const field of section.fields) {
        renderScalar(field.labelEn, scalarLines(values[field.key], field.unit));
      }
      y -= 10;
      continue;
    }

    for (const field of section.fields) {
      if (field.type === "table") {
        renderTable(field, values[field.key]);
      } else {
        renderScalar(field.labelEn, scalarLines(values[field.key], field.unit));
      }
    }
    y -= 10;
  }

  // ---- BDRRMP annexes list ----------------------------------------------------
  if (!isBdp) {
    ensure(70);
    page.drawRectangle({ x: MARGIN, y: y - 14, width: CONTENT_W, height: 20, color: SLATE_700 });
    drawTextW("VIII. ANNEXES", { x: MARGIN + 8, y: y - 8, size: 9, f: bold, color: WHITE });
    y -= 34;
    drawTextW("(attached to the official transmitted copy)", { x: MARGIN, y, size: 8.5, f: font, color: SLATE_500 });
    y -= 16;
    for (const a of BDRRM_ANNEXES) {
      ensure(14);
      drawTextW(`-  ${a}`, { x: MARGIN + 6, y, size: 9.5, f: font });
      y -= 14;
    }
    y -= 10;
  }

  // ---- Approval & signature page ----------------------------------------------
  newPage();
  page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: GOV_BLUE });
  page.drawRectangle({ x: 0, y: A4[1] - 9, width: A4[0], height: 2.5, color: GOLD });
  y = A4[1] - 70;
  drawCentered("CERTIFICATION AND APPROVAL", { y, size: 15, f: bold, color: GOV_BLUE });
  y -= 20;
  drawCentered(
    isBdp
      ? `Barangay Development Plan (BDP) - ${barangayLabel(barangay.name)}, Pio Duran, Albay`
      : `Barangay BDRRM Plan - ${barangayLabel(barangay.name)}, Pio Duran, Albay`,
    { y, size: 10, f: font, color: SLATE_700 }
  );
  y -= 18;
  drawCentered(
    `${plan.docRef ? `Document Ref: ${plan.docRef}  -  ` : ""}${statusText}${plan.reviewedAt ? `  -  MDRRMO approval: ${fmtDate(plan.reviewedAt)}` : ""}`,
    { y, size: 9, f: bold, color: plan.status === "PROVINCE_APPROVED" ? TEAL : SLATE_500 }
  );
  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.8, color: SLATE_200 });
  y -= 26;

  // Signature blocks (2 columns)
  const colW = (CONTENT_W - 24) / 2;
  const sigX = [MARGIN, MARGIN + colW + 24];
  const sigTitle = (x: number, ty: number, text: string) => drawTextW(text, { x, y: ty, size: 7.5, f: bold, color: SLATE_400 });

  const preparedName =
    String(values.prepared_by ?? "").trim() ||
    (isBdp ? "BDC Secretariat" : "BDRRMC Chairperson / Secretary");
  const notedName = String(values.noted_by ?? "").trim() || barangay.captain || "Punong Barangay";

  const blockH = 104;
  const sigBlocks: Array<{ x: number; role: string; name: string; position: string; date: string; ok: boolean }> = [
    {
      x: sigX[0],
      role: "PREPARED BY",
      name: preparedName,
      position: isBdp ? "Barangay Development Council Secretariat" : "BDRRMC Chairperson / Secretariat",
      date: plan.submittedAt ? fmtDate(plan.submittedAt) : "Date: ______________",
      ok: true,
    },
    {
      x: sigX[1],
      role: "NOTED BY",
      name: notedName,
      position: "Punong Barangay / BDC-BDRRMC Chairperson",
      date: "Date: ______________",
      ok: true,
    },
    {
      x: sigX[0],
      role: "REVIEWED AND APPROVED BY (MUNICIPAL)",
      name: plan.reviewedBy ?? "Municipal DRRM Officer",
      position: "Municipal DRRM Officer - Pio Duran, Albay",
      date: plan.reviewedAt ? fmtDate(plan.reviewedAt) : "pending MDRRMO review",
      ok: !!plan.reviewedAt,
    },
    {
      x: sigX[1],
      role: "APPROVED BY (PROVINCIAL)",
      name: plan.provincialApprovedBy ?? "Provincial DRRM Officer",
      position: "Provincial DRRM Officer - Province of Albay",
      date: plan.provincialApprovedAt ? fmtDate(plan.provincialApprovedAt) : "PENDING PROVINCIAL APPROVAL",
      ok: provinceApproved,
    },
  ];

  sigBlocks.forEach((b, i) => {
    const by = y - (i % 2 === 0 ? 0 : 0) - Math.floor(i / 2) * blockH;
    // only two rows
    sigTitle(b.x, by, b.role);
    page.drawLine({ start: { x: b.x, y: by - 34 }, end: { x: b.x + colW, y: by - 34 }, thickness: 1, color: SLATE_700 });
    drawTextW(b.name, { x: b.x, y: by - 48, size: 10.5, f: bold, color: b.ok ? SLATE_900 : AMBER });
    for (const [j, line] of wrapPdf(b.position, font, 8.5, colW).entries()) {
      drawTextW(line, { x: b.x, y: by - 60 - j * 11, size: 8.5, f: font, color: SLATE_500 });
    }
    drawTextW(b.date, { x: b.x, y: by - 84, size: 8.5, f: font, color: b.ok ? SLATE_700 : AMBER });
  });

  y -= blockH * 2 + 6;

  if (!provinceApproved) {
    ensure(56);
    page.drawRectangle({ x: MARGIN, y: y - 44, width: CONTENT_W, height: 48, color: GOLD, opacity: 0.12, borderColor: GOLD, borderWidth: 1 });
    drawTextW("PENDING PROVINCIAL DRRM OFFICER APPROVAL", { x: MARGIN + 10, y: y - 16, size: 9.5, f: bold, color: AMBER });
    drawTextW(
      "This document is not yet finalized. The generated plan must be approved by the Provincial DRRM Officer -",
      { x: MARGIN + 10, y: y - 28, size: 8, f: font, color: SLATE_700 }
    );
    drawTextW(
      "once recorded by the MDRRMO, the approval name and date are printed here and the plan is sealed APPROVED.",
      { x: MARGIN + 10, y: y - 39, size: 8, f: font, color: SLATE_700 }
    );
    y -= 56;
  } else if (plan.provincialNote) {
    ensure(28);
    drawTextW("PROVINCIAL NOTE:", { x: MARGIN, y, size: 8, f: bold, color: SLATE_500 });
    y -= 12;
    for (const line of wrapPdf(plan.provincialNote, font, 9, CONTENT_W - 6).slice(0, 3)) {
      drawTextW(line, { x: MARGIN + 6, y, size: 9, f: font });
      y -= 12;
    }
  }

  ensure(30);
  drawTextW(
    `Generated by QAS33 - BDRRMP Monitoring System, MDRRMO Pio Duran - ${fmtDateTime(new Date())}${plan.lastExportFormat ? "" : ""}`,
    { x: MARGIN, y: Math.max(y, FOOTER_Y + 8), size: 7.5, f: font, color: SLATE_400 }
  );

  // ---- Footers (all pages) ----------------------------------------------------
  const generated = fmtDate(new Date());
  const refSuffix = plan.docRef ?? "QAS33 DRAFT";
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: 42 }, end: { x: A4[0] - MARGIN, y: 42 }, thickness: 0.5, color: SLATE_200 });
    const footer = `${cover.bodyFooterTitle} - Barangay ${barangay.name} - Page ${i + 1} of ${pages.length} - ${refSuffix}`;
    p.drawText(toWinAnsi(footer), { x: MARGIN, y: 30, size: 7, font, color: SLATE_400 });
  });

  return pdf.save();
}

// ===========================================================================
// DOCX (docx package)
// ===========================================================================

const DOCX_GRAY = "64748B";
const DOCX_DARK = "0F172A";
const DOCX_BLUE = "042189";
const DOCX_LIGHT = "94A3B8";
const DOCX_TEAL = "0F7A6E";
const DOCX_AMBER = "B46A00";

function docxLabel(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 140, after: 20 },
    children: [new TextRun({ text: label.toUpperCase(), bold: true, smallCaps: true, size: 15, color: DOCX_GRAY })],
  });
}

function docxValueLines(lines: string[]): Paragraph[] {
  return lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 20 },
        children: [
          new TextRun({ text: line === "—" ? "—" : line, size: 20, color: line === "—" ? DOCX_LIGHT : DOCX_DARK }),
        ],
      })
  );
}

function emptyDocxRow(colCount: number): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: colCount,
        children: [new Paragraph({ children: [new TextRun({ text: "(no entries)", italics: true, size: 16, color: DOCX_LIGHT })] })],
      }),
    ],
  });
}

function docxTable(field: PlanFieldDef, raw: unknown): Table {
  const cols = field.columns ?? [];
  const rows = nonEmptyRows(raw);
  const weights = cols.map((c) => Math.max(8, c.labelEn.length));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const pct = weights.map((w) => Math.round((w / wsum) * 100));

  const header = new TableRow({
    tableHeader: true,
    children: cols.map(
      (c, i) =>
        new TableCell({
          shading: { fill: DOCX_BLUE, type: ShadingType.CLEAR, color: "auto" },
          width: { size: Math.max(6, pct[i]), type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({ children: [new TextRun({ text: c.labelEn.toUpperCase(), bold: true, size: 14, color: "FFFFFF" })] }),
          ],
        })
    ),
  });

  const body = rows.map(
    (row) =>
      new TableRow({
        children: cols.map(
          (c, i) =>
            new TableCell({
              width: { size: Math.max(6, pct[i]), type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun({ text: cellText(row[c.key]), size: 16 })] })],
            })
        ),
      })
  );

  const border = { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" };
  const allRows = rows.length > 0 ? [header, ...body] : [header, emptyDocxRow(cols.length)];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: border,
      bottom: border,
      left: border,
      right: border,
      insideHorizontal: border,
      insideVertical: border,
    },
    rows: allRows,
  });
}

function docxCenter(text: string, opts: { size: number; bold?: boolean; color?: string; after?: number }): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: opts.after ?? 40 },
    children: [new TextRun({ text, bold: opts.bold, size: opts.size, color: opts.color ?? DOCX_DARK })],
  });
}

export async function generatePlanDocx(input: PlanExportInput): Promise<Uint8Array> {
  const { plan, builder, sections, barangay } = input;
  const values = parseValues(plan);
  const statusText = planStatusText(plan.status);
  const isBdp = builder.code === "BDP_PLAN";
  const cover = officialCover(builder.code, barangay.name, plan.year, values);
  const provinceApproved = plan.status === "PROVINCE_APPROVED" && !!plan.provincialApprovedBy;

  const blocks: Array<Paragraph | Table> = [];

  // ---- Official cover ---------------------------------------------------------
  for (const line of cover.republicLines) {
    blocks.push(line ? docxCenter(line, { size: 20, after: 20 }) : new Paragraph({ spacing: { after: 60 }, children: [] }));
  }
  for (const titleLine of cover.title.split("\n")) {
    blocks.push(docxCenter(titleLine, { size: 34, bold: true, color: DOCX_BLUE, after: 40 }));
  }
  if (cover.subtitle) blocks.push(docxCenter(cover.subtitle, { size: 26, bold: true, after: 40 }));
  for (const locLine of cover.location.split("\n")) {
    blocks.push(docxCenter(locLine, { size: 22, bold: true, after: 30 }));
  }
  if (cover.periodLine) blocks.push(docxCenter(cover.periodLine, { size: 22, after: 30 }));
  if (cover.pursuant) blocks.push(docxCenter(cover.pursuant, { size: 18, color: DOCX_GRAY, after: 30 }));
  blocks.push(docxCenter("Purok Boundary Map available in the MDRRMO Google Drive map inventory", { size: 16, color: DOCX_LIGHT, after: 80 }));

  blocks.push(
    docxCenter(
      provinceApproved
        ? "APPROVED — PROVINCIAL DRRM OFFICER"
        : plan.status === "APPROVED"
          ? "APPROVED BY MDRRMO — PENDING PROVINCIAL APPROVAL"
          : statusText.toUpperCase(),
      { size: 20, bold: true, color: provinceApproved ? DOCX_TEAL : plan.status === "APPROVED" ? DOCX_AMBER : DOCX_GRAY, after: 60 }
    ),
    docxCenter(cover.preparedLine, { size: 20, bold: true, after: 30 }),
    docxCenter(`${barangayLabel(barangay.name)} (${barangay.code}) • Municipality of Pio Duran, Province of Albay`, { size: 16, color: DOCX_GRAY, after: 40 }),
    docxCenter(
      `QAS33 record — Status: ${statusText} · Progress: ${plan.progress}% · MDRRMO Review: ${
        plan.reviewedAt ? `${fmtDate(plan.reviewedAt)} by ${plan.reviewedBy}` : "—"
      } · Provincial Approval: ${
        plan.provincialApprovedAt ? `${fmtDate(plan.provincialApprovedAt)} by ${plan.provincialApprovedBy}` : "PENDING"
      } · ${plan.docRef ? `Document Ref: ${plan.docRef}` : "DRAFT"}`,
      { size: 15, color: DOCX_LIGHT, after: 200 }
    )
  );

  // ---- Sections ----------------------------------------------------------------
  let lastGroup: string | null = null;
  for (const section of sections) {
    if (section.group && section.group !== lastGroup) {
      lastGroup = section.group;
      blocks.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          shading: { fill: "334155", type: ShadingType.CLEAR, color: "auto" },
          children: [new TextRun({ text: section.group, bold: true, color: "FFFFFF" })],
        })
      );
    }
    blocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: section.title, bold: true, color: DOCX_DARK })],
      })
    );

    // BDRRMP Part IV — standard legal basis first
    if (section.code === "bdrrm_s10_legal") {
      blocks.push(docxLabel("International"));
      blocks.push(...docxValueLines([BDRRM_LEGAL_INTERNATIONAL]));
      blocks.push(docxLabel("National"));
      blocks.push(...docxValueLines([BDRRM_LEGAL_NATIONAL]));
      const localVal = String(values.legal_local ?? "").trim();
      blocks.push(docxLabel("Local"));
      blocks.push(
        ...docxValueLines([
          localVal ? `${BDRRM_LEGAL_LOCAL_PREFIX} ${localVal}` : `${BDRRM_LEGAL_LOCAL_PREFIX} (references to be provided)`,
        ])
      );
    }

    for (const field of section.fields) {
      if (field.type === "table") {
        blocks.push(docxLabel(field.labelEn));
        blocks.push(docxTable(field, values[field.key]));
        blocks.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
      } else {
        blocks.push(docxLabel(field.labelEn));
        blocks.push(...docxValueLines(scalarLines(values[field.key], field.unit)));
      }
    }
  }

  // ---- BDRRMP annexes ------------------------------------------------------------
  if (!isBdp) {
    blocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        shading: { fill: "334155", type: ShadingType.CLEAR, color: "auto" },
        children: [new TextRun({ text: "VIII. ANNEXES", bold: true, color: "FFFFFF" })],
      })
    );
    blocks.push(docxCenter("(attached to the official transmitted copy)", { size: 16, color: DOCX_GRAY, after: 60 }));
    for (const a of BDRRM_ANNEXES) {
      blocks.push(new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: `–  ${a}`, size: 20 })] }));
    }
  }

  // ---- Certification & approval page ----------------------------------------------
  const preparedName =
    String(values.prepared_by ?? "").trim() || (isBdp ? "BDC Secretariat" : "BDRRMC Chairperson / Secretary");
  const notedName = String(values.noted_by ?? "").trim() || barangay.captain || "Punong Barangay";

  blocks.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      shading: { fill: DOCX_BLUE, type: ShadingType.CLEAR, color: "auto" },
      pageBreakBefore: true,
      children: [new TextRun({ text: "CERTIFICATION AND APPROVAL", bold: true, color: "FFFFFF" })],
    }),
    docxCenter(
      isBdp
        ? `Barangay Development Plan (BDP) — ${barangayLabel(barangay.name)}, Pio Duran, Albay`
        : `Barangay BDRRM Plan — ${barangayLabel(barangay.name)}, Pio Duran, Albay`,
      { size: 22, after: 30 }
    ),
    docxCenter(
      `${plan.docRef ? `Document Ref: ${plan.docRef} · ` : ""}${statusText}${plan.reviewedAt ? ` · MDRRMO approval: ${fmtDate(plan.reviewedAt)}` : ""}`,
      { size: 18, color: provinceApproved ? DOCX_TEAL : DOCX_GRAY, after: 160 }
    )
  );

  const sigTableRows: TableRow[] = [];
  const sigCell = (role: string, name: string, position: string, date: string, ok: boolean): TableCell =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      margins: { top: 200, bottom: 200, left: 200, right: 300 },
      children: [
        new Paragraph({ children: [new TextRun({ text: role, bold: true, smallCaps: true, size: 15, color: DOCX_GRAY })] }),
        new Paragraph({ spacing: { before: 500 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_DARK } }, children: [new TextRun({ text: name, bold: true, size: 21, color: ok ? DOCX_DARK : DOCX_AMBER })] }),
        new Paragraph({ children: [new TextRun({ text: position, size: 17, color: DOCX_GRAY })] }),
        new Paragraph({ children: [new TextRun({ text: date, size: 17, color: ok ? DOCX_DARK : DOCX_AMBER })] }),
      ],
    });

  sigTableRows.push(
    new TableRow({
      children: [
        sigCell("PREPARED BY", preparedName, isBdp ? "Barangay Development Council Secretariat" : "BDRRMC Chairperson / Secretariat", plan.submittedAt ? fmtDate(plan.submittedAt) : "Date: ______________", true),
        sigCell("NOTED BY", notedName, "Punong Barangay / BDC-BDRRMC Chairperson", "Date: ______________", true),
      ],
    }),
    new TableRow({
      children: [
        sigCell("REVIEWED AND APPROVED BY (MUNICIPAL)", plan.reviewedBy ?? "Municipal DRRM Officer", "Municipal DRRM Officer — Pio Duran, Albay", plan.reviewedAt ? fmtDate(plan.reviewedAt) : "pending MDRRMO review", !!plan.reviewedAt),
        sigCell("APPROVED BY (PROVINCIAL)", plan.provincialApprovedBy ?? "Provincial DRRM Officer", "Provincial DRRM Officer — Province of Albay", plan.provincialApprovedAt ? fmtDate(plan.provincialApprovedAt) : "PENDING PROVINCIAL APPROVAL", provinceApproved),
      ],
    })
  );
  blocks.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "auto" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
        left: { style: BorderStyle.NONE, size: 0, color: "auto" },
        right: { style: BorderStyle.NONE, size: 0, color: "auto" },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
      },
      rows: sigTableRows,
    })
  );

  if (!provinceApproved) {
    blocks.push(
      new Paragraph({
        spacing: { before: 300, after: 40 },
        shading: { fill: "FEF3C7", type: ShadingType.CLEAR, color: "auto" },
        children: [new TextRun({ text: "PENDING PROVINCIAL DRRM OFFICER APPROVAL", bold: true, size: 19, color: DOCX_AMBER })],
      }),
      new Paragraph({
        spacing: { after: 300 },
        children: [
          new TextRun({
            text: "This document is not yet finalized. The generated plan must be approved by the Provincial DRRM Officer — once recorded by the MDRRMO, the approval name and date are printed on this page and the document is sealed APPROVED.",
            size: 17,
            color: DOCX_DARK,
          }),
        ],
      })
    );
  } else if (plan.provincialNote) {
    blocks.push(
      new Paragraph({
        spacing: { before: 200 },
        children: [new TextRun({ text: `Provincial note: ${plan.provincialNote}`, italics: true, size: 17, color: DOCX_GRAY })],
      })
    );
  }

  const doc = new Document({
    creator: "QAS33 - MDRRMO Pio Duran",
    title: `${builder.titleEn} ${plan.year} - ${barangay.name}`,
    description: `${cover.bodyFooterTitle} — Barangay ${barangay.name} — ${statusText}`,
    styles: {
      default: {
        document: { run: { font: "Arial", size: 20 } },
        heading1: { run: { font: "Arial", size: 22, bold: true, color: "FFFFFF" } },
        heading2: { run: { font: "Arial", size: 24, bold: true, color: DOCX_DARK } },
      },
    },
    sections: [
      {
        properties: {},
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    size: 14,
                    color: DOCX_LIGHT,
                    children: [
                      `${cover.bodyFooterTitle} - Barangay ${barangay.name} - Page `,
                      PageNumber.CURRENT,
                      " of ",
                      PageNumber.TOTAL_PAGES,
                      ` - ${plan.docRef ?? "QAS33 DRAFT"}`,
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        children: blocks,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
