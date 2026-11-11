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

// The app project's publishable key (sb_publishable_…, Supabase's replacement
// for the legacy anon key: signed-out visitors get the "anon" role and nothing
// more). Never a secret or service_role key. It lives in the repo rather than
// an environment variable on
// purpose: this site has no build step, so nothing would ever substitute a
// placeholder in a file Vercel copies and serves byte-for-byte. A Vercel env
// var reaches a framework's build or a serverless function, and this site is
// neither.
export const SUPABASE_ANON_KEY =
  'sb_publishable_Bx3sahSCZxbK3lvnWcOu4Q_aD__9yqZ';

// A publishable key, or (until the legacy keys are switched off) the old anon
// token. A secret key must never be here, so it doesn't count as configured.
export const isConfigured = () =>
  typeof SUPABASE_ANON_KEY === 'string'
  && (SUPABASE_ANON_KEY.startsWith('sb_publishable_') || SUPABASE_ANON_KEY.startsWith('ey'));
