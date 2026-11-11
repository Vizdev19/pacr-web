// The same project and publishable key as the rest of pacr.life
// (js/config.js, apps/host). Both are public by design: what anyone can read
// is decided by RLS and the anon RPCs, never by this app.
// NEXT_PUBLIC_SUPABASE_URL is only for pointing a local build at a test server.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zrnoioagjnmetnzwneks.supabase.co";
export const SUPABASE_KEY = "sb_publishable_Bx3sahSCZxbK3lvnWcOu4Q_aD__9yqZ";

/**
 * The feed is app-only for now (user decision, 2026-11-11). The web feed
 * (/feed, /feed/<ref>, components/pages/feed) stays in the code but is hidden:
 * no nav entry, /feed redirects to Your squads, /feed/<ref> to the public
 * post page /p/<ref>, and post links everywhere go to /p/<ref>. Set this to
 * true to bring it back.
 */
export const FEED_ON_WEB: boolean = false;

export const APP_STORE_URL = "https://apps.apple.com/in/app/pacr-run-training-splits/id6804190286";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=life.pacr.app";
export const INSTAGRAM_URL = "https://www.instagram.com/pacr.running/";
export const LINKEDIN_URL = "https://www.linkedin.com/company/pacr-life/posts/";
export const YOUTUBE_URL = "https://www.youtube.com/@pacr_life";
export const X_URL = "https://x.com/pacr_run";

/** pacr's accounts, in the order every footer and page lists them. */
export const SOCIALS = [
  { id: "instagram", label: "Instagram", handle: "@pacr.running", url: INSTAGRAM_URL },
  { id: "youtube", label: "YouTube", handle: "@pacr_life", url: YOUTUBE_URL },
  { id: "x", label: "X", handle: "@pacr_run", url: X_URL },
  { id: "linkedin", label: "LinkedIn", handle: "Pacr Life", url: LINKEDIN_URL },
] as const;

export const DEFAULT_CITY = "bengaluru";
export const CITY_COOKIE = "pacr_city";
