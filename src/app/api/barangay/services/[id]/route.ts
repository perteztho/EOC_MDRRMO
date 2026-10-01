import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay, getClientIp } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import {
  barangayLabel,
  getServiceDocType,
  sanitizeServiceData,
  validateServiceData,
  type ServiceDocData,
} from "@/lib/qas33/services-templates";
import { deleteServicePdf, generateServicePdf, saveServicePdf } from "@/lib/qas33/services-pdf";

type Params = { params: Promise<{ id: string }> };

// Barangay e-Serbisyo — single service document
// GET    /api/barangay/services/[id]
// PUT    /api/barangay/services/[id]   { action: "save", data } | { action: "issue", data? } | { action: "cancel", reason }
// DELETE /api/barangay/services/[id]   (drafts only)

async function loadDoc(barangayId: string, id: string) {
  return db.serviceDocument.findFirst({
    where: { id, barangayId },
    include: { resident: { select: { fullName: true } } },
  });
}

function docResponse(doc: Awaited<ReturnType<typeof loadDoc>>) {
  if (!doc) return null;
  return {
    id: doc.id,
    docType: doc.docType,
    controlNo: doc.controlNo,
    status: doc.status,
    data: doc.data,
    residentId: doc.residentId,
    residentName: doc.resident?.fullName ?? null,
    issuedBy: doc.issuedBy,
    issuedAt: doc.issuedAt?.toISOString() ?? null,
    fileKey: doc.fileKey,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function GET(_request: NextRequest, { params }: Params) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const doc = await loadDoc(resolved.barangay.id, id);
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  return NextResponse.json({ doc: docResponse(doc) });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const barangay = resolved.barangay;
  const { id } = await params;
  const doc = await loadDoc(barangay.id, id);
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const def = getServiceDocType(doc.docType);
  if (!def) return NextResponse.json({ error: "Stored document has an unknown type." }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const action = String(body.action || "");

  const audit = (act: string, detail: string) =>
    logAudit({
      actorType: "BARANGAY",
      actorName: `Barangay ${barangay.name}`,
      action: act,
      detail,
      barangayId: barangay.id,
      ip: getClientIp(request),
    });

  // ---------------- save (update draft data) ----------------
  if (action === "save") {
    if (doc.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft documents can be edited." }, { status: 409 });
    }
    const data = sanitizeServiceData(def.key, (body.data ?? {}) as Record<string, unknown>);
    await db.serviceDocument.update({ where: { id: doc.id }, data: { data: JSON.stringify(data) } });
    await audit("SERVICE_DOC_SAVED", `Saved ${def.label} draft ${doc.controlNo}`);
    const fresh = await loadDoc(barangay.id, doc.id);
    return NextResponse.json({ ok: true, doc: docResponse(fresh) });
  }

  // ---------------- issue (finalise + generate + store PDF) ----------------
  if (action === "issue") {
    if (doc.status === "ISSUED") {
      return NextResponse.json({ error: "This document has already been issued." }, { status: 409 });
    }
    if (doc.status === "CANCELLED") {
      return NextResponse.json({ error: "This document was cancelled and cannot be issued." }, { status: 409 });
    }
    const data: ServiceDocData = body.data
      ? sanitizeServiceData(def.key, body.data as Record<string, unknown>)
      : (JSON.parse(doc.data) as ServiceDocData);
    const check = validateServiceData(def.key, data);
    if (!check.ok) {
      return NextResponse.json(
        { error: `Please complete the required fields: ${check.missing.join(", ")}.` },
        { status: 400 }
      );
    }

    const issuedAt = new Date();
    // barangayLabel avoids "Barangay Barangay III" when the DB name already carries the prefix
    const issuedBy = barangayLabel(barangay.name);
    const barangayRow = await db.barangay.findUnique({ where: { id: barangay.id } });

    const buffer = await generateServicePdf({
      doc: { docType: doc.docType, controlNo: doc.controlNo, status: "ISSUED", data, issuedAt },
      barangay: { code: barangay.code, name: barangay.name, captain: barangayRow?.captain ?? null },
    });
    const fileKey = await saveServicePdf(doc.controlNo, buffer);

    await db.serviceDocument.update({
      where: { id: doc.id },
      data: { data: JSON.stringify(data), status: "ISSUED", issuedBy, issuedAt, fileKey },
    });
    await audit("SERVICE_DOC_ISSUED", `Issued ${def.label} ${doc.controlNo} (${buffer.length} bytes PDF)`);

    const fresh = await loadDoc(barangay.id, doc.id);
    return NextResponse.json({ ok: true, doc: docResponse(fresh) });
  }

  // ---------------- cancel ----------------
  if (action === "cancel") {
    if (doc.status !== "ISSUED") {
      return NextResponse.json({ error: "Only issued documents can be cancelled." }, { status: 409 });
    }
    const reason = String(body.reason || "").trim().slice(0, 400);
    if (doc.fileKey) await deleteServicePdf(doc.fileKey);
    await db.serviceDocument.update({
      where: { id: doc.id },
      data: { status: "CANCELLED", fileKey: null },
    });
    await audit(
      "SERVICE_DOC_CANCELLED",
      `Cancelled ${def.label} ${doc.controlNo}${reason ? ` — ${reason}` : ""}`
    );
    const fresh = await loadDoc(barangay.id, doc.id);
    return NextResponse.json({ ok: true, doc: docResponse(fresh) });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const barangay = resolved.barangay;
  const { id } = await params;
  const doc = await loadDoc(barangay.id, id);
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (doc.status !== "DRAFT") {
    return NextResponse.json({ error: "Only draft documents can be deleted." }, { status: 409 });
  }

  await db.serviceDocument.delete({ where: { id: doc.id } });
  await logAudit({
    actorType: "BARANGAY",
    actorName: `Barangay ${barangay.name}`,
    action: "SERVICE_DOC_DELETED",
    detail: `Deleted ${doc.docType} draft ${doc.controlNo}`,
    barangayId: barangay.id,
    ip: getClientIp(request),
  });
  return NextResponse.json({ ok: true });
}
