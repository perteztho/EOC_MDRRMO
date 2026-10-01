"use client";

// QAS33 Public Portal — live weather (Pio Duran AWS) + 7-day forecast
// NEVER fabricates: renders loading skeletons, unavailable cards with the
// server-provided reason and a retry action, plus stale badges when the last
// observation is old. Sources are clearly labelled.

import * as React from "react";
import { Droplets, Thermometer, Wind } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  AwsWeatherResponse,
  AwsWeatherData,
  ForecastDay,
  ForecastResponse,
} from "@/lib/qas33/portal-types";
import {
  PortalIcon,
  SectionSkeleton,
  UnavailableCard,
  formatDateTimePH,
  timeAgo,
} from "./portal-shared";

// ---------------------------------------------------------------------------
// AWS observed weather
// ---------------------------------------------------------------------------

const fmt = (v: number | null | undefined, unit: string, digits = 1): string =>
  v == null || Number.isNaN(v) ? "—" : `${Number(v).toFixed(digits)}${unit}`;
const fmtInt = (v: number | null | undefined, unit: string): string =>
  v == null || Number.isNaN(v) ? "—" : `${Math.round(Number(v))}${unit}`;

function MetricTile({
  icon,
  label,
  value,
  dark,
}: {
  icon: string;
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl p-3",
        dark ? "border border-white/15 bg-white/10" : "portal-glass"
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          dark ? "bg-white/10 text-gov-gold" : "bg-gov-blue-50 text-gov-blue"
        )}
      >
        <PortalIcon name={icon} className="size-5" />
      </span>
      <div className="min-w-0">
        <p className={cn("text-[11px] font-semibold uppercase tracking-wider", dark ? "text-slate-300" : "text-slate-400")}>
          {label}
        </p>
        <p className={cn("text-base font-bold tabular-nums", dark ? "text-white" : "text-slate-800")}>{value}</p>
      </div>
    </div>
  );
}

function AwsCurrentCard({ weather, onRetry }: { weather: AwsWeatherResponse; onRetry?: () => void }) {
  if (!weather.available) {
    return (
      <UnavailableCard
        title="Live weather station unavailable"
        message={
          weather.message ||
          "The Pio Duran automatic weather station is not reporting right now. Please check back later."
        }
        onRetry={onRetry}
      />
    );
  }

  const d: AwsWeatherData | null = weather.data;
  return (
    <>
      {/* Headline card */}
      <div className="overflow-hidden rounded-2xl portal-glass">
        <div className="grid gap-6 bg-gradient-to-br from-gov-blue-deep via-gov-blue to-gov-blue-700 p-4 text-white sm:grid-cols-[auto_1fr] sm:items-center sm:p-5">
          <div className="flex items-center gap-5">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-gov-gold">
              <Thermometer aria-hidden="true" className="size-6" />
            </span>
            <div>
              <p className="text-3xl font-extrabold tabular-nums leading-none text-white">
                {fmt(d?.temperature, "°C", 1)}
              </p>
              <p className="mt-1.5 text-sm font-medium text-slate-200">
                Feels like {fmt(d?.feelsLike, "°C", 1)}
              </p>
              {d?.condition ? (
                <p className="mt-0.5 text-sm text-gov-gold">{d.condition}</p>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:justify-items-end">
            <div className="w-full rounded-xl border border-white/15 bg-white/10 p-2.5 text-center">
              <Droplets aria-hidden="true" className="mx-auto size-4 text-gov-gold" />
              <p className="mt-1 text-base font-bold tabular-nums">{fmtInt(d?.humidity, "%")}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-300">Humidity</p>
            </div>
            <div className="w-full rounded-xl border border-white/15 bg-white/10 p-2.5 text-center">
              <Wind aria-hidden="true" className="mx-auto size-4 text-gov-gold" />
              <p className="mt-1 text-base font-bold tabular-nums">{fmtInt(d?.windSpeed, "")}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-300">Wind km/h</p>
            </div>
            <div className="w-full rounded-xl border border-white/15 bg-white/10 p-2.5 text-center">
              <PortalIcon name="droplet" className="mx-auto size-4 text-gov-gold" />
              <p className="mt-1 text-base font-bold tabular-nums">{fmt(d?.rainfall, "", 1)}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-300">Rain mm</p>
            </div>
          </div>
        </div>

        {/* Metric grid */}
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <MetricTile icon="droplet" label="Rain rate" value={fmt(d?.rainRate, " mm/h", 1)} />
          <MetricTile
            icon="wind"
            label="Wind direction"
            value={d?.windDir ? `${d.windDir}${d.windDirDeg != null ? ` · ${Math.round(d.windDirDeg)}°` : ""}` : "—"}
          />
          <MetricTile icon="gauge" label="Pressure" value={fmtInt(d?.pressure, " hPa")} />
          <MetricTile icon="sun" label="UV index" value={fmt(d?.uv, "", 1)} />
          <MetricTile icon="droplets" label="Humidity" value={fmtInt(d?.humidity, "%")} />
          <MetricTile icon="cloud-rain" label="Rain today" value={fmt(d?.rainfall, " mm", 1)} />
        </div>

        {/* Station status footer */}
        <div className="flex flex-col gap-2 border-t border-white/50 bg-white/40 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-semibold text-slate-700">Observed</span> · {weather.source} —{" "}
            {formatDateTimePH(weather.observedAt)}
          </p>
          <div className="flex items-center gap-3">
            {weather.stale ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-500" />
                Last observation {timeAgo(weather.observedAt)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
                Live · updated {timeAgo(weather.fetchedAt)}
              </span>
            )}
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="font-semibold text-gov-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
              >
                Refresh
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

/** Standalone live-weather section (template "weather" renders the merged outlook). */
export function WeatherAwsSection({
  weather,
  onRetry,
}: {
  weather: AwsWeatherResponse | null;
  onRetry?: () => void;
}) {
  if (!weather) {
    return (
      <div aria-busy="true">
        <SectionSkeleton cards={4} />
      </div>
    );
  }
  return (
    <div>
      <AwsCurrentCard weather={weather} onRetry={onRetry} />
      <p className="mt-3 text-xs leading-relaxed text-slate-400">
        Observed data from the Pio Duran Automatic Weather Station (WeatherLink). For critical decisions, always verify
        with official PAGASA advisories.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MERGED section: Live Weather (AWS) + 7-Day Outlook in ONE block
// ---------------------------------------------------------------------------

function OutlookSubHeader({ icon, title, note }: { icon: string; title: string; note?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-gov-blue-50 text-gov-blue">
          <PortalIcon name={icon} className="size-4" />
        </span>
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">{title}</h3>
      </span>
      {note ? <span className="text-[11px] font-medium text-slate-400">{note}</span> : null}
      <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
    </div>
  );
}

export function WeatherOutlookSection({
  weather,
  forecast,
  onRetryWeather,
  onRetryForecast,
}: {
  weather: AwsWeatherResponse | null;
  forecast: ForecastResponse | null;
  onRetryWeather?: () => void;
  onRetryForecast?: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* ---- Part 1: observed current conditions ---- */}
      <div>
        <OutlookSubHeader
          icon="thermometer"
          title="Current Conditions"
          note="Observed — not a forecast · Pio Duran AWS"
        />
        {weather ? (
          <AwsCurrentCard weather={weather} onRetry={onRetryWeather} />
        ) : (
          <div aria-busy="true">
            <SectionSkeleton cards={4} />
          </div>
        )}
      </div>

      {/* ---- Part 2: 7-day outlook ---- */}
      <div>
        <OutlookSubHeader
          icon="cloud-sun"
          title="7-Day Outlook"
          note={forecast?.source ? `${forecast.source} · verify with PAGASA` : "Verify with PAGASA"}
        />
        {forecast ? (
          <ForecastDays forecast={forecast} onRetry={onRetryForecast} />
        ) : (
          <div aria-busy="true">
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-64 w-40 shrink-0 animate-pulse rounded-xl bg-slate-200/70" />
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-slate-400">
        Observed data from the Pio Duran Automatic Weather Station (WeatherLink); forecast from{" "}
        {forecast?.source ?? "the live forecast service"}. Rainfall probabilities may change — for critical decisions,
        always verify with official PAGASA advisories.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero glass mini card
// ---------------------------------------------------------------------------

export function WeatherMiniCard({
  weather,
  emergency,
  onDetails,
}: {
  weather: AwsWeatherResponse | null;
  emergency?: boolean;
  onDetails?: () => void;
}) {
  if (!weather || !weather.available || !weather.data) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Live Weather · Pio Duran AWS</p>
        <div className="mt-3 flex items-center gap-3 text-slate-200">
          <PortalIcon name="wifi-off" className="size-5 shrink-0 text-slate-300" />
          <p className="text-xs leading-relaxed text-slate-300">
            {weather?.message || "Live weather is temporarily unavailable."}
          </p>
        </div>
        {onDetails ? (
          <button
            type="button"
            onClick={onDetails}
            className="mt-3 text-xs font-semibold text-gov-gold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
          >
            Details ↓
          </button>
        ) : null}
      </div>
    );
  }

  const d = weather.data;
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Live Weather · Pio Duran AWS</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-extrabold tabular-nums text-white">
            {d.temperature != null ? Number(d.temperature).toFixed(1) : "—"}
          </span>
          <span className="text-xl font-bold text-slate-200">°C</span>
        </div>
        <p className="max-w-[10rem] text-right text-xs text-slate-300">
          {d.condition || weather.source}
          {d.feelsLike != null ? ` · feels ${Number(d.feelsLike).toFixed(0)}°` : ""}
        </p>
      </div>
      {/* Wind + rainfall emphasized in emergency mode */}
      <div
        className={cn(
          "mt-4 grid gap-2 text-xs text-slate-200",
          emergency ? "grid-cols-2" : "grid-cols-4"
        )}
      >
        <span className={cn("flex items-center gap-1.5", emergency && "col-span-1 text-sm font-semibold")}>
          <Wind aria-hidden="true" className={cn("size-3.5 text-gov-gold", emergency && "size-4")} />
          {d.windSpeed != null ? `${Math.round(Number(d.windSpeed))} km/h` : "—"}
          {d.windDir ? ` ${d.windDir}` : ""}
        </span>
        <span className={cn("flex items-center gap-1.5", emergency && "col-span-1 text-sm font-semibold")}>
          <Droplets aria-hidden="true" className={cn("size-3.5 text-gov-gold", emergency && "size-4")} />
          {d.rainfall != null ? `${Number(d.rainfall).toFixed(1)} mm` : "—"}
        </span>
        {!emergency ? (
          <>
            <span className="flex items-center gap-1.5">
              <PortalIcon name="droplets" className="size-3.5 text-gov-gold" />
              {d.humidity != null ? `${Math.round(Number(d.humidity))}%` : "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <PortalIcon name="droplet" className="size-3.5 text-gov-gold" />
              {d.rainRate != null ? `${Number(d.rainRate).toFixed(1)} mm/h` : "—"}
            </span>
          </>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-300">Observed {timeAgo(weather.observedAt)}</p>
        {onDetails ? (
          <button
            type="button"
            onClick={onDetails}
            className="text-xs font-semibold text-gov-gold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
          >
            Details ↓
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7-day forecast
// ---------------------------------------------------------------------------

const OWM_ICON = (icon: string) => `https://openweathermap.org/img/wn/${icon}@2x.png`;

function ForecastDayCard({ day }: { day: ForecastDay }) {
  return (
    <div className="flex min-w-[7.5rem] snap-start flex-col items-center rounded-xl portal-glass p-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{day.dayName}</p>
      <img
        src={OWM_ICON(day.icon)}
        alt={day.condition}
        width={40}
        height={40}
        loading="lazy"
        className="my-1 size-10"
      />
      <p className="text-[13px] font-bold tabular-nums text-slate-800">
        {Math.round(day.high)}° <span className="font-medium text-slate-400">/ {Math.round(day.low)}°</span>
      </p>
      <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-tight text-slate-500">{day.condition}</p>
      <div className="mt-1.5 flex w-full flex-col gap-1 border-t border-slate-100 pt-1.5 text-[11px] text-slate-600">
        <span className="flex items-center justify-center gap-1 font-semibold text-gov-blue">
          <Droplets aria-hidden="true" className="size-3" />
          {day.rainProb}% rain
        </span>
        <span className="tabular-nums">
          {day.rainMm != null ? `${Number(day.rainMm).toFixed(1)} mm` : "—"} ·{" "}
          {day.wind != null ? `${Math.round(Number(day.wind))} km/h` : "—"}
        </span>
        <span className="tabular-nums text-slate-400">{day.humidity != null ? `${Math.round(Number(day.humidity))}% RH` : ""}</span>
      </div>
    </div>
  );
}

/** The forecast cards row + source note (shared by standalone + merged sections). */
function ForecastDays({ forecast, onRetry }: { forecast: ForecastResponse; onRetry?: () => void }) {
  if (!forecast.available || forecast.days.length === 0) {
    return (
      <UnavailableCard
        title="Forecast unavailable"
        message={
          forecast.message ||
          "The weather forecast service is not connected right now. Please check back later."
        }
        onRetry={onRetry}
      />
    );
  }

  return (
    <div>
      <div className="flex snap-x gap-3 overflow-x-auto pb-2 portal-no-scrollbar lg:grid lg:grid-cols-7 lg:overflow-visible">
        {forecast.days.map((day) => (
          <ForecastDayCard key={day.date} day={day} />
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">
        Forecast: {forecast.source} ({forecast.locationLabel}). Rainfall probability and amounts may change — for critical
        decisions, always verify with official PAGASA advisories.
      </p>
    </div>
  );
}

export function ForecastSection({
  forecast,
  onRetry,
}: {
  forecast: ForecastResponse | null;
  onRetry?: () => void;
}) {
  if (!forecast) {
    return (
      <div aria-busy="true">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-64 w-40 shrink-0 animate-pulse rounded-xl bg-slate-200/70" />
          ))}
        </div>
      </div>
    );
  }

  return <ForecastDays forecast={forecast} onRetry={onRetry} />;
}

// ---------------------------------------------------------------------------
// Compact forecast strip (dashboard widget)
// ---------------------------------------------------------------------------

export function ForecastMini({
  forecast,
  days = 4,
}: {
  forecast: ForecastResponse | null;
  days?: number;
}) {
  if (!forecast) {
    return (
      <div className="flex gap-2" aria-busy="true">
        {Array.from({ length: days }).map((_, i) => (
          <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-slate-200/70" />
        ))}
      </div>
    );
  }
  if (!forecast.available || forecast.days.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-slate-500">
        {forecast.message || "The forecast service is not connected right now."}
      </p>
    );
  }
  const list = forecast.days.slice(0, days);
  return (
    <div className="grid grid-cols-4 gap-2">
      {list.map((day) => (
        <div
          key={day.date}
          className="flex flex-col items-center rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-center"
        >
          <span className="text-[10px] font-bold uppercase text-slate-500">{day.dayName.slice(0, 3)}</span>
          <img
            src={OWM_ICON(day.icon)}
            alt={day.condition}
            width={32}
            height={32}
            loading="lazy"
            className="my-0.5 size-8"
          />
          <span className="text-[11px] font-bold tabular-nums text-slate-700">{Math.round(day.high)}°</span>
          <span className="text-[10px] tabular-nums text-slate-400">{Math.round(day.low)}°</span>
          <span className="mt-0.5 flex items-center gap-0.5 text-[10px] font-semibold text-gov-blue">
            <Droplets aria-hidden="true" className="size-2.5" />
            {day.rainProb}%
          </span>
        </div>
      ))}
    </div>
  );
}
