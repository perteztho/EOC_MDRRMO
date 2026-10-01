// QAS33 e-Serbisyo — official barangay service document PDF generator (pdf-lib)
//
// Produces a Philippine barangay-style document on US LETTER (portrait, 72pt
// margins, Times family): Republic/Province/Municipality/Office/BARANGAY
// header, letter-spaced title, certification body (certificates) or labelled
// two-column sections (AARL / Spot Report), signature blocks, QR verification
// footer and DRAFT / CANCELLED watermarks. Multi-page content repeats a
// compact header + control number.
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { promises as fs } from "fs";
import path from "path";
import {
  barangayLabel,
  buildCertificateBody,
  buildReportSections,
  formatDatePh,
  getServiceDocType,
  type DocRun,
  type ServiceDocData,
} from "./services-templates";

const LETTER: [number, number] = [612, 792]; // US Letter portrait
const MARGIN = 72;
const CONTENT_W = LETTER[0] - MARGIN * 2; // 468
const CONTENT_BOTTOM = 150; // content must stay above the QR / footer band
const QR_SIZE = 48;

const GOV_BLUE = rgb(0x04 / 255, 0x21 / 255, 0x89 / 255);
const GOV_GOLD = rgb(0xfc / 255, 0xcf / 255, 0x03 / 255);
const INK = rgb(0.13, 0.13, 0.13);
const GRAY = rgb(0.42, 0.45, 0.5);
const LABEL = rgb(0.25, 0.28, 0.33);
const LIGHT_RULE = rgb(0.78, 0.8, 0.84);
const WATERMARK = rgb(0.88, 0.89, 0.91);

/** pdf-lib Times fonts use WinAnsi — strip/replace anything it cannot encode. */
function toWinAnsi(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/₱/g, "PHP ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•·]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, "");
}

export interface ServicePdfDoc {
  docType: string;
  controlNo: string;
  status: string; // DRAFT | ISSUED | CANCELLED
  data: ServiceDocData;
  issuedAt?: Date | null;
}

export interface GenerateServicePdfParams {
  doc: ServicePdfDoc;
  barangay: { code: string; name: string; captain?: string | null };
  /** Site origin for the QR verification link. */
  origin?: string;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

interface Token {
  word: string;
  bold?: boolean;
  italic?: boolean;
}

function tokenize(runs: DocRun[]): Token[] {
  const tokens: Token[] = [];
  for (const run of runs) {
    for (const word of toWinAnsi(run.text).split(/\s+/)) {
      if (word) tokens.push({ word, bold: run.bold, italic: run.italic });
    }
  }
  return tokens;
}

function fontFor(tk: Token, fonts: Fonts): PDFFont {
  return tk.bold ? fonts.bold : tk.italic ? fonts.italic : fonts.regular;
}

function wrapTokens(tokens: Token[], size: number, maxWidth: number, fonts: Fonts): Token[][] {
  const out: Token[][] = [];
  let line: Token[] = [];
  let lineW = 0;
  const spaceW = fonts.regular.widthOfTextAtSize(" ", size);
  for (const tk of tokens) {
    const w = fontFor(tk, fonts).widthOfTextAtSize(tk.word, size);
    const add = line.length ? spaceW + w : w;
    if (line.length === 0 || lineW + add <= maxWidth) {
      line.push(tk);
      lineW += add;
    } else {
      out.push(line);
      line = [tk];
      lineW = w;
    }
  }
  if (line.length) out.push(line);
  return out.length ? out : [[]];
}

function drawTokenLine(page: PDFPage, tokens: Token[], x: number, y: number, size: number, fonts: Fonts, color = INK) {
  const spaceW = fonts.regular.widthOfTextAtSize(" ", size);
  let cx = x;
  for (const tk of tokens) {
    const font = fontFor(tk, fonts);
    // no space before punctuation that belongs to the previous word (e.g. "CRUZ ," → "CRUZ,")
    if (cx > x && !/^[,.;:!?%)]/.test(tk.word)) cx += spaceW;
    page.drawText(tk.word, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(tk.word, size);
  }
}

export async function generateServicePdf(params: GenerateServicePdfParams): Promise<Buffer> {
  const { doc, barangay } = params;
  const def = getServiceDocType(doc.docType);
  if (!def) throw new Error(`Unknown service document type: ${doc.docType}`);

  const origin = params.origin || "https://pioduranqas33.space-z.ai";
  const verifyUrl = `${origin}/?verify=${doc.controlNo}`;
  const isReport = def.category === "drrm-reports";
  const issuedDate = doc.issuedAt ?? new Date();
  const dateIso = issuedDate.toISOString().slice(0, 10);
  const dateText = formatDatePh(dateIso) || "";

  const pdf = await PDFDocument.create();
  pdf.setTitle(toWinAnsi(`${def.label} - Barangay ${barangay.name}`));
  pdf.setAuthor("QAS33 e-Serbisyo - MDRRMO Pio Duran");
  pdf.setSubject(doc.controlNo);

  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.TimesRoman),
    bold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    italic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
  };

  const qrPng = await QRCode.toBuffer(verifyUrl, { type: "png", width: 220, margin: 1 });
  const qrImage = await pdf.embedPng(qrPng);

  let page!: PDFPage;
  let y = 0;
  let pageNum = 0;

  const drawFooter = () => {
    // thin rule + left meta lines
    page.drawLine({ start: { x: MARGIN, y: 64 }, end: { x: LETTER[0] - MARGIN, y: 64 }, thickness: 0.5, color: LIGHT_RULE });
    page.drawText(toWinAnsi(`QAS33 e-Serbisyo • ${doc.controlNo}`), {
      x: MARGIN,
      y: 52,
      size: 7,
      font: fonts.regular,
      color: GRAY,
    });
    page.drawText("ISSUED ELECTRONICALLY THROUGH QAS33", {
      x: MARGIN,
      y: 42,
      size: 6.5,
      font: fonts.italic,
      color: GRAY,
    });
    const pageLabel = `Page ${pageNum}`;
    page.drawText(pageLabel, {
      x: LETTER[0] - 40 - fonts.regular.widthOfTextAtSize(pageLabel, 7),
      y: 52,
      size: 7,
      font: fonts.regular,
      color: GRAY,
    });
    // QR verification block (right margin band)
    page.drawImage(qrImage, { x: LETTER[0] - 40 - QR_SIZE, y: 92, width: QR_SIZE, height: QR_SIZE });
    const cap1 = "Verify at";
    page.drawText(cap1, {
      x: LETTER[0] - 40 - QR_SIZE / 2 - fonts.regular.widthOfTextAtSize(cap1, 5.5) / 2,
      y: 84,
      size: 5.5,
      font: fonts.regular,
      color: GRAY,
    });
    // Caption follows the QR's runtime origin (not a hardcoded domain)
    let siteHost = "pioduranqas33.space-z.ai";
    try {
      siteHost = new URL(origin).host;
    } catch {
      // keep default if origin is not a parseable URL
    }
    const cap2 = siteHost;
    page.drawText(cap2, {
      x: LETTER[0] - 40 - QR_SIZE / 2 - fonts.regular.widthOfTextAtSize(cap2, 5.5) / 2,
      y: 76,
      size: 5.5,
      font: fonts.regular,
      color: GRAY,
    });
  };

  const newPage = (compact: boolean) => {
    page = pdf.addPage(LETTER);
    pageNum += 1;
    if (compact) {
      // Compact continuation header: barangay + doc title + control no + rule
      page.drawText(toWinAnsi(`${barangayLabel(barangay.name).toUpperCase()} - ${def!.title}`), {
        x: MARGIN,
        y: LETTER[1] - 46,
        size: 9,
        font: fonts.bold,
        color: GOV_BLUE,
      });
      const cn = `Control No. ${doc.controlNo}`;
      page.drawText(cn, {
        x: LETTER[0] - 40 - fonts.regular.widthOfTextAtSize(cn, 8),
        y: LETTER[1] - 45,
        size: 8,
        font: fonts.regular,
        color: GRAY,
      });
      page.drawLine({
        start: { x: MARGIN, y: LETTER[1] - 56 },
        end: { x: LETTER[0] - MARGIN, y: LETTER[1] - 56 },
        thickness: 0.7,
        color: GOV_BLUE,
      });
      y = LETTER[1] - 80;
    } else {
      y = LETTER[1] - 66;
    }
    drawFooter();
  };

  const ensure = (needed: number) => {
    if (y - needed < CONTENT_BOTTOM) {
      newPage(true);
    }
  };

  // ===================== PAGE 1 — full official header =====================
  newPage(false);

  // Control No. + date (top-right corner, small)
  const cnLabel = `Control No. ${doc.controlNo}`;
  page.drawText(cnLabel, {
    x: LETTER[0] - 40 - fonts.regular.widthOfTextAtSize(cnLabel, 8),
    y: LETTER[1] - 40,
    size: 8,
    font: fonts.regular,
    color: GRAY,
  });
  const dtLabel = `Date ${dateText}`;
  page.drawText(dtLabel, {
    x: LETTER[0] - 40 - fonts.regular.widthOfTextAtSize(dtLabel, 8),
    y: LETTER[1] - 51,
    size: 8,
    font: fonts.regular,
    color: GRAY,
  });

  const centerText = (text: string, yy: number, size: number, font: PDFFont, color = INK) => {
    const t = toWinAnsi(text);
    page.drawText(t, { x: (LETTER[0] - font.widthOfTextAtSize(t, size)) / 2, y: yy, size, font, color });
  };

  const headerLines: Array<[string, number, PDFFont]> = [
    ["Republic of the Philippines", 11, fonts.regular],
    ["Province of Albay", 11, fonts.regular],
    ["Municipality of Pio Duran", 12, fonts.bold],
    ["Office of the Punong Barangay", 10.5, fonts.regular],
  ];
  for (const [text, size, font] of headerLines) {
    centerText(text, y, size, font);
    y -= size + 5.5;
  }
  centerText(barangayLabel(barangay.name).toUpperCase(), y, 13, fonts.bold, GOV_BLUE);
  y -= 18;
  // double rule under the header (blue + gold)
  page.drawLine({ start: { x: MARGIN, y }, end: { x: LETTER[0] - MARGIN, y }, thickness: 1.1, color: GOV_BLUE });
  page.drawLine({ start: { x: MARGIN, y: y - 2.5 }, end: { x: LETTER[0] - MARGIN, y: y - 2.5 }, thickness: 0.6, color: GOV_GOLD });

  // Title — bold, letter-spaced
  y -= 34;
  const spacedTitle = def.title.split("").join(" ");
  centerText(spacedTitle, y, 14, fonts.bold, GOV_BLUE);
  y -= 10;

  // ===================== BODY =====================
  if (!isReport) {
    // ---- certificates / permits ----
    const paragraphs = buildCertificateBody(def.key, doc.data, barangay.name, dateIso);
    y -= 22;
    for (const para of paragraphs) {
      const tokens = tokenize(para.runs);
      const lines = wrapTokens(tokens, 11, CONTENT_W, fonts);
      ensure(Math.min(140, lines.length * 16.5 + 14));
      for (const line of lines) {
        ensure(16.5);
        if (para.align === "center") {
          const lineW =
            line.reduce((acc, tk) => acc + fontFor(tk, fonts).widthOfTextAtSize(tk.word, 11), 0) +
            (line.length - 1) * fonts.regular.widthOfTextAtSize(" ", 11);
          drawTokenLine(page, line, (LETTER[0] - lineW) / 2, y, 11, fonts);
        } else {
          drawTokenLine(page, line, MARGIN, y, 11, fonts);
        }
        y -= 16.5;
      }
      y -= 7;
    }

    // CTC / O.R. / Fee block (clearance only) — bottom-left, small
    if (def.key === "BRGY_CLEARANCE") {
      const d = doc.data;
      const meta: string[] = [];
      if (d.ctcNo?.trim()) meta.push(`CTC No.: ${d.ctcNo.trim()}`);
      if (d.orNo?.trim()) meta.push(`O.R. No.: ${d.orNo.trim()}`);
      if (d.orDate?.trim()) meta.push(`O.R. Date: ${formatDatePh(d.orDate) || d.orDate.trim()}`);
      if (d.fee?.trim()) meta.push(`Fee: PHP ${d.fee.trim()}.00`);
      if (meta.length) {
        ensure(meta.length * 12 + 30);
        y -= 8;
        for (const m of meta) {
          page.drawText(toWinAnsi(m), { x: MARGIN, y, size: 8.5, font: fonts.regular, color: GRAY });
          y -= 12;
        }
      }
    }

    // Signature block — anchored to the lower portion of the page. The block
    // spans [y+7, y+34]; it must stay above CONTENT_BOTTOM, so if the body
    // already ended low we push the signatures to a fresh page.
    if (y > 270) y = 215; // plenty of room below the body → anchor low
    if (y < 145) {
      newPage(true);
      y = 215;
    }
    const sigLineW = 210;
    const sigX = (LETTER[0] - sigLineW) / 2;
    const captainName = barangay.captain?.trim();
    page.drawLine({ start: { x: sigX, y: y + 34 }, end: { x: sigX + sigLineW, y: y + 34 }, thickness: 0.8, color: INK });
    const sigName = captainName ? `HON. ${captainName.toUpperCase()}` : "PUNONG BARANGAY";
    centerText(sigName, y + 20, 11.5, fonts.bold);
    centerText("Punong Barangay", y + 7, 10, fonts.regular);
  } else {
    // ---- AARL / Spot Report — labelled two-column sections ----
    const sections = buildReportSections(def.key, doc.data, barangay.name);
    y -= 12;
    const labelColW = 150;
    const valueX = MARGIN + labelColW + 8;
    const valueW = CONTENT_W - labelColW - 8;
    for (const section of sections) {
      const labelLines = wrapTokens(tokenize([{ text: section.label.toUpperCase() }]), 8.5, labelColW, fonts);
      const valueLines = section.lines.flatMap((l) => wrapTokens(tokenize([{ text: l }]), 10.5, valueW, fonts));
      const blockH = Math.max(labelLines.length, valueLines.length) * 13.5 + 12;
      // Small sections move wholesale to a fresh page; taller ones may split
      // (their value column continues under a compact header on the next page).
      ensure(Math.min(150, blockH));
      let ly = y;
      for (const line of labelLines) {
        drawTokenLine(page, line, MARGIN, ly, 8.5, fonts, LABEL);
        ly -= 13.5;
      }
      let vy = y;
      let split = false;
      for (const line of valueLines) {
        if (vy < CONTENT_BOTTOM + 6) {
          newPage(true);
          vy = y;
          split = true;
        }
        drawTokenLine(page, line, valueX, vy, 10.5, fonts);
        vy -= 13.5;
      }
      if (split) {
        // value column continued onto a new page — continue there
        y = vy;
        page.drawLine({ start: { x: MARGIN, y: y + 5 }, end: { x: LETTER[0] - MARGIN, y: y + 5 }, thickness: 0.4, color: LIGHT_RULE });
      } else {
        y = Math.min(ly, vy) - 12;
        page.drawLine({ start: { x: MARGIN, y: y + 5 }, end: { x: LETTER[0] - MARGIN, y: y + 5 }, thickness: 0.4, color: LIGHT_RULE });
      }
      y -= 4;
    }

    // Two signature lines: Prepared by (left) + Noted by PB (right).
    // Block spans [y+15, y+94] — anchor low when there is a big gap, and only
    // break to a fresh page when the block would intrude into the footer band.
    if (y > 330) y = 250;
    if (y < 145) {
      newPage(true);
      y = 250;
    }
    const colW = (CONTENT_W - 24) / 2;
    const leftX = MARGIN;
    const rightX = MARGIN + colW + 24;
    const drawSignCol = (x: number, lead: string, name: string | null, position: string, nameFallback: string) => {
      page.drawText(toWinAnsi(lead), { x, y: y + 84, size: 9.5, font: fonts.bold, color: INK });
      page.drawLine({ start: { x, y: y + 42 }, end: { x: x + colW - 10, y: y + 42 }, thickness: 0.8, color: INK });
      const shown = name?.trim() ? name.trim() : nameFallback;
      page.drawText(toWinAnsi(shown), { x, y: y + 28, size: 10.5, font: fonts.bold, color: INK });
      page.drawText(toWinAnsi(position), { x, y: y + 15, size: 9, font: fonts.regular, color: GRAY });
    };
    const captainName = barangay.captain?.trim();
    drawSignCol(
      leftX,
      "Prepared by:",
      doc.data.preparedBy?.trim() || null,
      doc.data.preparedByPosition?.trim() || "Barangay DRRM Coordinator",
      "(Name of Preparer)"
    );
    drawSignCol(
      rightX,
      "Noted by:",
      captainName ? `HON. ${captainName}` : null,
      "Punong Barangay",
      "PUNONG BARANGAY"
    );
  }

  // ===================== WATERMARK =====================
  if (doc.status === "DRAFT" || doc.status === "CANCELLED") {
    const text = doc.status === "DRAFT" ? "DRAFT - NOT YET ISSUED" : "CANCELLED";
    const wmFont = fonts.bold;
    const size = 40;
    const w = wmFont.widthOfTextAtSize(text, size);
    const diag = w * Math.SQRT1_2; // horizontal span of the rotated text
    for (const p of pdf.getPages()) {
      p.drawText(text, {
        x: (LETTER[0] - diag) / 2,
        y: (LETTER[1] - diag) / 2 - 60,
        size,
        font: wmFont,
        color: WATERMARK,
        rotate: degrees(45),
      });
    }
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

// ---------------------------------------------------------------------------
// Stored PDF helpers — db/storage/services/<controlNo>.pdf
// ---------------------------------------------------------------------------

const STORAGE_ROOT = path.join(process.cwd(), "db", "storage");

export async function saveServicePdf(controlNo: string, buffer: Buffer): Promise<string> {
  const safe = controlNo.replace(/[^a-zA-Z0-9-]/g, "");
  const key = path.join("services", `${safe}.pdf`);
  const abs = path.join(STORAGE_ROOT, key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return key;
}

export async function readServicePdf(fileKey: string): Promise<Buffer | null> {
  const abs = path.join(STORAGE_ROOT, fileKey);
  if (!abs.startsWith(STORAGE_ROOT + path.sep)) return null;
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

export async function deleteServicePdf(fileKey: string): Promise<void> {
  const abs = path.join(STORAGE_ROOT, fileKey);
  if (!abs.startsWith(STORAGE_ROOT + path.sep)) return;
  try {
    await fs.unlink(abs);
  } catch {
    // ignore missing files
  }
}
