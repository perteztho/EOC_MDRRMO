import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole, getClientIp } from "@/lib/qas33/auth";
import { listRows, createRow, getTableDef } from "@/lib/qas33/db-tables";

// GET — paginated rows of a table (SYSTEM_ADMIN only)
export async function GET(request: NextRequest, ctx: { params: Promise<{ table: string }> }) {
  const resolved = await requireAdminRole(["SYSTEM_ADMIN"]);
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Only the System Administrator can access database management." }, { status: 403 });
  }
  const { table } = await ctx.params;
  const def = getTableDef(table);
  if (!def) return NextResponse.json({ error: "Unknown table." }, { status: 404 });
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get("pageSize")) || 25));
  const search = (url.searchParams.get("search") || "").trim();
  try {
    const result = await listRows(table, { page, pageSize, search });
    return NextResponse.json(result);
  } catch (e) {
    console.error("database rows error", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load rows." }, { status: 500 });
  }
}

// POST — create a row in a table (SYSTEM_ADMIN only)
export async function POST(request: NextRequest, ctx: { params: Promise<{ table: string }> }) {
  const resolved = await requireAdminRole(["SYSTEM_ADMIN"]);
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Only the System Administrator can modify the database." }, { status: 403 });
  }
  const { table } = await ctx.params;
  const def = getTableDef(table);
  if (!def) return NextResponse.json({ error: "Unknown table." }, { status: 404 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const row = await createRow(table, body, { name: resolved.admin.name, ip: getClientIp(request) });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create row." }, { status: 400 });
  }
}
