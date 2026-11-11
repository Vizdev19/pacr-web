// ─────────────────────────────────────────────────────────────────────────────
// Profile refs — how one runner links to another without printing a uuid.
//
// This product has no usernames, so a link to someone's profile has to carry
// their id. A raw uuid in the address bar is exactly what [[never-surface-raw-ids]]
// rules out: "ids in URLs a user copies" is named in that rule, and the bug it
// describes has shipped here twice.
//
// So the id is base64url-encoded into a 22-character ref: /profile?r=EX7…. It is
// short, it is opaque, and it survives copy-paste and sharing without a database
// key ever appearing on screen.
//
// It is NOT a secret and must never be treated as one. It is reversible by
// anyone who cares to, and it protects nothing: what a viewer may READ about the
// runner behind it is decided entirely by RLS (users_select_co_members and
// users_select_followed). Handing someone a ref for a runner they share nothing
// with gets them a "not visible" page, because the row does not come back.
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF_RE = /^[A-Za-z0-9_-]{22}$/;

/** uuid → 22-char base64url ref, or null if it is not a uuid. */
export function encodeUserRef(uuid) {
  if (!UUID_RE.test(String(uuid ?? ''))) return null;
  const hex = String(uuid).replace(/-/g, '');
  let bin = '';
  for (let i = 0; i < 32; i += 2) bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** ref → uuid, or null. Anything malformed is null rather than a guess: the
 *  caller turns that into "not visible", which is also what a valid ref for an
 *  unreadable runner produces, so a bad ref leaks nothing a good one would not. */
export function decodeUserRef(ref) {
  if (!REF_RE.test(String(ref ?? ''))) return null;
  try {
    const bin = atob(String(ref).replace(/-/g, '+').replace(/_/g, '/'));
    if (bin.length !== 16) return null;
    let hex = '';
    for (let i = 0; i < 16; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, '0');
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-`
      + `${hex.slice(16, 20)}-${hex.slice(20)}`;
    return UUID_RE.test(uuid) ? uuid : null;
  } catch {
    return null;
  }
}

/** The href for a runner's profile. */
export function profileHref(userId) {
  const ref = encodeUserRef(userId);
  return ref ? `/profile?r=${ref}` : null;
}
