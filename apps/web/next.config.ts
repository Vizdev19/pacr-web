import type { NextConfig } from "next";

// pacr.life's community site: the home page, squads by city, runs this week
// and events, built on the pacr Web Design System.
//
// It sits beside the existing static site the way /host does. Everything this
// app doesn't serve (share pages /s /e /p /u, /signin, /feed, /profile,
// /live, /host, the legal pages and their scripts and pictures) falls back to
// pacr.life, so a local or preview build shows the real pages and the real
// /s/<slug>/photo pictures.
const nextConfig: NextConfig = {
  // Old static-site URLs (permanent): the training-plan and coach pages moved
  // to /plans/<distance> and /app; /social and /downloads keep pacr.life's
  // vercel.json behaviour, tagging /download with ?via= for attribution.
  async redirects() {
    return [
      { source: "/5k-training-plan", destination: "/plans/5k", permanent: true },
      { source: "/10k-training-plan", destination: "/plans/10k", permanent: true },
      { source: "/half-marathon-training-plan", destination: "/plans/half-marathon", permanent: true },
      { source: "/marathon-training-plan", destination: "/plans/marathon", permanent: true },
      { source: "/running-coach-app", destination: "/app", permanent: true },
      // No plans index yet: the first distance stands in for it.
      { source: "/plans", destination: "/plans/5k", permanent: false },
      { source: "/social", destination: "/download?via=social", permanent: true },
      { source: "/downloads", destination: "/download?via=downloads", permanent: true },
    ];
  },
  async rewrites() {
    return {
      // /download stays the old link-in-bio page (download.html), as it was:
      // its own look, fonts and PostHog script (public/legacy, public/js,
      // public/brand-acid, public/assets/pacr-avatar.png, copied unchanged).
      beforeFiles: [{ source: "/download", destination: "/legacy/download.html" }],
      afterFiles: [],
      fallback: [{ source: "/:path*", destination: "https://pacr.life/:path*" }],
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
    ];
  },
};

export default nextConfig;
