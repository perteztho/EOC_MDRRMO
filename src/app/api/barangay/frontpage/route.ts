import { NextRequest, NextResponse } from "next/server";
import { requireBarangay } from "@/lib/qas33/auth";
import { invalidateCache } from "@/lib/qas33/cache";
import {
  getFrontpageManager,
  resetFrontpage,
  saveFrontpage,
} from "@/lib/qas33/frontpage-service";

// Barangay portal — Frontpage manager (the barangay user administers their
// own public frontpage at /barangay/<slug>).
// GET    — effective content + inquiries + counts (defaults until first save)
// PUT    — { content, published } sanitize + save (upsert)
// DELETE — reset to system defaults (removes the saved row)

export async function GET() {
  const resolved = await requireBarangay();
  if (!resolved?.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const payload = await getFrontpageManager(
      resolved.barangay.id,
      resolved.barangay.code,
      resolved.barangay.name
    );
    return NextResponse.json(payload);
  } catch (e) {
    console.error("frontpage manager load failed", e);
    return NextResponse.json({ error: "Unable to load your frontpage." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const resolved = await requireBarangay();
  if (!resolved?.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => null)) as { content?: unknown; published?: unknown } | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const published = body.published !== false; // default true
    await saveFrontpage(
      resolved.barangay.id,
      resolved.barangay.code,
      body.content,
      published,
      `${resolved.barangay.code} portal user`
    );
    // The public frontpage (/barangay/<slug>) must reflect the edit at once.
    invalidateCache("public:frontpage:");
    return NextResponse.json({ ok: true, published });
  } catch (e) {
    const message = e instanceof Error && e.message ? e.message : "Unable to save your frontpage.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const resolved = await requireBarangay();
  if (!resolved?.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await resetFrontpage(resolved.barangay.id, `${resolved.barangay.code} portal user`);
    invalidateCache("public:frontpage:");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("frontpage reset failed", e);
    return NextResponse.json({ error: "Unable to reset your frontpage." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
