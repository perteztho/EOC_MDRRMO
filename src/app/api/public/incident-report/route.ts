import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/qas33/auth";
import { logAudit, notifyAdmins } from "@/lib/qas33/audit";
import { saveIncidentAttachment } from "@/lib/qas33/storage";
import { sanitizeText } from "@/lib/qas33/portal-server";
import { INCIDENT_TYPES, URGENCY_LEVELS, INCIDENT_TYPE_LABELS } from "@/lib/qas33/portal-types";

// Public emergency / incident reporting endpoint.
// POST (multipart/form-data) — submit a report (rate limited per IP)
// GET  ?ref=PD-INC-YYYY-NNNNN — public status lookup by reference number

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// ---- simple in-memory rate limiter: 6 submissions per IP per hour ----
const rateMap = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const list = (rateMap.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= 6) {
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

async function generateReferenceNo(): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 25; attempt++) {
    const seq = (await db.incidentReport.count()) + 1 + attempt;
    const ref = `PD-INC-${year}-${String(seq).padStart(5, "0")}`;
    const existing = await db.incidentReport.findUnique({ where: { referenceNo: ref } });
    if (!existing) return ref;
  }
  return `PD-INC-${year}-${Date.now().toString().slice(-6)}`;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (rateLimited(ip)) {
      return NextResponse.json(
        { ok: false, error: "Too many reports submitted from this connection. Please call the hotline for urgent assistance." },
        { status: 429 }
      );
    }

    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ ok: false, error: "Invalid form submission." }, { status: 400 });
    }

    const typeRaw = String(form.get("type") ?? "");
    if (!INCIDENT_TYPES.includes(typeRaw as (typeof INCIDENT_TYPES)[number])) {
      return NextResponse.json({ ok: false, error: "Please select a valid incident type." }, { status: 400 });
    }
    const location = sanitizeText(form.get("location"), 300);
    if (location.length < 5) {
      return NextResponse.json({ ok: false, error: "Please provide the location or address of the incident (at least 5 characters)." }, { status: 400 });
    }
    const consent = String(form.get("consent") ?? "") === "true";
    if (!consent) {
      return NextResponse.json({ ok: false, error: "Please acknowledge the privacy notice to submit your report." }, { status: 400 });
    }

    const urgencyRaw = String(form.get("urgency") ?? "MODERATE");
    const urgency = URGENCY_LEVELS.includes(urgencyRaw as (typeof URGENCY_LEVELS)[number]) ? urgencyRaw : "MODERATE";
    const name = sanitizeText(form.get("name"), 100) || null;
    const contact = sanitizeText(form.get("contact"), 100) || null;
    const barangay = sanitizeText(form.get("barangay"), 80) || null;
    const description = sanitizeText(form.get("description"), 2000) || null;
    const latitude = sanitizeText(form.get("latitude"), 20) || null;
    const longitude = sanitizeText(form.get("longitude"), 20) || null;

    const referenceNo = await generateReferenceNo();

    // optional photo evidence
    let attachmentUrl: string | null = null;
    const photo = form.get("photo");
    if (photo && photo instanceof File && photo.size > 0) {
      if (photo.size > MAX_PHOTO_BYTES) {
        return NextResponse.json({ ok: false, error: "The photo exceeds the 5 MB limit." }, { status: 400 });
      }
      if (!ALLOWED_IMAGE_TYPES.includes(photo.type)) {
        return NextResponse.json({ ok: false, error: "Only JPG, PNG, WEBP or HEIC photos are accepted." }, { status: 400 });
      }
      const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
      const buffer = Buffer.from(await photo.arrayBuffer());
      try {
        attachmentUrl = await saveIncidentAttachment(referenceNo, buffer, photo.name || "photo", ext);
      } catch (e) {
        console.error("incident attachment failed", e);
        attachmentUrl = null; // submission proceeds without the photo
      }
    }

    await db.incidentReport.create({
      data: {
        referenceNo,
        type: typeRaw,
        urgency,
        name,
        contact,
        location,
        barangay,
        description,
        latitude,
        longitude,
        attachmentUrl,
        consent: true,
        status: "RECEIVED",
      },
    });

    await logAudit({
      actorType: "SYSTEM",
      actorName: "Public Portal",
      action: "INCIDENT_REPORTED",
      detail: `${INCIDENT_TYPE_LABELS[typeRaw] ?? typeRaw} reported at ${location.slice(0, 120)} (ref ${referenceNo})`,
      ip,
    }).catch(() => undefined);

    await notifyAdmins({
      type: "SYSTEM",
      title: `New public incident report — ${INCIDENT_TYPE_LABELS[typeRaw] ?? typeRaw}`,
      body: `Ref ${referenceNo} · Urgency ${urgency} · ${barangay ? `Brgy. ${barangay}, ` : ""}${location.slice(0, 120)}`,
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      referenceNo,
      status: "RECEIVED",
      message:
        "Your report has been received by the MDRRMO. Keep your reference number to check its status. For life-threatening emergencies, call the hotline or 911 immediately.",
    });
  } catch (e) {
    console.error("incident report failed", e);
    return NextResponse.json({ ok: false, error: "Your report could not be submitted. Please try again or call the hotline." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const ref = new URL(request.url).searchParams.get("ref");
    if (!ref) {
      return NextResponse.json({ ok: false, error: "A reference number is required." }, { status: 400 });
    }
    const report = await db.incidentReport.findUnique({ where: { referenceNo: ref.trim().toUpperCase() } });
    if (!report) {
      return NextResponse.json({ ok: false, error: "No report found with that reference number." }, { status: 404 });
    }
    // Public status lookup — only share non-sensitive fields
    return NextResponse.json({
      ok: true,
      referenceNo: report.referenceNo,
      type: report.type,
      urgency: report.urgency,
      barangay: report.barangay,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    });
  } catch (e) {
    console.error("incident lookup failed", e);
    return NextResponse.json({ ok: false, error: "Lookup failed. Please try again." }, { status: 500 });
  }
}

// Guard: never expose stored attachments publicly (admin-only viewing later)
export async function DELETE() {
  return NextResponse.json({ error: "Not allowed" }, { status: 405 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
