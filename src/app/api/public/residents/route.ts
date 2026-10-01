import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, hashSecret } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { sanitizeText } from "@/lib/qas33/portal-server";

// POST /api/public/residents — public QAS33 resident account registration.
// Accounts feed the barangay certificate auto-fill directory. No public GET.

// ---- simple in-memory rate limiter: 5 registrations per IP per 10 minutes ----
const rateMap = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const list = (rateMap.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= 5) {
    rateMap.set(ip, list);
    return true;
  }
  list.push(now);
  rateMap.set(ip, list);
  if (rateMap.size > 500) {
    // prune stale entries occasionally
    for (const [key, times] of rateMap) {
      if (times.every((t) => now - t >= windowMs)) rateMap.delete(key);
    }
  }
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SEX_VALUES = ["MALE", "FEMALE", "OTHER"];

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (rateLimited(ip)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Too many registrations from this connection. Please try again in a few minutes or visit the MDRRMO office.",
        },
        { status: 429 }
      );
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid registration submission." }, { status: 400 });
    }

    // ---- full name ----
    const fullName = sanitizeText(body.fullName, 120);
    if (fullName.length < 2) {
      return NextResponse.json({ ok: false, error: "Please enter your complete full name (at least 2 characters)." }, { status: 400 });
    }

    // ---- barangay resolution (id, code or name) ----
    const barangayIdRaw = typeof body.barangayId === "string" ? body.barangayId.trim() : "";
    const barangayCodeRaw = typeof body.barangayCode === "string" ? body.barangayCode.trim() : "";
    // Accept the spec's `barangay` (name string) as well as `barangayName`.
    const barangayNameRaw = sanitizeText(body.barangay ?? body.barangayName, 80);
    const barangay = await (async () => {
      if (barangayIdRaw) return db.barangay.findUnique({ where: { id: barangayIdRaw } });
      if (barangayCodeRaw) return db.barangay.findUnique({ where: { code: barangayCodeRaw } });
      if (barangayNameRaw) {
        // SQLite has no mode:"insensitive" — match the 33 barangays in JS.
        const all = await db.barangay.findMany();
        return all.find((b) => b.name.toLowerCase() === barangayNameRaw.toLowerCase()) ?? null;
      }
      return null;
    })();
    if (!barangay || !barangay.active) {
      return NextResponse.json(
        { ok: false, error: "Please select your barangay from the list of the 33 barangays of Pio Duran." },
        { status: 400 }
      );
    }

    // ---- contact: email and/or mobile ----
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = sanitizeText(body.phone, 40);
    if (!email && !phone) {
      return NextResponse.json({ ok: false, error: "Please provide at least one contact — mobile number or email address." }, { status: 400 });
    }
    if (email && !EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
    }
    if (email) {
      const taken = await db.residentAccount.findUnique({ where: { email } });
      if (taken) {
        return NextResponse.json(
          { ok: false, error: "This email address is already registered. Use a different email or recover your existing account." },
          { status: 409 }
        );
      }
    }
    if (phone && phone.replace(/\D/g, "").length < 7) {
      return NextResponse.json({ ok: false, error: "Please enter a valid mobile number (e.g. 09XX XXX XXXX)." }, { status: 400 });
    }

    // ---- password ----
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "Your password must be at least 6 characters long." }, { status: 400 });
    }

    // ---- optional profile fields ----
    const purok = sanitizeText(body.purok, 80) || null;
    const address = sanitizeText(body.address, 200) || null;
    const civilStatus = sanitizeText(body.civilStatus, 40) || null;
    const occupation = sanitizeText(body.occupation, 80) || null;
    const purpose = sanitizeText(body.purpose, 400) || null;

    const sexRaw = typeof body.sex === "string" ? body.sex.trim().toUpperCase() : "";
    if (sexRaw && !SEX_VALUES.includes(sexRaw)) {
      return NextResponse.json({ ok: false, error: "Sex must be Male, Female or Other." }, { status: 400 });
    }
    const sex = sexRaw || null;

    let birthdate: Date | null = null;
    if (typeof body.birthdate === "string" && body.birthdate.trim()) {
      const d = new Date(body.birthdate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ ok: false, error: "Please enter a valid birthdate." }, { status: 400 });
      }
      if (d.getTime() >= Date.now()) {
        return NextResponse.json({ ok: false, error: "Birthdate must be in the past." }, { status: 400 });
      }
      birthdate = d;
    }

    const created = await db.residentAccount.create({
      data: {
        fullName,
        email: email || null,
        phone: phone || null,
        barangayId: barangay.id,
        purok,
        address,
        birthdate,
        sex,
        civilStatus,
        occupation,
        purpose,
        passwordHash: hashSecret(password),
        status: "ACTIVE",
      },
    });

    await logAudit({
      actorType: "SYSTEM",
      actorName: fullName,
      action: "RESIDENT_REGISTERED",
      detail: `${fullName} — Brgy. ${barangay.name}${email ? ` (${email})` : ""}`,
      barangayId: barangay.id,
      ip,
    });

    return NextResponse.json({
      ok: true,
      id: created.id,
      fullName: created.fullName,
      barangay: barangay.name,
      message: "Resident account created successfully.",
    });
  } catch (e) {
    console.error("resident registration failed", e);
    return NextResponse.json({ ok: false, error: "Registration could not be completed. Please try again." }, { status: 500 });
  }
}
