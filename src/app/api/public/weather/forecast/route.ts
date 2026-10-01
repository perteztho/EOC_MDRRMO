import { NextResponse } from "next/server";
import { getForecast } from "@/lib/qas33/weather";

// GET /api/public/weather/forecast — daily forecast from OpenWeatherMap.
// Never fabricates data; returns an explicit unavailable state.
export async function GET() {
  try {
    const payload = await getForecast();
    return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } });
  } catch (e) {
    console.error("public forecast failed", e);
    return NextResponse.json(
      { ok: true, available: false, source: "OpenWeatherMap", locationLabel: "Pio Duran, Albay", fetchedAt: new Date().toISOString(), days: [], reason: "upstream_error", message: "The forecast service could not be reached." },
      { status: 200 }
    );
  }
}
