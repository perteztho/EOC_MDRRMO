import { NextResponse } from "next/server";
import { getAwsWeather } from "@/lib/qas33/weather";

// GET /api/public/weather — observed conditions from the Pio Duran AWS
// (WeatherLink). Never fabricates data; returns an explicit unavailable state.
export async function GET() {
  try {
    const payload = await getAwsWeather();
    return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=240" } });
  } catch (e) {
    console.error("public weather failed", e);
    return NextResponse.json(
      { ok: true, available: false, source: "Pio Duran AWS · WeatherLink", observedAt: null, fetchedAt: new Date().toISOString(), stale: false, reason: "upstream_error", message: "The weather station could not be reached.", data: null },
      { status: 200 }
    );
  }
}
