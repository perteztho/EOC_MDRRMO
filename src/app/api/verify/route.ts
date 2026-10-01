import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SERVICE_DOC_TYPE_LABEL } from "@/lib/qas33/services-templates";

// PUBLIC — QR document verification (no auth)
// 1. GeneratedDocument (BDRRMP docIds, e.g. QAS33-BDRRMP-26-006-V2)
// 2. ServiceDocument control numbers (e-Serbisyo, e.g. PD-BRG-006-CLR-25-0001)
export async function GET(request: NextRequest) {
  const docId = (new URL(request.url).searchParams.get("docId") || "").trim().toUpperCase();
  if (!docId) {
    return NextResponse.json({ valid: false, error: "Document ID is required." }, { status: 400 });
  }
  const doc = await db.generatedDocument.findUnique({
    where: { docId },
    include: {
      submission: { include: { barangay: true } },
      downloads: true,
    },
  });
  if (doc) {
    const { submission } = doc;
    return NextResponse.json({
      valid: true,
      kind: "PLAN",
      docId: doc.docId,
      document: "Barangay DRRM Plan (BDRRMP)",
      barangay: submission.barangay.name,
      barangayCode: submission.barangay.code,
      year: submission.year,
      version: doc.version,
      status: "VALID — APPROVED",
      signed: doc.signed,
      signedBy: doc.signedBy,
      signedAt: doc.signedAt?.toISOString() ?? null,
      approvedAt: submission.approvedAt?.toISOString() ?? null,
      generatedAt: doc.generatedAt.toISOString(),
      downloadCount: doc.downloads.length,
    });
  }

  // ---- e-Serbisyo service documents (barangay certificates & DRRM reports) ----
  const serviceDoc = await db.serviceDocument.findUnique({
    where: { controlNo: docId },
    include: { barangay: true },
  });
  if (serviceDoc) {
    if (serviceDoc.status === "ISSUED") {
      return NextResponse.json({
        valid: true,
        kind: "SERVICE_DOCUMENT",
        docId: serviceDoc.controlNo,
        document: `${SERVICE_DOC_TYPE_LABEL[serviceDoc.docType] ?? serviceDoc.docType} (Barangay e-Serbisyo)`,
        barangay: serviceDoc.barangay.name,
        barangayCode: serviceDoc.barangay.code,
        year: serviceDoc.issuedAt ? serviceDoc.issuedAt.getFullYear() : new Date().getFullYear(),
        version: undefined,
        status: "VALID — ISSUED",
        signed: true,
        signedBy: serviceDoc.issuedBy,
        signedAt: serviceDoc.issuedAt?.toISOString() ?? null,
        approvedAt: null,
        generatedAt: serviceDoc.issuedAt?.toISOString() ?? serviceDoc.createdAt.toISOString(),
        downloadCount: 0,
        docType: serviceDoc.docType,
        docTypeLabel: SERVICE_DOC_TYPE_LABEL[serviceDoc.docType] ?? serviceDoc.docType,
        controlNo: serviceDoc.controlNo,
        issuedBy: serviceDoc.issuedBy,
        issuedAt: serviceDoc.issuedAt?.toISOString() ?? null,
      });
    }
    if (serviceDoc.status === "CANCELLED") {
      return NextResponse.json({
        valid: false,
        kind: "SERVICE_DOCUMENT",
        error:
          "This document was CANCELLED by the issuing barangay and is no longer valid. Please contact the Barangay or the MDRRMO.",
      });
    }
    return NextResponse.json({
      valid: false,
      kind: "SERVICE_DOCUMENT",
      error: "This control number exists but the document has not been issued yet (still a draft).",
    });
  }

  return NextResponse.json({
    valid: false,
    error: "No document found with this ID. Please check the Document ID and try again.",
  });
}
