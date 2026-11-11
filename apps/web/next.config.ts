import type { NextConfig } from "next";

// pacr.life: the community site on the pacr Web Design System. It replaced
// the static site (the .html pages and api/ functions at the repo root) and
// takes over everything that served:
//   - the share pages /s /e /p /u and their pictures are routes here;
//   - the host dashboard /host is its own app (apps/host, Vercel project
//     pacr-host), reached through the rewrites below;
//   - /download and the legacy event editor (/host/new, /host/apply,
//     /host/e/*) are the old pages, copied unchanged into public/legacy with
//     the scripts, styles and pictures they load (public/js, public/nav.css,
//     public/brand-acid, public/assets);
//   - .well-known (app links), the Google verification files, og-image.png
//     and robots.txt are copied into public/; sitemap.xml is app/sitemap.ts.
const HOST_APP = "https://pacr-host.vercel.app";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The training-plan and coach pages moved to /plans/<distance> and /app.
      { source: "/5k-training-plan", destination: "/plans/5k", permanent: true },
      { source: "/10k-training-plan", destination: "/plans/10k", permanent: true },
      { source: "/half-marathon-training-plan", destination: "/plans/half-marathon", permanent: true },
      { source: "/marathon-training-plan", destination: "/plans/marathon", permanent: true },
      { source: "/running-coach-app", destination: "/app", permanent: true },
      // No plans index yet: the first distance stands in for it.
      { source: "/plans", destination: "/plans/5k", permanent: false },
      // Run buddies is app-only: the web explains it on /safety and doesn't
      // list or open runs. Old links (incl. ?run=) land on that explainer.
      { source: "/runbuddies", destination: "/safety#run-buddies", permanent: false },
      // /social and /downloads tag /download with ?via= for attribution.
      { source: "/social", destination: "/download?via=social", permanent: true },
      { source: "/downloads", destination: "/download?via=downloads", permanent: true },
      // The static site served every page at /name.html too (cleanUrls), so
      // old links and bookmarks keep working. Query strings carry over.
      { source: "/index.html", destination: "/", permanent: true },
      ...["privacy", "terms", "community-rules", "support", "signin", "feed", "profile", "live", "download"]
        .map(p => ({ source: `/${p}.html`, destination: `/${p}`, permanent: true })),
      ...["5k", "10k", "half-marathon", "marathon"]
        .map(d => ({ source: `/${d}-training-plan.html`, destination: `/plans/${d}`, permanent: true })),
      { source: "/running-coach-app.html", destination: "/app", permanent: true },
      { source: "/host-events.html", destination: "/host/new", permanent: true },
      { source: "/host-events", destination: "/host/new", permanent: true },
      // The static site's share functions, if anything still calls them directly.
      { source: "/api/squad", has: [{ type: "query", key: "slug", value: "(?<slug>[a-z0-9-]+)" }], destination: "/s/:slug", permanent: false },
      { source: "/api/profile", has: [{ type: "query", key: "handle", value: "@?(?<handle>[A-Za-z0-9_.]+)" }], destination: "/u/:handle", permanent: false },
      { source: "/api/post", has: [{ type: "query", key: "ref", value: "(?<ref>[A-Za-z0-9_-]+)" }], destination: "/p/:ref", permanent: false },
      { source: "/api/event", has: [{ type: "query", key: "ref", value: "(?<ref>[A-Za-z0-9_-]+)" }], destination: "/e/:ref", permanent: false },
    ];
  },
  async rewrites() {
    return {
      // In order: the legacy pages first, then the rest of /host to its app.
      beforeFiles: [
        { source: "/download", destination: "/legacy/download.html" },
        { source: "/host/new", destination: "/legacy/host-events.html" },
        { source: "/host/apply", destination: "/legacy/host-events.html" },
        { source: "/host/e/:path*", destination: "/legacy/host-events.html" },
        { source: "/host", destination: `${HOST_APP}/host` },
        { source: "/host/:path*", destination: `${HOST_APP}/host/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      // iOS reads this file for universal links; it has no extension.
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
