// Vercel serverless function — handles the marketing-site form submissions.
//
//   • early access → validate + insert (one step)
//   • club signup  → email OTP via Supabase Auth, then upsert on verify:
//       POST { kind:'club', action:'send',   email }                 → emails a code
//       POST { kind:'club', action:'verify', token, ...clubFields }  → verifies + upserts
//
// Credentials come from Vercel env — no keys ship to the browser:
//   SUPABASE_URL              — project URL
//   SUPABASE_ANON_KEY         — used for the GoTrue OTP calls (/auth/v1/*)
//   SUPABASE_SERVICE_ROLE_KEY — used for the DB writes (PostgREST). It bypasses
//                               RLS, which is required for the club upsert
//                               (INSERT ... ON CONFLICT DO UPDATE can't be
//                               satisfied under RLS without exposing reads).
// This function is the only writer and gates club writes behind OTP, so the
// service key stays server-side. Tables keep RLS on, so the anon key can't read.

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

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[pacr] missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY env vars");
    return res.status(500).json({ error: "Server not configured" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Invalid body" });

  // Honeypot — pretend success so bots don't probe further. Nothing happens.
  if (body.website) return res.status(204).end();

  const env = { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceKey: SUPABASE_SERVICE_ROLE_KEY };
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

// Insert a row, or upsert when onConflict is given (ON CONFLICT (col) DO UPDATE).
// Uses the service-role key — bypasses RLS, so the upsert's DO UPDATE works.
async function insertRow(env, table, row, onConflict) {
  const path = "/rest/v1/" + table + (onConflict ? "?on_conflict=" + onConflict : "");
  const prefer = "return=minimal" + (onConflict ? ",resolution=merge-duplicates" : "");
  const r = await fetch(env.url + path, {
    method: "POST",
    headers: {
      apikey: env.serviceKey,
      Authorization: "Bearer " + env.serviceKey,
      "Content-Type": "application/json",
      Prefer: prefer
    },
    body: JSON.stringify(row)
  });
  if (!r.ok) {
    console.error("[pacr] write failed", table, r.status, await r.text());
    return false;
  }
  return true;
}

// Does a row already exist for this email? Service role — RLS would hide it.
async function rowExists(env, table, email) {
  const url = env.url + "/rest/v1/" + table + "?select=email&limit=1&email=eq." + encodeURIComponent(email);
  const r = await fetch(url, { headers: { apikey: env.serviceKey, Authorization: "Bearer " + env.serviceKey } });
  if (!r.ok) { console.error("[pacr] exists check failed", table, r.status, await r.text()); return false; }
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

// Verify an email OTP. type:'email' is the unified OTP type and should cover
// both new (signup) and returning (magiclink) users; we fall back across the
// specific types for GoTrue versions where 'email' alone doesn't match the
// signup token. Stops at the first success. A wrong code costs a few attempts,
// which is fine at this volume — GoTrue rate-limits the endpoint as a backstop.
async function verifyOtp(env, email, token) {
  for (const type of ["email", "signup", "magiclink"]) {
    const v = await fetch(env.url + "/auth/v1/verify", {
      method: "POST",
      headers: { apikey: env.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ type, email, token })
    });
    if (v.ok) return true;
    if (v.status === 429) { console.error("[pacr] otp verify rate-limited"); break; }
  }
  return false;
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
  // Normalize to lowercase: GoTrue treats the OTP email case-insensitively, and
  // storing it lowercased lets the unique index dedupe regardless of case.
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email." });

  // Step 1 — send the OTP code (Supabase Auth emails it).
  if (body.action === "send") {
    const r = await fetch(env.url + "/auth/v1/otp", {
      method: "POST",
      headers: { apikey: env.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, create_user: true })
    });
    if (r.ok) return res.status(200).json({ ok: true });
    console.error("[pacr] otp send failed", r.status, await r.text());
    if (r.status === 429) return res.status(429).json({ error: "Please wait a moment before requesting another code." });
    return res.status(502).json({ error: "Could not send the code. Try again." });
  }

  // Step 2 — verify the code, then upsert the signup (dedupes on email).
  if (body.action === "verify") {
    const token = String(body.token || "").trim();
    if (!/^\d{6}$/.test(token)) return res.status(400).json({ error: "Enter the 6-digit code." });
    if (!(await verifyOtp(env, email, token))) {
      return res.status(401).json({ error: "That code is invalid or expired." });
    }

    const row = cleanRow(body, CLUB_FIELDS);
    for (const f of CLUB_REQUIRED) if (!row[f]) return res.status(400).json({ error: "Missing field: " + f });
    row.email = email;            // verified + normalized; also the conflict key
    row.email_verified = true;

    // Was this runner already on the list? (Check before the upsert creates/refreshes the row.)
    const existing = await rowExists(env, "club_signups", email);
    if (!(await insertRow(env, "club_signups", row, "email"))) {
      return res.status(502).json({ error: "Could not save signup" });
    }
    return res.status(201).json({ ok: true, existing: existing });
  }

  return res.status(400).json({ error: "Unknown action" });
}
