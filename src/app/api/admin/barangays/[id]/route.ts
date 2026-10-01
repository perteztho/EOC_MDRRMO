import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, generateTempPin, hashSecret, getClientIp } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";

// POST — credential & account management for a barangay
// actions: generate-pin | reset-pin | revoke-pin | activate-pin | clear-lock | toggle-active | unlock
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");

  const barangay = await db.barangay.findUnique({ where: { id }, include: { credential: true } });
  if (!barangay) return NextResponse.json({ error: "Barangay not found" }, { status: 404 });

  const ip = getClientIp(request);
  const audit = (act: string, detail: string) =>
    logAudit({
      actorType: "ADMIN",
      actorName: resolved.admin!.name,
      action: act,
      detail: `${detail} — Barangay ${barangay.name}`,
      barangayId: barangay.id,
      ip,
    });

  if (action === "generate-pin" || action === "reset-pin") {
    if (!barangay.credential && action === "reset-pin") {
      return NextResponse.json({ error: "No credential exists. Use generate-pin." }, { status: 400 });
    }
    const tempPin = generateTempPin();
    const data = {
      pinHash: hashSecret(tempPin),
      tempPin, // shown to MDRRMO once; cleared after barangay changes it
      mustChangePin: true,
      active: true,
      failedAttempts: 0,
      lockedUntil: null,
    };
    await db.barangayCredential.upsert({
      where: { barangayId: barangay.id },
      create: { barangayId: barangay.id, ...data },
      update: data,
    });
    await audit(action === "reset-pin" ? "PIN_RESET" : "PIN_GENERATED", `New temporary PIN issued (${action})`);
    return NextResponse.json({
      ok: true,
      tempPin,
      message: `Temporary PIN issued for ${barangay.code}. Provide it to the barangay — they will be required to change it on first login.`,
    });
  }

  if (action === "revoke-pin") {
    if (!barangay.credential) return NextResponse.json({ error: "No credential exists." }, { status: 400 });
    await db.barangayCredential.update({ where: { id: barangay.credential.id }, data: { active: false } });
    await audit("PIN_REVOKED", "Barangay access PIN revoked");
    return NextResponse.json({ ok: true });
  }

  if (action === "activate-pin") {
    if (!barangay.credential) return NextResponse.json({ error: "No credential exists." }, { status: 400 });
    await db.barangayCredential.update({ where: { id: barangay.credential.id }, data: { active: true } });
    await audit("PIN_ACTIVATED", "Barangay access PIN re-activated");
    return NextResponse.json({ ok: true });
  }

  if (action === "clear-lock") {
    if (!barangay.credential) return NextResponse.json({ error: "No credential exists." }, { status: 400 });
    await db.barangayCredential.update({
      where: { id: barangay.credential.id },
      data: { lockedUntil: null, failedAttempts: 0 },
    });
    await audit("LOCK_CLEARED", "Cleared login lockout");
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle-active") {
    const next = !barangay.active;
    await db.barangay.update({ where: { id: barangay.id }, data: { active: next } });
    await audit(next ? "ACCOUNT_ENABLED" : "ACCOUNT_DISABLED", next ? "Barangay account enabled" : "Barangay account temporarily disabled");
    return NextResponse.json({ ok: true, active: next });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
