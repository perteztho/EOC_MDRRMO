import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay, verifySecret, hashSecret, getClientIp } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";

export async function POST(request: NextRequest) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const currentPin = String(body.currentPin || "");
  const newPin = String(body.newPin || "");
  const confirmPin = String(body.confirmPin || "");

  if (newPin.length < 6) {
    return NextResponse.json({ error: "New PIN must be at least 6 characters." }, { status: 400 });
  }
  if (newPin !== confirmPin) {
    return NextResponse.json({ error: "New PIN and confirmation do not match." }, { status: 400 });
  }
  const cred = await db.barangayCredential.findUnique({ where: { barangayId: resolved.barangay.id } });
  if (!cred) return NextResponse.json({ error: "Credential not found." }, { status: 404 });
  if (!verifySecret(currentPin, cred.pinHash)) {
    return NextResponse.json({ error: "Current PIN is incorrect." }, { status: 401 });
  }

  await db.barangayCredential.update({
    where: { id: cred.id },
    data: { pinHash: hashSecret(newPin), mustChangePin: false, tempPin: null, failedAttempts: 0, lockedUntil: null },
  });
  await logAudit({
    actorType: "BARANGAY",
    actorName: `Barangay ${resolved.barangay.name}`,
    action: "PIN_CHANGED",
    detail: "Access PIN changed successfully",
    barangayId: resolved.barangay.id,
    ip: getClientIp(request),
  });
  return NextResponse.json({ ok: true, mustChangePin: false });
}
