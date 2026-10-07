// ─────────────────────────────────────────────────────────────────────────────
// pacr.life/s/<slug> — a squad's share link (the app's Invite / Share buttons).
//
// Server-rendered on purpose. This site is otherwise static HTML, but a share
// link lives or dies on its preview: iMessage, WhatsApp and Slack read
// og:title / og:image from the HTML they fetch and never run JavaScript, so a
// static page could only ever preview as "PACR". Rendering here also keeps the
// JS-off path whole, the same rule the homepage's progressive enhancement
// follows.
//
//   /s/<slug>                  a public club's page, "Open in PACR"
//   /s/<slug>?invite=<code>    an organiser's invite: the app joins on open,
//                              even for a hidden (invite-only) squad
//   /s/<slug>?run=<ref>        one group run (the app's tap-to-share on a
//                              run): listed first and named in the preview.
//                              ref = the run's id as 22 base64url chars,
//                              as /p/<ref> (api/post.mjs). Combines with
//                              invite= for an invite-only squad's runs.
//   /s/<slug>/photo            the club's picture, proxied (see below)
//
// Data comes from get_club_page (migration 20261008120000 in the app repo) as
// anon: a public club, or nothing. Strangers see what the app shows them —
// counts, the schedule, the organiser — never members' names.
//
// The photo is proxied rather than linked as a signed Storage URL because that
// URL embeds the club's uuid in its path, and ids never reach anything a
// person can see or copy. It also gives link previews an address that doesn't
// expire after a week.
//
// The anon key is the same publishable key js/config.js carries; no other
// secret belongs here.
//
// Not-found and the invite card return the same page shape, so a slug that
// names a hidden squad and one that names nothing are indistinguishable.
// ─────────────────────────────────────────────────────────────────────────────

// KEEP IN SYNC with js/config.js. Copied rather than imported: that file is an
// ES module named .js with no package.json "type", which Node may load as
// CommonJS inside a function. Publishable anon key — never a service key.
const SUPABASE_URL = 'https://zrnoioagjnmetnzwneks.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpybm9pb2Fnam5tZXRuenduZWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjIwNDgsImV4cCI6MjA5NTg5ODA0OH0.D-2Lvvs2lxVG7fGWGcFBBGpBOSrHSw-DT6m_D0o9g3U';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CODE_RE = /^[a-z0-9]{4,16}$/;
const REF_RE = /^[A-Za-z0-9_-]{22}$/;

/** 22-char ref → uuid, or null. Same as decodeUserRef in js/ids.js. */
function decodeRef(ref) {
  if (!REF_RE.test(ref)) return null;
  const hex = Buffer.from(ref.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('hex');
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const APP_STORE = 'https://apps.apple.com/in/app/pacr-run-training-splits/id6804190286';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=life.pacr.app';
const APP_STORE_ID = '6804190286';
const SITE = 'https://pacr.life';

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

const directionsUrl = (lat, lng, placeId) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  + (typeof placeId === 'string' && /^[A-Za-z0-9_-]+$/.test(placeId) ? `&destination_place_id=${placeId}` : '');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** ISO week key ("2026-W40") in UTC — the visitor's zone is unknown here. */
function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}

async function clubPage(slug) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_club_page`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ p_slug: slug, p_week_key: weekKey() }),
  });
  if (!r.ok) throw new Error(`get_club_page ${r.status}`);
  return r.json();
}

async function photo(slug, res) {
  const club = await clubPage(slug).catch(() => null);
  if (!club?.avatar_path) return notFound(res, 'text/plain', 'No photo');
  const sign = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/club-avatars/${club.avatar_path.split('/').map(encodeURIComponent).join('/')}`,
    { method: 'POST', headers: HEADERS, body: JSON.stringify({ expiresIn: 120 }) },
  );
  const signed = sign.ok ? (await sign.json()).signedURL : null;
  if (!signed) return notFound(res, 'text/plain', 'No photo');
  const img = await fetch(`${SUPABASE_URL}/storage/v1${signed}`);
  if (!img.ok) return notFound(res, 'text/plain', 'No photo');
  res.statusCode = 200;
  res.setHeader('Content-Type', img.headers.get('content-type') || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.end(Buffer.from(await img.arrayBuffer()));
}

function notFound(res, type, body) {
  res.statusCode = 404;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'public, s-maxage=60');
  res.end(body);
}

const initials = name => {
  const words = String(name).split(/\s+/).filter(w => /^[A-Za-z0-9]/.test(w));
  const raw = words.length > 1 ? words.map(w => w[0]).join('') : String(name).replace(/[^A-Za-z0-9]/g, '');
  return raw.slice(0, 2).toUpperCase() || 'P';
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Server fallback in UTC; the inline script rewrites it in the visitor's zone. */
function utcWhen(iso) {
  const d = new Date(iso);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} · ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'} UTC`;
}

const pace = sec => (sec ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : '—');
const km1 = n => (Number.isInteger(n) ? String(n) : Number(n).toFixed(1));

function render({ club, slug, invite, runRef = null, runId = null }) {
  const query = [invite ? `invite=${invite}` : null, runRef ? `run=${runRef}` : null].filter(Boolean).join('&');
  const shareUrl = `${SITE}/s/${slug}${query ? `?${query}` : ''}`;
  const deep = `pacr://s/${slug}${query ? `?${query}` : ''}`;
  const name = club?.name ?? null;
  // The shared run, if it is still on the calendar (runs drop off an hour
  // after they start); the page then reads as the squad's, as before.
  const picked = runId ? (club?.runs ?? []).find(r => r.id === runId) ?? null : null;
  const title = picked
    ? `${picked.title} with ${name} — PACR`
    : club
      ? (invite ? `Join ${name} on PACR` : `${name} — a squad on PACR`)
      : invite ? 'You’re invited to a squad on PACR' : 'Squad not found — PACR';
  const policy = club?.join_policy === 'request' ? 'Approval needed' : 'Open';
  const descr = picked
    ? [utcWhen(picked.event_at), picked.meeting_point, picked.distance_km ? `${km1(Number(picked.distance_km))} km` : null,
      `${Number(picked.going_count) || 0} going`].filter(Boolean).join(' · ')
    : club
    ? [club.description, `${club.member_count} ${club.member_count === 1 ? 'runner' : 'runners'}`, club.location]
      .filter(Boolean).join(' · ')
    : invite ? 'Open this link on your phone to join the squad in the PACR app.'
    : 'This squad isn’t public. Ask a member for an invite link.';
  const ogImage = club?.avatar_path ? `${SITE}/s/${slug}/photo` : `${SITE}/og-image.png`;
  const runs = picked
    ? [picked, ...(club?.runs ?? []).filter(r => r !== picked)].slice(0, 6)
    : (club?.runs ?? []).slice(0, 6);

  const tile = club?.avatar_path
    ? `<img src="/s/${esc(slug)}/photo" alt="" width="88" height="88">`
    : esc(initials(name ?? 'PACR'));

  const runRows = runs.map(r => {
    const d = new Date(r.event_at);
    // A meeting place with a pin links to Google Maps directions (20261014120000).
    const lat = Number(r.meeting_lat), lng = Number(r.meeting_lng);
    const pinned = r.meeting_point && r.meeting_lat != null && Number.isFinite(lat) && Number.isFinite(lng);
    const where = !r.meeting_point ? null : pinned
      ? `<a class="where" href="${esc(directionsUrl(lat, lng, r.google_place_id))}" target="_blank" rel="noopener">${esc(r.meeting_point)} ↗</a>`
      : esc(r.meeting_point);
    const bits = [where, ...[r.distance_km ? `${km1(Number(r.distance_km))} km` : null, r.pace_label].filter(Boolean).map(esc)]
      .filter(Boolean).join(' · ');
    return `
      <li class="run${r === picked ? ' picked' : ''}">
        <div class="date" data-at="${esc(r.event_at)}"><span>${DOW[d.getUTCDay()].toUpperCase()}</span><b>${d.getUTCDate()}</b></div>
        <div class="run-main">
          <div class="run-title">${esc(r.title)}${r.repeat_weekly ? ' <span class="weekly">Weekly</span>' : ''}${r.women_only && !club?.women_only ? ' <span class="weekly">Women-only</span>' : ''}</div>
          <div class="run-meta"><time datetime="${esc(r.event_at)}">${esc(utcWhen(r.event_at))}</time>${bits ? ` · ${bits}` : ''}</div>
        </div>
        <div class="going">${Number(r.going_count) || 0} going</div>
      </li>`;
  }).join('');

  // The organisers' own rules (20261016120000); new members agree to them in the app.
  const squadRules = (Array.isArray(club?.rules) ? club.rules : []).filter(r => typeof r === 'string' && r.trim());

  const gone = !club && !invite;
  const body = gone ? `
    <p class="eyebrow">Squad link</p>
    <h1>This squad isn’t public</h1>
    <p class="about">It may be invite-only, or the link may be old. Ask a member for an invite link.</p>
  ` : club ? `
    <p class="eyebrow">${invite ? 'You’re invited' : 'A squad on PACR'}</p>
    <div class="hero">
      <div class="tile">${tile}</div>
      <div>
        <h1>${esc(name)}</h1>
        <p class="meta"><span class="chip">${policy}</span>${club.women_only ? '<span class="chip">Women-only</span>' : ''}${[club.location].filter(Boolean).map(esc).join('')}</p>
      </div>
    </div>
    ${club.description ? `<p class="about">${esc(club.description)}</p>` : ''}
    <div class="stats">
      <div class="stat dark"><b>${Number(club.member_count) || 0}</b><span>Members</span></div>
      <div class="stat"><b>${Math.round(Number(club.week_km) || 0)}</b><span>Km this week</span></div>
      <div class="stat"><b>${pace(Number(club.avg_pace_sec))}</b><span>Avg pace /km</span></div>
    </div>
    ${runs.length ? `<h2>Upcoming runs</h2><ul class="runs">${runRows}</ul>` : ''}
    ${squadRules.length ? `<h2>Squad rules</h2><ol class="rules">${squadRules.map(r => `<li>${esc(r)}</li>`).join('')}</ol>` : ''}
    <p class="small">Organised by ${esc(club.organiser_name ?? 'its organiser')} · since ${MON[new Date(club.created_at).getUTCMonth()]} ${new Date(club.created_at).getUTCFullYear()}</p>
  ` : `
    <p class="eyebrow">You’re invited</p>
    <h1>Join a squad on PACR</h1>
    <p class="about">This squad is invite-only, so its details stay in the app. Open the link on your phone and PACR will add you.</p>
  `;

  const ctaNote = gone
    ? 'PACR is a running coach with squads, group runs and weekly goals.'
    : !club || invite
    ? 'PACR adds you to the squad as soon as it opens.'
    : club.women_only
      ? 'A squad for women. Join from the app — it checks the gender in your profile.'
    : club.join_policy === 'request'
      ? 'Ask to join from the app — the organiser approves each new member.'
      : 'Join from the app in one tap. It’s free.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(descr)}" />
<meta name="robots" content="noindex" />
<link rel="canonical" href="${esc(`${SITE}/s/${slug}`)}" />
<meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}, app-argument=${esc(shareUrl)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="PACR" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(descr)}" />
<meta property="og:url" content="${esc(shareUrl)}" />
<meta property="og:image" content="${esc(ogImage)}" />
<meta name="twitter:card" content="${club?.avatar_path ? 'summary' : 'summary_large_image'}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/brand-acid/icon-512.png" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/nav.css">
<style>
  html, body { margin:0; padding:0; background:#FFFFFF; color:#0F0F0D; font-family:Manrope, Helvetica, sans-serif; }
  * { box-sizing:border-box; }
  a { color:#5A6B00; text-decoration:none; }
  ::selection { background:#E8FF3A; color:#0A0A09; }
  main { max-width:620px; margin:0 auto; padding:64px 24px 96px; }
  .eyebrow { margin:0 0 18px; font-weight:700; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#8B8B80; }
  h1 { margin:0; font-family:Outfit, sans-serif; font-weight:700; font-size:40px; line-height:1.05; letter-spacing:-0.02em; }
  h2 { margin:40px 0 14px; font-family:Outfit, sans-serif; font-weight:700; font-size:22px; }
  .hero { display:flex; align-items:center; gap:20px; }
  .tile { flex:none; width:88px; height:88px; border-radius:24px; background:#E8FF3A; overflow:hidden;
    display:flex; align-items:center; justify-content:center; font-family:Outfit, sans-serif; font-weight:700; font-size:30px; }
  .tile img { width:100%; height:100%; object-fit:cover; display:block; }
  .meta { margin:10px 0 0; display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:14px; color:#5C5C54; }
  .chip { padding:4px 10px; border-radius:999px; background:#F2F2EC; font-weight:700; font-size:12px; color:#0F0F0D; }
  .about { margin:24px 0 0; font-size:17px; line-height:1.55; color:#2A2A26; }
  .stats { margin-top:28px; display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; }
  .stat { padding:16px; border-radius:20px; border:1px solid #E3E3DA; display:flex; flex-direction:column; gap:4px; }
  .stat b { font-family:Outfit, sans-serif; font-size:26px; font-variant-numeric:tabular-nums; }
  .stat span { font-weight:700; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:#8B8B80; }
  .stat.dark { background:#0F0F0D; border-color:#0F0F0D; }
  .stat.dark b { color:#E8FF3A; } .stat.dark span { color:#B9B9AE; }
  .runs { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
  .run { display:flex; align-items:center; gap:14px; padding:14px; border:1px solid #E3E3DA; border-radius:20px; }
  .date { flex:none; width:52px; height:56px; border-radius:14px; background:#F2F2EC; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .date span { font-weight:700; font-size:10px; letter-spacing:0.12em; color:#8B8B80; }
  .date b { font-family:Outfit, sans-serif; font-size:21px; }
  .run.picked { border:2px solid #0F0F0D; background:#F7FFD1; }
  .run-main { flex:1; min-width:0; }
  .run-title { font-weight:700; font-size:16px; }
  .weekly { margin-left:6px; padding:2px 8px; border-radius:999px; background:#E8FF3A; font-size:11px; }
  .run-meta { margin-top:3px; font-size:13px; color:#5C5C54; }
  .run-meta a.where { color:inherit; font-weight:600; text-decoration:underline; text-underline-offset:2px; }
  .going { flex:none; font-weight:700; font-size:13px; color:#5C5C54; }
  .small { margin:28px 0 0; font-size:13px; color:#8B8B80; }
  .rules { margin:0; padding:0 0 0 20px; display:flex; flex-direction:column; gap:8px; font-size:15px; line-height:1.45; }
  .cta { margin-top:44px; padding:28px; border-radius:28px; background:#0F0F0D; color:#FFFFFF; }
  .cta p { margin:0; font-size:15px; line-height:1.5; color:#D9D9CF; }
  .open { margin-top:18px; display:flex; align-items:center; justify-content:center; height:56px; border-radius:999px;
    background:#E8FF3A; color:#0A0A09; font-family:Outfit, sans-serif; font-weight:700; font-size:18px; }
  .open:hover { color:#0A0A09; filter:brightness(0.95); }
  .stores { margin-top:16px; display:flex; gap:10px; flex-wrap:wrap; font-weight:600; font-size:13px; }
  .stores a { flex:1; min-width:150px; text-align:center; padding:12px; border-radius:999px; border:1px solid #3A3A35; color:#FFFFFF; }
  .desk { display:none; margin-top:14px; font-size:13px; color:#B9B9AE; }
  @media (hover:hover) and (pointer:fine) { .desk { display:block; } }
  @media (max-width:560px) { h1 { font-size:32px; } main { padding-top:40px; } .stat b { font-size:22px; } }
</style>
</head>
<body>
<header class="site-head">
  <a class="brand" href="/" aria-label="PACR home">
    <img src="/assets/pacr-mark.png" alt="" width="34" height="34">
    <span>PACR</span>
  </a>
  <nav class="site-nav" aria-label="Primary">
    <a href="/#coach">How it works</a>
    <a href="/#clubs">Clubs</a>
    <a href="/#routes">Routes</a>
    <a href="/feed">Feed</a>
    <a href="/profile">Profile</a>
  </nav>
  <div class="head-right">
    <a class="btn-acid" href="/#get">Get PACR</a>
  </div>
</header>

<main>
  ${body}
  <section class="cta">
    <p>${ctaNote}</p>
    ${gone ? '' : `<a class="open" id="open" href="${esc(deep)}" data-path="${esc(deep.slice('pacr://'.length))}">Open in PACR</a>`}
    <div class="stores">
      <a href="${APP_STORE}">Get it on the App Store</a>
      <a href="${PLAY_STORE}">Get it on Google Play</a>
    </div>
    <p class="desk">On a computer? Open this link on your phone.</p>
  </section>
</main>

<footer style="border-top:1px solid #E3E3DA; padding:32px 40px; display:flex; justify-content:space-between; gap:20px; flex-wrap:wrap; font-weight:600; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:#8B8B80;">
  <span>© PACR</span>
  <span style="display:flex; gap:22px; flex-wrap:wrap;">
    <a href="/">Home</a>
    <a href="/community-rules">Community rules</a>
    <a href="/privacy">Privacy</a>
    <a href="/support">Support</a>
  </span>
</footer>

<script>
  // Android: an intent:// link opens PACR when it's installed and falls back
  // to the Play Store when it isn't — a bare pacr:// link does nothing there.
  // (With an app build that verifies pacr.life App Links, Android skips this
  // page entirely; this covers older builds and in-app browsers.)
  (function () {
    var a = document.getElementById('open');
    if (!a || !/Android/i.test(navigator.userAgent)) return;
    a.href = 'intent://' + a.getAttribute('data-path')
      + '#Intent;scheme=pacr;package=life.pacr.app;S.browser_fallback_url='
      + encodeURIComponent('${PLAY_STORE}') + ';end';
  })();

  // Run times in the visitor's own zone; the server only knows UTC.
  for (const t of document.querySelectorAll('time[datetime]')) {
    const d = new Date(t.getAttribute('datetime'));
    if (isNaN(d)) continue;
    t.textContent = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
      + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  for (const b of document.querySelectorAll('.date[data-at]')) {
    const d = new Date(b.getAttribute('data-at'));
    if (isNaN(d)) continue;
    b.querySelector('span').textContent = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    b.querySelector('b').textContent = String(d.getDate());
  }
</script>
</body>
</html>`;
}

export default async function handler(req, res) {
  const url = new URL(req.url, SITE);
  const slug = String(req.query?.slug ?? url.searchParams.get('slug') ?? '').toLowerCase();
  const rawInvite = String(req.query?.invite ?? url.searchParams.get('invite') ?? '').toLowerCase();
  const invite = CODE_RE.test(rawInvite) ? rawInvite : null;
  const wantsPhoto = (req.query?.photo ?? url.searchParams.get('photo')) === '1';
  const rawRun = String(req.query?.run ?? url.searchParams.get('run') ?? '');
  const runId = decodeRef(rawRun);
  const runRef = runId ? rawRun : null;

  if (!SLUG_RE.test(slug) || slug.length > 48) {
    return notFound(res, 'text/html; charset=utf-8', render({ club: null, slug: 'squad', invite: null }));
  }
  if (wantsPhoto) return photo(slug, res);

  let club = null;
  try {
    club = await clubPage(slug);
  } catch {
    // Fall through: an invite still works without the page, and a public link
    // still offers the app.
  }

  res.statusCode = club || invite ? 200 : 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Invites are personal-ish (anyone holding one joins), so keep them out of
  // shared caches; a public club page can sit at the edge for a few minutes.
  res.setHeader('Cache-Control', invite ? 'private, no-store' : 'public, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(render({ club, slug, invite, runRef, runId }));
}
