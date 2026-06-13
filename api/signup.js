// Vercel serverless function — handles the marketing-site form submissions.
//
//   • early access → validate + insert (one step)
//   • club signup  → email OTP via Supabase Auth, then insert on verify:
//       POST { kind:'club', action:'send',   email }                 → emails a code
//       POST { kind:'club', action:'verify', token, ...clubFields }  → verifies + inserts
//
// Credentials (SUPABASE_URL, SUPABASE_ANON_KEY) come from Vercel env — no keys
// ship to the browser. The anon key is used server-side for both the Auth OTP
// calls (/auth/v1/otp, /auth/v1/verify) and the RLS-guarded (insert-only)
// PostgREST insert. The tables enforce RLS (supabase/migrations/), so even this
// key can only insert — never read.

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CLUB_FIELDS  = ["name", "city", "frequency", "email", "mobile"];
const CLUB_REQUIRED = ["name", "city", "email"];
const EARLY_FIELDS = ["name", "email", "city"];
const EARLY_REQUIRED = ["name", "email", "city"];

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

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Invalid body" });

  // Honeypot — pretend success so bots don't probe further. Nothing happens.
  if (body.website) return res.status(204).end();

  const env = { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
  try {
    if (body.kind === "early") return await handleEarly(body, res, env);
    if (body.kind === "club")  return await handleClub(body, res, env);
    return res.status(400).json({ error: "Unknown form" });
  } catch (e) {
    console.error("[pacr] handler error", e);
    return res.status(502).json({ error: "Could not complete request" });
  }
}

// Whitelist known columns — trimmed, length-capped. Drops anything else.
function cleanRow(body, fields) {
  const row = {};
  for (const f of fields) {
    if (body[f] != null && String(body[f]).trim() !== "") row[f] = String(body[f]).trim().slice(0, 300);
  }
  for (const k of UTM_KEYS) {
    if (body[k] != null && String(body[k]).trim() !== "") row[k] = String(body[k]).trim().slice(0, 200);
  }
  return row;
}

async function insertRow(env, table, row) {
  const r = await fetch(env.url + "/rest/v1/" + table, {
    method: "POST",
    headers: {
      apikey: env.key,
      Authorization: "Bearer " + env.key,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(row)
  });
  if (!r.ok) {
    console.error("[pacr] insert failed", table, r.status, await r.text());
    return false;
  }
  return true;
}

async function handleEarly(body, res, env) {
  const row = cleanRow(body, EARLY_FIELDS);
  for (const f of EARLY_REQUIRED) if (!row[f]) return res.status(400).json({ error: "Missing field: " + f });
  if (!EMAIL_RE.test(row.email)) return res.status(400).json({ error: "Invalid email" });
  return (await insertRow(env, "early_access_signups", row))
    ? res.status(201).json({ ok: true })
    : res.status(502).json({ error: "Could not save signup" });
}

async function handleClub(body, res, env) {
  const email = String(body.email || "").trim();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email." });

  // Step 1 — send the OTP code (Supabase Auth emails it).
  if (body.action === "send") {
    const r = await fetch(env.url + "/auth/v1/otp", {
      method: "POST",
      headers: { apikey: env.key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, create_user: true })
    });
    if (r.ok) return res.status(200).json({ ok: true });
    console.error("[pacr] otp send failed", r.status, await r.text());
    if (r.status === 429) return res.status(429).json({ error: "Please wait a moment before requesting another code." });
    return res.status(502).json({ error: "Could not send the code. Try again." });
  }

  // Step 2 — verify the code, then insert the signup.
  if (body.action === "verify") {
    const token = String(body.token || "").trim();
    if (!/^\d{6}$/.test(token)) return res.status(400).json({ error: "Enter the 6-digit code." });

    const v = await fetch(env.url + "/auth/v1/verify", {
      method: "POST",
      headers: { apikey: env.key, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "email", email, token })
    });
    if (!v.ok) {
      console.error("[pacr] otp verify failed", v.status, await v.text());
      return res.status(401).json({ error: "That code is invalid or expired." });
    }

    const row = cleanRow(body, CLUB_FIELDS);
    for (const f of CLUB_REQUIRED) if (!row[f]) return res.status(400).json({ error: "Missing field: " + f });
    row.email = email;            // bind the insert to the verified address
    row.email_verified = true;
    return (await insertRow(env, "club_signups", row))
      ? res.status(201).json({ ok: true })
      : res.status(502).json({ error: "Could not save signup" });
  }

  return res.status(400).json({ error: "Unknown action" });
}
