// ─────────────────────────────────────────────────────────────────────────────
// /host/apply — small shared helpers.
// ─────────────────────────────────────────────────────────────────────────────

import { esc } from '../supabase.js';

export { esc };

export const $ = (id) => document.getElementById(id);

/** Show a message under a form or a section. kind: '' | 'err' | 'ok'. */
export function say(node, text, kind = '') {
  if (!node) return;
  node.textContent = text ?? '';
  node.className = `msg${kind ? ' ' + kind : ''}`;
  node.hidden = !text;
}
