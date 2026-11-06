// ─────────────────────────────────────────────────────────────────────────────
// pacr.life/e/<ref> — a shared event (the app's Share on an event or ticket).
//
// Server-rendered for the same reason as /s/<slug> (api/squad.mjs): link
// previews read og:title / og:image from the HTML and never run JavaScript.
//
//   /e/<ref>          the event, "Open in PACR"
//   /e/<ref>/poster   its 2:3 poster, proxied
//
// The app comes first. With PACR installed, iOS opens /e/* in the app before
// this page loads (/.well-known/apple-app-site-association) and Android does
// once its build carries the /e/ intent filter (app.config.js). Anyone who
// still lands here gets the Smart App Banner on iOS and an "Open in PACR"
// button: pacr://e/<ref> on iOS, an intent:// with a Play Store fallback on
// Android.
//
// <ref> is the event uuid base64url-encoded to 22 characters (js/ids.js) — a
// shape, never access control. Data comes from get_event (migration
// 20261130120000 in the app repo) as anon: it answers for published public
// and link events and returns null for squad-only, draft and unknown ones,
// which all render the same "open it in PACR" page.
//
// The poster is proxied because a Storage path starts with the event's uuid,
// and ids never reach anything a person can see or copy. The RPC's own ids
// (event, host, tiers) are never printed either.
// ─────────────────────────────────────────────────────────────────────────────

// KEEP IN SYNC with js/config.js (see api/squad.mjs for why it's copied).
// Publishable anon key — never a service key.
const SUPABASE_URL = 'https://zrnoioagjnmetnzwneks.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpybm9pb2Fnam5tZXRuenduZWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjIwNDgsImV4cCI6MjA5NTg5ODA0OH0.D-2Lvvs2lxVG7fGWGcFBBGpBOSrHSw-DT6m_D0o9g3U';

const REF_RE = /^[A-Za-z0-9_-]{22}$/;
const APP_STORE = 'https://apps.apple.com/in/app/pacr-run-training-splits/id6804190286';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=life.pacr.app';
const APP_STORE_ID = '6804190286';
const SITE = 'https://pacr.life';

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 22-char ref → uuid, or null. Same as decodeUserRef in js/ids.js. */
function decodeRef(ref) {
  if (!REF_RE.test(ref)) return null;
  const bin = Buffer.from(ref.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (bin.length !== 16) return null;
  const hex = bin.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function getEvent(id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_event`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ p_event_id: id }),
  });
  if (!r.ok) throw new Error(`get_event ${r.status}`);
  return r.json();
}

function notFound(res, type, body) {
  res.statusCode = 404;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'public, s-maxage=60');
  res.end(body);
}

async function poster(path, res) {
  if (!path) return notFound(res, 'text/plain', 'No poster');
  const sign = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/event-covers/${path.split('/').map(encodeURIComponent).join('/')}`,
    { method: 'POST', headers: HEADERS, body: JSON.stringify({ expiresIn: 120 }) },
  );
  const signed = sign.ok ? (await sign.json()).signedURL : null;
  if (!signed) return notFound(res, 'text/plain', 'No poster');
  const img = await fetch(`${SUPABASE_URL}/storage/v1${signed}`);
  if (!img.ok) return notFound(res, 'text/plain', 'No poster');
  res.statusCode = 200;
  res.setHeader('Content-Type', img.headers.get('content-type') || 'image/jpeg');
  // Short: a cancelled or re-scoped event should stop serving soon.
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  res.end(Buffer.from(await img.arrayBuffer()));
}

// ─── Labels (KEEP IN SYNC with src/services/events.ts in the app) ──────────

const KIND_LABEL = { run: 'Run', workshop: 'Workshop', social: 'Social' };

function kmLabel(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  const r = Math.round(km * 10) / 10;
  if (Math.abs(r - 21.1) < 0.05) return 'Half';
  if (Math.abs(r - 42.2) < 0.05) return 'Marathon';
  return `${Number.isInteger(r) ? r : r.toFixed(1)}K`;
}

const distancesLabel = (km, kind) => {
  const list = (Array.isArray(km) ? km : []).map(Number).filter(n => n > 0);
  return list.length ? list.map(kmLabel).join(' · ') : (KIND_LABEL[kind] ?? 'Event');
};

function money(minor) {
  if (!minor) return 'Free';
  const r = minor / 100;
  return '₹' + (Number.isInteger(r) ? r.toLocaleString('en-IN')
    : r.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}

/** "From ₹524" / "Free" — the cheapest tier, fee included, as the app's grid. */
function priceLine(tiers) {
  const prices = (tiers ?? []).map(t => (Number(t.price_minor) || 0) + (Number(t.fee_minor) || 0));
  if (!prices.length) return null;
  const min = Math.min(...prices), max = Math.max(...prices);
  return min === max ? money(min) : `From ${money(min)}`;
}

function zoneOf(tz) {
  try { new Intl.DateTimeFormat('en-IN', { timeZone: tz }); return tz; } catch { return 'Asia/Kolkata'; }
}

/** "Sat 15 Nov 2026 · 6:00 am – 9:00 am", in the event's own time zone. */
function whenLine(startsAt, endsAt, tz) {
  if (!startsAt) return '';
  const timeZone = zoneOf(tz || 'Asia/Kolkata');
  const day = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
  const s = new Date(startsAt), e = endsAt ? new Date(endsAt) : null;
  const sameDay = e && day.format(s) === day.format(e);
  const tail = e ? ` – ${sameDay ? '' : `${day.format(e)}, `}${time.format(e)}` : '';
  return `${day.format(s)} · ${time.format(s)}${tail}`;
}

function render({ ev, ref }) {
  const shareUrl = `${SITE}/e/${ref}`;
  const deep = `pacr://e/${ref}`;
  const ended = ev && (ev.status === 'ended'
    || new Date(ev.ends_at || ev.starts_at).getTime() < Date.now());
  const cancelled = ev && (ev.status === 'cancelled' || ev.cancelled_at);
  const when = ev ? whenLine(ev.starts_at, ev.ends_at, ev.timezone) : '';
  const dists = ev ? distancesLabel(ev.distances_km, ev.kind) : '';
  const price = ev ? priceLine(ev.tiers) : null;
  const host = ev?.host ?? null;
  const going = Number(ev?.going_count) || 0;
  const posterUrl = ev?.cover_path
    ? `/e/${ref}/poster?v=${encodeURIComponent(String(ev.cover_path).split('/').pop().replace(/\.\w+$/, ''))}`
    : null;

  const title = ev ? `${ev.title} — on PACR` : 'An event on PACR';
  const descr = ev
    ? [when, ev.place?.name, dists, price].filter(Boolean).join(' · ').slice(0, 200)
    : 'Open this link in the PACR app to see the event.';
  const ogImage = posterUrl ? `${SITE}${posterUrl}` : `${SITE}/og-image.png?v=3`;

  const eyebrow = cancelled ? 'Cancelled' : ended ? 'This event has ended' : 'An event on PACR';
  const hostName = host?.name ? esc(host.name) : null;
  const hostHtml = hostName && host.kind === 'squad' && host.is_public && host.slug
    ? `<a href="/s/${esc(host.slug)}">${hostName}</a>` : hostName;
  const maps = ev?.place && Number.isFinite(Number(ev.place.lat)) && Number.isFinite(Number(ev.place.lng))
    ? `https://www.google.com/maps/search/?api=1&query=${Number(ev.place.lat)},${Number(ev.place.lng)}`
    : null;

  const facts = ev ? [
    ['When', esc(when)],
    ev.place?.name ? ['Where', `${esc(ev.place.name)}${ev.place.address ? `<span class="sub">${esc(ev.place.address)}</span>` : ''}${maps ? `<a class="sub" href="${esc(maps)}" rel="noopener">Directions</a>` : ''}`] : null,
    ['Distance', esc(dists)],
    price ? ['Entry', esc(price)] : null,
  ].filter(Boolean) : [];

  const main = ev ? `
    <p class="eyebrow${cancelled ? ' warn' : ''}">${esc(eyebrow)}</p>
    <div class="ev">
      ${posterUrl ? `<div class="poster"><img src="${esc(posterUrl)}" alt="" width="400" height="600"></div>` : ''}
      <div class="info">
        <h1>${esc(ev.title)}</h1>
        ${hostHtml ? `<p class="host">Hosted by ${hostHtml}${host.verified ? ' <span class="tick" title="Verified">✓</span>' : ''}</p>` : ''}
        <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        ${going > 0 && !cancelled ? `<p class="small"><b>${going}</b> ${going === 1 ? 'runner' : 'runners'} going</p>` : ''}
        ${cancelled && ev.cancel_reason ? `<p class="body">${esc(ev.cancel_reason)}</p>` : ''}
      </div>
    </div>
    ${ev.description && !cancelled ? `<p class="body">${esc(ev.description)}</p>` : ''}
  ` : `
    <p class="eyebrow">Shared event</p>
    <h1>Open it in PACR</h1>
    <p class="body">This event is open to a squad's members, or it is no longer up. If you can see it, it opens in the app.</p>
  `;

  const ctaNote = !ev ? 'PACR is a running coach with squads, group runs and events near you.'
    : cancelled ? 'Find other runs, races and socials near you in the app.'
    : ended ? 'See what this host runs next, and other events near you, in the app.'
    : 'Get your spot, your check-in code and directions in the app.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(descr)}" />
<meta name="robots" content="noindex" />
<link rel="canonical" href="${esc(shareUrl)}" />
<meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}, app-argument=${esc(shareUrl)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="PACR" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(descr)}" />
<meta property="og:url" content="${esc(shareUrl)}" />
<meta property="og:image" content="${esc(ogImage)}" />
<meta name="twitter:card" content="summary_large_image" />
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
  main { max-width:720px; margin:0 auto; padding:64px 24px 96px; }
  .eyebrow { margin:0 0 18px; font-weight:700; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#8B8B80; }
  .eyebrow.warn { color:#B3261E; }
  h1 { margin:0; font-family:Outfit, sans-serif; font-weight:700; font-size:36px; line-height:1.08; letter-spacing:-0.02em; overflow-wrap:anywhere; }
  .ev { display:flex; gap:28px; align-items:flex-start; }
  .poster { flex:none; width:220px; aspect-ratio:2/3; border-radius:18px; overflow:hidden; background:#EAEAE2; }
  .poster img { width:100%; height:100%; object-fit:cover; display:block; }
  .info { flex:1; min-width:0; }
  .host { margin:10px 0 0; font-size:15px; font-weight:600; color:#5C5C55; }
  .host a { color:#0F0F0D; }
  .tick { display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:999px;
    background:#E8FF3A; color:#0A0A09; font-size:11px; font-weight:800; vertical-align:1px; }
  .facts { margin:22px 0 0; display:grid; gap:14px; }
  .facts div { margin:0; }
  .facts dt { font-weight:700; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:#8B8B80; }
  .facts dd { margin:4px 0 0; font-weight:700; font-size:16px; line-height:1.4; }
  .facts .sub { display:block; font-weight:500; font-size:14px; color:#5C5C55; }
  .facts a.sub { color:#5A6B00; font-weight:700; margin-top:2px; }
  .body { margin:24px 0 0; font-size:17px; line-height:1.55; color:#2A2A26; white-space:pre-line; overflow-wrap:anywhere; }
  .small { margin:18px 0 0; font-size:14px; color:#8B8B80; }
  .small b { color:#0F0F0D; }
  .cta { margin-top:44px; padding:28px; border-radius:28px; background:#0F0F0D; color:#FFFFFF; }
  .cta p { margin:0; font-size:15px; line-height:1.5; color:#D9D9CF; }
  .open { margin-top:18px; display:flex; align-items:center; justify-content:center; height:56px; border-radius:999px;
    background:#E8FF3A; color:#0A0A09; font-family:Outfit, sans-serif; font-weight:700; font-size:18px; }
  .open:hover { color:#0A0A09; filter:brightness(0.95); }
  .stores { margin-top:16px; display:flex; gap:10px; flex-wrap:wrap; font-weight:600; font-size:13px; }
  .stores a { flex:1; min-width:150px; text-align:center; padding:12px; border-radius:999px; border:1px solid #3A3A35; color:#FFFFFF; }
  .desk { display:none; margin-top:14px; font-size:13px; color:#B9B9AE; }
  @media (hover:hover) and (pointer:fine) { .desk { display:block; } }
  @media (max-width:560px) {
    main { padding-top:32px; }
    h1 { font-size:28px; }
    .ev { flex-direction:column; gap:20px; }
    .poster { width:min(240px, 64vw); }
  }
</style>
<script src="/js/posthog.js"></script>
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
  ${main}
  <section class="cta">
    <p>${ctaNote}</p>
    <a class="open" id="open" href="${esc(deep)}" data-path="${esc(deep.slice('pacr://'.length))}">Open in PACR</a>
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
  // Android: intent:// opens PACR when installed and falls back to the Play
  // Store when not — a bare pacr:// link does nothing there. See api/squad.mjs.
  (function () {
    var a = document.getElementById('open');
    if (!a || !/Android/i.test(navigator.userAgent)) return;
    a.href = 'intent://' + a.getAttribute('data-path')
      + '#Intent;scheme=pacr;package=life.pacr.app;S.browser_fallback_url='
      + encodeURIComponent('${PLAY_STORE}') + ';end';
  })();
</script>
</body>
</html>`;
}

export default async function handler(req, res) {
  const url = new URL(req.url, SITE);
  const ref = String(req.query?.ref ?? url.searchParams.get('ref') ?? '');
  const part = String(req.query?.part ?? url.searchParams.get('part') ?? '');
  const id = decodeRef(ref);

  if (!id) {
    return notFound(res, 'text/html; charset=utf-8', render({ ev: null, ref: 'event' }));
  }

  let ev = null;
  try {
    ev = await getEvent(id);
  } catch {
    // Render the "open it in PACR" shape; the button still works.
  }

  if (part === 'poster') return poster(ev?.cover_path, res);

  // A squad-only event is a 200 too: the link is fine, the web just can't
  // show it. Only a malformed ref is a 404.
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Short edge cache so a cancelled or edited event shows within minutes.
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(render({ ev, ref }));
}
