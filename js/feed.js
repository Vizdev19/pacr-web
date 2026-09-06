// ─────────────────────────────────────────────────────────────────────────────
// /feed — the signed-in squad feed
//
// This is the one place on the site that needs a real identity. It works
// because every RLS policy in the app project keys off auth.uid() rather than a
// role: a signed-in browser is indistinguishable from the app as far as
// Postgres is concerned, so this page needed no schema change at all.
//
// That also means moderation is free and cannot be bypassed here. The
// posts_select_members policy (20260826140000_moderation.sql) already filters
// blocked authors, content the viewer reported, and auto-hidden posts. This
// client does nothing special and receives exactly the right rows — a bug in
// this file can hide a post, never leak one.
//
// READ-ONLY, deliberately. Posting, liking, commenting, reporting and blocking
// stay in the app: those are the flows App Review was shown, and a second
// half-built moderation surface is worse than none.
//
// Auth mirrors pacr/src/services/supabase.ts: a 6-digit email OTP, verified
// with type 'email'. shouldCreateUser is false — the website must never mint an
// identity, only recognise one the app already made.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase, esc, initials, signedUrlsFor } from './supabase.js';

const PAGE_SIZE = 20;
const PINNED_LIMIT = 5;

const $ = (id) => document.getElementById(id);

let sb = null;
let me = null;
let squads = [];
let activeSquad = null;
let cursor = null;
let loading = false;

// ─── Mentions ───────────────────────────────────────────────────────────────
// Ported from pacr/src/utils/mentions.ts. A raw user id must NEVER reach the
// screen, so the loose pattern catches any token the strict one rejected (a
// truncated id, a body from an older client) and still renders a plain @Name.
const MENTION_RE =
  /@\[([^\]\n]{1,32})\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/g;
const LOOSE_TOKEN_RE = /@\[([^\]\n]{1,64})\]\(([^)\s]{0,80})\)/g;

function renderBody(body) {
  if (!body) return '';
  // Escape FIRST, then swap tokens for markup, so nothing in a post body can
  // introduce a tag. The regexes only ever match text we just escaped.
  let html = esc(body);
  html = html.replace(MENTION_RE, (_m, name) => `<span class="mention">@${name}</span>`);
  html = html.replace(LOOSE_TOKEN_RE, (_m, name) => `<span class="mention">@${name}</span>`);
  return html;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function msg(el, text, kind) {
  if (!text) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = text;
  el.className = `msg ${kind ?? ''}`.trim();
}

// ─── Auth ───────────────────────────────────────────────────────────────────
// Error classification ported from pacr/src/services/supabase.ts so the copy
// reads like a sentence instead of a Supabase error string.

function sendErrorText(m) {
  const s = (m ?? '').toLowerCase();
  if (s.includes('rate') || s.includes('too many')) {
    return 'Too many codes requested. Wait a minute, then try again.';
  }
  if (s.includes('signups not allowed') || s.includes('not found')) {
    return "No PACR account uses that email. Accounts are made in the app.";
  }
  if (s.includes('invalid') && s.includes('email')) return 'That email address looks wrong.';
  return "Couldn't send the code. Try again in a moment.";
}

function verifyErrorText(m) {
  const s = (m ?? '').toLowerCase();
  if (s.includes('rate') || s.includes('too many')) {
    return 'Too many attempts. Wait a minute, then try again.';
  }
  if (s.includes('expired') || s.includes('invalid') || s.includes('token')) {
    return 'That code is wrong or has expired.';
  }
  return "Couldn't sign you in. Try again in a moment.";
}

function wireAuth() {
  const formEmail = $('formEmail');
  const formCode = $('formCode');
  const authMsg = $('authMsg');
  let pendingEmail = '';

  formEmail.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('email').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return msg(authMsg, 'Enter a valid email address.', 'err');
    }
    const btn = $('sendBtn');
    btn.disabled = true;
    msg(authMsg, 'Sending…');
    // shouldCreateUser:false — a stranger must not be able to create an
    // account from the marketing site.
    const { error } = await sb.auth.signInWithOtp({
      email, options: { shouldCreateUser: false },
    });
    btn.disabled = false;
    if (error) return msg(authMsg, sendErrorText(error.message), 'err');

    pendingEmail = email;
    $('codeEmail').textContent = email;
    formEmail.hidden = true;
    formCode.hidden = false;
    msg(authMsg, 'Code sent. It expires in an hour.', 'ok');
    $('code').focus();
  });

  formCode.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = $('code').value.trim();
    if (!/^\d{6}$/.test(token)) return msg(authMsg, 'Enter the six digits from the email.', 'err');

    const btn = $('verifyBtn');
    btn.disabled = true;
    msg(authMsg, 'Checking…');
    const { data, error } = await sb.auth.verifyOtp({
      email: pendingEmail, token, type: 'email',
    });
    btn.disabled = false;
    if (error || !data?.user) return msg(authMsg, verifyErrorText(error?.message), 'err');

    msg(authMsg, '');
    me = data.user;
    await showFeed();
  });

  $('backBtn').addEventListener('click', () => {
    formCode.hidden = true;
    formEmail.hidden = false;
    $('code').value = '';
    msg(authMsg, '');
    $('email').focus();
  });

  $('signOut').addEventListener('click', async () => {
    await sb.auth.signOut();
    location.reload();
  });
}

// ─── Squads ─────────────────────────────────────────────────────────────────

// Ported from listMySquads() in pacr/src/services/squads.ts — memberships
// filtered to me, circles embedded, ordered by joined_at so the chips keep a
// stable order between visits.
async function loadSquads() {
  const { data, error } = await sb
    .from('memberships')
    .select('circle_id, role, circles(id, name)')
    .eq('user_id', me.id)
    .order('joined_at', { ascending: true });
  if (error) return [];
  return (data ?? [])
    .filter(r => r.circles)
    .map(r => ({ id: r.circles.id, name: r.circles.name, role: r.role }));
}

function paintChips() {
  const host = $('squadChips');
  if (squads.length < 2) { host.hidden = true; return; }
  host.hidden = false;
  host.innerHTML = squads
    .map(s => `<button type="button" class="chip" data-id="${esc(s.id)}" aria-pressed="${s.id === activeSquad.id}">${esc(s.name)}</button>`)
    .join('');
}

// ─── Posts ──────────────────────────────────────────────────────────────────

// The author embed MUST name its foreign key. post_likes and post_comments each
// carry FKs to both posts and users, so PostgREST sees three possible
// posts→users paths and a bare users(...) fails the whole request with PGRST201.
// Kept identical to POST_SELECT in pacr/src/services/feed.ts.
const POST_SELECT =
  'id, circle_id, author_id, kind, body, image_path, pinned, hidden_at, created_at, ' +
  'author:users!posts_author_id_fkey(display_name), ' +
  'post_likes(count), post_comments(count)';

function postHtml(row, urlByPath) {
  const name = row.author?.display_name ?? '—';
  const img = row.image_path ? urlByPath.get(row.image_path) : null;
  const likes = Number(row.post_likes?.[0]?.count) || 0;
  const comments = Number(row.post_comments?.[0]?.count) || 0;
  return `
    <article class="post">
      <div class="post-top">
        <div class="avatar">${esc(initials(name))}</div>
        <div style="flex:1; min-width:0;">
          <div class="author">${esc(name)}</div>
          <div class="when">${esc(timeAgo(row.created_at))}</div>
        </div>
        ${row.pinned ? '<span class="pill">Pinned</span>' : ''}
      </div>
      ${row.body ? `<p class="body">${renderBody(row.body)}</p>` : ''}
      ${img ? `<img class="post-img" src="${esc(img)}" alt="" loading="lazy">` : ''}
      <div class="counts">
        <span>${likes} ${likes === 1 ? 'like' : 'likes'}</span>
        <span>${comments} ${comments === 1 ? 'comment' : 'comments'}</span>
      </div>
    </article>`;
}

async function hydrate(rows) {
  const paths = rows.map(r => r.image_path).filter(Boolean);
  const urlByPath = await signedUrlsFor(sb, 'post-images', paths);
  return rows.map(r => postHtml(r, urlByPath)).join('');
}

async function loadPage({ reset }) {
  if (loading) return;
  loading = true;
  const host = $('posts');
  const more = $('moreBtn');
  const feedMsg = $('feedMsg');
  more.hidden = true;

  if (reset) {
    cursor = null;
    host.innerHTML = '<div class="skel"><div style="width:55%"></div></div>';
    msg(feedMsg, '');
  }

  let html = '';

  // Pinned posts ride above the keyset list, and are excluded from it, so the
  // cursor never has to reason about them — same split as the app.
  if (reset) {
    const { data: pinned } = await sb
      .from('posts').select(POST_SELECT)
      .eq('circle_id', activeSquad.id).eq('pinned', true)
      .order('created_at', { ascending: false })
      .limit(PINNED_LIMIT);
    if (pinned?.length) html += await hydrate(pinned);
  }

  let q = sb
    .from('posts').select(POST_SELECT)
    .eq('circle_id', activeSquad.id).eq('pinned', false)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) {
    // Keyset: strictly older, with id as the tiebreak inside one timestamp.
    q = q.or(
      `created_at.lt."${cursor.createdAt}",` +
      `and(created_at.eq."${cursor.createdAt}",id.lt."${cursor.id}")`,
    );
  }

  const { data, error } = await q;
  loading = false;

  if (error) {
    if (reset) host.innerHTML = '';
    return msg(feedMsg, "Couldn't load the feed. Refresh to try again.", 'err');
  }

  const rows = data ?? [];
  html += await hydrate(rows);

  if (reset) host.innerHTML = html; else host.insertAdjacentHTML('beforeend', html);

  const last = rows[rows.length - 1];
  cursor = rows.length === PAGE_SIZE && last
    ? { createdAt: last.created_at, id: last.id }
    : null;
  more.hidden = !cursor;

  if (reset && host.innerHTML === '') {
    msg(feedMsg, 'No posts in this squad yet. Be the first — post a run from the app.');
  }
}

// ─── Wiring ─────────────────────────────────────────────────────────────────

async function showFeed() {
  $('paneBoot').hidden = true;
  $('paneAuth').hidden = true;
  $('paneFeed').hidden = false;
  $('signOut').hidden = false;

  squads = await loadSquads();
  if (squads.length === 0) {
    $('feedTitle').textContent = 'No squad yet';
    $('squadChips').hidden = true;
    $('posts').innerHTML = '';
    return msg($('feedMsg'),
      'You are not in a squad yet. Join or create one in the app and it will show up here.');
  }

  activeSquad = squads[0];
  $('feedTitle').textContent = squads.length > 1 ? 'Your feed' : activeSquad.name;
  paintChips();

  $('squadChips').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn || btn.dataset.id === activeSquad.id) return;
    activeSquad = squads.find(s => s.id === btn.dataset.id) ?? activeSquad;
    paintChips();
    await loadPage({ reset: true });
  });

  $('moreBtn').addEventListener('click', () => loadPage({ reset: false }));

  await loadPage({ reset: true });
}

function showAuth() {
  $('paneBoot').hidden = true;
  $('paneFeed').hidden = true;
  $('signOut').hidden = true;
  $('paneAuth').hidden = false;
}

export async function initFeed() {
  sb = await getSupabase();
  if (!sb) {
    $('paneBoot').innerHTML =
      '<p class="msg err">The feed is unavailable right now. Please try again later.</p>';
    return;
  }
  wireAuth();

  const { data } = await sb.auth.getSession();
  if (data?.session?.user) {
    me = data.session.user;
    await showFeed();
  } else {
    showAuth();
  }
}
