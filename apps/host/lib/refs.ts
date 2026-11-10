// A uuid as a 22-character base64url ref, the same encoding as the site's
// js/ids.js and the app's share links. URLs carry refs, never a printed uuid.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF_RE = /^[A-Za-z0-9_-]{22}$/;

export function encodeRef(uuid: string | null | undefined): string | null {
  if (!UUID_RE.test(String(uuid ?? ""))) return null;
  const hex = String(uuid).replace(/-/g, "");
  let bin = "";
  for (let i = 0; i < 32; i += 2) bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeRef(ref: string | null | undefined): string | null {
  if (!REF_RE.test(String(ref ?? ""))) return null;
  try {
    const bin = atob(String(ref).replace(/-/g, "+").replace(/_/g, "/"));
    if (bin.length !== 16) return null;
    let hex = "";
    for (let i = 0; i < 16; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    return UUID_RE.test(uuid) ? uuid : null;
  } catch {
    return null;
  }
}

/** The original event pages on the static site (host.html): editor and attendees. */
export const eventEditHref = (eventId: string) => `/host/e/${encodeRef(eventId)}`;
export const eventNewHref = "/host/new";
export const organizerApplyHref = "/host/apply";
