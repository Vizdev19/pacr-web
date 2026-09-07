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
// This page is GATED, not a sign-in host: a visitor without a session is sent
// to /signin?next=/feed and comes back here. The flow itself lives in auth.js,
// which also mounts the header's session-aware Sign in / Sign out control and
// listens for a session going away in another tab.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase, esc, initials, signedUrlsFor } from './supabase.js';
import { mountHeaderAuth, signinHref } from './auth.js';

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
  $('paneFeed').hidden = false;

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

export async function initFeed() {
  sb = await getSupabase();

  // The gate is uniform: this page renders only with a confirmed session, and
  // every other outcome goes to /signin. A missing client is one of those
  // outcomes — we cannot tell a signed-in visitor from a signed-out one, we
  // cannot load posts either way, and stopping here with a red line and no
  // link was a dead end with no way forward. /signin says plainly whether the
  // problem is you or us.
  // replace(), not assign(): nobody should be able to press Back into a feed
  // they cannot see.
  const user = sb ? (await sb.auth.getSession()).data?.session?.user : null;
  if (!user) {
    location.replace(signinHref('/feed'));
    return;
  }

  me = user;
  // signOutTo sends this tab home the moment the session ends — including when
  // it ends in another tab — so the feed is never left on screen without one.
  mountHeaderAuth($('authSlot'), { className: 'btn-quiet', signOutTo: '/' });
  await showFeed();
}
