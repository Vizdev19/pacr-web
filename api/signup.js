// Vercel serverless function — receives a form submission and inserts it
// into Supabase. Credentials come from environment variables set in the
// Vercel dashboard (SUPABASE_URL, SUPABASE_ANON_KEY), so no keys ship to the
// browser. The tables have RLS with an insert-only policy (supabase/migrations/),
// so even the anon key used here can only insert — never read.

const TABLES = {
  club:  { table: "club_signups",         fields: ["name", "city", "frequency", "contact"], required: ["name", "city", "contact"] },
  early: { table: "early_access_signups", fields: ["name", "email", "city"],                required: ["name", "email", "city"] }
};
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[pacr] missing SUPABASE_URL / SUPABASE_ANON_KEY env vars");
    return res.status(500).json({ error: "Server not configured" });
  }

  // Vercel parses JSON bodies, but accept a raw string too.
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  }
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Invalid body" });
  }

  // Honeypot — pretend success so bots don't probe further. Nothing inserted.
  if (body.website) return res.status(204).end();

  const spec = TABLES[body.kind];
  if (!spec) return res.status(400).json({ error: "Unknown form" });

  // Whitelist columns — only known fields, trimmed and length-capped. Anything
  // else in the payload (a stray utm_, an injected column name) is dropped.
  const row = {};
  for (const f of spec.fields) {
    if (body[f] != null && String(body[f]).trim() !== "") row[f] = String(body[f]).trim().slice(0, 300);
  }
  for (const k of UTM_KEYS) {
    if (body[k] != null && String(body[k]).trim() !== "") row[k] = String(body[k]).trim().slice(0, 200);
  }

  for (const r of spec.required) {
    if (!row[r]) return res.status(400).json({ error: "Missing field: " + r });
  }
  if (body.kind === "early" && !EMAIL_RE.test(row.email)) {
    return res.status(400).json({ error: "Invalid email" });
  }

  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/" + spec.table, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(row)
    });
    if (!r.ok) {
      // Log the detail server-side; don't leak Supabase internals to the client.
      console.error("[pacr] supabase insert failed", r.status, await r.text());
      return res.status(502).json({ error: "Could not save signup" });
    }
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error("[pacr] supabase request error", e);
    return res.status(502).json({ error: "Could not save signup" });
  }
}
