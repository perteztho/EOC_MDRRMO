import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/qas33/auth";
import { listTables } from "@/lib/qas33/db-tables";

// GET — list all database tables with row counts + field metadata (SYSTEM_ADMIN only)
export async function GET() {
  const resolved = await requireAdminRole(["SYSTEM_ADMIN"]);
  if (!resolved || !resolved.admin) {
    return NextResponse.json(
      { error: "Only the System Administrator can access database management." },
      { status: 403 }
    );
  }
  try {
    const tables = await listTables();
    return NextResponse.json({ tables });
  } catch (e) {
    console.error("database tables error", e);
    return NextResponse.json({ error: "Could not load tables." }, { status: 500 });
  }
}
