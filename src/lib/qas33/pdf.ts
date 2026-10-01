// QAS33 final BDRRMP PDF generator (pdf-lib + QR verification)
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { SectionDef } from "./types";

const A4: [number, number] = [595.28, 841.89];
const GREEN = rgb(0.055, 0.42, 0.27);
const DARK = rgb(0.12, 0.16, 0.14);
const GRAY = rgb(0.45, 0.5, 0.47);
const LIGHT = rgb(0.93, 0.95, 0.94);

/** pdf-lib StandardFonts encode WinAnsi only — map common Unicode to ASCII-safe
 *  and strip anything unencodable (₱, CJK, emoji…) so user-entered text can
 *  never crash the generator (mirrors plan-export.ts / services-pdf.ts). */
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

export interface GeneratePdfParams {
  barangay: { name: string; code: string };
  submission: { year: number; version: number; lang: string; values: Record<string, unknown> };
  sections: SectionDef[];
  docId: string;
  rating?: { total: number; maxTotal: number; remarks?: string | null } | null;
  signature: { signedBy: string; position: string; signedAt: Date; signatureHash: string };
  settings: { municipality: string; province: string };
  verifyUrl: string;
  approvedAt?: Date | null;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      // hard-break very long words
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

function formatValue(value: unknown, unit?: string): string {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return value.map((v) => `• ${toWinAnsi(String(v))}`).join("\n");
  if (unit && typeof value === "number") {
    return `${value.toLocaleString("en-PH")} ${toWinAnsi(unit)}`;
  }
  return toWinAnsi(String(value));
}

export async function generateBdrrmpPdf(params: GeneratePdfParams): Promise<Buffer> {
  const { barangay, submission, sections, docId, rating, signature, settings, verifyUrl } = params;
  const lang = submission.lang === "TL" ? "TL" : "EN";
  const t = (en: string, tl: string) => (lang === "TL" ? tl : en);
  // Sanitize every dynamic (configurable / user-entered) string once up front
  const municipality = toWinAnsi(settings.municipality);
  const province = toWinAnsi(settings.province);
  const brgyName = toWinAnsi(barangay.name);
  const sigName = toWinAnsi(signature.signedBy);
  const sigPosition = toWinAnsi(signature.position);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`BDRRMP ${submission.year} - ${barangay.name}`);
  pdf.setAuthor(`QAS33 - MDRRMO ${settings.municipality}`);
  pdf.setSubject(docId);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const qrPng = await QRCode.toBuffer(verifyUrl, { type: "png", width: 240, margin: 1 });
  const qrImage = await pdf.embedPng(qrPng);

  const margin = 50;
  const contentWidth = A4[0] - margin * 2;

  const newPage = (): PDFPage => {
    const p = pdf.addPage(A4);
    return p;
  };

  const drawFooter = (p: PDFPage, pageNum: number) => {
    p.drawLine({
      start: { x: margin, y: 42 },
      end: { x: A4[0] - margin, y: 42 },
      thickness: 0.5,
      color: LIGHT,
    });
    p.drawText(`QAS33 • ${municipality} MDRRMO • ${docId}`, {
      x: margin,
      y: 30,
      size: 7.5,
      font,
      color: GRAY,
    });
    const pageLabel = `Page ${pageNum}`;
    p.drawText(pageLabel, {
      x: A4[0] - margin - font.widthOfTextAtSize(pageLabel, 7.5),
      y: 30,
      size: 7.5,
      font,
      color: GRAY,
    });
  };

  const drawHeaderBand = (p: PDFPage) => {
    p.drawRectangle({ x: 0, y: A4[1] - 24, width: A4[0], height: 24, color: GREEN });
    p.drawText(`QAS33 — ${t("BARANGAY DISASTER RISK REDUCTION AND MANAGEMENT PLAN", "PLANO NG BDRRM SA BARANGAY")}`, {
      x: margin,
      y: A4[1] - 16,
      size: 8.5,
      font: bold,
      color: rgb(1, 1, 1),
    });
    p.drawText(`${submission.year}`, {
      x: A4[0] - margin - font.widthOfTextAtSize(String(submission.year), 8.5),
      y: A4[1] - 16,
      size: 8.5,
      font: bold,
      color: rgb(1, 1, 1),
    });
  };

  // ===================== COVER PAGE =====================
  {
    const page = newPage();
    page.drawRectangle({ x: 0, y: A4[1] - 150, width: A4[0], height: 150, color: GREEN });
    const centerText = (text: string, y: number, size: number, f: PDFFont, color = rgb(1, 1, 1)) => {
      page.drawText(text, { x: (A4[0] - f.widthOfTextAtSize(text, size)) / 2, y, size, font: f, color });
    };
    centerText("REPUBLIC OF THE PHILIPPINES", A4[1] - 45, 11, font);
    centerText(`PROVINCE OF ${province.toUpperCase()}`, A4[1] - 63, 11, font);
    centerText(`MUNICIPALITY OF ${municipality.toUpperCase()}`, A4[1] - 81, 13, bold);
    centerText("OFFICE OF THE MUNICIPAL DISASTER RISK REDUCTION AND MANAGEMENT OFFICER", A4[1] - 99, 8.5, font);
    centerText("QAS33", A4[1] - 130, 20, bold);

    let y = A4[1] - 220;
    centerText(
      t("BARANGAY DISASTER RISK REDUCTION", "PLANO NG PAGBABAWAS NG PANGANIB"),
      y,
      17,
      bold,
      DARK
    );
    y -= 24;
    centerText(t("AND MANAGEMENT PLAN (BDRRMP)", "AT PAMAMAHALA SA BARANGAY (BDRRMP)"), y, 17, bold, DARK);
    y -= 30;
    centerText(`${t("Barangay", "Barangay")} ${brgyName.toUpperCase()}`, y, 15, bold, GREEN);
    y -= 22;
    centerText(`${t("Fiscal Year", "Taong Pananalapi")} ${submission.year}`, y, 12, font, GRAY);

    // Info box
    const boxY = y - 130;
    const boxH = 105;
    page.drawRectangle({ x: margin, y: boxY, width: contentWidth, height: boxH, color: LIGHT, opacity: 0.45 });
    const label = (labelText: string, valueText: string, yy: number) => {
      page.drawText(labelText, { x: margin + 18, y: yy, size: 9.5, font: bold, color: GRAY });
      page.drawText(valueText, { x: margin + 190, y: yy, size: 9.5, font, color: DARK });
    };
    label(t("Document ID", "ID ng Dokumento"), docId, boxY + boxH - 24);
    label(t("Status", "Katayuan"), t("APPROVED", "APRUBADO"), boxY + boxH - 44);
    label(t("Version", "Bersyon"), `v${submission.version}`, boxY + boxH - 64);
    label(t("Date Approved", "Petsa ng Pag-apruba"), fmtDate(params.approvedAt ?? signature.signedAt), boxY + boxH - 84);

    // QR
    const qrSize = 110;
    const qrY = 95;
    page.drawImage(qrImage, { x: (A4[0] - qrSize) / 2, y: qrY, width: qrSize, height: qrSize });
    page.drawText(t("Scan to verify this document", "I-scan upang beripikahin ang dokumentong ito"), {
      x: (A4[0] - font.widthOfTextAtSize(t("Scan to verify this document", "I-scan upang beripikahin ang dokumentong ito"), 8)) / 2,
      y: qrY - 14,
      size: 8,
      font,
      color: GRAY,
    });
    drawFooter(page, 1);
  }

  // ===================== METADATA + RATING PAGE =====================
  {
    const page = newPage();
    drawHeaderBand(page);
    let y = A4[1] - 60;
    page.drawText(t("DOCUMENT INFORMATION", "IMPORMASYON NG DOKUMENTO"), { x: margin, y, size: 13, font: bold, color: GREEN });
    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: A4[0] - margin, y }, thickness: 1, color: GREEN });
    y -= 22;
    const rows: Array<[string, string]> = [
      [t("Document ID", "ID ng Dokumento"), docId],
      [t("Document Type", "Uri ng Dokumento"), "Barangay DRRM Plan (BDRRMP)"],
      [t("Municipality", "Munisipyo"), municipality + ", " + province],
      [t("Barangay", "Barangay"), `${brgyName} (${barangay.code})`],
      [t("Plan Year", "Taon ng Plano"), String(submission.year)],
      [t("Version", "Bersyon"), `v${submission.version}`],
      [t("Template Language", "Wika ng Template"), lang === "TL" ? "Tagalog" : "English"],
      [t("Status", "Katayuan"), t("APPROVED", "APRUBADO")],
      [t("Generated", "Nilikha"), fmtDate(signature.signedAt)],
    ];
    for (const [k, v] of rows) {
      page.drawText(k, { x: margin, y, size: 9.5, font: bold, color: GRAY });
      page.drawText(v, { x: margin + 170, y, size: 9.5, font, color: DARK });
      y -= 18;
    }

    if (rating) {
      y -= 16;
      page.drawText(t("MDRRMO EVALUATION RESULT", "RESULTA NG PAGSUSURI NG MDRRMO"), { x: margin, y, size: 13, font: bold, color: GREEN });
      y -= 10;
      page.drawLine({ start: { x: margin, y }, end: { x: A4[0] - margin, y }, thickness: 1, color: GREEN });
      y -= 20;
      page.drawText(`${t("Total Score", "Kabuuang Iskor")}: ${rating.total} / ${rating.maxTotal}`, {
        x: margin,
        y,
        size: 11,
        font: bold,
        color: DARK,
      });
      y -= 18;
      if (rating.remarks) {
        for (const line of wrapText(`${t("Remarks", "Mga Tala")}: ${toWinAnsi(rating.remarks)}`, font, 9.5, contentWidth)) {
          page.drawText(line, { x: margin, y, size: 9.5, font, color: GRAY });
          y -= 13;
        }
      }
    }
    drawFooter(page, 2);
  }

  // ===================== CONTENT SECTIONS =====================
  let pageNum = 3;
  let page = newPage();
  drawHeaderBand(page);
  let y = A4[1] - 60;

  const ensureSpace = (needed: number) => {
    if (y - needed < 70) {
      drawFooter(page, pageNum);
      pageNum += 1;
      page = newPage();
      drawHeaderBand(page);
      y = A4[1] - 60;
    }
  };

  for (const section of sections) {
    const title = toWinAnsi(lang === "TL" ? section.titleTl : section.titleEn);
    const desc = toWinAnsi(lang === "TL" ? section.descTl : section.descEn);
    ensureSpace(60);
    y -= 6;
    page.drawText(`${section.order}. ${title.toUpperCase()}`, { x: margin, y, size: 11.5, font: bold, color: GREEN });
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: A4[0] - margin, y }, thickness: 0.8, color: LIGHT });
    y -= 16;
    if (desc) {
      for (const line of wrapText(desc, font, 8.5, contentWidth)) {
        ensureSpace(14);
        page.drawText(line, { x: margin, y, size: 8.5, font, color: GRAY });
        y -= 12;
      }
      y -= 4;
    }
    for (const field of section.fields) {
      const label = toWinAnsi(lang === "TL" ? field.labelTl : field.labelEn);
      const value = formatValue(submission.values[field.key], field.unit);
      const valueLines = value.split("\n").flatMap((l) => wrapText(l, font, 9.5, contentWidth - 10));
      ensureSpace(30 + valueLines.length * 14);
      page.drawText(label, { x: margin, y, size: 9, font: bold, color: DARK });
      y -= 14;
      for (const line of valueLines) {
        ensureSpace(14); // long values flow onto continuation pages
        page.drawText(line, { x: margin + 10, y, size: 9.5, font, color: rgb(0.2, 0.24, 0.22) });
        y -= 14;
      }
      y -= 6;
    }
    if (section.requiresUpload) {
      const uploadLabel = toWinAnsi((lang === "TL" ? section.uploadLabelTl : section.uploadLabelEn) || title);
      ensureSpace(28);
      page.drawText(
        `${t("Attachment", "Kalakip")}: ${uploadLabel} — ${t("(see attached files in QAS33)", "(tingnan ang mga kalakip sa QAS33)")}`,
        { x: margin, y, size: 8.5, font, color: GRAY }
      );
      y -= 22;
    }
    y -= 8;
  }

  // ===================== CERTIFICATION & SIGNATURE PAGE =====================
  drawFooter(page, pageNum);
  pageNum += 1;
  page = newPage();
  drawHeaderBand(page);
  y = A4[1] - 60;

  page.drawText(t("CERTIFICATION AND APPROVAL", "SERTIPIKASYON AT PAG-APRUBA"), { x: margin, y, size: 13, font: bold, color: GREEN });
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: A4[0] - margin, y }, thickness: 1, color: GREEN });
  y -= 24;

  const certText = t(
    `This Barangay Disaster Risk Reduction and Management Plan of Barangay ${brgyName} for ${submission.year} has been reviewed and evaluated by the Municipal Disaster Risk Reduction and Management Office (MDRRMO) of ${municipality}, ${province}, through the QAS33 monitoring system, and is hereby APPROVED in accordance with Republic Act 10121 and related DRRM guidelines.`,
    `Ang Plano ng Pagbabawas ng Panganib at Pamamahala ng Barangay ${brgyName} para sa ${submission.year} ay nasuri at binigyang-halaga ng Munisipal na Tanggapan ng Pagbabawas ng Panganib at Pamamahala (MDRRMO) ng ${municipality}, ${province}, sa pamamagitan ng sistemang QAS33, at HINAHAYAGANG APRUBADO ayon sa Republika Act 10121 at kaugnay na mga gabay ng DRRM.`
  );
  for (const line of wrapText(certText, font, 10, contentWidth)) {
    page.drawText(line, { x: margin, y, size: 10, font, color: DARK });
    y -= 16;
  }

  y -= 30;
  const docMetaText = t(
    `This document was electronically generated and signed through QAS33. Document ID: ${docId}. Integrity code: ${signature.signatureHash.slice(0, 24).toUpperCase()}. Verification: ${verifyUrl}`,
    `Ang dokumentong ito ay elektronikong nilikha at nilagdaan sa pamamagitan ng QAS33. ID ng Dokumento: ${docId}. Kodigong pang-integrity: ${signature.signatureHash.slice(0, 24).toUpperCase()}. Beripikasyon: ${verifyUrl}`
  );
  for (const line of wrapText(docMetaText, font, 8.5, contentWidth)) {
    page.drawText(line, { x: margin, y, size: 8.5, font, color: GRAY });
    y -= 13;
  }

  // Signature block
  y -= 60;
  ensureSpace(180);
  const sigX = margin;
  page.drawText(t("APPROVED BY:", "APRUBADO NI:"), { x: sigX, y, size: 9.5, font: bold, color: DARK });
  y -= 50;
  page.drawText(sigName, { x: sigX, y, size: 12, font: bold, color: GREEN, lineHeight: 10 });
  const nameW = bold.widthOfTextAtSize(sigName, 12);
  page.drawText("_".repeat(Math.max(6, Math.ceil(nameW / 6))), { x: sigX, y: y + 10, size: 12, font, color: DARK });
  y -= 16;
  page.drawText(sigPosition, { x: sigX, y, size: 9.5, font, color: DARK });
  y -= 13;
  page.drawText(`${t("Municipal DRRM Officer", "Munisipal na Opisyal ng DRRM")} — ${municipality}, ${province}`, {
    x: sigX,
    y,
    size: 8.5,
    font,
    color: GRAY,
  });
  y -= 16;
  page.drawText(`${t("Date Signed", "Petsa ng Lagda")}: ${fmtDate(signature.signedAt)}`, { x: sigX, y, size: 8.5, font, color: GRAY });

  // QR next to signature
  page.drawImage(qrImage, { x: A4[0] - margin - 90, y: y - 10, width: 90, height: 90 });
  page.drawText(docId, { x: A4[0] - margin - 90, y: y - 22, size: 7.5, font, color: GRAY });

  drawFooter(page, pageNum);

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
