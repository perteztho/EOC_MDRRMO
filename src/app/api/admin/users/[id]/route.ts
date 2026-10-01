import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole, hashSecret, normalizeAdminRole, getClientIp } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";

const VALID_ROLES = ["SYSTEM_ADMIN", "MDRRMO_OFFICER", "MDRRMO_STAFF"];

// PUT — update a console user: name, position, ROLE, active, password reset
// Only the System Administrator may edit roles (per QAS33 access policy).
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdminRole(["SYSTEM_ADMIN"]);
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Only the System Administrator can edit users and roles." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const user = await db.adminUser.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const data: Record<string, unknown> = {};
  const changes: string[] = [];

  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    if (name !== user.name) {
      data.name = name;
      changes.push("name");
    }
  }
  if (body.position !== undefined) {
    const position = body.position ? String(body.position).slice(0, 120) : null;
    if (position !== user.position) {
      data.position = position;
      changes.push("position");
    }
  }
  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }
    if (body.role !== user.role) {
      if (user.username === "sysadmin" && body.role !== "SYSTEM_ADMIN") {
        return NextResponse.json(
          { error: "The default System Administrator account (sysadmin) must keep the SYSTEM_ADMIN role." },
          { status: 400 }
        );
      }
      if (user.id === resolved.admin.id && body.role !== "SYSTEM_ADMIN") {
        return NextResponse.json({ error: "You cannot demote your own account." }, { status: 400 });
      }
      if (user.role === "SYSTEM_ADMIN") {
        const admins = await db.adminUser.findMany({ where: { role: "SYSTEM_ADMIN", active: true } });
        if (admins.length <= 1) {
          return NextResponse.json({ error: "Cannot change the role of the last active System Administrator." }, { status: 400 });
        }
      }
      data.role = body.role;
      changes.push(`role → ${body.role}`);
    }
  }
  if (body.active !== undefined) {
    const active = !!body.active;
    if (active !== user.active) {
      if (user.id === resolved.admin.id && !active) {
        return NextResponse.json({ error: "You cannot disable your own account." }, { status: 400 });
      }
      if (!active && user.username === "sysadmin") {
        return NextResponse.json({ error: "The default System Administrator account (sysadmin) cannot be disabled." }, { status: 400 });
      }
      if (!active && user.role === "SYSTEM_ADMIN") {
        const admins = await db.adminUser.findMany({ where: { role: "SYSTEM_ADMIN", active: true } });
        if (admins.length <= 1) {
          return NextResponse.json({ error: "Cannot disable the last active System Administrator." }, { status: 400 });
        }
      }
      data.active = active;
      changes.push(active ? "enabled" : "disabled");
    }
  }
  if (body.password !== undefined && String(body.password || "") !== "") {
    const password = String(body.password);
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    data.passwordHash = hashSecret(password);
    changes.push("password reset");
    // Force re-login elsewhere: drop this admin's sessions
    await db.session.deleteMany({ where: { adminId: user.id } }).catch(() => undefined);
  }

  if (changes.length === 0) {
    return NextResponse.json({ ok: true, message: "No changes." });
  }

  const updated = await db.adminUser.update({ where: { id }, data });
  await logAudit({
    actorType: "ADMIN",
    actorName: resolved.admin.name,
    action: changes.includes("password reset") ? "USER_PASSWORD_RESET" : "USER_UPDATED",
    detail: `Updated '${user.username}': ${changes.join(", ")}`,
    ip: getClientIp(request),
  });
  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      username: updated.username,
      name: updated.name,
      position: updated.position,
      role: normalizeAdminRole(updated.role),
      active: updated.active,
    },
  });
}

// DELETE — remove a console user (SYSTEM_ADMIN only, with guardrails)
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdminRole(["SYSTEM_ADMIN"]);
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Only the System Administrator can manage users." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const user = await db.adminUser.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (user.id === resolved.admin.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }
  if (user.username === "sysadmin") {
    return NextResponse.json({ error: "The default System Administrator account (sysadmin) cannot be deleted." }, { status: 400 });
  }
  if (user.role === "SYSTEM_ADMIN") {
    const admins = await db.adminUser.findMany({ where: { role: "SYSTEM_ADMIN", active: true } });
    if (admins.length <= 1) {
      return NextResponse.json({ error: "Cannot delete the last active System Administrator." }, { status: 400 });
    }
  }
  await db.session.deleteMany({ where: { adminId: user.id } }).catch(() => undefined);
  await db.adminUser.delete({ where: { id } });
  await logAudit({
    actorType: "ADMIN",
    actorName: resolved.admin.name,
    action: "USER_DELETED",
    detail: `Deleted console user '${user.username}' (${user.role})`,
    ip: getClientIp(request),
  });
  return NextResponse.json({ ok: true });
}
