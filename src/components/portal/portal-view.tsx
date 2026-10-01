"use client";

// QAS33 Public Portal — PortalSiteView
// -----------------------------------------------------------------------
// Presentational composition of the complete public portal site:
// emergency banner → utility bar → header/nav → broadcast ticker →
// sections (hero, weather, announcements, …) → footer + bottom app bar
// (mobile) + global modals.
//
// This contract is shared by BOTH:
//   • the public portal app  (src/components/portal/portal-app.tsx)
//   • the admin preview dialog (src/components/qas33/portal-settings-manager.tsx)
//
// TYPHOON/EMERGENCY operation renders the ENTIRE site in a professional
// dark "emergency operations" theme: the `portal-dark` class is applied to
// the site root — and, outside preview mode, to <html> as well, so Radix
// portals (modals, drawers) inherit the dark tokens too.
// -----------------------------------------------------------------------

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  AwsWeatherResponse,
  ForecastResponse,
  HomepageResponse,
  OperationalMode,
  PortalContentResponse,
} from "@/lib/qas33/portal-types";
import type { PublicEvacResponse, PushStatusDTO } from "@/lib/qas33/emergency-types";
import { triggerPortalRefresh, type PortalLinkCtx } from "./portal-shared";
import { EmergencyBanner, PortalHeader, UtilityBar } from "./portal-header";
import { BroadcastTicker } from "./portal-ticker";
import { SectionRenderer, type PortalDevice } from "./portal-sections";
import { PortalFooter } from "./portal-footer";
import { HotlineModal, ReportIncidentModal } from "./portal-modals";
import { VerifyOverlay } from "./portal-login";
import { PortalBottomAppBar } from "./portal-bottom-bar";
import { PortalEvacuation } from "./portal-evacuation";
import { PortalOfflineBanner } from "./portal-offline";

export interface PortalSiteViewProps {
  /** Published (or synthesized draft) homepage configuration. */
  data: HomepageResponse;
  /** Public content (announcements, ticker, alerts, hotlines, news, …). Null → skeleton states. */
  content: PortalContentResponse | null;
  /** Live AWS observed weather. Null → unavailable state. */
  weather: AwsWeatherResponse | null;
  /** 7-day forecast. Null → unavailable state. */
  forecast: ForecastResponse | null;
  /** LIVE evacuation data (GET /api/public/evacuation) — powers the
   *  evacuation section, embedded map and the full-screen finder. Null in the
   *  admin preview (falls back to the content-directory rendering). */
  evacuation?: PublicEvacResponse | null;
  /** Set when the last evacuation refresh failed (previous data kept). */
  evacuationError?: string | null;
  /** Retry the evacuation fetch (wired by the public app). */
  onRetryEvacuation?: () => void;
  /** Web-push configuration status (GET /api/public/push/key). */
  pushStatus?: PushStatusDTO | null;
  /** Client-side sync stamps for the offline banner. */
  contentSyncedAt?: string | null;
  weatherSyncedAt?: string | null;
  /** Show top-level loading skeleton. */
  loading?: boolean;
  /** Preview mode: disables live polling behaviors and login actions. */
  preview?: boolean;
  /** Force a mode for preview (overrides data.mode). */
  modeOverride?: OperationalMode;
  /** Device frame for preview. */
  device?: "desktop" | "mobile";
  /** Opens a login dialog (public app wires this; preview omits it). */
  onOpenLogin?: (kind: "admin" | "barangay") => void;
  /** QR verification doc id (public app only). */
  initialVerifyDocId?: string | null;
}

/** Responsive device breakpoint hook (mobile <768 · tablet <1024 · desktop). */
function usePortalDevice(): PortalDevice {
  const [device, setDevice] = React.useState<PortalDevice>("desktop");
  React.useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      if (w < 768) setDevice("mobile");
      else if (w < 1024) setDevice("tablet");
      else setDevice("desktop");
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return device;
}

/** Full-page portal loading skeleton (also used by the app shell). */
export function PortalLoadingSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50" aria-busy="true">
      <div className="h-8 bg-gov-blue-deep" />
      <div className="h-16 border-b border-slate-200 bg-white" />
      <div className="h-9 border-b border-gov-blue-100 bg-gov-blue-50" />
      <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <Skeleton className="h-4 w-72 rounded" />
            <Skeleton className="h-12 w-full max-w-xl rounded" />
            <Skeleton className="h-4 w-full max-w-lg rounded" />
            <Skeleton className="h-4 w-96 rounded" />
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-12 w-44 rounded-lg" />
              <Skeleton className="h-12 w-44 rounded-lg" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Renders the complete public portal site. Fully presentational — no fetching.
 */
export function PortalSiteView(props: PortalSiteViewProps) {
  const { data, content, weather, forecast, loading, preview } = props;

  const mode: OperationalMode = props.modeOverride ?? data.mode;
  const emergency = mode !== "NORMAL";
  const viewportDevice = usePortalDevice();
  const device: PortalDevice = props.device === "mobile" ? "mobile" : viewportDevice;

  // Modal state (hotlines / report) lives here; login is delegated to the app.
  const [modal, setModal] = React.useState<"hotlines" | "report" | null>(null);
  // Hamburger drawer state lives here so the mobile bottom bar can open it too.
  const [navOpen, setNavOpen] = React.useState(false);
  // Full-screen evacuation finder overlay.
  const [evacOpen, setEvacOpen] = React.useState(false);
  const [verifyDocId, setVerifyDocId] = React.useState<string | null>(props.initialVerifyDocId ?? null);

  React.useEffect(() => {
    setVerifyDocId(props.initialVerifyDocId ?? null);
  }, [props.initialVerifyDocId]);

  // TYPHOON/EMERGENCY → full-site dark theme. Outside preview mode we also
  // flag <html> so Radix portals (dialogs/sheets rendered at document.body
  // level) inherit the dark tokens. Cleanup keeps the admin console light.
  React.useEffect(() => {
    if (preview) return;
    const root = document.documentElement;
    if (emergency) root.classList.add("portal-dark");
    else root.classList.remove("portal-dark");
    return () => root.classList.remove("portal-dark");
  }, [emergency, preview]);

  const onOpenLogin = preview ? undefined : props.onOpenLogin;
  // The evacuation finder + push bell are live-data features — not rendered in
  // the admin preview (sections fall back to the content-directory view).
  const openEvacFinder = preview || !props.evacuation ? undefined : () => setEvacOpen(true);

  const linkCtx: PortalLinkCtx = React.useMemo(
    () => ({
      onOpenModal: (m) => setModal(m),
      onOpenLogin,
      onOpenApp: (app) => {
        if (app === "verify") setVerifyDocId("");
      },
    }),
    [onOpenLogin]
  );

  // Sections may override the effective mode (admin preview)
  const effectiveData = React.useMemo(
    () =>
      props.modeOverride && props.modeOverride !== data.mode
        ? { ...data, mode, visualMode: emergency ? ("emergency" as const) : ("normal" as const) }
        : data,
    [data, props.modeOverride, mode, emergency]
  );

  // The under-header ticker is skipped when an inline ticker section exists
  const hasTickerSection = data.sections.some((s) => s.template === "ticker" && s.status === "ACTIVE");
  const tickerMessages = content?.ticker ?? [];

  if (loading) {
    return <PortalLoadingSkeleton />;
  }

  const site = (
    <div className={cn("portal-site-root flex min-h-screen flex-col", emergency && "portal-dark")}>
      {/* Skip to content (first focusable) */}
      <a
        href="#main-content"
        className="sr-only z-50 rounded-b-lg bg-gov-gold px-4 py-2.5 text-sm font-bold text-gov-blue-deep focus:not-sr-only focus:absolute focus:left-2 focus:top-2"
      >
        Skip to main content
      </a>

      {emergency && data.operational.bannerEnabled ? <EmergencyBanner bannerText={data.operational.bannerText} /> : null}

      <UtilityBar general={data.general} emergency={emergency} onOpenLogin={onOpenLogin} preview={preview} />

      <PortalHeader
        data={effectiveData}
        mode={mode}
        emergency={emergency}
        onOpenModal={(m) => setModal(m)}
        onOpenLogin={onOpenLogin}
        onOpenEvac={openEvacFinder}
        pushStatus={preview ? null : props.pushStatus ?? null}
        preview={preview}
        linkCtx={linkCtx}
        navOpen={navOpen}
        onNavOpenChange={setNavOpen}
      />

      {!hasTickerSection && tickerMessages.length > 0 ? (
        <BroadcastTicker messages={tickerMessages} emergency={emergency} />
      ) : null}

      <main id="main-content" className="flex-1">
        {data.sections.map((section) => (
          <SectionRenderer
            key={section.id}
            section={section}
            data={effectiveData}
            content={content}
            weather={weather}
            forecast={forecast}
            evacuation={props.evacuation}
            pushStatus={preview ? null : props.pushStatus ?? null}
            onOpenEvac={openEvacFinder}
            linkCtx={linkCtx}
            device={device}
            refreshWeather={() => triggerPortalRefresh("weather")}
            refreshForecast={() => triggerPortalRefresh("forecast")}
            onOpenModal={(m) => setModal(m)}
            preview={preview}
          />
        ))}
      </main>

      <PortalFooter data={effectiveData} mode={mode} onOpenLogin={onOpenLogin} onOpenModal={(m) => setModal(m)} linkCtx={linkCtx} preview={preview} />

      {/* Mobile bottom app bar (auto-detects phones via md:hidden).
          position:sticky keeps it in the flow — pinned to the viewport bottom
          on the real site and to the admin preview frame's scrollport.
          TYPHOON/EMERGENCY mode swaps Weather → Evacuate (opens the finder). */}
      <PortalBottomAppBar
        emergency={emergency}
        onOpenModal={(m) => setModal(m)}
        onOpenMenu={() => setNavOpen(true)}
        onOpenEvac={openEvacFinder}
        weatherAnchor={data.sections.some((s) => s.template === "weather" && s.status === "ACTIVE") ? "weather" : "home"}
        hidden={modal !== null || evacOpen}
        forceVisible={props.device === "mobile"}
      />

      {/* Global modals */}
      <HotlineModal open={modal === "hotlines"} onOpenChange={(o) => !o && setModal(null)} hotlines={content?.hotlines ?? []} general={data.general} />
      <ReportIncidentModal open={modal === "report"} onOpenChange={(o) => !o && setModal(null)} barangays={content?.barangays ?? []} />

      {/* QR document verification overlay */}
      {verifyDocId !== null ? (
        <VerifyOverlay initialDocId={verifyDocId} onClose={() => setVerifyDocId(null)} />
      ) : null}

      {/* Full-screen public evacuation finder overlay */}
      <PortalEvacuation
        open={evacOpen}
        onClose={() => setEvacOpen(false)}
        data={props.evacuation ?? null}
        error={props.evacuationError ?? null}
        onRetry={props.onRetryEvacuation}
        mode={mode}
        pushStatus={props.pushStatus ?? null}
        hotline={data.general.hotline}
      />

      {/* Offline indicator (fixed banner + auto refresh on reconnect) */}
      <PortalOfflineBanner
        evacuationSyncedAt={props.evacuation?.generatedAt ?? null}
        contentSyncedAt={props.contentSyncedAt ?? null}
        weatherSyncedAt={props.weatherSyncedAt ?? null}
        onRefresh={() => {
          triggerPortalRefresh("weather");
          triggerPortalRefresh("forecast");
          props.onRetryEvacuation?.();
        }}
      />
    </div>
  );

  if (props.device === "mobile") {
    return (
      // Simple 390px frame — the admin preview wraps this in its own phone-like
      // scroll container; the sticky bottom bar pins to that scrollport.
      <div className="portal-frame mx-auto w-[390px] max-w-full bg-white">{site}</div>
    );
  }

  return site;
}
