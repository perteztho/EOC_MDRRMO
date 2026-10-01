"use client";

// QAS33 Public Portal — broadcast ticker strip (marquee beneath the header).
//
// Seamless-loop strategy: the CSS marquee translates the track by -50%, so the
// track must contain an EVEN number of copies of the message set and one HALF
// of the track must be at least as wide as the viewport — otherwise blank gaps
// appear during the loop (the old fixed x2 duplication broke on wide screens
// or with few/short messages). We measure one copy of the message set with a
// hidden measurer + ResizeObserver and repeat the set enough times to
// guarantee a gap-free loop at any viewport width. Speed stays constant
// (px/second) instead of a fixed duration, so short sets don't crawl and long
// sets don't race.

import * as React from "react";
import { Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TickerDTO } from "@/lib/qas33/portal-types";
import { PortalIcon } from "./portal-shared";

/** Marquee speed in pixels per second (single source of truth). */
const TICKER_SPEED_PX_S = 55;
/** Duration clamps so tiny/loaded tickers stay reasonable. */
const MIN_DURATION_S = 16;
const MAX_DURATION_S = 120;

function TickerItem({ msg, emergency }: { msg: TickerDTO; emergency?: boolean }) {
  const urgent = msg.priority === "EMERGENCY" || msg.priority === "CRITICAL";
  const high = msg.priority === "HIGH";
  return (
    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap px-4">
      <PortalIcon
        name={msg.icon || (urgent ? "triangle-alert" : "shield-check")}
        className={cn(
          "size-3.5 shrink-0",
          urgent ? "text-emergency-red" : high ? "text-amber-600" : emergency ? "text-red-700" : "text-gov-blue"
        )}
      />
      {urgent ? (
        <span className="rounded bg-emergency-red px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white">
          URGENT
        </span>
      ) : high ? (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-amber-500" />
      ) : null}
      <span className={cn("text-xs", urgent ? "font-semibold text-red-800" : "text-slate-700")}>{msg.message}</span>
      <span aria-hidden="true" className="pl-4 text-slate-400">
        •
      </span>
    </span>
  );
}

export function BroadcastTicker({ messages, emergency }: { messages: TickerDTO[]; emergency?: boolean }) {
  const [paused, setPaused] = React.useState(false);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);

  // Even number of copies of the message set (2 = until measured).
  const [copies, setCopies] = React.useState(2);
  // Animation duration for one full half-track pass (seconds).
  const [duration, setDuration] = React.useState(45);

  const messageKey = React.useMemo(() => messages.map((m) => `${m.id}:${m.message}:${m.priority}`).join("|"), [messages]);

  // Keep the DOM attribute in sync (CSS pauses on [data-paused="true"])
  React.useEffect(() => {
    if (trackRef.current) {
      trackRef.current.setAttribute("data-paused", paused ? "true" : "false");
    }
  }, [paused]);

  // ---- Measure: repeat the set until ONE HALF of the track covers the viewport
  React.useEffect(() => {
    const viewport = viewportRef.current;
    const measurer = measureRef.current;
    if (!viewport || !measurer || messages.length === 0) return;

    const recompute = () => {
      const setWidth = measurer.scrollWidth; // width of ONE copy of the set
      const vw = viewport.clientWidth;
      if (setWidth <= 0 || vw <= 0) return;
      // copies per half so a half-track always ≥ viewport (gap-free loop)
      const perHalf = Math.max(1, Math.ceil((vw + 1) / setWidth));
      const even = perHalf * 2;
      setCopies((prev) => (prev === even ? prev : even));
      // constant speed: duration = half-track width / speed
      const halfWidth = setWidth * perHalf;
      const dur = Math.min(MAX_DURATION_S, Math.max(MIN_DURATION_S, halfWidth / TICKER_SPEED_PX_S));
      setDuration((prev) => (Math.abs(prev - dur) < 0.5 ? prev : Math.round(dur * 10) / 10));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(viewport);
    ro.observe(measurer);
    return () => ro.disconnect();
  }, [messageKey]);

  if (!messages || messages.length === 0) return null;

  const durationStyle = { ["--ticker-duration" as string]: `${duration}s` } as React.CSSProperties;
  // Broadcast-style edge fades — items dissolve at both ends of the strip,
  // which makes the continuous marquee motion read clearly.
  const fadeStyle = {
    maskImage: "linear-gradient(to right, transparent 0, black 28px, black calc(100% - 28px), transparent 100%)",
    WebkitMaskImage: "linear-gradient(to right, transparent 0, black 28px, black calc(100% - 28px), transparent 100%)",
  } as React.CSSProperties;

  return (
    <div
      role="region"
      aria-label="Broadcast messages"
      className={cn(
        "relative z-30 border-b",
        emergency ? "border-red-200 bg-red-50" : "border-gov-blue-100 bg-gov-blue-50"
      )}
    >
      <div className="flex items-stretch">
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 px-3 py-2 text-[10px] font-bold tracking-wider text-white",
            emergency ? "bg-emergency-red" : "bg-gov-blue"
          )}
        >
          <span
            aria-hidden="true"
            className="portal-status-dot size-1.5 shrink-0 rounded-full bg-white"
          />
          <PortalIcon name="radio" className="size-3.5" />
          BULLETIN
        </div>
        {/* Hidden measurer — exactly ONE copy of the message set.
            Lives INSIDE the overflow-hidden viewport so its w-max content
            never creates page-level horizontal overflow. */}
        <div ref={viewportRef} style={fadeStyle} className="relative min-w-0 flex-1 overflow-hidden py-2">
          <div
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 flex w-max -translate-y-full opacity-0"
          >
            {messages.map((msg) => (
              <TickerItem key={`m-${msg.id}`} msg={msg} emergency={emergency} />
            ))}
          </div>
          <div
            ref={trackRef}
            style={durationStyle}
            className="portal-ticker-track items-center gap-0"
            data-paused={paused ? "true" : "false"}
          >
            {Array.from({ length: copies }).map((_, c) =>
              messages.map((msg) => <TickerItem key={`${c}-${msg.id}`} msg={msg} emergency={emergency} />)
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          aria-label={paused ? "Resume scrolling broadcast messages" : "Pause scrolling broadcast messages"}
          className={cn(
            "flex h-full w-11 shrink-0 items-center justify-center border-l transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gov-gold",
            emergency
              ? "border-red-200 text-red-700 hover:bg-red-100"
              : "border-gov-blue-100 text-gov-blue hover:bg-gov-blue-100"
          )}
        >
          {paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
        </button>
      </div>
    </div>
  );
}
