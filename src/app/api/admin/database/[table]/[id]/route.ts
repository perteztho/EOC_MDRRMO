import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole, getClientIp } from "@/lib/qas33/auth";
import { updateRow, deleteRow, getTableDef } from "@/lib/qas33/db-tables";

// PUT — update a row (SYSTEM_ADMIN only)
export async function PUT(request: NextRequest, ctx: { params: Promise<{ table: string; id: string }> }) {
  const resolved = await requireAdminRole(["SYSTEM_ADMIN"]);
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Only the System Administrator can modify the database." }, { status: 403 });
  }
  const { table, id } = await ctx.params;
  const def = getTableDef(table);
  if (!def) return NextResponse.json({ error: "Unknown table." }, { status: 404 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const row = await updateRow(table, id, body, { name: resolved.admin.name, ip: getClientIp(request) });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not update row." }, { status: 400 });
  }
}

// DELETE — delete a row (SYSTEM_ADMIN only)
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ table: string; id: string }> }) {
  const resolved = await requireAdminRole(["SYSTEM_ADMIN"]);
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Only the System Administrator can modify the database." }, { status: 403 });
  }
  const { table, id } = await ctx.params;
  const def = getTableDef(table);
  if (!def) return NextResponse.json({ error: "Unknown table." }, { status: 404 });
  try {
    await deleteRow(table, id, { id: resolved.admin.id, name: resolved.admin.name, ip: getClientIp(request) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not delete row." }, { status: 400 });
  }
}
