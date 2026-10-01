"use client";

// QAS33 Public Portal — application shell (data owner).
// Fetches homepage config + public content + live weather, polls them on
// intervals, refetches on window focus / reconnect, wires the login dialogs
// and renders the presentational PortalSiteView.

import * as React from "react";
import { RefreshCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { portalApiPublic } from "@/lib/qas33/portal-api";
import type {
  AwsWeatherResponse,
  ForecastResponse,
  HomepageResponse,
  PortalContentResponse,
} from "@/lib/qas33/portal-types";
import type { PublicEvacResponse, PushStatusDTO } from "@/lib/qas33/emergency-types";
import type { SessionInfo } from "@/lib/qas33/types";
import { PORTAL_REFRESH_EVENT } from "./portal-shared";
import { PortalSiteView, PortalLoadingSkeleton } from "./portal-view";
import { AdminLoginDialog } from "./portal-login";
import { BarangayPublicDialog } from "./barangay-public-dialog";

// Polling intervals (ms)
const POLL = {
  homepage: 60_000,
  content: 120_000,
  weather: 300_000,
  forecast: 900_000,
  evacuation: 60_000,
} as const;

/** Graceful "unavailable" representation when the fetch itself fails. */
function awsUnavailable(message: string): AwsWeatherResponse {
  return {
    ok: true,
    available: false,
    source: "Pio Duran AWS · WeatherLink",
    observedAt: null,
    fetchedAt: new Date().toISOString(),
    stale: false,
    reason: "upstream_error",
    message,
    data: null,
  };
}

function forecastUnavailable(message: string): ForecastResponse {
  return {
    ok: true,
    available: false,
    source: "OpenWeatherMap",
    locationLabel: "Pio Duran, Albay",
    fetchedAt: new Date().toISOString(),
    days: [],
    reason: "upstream_error",
    message,
  };
}

export default function PortalApp({
  initialVerifyDocId,
  onAuth,
}: {
  initialVerifyDocId?: string | null;
  onAuth: (s: SessionInfo) => void;
}) {
  const [data, setData] = React.useState<HomepageResponse | null>(null);
  const [content, setContent] = React.useState<PortalContentResponse | null>(null);
  const [weather, setWeather] = React.useState<AwsWeatherResponse | null>(null);
  const [forecast, setForecast] = React.useState<ForecastResponse | null>(null);
  const [evacuation, setEvacuation] = React.useState<PublicEvacResponse | null>(null);
  const [evacError, setEvacError] = React.useState<string | null>(null);
  const [pushStatus, setPushStatus] = React.useState<PushStatusDTO | null>(null);
  // Client-side "last synced" stamps for the offline banner.
  const [contentSyncedAt, setContentSyncedAt] = React.useState<string | null>(null);
  const [weatherSyncedAt, setWeatherSyncedAt] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loginKind, setLoginKind] = React.useState<"admin" | "barangay" | null>(null);
  // ---- Fetchers ----------------------------------------------------------

  const fetchHomepage = React.useCallback(async () => {
    try {
      const res = await portalApiPublic.homepage();
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Unable to load the portal.");
    }
  }, []);

  const fetchContent = React.useCallback(async () => {
    try {
      setContent(await portalApiPublic.content());
      setContentSyncedAt(new Date().toISOString());
    } catch {
      // keep previous content; sections show their own fallbacks
    }
  }, []);

  const fetchEvacuation = React.useCallback(async () => {
    try {
      const res = await fetch("/api/public/evacuation", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setEvacuation((await res.json()) as PublicEvacResponse);
      setEvacError(null);
    } catch {
      // Keep the last synchronized data — the finder flags it as stale.
      setEvacError("Unable to refresh evacuation data.");
    }
  }, []);

  const fetchPushStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/public/push/key", { cache: "no-store" });
      if (!res.ok) return;
      setPushStatus((await res.json()) as PushStatusDTO);
    } catch {
      // Push UI shows its "coming soon" notice when status is unavailable.
    }
  }, []);

  const fetchWeather = React.useCallback(async () => {
    try {
      setWeather(await portalApiPublic.weather());
      setWeatherSyncedAt(new Date().toISOString());
    } catch {
      setWeather(awsUnavailable("Live weather is temporarily unavailable. Please try again later."));
    }
  }, []);

  const fetchForecast = React.useCallback(async () => {
    try {
      setForecast(await portalApiPublic.forecast());
    } catch {
      setForecast(forecastUnavailable("The forecast service is temporarily unavailable. Please try again later."));
    }
  }, []);

  // ---- Initial load (parallel) + staggered weather -----------------------

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([fetchHomepage(), fetchContent(), fetchEvacuation(), fetchPushStatus()]);
      if (cancelled) return;
      await Promise.all([fetchWeather(), fetchForecast()]);
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchHomepage, fetchContent, fetchWeather, fetchForecast, fetchEvacuation, fetchPushStatus]);

  // ---- PWA service worker registration (public app only) -----------------

  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Ask a waiting worker to activate immediately when it arrives.
          reg.waiting?.postMessage("SKIP_WAITING");
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            installing?.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                installing.postMessage("SKIP_WAITING");
              }
            });
          });
        })
        .catch((err) => console.warn("[portal] service worker registration failed", err));
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  // ---- Polling -----------------------------------------------------------

  React.useEffect(() => {
    const intervals: ReturnType<typeof setInterval>[] = [
      setInterval(fetchHomepage, POLL.homepage),
      setInterval(fetchContent, POLL.content),
      setInterval(fetchWeather, POLL.weather),
      setInterval(fetchForecast, POLL.forecast),
      setInterval(fetchEvacuation, POLL.evacuation),
    ];
    return () => intervals.forEach(clearInterval);
  }, [fetchHomepage, fetchContent, fetchWeather, fetchForecast, fetchEvacuation]);

  // ---- Refetch on focus / reconnect + manual refresh events --------------

  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchHomepage();
        void fetchContent();
        void fetchEvacuation();
      }
    };
    const onOnline = () => {
      void fetchHomepage();
      void fetchContent();
      void fetchWeather();
      void fetchForecast();
      void fetchEvacuation();
    };
    const onRefresh = (e: Event) => {
      const kind = (e as CustomEvent<"weather" | "forecast">).detail;
      if (kind === "weather") void fetchWeather();
      if (kind === "forecast") void fetchForecast();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener(PORTAL_REFRESH_EVENT, onRefresh as EventListener);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(PORTAL_REFRESH_EVENT, onRefresh as EventListener);
    };
  }, [fetchHomepage, fetchContent, fetchWeather, fetchForecast, fetchEvacuation]);

  // ---- Error state --------------------------------------------------------

  if (error && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-red-50 text-emergency-red">
          <WifiOff aria-hidden="true" className="size-8" />
        </span>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Unable to load the portal</h1>
        <p className="max-w-md text-sm leading-relaxed text-slate-500">
          {error} Check your internet connection and try again.
        </p>
        <Button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            void fetchHomepage().then(() => setLoading(false));
            void fetchContent();
            void fetchWeather();
            void fetchForecast();
            void fetchEvacuation();
            void fetchPushStatus();
          }}
          className="h-12 gap-2 bg-gov-blue px-6 font-bold hover:bg-gov-blue-700"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return <PortalLoadingSkeleton />;
  }

  return (
    <>
      <PortalSiteView
        data={data}
        content={content}
        weather={weather}
        forecast={forecast}
        evacuation={evacuation}
        evacuationError={evacError}
        onRetryEvacuation={() => void fetchEvacuation()}
        pushStatus={pushStatus}
        contentSyncedAt={contentSyncedAt}
        weatherSyncedAt={weatherSyncedAt}
        loading={loading}
        onOpenLogin={(kind) => setLoginKind(kind)}
        initialVerifyDocId={initialVerifyDocId}
      />

      {/* MDRRMO login dialog + Barangay Public selector (33 frontpages).
          Barangay staff sign in from their own frontpage (/barangay/<slug>). */}
      <AdminLoginDialog
        open={loginKind === "admin"}
        onOpenChange={(o) => !o && setLoginKind(null)}
        onAuth={(s) => onAuth(s)}
      />
      <BarangayPublicDialog
        open={loginKind === "barangay"}
        onOpenChange={(o) => !o && setLoginKind(null)}
      />
    </>
  );
}
