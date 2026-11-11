// Copied verbatim from the app: pacr/src/utils/mentions.ts. Keep the two identical.
// ─────────────────────────────────────────────────────────────────────────────
// Mention tokens
//
// Mentions live inline in post/comment bodies as "@[Display Name](uuid)" —
// no mentions table. The client renders and inserts them with these helpers;
// the squad-feed-notify Edge Function parses the SAME format server-side to
// fan out "you were tagged" pushes and validates the ids against circle
// membership there.
//
// KEEP IN SYNC: MENTION_RE below must stay literally identical to the copy in
// supabase/functions/squad-feed-notify/index.ts and public.plain_mentions
// (20261129120000).
//
// Squad chat (20261129120000) carries the same tokens in squad_messages.body;
// plainMentions is what every plain-text sink of a body uses (Copy, the squad
// page's chat preview, the owners' reports queue) so a uuid never shows.
// ─────────────────────────────────────────────────────────────────────────────

/** Hard cap on mentions per body — bounds push fanout and render work. */
export const MAX_MENTIONS_PER_BODY = 10;

// Display names are 1–32 chars (users.display_name check) and can't contain
// "]" per insertMention's sanitization; the uuid group is strict v4-shaped.
const MENTION_RE =
  /@\[([^\]\n]{1,32})\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/g;

// Display-only safety net: anything token-SHAPED that the strict regex above
// rejected (a truncated id, a body written by some older/other client) is
// still rendered as a plain "@Name". A user id must never reach the screen,
// even when the token is malformed enough that we can't link it.
const LOOSE_TOKEN_RE = /@\[([^\]\n]{1,64})\]\(([^)\s]{0,80})\)/g;

export interface MentionSegment {
  type: 'text' | 'mention';
  /** For mentions: the display name WITHOUT the leading @. */
  text: string;
  /** Set only when type === 'mention'. */
  userId?: string;
}

/**
 * Split a body into renderable segments. Text between/around tokens comes
 * back verbatim; malformed tokens stay plain text. Never throws.
 */
export function parseMentionSegments(body: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  if (!body) return segments;

  let last = 0;
  let count = 0;
  MENTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(body)) !== null && count < MAX_MENTIONS_PER_BODY) {
    if (m.index > last) pushText(segments, body.slice(last, m.index));
    segments.push({ type: 'mention', text: m[1], userId: m[2] });
    last = m.index + m[0].length;
    count++;
  }
  if (last < body.length) pushText(segments, body.slice(last));
  return segments;
}

/** Append a text run, scrubbing any token-shaped leftovers down to "@Name". */
function pushText(segments: MentionSegment[], text: string) {
  LOOSE_TOKEN_RE.lastIndex = 0;
  segments.push({ type: 'text', text: text.replace(LOOSE_TOKEN_RE, '@$1') });
}

/**
 * The body as a person reads it: every token (well-formed or not) becomes
 * "@Name". For plain-text sinks — clipboard, previews, push bodies.
 */
export function plainMentions(body: string): string {
  if (!body) return '';
  MENTION_RE.lastIndex = 0;
  LOOSE_TOKEN_RE.lastIndex = 0;
  return body.replace(MENTION_RE, '@$1').replace(LOOSE_TOKEN_RE, '@$1');
}

/** Distinct mentioned user ids, capped at MAX_MENTIONS_PER_BODY. */
export function extractMentionIds(body: string): string[] {
  const ids = new Set<string>();
  for (const seg of parseMentionSegments(body)) {
    if (seg.type === 'mention' && seg.userId) ids.add(seg.userId);
  }
  return Array.from(ids);
}

/**
 * Build the token for one member. Names are sanitized so they can't break
 * the token syntax (no "]" / newlines; length-capped to the DB limit).
 */
export function mentionToken(displayName: string, userId: string): string {
  const safe = displayName.replace(/[\]\n]/g, '').slice(0, 32).trim() || 'runner';
  return `@[${safe}](${userId})`;
}

/**
 * Replace the "@query" the user is typing at `caretIndex` with the member's
 * plain "@Display Name". Composers hold PLAIN text — a user must never see a
 * raw "@[Name](uuid)" token, let alone the uuid — and serializeMentions turns
 * the names back into tokens at submit time.
 *
 * Returns the new text and the caret position just after what was inserted.
 * If no "@" is found before the caret, inserts at the caret.
 */
export function insertMention(
  body: string,
  caretIndex: number,
  member: { userId: string; displayName: string },
): { body: string; caret: number } {
  const before = body.slice(0, caretIndex);
  const after = body.slice(caretIndex);
  const atIdx = before.lastIndexOf('@');
  const inserted = `@${member.displayName} `;
  // Only swallow the "@query" when the @ starts a word (start of text or
  // preceded by whitespace) — an email-ish "a@b" keeps its text.
  const start =
    atIdx >= 0 && (atIdx === 0 || /\s/.test(before[atIdx - 1]))
      ? atIdx
      : caretIndex;
  const newBody = body.slice(0, start) + inserted + after;
  return { body: newBody, caret: start + inserted.length };
}

/**
 * Plain composer text → storable body: every "@Display Name" that matches a
 * real circle member becomes an "@[Name](uuid)" token. Names are matched
 * longest-first so "@Sam K." wins over a squadmate also called "Sam", and
 * only at word starts so an email-ish "a@b" is left alone. Text that doesn't
 * match a member stays literal — typing "@nobody" posts as "@nobody".
 */
export function serializeMentions(
  text: string,
  members: Array<{ userId: string; displayName: string }>,
): string {
  if (!text || members.length === 0) return text;
  const byLongestName = [...members]
    .filter(m => m.displayName.trim().length > 0)
    .sort((a, b) => b.displayName.length - a.displayName.length);

  let out = '';
  let i = 0;
  let count = 0;
  while (i < text.length) {
    const atWordStart = text[i] === '@' && (i === 0 || /\s/.test(text[i - 1]));
    if (atWordStart && count < MAX_MENTIONS_PER_BODY) {
      const rest = text.slice(i + 1);
      const hit = byLongestName.find(m => rest.startsWith(m.displayName));
      if (hit) {
        out += mentionToken(hit.displayName, hit.userId);
        i += 1 + hit.displayName.length;
        count++;
        continue;
      }
    }
    out += text[i];
    i++;
  }
  return out;
}

/** How many real mentions the plain composer text currently carries. */
export function countPlainMentions(
  text: string,
  members: Array<{ userId: string; displayName: string }>,
): number {
  return extractMentionIds(serializeMentions(text, members)).length;
}

/**
 * The active "@query" being typed at the caret, or null when the caret isn't
 * in a mention context. Drives the autocomplete overlay: empty string right
 * after "@", then narrows as the user types.
 */
export function activeMentionQuery(body: string, caretIndex: number): string | null {
  const before = body.slice(0, caretIndex);
  const atIdx = before.lastIndexOf('@');
  if (atIdx < 0) return null;
  if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) return null;
  const query = before.slice(atIdx + 1);
  // A completed token or whitespace after @ ends the mention context.
  if (/[\s\[\]]/.test(query)) return null;
  return query.length <= 32 ? query : null;
}
