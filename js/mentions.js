// ─────────────────────────────────────────────────────────────────────────────
// Mention tokens — web port of pacr/src/utils/mentions.ts
//
// Mentions live inline in post/comment bodies as "@[Display Name](uuid)" —
// there is no mentions table. The squad-feed-notify Edge Function parses the
// SAME format server-side to fan out "you were tagged" pushes and validates the
// ids against circle membership there, so anything this file writes has to be
// byte-compatible with it.
//
// The central rule, and the one that is easy to get wrong: a composer holds
// PLAIN "@Display Name" text. A user must never see a raw "@[Name](uuid)"
// token, let alone the uuid. serializeMentions() turns names into tokens at
// submit time, and that is the only place tokens are created.
//
// KEEP IN SYNC: MENTION_RE below must stay literally identical to the copies in
// pacr/src/utils/mentions.ts and supabase/functions/squad-feed-notify/index.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { esc } from './supabase.js';

/** Hard cap on mentions per body — bounds push fanout and render work. */
export const MAX_MENTIONS_PER_BODY = 10;

// Display names are 1–32 chars (users.display_name check) and can't contain
// "]" per mentionToken's sanitization; the uuid group is strict v4-shaped.
const MENTION_RE =
  /@\[([^\]\n]{1,32})\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/g;

// Display-only safety net: anything token-SHAPED that the strict regex above
// rejected (a truncated id, a body written by some older/other client) is still
// rendered as a plain "@Name". A user id must never reach the screen, even when
// the token is malformed enough that we can't link it.
const LOOSE_TOKEN_RE = /@\[([^\]\n]{1,64})\]\(([^)\s]{0,80})\)/g;

/** Append a text run, scrubbing any token-shaped leftovers down to "@Name". */
function pushText(segments, text) {
  LOOSE_TOKEN_RE.lastIndex = 0;
  segments.push({ type: 'text', text: text.replace(LOOSE_TOKEN_RE, '@$1') });
}

/**
 * Split a body into renderable segments. Text between/around tokens comes back
 * verbatim; malformed tokens stay plain text. Never throws.
 */
export function parseMentionSegments(body) {
  const segments = [];
  if (!body) return segments;

  let last = 0;
  let count = 0;
  MENTION_RE.lastIndex = 0;
  let m;
  while ((m = MENTION_RE.exec(body)) !== null && count < MAX_MENTIONS_PER_BODY) {
    if (m.index > last) pushText(segments, body.slice(last, m.index));
    segments.push({ type: 'mention', text: m[1], userId: m[2] });
    last = m.index + m[0].length;
    count++;
  }
  if (last < body.length) pushText(segments, body.slice(last));
  return segments;
}

/**
 * Render a stored body as safe HTML with mentions highlighted.
 *
 * Built on the segment parser rather than a bare regex replace so it inherits
 * the cap and the malformed-token scrub. Every segment is escaped before it
 * reaches the string, so nothing in a body can introduce a tag.
 */
export function renderBody(body) {
  return parseMentionSegments(body)
    .map(seg => (seg.type === 'mention'
      ? `<span class="mention">@${esc(seg.text)}</span>`
      : esc(seg.text)))
    .join('');
}

/** Distinct mentioned user ids, capped at MAX_MENTIONS_PER_BODY. */
export function extractMentionIds(body) {
  const ids = new Set();
  for (const seg of parseMentionSegments(body)) {
    if (seg.type === 'mention' && seg.userId) ids.add(seg.userId);
  }
  return [...ids];
}

/**
 * Build the token for one member. Names are sanitized so they can't break the
 * token syntax (no "]" / newlines; length-capped to the DB limit).
 */
export function mentionToken(displayName, userId) {
  const safe = String(displayName ?? '').replace(/[\]\n]/g, '').slice(0, 32).trim() || 'runner';
  return `@[${safe}](${userId})`;
}

/**
 * Replace the "@query" being typed at `caretIndex` with the member's plain
 * "@Display Name". Returns the new text and the caret position just after what
 * was inserted. If no word-start "@" precedes the caret, inserts at the caret.
 */
export function insertMention(body, caretIndex, member) {
  const text = String(body ?? '');
  const before = text.slice(0, caretIndex);
  const after = text.slice(caretIndex);
  const atIdx = before.lastIndexOf('@');
  const inserted = `@${member.displayName} `;
  // Only swallow the "@query" when the @ starts a word (start of text or
  // preceded by whitespace) — an email-ish "a@b" keeps its text.
  const start =
    atIdx >= 0 && (atIdx === 0 || /\s/.test(before[atIdx - 1]))
      ? atIdx
      : caretIndex;
  return { body: text.slice(0, start) + inserted + after, caret: start + inserted.length };
}

/**
 * Plain composer text → storable body: every "@Display Name" that matches a
 * real circle member becomes an "@[Name](uuid)" token. Names are matched
 * longest-first so "@Sam K." wins over a squadmate also called "Sam", and only
 * at word starts so an email-ish "a@b" is left alone. Text that doesn't match a
 * member stays literal — typing "@nobody" posts as "@nobody".
 */
export function serializeMentions(text, members) {
  const s = String(text ?? '');
  if (!s || !members || members.length === 0) return s;
  const byLongestName = [...members]
    .filter(m => m.displayName.trim().length > 0)
    .sort((a, b) => b.displayName.length - a.displayName.length);

  let out = '';
  let i = 0;
  let count = 0;
  while (i < s.length) {
    const atWordStart = s[i] === '@' && (i === 0 || /\s/.test(s[i - 1]));
    if (atWordStart && count < MAX_MENTIONS_PER_BODY) {
      const rest = s.slice(i + 1);
      const hit = byLongestName.find(m => rest.startsWith(m.displayName));
      if (hit) {
        out += mentionToken(hit.displayName, hit.userId);
        i += 1 + hit.displayName.length;
        count++;
        continue;
      }
    }
    out += s[i];
    i++;
  }
  return out;
}

/** How many real mentions the plain composer text currently carries. */
export function countPlainMentions(text, members) {
  return extractMentionIds(serializeMentions(text, members)).length;
}

/**
 * The active "@query" being typed at the caret, or null when the caret isn't in
 * a mention context. Drives the autocomplete row: empty string right after "@"
 * (so every squadmate is offered), then narrows as the user types.
 */
export function activeMentionQuery(body, caretIndex) {
  const before = String(body ?? '').slice(0, caretIndex);
  const atIdx = before.lastIndexOf('@');
  if (atIdx < 0) return null;
  if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) return null;
  const query = before.slice(atIdx + 1);
  // A completed token or whitespace after @ ends the mention context.
  if (/[\s\[\]]/.test(query)) return null;
  return query.length <= 32 ? query : null;
}

/** Flatten tokens to "@Name" for plain-text contexts. */
export function flattenMentions(body) {
  MENTION_RE.lastIndex = 0;
  return String(body ?? '').replace(MENTION_RE, '@$1');
}
