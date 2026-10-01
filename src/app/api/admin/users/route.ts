import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole, hashSecret, normalizeAdminRole } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";

const VALID_ROLES = ["SYSTEM_ADMIN", "MDRRMO_OFFICER", "MDRRMO_STAFF"];

// GET — list console users (SYSTEM_ADMIN only)
export async function GET() {
  const resolved = await requireAdminRole(["SYSTEM_ADMIN"]);
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Only the System Administrator can manage users." }, { status: 403 });
  }
  const users = await db.adminUser.findMany({
    select: { id: true, username: true, name: true, position: true, role: true, active: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      role: normalizeAdminRole(u.role),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}

// POST — create a console user (SYSTEM_ADMIN only)
export async function POST(request: NextRequest) {
  const resolved = await requireAdminRole(["SYSTEM_ADMIN"]);
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Only the System Administrator can manage users." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim();
  const position = body.position ? String(body.position).slice(0, 120) : null;
  const role = VALID_ROLES.includes(body.role) ? body.role : "MDRRMO_STAFF";

  if (username.length < 3) return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Full name is required." }, { status: 400 });

  const exists = await db.adminUser.findUnique({ where: { username } });
  if (exists) return NextResponse.json({ error: "Username already exists." }, { status: 409 });

  const user = await db.adminUser.create({
    data: { username, passwordHash: hashSecret(password), name: name.slice(0, 120), position, role },
  });
  await logAudit({
    actorType: "ADMIN",
    actorName: resolved.admin.name,
    action: "USER_CREATED",
    detail: `Created console user '${username}' (${role})`,
  });
  return NextResponse.json({
    ok: true,
    user: { id: user.id, username: user.username, name: user.name, position: user.position, role: user.role, active: user.active },
  });
}
