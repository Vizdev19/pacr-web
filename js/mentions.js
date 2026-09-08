// ─────────────────────────────────────────────────────────────────────────────
// Mentions — web copy
//
// Ported from pacr/src/utils/mentions.ts. Mentions are inline
// "@[Display Name](uuid)" tokens in the body text; there is no mentions table.
// The push sender parses the same tokens server-side and validates membership.
//
// KEEP IN SYNC: MENTION_RE must stay literally identical to the app's copy.
// ─────────────────────────────────────────────────────────────────────────────

import { esc } from './supabase.js';

export const MAX_MENTIONS_PER_BODY = 10;

const MENTION_RE =
  /@\[([^\]\n]{1,32})\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/g;

// A raw user id must NEVER reach the screen, so this loose pattern catches any
// token the strict one rejected (a truncated id, a body from an older client)
// and still renders a plain @Name.
const LOOSE_TOKEN_RE = /@\[([^\]\n]{1,64})\]\(([^)\s]{0,80})\)/g;

/** Render a post/comment body as safe HTML with mentions highlighted. */
export function renderBody(body) {
  if (!body) return '';
  // Escape FIRST, then swap tokens for markup, so nothing in a body can
  // introduce a tag. The regexes only ever match text we just escaped.
  let html = esc(body);
  html = html.replace(MENTION_RE, (_m, name) => `<span class="mention">@${name}</span>`);
  html = html.replace(LOOSE_TOKEN_RE, (_m, name) => `<span class="mention">@${name}</span>`);
  return html;
}

/** "@[Ananya R](uuid)" for a picked member. */
export function mentionToken(displayName, userId) {
  return `@[${String(displayName).slice(0, 32)}](${userId})`;
}

/** Count of well-formed mention tokens already in a body. */
export function countMentions(body) {
  if (!body) return 0;
  MENTION_RE.lastIndex = 0;
  let n = 0;
  while (MENTION_RE.exec(body) !== null) n += 1;
  return n;
}

/**
 * The partial "@query" the caret currently sits inside, or null.
 *
 * Only matches at a word start so an email address never opens the picker,
 * and stops at whitespace so a finished token is not re-queried.
 */
export function activeMentionQuery(body, caretIndex) {
  const upto = String(body ?? '').slice(0, caretIndex);
  const m = /(^|\s)@([^\s@\[\]()]{0,32})$/.exec(upto);
  return m ? m[2] : null;
}

/**
 * Replace the in-progress "@query" before the caret with a full token.
 * Returns the new body and where the caret should land after it.
 */
export function applyMention(body, caretIndex, displayName, userId) {
  const before = String(body ?? '').slice(0, caretIndex);
  const after = String(body ?? '').slice(caretIndex);
  const m = /(^|\s)@([^\s@\[\]()]{0,32})$/.exec(before);
  if (!m) return { body, caret: caretIndex };
  const head = before.slice(0, m.index + m[1].length);
  const token = `${mentionToken(displayName, userId)} `;
  return { body: head + token + after, caret: (head + token).length };
}
