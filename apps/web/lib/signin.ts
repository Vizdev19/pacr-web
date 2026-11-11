// /signin's flows, ported from pacr.life's js/auth.js so the page signs in
// exactly as the static site did, into the same session (getSupabase():
// storageKey "pacr.web.auth", flowType "pkce", detectSessionInUrl false).
//
// The methods are the app's own, and only those: the 6-digit email code
// (verified with type "email") and Continue with Apple / Google. The website
// recognises an account the app made; it must never make one. Email gets that
// from shouldCreateUser: false. Apple and Google can't (an OAuth sign-in
// creates the auth user on the way back), so finishProviderSignIn() checks
// for the profile the app writes at sign-up and, when there is none, signs
// straight back out and says accounts are made in the app.
//
// Browser only: every function here reads window.location or the session.
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

/** Double-tap guard on "Resend code"; the server's own email limit surfaces as a 429. */
export const RESEND_COOLDOWN_SEC = 30;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Provider = "apple" | "google";
export const PROVIDER_NAMES: Record<string, string> = { google: "Google", apple: "Apple" };

export type Result = { ok: true; user?: User } | { ok: false; text: string };

// ── Redirect targets ────────────────────────────────────────────────────────

/**
 * A `?next=` value as a same-site path, or null. "//evil.com" and
 * "https://evil.com" would send a runner who just signed in off the site, so
 * only a single-slash path that resolves to this origin survives.
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw === "" || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  try {
    const u = new URL(raw, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

/** The path to come back to after signing in. */
export function nextFromQuery(): string | null {
  return safeNext(new URLSearchParams(window.location.search).get("next"));
}

/** A `next` pointing back at sign-in would bounce a signed-in visitor between the two. */
export function isSigninPath(path: string | null | undefined): boolean {
  const p = String(path ?? "").split("?")[0].split("#")[0];
  return p === "/signin" || p === "/signin.html";
}

// ── Session ─────────────────────────────────────────────────────────────────

export async function currentUser(): Promise<User | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user ?? null;
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

// ── Error copy (classification from the app's services/supabase.ts) ─────────

export function sendErrorText(m?: string | null): string {
  const s = (m ?? "").toLowerCase();
  if (s.includes("rate") || s.includes("too many")) return "Too many codes requested. Wait a few minutes, then try again.";
  if (s.includes("signups not allowed") || s.includes("not found")) return "No pacr account uses that email. Accounts are made in the app.";
  if (s.includes("invalid") && s.includes("email")) return "That email address looks wrong.";
  return "Couldn't send the code. Try again in a moment.";
}

export function verifyErrorText(m?: string | null): string {
  const s = (m ?? "").toLowerCase();
  if (s.includes("rate") || s.includes("too many")) return "Too many attempts. Wait a few minutes, then try again.";
  if (s.includes("expired") || s.includes("invalid") || s.includes("token")) return "That code is wrong or has expired.";
  return "Couldn't sign you in. Try again in a moment.";
}

// ── Email and code ──────────────────────────────────────────────────────────

export async function sendCode(email: string): Promise<Result> {
  const { error } = await getSupabase().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  return error ? { ok: false, text: sendErrorText(error.message) } : { ok: true };
}

export async function verifyCode(email: string, token: string): Promise<Result> {
  const { data, error } = await getSupabase().auth.verifyOtp({ email, token, type: "email" });
  if (error || !data?.user) return { ok: false, text: verifyErrorText(error?.message) };
  return { ok: true, user: data.user };
}

// ── Apple and Google ────────────────────────────────────────────────────────

/**
 * Leave for Apple's or Google's sign-in page. Supabase brings the browser back
 * to this same path (/signin) with ?code=, and `next` rides along so the
 * return lands where sign-in was asked for. Resolves only on failure; on
 * success the page is already navigating away.
 */
export async function startProviderSignIn(provider: Provider, next: string | null): Promise<Result> {
  const back = new URL(window.location.pathname, window.location.origin);
  if (next && !isSigninPath(next)) back.searchParams.set("next", next);
  const { error } = await getSupabase().auth.signInWithOAuth({ provider, options: { redirectTo: back.toString() } });
  return error ? { ok: false, text: `Couldn't reach ${PROVIDER_NAMES[provider]}. Try again in a moment.` } : { ok: true };
}

/**
 * The return trip from Apple or Google. Null when this page load isn't one;
 * otherwise { ok } once the PKCE code is exchanged and the account is one the
 * app made, or { ok: false, text } to show on the form ("" for a cancel).
 * The query is cleaned either way (keeping `next`), so a reload or Back
 * doesn't replay a spent code.
 */
let finishing: Promise<Result | null> | null = null;
export function finishProviderSignIn(): Promise<Result | null> {
  // The code is single-use and the query is cleaned on the first call, so a
  // caller that arrives while it's in flight (React's dev double effect)
  // shares that answer instead of finding a clean URL and showing the form.
  if (!finishing) finishing = finish().finally(() => { setTimeout(() => { finishing = null; }, 0); });
  return finishing;
}

async function finish(): Promise<Result | null> {
  const q = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const code = q.get("code");
  const err = q.get("error") ?? hash.get("error");
  if (!code && !err) return null;

  const clean = new URL(window.location.pathname, window.location.origin);
  const next = q.get("next");
  if (next) clean.searchParams.set("next", next);
  window.history.replaceState(null, "", clean.pathname + clean.search);

  // Closing Google's window or Apple's sheet comes back as access_denied: nothing to say.
  if (err) return { ok: false, text: err === "access_denied" ? "" : "Couldn't sign you in. Try again, or use your email." };

  const sb = getSupabase();
  const { data, error } = await sb.auth.exchangeCodeForSession(code as string);
  const user = data?.session?.user;
  if (error || !user) return { ok: false, text: "Couldn't sign you in. Try again, or use your email." };

  // The app writes public.users when an account finishes sign-up. No row means
  // this Apple/Google account isn't one the app knows. A failed lookup is not
  // that answer (RLS still guards every page), so let them in.
  const { data: profile, error: lookupError } = await sb.from("users").select("id").eq("id", user.id).maybeSingle();
  if (!lookupError && !profile) {
    const provider = PROVIDER_NAMES[String(user.app_metadata?.provider)] ?? "that";
    await sb.auth.signOut();
    return {
      ok: false,
      text: `No pacr account uses that ${provider} account. Accounts are made in the app: sign up there, then sign in here. If you signed up with your email, use it below.`,
    };
  }
  return { ok: true, user };
}
