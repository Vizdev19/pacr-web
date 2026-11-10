import type { NextConfig } from "next";

// pacr.life/host, the dashboard for squad owners and event hosts.
//
// This app is its own Vercel project (pacr-host). pacr.life's vercel.json
// rewrites the paths it owns to it, so in the browser it is the same origin as
// the rest of the site: the session pacr.life/signin stores in localStorage is
// the one this app reads (lib/supabase.ts). basePath keeps every route and the
// /host/_next assets under /host, which is what the rewrites forward.
const nextConfig: NextConfig = {
  basePath: "/host",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
