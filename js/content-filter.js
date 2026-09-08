// ─────────────────────────────────────────────────────────────────────────────
// Content filter — client mirror (web)
//
// Ported from pacr/src/utils/moderation.ts. The authority is the Postgres
// trigger (enforce_content_filter, migration 20260826140000): a patched client
// walks past this file, not past the trigger. This copy exists so the composer
// can refuse in the same frame the runner presses POST, instead of
// round-tripping to a 400.
//
// KEEP IN SYNC: BLOCKED_TERMS must stay identical to the array in the app's
// copy and in public.contains_blocked_terms. Same arrangement, and the same
// reason, as MENTION_RE in ./mentions.js.
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKED_TERMS = [
  'nigger', 'nigga', 'chink', 'gook', 'spic', 'wetback', 'kike',
  'beaner', 'paki', 'towelhead', 'coon',
  'faggot', 'tranny', 'shemale',
  'retard', 'retarded',
  'cunt', 'whore', 'slut',
  'blowjob', 'handjob', 'cumshot', 'deepthroat', 'gangbang', 'creampie',
  'rape', 'rapist', 'molest', 'porn', 'milf',
];

// JS has no \m/\M, so \b stands in. It behaves the same for these terms —
// they are all pure [a-z], so a boundary either side is exactly Postgres's
// "start/end of a word" — and \b is what makes "raccoon" and "grape" safe.
const BLOCKED_RE = new RegExp(`\\b(${BLOCKED_TERMS.join('|')})\\b`, 'i');

/** The first blocked term in `text`, or null when it is clean. */
export function findBlockedTerm(text) {
  if (!text) return null;
  const m = BLOCKED_RE.exec(text);
  return m ? m[0] : null;
}

/** What to show when either this mirror or the trigger rejects a body. */
export const BLOCKED_CONTENT_MESSAGE =
  "That word isn't welcome here. Edit it out and post again.";

/**
 * True when a failed insert was the server-side filter rather than anything
 * else. The trigger raises P0001 'blocked_content', which PostgREST returns
 * as a 400 carrying that message.
 */
export function isBlockedContentError(message) {
  return !!message && String(message).includes('blocked_content');
}
