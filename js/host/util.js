// ─────────────────────────────────────────────────────────────────────────────
// /host — small shared helpers: refs, dates, labels.
//
// An event's address in the dashboard is /host/e/<ref>, the event id as 22
// base64url characters — the same encoding as /profile?r= (js/ids.js) and
// the app's pacr.life/e/<ref>, so no uuid is ever printed in a link a person
// copies ([[never-surface-raw-ids]]).
// ─────────────────────────────────────────────────────────────────────────────

import { encodeUserRef, decodeUserRef } from '../ids.js';
import { esc } from '../supabase.js';

export { esc };
export const encodeRef = encodeUserRef;
export const decodeRef = decodeUserRef;

export const $ = (id) => document.getElementById(id);

export const editHref = (id) => `/host/e/${encodeRef(id)}`;
export const attendeesHref = (id) => `/host/e/${encodeRef(id)}/attendees`;

/** The browser's IANA zone ("Asia/Kolkata"): <input type=datetime-local>
 *  values are read and written in it. */
export const localZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'; } catch { return 'Asia/Kolkata'; }
};

const pad = (n) => String(n).padStart(2, '0');

/** ISO → "2026-11-15T06:30" for a datetime-local input. */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A datetime-local value → ISO, or null. */
export function fromLocalInput(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function clock(iso) {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Sat, 15 Nov · 6:30 AM" */
export function when(iso) {
  const d = new Date(iso);
  return `${DOW[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]} · ${clock(iso)}`;
}

/** { mon: 'NOV', day: 15 } for a date tile. */
export function dateTile(iso) {
  const d = new Date(iso);
  return { mon: MON[d.getMonth()].toUpperCase(), day: d.getDate() };
}

export const STATUS = {
  draft: 'Draft',
  published: 'Live',
  cancelled: 'Cancelled',
  ended: 'Ended',
};

export const KIND = { run: 'Run', workshop: 'Workshop', social: 'Social' };

/** "12 of 40 going" / "12 going". */
export function goingLine(sold, capacity) {
  return capacity != null ? `${sold} of ${capacity} going` : `${sold} going`;
}

/** Show a message under a form or a section. kind: '' | 'err' | 'ok'. */
export function say(node, text, kind = '') {
  if (!node) return;
  node.textContent = text ?? '';
  node.className = `msg${kind ? ' ' + kind : ''}`;
  node.hidden = !text;
}
