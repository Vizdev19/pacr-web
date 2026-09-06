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

// TODO: paste the app project's anon/public key here.
//   Supabase dashboard → Project Settings → API Keys → anon public
// Until this is filled in, every enhancement on the site quietly no-ops and
// visitors see the static fallback content. Nothing breaks.
export const SUPABASE_ANON_KEY = 'REPLACE_WITH_ANON_KEY';

export const isConfigured = () =>
  typeof SUPABASE_ANON_KEY === 'string'
  && SUPABASE_ANON_KEY.startsWith('ey');
