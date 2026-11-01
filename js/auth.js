// ─────────────────────────────────────────────────────────────────────────────
// Shared sign-in for pacr.life
//
// Used by /signin and mounted into the header of every page. The methods are
// the app's own, and only those: the 6-digit email code (verified with type
// 'email') and Continue with Google / Apple (pacr/src/services/socialAuth.ts).
// A method the app lacks would mint auth.users rows the app can't sign in to.
//
// The website recognises an account the app made; it must never make one.
// Email gets that from shouldCreateUser: false. Google and Apple can't — an
// OAuth sign-in creates the auth user on the way back — so
// finishProviderSignIn() checks for the profile the app writes at sign-up and,
// when there is none, signs straight back out and says accounts are made in
// the app. The auth row it leaves holds no data, and the app adopts it if that
// person later signs up there with the same Google or Apple account.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase } from './supabase.js';

/** Double-tap guard. The real ceiling is the server's per-hour email limit,
 *  which surfaces as a 429 and is reported as such — this only stops a runner
 *  burning one of those on an impatient second click. */
export const RESEND_COOLDOWN_SEC = 30;

// ── Redirect targets ────────────────────────────────────────────────────────

/**
 * Sanitise a `?next=` value into a same-origin path, or null.
 *
 * Anything else is an open redirect: "//evil.com" is protocol-relative and
 * "https://evil.com" is absolute, and both would otherwise send a runner who
 * just signed in straight off the site. Only a single-slash path survives.
 */
export function safeNext(raw) {
  if (typeof raw !== 'string' || raw === '') return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  try {
    // Resolve against our own origin and confirm it stayed there.
    const u = new URL(raw, location.origin);
    if (u.origin !== location.origin) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

/** The path to come back to after signing in. */
export function nextFromQuery() {
  return safeNext(new URLSearchParams(location.search).get('next'));
}

/**
 * Is this path the sign-in page? Vercel's cleanUrls serves it at both /signin
 * and /signin.html, and a `next` pointing back at either is pointless — it
 * would bounce a signed-in visitor from sign-in to sign-in.
 */
export function isSigninPath(path) {
  const p = String(path ?? '').split('?')[0].split('#')[0];
  return p === '/signin' || p === '/signin.html';
}

/** Build a /signin link that returns here afterwards. */
export function signinHref(next) {
  const target = safeNext(next ?? (location.pathname + location.search));
  return target && !isSigninPath(target)
    ? `/signin?next=${encodeURIComponent(target)}`
    : '/signin';
}

// ── Session ─────────────────────────────────────────────────────────────────

export async function currentUser() {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data?.session?.user ?? null;
}

export async function signOut() {
  const sb = await getSupabase();
  if (sb) await sb.auth.signOut();
}

// ── Error copy ──────────────────────────────────────────────────────────────
// Classification ported from pacr/src/services/supabase.ts so the page reads
// like a sentence rather than echoing a Supabase error string.

export function sendErrorText(m) {
  const s = (m ?? '').toLowerCase();
  if (s.includes('rate') || s.includes('too many')) {
    return 'Too many codes requested. Wait a few minutes, then try again.';
  }
  if (s.includes('signups not allowed') || s.includes('not found')) {
    return 'No PACR account uses that email. Accounts are made in the app.';
  }
  if (s.includes('invalid') && s.includes('email')) return 'That email address looks wrong.';
  return "Couldn't send the code. Try again in a moment.";
}

export function verifyErrorText(m) {
  const s = (m ?? '').toLowerCase();
  if (s.includes('rate') || s.includes('too many')) {
    return 'Too many attempts. Wait a few minutes, then try again.';
  }
  if (s.includes('expired') || s.includes('invalid') || s.includes('token')) {
    return 'That code is wrong or has expired.';
  }
  return "Couldn't sign you in. Try again in a moment.";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── The flow ────────────────────────────────────────────────────────────────

export async function sendCode(email) {
  const sb = await getSupabase();
  if (!sb) return { ok: false, text: 'Sign-in is unavailable right now.' };
  const { error } = await sb.auth.signInWithOtp({
    email, options: { shouldCreateUser: false },
  });
  return error ? { ok: false, text: sendErrorText(error.message) } : { ok: true };
}

export async function verifyCode(email, token) {
  const sb = await getSupabase();
  if (!sb) return { ok: false, text: 'Sign-in is unavailable right now.' };
  const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data?.user) {
    return { ok: false, text: verifyErrorText(error?.message) };
  }
  return { ok: true, user: data.user };
}

// ── Google / Apple ──────────────────────────────────────────────────────────

export const PROVIDER_NAMES = { google: 'Google', apple: 'Apple' };

/**
 * Leave for Google's or Apple's sign-in page. Supabase brings the browser back
 * to this same page (it serves at /signin and /signin.html) with ?code=, and
 * the `next` rides along so the return lands where sign-in was asked for.
 * Resolves only on failure — on success the page is already navigating away.
 */
export async function startProviderSignIn(provider, next) {
  const sb = await getSupabase();
  if (!sb) return { ok: false, text: 'Sign-in is unavailable right now.' };
  const back = new URL(location.pathname, location.origin);
  if (next && !isSigninPath(next)) back.searchParams.set('next', next);
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: back.toString() },
  });
  return error
    ? { ok: false, text: `Couldn't reach ${PROVIDER_NAMES[provider]}. Try again in a moment.` }
    : { ok: true };
}

/**
 * The return trip from Google or Apple. Null when this page load isn't one;
 * otherwise { ok } once the code is exchanged and the account is confirmed as
 * one the app made, or { ok: false, text } to show on the form.
 *
 * The query is cleaned either way (keeping `next`), so a reload or a Back
 * doesn't replay a spent code.
 */
export async function finishProviderSignIn() {
  const q = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.slice(1));
  const code = q.get('code');
  const err = q.get('error') ?? hash.get('error');
  if (!code && !err) return null;

  const clean = new URL(location.pathname, location.origin);
  const next = q.get('next');
  if (next) clean.searchParams.set('next', next);
  history.replaceState(null, '', clean.pathname + clean.search);

  // Closing Google's window or Apple's sheet comes back as access_denied:
  // nothing went wrong, so nothing is said.
  if (err) {
    return err === 'access_denied'
      ? { ok: false, text: '' }
      : { ok: false, text: "Couldn't sign you in. Try again, or use your email." };
  }

  const sb = await getSupabase();
  if (!sb) return { ok: false, text: 'Sign-in is unavailable right now.' };
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  const user = data?.session?.user;
  if (error || !user) {
    return { ok: false, text: "Couldn't sign you in. Try again, or use your email." };
  }

  // The app writes public.users when an account finishes sign-up. No row means
  // this Google/Apple account isn't one the app knows. A failed lookup is not
  // that answer — RLS still guards every page, so let them in.
  const { data: profile, error: lookupError } = await sb.from('users')
    .select('id').eq('id', user.id).maybeSingle();
  if (!lookupError && !profile) {
    const provider = PROVIDER_NAMES[user.app_metadata?.provider] ?? 'that';
    await sb.auth.signOut();
    return {
      ok: false,
      text: `No PACR account uses that ${provider} account. Accounts are made in the app — ` +
        `sign up there, then sign in here. If you signed up with your email, use it below.`,
    };
  }
  return { ok: true, user };
}

// ── Header control ──────────────────────────────────────────────────────────

/**
 * Upgrade the header's Sign in link into a session-aware control.
 *
 * `host` already contains a plain "Sign in" link in the HTML — that is the
 * baseline, and it is what a visitor sees with JS off, with the CDN blocked, or
 * before the anon key is configured. Signing in needs no Supabase client to
 * REACH (it is a link to /signin); only telling signed-in from signed-out does.
 * So this function never empties the slot: it swaps in "Sign out" once a
 * session is known, and otherwise leaves the baseline exactly where it is.
 *
 * Subscribing to onAuthStateChange is what makes a token-refresh failure or a
 * sign-out in another tab reach this tab, instead of leaving stale UI until the
 * next reload.
 */
export async function mountHeaderAuth(host, opts = {}) {
  if (!host) return;

  const cls = opts.className ?? '';
  const signedInHtml = `<button type="button" class="${cls}" data-auth="out">Sign out</button>`;
  // Re-render the baseline rather than trusting whatever is in the DOM now,
  // so signing out restores a correct `next` for the current page.
  const signedOutHtml = () =>
    `<a class="${cls}" data-auth="in" href="${signinHref()}">Sign in</a>`;

  // Delegated, so it survives the innerHTML swaps below.
  host.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-auth="out"]');
    if (!btn) return;
    btn.disabled = true;
    await signOut();
    if (opts.signOutTo) location.href = opts.signOutTo;
    else location.reload();
  });

  const sb = await getSupabase();
  // Unconfigured or unreachable: keep the static Sign in link. /signin explains
  // itself if it genuinely cannot sign anyone in.
  if (!sb) return;

  const paint = (user) => { host.innerHTML = user ? signedInHtml : signedOutHtml(); };

  const { data } = await sb.auth.getSession();
  paint(data?.session?.user ?? null);

  sb.auth.onAuthStateChange((event, session) => {
    paint(session?.user ?? null);
    if (event === 'SIGNED_OUT' && opts.signOutTo) location.href = opts.signOutTo;
  });
}
