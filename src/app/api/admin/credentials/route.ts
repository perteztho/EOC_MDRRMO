import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, generateTempPin, hashSecret, getClientIp } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";

// POST — printable barangay account credential sheets.
// Accessible to EVERY console role (MDRRMO Officer, MDRRMO Staff, System
// Administrator) so any of them can generate & print the account handout a
// barangay needs to sign in. Barangay logins are NOT admin sessions.
//
// body: { mode: "one", barangayId, regenerate? }
//        → reuses the pending temporary PIN when present; when the barangay
//          has already set its own PIN, the caller must pass regenerate=true
//          (a new temporary PIN is issued and the old PIN stops working).
// body: { mode: "all", regenerate: "pending" | "missing" | "all" }
//        → "pending": sheets only for barangays whose temporary PIN is still
//                     pending (account not yet claimed);
//          "missing": issue new PINs for barangays WITHOUT a pending temp PIN
//                     and return a sheet for every barangay;
//          "all":     brand-new PINs for every barangay.
export async function POST(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = resolved.admin;
  const body = await request.json().catch(() => ({}));
  const mode = String(body.mode || "");
  const ip = getClientIp(request);
  const issuedBy = { name: admin.name, position: admin.position ?? "MDRRMO" };
  const issuedAt = new Date().toISOString();

  const sheetFor = (
    b: { code: string; name: string; captain: string | null; active: boolean },
    tempPin: string,
    pinActive: boolean
  ) => ({
    code: b.code,
    name: b.name,
    captain: b.captain,
    tempPin,
    accountActive: b.active,
    pinActive,
    issuedAt,
    issuedBy,
  });

  const issueTempPin = async (barangayId: string) => {
    const tempPin = generateTempPin();
    // upsert: a barangay may not have a credential row yet (first-time generate)
    const data = {
      pinHash: hashSecret(tempPin),
      tempPin,
      mustChangePin: true,
      active: true,
      failedAttempts: 0,
      lockedUntil: null,
    };
    await db.barangayCredential.upsert({
      where: { barangayId },
      create: { barangayId, ...data },
      update: data,
    });
    return tempPin;
  };

  try {
    if (mode === "one") {
      const barangayId = String(body.barangayId || "");
      if (!barangayId) return NextResponse.json({ error: "barangayId is required." }, { status: 400 });
      const barangay = await db.barangay.findUnique({ where: { id: barangayId }, include: { credential: true } });
      if (!barangay) return NextResponse.json({ error: "Barangay not found." }, { status: 404 });
      const regenerate = Boolean(body.regenerate);

      if (barangay.credential?.tempPin && !regenerate) {
        // Pending temporary PIN — printable as-is (account not yet claimed).
        return NextResponse.json({
          sheets: [sheetFor(barangay, barangay.credential.tempPin, barangay.credential.active)],
          generated: 0,
          reused: 1,
        });
      }
      // No pending temporary PIN (credential missing, or the barangay already
      // set its own PIN) — the caller must explicitly opt in to regeneration.
      if (!regenerate) {
        return NextResponse.json({ error: "no-pending-pin", needsRegenerate: true }, { status: 409 });
      }

      // Issue a fresh temporary PIN (regenerate or first-time generate).
      const tempPin = await issueTempPin(barangay.id);
      await logAudit({
        actorType: "ADMIN",
        actorName: admin.name,
        action: "PIN_GENERATED",
        detail: `New temporary PIN issued for printing — Barangay ${barangay.name}`,
        barangayId: barangay.id,
        ip,
      });
      return NextResponse.json({ sheets: [sheetFor(barangay, tempPin, true)], generated: 1, reused: 0 });
    }

    if (mode === "all") {
      const regenerate = String(body.regenerate || "missing"); // pending | missing | all
      const barangays = await db.barangay.findMany({ include: { credential: true }, orderBy: { code: "asc" } });
      const sheets: ReturnType<typeof sheetFor>[] = [];
      let generated = 0;
      let reused = 0;

      for (const b of barangays) {
        const hasPending = Boolean(b.credential?.tempPin);
        const shouldReuse = regenerate === "pending" ? hasPending : regenerate === "missing" ? hasPending : false;

        if (shouldReuse && b.credential) {
          sheets.push(sheetFor(b, b.credential.tempPin!, b.credential.active));
          reused++;
          continue;
        }
        if (regenerate === "pending" && !hasPending) continue; // sheet only for pending accounts

        const tempPin = await issueTempPin(b.id);
        sheets.push(sheetFor(b, tempPin, true));
        generated++;
      }

      if (generated > 0) {
        await logAudit({
          actorType: "ADMIN",
          actorName: admin.name,
          action: "PIN_GENERATED",
          detail: `${generated} temporary PIN(s) issued for printing (${regenerate} mode)`,
          ip,
        });
      }
      await logAudit({
        actorType: "ADMIN",
        actorName: admin.name,
        action: "CREDENTIAL_SHEET_PRINTED",
        detail: `Account credential sheets generated — ${sheets.length} sheet(s), ${generated} new PIN(s), ${reused} pending reused (${regenerate} mode)`,
        ip,
      });
      return NextResponse.json({ sheets, generated, reused });
    }

    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  } catch (e) {
    console.error("credentials print error", e);
    return NextResponse.json({ error: "Could not prepare credential sheets." }, { status: 500 });
  }
}
