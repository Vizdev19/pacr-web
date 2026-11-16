// ─────────────────────────────────────────────────────────────────────────────
// /host/apply — the data layer of the request to host (main.js).
//
// Calls are the app's RPCs with the signed-in runner's own session. Server
// refusals come back as short codes and are turned into sentences here.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase } from '../supabase.js';

let sbp = null;
const sb = () => (sbp ??= getSupabase());

/** The signed-in user, or null. */
export async function sessionUser() {
  const c = await sb();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data?.session?.user ?? null;
}

// ── Failure copy ────────────────────────────────────────────────────────────

const COPY = {
  not_allowed: 'You can’t do that.',
  email_required: 'Your account needs an email address first — add one in the app’s Profile.',
  already_applied: 'You’ve already asked to host. We’ll let you know.',
  cooldown: 'You can ask again 24 hours after the last answer.',
  name_required: 'Give your organisation a name.',
  too_long: 'The name is up to 60 characters; About you and the note up to 300.',
  invalid_instagram: 'That Instagram handle doesn’t look right.',
  blocked_content: 'Some of the wording isn’t allowed on PACR. Please rephrase it.',
};

/** A sentence for a refusal (or a generic one). */
export function failText(code) {
  return COPY[code] ?? 'Something went wrong. Check your connection and try again.';
}

function codeOf(message) {
  const m = String(message ?? '');
  return Object.keys(COPY).find(k => m.includes(k)) ?? 'error';
}

/** { ok: true, value } | { ok: false, code, text } */
async function rpc(fn, args = {}) {
  const c = await sb();
  if (!c) return { ok: false, code: 'error', text: failText('error') };
  try {
    const { data, error } = await c.rpc(fn, args);
    if (error) {
      const code = codeOf(error.message);
      if (code === 'error') console.warn(`[pacr] ${fn}`, error.message);
      return { ok: false, code, text: failText(code) };
    }
    return { ok: true, value: data };
  } catch (e) {
    console.warn(`[pacr] ${fn}`, e);
    return { ok: false, code: 'error', text: failText('error') };
  }
}

// ── Hosting ─────────────────────────────────────────────────────────────────

export const myHosting = () => rpc('my_hosting');
export const applyOrganizer = (f) =>
  rpc('apply_organizer', { p_name: f.name, p_bio: f.bio || null, p_instagram: f.instagram || null, p_note: f.note || null });
