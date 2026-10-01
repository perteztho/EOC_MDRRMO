import { NextResponse } from "next/server";
import { getPushStatus } from "@/lib/qas33/push-service";

// GET /api/public/push/key — public push status (public key only; NEVER any
// private/VAPID secret material). Used by browsers to subscribe.
export async function GET() {
  try {
    return NextResponse.json(await getPushStatus());
  } catch (e) {
    console.error("public push key GET failed", e);
    return NextResponse.json({ error: "Push status could not be loaded." }, { status: 500 });
  }
}
