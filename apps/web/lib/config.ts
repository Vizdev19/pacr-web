// The same project and publishable key as the rest of pacr.life
// (js/config.js, apps/host). Both are public by design: what anyone can read
// is decided by RLS and the anon RPCs, never by this app.
// NEXT_PUBLIC_SUPABASE_URL is only for pointing a local build at a test server.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zrnoioagjnmetnzwneks.supabase.co";
export const SUPABASE_KEY = "sb_publishable_Bx3sahSCZxbK3lvnWcOu4Q_aD__9yqZ";

export const APP_STORE_URL = "https://apps.apple.com/in/app/pacr-run-training-splits/id6804190286";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=life.pacr.app";
export const INSTAGRAM_URL = "https://www.instagram.com/pacr.running/";

export const DEFAULT_CITY = "bengaluru";
export const CITY_COOKIE = "pacr_city";
