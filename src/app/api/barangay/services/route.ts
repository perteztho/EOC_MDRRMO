import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay, getClientIp } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import {
  buildControlNo,
  controlNoPrefix,
  getServiceDocType,
  sanitizeServiceData,
  validateDraftMinimum,
  type ServiceDocTypeKey,
} from "@/lib/qas33/services-templates";

// Barangay e-Serbisyo — service documents (list + create draft)
// GET  /api/barangay/services?type=&status=&q=&page=   (defaults: all, newest first)
// POST /api/barangay/services  { docType, data, residentId? }

export async function GET(request: NextRequest) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const barangay = resolved.barangay;
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "";
  const status = url.searchParams.get("status") || "";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const pageRaw = url.searchParams.get("page");
  const page = pageRaw ? Math.max(1, parseInt(pageRaw, 10) || 1) : 0;

  const docs = await db.serviceDocument.findMany({
    where: { barangayId: barangay.id },
    include: { resident: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });

  // In-memory filtering (per-barangay volume is small) — case-insensitive search
  const filtered = docs.filter((d) => {
    if (type && d.docType !== type) return false;
    if (status && d.status !== status) return false;
    if (q) {
      const haystack = `${d.controlNo} ${d.data} ${d.resident?.fullName ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const PAGE_SIZE = 20;
  const paged = page > 0 ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : filtered;

  // Summary counts per type + per status (whole barangay, ignoring filters)
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const issuedByType: Record<string, number> = {};
  const year = new Date().getFullYear();
  let issuedThisYear = 0;
  for (const d of docs) {
    byType[d.docType] = (byType[d.docType] ?? 0) + 1;
    byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
    if (d.status === "ISSUED") {
      issuedByType[d.docType] = (issuedByType[d.docType] ?? 0) + 1;
      if (d.issuedAt && d.issuedAt.getFullYear() === year) issuedThisYear += 1;
    }
  }

  return NextResponse.json({
    docs: paged.map((d) => ({
      id: d.id,
      docType: d.docType,
      controlNo: d.controlNo,
      status: d.status,
      data: d.data,
      residentId: d.residentId,
      residentName: d.resident?.fullName ?? null,
      issuedBy: d.issuedBy,
      issuedAt: d.issuedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
    total: filtered.length,
    page: page > 0 ? page : null,
    summary: { byType, byStatus, issuedByType, total: docs.length, issuedThisYear },
  });
}

export async function POST(request: NextRequest) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const barangay = resolved.barangay;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const docType = String(body.docType || "") as ServiceDocTypeKey;
  const def = getServiceDocType(docType);
  if (!def) {
    return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
  }

  const data = sanitizeServiceData(docType, (body.data ?? {}) as Record<string, unknown>);
  const minCheck = validateDraftMinimum(docType, data);
  if (!minCheck.ok) {
    return NextResponse.json(
      { error: `Please fill in "${minCheck.missing[0]}" before creating the document.` },
      { status: 400 }
    );
  }

  // residentId (optional) must belong to this barangay
  let residentId: string | null = null;
  if (body.residentId) {
    const resident = await db.residentAccount.findFirst({
      where: { id: String(body.residentId), barangayId: barangay.id },
      select: { id: true },
    });
    if (!resident) {
      return NextResponse.json({ error: "Resident not found in this barangay." }, { status: 400 });
    }
    residentId = resident.id;
  }

  // Sequential control number: PD-BRG-006-CLR-25-0001 (count existing of this
  // type + year for the barangay, retry on unique collisions)
  const year = new Date().getFullYear();
  const prefix = controlNoPrefix(barangay.code, def.short, year);
  const existing = await db.serviceDocument.count({
    where: { barangayId: barangay.id, docType, controlNo: { startsWith: prefix } },
  });

  // Returns null on a controlNo unique collision (P2002) so the loop retries.
  const attemptCreate = async (controlNo: string) => {
    try {
      return await db.serviceDocument.create({
        data: {
          docType,
          controlNo,
          barangayId: barangay.id,
          residentId,
          data: JSON.stringify(data),
          status: "DRAFT",
        },
        include: { resident: { select: { fullName: true } } },
      });
    } catch (e) {
      if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") return null;
      throw e;
    }
  };

  let created: Awaited<ReturnType<typeof attemptCreate>> = null;
  for (let seq = existing + 1; seq <= existing + 25; seq += 1) {
    created = await attemptCreate(buildControlNo(barangay.code, def.short, year, seq));
    if (created) break;
  }
  if (!created) {
    return NextResponse.json({ error: "Could not allocate a control number. Please try again." }, { status: 500 });
  }

  await logAudit({
    actorType: "BARANGAY",
    actorName: `Barangay ${barangay.name}`,
    action: "SERVICE_DOC_CREATED",
    detail: `${def.label} draft ${created.controlNo}`,
    barangayId: barangay.id,
    ip: getClientIp(request),
  });

  return NextResponse.json({
    doc: {
      id: created.id,
      docType: created.docType,
      controlNo: created.controlNo,
      status: created.status,
      data: created.data,
      residentId: created.residentId,
      residentName: created.resident?.fullName ?? null,
      issuedBy: created.issuedBy,
      issuedAt: created.issuedAt?.toISOString() ?? null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
}
