import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/qas33/auth";
import { listBarangayRows } from "@/lib/qas33/admin-service";
import { getSettings } from "@/lib/qas33/server";

export async function GET(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "ALL";
  const settings = await getSettings();
  const rows = await listBarangayRows(search, status, settings.planYear);
  return NextResponse.json({ barangays: rows, year: settings.planYear });
}
