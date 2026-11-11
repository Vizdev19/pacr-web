// A uuid as the 22-character base64url ref the rest of pacr.life uses
// (js/ids.js, api/*.mjs, the app's postLink.ts, and SQL uuid_ref()).
// Raw uuids never reach anything a person sees; links carry refs or slugs.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeRef(uuid: string): string | null {
  if (!UUID_RE.test(uuid)) return null;
  const hex = uuid.replace(/-/g, "");
  let bin = "";
  for (let i = 0; i < 32; i += 2) bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  const b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A 22-character ref back to its uuid, or null for anything that isn't one. */
export function decodeRef(ref: string | null | undefined): string | null {
  if (!ref || !/^[A-Za-z0-9_-]{22}$/.test(ref)) return null;
  const b64 = ref.replace(/-/g, "+").replace(/_/g, "/") + "==";
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  if (bin.length !== 16) return null;
  const hex = Array.from(bin, c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return encodeRef(uuid) === ref ? uuid : null;
}
