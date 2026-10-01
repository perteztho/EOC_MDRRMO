import { NextRequest, NextResponse } from "next/server";
import { cached, invalidateCache } from "@/lib/qas33/cache";
import { getClientIp } from "@/lib/qas33/auth";
import { createFrontpageInquiry, getFrontpageBySlug, resolveBarangayIdBySlug } from "@/lib/qas33/frontpage-service";

// Public barangay frontpage content.
// GET  ?slug=agol      — full frontpage payload (content + council + theme)
// POST { slug, kind, name, contact, service, message } — contact-form /
//      service-request inquiry (rate limited, stored for the barangay portal)

// ---- simple in-memory rate limiter: 6 inquiries per IP per hour ----
const rateMap = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const list = (rateMap.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= 6) {
    rateMap.set(ip, list);
    return true;
  }
  list.push(now);
  rateMap.set(ip, list);
  if (rateMap.size > 500) {
    for (const [key, times] of rateMap) {
      if (times.every((t) => now - t >= windowMs)) rateMap.delete(key);
    }
  }
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const slug = new URL(request.url).searchParams.get("slug");
    if (!slug) {
      return NextResponse.json({ ok: false, error: "A barangay slug is required (e.g. ?slug=agol)." }, { status: 400 });
    }
    const data = await cached(`public:frontpage:${slug}`, 60_000, () => getFrontpageBySlug(slug));
    if (!data) {
      return NextResponse.json({ ok: false, error: "Barangay not found." }, { status: 404 });
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
  } catch (e) {
    console.error("public frontpage fetch failed", e);
    return NextResponse.json({ ok: false, error: "Unable to load this barangay frontpage." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (rateLimited(ip)) {
      return NextResponse.json(
        { ok: false, error: "Too many messages submitted from this connection. Please try again later." },
        { status: 429 }
      );
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    if (!slug) {
      return NextResponse.json({ ok: false, error: "A barangay slug is required." }, { status: 400 });
    }
    const barangayId = await resolveBarangayIdBySlug(slug);
    if (!barangayId) {
      return NextResponse.json({ ok: false, error: "Barangay not found." }, { status: 404 });
    }
    await createFrontpageInquiry(barangayId, {
      kind: String(body.kind ?? "MESSAGE"),
      name: String(body.name ?? ""),
      contact: String(body.contact ?? ""),
      service: String(body.service ?? ""),
      message: String(body.message ?? ""),
    });
    // New inquiry → the barangay's unread badge in their console changes.
    invalidateCache(`public:frontpage:${slug}`);
    return NextResponse.json({
      ok: true,
      message: "Your message has been sent to the barangay. Please expect a reply within office hours.",
    });
  } catch (e) {
    const message = e instanceof Error && e.message ? e.message : "Your message could not be sent. Please try again.";
    const status = e instanceof Error && /provide your name|at least 10 characters/.test(e.message) ? 400 : 500;
    if (status === 500) console.error("frontpage inquiry failed", e);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export const dynamic = "force-dynamic";
