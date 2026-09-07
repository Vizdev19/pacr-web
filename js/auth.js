// ─────────────────────────────────────────────────────────────────────────────
// Shared sign-in for pacr.life
//
// One email-OTP flow, used by /signin and mounted into the header of every
// page. Deliberately the SAME method the app uses (6-digit code, verified with
// type 'email') and nothing else: the app treats email OTP as the sole identity
// path and has anonymous sign-ins disabled, so a second method here would mint
// auth.users rows the app has no way to sign in to. See pacr/src/services/
// supabase.ts for the flow this mirrors.
//
// shouldCreateUser is false everywhere. The website recognises an identity the
// app already made; it must never create one.
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

// ── Header control ──────────────────────────────────────────────────────────

/**
 * Mount the session-aware Sign in / Sign out control.
 *
 * `host` is an empty element already in the page, so the header's layout is
 * settled before this runs and nothing shifts when the session resolves. The
 * control stays empty (not "Sign in") until we actually know — showing "Sign
 * in" to someone who is signed in, for a beat, is worse than showing nothing.
 *
 * Subscribing to onAuthStateChange is what makes a token-refresh failure or a
 * sign-out in another tab reach this tab, instead of leaving stale UI until
 * the next reload.
 */
export async function mountHeaderAuth(host, opts = {}) {
  if (!host) return;
  const sb = await getSupabase();
  if (!sb) return;

  const cls = opts.className ?? '';
  const paint = (user) => {
    if (user) {
      host.innerHTML = `<button type="button" class="${cls}" data-auth="out">Sign out</button>`;
    } else {
      host.innerHTML = `<a class="${cls}" data-auth="in" href="${signinHref()}">Sign in</a>`;
    }
  };

  paint(await currentUser());

  host.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-auth="out"]');
    if (!btn) return;
    btn.disabled = true;
    await signOut();
    // Land somewhere that makes sense signed out. A page that requires a
    // session sends you home; everywhere else just re-renders in place.
    if (opts.signOutTo) location.href = opts.signOutTo;
    else location.reload();
  });

  sb.auth.onAuthStateChange((event, session) => {
    paint(session?.user ?? null);
    // A session that goes away while a gated page is open must not leave that
    // page's contents on screen.
    if (event === 'SIGNED_OUT' && opts.signOutTo) location.href = opts.signOutTo;
  });
}
