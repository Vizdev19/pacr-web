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
