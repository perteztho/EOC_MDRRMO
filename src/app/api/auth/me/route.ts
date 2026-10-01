import { NextResponse } from "next/server";
import { resolveSession, normalizeAdminRole } from "@/lib/qas33/auth";

export async function GET() {
  const resolved = await resolveSession();
  if (!resolved) {
    return NextResponse.json({ session: null });
  }
  return NextResponse.json({
    session: {
      role: resolved.session.role,
      barangay: resolved.barangay
        ? {
            id: resolved.barangay.id,
            code: resolved.barangay.code,
            name: resolved.barangay.name,
            captain: resolved.barangay.captain,
            population: resolved.barangay.population,
            households: resolved.barangay.households,
          }
        : undefined,
      admin: resolved.admin
        ? {
            id: resolved.admin.id,
            username: resolved.admin.username,
            name: resolved.admin.name,
            position: resolved.admin.position,
            role: normalizeAdminRole(resolved.admin.role),
          }
        : undefined,
      mustChangePin: resolved.credential?.mustChangePin ?? false,
      expiresAt: resolved.session.expiresAt.toISOString(),
    },
  });
}
