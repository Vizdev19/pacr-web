// ─────────────────────────────────────────────────────────────────────────────
// pacr.life/p/<ref> — a shared Feed post (the app's share button on a post).
//
// Server-rendered for the same reason as /s/<slug> (api/squad.mjs): link
// previews read og:title / og:image from the HTML and never run JavaScript.
//
//   /p/<ref>          the post, "Open in PACR"
//   /p/<ref>/photo    the post's photo, proxied
//   /p/<ref>/avatar   the author's picture, proxied
//
// <ref> is the post uuid base64url-encoded to 22 characters (js/ids.js) — a
// shape, never access control. Data comes from get_post_card (migration
// 20261013120000 in the app repo) as anon, and it answers only for PUBLIC
// posts: author, title, text, run numbers, photo, counts. Squad and
// followers posts, deleted, hidden and unknown ones all come back null and
// render the same "open it in PACR" page, so the page never says which.
// In the app, post-detail asks RLS as it always has.
//
// Photos are proxied because a signed Storage URL embeds the author's uuid,
// and ids never reach anything a person can see or copy. Run cards are never
// served (the RPC withholds their path) — they are a picture of a route.
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

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 22-char ref → uuid, or null. Same as decodeUserRef in js/ids.js. */
function decodeRef(ref) {
  if (!REF_RE.test(ref)) return null;
  const bin = Buffer.from(ref.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (bin.length !== 16) return null;
  const hex = bin.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function card(id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_post_card`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ p_post_id: id }),
  });
  if (!r.ok) throw new Error(`get_post_card ${r.status}`);
  return r.json();
}

async function proxy(bucket, path, res) {
  if (!path) return notFound(res, 'text/plain', 'No photo');
  const sign = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`,
    { method: 'POST', headers: HEADERS, body: JSON.stringify({ expiresIn: 120 }) },
  );
  const signed = sign.ok ? (await sign.json()).signedURL : null;
  if (!signed) return notFound(res, 'text/plain', 'No photo');
  const img = await fetch(`${SUPABASE_URL}/storage/v1${signed}`);
  if (!img.ok) return notFound(res, 'text/plain', 'No photo');
  res.statusCode = 200;
  res.setHeader('Content-Type', img.headers.get('content-type') || 'image/jpeg');
  // Short: a post made private or deleted should stop serving soon.
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

const clock = sec => {
  const s = Math.round(Number(sec) || 0);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

// Belt and braces: the RPC already flattens "@[Name](uuid)" to "@Name".
const flatten = body => String(body ?? '').replace(/@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)/g, '@$1');

function stats(run) {
  if (!run || !(Number(run.distance_km) > 0)) return null;
  const km = Number(run.distance_km);
  const pace = Number(run.pace_sec_per_km) > 0 ? Number(run.pace_sec_per_km)
    : Number(run.duration_sec) > 0 ? Number(run.duration_sec) / km : 0;
  return [
    ['Distance', `${km.toFixed(2)} km`],
    Number(run.duration_sec) > 0 ? ['Time', clock(run.duration_sec)] : null,
    pace > 0 ? ['Pace', `${clock(pace)} /km`] : null,
  ].filter(Boolean);
}

function render({ post, ref }) {
  const shareUrl = `${SITE}/p/${ref}`;
  const deep = `pacr://p/${ref}`;
  const name = post?.author_name ?? 'A runner';
  const first = name.trim().split(/\s+/)[0] || name;
  const body = post ? flatten(post.body).trim() : '';
  const run = stats(post?.run);
  const headline = post
    ? (post.title || (run ? `${run[0][1]} run` : post.kind === 'photo' ? 'A photo' : 'A post'))
    : null;
  const title = post ? `${headline} — ${name} on PACR` : 'A post on PACR';
  const descr = post
    ? ([run?.map(([, v]) => v).join(' · '), body].filter(Boolean).join(' — ').slice(0, 200) || `${name} on PACR`)
    : 'Open this link in the PACR app to see the post.';
  const ogImage = post?.image_path ? `${SITE}/p/${ref}/photo`
    : post?.author_avatar_path ? `${SITE}/p/${ref}/avatar` : `${SITE}/og-image.png`;
  const when = post?.created_at ? new Date(post.created_at) : null;
  const likes = Number(post?.like_count) || 0;
  const comments = Number(post?.comment_count) || 0;

  const tile = post?.author_avatar_path
    ? `<img src="/p/${esc(ref)}/avatar" alt="" width="44" height="44">`
    : esc(initials(name));
  const who = post?.author_handle
    ? `<a href="/u/${esc(post.author_handle)}">${esc(name)}</a>`
    : esc(name);

  const main = post ? `
    <p class="eyebrow">A post on PACR</p>
    <article class="post">
      <div class="by">
        <div class="tile">${tile}</div>
        <div>
          <p class="name">${who}</p>
          <p class="meta">${post.author_handle ? `@${esc(post.author_handle)} · ` : ''}${when ? `${when.getUTCDate()} ${MON[when.getUTCMonth()]} ${when.getUTCFullYear()}` : ''}</p>
        </div>
      </div>
      <h1>${esc(headline)}${post.badge ? ` <span class="badge">${esc(post.badge)}</span>` : ''}</h1>
      ${run ? `<dl class="stats">${run.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      ${body ? `<p class="body">${esc(body)}</p>` : ''}
      ${post.image_path ? `<div class="media"><img src="/p/${esc(ref)}/photo" alt=""></div>` : ''}
      <p class="small"><b>${esc(count(likes))}</b> kudos · <b>${esc(count(comments))}</b> ${comments === 1 ? 'comment' : 'comments'}</p>
    </article>
  ` : `
    <p class="eyebrow">Shared post</p>
    <h1>Open it in PACR</h1>
    <p class="body">This post is shared with a squad or the runner's followers, or it is no longer up. If you can see it, it opens in the app.</p>
  `;

  const ctaNote = post
    ? `Give ${esc(first)} kudos, comment and follow along in the app.`
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
<meta property="og:type" content="article" />
<meta property="og:site_name" content="PACR" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(descr)}" />
<meta property="og:url" content="${esc(shareUrl)}" />
<meta property="og:image" content="${esc(ogImage)}" />
<meta name="twitter:card" content="${post?.image_path ? 'summary_large_image' : post?.author_avatar_path ? 'summary' : 'summary_large_image'}" />
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
  h1 { margin:20px 0 0; font-family:Outfit, sans-serif; font-weight:700; font-size:36px; line-height:1.08; letter-spacing:-0.02em; overflow-wrap:anywhere; }
  .badge { display:inline-block; vertical-align:middle; margin-left:6px; padding:4px 10px; border-radius:999px; background:#E8FF3A; font-size:13px; letter-spacing:0; }
  .by { display:flex; align-items:center; gap:12px; }
  .tile { flex:none; width:44px; height:44px; border-radius:999px; background:#E8FF3A; overflow:hidden;
    display:flex; align-items:center; justify-content:center; font-family:Outfit, sans-serif; font-weight:700; font-size:16px; }
  .tile img { width:100%; height:100%; object-fit:cover; display:block; }
  .name { margin:0; font-weight:700; font-size:16px; }
  .name a { color:#0F0F0D; }
  .meta { margin:2px 0 0; font-size:13px; font-weight:600; color:#8B8B80; }
  .stats { margin:22px 0 0; display:flex; gap:28px; flex-wrap:wrap; }
  .stats div { margin:0; }
  .stats dt { font-weight:700; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:#8B8B80; }
  .stats dd { margin:4px 0 0; font-family:Outfit, sans-serif; font-weight:700; font-size:26px; }
  .body { margin:22px 0 0; font-size:17px; line-height:1.55; color:#2A2A26; white-space:pre-line; overflow-wrap:anywhere; }
  .media { margin-top:22px; border-radius:24px; overflow:hidden; background:#EAEAE2; display:flex; justify-content:center; }
  .media img { display:block; max-width:100%; max-height:min(560px,62vh); width:auto; height:auto; }
  .small { margin:20px 0 0; font-size:14px; color:#8B8B80; }
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
  @media (max-width:560px) { h1 { font-size:28px; } main { padding-top:40px; } .stats dd { font-size:22px; } .media img { max-height:min(420px,54vh); } }
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
    return notFound(res, 'text/html; charset=utf-8', render({ post: null, ref: 'post' }));
  }

  let post = null;
  try {
    post = await card(id);
  } catch {
    // Render the "open it in PACR" shape; the button still works.
  }

  if (part === 'photo') return proxy('post-images', post?.image_path, res);
  if (part === 'avatar') return proxy('avatars', post?.author_avatar_path, res);

  // A squad or followers post is a 200 too: the link is fine, the web just
  // can't show it. Only a malformed ref is a 404.
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Short edge cache so a deleted or re-scoped post goes within minutes.
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(render({ post, ref }));
}
