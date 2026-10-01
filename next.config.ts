import type { NextConfig } from "next";

// Static brand assets are content-stable (renamed on change, e.g. hero-bg),
// so they can be cached aggressively at the browser/CDN edge.
const IMMUTABLE_ASSETS = [
  "/hero-bg.webp",
  "/main-bg.webp",
  "/logome.webp",
  "/logome-256.webp",
  "/logo.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/brgy/:path*",
];

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Long-lived caching for content-stable public assets (immutable: the asset
  // is versioned by filename — new image ⇒ new URL ⇒ no stale caches).
  async headers() {
    return IMMUTABLE_ASSETS.map((source) => ({
      source,
      headers: [
        { key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400, immutable" },
      ],
    }));
  },
  // dev: config touch triggers the built-in dev-server auto-restart
  // (used to pick up regenerated Prisma clients after `db:push`)
  async rewrites() {
    return [
      // Barangay public frontpages — /barangay/agol etc. are served by the
      // single "/" SPA route; page.tsx reads the slug (path or ?brgy=) and
      // renders the barangay frontpage instead of the MDRRMO portal.
      { source: "/barangay/:slug", destination: "/?brgy=:slug" },
    ];
  },
};

export default nextConfig;
