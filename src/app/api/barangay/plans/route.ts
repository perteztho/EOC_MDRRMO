import { NextResponse } from "next/server";
import { requireBarangay } from "@/lib/qas33/auth";
import { listBuildersForBarangay, getPlanYear } from "@/lib/qas33/plan-service";

// GET — plan builder catalog for the logged-in barangay
export async function GET() {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [builders, year] = await Promise.all([
    listBuildersForBarangay(resolved.barangay.id),
    getPlanYear(),
  ]);
  return NextResponse.json({ year, builders });
}
