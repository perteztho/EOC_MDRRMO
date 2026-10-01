import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/qas33/auth";
import { getPushStatus } from "@/lib/qas33/push-service";

// GET /api/admin/push/status — push provider status (any admin role)
export async function GET() {
  const session = await requireAdmin();
  if (!session?.admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ push: await getPushStatus() });
  } catch (e) {
    console.error("push status GET failed", e);
    return NextResponse.json({ error: "Failed to load push status." }, { status: 500 });
  }
}
