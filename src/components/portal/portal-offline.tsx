"use client";

// QAS33 Public Portal — offline indicator.
//
// Listens to browser online/offline events. While offline, a fixed banner at
// the top of the viewport flags that the page is showing LAST SYNCHRONIZED
// information (with per-source sync times), so stale data is never presented
// as real-time. When connectivity returns: toast + onRefresh() so the portal
// immediately re-fetches live data.

import * as React from "react";
import { WifiOff } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { timeAgo } from "./portal-shared";

export function PortalOfflineBanner({
  evacuationSyncedAt,
  contentSyncedAt,
  weatherSyncedAt,
  onRefresh,
}: {
  evacuationSyncedAt?: string | null;
  contentSyncedAt?: string | null;
  weatherSyncedAt?: string | null;
  onRefresh?: () => void;
}) {
  const { toast } = useToast();
  const [offline, setOffline] = React.useState(false);
  const onRefreshRef = React.useRef(onRefresh);

  React.useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  React.useEffect(() => {
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      toast({
        title: "Back online — refreshing",
        description: "Reconnecting to MDRRMO live information.",
      });
      onRefreshRef.current?.();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  const sources: Array<{ label: string; at?: string | null }> = [
    { label: "Evacuation", at: evacuationSyncedAt },
    { label: "Announcements & news", at: contentSyncedAt },
    { label: "Weather", at: weatherSyncedAt },
  ];
  const withTime = sources.filter((s) => s.at);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[70] border-b border-amber-300 bg-amber-50/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          Offline mode — showing last synchronized information
        </span>
        {withTime.length > 0 ? (
          <span className="text-[11px] font-medium text-amber-800">
            ({withTime.map((s) => `${s.label} ${timeAgo(s.at)}`).join(" · ")})
          </span>
        ) : null}
      </div>
    </div>
  );
}
