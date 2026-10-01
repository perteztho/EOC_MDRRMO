/* QAS33 — Pio Duran Emergency Portal service worker.
 * Vanilla JS (no build step). Strategies:
 *  - Public API endpoints (evacuation / content / news): network-first with
 *    cache fallback, cache put on success — so the portal keeps serving the
 *    last synchronized data while OFFLINE (never presented as real-time: the
 *    UI stamps every view with the server "generatedAt" timestamp).
 *  - Navigation requests: network-first → cache "/" → offline fallback.
 *  - /_next/static + icons: network-first with cache fallback. NOT cache-first:
 *    dev-server chunk URLs are not content-stable, and a stale cached bundle
 *    hydrating fresh server HTML causes React hydration mismatches
 *    (server HTML ≠ client JS). Network-first guarantees a matching bundle
 *    whenever online, while the cache still covers offline.
 *  - Web push: shows notifications with icon/badge/tag and focuses or opens
 *    the target URL on click.
 */

const VERSION = "qas33-v3";
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;
const STATIC_CACHE = `${VERSION}-static`;

const APP_SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

/** Public API endpoints cached for offline reading (network-first). */
const DATA_API = [
  "/api/public/homepage",
  "/api/public/evacuation",
  "/api/public/content",
  "/api/public/news",
  "/api/public/weather",
];

self.addEventListener("install", (event) => {
  // Take over immediately — a stale predecessor must not keep serving old
  // bundles that mismatch freshly served HTML (hydration errors).
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove caches from previous versions.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/** Network-first with cache fallback (used for API data, build assets, icons). */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone()).catch(() => undefined);
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Public API — network-first with cache fallback.
  if (DATA_API.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))) {
    event.respondWith(
      networkFirst(request, DATA_CACHE).catch(
        () =>
          new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    );
    return;
  }

  // Next.js build assets + icons — network-first (see header comment) so the
  // JS bundle always matches the served HTML; cache only as offline fallback.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon-")) {
    event.respondWith(
      networkFirst(request, STATIC_CACHE).catch(() => fetch(request))
    );
    return;
  }

  // Page navigations — network-first, fall back to cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          if (fresh && fresh.ok && url.pathname === "/") {
            cache.put("/", fresh.clone()).catch(() => undefined);
          }
          return fresh;
        } catch (err) {
          const cache = await caches.open(SHELL_CACHE);
          const shell = (await cache.match("/")) || (await cache.match(request));
          if (shell) return shell;
          return new Response(
            "<!doctype html><title>QAS33 — Offline</title><meta name=viewport content='width=device-width,initial-scale=1'><body style='font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#020f3f;color:#fff'><div style=text-align:center><h1>QAS33</h1><p>You are offline and the portal shell has not been cached yet.<br>Reconnect to load the emergency portal.</p></div></body>",
            { status: 503, headers: { "Content-Type": "text/html" } }
          );
        }
      })()
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = { title: "QAS33 Pio Duran", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "QAS33 — Pio Duran";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "qas33",
    data: { url: payload.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.pathname === target || "focus" in client) {
            if ("navigate" in client && clientUrl.pathname !== target && target !== "/") {
              await client.navigate(target).catch(() => undefined);
            }
            return client.focus();
          }
        } catch (err) {
          /* ignore */
        }
      }
      return self.clients.openWindow(target);
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
