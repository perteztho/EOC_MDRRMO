import { NextRequest, NextResponse } from "next/server";
import { requireBarangay } from "@/lib/qas33/auth";
import { listFrontpageInquiries, setFrontpageInquiryStatus } from "@/lib/qas33/frontpage-service";

// Barangay portal — frontpage inquiries (contact-form messages and service
// requests received through the public barangay frontpage).
// GET                       — latest 100 inquiries
// POST { id, status }       — mark an inquiry NEW / DONE

export async function GET() {
  const resolved = await requireBarangay();
  if (!resolved?.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const inquiries = await listFrontpageInquiries(resolved.barangay.id);
    return NextResponse.json({ ok: true, inquiries });
  } catch (e) {
    console.error("inquiries load failed", e);
    return NextResponse.json({ error: "Unable to load inquiries." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const resolved = await requireBarangay();
  if (!resolved?.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => null)) as { id?: unknown; status?: unknown } | null;
    if (!body || typeof body.id !== "string" || !body.id) {
      return NextResponse.json({ error: "An inquiry id is required." }, { status: 400 });
    }
    const status = await setFrontpageInquiryStatus(resolved.barangay.id, body.id, String(body.status ?? "DONE"));
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    const message = e instanceof Error && e.message ? e.message : "Unable to update the inquiry.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const dynamic = "force-dynamic";
