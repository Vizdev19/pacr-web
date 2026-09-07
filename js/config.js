// ─────────────────────────────────────────────────────────────────────────────
// Backend configuration
//
// pacr.life reads from the SAME Supabase project as the mobile app. There is no
// separate web project any more — the old one (ehkdmvkxdvbybdggpnkc) only ever
// held two signup tables for forms this site no longer has, and was retired.
//
// The anon key is hardcoded in a browser file ON PURPOSE. It is a publishable
// key: it already ships inside every copy of the app binary, it grants nothing
// on its own, and RLS is what actually protects the data. Everything this site
// can reach through it is meant to be public (the club directory, the route
// directory) or is gated behind a real sign-in (the feed). A service-role key
// must NEVER appear in this directory.
// ─────────────────────────────────────────────────────────────────────────────

export const SUPABASE_URL = 'https://zrnoioagjnmetnzwneks.supabase.co';

// The app project's anon/public key, verified as role "anon" (never
// service_role). It lives in the repo rather than an environment variable on
// purpose: this site has no build step, so nothing would ever substitute a
// placeholder in a file Vercel copies and serves byte-for-byte. A Vercel env
// var reaches a framework's build or a serverless function, and this site is
// neither.
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpybm9pb2Fnam5tZXRuenduZWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjIwNDgsImV4cCI6MjA5NTg5ODA0OH0.D-2Lvvs2lxVG7fGWGcFBBGpBOSrHSw-DT6m_D0o9g3U';

export const isConfigured = () =>
  typeof SUPABASE_ANON_KEY === 'string'
  && SUPABASE_ANON_KEY.startsWith('ey');
