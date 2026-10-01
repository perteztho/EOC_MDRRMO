import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay } from "@/lib/qas33/auth";
import { generateServicePdf, readServicePdf, saveServicePdf } from "@/lib/qas33/services-pdf";
import { getServiceDocType, type ServiceDocData } from "@/lib/qas33/services-templates";

type Params = { params: Promise<{ id: string }> };

// GET /api/barangay/services/[id]/pdf — stream the stored PDF for ISSUED docs.
// DRAFTs are generated on-the-fly with a DRAFT watermark (never stored).
// CANCELLED docs return 409.
export async function GET(_request: NextRequest, { params }: Params) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const barangay = resolved.barangay;
  const { id } = await params;

  const doc = await db.serviceDocument.findFirst({
    where: { id, barangayId: barangay.id },
  });
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const def = getServiceDocType(doc.docType);
  if (!def) return NextResponse.json({ error: "Stored document has an unknown type." }, { status: 500 });

  if (doc.status === "CANCELLED") {
    return NextResponse.json({ error: "This document was cancelled — no PDF is available." }, { status: 409 });
  }

  let buffer: Buffer | null = null;

  if (doc.status === "ISSUED") {
    if (doc.fileKey) buffer = await readServicePdf(doc.fileKey);
    if (!buffer) {
      // fileKey missing on disk (e.g. storage wiped) — regenerate + re-store
      buffer = await generateServicePdf({
        doc: {
          docType: doc.docType,
          controlNo: doc.controlNo,
          status: "ISSUED",
          data: JSON.parse(doc.data) as ServiceDocData,
          issuedAt: doc.issuedAt,
        },
        barangay: { code: barangay.code, name: barangay.name, captain: barangay.captain ?? null },
      });
      const fileKey = await saveServicePdf(doc.controlNo, buffer);
      await db.serviceDocument.update({ where: { id: doc.id }, data: { fileKey } });
    }
  } else {
    // DRAFT — on-the-fly watermarked preview, not stored
    buffer = await generateServicePdf({
      doc: {
        docType: doc.docType,
        controlNo: doc.controlNo,
        status: "DRAFT",
        data: JSON.parse(doc.data) as ServiceDocData,
      },
      barangay: { code: barangay.code, name: barangay.name, captain: barangay.captain ?? null },
    });
  }

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.controlNo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
