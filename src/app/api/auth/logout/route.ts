import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, destroySession, resolveSession } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const resolved = await resolveSession();
    if (resolved?.barangay) {
      await logAudit({
        actorType: "BARANGAY",
        actorName: `Barangay ${resolved.barangay.name}`,
        action: "LOGGED_OUT",
        barangayId: resolved.barangay.id,
      });
    } else if (resolved?.admin) {
      await logAudit({ actorType: "ADMIN", actorName: resolved.admin.name, action: "LOGGED_OUT" });
    }
    await destroySession(token);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
