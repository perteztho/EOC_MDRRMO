// QAS33 auth: PIN/password hashing, sessions, guards
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "qas33_session";
const BARANGAY_SESSION_HOURS = 12;
const ADMIN_SESSION_HOURS = 8;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const candidate = scryptSync(secret, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function generateTempPin(): string {
  return `QAS33-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export interface SessionPayload {
  role: "BARANGAY" | "ADMIN";
  barangayId?: string;
  adminId?: string;
  ip?: string;
  userAgent?: string;
}

// ---- Admin roles & permissions ----
// SYSTEM_ADMIN   — Tho Pogi (default admin): roles, settings, references/tutorials config, database CRUD
// MDRRMO_OFFICER — Noel F. Ordona: reviews AND approves BDRRMP (signs/finalizes)
// MDRRMO_STAFF   — Jun Carlo Anasco: assists review (comments/revision/rating), no approval
export type AdminRole = "SYSTEM_ADMIN" | "MDRRMO_OFFICER" | "MDRRMO_STAFF";

export function normalizeAdminRole(role: string): AdminRole {
  if (role === "SYSTEM_ADMIN") return "SYSTEM_ADMIN";
  if (role === "MDRRMO_STAFF") return "MDRRMO_STAFF";
  return "MDRRMO_OFFICER"; // includes legacy MDRRMO_ADMIN
}

export function isSystemAdmin(role: string): boolean {
  return normalizeAdminRole(role) === "SYSTEM_ADMIN";
}

export function canReviewBdrrmp(role: string): boolean {
  const r = normalizeAdminRole(role);
  return r === "MDRRMO_OFFICER" || r === "MDRRMO_STAFF";
}

export function canApproveBdrrmp(role: string): boolean {
  return normalizeAdminRole(role) === "MDRRMO_OFFICER";
}

// ---- Emergency communication permissions (Evacuation / News / Broadcast) ----
// MDRRMO_STAFF can view everything but not modify emergency data or broadcast.
export function canManageEvacuation(role: string): boolean {
  const r = normalizeAdminRole(role);
  return r === "SYSTEM_ADMIN" || r === "MDRRMO_OFFICER";
}

export function canSendBroadcast(role: string): boolean {
  const r = normalizeAdminRole(role);
  return r === "SYSTEM_ADMIN" || r === "MDRRMO_OFFICER";
}

export function canSendCriticalBroadcast(role: string): boolean {
  const r = normalizeAdminRole(role);
  return r === "SYSTEM_ADMIN" || r === "MDRRMO_OFFICER";
}

export function canPublishNews(role: string): boolean {
  const r = normalizeAdminRole(role);
  return r === "SYSTEM_ADMIN" || r === "MDRRMO_OFFICER";
}

export function canDeleteAnnouncements(role: string): boolean {
  return normalizeAdminRole(role) === "SYSTEM_ADMIN";
}

export function canManageNotificationConfig(role: string): boolean {
  return normalizeAdminRole(role) === "SYSTEM_ADMIN";
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const hours = payload.role === "ADMIN" ? ADMIN_SESSION_HOURS : BARANGAY_SESSION_HOURS;
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000);
  await db.session.create({
    data: {
      token,
      role: payload.role,
      barangayId: payload.barangayId,
      adminId: payload.adminId,
      ip: payload.ip,
      userAgent: payload.userAgent,
      expiresAt,
    },
  });
  return token;
}

export async function destroySession(token: string) {
  await db.session.deleteMany({ where: { token } });
}

export interface ResolvedSession {
  session: { id: string; token: string; role: string; expiresAt: Date };
  barangay: {
    id: string;
    code: string;
    name: string;
    captain: string | null;
    population: number | null;
    households: number | null;
  } | null;
  credential: { id: string; mustChangePin: boolean; active: boolean } | null;
  admin: { id: string; username: string; name: string; position: string | null; role: string } | null;
}

export async function resolveSession(): Promise<ResolvedSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { token } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (session.role === "BARANGAY") {
    const barangay = await db.barangay.findUnique({ where: { id: session.barangayId! } });
    if (!barangay || !barangay.active) return null;
    const credential = await db.barangayCredential.findUnique({ where: { barangayId: barangay.id } });
    if (!credential || !credential.active) return null;
    return {
      session: { id: session.id, token: session.token, role: session.role, expiresAt: session.expiresAt },
      barangay: {
        id: barangay.id,
        code: barangay.code,
        name: barangay.name,
        captain: barangay.captain,
        population: barangay.population,
        households: barangay.households,
      },
      credential: { id: credential.id, mustChangePin: credential.mustChangePin, active: credential.active },
      admin: null,
    };
  }
  const admin = await db.adminUser.findUnique({ where: { id: session.adminId! } });
  if (!admin || !admin.active) return null;
  return {
    session: { id: session.id, token: session.token, role: session.role, expiresAt: session.expiresAt },
    barangay: null,
    credential: null,
    admin: { id: admin.id, username: admin.username, name: admin.name, position: admin.position, role: admin.role },
  };
}

export async function requireBarangay(): Promise<ResolvedSession | null> {
  const resolved = await resolveSession();
  if (!resolved || resolved.session.role !== "BARANGAY" || !resolved.barangay) return null;
  return resolved;
}

export async function requireAdmin(): Promise<ResolvedSession | null> {
  const resolved = await resolveSession();
  if (!resolved || resolved.session.role !== "ADMIN" || !resolved.admin) return null;
  return resolved;
}

// Require a specific admin role (e.g. SYSTEM_ADMIN for configuration / database management)
export async function requireAdminRole(roles: AdminRole[]): Promise<ResolvedSession | null> {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) return null;
  if (!roles.includes(normalizeAdminRole(resolved.admin.role))) return null;
  return resolved;
}

export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false, // sandbox runs behind http gateway; enable in production with HTTPS
  path: "/",
};
