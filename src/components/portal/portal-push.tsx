"use client";

// QAS33 Public Portal — web push subscription UI.
//
// Two variants:
//  • PortalPushButton — compact bell for the header utility area (Popover).
//  • PortalPushCard  — subtle card used at the top of the evacuation finder
//                      and the news section.
//
// Behavior: unconfigured → "coming soon" notice (server has no VAPID keys);
// configured + permission default → subscribe on click (Notification.request
// → pushManager.subscribe → POST /api/public/push/subscribe); granted +
// subscribed → status popover with a Disable action (POST …/unsubscribe).
// Subscribed state is persisted in localStorage; unsupported browsers get a
// graceful explanation.

import * as React from "react";
import { Bell, BellRing, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PushStatusDTO } from "@/lib/qas33/emergency-types";
import { useToast } from "@/hooks/use-toast";

const SUBSCRIBED_KEY = "qas33_push_subscribed";

/** VAPID public key (base64url) → Uint8Array over a plain ArrayBuffer
 *  (the PushManager.subscribe signature requires ArrayBuffer-backed data). */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type PushUiState = "checking" | "unsupported" | "unconfigured" | "off" | "on" | "working";

interface PushController {
  state: PushUiState;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  supported: boolean;
}

/** Shared subscription logic hook. */
function usePushController(pushStatus: PushStatusDTO | null): PushController {
  const { toast } = useToast();
  const [state, setState] = React.useState<PushUiState>("checking");

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  React.useEffect(() => {
    if (!supported) {
      setState("unsupported");
      return;
    }
    if (!pushStatus) {
      setState("checking");
      return;
    }
    if (!pushStatus.configured) {
      setState("unconfigured");
      return;
    }
    if (Notification.permission !== "granted") {
      setState("off");
      return;
    }
    // Permission granted — check whether this device already has a subscription.
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          window.localStorage.setItem(SUBSCRIBED_KEY, "1");
          setState("on");
        } else if (window.localStorage.getItem(SUBSCRIBED_KEY) === "1") {
          // Stale local flag (e.g. cleared server-side) — fall back to off.
          window.localStorage.removeItem(SUBSCRIBED_KEY);
          setState("off");
        } else {
          setState("off");
        }
      } catch {
        setState("off");
      }
    })();
  }, [pushStatus, supported]);

  const enable = React.useCallback(async () => {
    if (!pushStatus?.configured || !pushStatus.publicKey || !supported) return;
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("off");
        toast({
          title: "Notifications blocked",
          description: "Allow notifications for this site in your browser settings, then try again.",
        });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(pushStatus.publicKey),
        });
      }
      const json = sub.toJSON();
      const res = await fetch("/api/public/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: {
            p256dh: (json.keys as Record<string, string> | undefined)?.p256dh,
            auth: (json.keys as Record<string, string> | undefined)?.auth,
          },
        }),
      });
      if (!res.ok) throw new Error(`subscribe failed (${res.status})`);
      window.localStorage.setItem(SUBSCRIBED_KEY, "1");
      setState("on");
      toast({
        title: "Emergency alerts enabled on this device",
        description: "You will receive official MDRRMO Pio Duran push notifications.",
      });
    } catch (err) {
      console.error("[push] subscribe failed", err);
      setState("off");
      toast({
        title: "Could not enable notifications",
        description: "Please try again in a moment.",
      });
    }
  }, [pushStatus, supported, toast]);

  const disable = React.useCallback(async () => {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/public/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
      }
      window.localStorage.removeItem(SUBSCRIBED_KEY);
      setState("off");
      toast({ title: "Notifications disabled", description: "You will no longer receive push alerts on this device." });
    } catch {
      setState("on");
      toast({ title: "Could not disable notifications", description: "Please try again in a moment." });
    }
  }, [toast]);

  return { state, enable, disable, supported };
}

// ---------------------------------------------------------------------------
// Header bell button (Popover)
// ---------------------------------------------------------------------------

export function PortalPushButton({ pushStatus }: { pushStatus: PushStatusDTO | null }) {
  const ctrl = usePushController(pushStatus);
  const [open, setOpen] = React.useState(false);

  const on = ctrl.state === "on";
  const busy = ctrl.state === "working";

  const body =
    ctrl.state === "unconfigured" || ctrl.state === "checking" || !pushStatus ? (
      <p className="text-sm leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-800">Push notifications coming soon</span> — not yet enabled by the
        administrator.
      </p>
    ) : ctrl.state === "unsupported" ? (
      <p className="text-sm leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-800">Not supported on this browser.</span> Emergency updates remain
        available on this page.
      </p>
    ) : on ? (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Notifications enabled
        </p>
        <p className="text-xs leading-relaxed text-slate-500">
          This device receives official MDRRMO Pio Duran emergency alerts.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void ctrl.disable()}
          className="h-9 w-full gap-2 border-slate-300 text-slate-700 hover:border-red-300 hover:text-red-700"
        >
          {busy ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : null}
          Disable notifications
        </Button>
      </div>
    ) : (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">Get emergency alerts on this device</span> — evacuation notices,
          critical advisories and official updates from the MDRRMO.
        </p>
        <Button
          type="button"
          disabled={busy}
          onClick={() => void ctrl.enable()}
          className="h-10 w-full gap-2 bg-gov-blue font-bold hover:bg-gov-blue-700"
        >
          {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Bell aria-hidden="true" className="size-4" />}
          Enable notifications
        </Button>
      </div>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={on ? "Push notifications enabled — manage" : "Enable push notifications"}
          className={cn(
            "relative flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold",
            on ? "text-emerald-600 hover:bg-emerald-50" : "text-gov-blue hover:bg-gov-blue-50"
          )}
        >
          {on ? <BellRing aria-hidden="true" className="size-5" /> : <Bell aria-hidden="true" className="size-5" />}
          {on ? (
            <span
              aria-hidden="true"
              className="absolute right-2 top-2 size-2 rounded-full border border-white bg-emerald-500"
            />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-72 p-4">
        {body}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Subtle card (evacuation finder + news section)
// ---------------------------------------------------------------------------

export function PortalPushCard({
  pushStatus,
  context,
}: {
  pushStatus: PushStatusDTO | null;
  context: "evacuation" | "news";
}) {
  const ctrl = usePushController(pushStatus);
  if (ctrl.state === "on" || ctrl.state === "checking") return null;

  if (ctrl.state === "unconfigured" || ctrl.state === "unsupported" || !pushStatus) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Bell aria-hidden="true" className="size-4.5" />
        </span>
        <p className="text-xs leading-relaxed text-slate-500">
          <span className="font-semibold text-slate-700">
            {ctrl.state === "unsupported" ? "Push notifications unavailable on this browser" : "Push notifications coming soon"}
          </span>{" "}
          —{" "}
          {context === "evacuation"
            ? "check this page for the latest evacuation updates."
            : "check this page for the latest official updates."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gov-blue-100 bg-gov-blue-50 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gov-blue text-white">
        <BellRing aria-hidden="true" className="size-4.5" />
      </span>
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-gov-blue">
        <span className="font-bold">
          {context === "evacuation" ? "Get evacuation alerts on this device" : "Get official updates on this device"}
        </span>{" "}
        — critical MDRRMO advisories delivered straight to you.
      </p>
      <Button
        type="button"
        size="sm"
        disabled={ctrl.state === "working"}
        onClick={() => void ctrl.enable()}
        className="h-9 gap-1.5 bg-gov-blue text-xs font-bold hover:bg-gov-blue-700"
      >
        {ctrl.state === "working" ? (
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        ) : (
          <Bell aria-hidden="true" className="size-3.5" />
        )}
        Enable
      </Button>
    </div>
  );
}
