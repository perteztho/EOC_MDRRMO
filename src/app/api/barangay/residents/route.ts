import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay, hashSecret, getClientIp } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";

// Barangay e-Serbisyo — resident directory of the logged-in barangay
// GET  /api/barangay/residents?q=       (ACTIVE + PENDING only, limit 50)
// POST /api/barangay/residents          (barangay-encoded resident account)

const MAX_LIMIT = 50;

function clean(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanDate(value: unknown): Date | null {
  const raw = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: NextRequest) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const barangay = resolved.barangay;
  const q = (new URL(request.url).searchParams.get("q") || "").trim().toLowerCase();
  const limitParam = parseInt(new URL(request.url).searchParams.get("limit") || "", 10);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isNaN(limitParam) ? MAX_LIMIT : limitParam));

  const residents = await db.residentAccount.findMany({
    where: {
      barangayId: barangay.id,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    orderBy: { fullName: "asc" },
  });

  const filtered = q
    ? residents.filter((r) =>
        `${r.fullName} ${r.purok ?? ""} ${r.address ?? ""}`.toLowerCase().includes(q)
      )
    : residents;

  return NextResponse.json({
    residents: filtered.slice(0, limit).map((r) => ({
      id: r.id,
      fullName: r.fullName,
      purok: r.purok,
      address: r.address,
      sex: r.sex,
      civilStatus: r.civilStatus,
      occupation: r.occupation,
      birthdate: r.birthdate?.toISOString().slice(0, 10) ?? null,
      phone: r.phone,
      email: r.email,
      status: r.status,
    })),
    total: filtered.length,
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

  const fullName = clean(body.fullName, 120);
  if (!fullName) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }
  const email = clean(body.email, 120).toLowerCase() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (email) {
    const clash = await db.residentAccount.findUnique({ where: { email } });
    if (clash) {
      return NextResponse.json({ error: "A resident with this email already exists." }, { status: 409 });
    }
  }

  const sexRaw = clean(body.sex, 10).toUpperCase();
  const civilStatus = clean(body.civilStatus, 20);
  const password = clean(body.password, 100) || "resident123";

  const resident = await db.residentAccount.create({
    data: {
      fullName,
      email,
      phone: clean(body.phone, 30) || null,
      barangayId: barangay.id,
      purok: clean(body.purok, 80) || null,
      address: clean(body.address, 250) || null,
      birthdate: cleanDate(body.birthdate),
      sex: sexRaw === "MALE" || sexRaw === "FEMALE" || sexRaw === "OTHER" ? sexRaw : null,
      civilStatus: civilStatus || null,
      occupation: clean(body.occupation, 100) || null,
      purpose: clean(body.purpose, 250) || null,
      passwordHash: hashSecret(password),
      status: "ACTIVE",
      verifiedAt: new Date(),
    },
  });

  await logAudit({
    actorType: "BARANGAY",
    actorName: `Barangay ${barangay.name}`,
    action: "RESIDENT_REGISTERED",
    detail: `Encoded resident ${resident.fullName}`,
    barangayId: barangay.id,
    ip: getClientIp(request),
  });

  return NextResponse.json({
    resident: {
      id: resident.id,
      fullName: resident.fullName,
      purok: resident.purok,
      address: resident.address,
      sex: resident.sex,
      civilStatus: resident.civilStatus,
      occupation: resident.occupation,
      birthdate: resident.birthdate?.toISOString().slice(0, 10) ?? null,
      phone: resident.phone,
      email: resident.email,
      status: resident.status,
    },
  });
}
