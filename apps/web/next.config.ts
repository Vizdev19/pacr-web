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
  async rewrites() {
    return { beforeFiles: [], afterFiles: [], fallback: [{ source: "/:path*", destination: "https://pacr.life/:path*" }] };
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
