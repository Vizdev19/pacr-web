// ─────────────────────────────────────────────────────────────────────────────
// /host — the data layer of the event host dashboard.
//
// Every call is one of the app's RPCs (pacr: supabase/migrations/
// 20261130120000_events.sql), made with the signed-in host's own session, so
// RLS and the RPCs' own checks decide what they may do — the page never
// decides that itself. Server refusals come back as short codes
// ('organizer_not_approved', 'below_sold' …) and are turned into sentences
// here, the way the app's eventFailCopy does.
//
// Pictures (the 2:3 poster and the course map) go to the private
// `event-covers` bucket at "<event id>/<random>.jpg"; the bucket's policy only
// lets an event's managers write there.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase, signedUrlsFor } from '../supabase.js';

export const EVENT_BUCKET = 'event-covers';

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
  not_allowed: 'You can’t do that for this event.',
  email_required: 'Your account needs an email address first — add one in the app’s Profile.',
  organizer_not_approved: 'Your request to host hasn’t been approved yet.',
  already_applied: 'You’ve already asked to host. We’ll let you know.',
  cooldown: 'You can ask again 24 hours after the last answer.',
  name_required: 'Give your organisation a name.',
  name_locked: 'Your name was approved as it is. Write to support@pacr.life to change it.',
  invalid_instagram: 'That Instagram handle doesn’t look right.',
  title_required: 'Give the event a title.',
  too_long: 'Something is too long — check the title, description and notes.',
  invalid_kind: 'Pick what kind of event this is.',
  invalid_time: 'Check the times: the start must be in the future and the end after it (at most 14 days later).',
  place_required: 'Choose where it happens.',
  invalid_place: 'That place has no map position. Pick it again from the search.',
  invalid_visibility: 'Squad-only events need a squad host.',
  invalid_capacity: 'Capacity is a number from 1 to 100,000, or empty for no limit.',
  invalid_content: 'One of the event-day, course, FAQ or included entries is missing a label or is too long.',
  invalid_distances: 'Distances are in km, up to six of them, each between 0.1 and 250.',
  invalid_cover: 'That picture didn’t upload properly. Try it again.',
  host_limit: 'This host already has 20 upcoming events. Finish or cancel some first.',
  below_sold: 'More people already have tickets than that capacity allows.',
  incomplete: 'Add a place from the search before publishing.',
  already_published: 'It’s already published.',
  not_draft: 'Only a draft nobody has a ticket for can be deleted.',
  already_cancelled: 'It was already cancelled.',
  not_published: 'It isn’t published.',
  event_over: 'This event is over.',
  event_closed: 'A cancelled or finished event can’t be edited.',
  blocked_content: 'Some of the wording isn’t allowed on PACR. Please rephrase it.',
  not_found: 'That event doesn’t exist, or isn’t yours to manage.',
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

// ── Reads ───────────────────────────────────────────────────────────────────

export const myHosting = () => rpc('my_hosting');
export const myHostedEvents = (includePast = true) => rpc('my_hosted_events', { p_include_past: includePast });
export const getEventForEdit = (id) => rpc('get_event_for_edit', { p_event_id: id });
export const listAttendees = (id) => rpc('list_event_attendees', { p_event_id: id });

/** Signed URLs for pictures in the events bucket: path → url. */
export async function imageUrls(paths) {
  return signedUrlsFor(await sb(), EVENT_BUCKET, paths.filter(Boolean));
}

/** Signed URLs for squad pictures and runner avatars. */
export async function avatarUrls(bucket, paths) {
  return signedUrlsFor(await sb(), bucket, paths.filter(Boolean));
}

// ── Writes ──────────────────────────────────────────────────────────────────

export const applyOrganizer = (f) =>
  rpc('apply_organizer', { p_name: f.name, p_bio: f.bio || null, p_instagram: f.instagram || null, p_note: f.note || null });
export const updateOrganizer = (patch) => rpc('update_organizer', { p_patch: patch });

export function createEvent(f) {
  return rpc('create_event', {
    p_host_kind: f.hostKind,
    p_host_id: f.hostId,
    p_kind: f.kind,
    p_title: f.title,
    p_description: f.description || null,
    p_starts_at: f.startsAt,
    p_ends_at: f.endsAt || null,
    p_timezone: f.timezone || null,
    p_place: f.place ?? {},
    p_meet_note: f.meetNote || null,
    p_visibility: f.visibility,
    p_women_only: !!f.womenOnly,
    p_capacity: f.capacity ?? null,
    p_refund_note: f.refundNote || null,
  });
}

export const updateEvent = (id, patch) => rpc('update_event', { p_event_id: id, p_patch: patch });
export const publishEvent = (id) => rpc('publish_event', { p_event_id: id });
export const deleteDraft = (id) => rpc('delete_draft_event', { p_event_id: id });
export const cancelEvent = (id, reason) => rpc('cancel_event', { p_event_id: id, p_reason: reason || null });

// ── Pictures ────────────────────────────────────────────────────────────────

function randomName() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Upload a JPEG into the event's folder. { ok, path } | { ok: false, text } */
export async function uploadImage(eventId, blob) {
  const c = await sb();
  if (!c) return { ok: false, text: failText('error') };
  const path = `${eventId}/${randomName()}.jpg`;
  const { error } = await c.storage.from(EVENT_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg', cacheControl: '31536000', upsert: false,
  });
  if (error) {
    console.warn('[pacr] event image upload', error.message);
    return { ok: false, text: 'The picture didn’t upload. Check your connection and try again.' };
  }
  return { ok: true, path };
}

/** Best-effort: a replaced picture's old object. */
export async function removeImages(paths) {
  const list = paths.filter(Boolean);
  if (!list.length) return;
  const c = await sb();
  try { await c?.storage.from(EVENT_BUCKET).remove(list); } catch {}
}

// ── Places (the app's `places` function: Google Places, key server-side) ──

/** A Places session token: autocomplete calls ending in one details call bill as one. */
export function newPlacesSession() {
  return randomName();
}

async function places(body) {
  const c = await sb();
  if (!c) return { ok: false, text: 'Place search is unavailable right now.' };
  try {
    const { data, error } = await c.functions.invoke('places', { body });
    if (error) {
      const status = error.context?.status;
      return {
        ok: false,
        text: status === 429 ? 'You’ve searched a lot today — try again tomorrow.'
          : status === 403 ? failText('email_required')
          : 'Place search isn’t working right now. Try again in a moment.',
      };
    }
    return { ok: true, value: data };
  } catch {
    return { ok: false, text: 'Place search isn’t working right now. Try again in a moment.' };
  }
}

export async function searchPlaces(input, session, near) {
  const r = await places({ action: 'autocomplete', input, sessionToken: session, near: near ?? undefined });
  return r.ok ? { ok: true, value: r.value?.suggestions ?? [] } : r;
}

export async function placeDetails(placeId, session) {
  const r = await places({ action: 'details', placeId, sessionToken: session });
  return r.ok && r.value?.place ? { ok: true, value: r.value.place } : (r.ok ? { ok: false, text: 'Couldn’t read that place.' } : r);
}
