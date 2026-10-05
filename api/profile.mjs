// ─────────────────────────────────────────────────────────────────────────────
// pacr.life/u/<handle> — a runner's profile link (the app's Profile → Share).
//
// Server-rendered for the same reason as /s/<slug> (api/squad.mjs): link
// previews read og:title / og:image from the HTML and never run JavaScript.
//
//   /u/<handle>         the runner's card, "Open in PACR"
//   /u/<handle>/photo   their picture, proxied
//
// Data comes from get_profile_card (migration 20261012120000 in the app repo)
// as anon: name, @handle, photo, bio, tags, location and follower count, for
// any runner who has picked a handle — that is the opt-in. Runs and stats stay
// in the app with their squads. Following happens in the app.
//
// The photo is proxied because a signed Storage URL embeds the runner's uuid,
// and ids never reach anything a person can see or copy.
//
// Unknown handle and a cleared one render the same page, so the page says no
// more than "nobody here".
// ─────────────────────────────────────────────────────────────────────────────

// KEEP IN SYNC with js/config.js (see api/squad.mjs for why it's copied).
// Publishable anon key — never a service key.
const SUPABASE_URL = 'https://zrnoioagjnmetnzwneks.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpybm9pb2Fnam5tZXRuenduZWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjIwNDgsImV4cCI6MjA5NTg5ODA0OH0.D-2Lvvs2lxVG7fGWGcFBBGpBOSrHSw-DT6m_D0o9g3U';

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
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

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function card(handle) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_profile_card`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ p_handle: handle }),
  });
  if (!r.ok) throw new Error(`get_profile_card ${r.status}`);
  return r.json();
}

async function photo(handle, res) {
  const runner = await card(handle).catch(() => null);
  if (!runner?.avatar_path) return notFound(res, 'text/plain', 'No photo');
  const sign = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/avatars/${runner.avatar_path.split('/').map(encodeURIComponent).join('/')}`,
    { method: 'POST', headers: HEADERS, body: JSON.stringify({ expiresIn: 120 }) },
  );
  const signed = sign.ok ? (await sign.json()).signedURL : null;
  if (!signed) return notFound(res, 'text/plain', 'No photo');
  const img = await fetch(`${SUPABASE_URL}/storage/v1${signed}`);
  if (!img.ok) return notFound(res, 'text/plain', 'No photo');
  res.statusCode = 200;
  res.setHeader('Content-Type', img.headers.get('content-type') || 'image/jpeg');
  // Short: a runner who changes or removes their photo should see it go.
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
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

const count = n => {
  const v = Number(n) || 0;
  return v >= 10000 ? `${(v / 1000).toFixed(0)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
};

function render({ runner, handle }) {
  const shareUrl = `${SITE}/u/${handle}`;
  const deep = `pacr://u/${handle}`;
  const name = runner?.display_name ?? null;
  const title = runner ? `${name} (@${runner.handle}) on PACR` : 'Runner not found — PACR';
  const followers = Number(runner?.follower_count) || 0;
  const descr = runner
    ? [runner.bio, runner.location, `${count(followers)} ${followers === 1 ? 'follower' : 'followers'}`]
      .filter(Boolean).join(' · ')
    : 'This profile link may be old — the runner might have changed their handle.';
  const ogImage = runner?.avatar_path ? `${SITE}/u/${handle}/photo` : `${SITE}/og-image.png`;
  const tags = Array.isArray(runner?.bio_tags) ? runner.bio_tags : [];
  const joined = runner?.joined_at ? new Date(runner.joined_at) : null;

  const tile = runner?.avatar_path
    ? `<img src="/u/${esc(handle)}/photo" alt="" width="96" height="96">`
    : esc(initials(name ?? 'PACR'));

  const body = runner ? `
    <p class="eyebrow">A runner on PACR</p>
    <div class="hero">
      <div class="tile">${tile}</div>
      <div>
        <h1>${esc(name)}</h1>
        <p class="meta">@${esc(runner.handle)}${runner.location ? ` · ${esc(runner.location)}` : ''}</p>
      </div>
    </div>
    ${runner.bio ? `<p class="about">${esc(runner.bio)}</p>` : ''}
    ${tags.length ? `<ul class="tags">${tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <p class="small"><b>${esc(count(followers))}</b> ${followers === 1 ? 'follower' : 'followers'}${joined ? ` · running with PACR since ${MON[joined.getUTCMonth()]} ${joined.getUTCFullYear()}` : ''}</p>
  ` : `
    <p class="eyebrow">Profile link</p>
    <h1>Runner not found</h1>
    <p class="about">This profile link may be old — the runner might have changed their handle.</p>
  `;

  const ctaNote = runner
    ? `Follow ${esc(name.trim().split(/\s+/)[0] || name)} in the app to see the runs they share.`
    : 'PACR is a running coach with squads, group runs and weekly goals.';

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
<meta property="og:type" content="profile" />
<meta property="og:site_name" content="PACR" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(descr)}" />
<meta property="og:url" content="${esc(shareUrl)}" />
<meta property="og:image" content="${esc(ogImage)}" />
<meta name="twitter:card" content="${runner?.avatar_path ? 'summary' : 'summary_large_image'}" />
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
  h1 { margin:0; font-family:Outfit, sans-serif; font-weight:700; font-size:40px; line-height:1.05; letter-spacing:-0.02em; overflow-wrap:anywhere; }
  .hero { display:flex; align-items:center; gap:20px; }
  .tile { flex:none; width:96px; height:96px; border-radius:999px; background:#E8FF3A; overflow:hidden;
    display:flex; align-items:center; justify-content:center; font-family:Outfit, sans-serif; font-weight:700; font-size:32px; }
  .tile img { width:100%; height:100%; object-fit:cover; display:block; }
  .meta { margin:8px 0 0; font-size:15px; font-weight:600; color:#5C5C54; overflow-wrap:anywhere; }
  .about { margin:24px 0 0; font-size:17px; line-height:1.55; color:#2A2A26; }
  .tags { list-style:none; margin:16px 0 0; padding:0; display:flex; flex-wrap:wrap; gap:8px; }
  .tags li { padding:6px 12px; border-radius:999px; background:#F2F2EC; font-weight:700; font-size:13px; }
  .small { margin:24px 0 0; font-size:14px; color:#8B8B80; }
  .small b { color:#0F0F0D; font-family:Outfit, sans-serif; font-size:16px; }
  .cta { margin-top:44px; padding:28px; border-radius:28px; background:#0F0F0D; color:#FFFFFF; }
  .cta p { margin:0; font-size:15px; line-height:1.5; color:#D9D9CF; }
  .open { margin-top:18px; display:flex; align-items:center; justify-content:center; height:56px; border-radius:999px;
    background:#E8FF3A; color:#0A0A09; font-family:Outfit, sans-serif; font-weight:700; font-size:18px; }
  .open:hover { color:#0A0A09; filter:brightness(0.95); }
  .stores { margin-top:16px; display:flex; gap:10px; flex-wrap:wrap; font-weight:600; font-size:13px; }
  .stores a { flex:1; min-width:150px; text-align:center; padding:12px; border-radius:999px; border:1px solid #3A3A35; color:#FFFFFF; }
  .desk { display:none; margin-top:14px; font-size:13px; color:#B9B9AE; }
  @media (hover:hover) and (pointer:fine) { .desk { display:block; } }
  @media (max-width:560px) { h1 { font-size:30px; } main { padding-top:40px; } .tile { width:76px; height:76px; font-size:26px; } }
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
    ${runner ? `<a class="open" id="open" href="${esc(deep)}" data-path="${esc(deep.slice('pacr://'.length))}">Open in PACR</a>` : ''}
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
  const handle = String(req.query?.handle ?? url.searchParams.get('handle') ?? '').replace(/^@/, '').toLowerCase();
  const wantsPhoto = (req.query?.photo ?? url.searchParams.get('photo')) === '1';

  if (!HANDLE_RE.test(handle)) {
    return notFound(res, 'text/html; charset=utf-8', render({ runner: null, handle: 'runner' }));
  }
  if (wantsPhoto) return photo(handle, res);

  let runner = null;
  try {
    runner = await card(handle);
  } catch {
    // Render the not-found shape; the stores row still works.
  }

  res.statusCode = runner ? 200 : 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Short edge cache so an edited bio or a cleared handle shows within minutes.
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(render({ runner, handle }));
}
