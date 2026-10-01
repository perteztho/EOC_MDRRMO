"use client";

// QAS33 – BDRRMP System — single-page application shell
// The public sees the MDRRMO public information portal; logged-in barangays
// and MDRRMO staff get their respective application consoles (client-side
// view switching). Visiting /barangay/<slug> (rewritten to /?brgy=<slug>)
// renders that barangay's public frontpage instead of the MDRRMO portal.
//
// Performance: the four console bundles (public portal, barangay console,
// MDRRMO console, barangay frontpage) are large and mutually exclusive — each
// visitor needs exactly ONE of them. They are loaded via next/dynamic so the
// initial JS payload only contains this tiny shell; the required console
// streams in behind the boot skeleton.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/qas33/api";
import { ADMIN_ROLE_META, normalizeAdminRole, type SessionInfo } from "@/lib/qas33/types";

function ConsoleSkeleton() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <div className="flex items-center gap-3">
        <img
          src="/logome-256.webp"
          alt=""
          aria-hidden="true"
          className="h-11 w-11 rounded-full object-contain animate-pulse"
        />
        <div>
          <div className="text-lg font-bold tracking-tight">QAS33</div>
          <div className="text-xs text-muted-foreground">BDRRMP Monitoring System</div>
        </div>
      </div>
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
      </div>
      <p className="text-xs text-muted-foreground">Municipality of Pio Duran — MDRRMO</p>
    </div>
  );
}

const PortalApp = dynamic(() => import("@/components/portal/portal-app"), {
  ssr: false,
  loading: () => <ConsoleSkeleton />,
});
const BarangayApp = dynamic(() => import("@/components/qas33/barangay-app"), {
  ssr: false,
  loading: () => <ConsoleSkeleton />,
});
const MdrrmoApp = dynamic(() => import("@/components/qas33/mdrrmo-app"), {
  ssr: false,
  loading: () => <ConsoleSkeleton />,
});
const BarangayFrontpageApp = dynamic(() => import("@/components/portal/barangay-frontpage"), {
  ssr: false,
  loading: () => <ConsoleSkeleton />,
});

export default function Home() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyDocId, setVerifyDocId] = useState<string | null>(null);
  const [brgySlug, setBrgySlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Read ?verify=DOCID for QR-code verification links and the barangay
    // frontpage slug (?brgy=<slug>, or a /barangay/<slug> path — the rewrite
    // maps it onto this route) — post-hydration to avoid SSR mismatches.
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const params = new URLSearchParams(window.location.search);
        const v = params.get("verify");
        if (v) setVerifyDocId(v.trim());
        const pathMatch = window.location.pathname.match(/^\/barangay\/([a-z0-9-]+)\/?$/i);
        const brgy = params.get("brgy") || (pathMatch ? pathMatch[1] : null);
        if (brgy) setBrgySlug(brgy.trim().toLowerCase());
      } catch {
        // ignore
      }
    });
    // Restore session on load / refresh
    api
      .me()
      .then((res) => {
        if (!cancelled) setSession(res.session);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAuth = useCallback((s: SessionInfo | null) => {
    setSession(s);
  }, []);

  const handleLogout = useCallback(() => {
    api
      .logout()
      .catch(() => undefined)
      .finally(() => {
        setSession(null);
        // Clear the verify param / barangay frontpage slug so the user
        // returns to a clean MDRRMO landing page
        setVerifyDocId(null);
        setBrgySlug(null);
        try {
          window.history.replaceState({}, "", "/");
        } catch {
          // ignore
        }
      });
  }, []);

  if (loading) {
    return <ConsoleSkeleton />;
  }

  // QR verification links (?verify=DOCID) always show the public verification
  // view — even for signed-in users — with a way back to their console.
  if (verifyDocId && session) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="bg-primary text-primary-foreground px-4 py-2 text-center text-sm">
          You are signed in as{" "}
          <strong>
            {session.role === "ADMIN"
              ? `${session.admin?.name ?? "MDRRMO"} (${ADMIN_ROLE_META[normalizeAdminRole(session.admin?.role)].label})`
              : `Barangay ${session.barangay?.name ?? ""}`}
          </strong>
          .{" "}
          <button
            className="underline underline-offset-2 font-medium cursor-pointer"
            onClick={() => {
              setVerifyDocId(null);
              try {
                window.history.replaceState({}, "", "/");
              } catch {
                // ignore
              }
            }}
          >
            Return to your console
          </button>
        </div>
        <div className="flex-1">
          <PortalApp initialVerifyDocId={verifyDocId} onAuth={handleAuth} />
        </div>
      </div>
    );
  }

  // Barangay public frontpage (/barangay/<slug>) — shown even when someone
  // is signed in (with a return-to-console banner), mirroring the verify flow.
  if (brgySlug) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        {session ? (
          <div className="bg-primary px-4 py-2 text-center text-sm text-primary-foreground">
            You are signed in as{" "}
            <strong>
              {session.role === "ADMIN"
                ? `${session.admin?.name ?? "MDRRMO"} (${ADMIN_ROLE_META[normalizeAdminRole(session.admin?.role)].label})`
                : `Barangay ${session.barangay?.name ?? ""}`}
            </strong>
            .{" "}
            <button
              className="underline underline-offset-2 font-medium cursor-pointer"
              onClick={() => {
                setBrgySlug(null);
                try {
                  window.history.replaceState({}, "", "/");
                } catch {
                  // ignore
                }
              }}
            >
              Return to your console
            </button>
          </div>
        ) : null}
        <div className="flex-1">
          {/* After a successful frontpage login, take the barangay/admin user
              straight to their console (they administer the frontpage from
              there) — mirroring the original portal login behavior. */}
          <BarangayFrontpageApp
            slug={brgySlug}
            onAuth={(s) => {
              setSession(s);
              setBrgySlug(null);
              setVerifyDocId(null);
              try {
                window.history.replaceState({}, "", "/");
              } catch {
                // ignore
              }
            }}
          />
        </div>
      </div>
    );
  }

  if (session?.role === "BARANGAY") {
    return <BarangayApp session={session} onLogout={handleLogout} />;
  }

  if (session?.role === "ADMIN") {
    return <MdrrmoApp session={session} onLogout={handleLogout} />;
  }

  return <PortalApp initialVerifyDocId={verifyDocId} onAuth={handleAuth} />;
}
