// QAS33 Public Portal — weather service
// Server-side proxy for:
//   • WeatherLink v2 API (Pio Duran AWS observed conditions)
//   • OpenWeatherMap (One Call 3.0 daily forecast, 2.5 forecast fallback)
//   • Open-Meteo (KEYLESS automatic fallback — keeps the public panels showing
//     REAL live model data whenever the primary provider is not configured or
//     unreachable; never labeled as the municipal AWS)
// API keys live ONLY in the server-side WeatherSettings (published snapshot) —
// they are never sent to the client. Data is never fabricated: when every
// provider is unavailable the response clearly says so.

import type { AwsWeatherData, AwsWeatherResponse, ForecastDay, ForecastResponse, WeatherSettings } from "./portal-types";
import { getActiveSnapshot } from "./portal-server";

// ---------------------------------------------------------------------------
// In-memory caches
// ---------------------------------------------------------------------------

interface AwsCacheEntry {
  payload: AwsWeatherResponse;
  fetchedAtMs: number;
}
interface ForecastCacheEntry {
  payload: ForecastResponse;
  fetchedAtMs: number;
}

let awsCache: AwsCacheEntry | null = null;
let forecastCache: ForecastCacheEntry | null = null;
/** Separate 10-minute caches for the keyless Open-Meteo fallback. */
let openMeteoCurrentCache: AwsCacheEntry | null = null;
let openMeteoForecastCache: ForecastCacheEntry | null = null;

const AWS_STALE_MIN = 30; // observations older than this are flagged stale
const FETCH_TIMEOUT_MS = 8000;
const OPEN_METEO_CACHE_MS = 10 * 60_000;

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// WeatherLink v2 — Pio Duran AWS
// ---------------------------------------------------------------------------

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

function compassOf(deg: number | null): string | null {
  if (deg == null || deg < 0 || deg > 360) return null;
  return COMPASS[Math.round(deg % 360 / 22.5) % 16];
}

function pick(record: Record<string, unknown>, names: string[]): number | null {
  for (const n of names) {
    const v = record[n];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function round1(v: number | null): number | null {
  return v == null ? null : Math.round(v * 10) / 10;
}

/**
 * WeatherLink v2 returns imperial units by default (°F, mph, in, inHg).
 * Fields explicitly suffixed with _mm/_metric are used as-is when present.
 */
function mapWeatherLinkSensor(record: Record<string, unknown>, generatedAt: number): AwsWeatherData {
  const fToC = (f: number | null) => (f == null ? null : f > 60 ? (f - 32) * (5 / 9) : f);
  const mphToKmh = (v: number | null) => (v == null ? null : v * 1.609344);
  const inToMm = (v: number | null) => (v == null ? null : v * 25.4);
  const inhpa = (v: number | null) => (v == null ? null : (v < 40 ? v * 33.8639 : v)); // inHg → hPa

  let temperature = pick(record, ["temp_c", "temp_metric", "temp"]);
  if (temperature != null && temperature > 60) temperature = (temperature - 32) * (5 / 9);
  let feelsLike = pick(record, ["heat_index_c", "heat_index_metric", "heat_index", "thw_index"]);
  if (feelsLike != null && feelsLike > 60) feelsLike = (feelsLike - 32) * (5 / 9);

  const rainfallMm =
    pick(record, ["rainfall_daily_mm", "rainfall_daily_metric"]) ??
    inToMm(pick(record, ["rainfall_daily_in", "rainfall_daily", "rain_daily_in"]));
  let rainRate = pick(record, ["rain_rate_last_mm"]);
  if (rainRate == null) {
    const rr = pick(record, ["rain_rate_last"]);
    rainRate = rr == null ? null : inToMm(rr);
  }

  let windSpeed = pick(record, ["wind_speed_avg_last_10_min_kmh", "wind_speed_avg_last_10_min_metric"]);
  if (windSpeed == null) {
    const w = pick(record, ["wind_speed_avg_last_10_min", "wind_speed_avg", "wind_speed_last"]);
    windSpeed = w == null ? null : mphToKmh(w);
  }
  const windDirDeg = pick(record, ["wind_dir_scalar_avg_last_10_min", "wind_dir_avg", "wind_dir_last"]);
  const pressure = pick(record, ["bar_sea_level_hpa", "bar_absolute_hpa"]) ?? inhpa(pick(record, ["bar_sea_level", "bar_absolute"]));

  return {
    temperature: temperature != null ? Math.round(temperature * 10) / 10 : null,
    feelsLike: feelsLike != null ? Math.round(feelsLike * 10) / 10 : null,
    humidity: pick(record, ["hum"]),
    rainfall: rainfallMm != null ? Math.round(rainfallMm * 10) / 10 : null,
    rainRate: rainRate != null ? Math.round(rainRate * 10) / 10 : null,
    windSpeed: windSpeed != null ? Math.round(windSpeed * 10) / 10 : null,
    windDir: compassOf(windDirDeg),
    windDirDeg,
    pressure: pressure != null ? Math.round(pressure * 10) / 10 : null,
    uv: pick(record, ["uv_index", "uv"]),
    visibility: null, // not provided by typical Davis ISS sensors
    condition: null,
  };
}

// ---------------------------------------------------------------------------
// Open-Meteo — keyless automatic fallback (https://open-meteo.com)
// ---------------------------------------------------------------------------

/** WMO 4677 weather-code → human text (Open-Meteo current + daily). */
const WMO_CODE_TEXT: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Drizzle",
  53: "Drizzle",
  55: "Drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Rain",
  63: "Rain",
  65: "Rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Snow",
  73: "Snow",
  75: "Snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Rain showers",
  82: "Rain showers",
  85: "Snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

function wmoText(code: number | null | undefined): string | null {
  if (code == null) return null;
  return WMO_CODE_TEXT[code] ?? null;
}

/** WMO weather code → OpenWeatherMap icon code (existing UI images keep working). */
function wmoIcon(code: number | null | undefined): string {
  if (code == null) return "01d";
  if (code === 0) return "01d";
  if (code === 1) return "02d";
  if (code === 2) return "03d";
  if (code === 3) return "04d";
  if (code === 45 || code === 48) return "50d";
  if (code >= 51 && code <= 57) return "09d";
  if (code >= 61 && code <= 67) return "10d";
  if (code >= 71 && code <= 77) return "13d";
  if (code >= 80 && code <= 82) return "09d";
  if (code === 85 || code === 86) return "13d";
  if (code >= 95) return "11d";
  return "01d";
}

function numField(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function listOf(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Open-Meteo reports local Manila time ("YYYY-MM-DDTHH:mm", fixed UTC+8) → ISO. */
function manilaLocalToIso(local: unknown): string | null {
  if (typeof local !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const ms = Date.parse(`${local}:00+08:00`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function omLatLon(settings: WeatherSettings): { lat: number; lon: number } {
  return {
    lat: Number.isFinite(settings.lat) ? settings.lat : 13.0678,
    lon: Number.isFinite(settings.lon) ? settings.lon : 123.4575,
  };
}

/** Open-Meteo current conditions (verified keyless endpoint). Throws on failure. */
async function fetchOpenMeteoCurrent(settings: WeatherSettings): Promise<AwsWeatherResponse> {
  const { lat, lon } = omLatLon(settings);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index` +
    `&daily=precipitation_sum&forecast_days=1&timezone=Asia%2FManila`;
  const json = (await fetchJson(url)) as {
    current?: Record<string, unknown>;
    daily?: Record<string, unknown>;
  };
  const cur = json.current ?? {};
  const windDirDeg = numField(cur.wind_direction_10m);
  const dailyRain = numField(listOf(json.daily?.precipitation_sum)[0]);
  const observedAt = manilaLocalToIso(cur.time) ?? new Date().toISOString();
  const data: AwsWeatherData = {
    temperature: round1(numField(cur.temperature_2m)),
    feelsLike: round1(numField(cur.apparent_temperature)),
    humidity: numField(cur.relative_humidity_2m),
    rainfall: round1(dailyRain), // daily total, mm
    rainRate: round1(numField(cur.rain)), // mm/h
    windSpeed: round1(numField(cur.wind_speed_10m)), // already km/h
    windDirDeg,
    windDir: compassOf(windDirDeg),
    pressure: round1(numField(cur.pressure_msl)), // hPa
    uv: round1(numField(cur.uv_index)),
    visibility: null, // not provided by Open-Meteo current
    condition: wmoText(numField(cur.weather_code)),
  };
  return {
    ok: true,
    available: true,
    // Honest labeling — this is Open-Meteo live model data, NOT the municipal AWS.
    source: "Open-Meteo · Pio Duran (live)",
    observedAt,
    fetchedAt: new Date().toISOString(),
    stale: false,
    data,
  };
}

/** Open-Meteo 7-day daily forecast (verified keyless endpoint). Throws on failure. */
async function fetchOpenMeteoForecast(settings: WeatherSettings): Promise<ForecastResponse> {
  const { lat, lon } = omLatLon(settings);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,relative_humidity_2m_mean` +
    `&forecast_days=7&timezone=Asia%2FManila`;
  const json = (await fetchJson(url)) as { daily?: Record<string, unknown> };
  const daily = json.daily ?? {};
  const dates = listOf(daily.time).map((d) => (typeof d === "string" ? d : ""));
  if (dates.length === 0) throw new Error("No daily data from Open-Meteo");

  const codes = listOf(daily.weather_code).map(numField);
  const highs = listOf(daily.temperature_2m_max).map(numField);
  const lows = listOf(daily.temperature_2m_min).map(numField);
  const rainMm = listOf(daily.precipitation_sum).map(numField);
  const rainProb = listOf(daily.precipitation_probability_max).map(numField);
  const wind = listOf(daily.wind_speed_10m_max).map(numField); // km/h already
  const humidity = listOf(daily.relative_humidity_2m_mean).map(numField);

  // The API returns dates in ascending order — defensive sort keeps that true.
  const order = dates.map((date, i) => ({ date, i })).sort((a, b) => a.date.localeCompare(b.date));

  const days: ForecastDay[] = order.slice(0, 7).map(({ date, i }) => ({
    date,
    dayName: dayNameOf(date),
    icon: wmoIcon(codes[i]),
    condition: wmoText(codes[i]) ?? "—",
    high: Math.round(highs[i] ?? 0),
    low: Math.round(lows[i] ?? 0),
    rainProb: Math.round(rainProb[i] ?? 0),
    rainMm: round1(rainMm[i]),
    wind: round1(wind[i]),
    humidity: humidity[i] != null ? Math.round(humidity[i] as number) : null,
  }));

  return {
    ok: true,
    available: true,
    source: "Open-Meteo",
    locationLabel: "Pio Duran, Albay",
    fetchedAt: new Date().toISOString(),
    days,
  };
}

// ---------------------------------------------------------------------------
// Current conditions (AWS → Open-Meteo fallback)
// ---------------------------------------------------------------------------

export async function getAwsWeather(): Promise<AwsWeatherResponse> {
  const now = Date.now();
  const snapshot = await getActiveSnapshot();
  const settings: WeatherSettings = snapshot?.weather ?? ({} as WeatherSettings);

  const unavailable = (reason: "not_configured" | "upstream_error" | "disabled", message: string): AwsWeatherResponse => ({
    ok: true,
    available: false,
    source: "Pio Duran AWS · WeatherLink",
    observedAt: null,
    fetchedAt: new Date().toISOString(),
    stale: false,
    reason,
    message,
    data: null,
  });

  const fallbackEnabled = settings.openMeteoFallback !== false;
  const awsConfigured = Boolean(settings.weatherlinkApiKey && settings.weatherlinkApiSecret && settings.weatherlinkStationId);

  // ---- Stage 1: WeatherLink (Pio Duran AWS) when enabled + configured ----
  if (settings.awsEnabled && awsConfigured) {
    const ttlMs = Math.max(1, settings.awsRefreshMin ?? 5) * 60_000;
    if (awsCache && now - awsCache.fetchedAtMs < ttlMs) {
      return awsCache.payload;
    }
    try {
      const url =
        `https://api.weatherlink.com/v2/current/${encodeURIComponent(settings.weatherlinkStationId)}` +
        `?api-key=${encodeURIComponent(settings.weatherlinkApiKey)}&api-secret=${encodeURIComponent(settings.weatherlinkApiSecret)}`;
      const json = (await fetchJson(url)) as {
        generated_at?: number;
        sensors?: Array<{ sensor_type?: number; data?: Array<Record<string, unknown>> }>;
      };
      const sensor = (json.sensors ?? []).find((s) => Array.isArray(s.data) && s.data.length > 0);
      const record = sensor?.data?.[0];
      if (!record) throw new Error("No sensor data in WeatherLink response");
      const observedAtMs = typeof json.generated_at === "number" ? json.generated_at * 1000 : (typeof record.ts === "number" ? (record.ts as number) * 1000 : Date.now());
      const payload: AwsWeatherResponse = {
        ok: true,
        available: true,
        source: "Pio Duran AWS · WeatherLink",
        observedAt: new Date(observedAtMs).toISOString(),
        fetchedAt: new Date().toISOString(),
        stale: now - observedAtMs > AWS_STALE_MIN * 60_000,
        data: mapWeatherLinkSensor(record, observedAtMs),
      };
      awsCache = { payload, fetchedAtMs: now };
      return payload;
    } catch {
      // Serve cached AWS data (flagged stale) when the upstream fails
      if (awsCache) {
        return { ...awsCache.payload, stale: true };
      }
      // else fall through to the keyless Open-Meteo fallback
    }
  }

  // ---- Stage 2: keyless Open-Meteo fallback (when enabled) ----
  if (fallbackEnabled) {
    if (openMeteoCurrentCache && now - openMeteoCurrentCache.fetchedAtMs < OPEN_METEO_CACHE_MS) {
      return openMeteoCurrentCache.payload;
    }
    try {
      const payload = await fetchOpenMeteoCurrent(settings);
      openMeteoCurrentCache = { payload, fetchedAtMs: Date.now() };
      return payload;
    } catch (err) {
      console.error("[weather] Open-Meteo current fallback failed", err);
      if (openMeteoCurrentCache) return openMeteoCurrentCache.payload; // last good data
    }
  }

  // ---- Stage 3: nothing could serve real data → honest unavailable ----
  if (!settings.awsEnabled) {
    return unavailable("disabled", "The live weather station display is currently disabled by the administrator.");
  }
  if (!awsConfigured) {
    return unavailable("not_configured", "The Pio Duran AWS is not yet connected. The MDRRMO administrator can connect it under Public Website → Settings → Weather.");
  }
  return unavailable("upstream_error", "The weather service could not be reached. Please try again shortly.");
}

// ---------------------------------------------------------------------------
// 7-day forecast (OpenWeatherMap → Open-Meteo fallback)
// ---------------------------------------------------------------------------

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface OwmDailyEntry {
  dt?: number;
  temp?: { day?: number; min?: number; max?: number };
  pop?: number;
  rain?: number;
  wind_speed?: number; // m/s (metric)
  humidity?: number;
  weather?: Array<{ icon?: string; description?: string }>;
}

/** Calendar-date formatter for Philippine time (server may run in UTC). */
const manilaDateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function localDateKey(unixSec: number): string {
  // en-CA yields YYYY-MM-DD; bucket forecast entries by Asia/Manila calendar day.
  return manilaDateKey.format(new Date(unixSec * 1000));
}

function dayNameOf(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((x) => parseInt(x, 10));
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

function mapOwmDaily(entries: OwmDailyEntry[]): ForecastDay[] {
  return entries.slice(0, 7).map((e) => {
    const dt = e.dt ?? Math.floor(Date.now() / 1000);
    const dateKey = localDateKey(dt);
    return {
      date: dateKey,
      dayName: dayNameOf(dateKey),
      icon: e.weather?.[0]?.icon ?? "01d",
      condition: e.weather?.[0]?.description
        ? e.weather[0].description!.replace(/\b\w/g, (c) => c.toUpperCase())
        : "—",
      high: Math.round(e.temp?.max ?? 0),
      low: Math.round(e.temp?.min ?? 0),
      rainProb: e.pop != null ? Math.round(e.pop * 100) : 0,
      rainMm: e.rain != null ? Math.round(e.rain * 10) / 10 : null,
      wind: e.wind_speed != null ? Math.round(e.wind_speed * 3.6 * 10) / 10 : null,
      humidity: e.humidity ?? null,
    };
  });
}

/** Aggregate the free 5-day/3-hour list into daily summaries. */
function aggregateOwmForecast(list: Array<Record<string, unknown>>): ForecastDay[] {
  const byDate = new Map<string, { highs: number[]; lows: number[]; pops: number[]; rain: number[]; winds: number[]; hums: number[]; icon?: string; cond?: string }>();
  for (const entry of list) {
    const dt = typeof entry.dt === "number" ? entry.dt : null;
    if (dt == null) continue;
    const key = localDateKey(dt);
    const main = (entry.main ?? {}) as Record<string, unknown>;
    const weather = (entry.weather as Array<{ icon?: string; description?: string }> | undefined)?.[0];
    const rain = (entry.rain ?? {}) as Record<string, unknown>;
    const bucket = byDate.get(key) ?? { highs: [], lows: [], pops: [], rain: [], winds: [], hums: [] };
    if (typeof main.temp_max === "number") bucket.highs.push(main.temp_max);
    if (typeof main.temp_min === "number") bucket.lows.push(main.temp_min);
    if (typeof entry.pop === "number") bucket.pops.push(entry.pop);
    if (typeof rain["3h"] === "number") bucket.rain.push(rain["3h"] as number);
    if (typeof (entry.wind as Record<string, unknown> | undefined)?.speed === "number") {
      bucket.winds.push(((entry.wind as { speed: number }).speed));
    }
    if (typeof main.humidity === "number") bucket.hums.push(main.humidity);
    if (!bucket.icon && weather?.icon) {
      bucket.icon = weather.icon;
      bucket.cond = weather.description;
    }
    byDate.set(key, bucket);
  }
  return Array.from(byDate.entries())
    .slice(0, 7)
    .map(([key, b]) => ({
      date: key,
      dayName: dayNameOf(key),
      icon: b.icon ?? "01d",
      condition: b.cond ? b.cond.replace(/\b\w/g, (c) => c.toUpperCase()) : "—",
      high: b.highs.length ? Math.round(Math.max(...b.highs)) : 0,
      low: b.lows.length ? Math.round(Math.min(...b.lows)) : 0,
      rainProb: b.pops.length ? Math.round(Math.max(...b.pops) * 100) : 0,
      rainMm: b.rain.length ? Math.round(b.rain.reduce((a, c) => a + c, 0) * 10) / 10 : null,
      wind: b.winds.length ? Math.round(Math.max(...b.winds) * 3.6 * 10) / 10 : null,
      humidity: b.hums.length ? Math.round(b.hums.reduce((a, c) => a + c, 0) / b.hums.length) : null,
    }));
}

/** Fetch OWM daily days (One Call 3.0 preferred, 5-day/3-hour fallback). Throws. */
async function fetchOwmForecastDays(settings: WeatherSettings): Promise<ForecastDay[]> {
  const { lat, lon } = omLatLon(settings);
  // Preferred: One Call 3.0 (true 7-day daily)
  const oneCallUrl =
    `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=metric&exclude=minutely,hourly,alerts` +
    `&appid=${encodeURIComponent(settings.owmApiKey)}`;
  const one = (await fetchJson(oneCallUrl)) as { daily?: OwmDailyEntry[] };
  if (Array.isArray(one.daily) && one.daily.length > 0) {
    return mapOwmDaily(one.daily);
  }
  throw new Error("No daily data");
}

export async function getForecast(): Promise<ForecastResponse> {
  const now = Date.now();
  const snapshot = await getActiveSnapshot();
  const settings: WeatherSettings = snapshot?.weather ?? ({} as WeatherSettings);

  const unavailable = (reason: "not_configured" | "upstream_error" | "disabled", message: string): ForecastResponse => ({
    ok: true,
    available: false,
    source: "OpenWeatherMap",
    locationLabel: "Pio Duran, Albay",
    fetchedAt: new Date().toISOString(),
    days: [],
    reason,
    message,
  });

  const fallbackEnabled = settings.openMeteoFallback !== false;
  const owmConfigured = Boolean(settings.owmEnabled && settings.owmApiKey);

  // ---- Stage 1: OpenWeatherMap when enabled + key present ----
  if (owmConfigured) {
    const ttlMs = Math.max(5, settings.forecastRefreshMin ?? 15) * 60_000;
    if (forecastCache && now - forecastCache.fetchedAtMs < ttlMs) {
      return forecastCache.payload;
    }
    try {
      let days: ForecastDay[];
      try {
        days = await fetchOwmForecastDays(settings);
      } catch {
        // Fallback: free 5-day / 3-hour endpoint aggregated per day
        const { lat, lon } = omLatLon(settings);
        const fcUrl =
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric` +
          `&appid=${encodeURIComponent(settings.owmApiKey)}`;
        const fc = (await fetchJson(fcUrl)) as { list?: Array<Record<string, unknown>> };
        if (!Array.isArray(fc.list) || fc.list.length === 0) throw new Error("No forecast entries");
        days = aggregateOwmForecast(fc.list);
      }
      const payload: ForecastResponse = {
        ok: true,
        available: true,
        source: "OpenWeatherMap",
        locationLabel: "Pio Duran, Albay",
        fetchedAt: new Date().toISOString(),
        days,
      };
      forecastCache = { payload, fetchedAtMs: now };
      return payload;
    } catch {
      // OWM unreachable → fall through to the keyless Open-Meteo fallback
    }
  }

  // ---- Stage 2: keyless Open-Meteo fallback (when enabled) ----
  if (fallbackEnabled) {
    if (openMeteoForecastCache && now - openMeteoForecastCache.fetchedAtMs < OPEN_METEO_CACHE_MS) {
      return openMeteoForecastCache.payload;
    }
    try {
      const payload = await fetchOpenMeteoForecast(settings);
      openMeteoForecastCache = { payload, fetchedAtMs: Date.now() };
      return payload;
    } catch (err) {
      console.error("[weather] Open-Meteo forecast fallback failed", err);
      if (openMeteoForecastCache) return openMeteoForecastCache.payload; // last good data
    }
  }

  // ---- Stage 3: nothing could serve real data → honest unavailable ----
  if (forecastCache) {
    return { ...forecastCache.payload, fetchedAt: new Date().toISOString() };
  }
  if (!settings.owmEnabled) {
    return unavailable("disabled", "The forecast display is currently disabled by the administrator.");
  }
  if (!settings.owmApiKey) {
    return unavailable("not_configured", "The forecast service is not yet connected. The MDRRMO administrator can connect it under Public Website → Settings → Weather.");
  }
  return unavailable("upstream_error", "The forecast service could not be reached. Please try again shortly.");
}
