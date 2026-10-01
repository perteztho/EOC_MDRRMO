import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifySecret,
  createSession,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MINUTES,
  getClientIp,
  normalizeAdminRole,
} from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || "";

    if (body.role === "barangay") {
      const code = String(body.code || "").trim().toUpperCase();
      const pin = String(body.pin || "");
      if (!code || !pin) {
        return NextResponse.json({ error: "Barangay code and PIN are required." }, { status: 400 });
      }
      const barangay = await db.barangay.findUnique({
        where: { code },
        include: { credential: true },
      });
      if (!barangay) {
        // Deliberately generic — do not confirm whether the code exists
        return NextResponse.json({ error: "Invalid barangay code or PIN. Please contact the MDRRMO." }, { status: 401 });
      }
      if (!barangay.active) {
        return NextResponse.json({ error: "This barangay account is disabled. Please contact the MDRRMO." }, { status: 403 });
      }
      const cred = barangay.credential;
      if (!cred || !cred.active) {
        return NextResponse.json({ error: "Access PIN has been revoked. Please contact the MDRRMO." }, { status: 403 });
      }
      if (cred.lockedUntil && cred.lockedUntil > new Date()) {
        const mins = Math.ceil((cred.lockedUntil.getTime() - Date.now()) / 60000);
        return NextResponse.json(
          { error: `Account temporarily locked due to failed attempts. Try again in ${mins} minute(s).` },
          { status: 423 }
        );
      }
      if (!verifySecret(pin, cred.pinHash)) {
        const attempts = cred.failedAttempts + 1;
        const lock = attempts >= MAX_FAILED_ATTEMPTS;
        await db.barangayCredential.update({
          where: { id: cred.id },
          data: {
            failedAttempts: attempts,
            lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60000) : null,
          },
        });
        await logAudit({
          actorType: "SYSTEM",
          actorName: "System",
          action: "LOGIN_FAILED",
          detail: `Failed login attempt for ${code} from ${ip}`,
          barangayId: barangay.id,
          ip,
        });
        return NextResponse.json(
          {
            error: lock
              ? `Incorrect PIN. Account locked for ${LOCKOUT_MINUTES} minutes.`
              : `Incorrect PIN. ${MAX_FAILED_ATTEMPTS - attempts} attempt(s) remaining before lockout.`,
          },
          { status: 401 }
        );
      }
      // success
      await db.barangayCredential.update({
        where: { id: cred.id },
        data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: ip },
      });
      const token = await createSession({ role: "BARANGAY", barangayId: barangay.id, ip, userAgent });
      await logAudit({
        actorType: "BARANGAY",
        actorName: `Barangay ${barangay.name}`,
        action: "LOGGED_IN",
        detail: `Logged in from ${ip}`,
        barangayId: barangay.id,
        ip,
      });
      const res = NextResponse.json({
        role: "BARANGAY",
        mustChangePin: cred.mustChangePin,
        barangay: { id: barangay.id, code: barangay.code, name: barangay.name },
      });
      res.cookies.set(SESSION_COOKIE, token, {
        ...SESSION_COOKIE_OPTIONS,
        maxAge: 12 * 3600,
      });
      return res;
    }

    if (body.role === "admin") {
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!username || !password) {
        return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
      }
      const admin = await db.adminUser.findUnique({ where: { username } });
      if (!admin || !admin.active || !verifySecret(password, admin.passwordHash)) {
        await logAudit({
          actorType: "SYSTEM",
          actorName: "System",
          action: "LOGIN_FAILED",
          detail: `Failed admin login for '${username}' from ${ip}`,
          ip,
        });
        return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
      }
      await db.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
      const token = await createSession({ role: "ADMIN", adminId: admin.id, ip, userAgent });
      await logAudit({
        actorType: "ADMIN",
        actorName: admin.name,
        action: "LOGGED_IN",
        detail: `Console login (${normalizeAdminRole(admin.role)}) from ${ip}`,
        ip,
      });
      const res = NextResponse.json({
        role: "ADMIN",
        admin: { id: admin.id, name: admin.name, position: admin.position, role: normalizeAdminRole(admin.role) },
      });
      res.cookies.set(SESSION_COOKIE, token, {
        ...SESSION_COOKIE_OPTIONS,
        maxAge: 8 * 3600,
      });
      return res;
    }

    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  } catch (e) {
    console.error("login error", e);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
