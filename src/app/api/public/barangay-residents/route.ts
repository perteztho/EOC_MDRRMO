import { NextRequest, NextResponse } from "next/server";
import { resolveBarangayIdBySlug, searchResidentsPublic } from "@/lib/qas33/frontpage-service";

// Privacy-safe public resident lookup for the barangay frontpages.
// GET ?slug=agol&q=dela — returns name + purok ONLY (Data Privacy Act note
// shown on the site); minimum 2 characters, max 10 results, ACTIVE accounts.

export async function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams;
    const slug = (params.get("slug") ?? "").trim();
    const q = (params.get("q") ?? "").trim();
    if (!slug) {
      return NextResponse.json({ ok: false, error: "A barangay slug is required." }, { status: 400 });
    }
    if (q.length < 2) {
      return NextResponse.json({ ok: true, results: [], hint: "Type at least 2 letters to search." });
    }
    const barangayId = await resolveBarangayIdBySlug(slug);
    if (!barangayId) {
      return NextResponse.json({ ok: false, error: "Barangay not found." }, { status: 404 });
    }
    const results = await searchResidentsPublic(barangayId, q);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error("resident lookup failed", e);
    return NextResponse.json({ ok: false, error: "Resident lookup failed. Please try again." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
