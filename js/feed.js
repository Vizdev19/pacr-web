// ─────────────────────────────────────────────────────────────────────────────
// /feed — the signed-in squad feed
//
// This page needs a real identity, and it works because every RLS policy in the
// app project keys off auth.uid() rather than a role: a signed-in browser is
// indistinguishable from the app as far as Postgres is concerned, so reaching
// parity with the app's feed needed no schema change at all.
//
// That also means moderation is free and cannot be bypassed here. The
// posts_select_members policy (20260826140000_moderation.sql) already filters
// blocked authors, content the viewer reported, and auto-hidden posts. This
// client does nothing special and receives exactly the right rows — a bug in
// this file can hide a post, never leak one. Writes are gated the same way:
// can_post_in_circle() decides posting, enforce_content_filter() rejects
// blocked terms, and auto_hide_reported_content() acts on reports. The checks
// mirrored client-side exist only so the UI can explain a refusal.
//
// What is deliberately NOT here: posting a run card. The app rasterizes that
// card on device from the route trace, and the trace never leaves the phone —
// it is not in run_summaries, so the browser cannot draw it. Run posts made in
// the app render here (now with real stats, via the run_summaries embed); they
// are just not composed here.
//
// This page is GATED, not a sign-in host: a visitor without a session is sent
// to /signin?next=/feed and comes back here. The flow itself lives in auth.js,
// which also mounts the header's session-aware control and listens for a
// session going away in another tab.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase, esc, initials, signedUrlsFor } from './supabase.js';
import { mountHeaderAuth, signinHref } from './auth.js';
import {
  renderBody, activeMentionQuery, insertMention, serializeMentions,
  countPlainMentions, MAX_MENTIONS_PER_BODY,
} from './mentions.js';
import { findBlockedTerm, BLOCKED_CONTENT_MESSAGE } from './content-filter.js';
import {
  POST_SELECT, MAX_BODY, MAX_COMMENT,
  createPost, downscaleImage,
  toggleLike, setPinned, deletePost,
  listComments, addComment, deleteComment, listMembers,
} from './feed-write.js';
import {
  REPORT_REASONS, reportContent, blockUser, hasAcceptedRules, acceptRules,
} from './moderation.js';
import {
  listFollowingIds, followUser, unfollowUser, listFollowingFeed,
  suggestedToFollow, listPublicFeed, muteUser, retractMyPosts,
} from './follow.js';

const PAGE_SIZE = 20;
const PINNED_LIMIT = 5;

const $ = (id) => document.getElementById(id);

let sb = null;
let me = null;
let squads = [];
let activeSquad = null;
let cursor = null;
let loading = false;

/** Rendered rows by post id, so an action can patch one card without a refetch. */
const postState = new Map();
/** Members of the active squad, for @-autocomplete. Refreshed on squad switch. */
let members = [];
/** null until checked; then true/false. Gates the first write of the session. */
let rulesOk = null;
/** The picked photo, downscaled and ready to upload. */
let pendingPhoto = null;

// ─── Following state ────────────────────────────────────────────────────────
/** 'squad' | 'following' | 'discover'. Squad is the default: it is the only tab
 *  guaranteed non-empty for a runner who has never followed anyone. */
let tab = 'squad';
/** Ids I follow, kept in memory so every card can render the right menu item. */
let followingIds = new Set();
let followCursor = null;
let followLoading = false;
let discoverCursor = null;
let discoverLoading = false;
/** The audience for the next post: 'circle' | 'followers' | 'public'. */
let audience = 'circle';

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

function fmtDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`;
}

function fmtPace(secPerKm) {
  const s = Math.round(Number(secPerKm) || 0);
  if (s <= 0) return null;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /km`;
}

function msg(el, text, kind) {
  if (!el) return;
  if (!text) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = text;
  el.className = `msg ${kind ?? ''}`.trim();
}

// ─── Modal ──────────────────────────────────────────────────────────────────
// One reusable dialog for the rules gate, the report sheet and confirms —
// small enough that three bespoke ones would be the wrong trade.

function closeModal() {
  const host = $('modal');
  host.hidden = true;
  host.innerHTML = '';
}

/**
 * Options are rendered as buttons; the returned promise resolves with the
 * chosen value, or null if dismissed.
 */
function openModal({ title, body, options, dismissable = true }) {
  return new Promise((resolve) => {
    const host = $('modal');
    // Built as a detached element and attached to *it*, not to the persistent
    // host: listeners bound to the host would survive closeModal() and stack up
    // one deeper per open.
    const wrap = document.createElement('div');
    wrap.style.display = 'contents';
    wrap.innerHTML = `
      <div class="modal-scrim" data-close="${dismissable ? '1' : ''}"></div>
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h2 class="modal-title">${esc(title)}</h2>
        ${body ? `<div class="modal-body">${body}</div>` : ''}
        <div class="modal-acts">
          ${options.map((o, i) => `
            <button type="button" class="${o.primary ? 'btn' : 'btn-quiet'}" data-i="${i}">
              ${esc(o.label)}
            </button>`).join('')}
        </div>
      </div>`;
    host.innerHTML = '';
    host.appendChild(wrap);
    host.hidden = false;

    function onKey(e) { if (e.key === 'Escape') done(null); }
    function done(value) {
      // Always unbind: a leaked Escape handler would close whichever modal
      // happened to be open next.
      document.removeEventListener('keydown', onKey);
      closeModal();
      resolve(value);
    }

    wrap.addEventListener('click', (e) => {
      if (e.target.dataset.close === '1') return done(null);
      const btn = e.target.closest('button[data-i]');
      if (btn) done(options[Number(btn.dataset.i)].value);
    });
    if (dismissable) document.addEventListener('keydown', onKey);
    wrap.querySelector('button')?.focus();
  });
}

// ─── Write gates ────────────────────────────────────────────────────────────

/**
 * Community rules consent, once per account across every surface
 * (users.rules_accepted_at). Someone who accepted in the app is not
 * re-prompted here. Returns true when the caller may proceed.
 */
async function ensureRules() {
  if (rulesOk === null) rulesOk = await hasAcceptedRules(sb);
  if (rulesOk) return true;

  const choice = await openModal({
    title: 'Before you post',
    body: `<p>Pacr has no tolerance for abusive posts or abusive people.
      Posting means you agree to the community rules — and that anything
      breaking them can be removed and your account closed.</p>
      <p><a href="/community-rules" target="_blank" rel="noopener">Read the community rules</a></p>`,
    options: [
      { label: 'Cancel', value: false },
      { label: 'Agree & post', value: true, primary: true },
    ],
  });
  if (!choice) return false;

  rulesOk = await acceptRules(sb);
  return rulesOk;
}

/** Copy for each discriminated failure reason, matching the app's wording. */
function reasonMessage(reason) {
  switch (reason) {
    case 'email_required':
      return 'Add an email to your account in the app before posting here.';
    case 'read_only':
      return 'This squad is set to owners-only posting.';
    case 'blocked_content':
      return BLOCKED_CONTENT_MESSAGE;
    case 'upload_failed':
      return "That photo didn't upload. Try a smaller one.";
    default:
      return 'Something went wrong. Try again.';
  }
}

// ─── Squads ─────────────────────────────────────────────────────────────────

// Ported from listMySquads() in pacr/src/services/squads.ts — memberships
// filtered to me, circles embedded, ordered by joined_at so the chips keep a
// stable order between visits. posting_mode comes along because the composer
// must not offer a squad the runner cannot post into.
async function loadSquads() {
  const { data, error } = await sb
    .from('memberships')
    .select('circle_id, role, circles(id, name, posting_mode)')
    .eq('user_id', me.id)
    .order('joined_at', { ascending: true });
  if (error) return [];
  return (data ?? [])
    .filter(r => r.circles)
    .map(r => ({
      id: r.circles.id,
      name: r.circles.name,
      postingMode: r.circles.posting_mode ?? 'all',
      role: r.role,
    }));
}

/** Squads this runner may actually post into — same rule as ShareRunSheet. */
function postableSquads() {
  return squads.filter(s => s.postingMode === 'all' || s.role === 'owner');
}

function paintChips() {
  const host = $('squadChips');
  if (squads.length < 2) { host.hidden = true; return; }
  host.hidden = false;
  host.innerHTML = squads
    .map(s => `<button type="button" class="chip" data-id="${esc(s.id)}" aria-pressed="${s.id === activeSquad.id}">${esc(s.name)}</button>`)
    .join('');
}

// ─── Post rendering ─────────────────────────────────────────────────────────

/** ISO-8601 week key, matching computeWeekKey in the app's runSync. */
function isoWeekKey(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * The design's four-cell stat grid.
 *
 * Only run posts have anything to put in it. The design shows HARD WORK, AIR,
 * READINESS and RPE alongside these — run_summaries carries none of those, so
 * the grid is filled from what a run actually records and is left out entirely
 * for text and photo posts rather than padded with blanks.
 */
function statsGridHtml(p) {
  const run = p.run;
  if (!run) return '';
  const km = Number(run.distance_km);
  if (!Number.isFinite(km)) return '';
  const pace = fmtPace(run.pace_sec_per_km);
  const when = run.started_at
    ? new Date(run.started_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const cells = [
    ['DISTANCE', `${km.toFixed(2)} km`],
    ['TIME', fmtDuration(run.duration_sec)],
    ['AVG PACE', pace ?? '—'],
    ['STARTED', when],
  ];
  return `<div class="post-stats">${cells.map(([k, v]) => `
    <div class="cell"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>`;
}

/**
 * A headline, only where one can be derived from real data.
 *
 * The design gives every card a prose headline written by its author. A Pacr
 * post has a body and nothing else, so inventing one would mean putting words
 * in a runner's mouth. Run posts get a factual line instead; text and photo
 * posts start at the body.
 */
function headlineHtml(p) {
  if (!p.run) return '';
  const km = Number(p.run.distance_km);
  if (!Number.isFinite(km)) return '';
  const where = p.run.neighborhood ? ` · ${p.run.neighborhood}` : '';
  return `<div class="post-headline">${esc(`${km.toFixed(2)} km${where}`)}</div>`;
}

/** SQUAD / FOLLOWERS / PUBLIC — the design's top-right tag, carrying real meaning. */
function audienceTag(p) {
  const label = p.visibility === 'public' ? 'PUBLIC'
    : p.visibility === 'followers' ? 'FOLLOWERS' : 'SQUAD';
  return `<div class="post-tag">${label}</div>`;
}

function cardShell(p, { club, tag, menu, follow, foot }) {
  return `
    <article class="post" data-id="${esc(p.id)}">
      <div class="post-top">
        <div class="avatar">${esc(initials(p.author_name))}</div>
        <div class="post-who">
          <div class="post-name-row">
            <span class="post-name">${esc(p.author_name)}</span>
            ${club ? `<span class="post-club">${esc(club)}</span>` : ''}
          </div>
          <div class="post-meta">${esc(timeAgo(p.created_at))}${p.pinned ? ' · PINNED' : ''}</div>
        </div>
        ${follow ?? ''}
        ${tag}
        ${menu}
      </div>
      <div class="post-lede">
        ${headlineHtml(p)}
        ${p.body ? `<p class="post-body">${renderBody(p.body)}</p>` : ''}
      </div>
      ${statsGridHtml(p)}
      ${p.image_url ? `<img class="post-img" src="${esc(p.image_url)}" alt="" loading="lazy">` : ''}
      ${foot}
      <div class="comments" hidden></div>
    </article>`;
}

function footHtml(p, { comments = true } = {}) {
  const likeWord = p.like_count === 1 ? 'kudos' : 'kudos';
  const cmtWord = p.comment_count === 1 ? 'comment' : 'comments';
  return `
    <div class="post-foot">
      <button type="button" class="kudos ${p.liked_by_me ? 'on' : ''}" data-act="like"
              aria-pressed="${!!p.liked_by_me}">👏 ${p.like_count} · ${p.liked_by_me ? 'Kudos given' : 'Kudos'}</button>
      ${comments
        ? `<button type="button" class="cmt-toggle" data-act="comments" aria-expanded="false">${p.comment_count} ${cmtWord}</button>`
        : `<span class="cmt-toggle" style="cursor:default;">${p.comment_count} ${cmtWord}</span>`}
    </div>`;
}

function menuHtml(p) {
  const isOwner = activeSquad?.role === 'owner';
  const items = [];
  if (isOwner) items.push(`<button type="button" data-act="pin">${p.pinned ? 'Unpin' : 'Pin to top'}</button>`);
  if (p.is_mine || isOwner) items.push('<button type="button" data-act="delete">Delete post</button>');
  if (!p.is_mine) {
    items.push(`<button type="button" data-act="mute">Mute ${esc(p.author_name)}</button>`);
    items.push('<button type="button" data-act="report">Report post</button>');
    items.push('<button type="button" data-act="block">Block this runner</button>');
  }
  if (items.length === 0) return '';
  return `<details class="menu"><summary aria-label="Post actions">···</summary>
    <div class="menu-list">${items.join('')}</div></details>`;
}

function postHtml(p) {
  return cardShell(p, {
    club: activeSquad?.name ?? null,
    tag: audienceTag(p),
    menu: menuHtml(p),
    foot: footHtml(p),
  });
}

/**
 * Following and Discover cards.
 *
 * No pin and no delete — never your squad, never your post. Comments are a
 * count rather than a control on Discover: a public post can be seen by anyone
 * signed in, but only squadmates and followers may reply, so opening a thread
 * you cannot post to would be a dead end.
 */
function followingCardHtml(p) {
  const canComment = p.scope === 'following' || p.followed_by_me;
  const items = [];
  if (p.followed_by_me || p.scope === 'following') {
    items.push(`<button type="button" data-act="unfollow">Unfollow ${esc(p.author_name)}</button>`);
  }
  items.push(`<button type="button" data-act="mute">Mute ${esc(p.author_name)}</button>`);
  items.push('<button type="button" data-act="report">Report post</button>');
  items.push('<button type="button" data-act="block">Block this runner</button>');

  return cardShell(p, {
    club: null,
    tag: audienceTag(p),
    follow: p.scope === 'discover' && !p.followed_by_me
      ? '<button type="button" class="chip chip-follow" data-act="follow-author">Follow</button>'
      : '<span class="pill pill-quiet">Following</span>',
    menu: `<details class="menu"><summary aria-label="Post actions">···</summary>
      <div class="menu-list">${items.join('')}</div></details>`,
    foot: footHtml(p, { comments: canComment }),
  });
}

/** Squad and Following/Discover cards share ids and actions but not markup. */
function cardHtml(p) {
  return p.scope === 'squad' ? postHtml(p) : followingCardHtml(p);
}

/** Re-render one card in place from postState — used after like/pin/comment. */
function repaint(postId) {
  const el = document.querySelector(`article.post[data-id="${CSS.escape(postId)}"]`);
  const p = postState.get(postId);
  if (!el || !p) return;
  const box = el.querySelector('.comments');
  const openComments = !!box && !box.hidden;
  const commentsHtml = box ? box.innerHTML : '';
  el.outerHTML = cardHtml(p);
  if (openComments) {
    const next = document.querySelector(`article.post[data-id="${CSS.escape(postId)}"]`);
    const box = next.querySelector('.comments');
    box.innerHTML = commentsHtml;
    box.hidden = false;
    next.querySelector('[data-act="comments"]').setAttribute('aria-expanded', 'true');
    // innerHTML rebuilds the nodes, so the comment field's mention wiring went
    // with them. (dataset.mentionsWired came along in the markup — clear it, or
    // wireMentions declines to bind the fresh, unwired field.)
    const cmtInput = box.querySelector('.cmt-input');
    if (cmtInput) delete cmtInput.dataset.mentionsWired;
    wireMentions(cmtInput, box.querySelector('.cmt-mentions'));
  }
}

/** Map raw rows → view models, filling signed URLs and liked_by_me in one pass. */
async function hydrate(rows) {
  if (rows.length === 0) return '';
  const paths = rows.map(r => r.image_path).filter(Boolean);
  const urlByPath = await signedUrlsFor(sb, 'post-images', paths);

  const likedIds = new Set();
  try {
    const { data } = await sb.from('post_likes')
      .select('post_id')
      .in('post_id', rows.map(r => r.id))
      .eq('user_id', me.id);
    for (const l of data ?? []) likedIds.add(l.post_id);
  } catch {
    // liked_by_me degrades to false — not worth failing the page over.
  }

  return rows.map((row) => {
    const p = {
      id: row.id,
      author_id: row.author_id,
      author_name: row.author?.display_name ?? '—',
      kind: row.kind,
      body: row.body,
      image_url: row.image_path ? (urlByPath.get(row.image_path) ?? null) : null,
      run: row.run ?? null,
      pinned: !!row.pinned,
      visibility: row.visibility ?? 'circle',
      created_at: row.created_at,
      like_count: Number(row.post_likes?.[0]?.count) || 0,
      comment_count: Number(row.post_comments?.[0]?.count) || 0,
      liked_by_me: likedIds.has(row.id),
      is_mine: row.author_id === me.id,
    };
    p.scope = 'squad';
    postState.set(p.id, p);
    return postHtml(p);
  }).join('');
}

// ─── Following feed ─────────────────────────────────────────────────────────

/**
 * Map RPC rows → view models. The rows are already flat and already filtered
 * server-side, including image_path being nulled on run posts, so there is no
 * client-side visibility decision left to get wrong here.
 */
async function hydrateFollowing(rows, scope = 'following') {
  if (rows.length === 0) return '';
  const urlByPath = await signedUrlsFor(sb, 'post-images', rows.map(r => r.image_path).filter(Boolean));
  return rows.map((row) => {
    const p = {
      id: row.id,
      author_id: row.author_id,
      author_name: row.author_name ?? '—',
      kind: row.kind,
      body: row.body,
      image_url: row.image_path ? (urlByPath.get(row.image_path) ?? null) : null,
      run: row.distance_km == null ? null : {
        distance_km: row.distance_km,
        duration_sec: row.duration_sec,
        pace_sec_per_km: row.pace_sec_per_km,
      },
      pinned: false,
      visibility: row.visibility ?? 'public',
      created_at: row.created_at,
      like_count: Number(row.like_count) || 0,
      comment_count: Number(row.comment_count) || 0,
      liked_by_me: !!row.liked_by_me,
      is_mine: false,
      followed_by_me: row.followed_by_me ?? true,
      scope,
    };
    postState.set(p.id, p);
    return p;
  });
}

// A density cap ("no more than two cards in a row from one author") was
// specced here and deliberately dropped: the only way to enforce it is to move
// a card down the list, and this feed is chronological. Reordering makes "2h
// ago" sit above "5h ago" above "3h ago", which reads as a bug. If one prolific
// friend starts flooding the feed, the fix is to COLLAPSE their run into a
// single grouped card in place — which keeps the ordering — not to shuffle it.

async function loadFollowing({ reset }) {
  if (followLoading) return;
  followLoading = true;
  const host = $('followPosts');
  const more = $('followMore');
  const note = $('followMsg');
  more.hidden = true;

  if (reset) {
    followCursor = null;
    host.innerHTML = '<div class="skel"><div style="width:55%"></div></div>';
    msg(note, '');
    $('suggested').innerHTML = '';
  }

  const page = await listFollowingFeed(sb, followCursor);
  followLoading = false;

  if (page.failed) {
    if (reset) host.innerHTML = '';
    return msg(note, "Couldn't load your Following feed. Refresh to try again.", 'err');
  }

  const cards = await hydrateFollowing(page.rows);
  const html = cards.map(followingCardHtml).join('');
  if (reset) host.innerHTML = html; else host.insertAdjacentHTML('beforeend', html);

  followCursor = page.cursor;
  more.hidden = !followCursor;
  paintCountLine(host.querySelectorAll('article.post').length);

  if (reset && cards.length === 0) await paintEmptyFollowing();
}

// ─── Discover ───────────────────────────────────────────────────────────────

async function loadDiscover({ reset }) {
  if (discoverLoading) return;
  discoverLoading = true;
  const host = $('discoverPosts');
  const more = $('discoverMore');
  const note = $('discoverMsg');
  more.hidden = true;

  if (reset) {
    discoverCursor = null;
    host.innerHTML = '<div class="skel"><div style="width:55%"></div></div>';
    msg(note, '');
  }

  const page = await listPublicFeed(sb, discoverCursor);
  discoverLoading = false;

  if (page.failed) {
    if (reset) host.innerHTML = '';
    return msg(note, "Couldn't load Discover. Refresh to try again.", 'err');
  }

  const cards = await hydrateFollowing(page.rows, 'discover');
  const html = cards.map(followingCardHtml).join('');
  if (reset) host.innerHTML = html; else host.insertAdjacentHTML('beforeend', html);

  discoverCursor = page.cursor;
  more.hidden = !discoverCursor;
  paintCountLine(host.querySelectorAll('article.post').length);

  if (reset && cards.length === 0) {
    msg(note, 'Nothing public yet. Posts show up here when a runner picks Public as their audience.');
  }
}

/**
 * The two empty states are different problems and need different answers:
 * following nobody is a discovery problem, following people who post nothing
 * publicly is a them-problem we can only explain.
 */
async function paintEmptyFollowing() {
  const note = $('followMsg');
  if (followingIds.size > 0) {
    return msg(note, 'Nobody you follow has posted to their followers yet. Their squad posts stay in their squads.');
  }
  // Suggestions live in the sidebar (the design's "Runners to follow"), so this
  // points at them rather than rendering a second list of the same people.
  msg(note, 'You are not following anyone yet. Pick a runner from "Runners to follow" and their runs show up here — including the ones from squads you are not in.');
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
    postState.clear();
    host.innerHTML = '<div class="skel"><div style="width:55%"></div></div>';
    msg(feedMsg, '');
  }

  let html = '';

  // Pinned posts ride above the keyset list, and are excluded from it, so the
  // cursor never has to reason about them — same split as the app.
  if (reset) {
    const { data: pinned } = await sb
      .from('posts').select(POST_SELECT)
      .eq('post_targets.circle_id', activeSquad.id).eq('pinned', true)
      .order('created_at', { ascending: false })
      .limit(PINNED_LIMIT);
    if (pinned?.length) html += await hydrate(pinned);
  }

  let q = sb
    .from('posts').select(POST_SELECT)
    .eq('post_targets.circle_id', activeSquad.id).eq('pinned', false)
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

  paintCountLine(host.querySelectorAll('article.post').length);
  if (reset && host.innerHTML === '') {
    msg(feedMsg, 'No posts in this squad yet. Be the first — say something above.');
  }
}

// ─── Comments ───────────────────────────────────────────────────────────────

function commentHtml(c) {
  return `
    <div class="cmt" data-id="${esc(c.id)}">
      <div class="cmt-top">
        <span class="cmt-who">${esc(c.author_name)}</span>
        <span class="cmt-when">${esc(timeAgo(c.created_at))}</span>
        ${c.is_mine ? '<button type="button" class="cmt-del" data-act="cmt-delete">Delete</button>' : ''}
      </div>
      <p class="cmt-body">${renderBody(c.body)}</p>
    </div>`;
}

async function openComments(article, postId) {
  const box = article.querySelector('.comments');
  const btn = article.querySelector('[data-act="comments"]');
  if (!box.hidden) {
    box.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    return;
  }
  box.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  box.innerHTML = '<p class="cmt-loading">Loading…</p>';

  const rows = await listComments(sb, postId, me.id);
  box.innerHTML = `
    <div class="cmt-list">${rows.map(commentHtml).join('') || '<p class="cmt-empty">No comments yet.</p>'}</div>
    <div class="mention-row cmt-mentions" hidden></div>
    <form class="cmt-form" data-act="cmt-form">
      <input type="text" class="input cmt-input" name="body" maxlength="${MAX_COMMENT}"
             placeholder="Add a comment… @ to tag" aria-label="Add a comment" autocomplete="off">
      <button type="submit" class="btn-quiet">Reply</button>
    </form>
    <p class="msg cmt-msg" hidden></p>`;
  wireMentions(box.querySelector('.cmt-input'), box.querySelector('.cmt-mentions'));
}

async function submitComment(article, postId, form) {
  const input = form.querySelector('.cmt-input');
  const note = article.querySelector('.cmt-msg');
  const typed = input.value.trim();
  if (!typed) return;
  if (typed.length > MAX_COMMENT) {
    return msg(note, `Keep it under ${MAX_COMMENT} characters.`, 'err');
  }

  const term = findBlockedTerm(typed);
  if (term) return msg(note, BLOCKED_CONTENT_MESSAGE, 'err');
  if (!(await ensureRules())) return;

  msg(note, '');
  input.disabled = true;
  // The composer holds plain "@Name" text; tokens are only a storage format.
  const res = await addComment(sb, postId, serializeMentions(typed, members));
  input.disabled = false;

  if (!res.ok) return msg(note, reasonMessage(res.reason), 'err');

  input.value = '';
  const list = article.querySelector('.cmt-list');
  list.querySelector('.cmt-empty')?.remove();
  list.insertAdjacentHTML('beforeend', commentHtml(res.comment));

  const p = postState.get(postId);
  if (p) {
    p.comment_count += 1;
    article.querySelector('[data-act="comments"]').innerHTML =
      `${p.comment_count} ${p.comment_count === 1 ? 'comment' : 'comments'}`;
  }
}

// ─── Card actions ───────────────────────────────────────────────────────────

async function onLike(postId) {
  const p = postState.get(postId);
  if (!p) return;

  // Optimistic, with rollback — a like that visibly lands and then silently
  // reverts is worse than one that never moved.
  const next = !p.liked_by_me;
  p.liked_by_me = next;
  p.like_count = Math.max(0, p.like_count + (next ? 1 : -1));
  repaint(postId);

  const ok = await toggleLike(sb, postId, next);
  if (!ok) {
    p.liked_by_me = !next;
    p.like_count = Math.max(0, p.like_count + (next ? -1 : 1));
    repaint(postId);
  }
}

async function onReport(postId) {
  const choice = await openModal({
    title: 'Report this post',
    body: '<p>Reports go to the squad owner for review. Enough reports auto-hide a post while it is looked at.</p>',
    options: [
      ...REPORT_REASONS.map(r => ({ label: r.label, value: r.value })),
      { label: 'Cancel', value: null },
    ],
  });
  if (!choice) return;

  const res = await reportContent(sb, { target: 'post', targetId: postId, reason: choice });
  const text = res.ok || res.reason === 'already_reported'
    ? 'Thanks — that post has been reported. It is hidden from your feed now.'
    : reasonMessage(res.reason);

  await openModal({ title: res.ok || res.reason === 'already_reported' ? 'Reported' : "Couldn't report", body: `<p>${esc(text)}</p>`, options: [{ label: 'Done', value: true, primary: true }] });

  // The report policy hides it for the reporter server-side; drop it locally
  // in the same frame rather than waiting for a refetch.
  if (res.ok || res.reason === 'already_reported') {
    document.querySelector(`article.post[data-id="${CSS.escape(postId)}"]`)?.remove();
    postState.delete(postId);
  }
}

/** Reload whichever tab is on screen — used after a block or an unfollow. */
async function reloadActive() {
  if (tab === 'following') await loadFollowing({ reset: true });
  else if (tab === 'discover') await loadDiscover({ reset: true });
  else await loadPage({ reset: true });
}

async function onMute(postId) {
  const p = postState.get(postId);
  if (!p) return;
  const yes = await openModal({
    title: `Mute ${p.author_name}?`,
    body: '<p>Their posts leave your feeds. They are not told, they keep seeing yours, and you can undo it in the app. Use Block instead if you want it to cut both ways.</p>',
    options: [{ label: 'Cancel', value: false }, { label: 'Mute', value: true, primary: true }],
  });
  if (!yes) return;
  if (await muteUser(sb, me.id, p.author_id)) await reloadActive();
  else msg($('feedMsg'), "Couldn't mute that runner. Try again.", 'err');
}

/** Follow straight from a Discover card. */
async function onFollowAuthor(postId) {
  const p = postState.get(postId);
  if (!p) return;
  const res = await followUser(sb, me.id, p.author_id);
  if (!res.ok) return msg($('discoverMsg'), reasonMessage(res.reason), 'err');
  followingIds.add(p.author_id);
  for (const [, other] of postState) {
    if (other.author_id === p.author_id) other.followed_by_me = true;
  }
  await loadDiscover({ reset: true });
}

async function onFollow(userId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Following…'; }
  const res = await followUser(sb, me.id, userId);
  if (!res.ok) {
    if (btn) { btn.disabled = false; btn.textContent = 'Follow'; }
    return msg($('followMsg'), reasonMessage(res.reason), 'err');
  }
  followingIds.add(userId);
  await loadFollowing({ reset: true });
}

async function onUnfollow(postId) {
  const p = postState.get(postId);
  if (!p) return;
  const yes = await openModal({
    title: `Unfollow ${p.author_name}?`,
    body: '<p>Their runs stop showing in your Following feed. Anything they post in a squad you share is unaffected.</p>',
    options: [{ label: 'Cancel', value: false }, { label: 'Unfollow', value: true, primary: true }],
  });
  if (!yes) return;
  if (await unfollowUser(sb, me.id, p.author_id)) {
    followingIds.delete(p.author_id);
    await loadFollowing({ reset: true });
  } else {
    msg($('followMsg'), "Couldn't unfollow. Try again.", 'err');
  }
}

async function onBlock(postId) {
  const p = postState.get(postId);
  if (!p) return;
  const yes = await openModal({
    title: `Block ${p.author_name}?`,
    body: '<p>You will stop seeing their posts and comments everywhere, and they will stop seeing yours. You can undo this in the app.</p>',
    options: [{ label: 'Cancel', value: false }, { label: 'Block', value: true, primary: true }],
  });
  if (!yes) return;

  const ok = await blockUser(sb, p.author_id);
  if (!ok) return msg($('feedMsg'), "Couldn't block that runner. Try again.", 'err');
  followingIds.delete(p.author_id);
  await reloadActive();
}

async function onDelete(postId) {
  const yes = await openModal({
    title: 'Delete this post?',
    body: '<p>This cannot be undone.</p>',
    options: [{ label: 'Cancel', value: false }, { label: 'Delete', value: true, primary: true }],
  });
  if (!yes) return;
  if (await deletePost(sb, postId)) {
    document.querySelector(`article.post[data-id="${CSS.escape(postId)}"]`)?.remove();
    postState.delete(postId);
  } else {
    msg($('feedMsg'), "Couldn't delete that post.", 'err');
  }
}

async function onPin(postId) {
  const p = postState.get(postId);
  if (!p) return;
  if (await setPinned(sb, postId, !p.pinned)) await loadPage({ reset: true });
  else msg($('feedMsg'), "Couldn't change the pin.", 'err');
}

// ─── Composer ───────────────────────────────────────────────────────────────

/** Squads this post goes to. Public overrides it with every squad you are in. */
let targetIds = [];

/**
 * The selection, resolved against the live list — so a squad that disappears
 * (left, or flipped to owners-only) silently drops out of the targets instead
 * of being posted to.
 */
function currentTargets() {
  const ids = new Set(postableSquads().map(s => s.id));
  return targetIds.filter(id => ids.has(id));
}

/**
 * The share control: which squads, plus followers, plus public.
 *
 * Public is not a fourth destination sitting beside the squads — it means every
 * squad you are in AND your followers AND everyone else, so choosing it selects
 * and locks the squad chips rather than clearing them. That mirrors what the
 * post actually does, instead of leaving the runner to infer it.
 */
function paintTargets() {
  const host = $('cTargets');
  const options = postableSquads();
  if (options.length === 0) { host.innerHTML = ''; return; }

  const isPublic = audience === 'public';
  const selected = isPublic ? options.map(s => s.id) : currentTargets();

  host.innerHTML = `
    <div class="aud-group" role="group" aria-label="Squads to post to">
      ${options.map(s => `
        <button type="button" class="chip" data-target="${esc(s.id)}"
                aria-pressed="${selected.includes(s.id)}" ${isPublic ? 'disabled' : ''}>
          ${esc(s.name)}
        </button>`).join('')}
      ${options.length > 1 && !isPublic
        ? `<button type="button" class="chip chip-all" data-target="__all"
                   aria-pressed="${selected.length === options.length}">All squads</button>`
        : ''}
    </div>
    <div class="aud-group aud-reach" role="group" aria-label="Who else sees this">
      <button type="button" class="chip" data-aud="followers"
              aria-pressed="${audience !== 'circle'}" ${isPublic ? 'disabled' : ''}>
        + Followers
      </button>
      <button type="button" class="chip chip-public" data-aud="public"
              aria-pressed="${isPublic}">Public</button>
    </div>
    <p class="aud-note">${audienceNote(options.length, selected.length)}</p>`;

  $('draftScope').textContent = audience === 'public' ? '● PUBLIC'
    : audience === 'followers' ? '● SQUADS + FOLLOWERS' : '● SQUADS ONLY';
}

/** Say in one line exactly who ends up seeing this. */
function audienceNote(squadCount, selectedCount) {
  if (audience === 'public') {
    return 'Everyone: all ' + squadCount + (squadCount === 1 ? ' squad' : ' squads')
      + " you are in, your followers, and runners who don't follow you.";
  }
  const squads = `${selectedCount} ${selectedCount === 1 ? 'squad' : 'squads'}`;
  return audience === 'followers'
    ? `${squads} and your followers.`
    : `${squads} only. Nobody outside them sees this.`;
}

function setComposerEnabled() {
  const options = postableSquads();
  const note = $('cGate');
  const form = $('composer');
  if (options.length === 0) {
    form.hidden = true;
    note.hidden = false;
    note.textContent = squads.length
      ? 'Your squads are set to owners-only posting, so you can read here but not post.'
      : '';
    return;
  }
  form.hidden = false;
  note.hidden = true;
}

async function onPickPhoto(file) {
  const preview = $('cPreview');
  if (!file) { pendingPhoto = null; preview.hidden = true; preview.innerHTML = ''; return; }
  try {
    pendingPhoto = await downscaleImage(file);
    const url = URL.createObjectURL(pendingPhoto);
    preview.hidden = false;
    preview.innerHTML = `
      <img src="${url}" alt="Photo to post">
      <button type="button" class="btn-quiet" data-act="drop-photo">Remove photo</button>`;
  } catch {
    pendingPhoto = null;
    preview.hidden = true;
    preview.innerHTML = '';
    msg($('cMsg'), "Couldn't read that image. Try a JPEG or PNG.", 'err');
  }
}

async function onPost() {
  const typed = $('cBody').value.trim();
  const note = $('cMsg');
  const options = postableSquads();
  // Public means every squad you are in, so the caller resolves that here —
  // only the client knows the full list.
  const targets = audience === 'public' ? options.map(s => s.id) : currentTargets();

  if (targets.length === 0) return msg(note, 'Pick at least one squad to post to.', 'err');
  if (!typed && !pendingPhoto) return msg(note, 'Write something, or add a photo.', 'err');
  if (typed.length > MAX_BODY) return msg(note, `Keep it under ${MAX_BODY} characters.`, 'err');

  // The server trigger is the authority; this refuses in the same frame rather
  // than round-tripping to a 400. Checked on the typed text, as the app does.
  const term = findBlockedTerm(typed);
  if (term) return msg(note, BLOCKED_CONTENT_MESSAGE, 'err');

  // The composer holds plain "@Name" text; tokens are only a storage format.
  const body = serializeMentions(typed, members);
  // A token is longer than the name it replaces, so a body at the composer's
  // limit can cross the column's 2000-char check once tags expand. Say that,
  // rather than letting the insert fail as a generic error.
  if (body.length > MAX_BODY) {
    return msg(note, 'That is too long once your tags are expanded. Shorten it, or tag fewer people.', 'err');
  }

  if (!(await ensureRules())) return;

  const btn = $('cPost');
  btn.disabled = true;
  msg(note, 'Posting…');

  // ONE post with many targets — not the per-squad loop this used to run. Image
  // paths key on the author now, so a single object serves every squad, and a
  // follower sees the post once with one like count.
  const res = await createPost(sb, {
    targets,
    visibility: audience,
    body,
    blob: pendingPhoto,
    kind: pendingPhoto ? 'photo' : 'text',
  });

  btn.disabled = false;
  if (!res.ok) return msg(note, reasonMessage(res.reason), 'err');

  $('cBody').value = '';
  await onPickPhoto(null);
  $('cPhoto').value = '';
  if (targets.includes(activeSquad.id)) {
    $('posts').insertAdjacentHTML('afterbegin', await hydrate([res.row]));
    msg($('feedMsg'), '');
  }
  msg(note, targets.length > 1 ? `Posted to ${targets.length} squads.` : 'Posted.', 'ok');
  setTimeout(() => msg(note, ''), 4000);
}

// ─── Mention autocomplete ───────────────────────────────────────────────────
// Same contract as the app's MentionInput: the field holds PLAIN "@Name" text,
// picking splices a plain name in, and serializeMentions() creates tokens only
// at submit. A raw "@[Name](uuid)" must never appear in a composer, and the
// uuid must never reach the screen at all.
//
// Rendered as a chip row ABOVE the field, matching the app rather than the
// dropdown a web autocomplete would default to — same component, same place,
// so the two surfaces teach the same gesture.

const MAX_SUGGESTIONS = 5;

function suggestionsFor(input) {
  const value = input.value;
  const query = activeMentionQuery(value, input.selectionStart ?? value.length);
  if (query === null) return [];
  // Stop offering once the body is already at the cap, as the app does —
  // otherwise we suggest picks that serializeMentions will silently drop.
  if (countPlainMentions(value, members) >= MAX_MENTIONS_PER_BODY) return [];
  const q = query.toLowerCase();
  return members
    .filter(m => m.userId !== me.id)
    .filter(m => m.displayName.toLowerCase().includes(q))
    .slice(0, MAX_SUGGESTIONS);
}

function paintMentionRow(input, row) {
  const hits = suggestionsFor(input);
  if (hits.length === 0) { row.hidden = true; row.innerHTML = ''; return; }
  row.hidden = false;
  row.innerHTML = hits.map(m => `
    <button type="button" class="mention-chip" data-uid="${esc(m.userId)}"
            data-name="${esc(m.displayName)}">@${esc(m.displayName)}</button>`).join('');
}

/** Bind a composer field to its suggestion row. Safe to call again on re-render. */
function wireMentions(input, row) {
  if (!input || !row || input.dataset.mentionsWired === '1') return;
  input.dataset.mentionsWired = '1';

  const refresh = () => paintMentionRow(input, row);
  input.addEventListener('input', refresh);
  input.addEventListener('click', refresh);
  input.addEventListener('keyup', refresh);
  input.addEventListener('blur', () => setTimeout(() => { row.hidden = true; }, 150));

  // mousedown, not click: blur fires first on a click and would hide the row
  // out from under the pointer.
  row.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('button[data-uid]');
    if (!btn) return;
    e.preventDefault();
    const next = insertMention(
      input.value,
      input.selectionStart ?? input.value.length,
      { userId: btn.dataset.uid, displayName: btn.dataset.name },
    );
    input.value = next.body;
    input.setSelectionRange(next.caret, next.caret);
    input.focus();
    paintMentionRow(input, row);
  });
}

// ─── Masthead and sidebar ───────────────────────────────────────────────────
// The design also carries an auto-drafted session card, upcoming marathons, a
// club challenge and live "N out" counts per route. None of those have a data
// source in this product — run_summaries records distance, duration, pace,
// neighbourhood and a week key, and there is no races table, no challenge and
// no presence — so those blocks are left out rather than filled with numbers
// nobody actually ran. Everything below is real.

function paintIdentity(name) {
  const ini = initials(name || '—');
  for (const id of ['meAvatar', 'draftAvatar']) {
    const el = $(id);
    if (el) { el.textContent = ini; el.hidden = false; }
  }
  $('feedDate').textContent = `Feed — ${new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'short',
  })}`;
}

/** My own week, from my own runs. The one head stat with a real source. */
async function paintHeadStats() {
  try {
    const { data, error } = await sb.from('run_summaries')
      .select('distance_km')
      .eq('user_id', me.id)
      .eq('week_key', isoWeekKey(new Date()));
    if (error) return;
    const runs = data ?? [];
    const km = runs.reduce((n, r) => n + (Number(r.distance_km) || 0), 0);
    const cells = [
      ['YOUR WEEK', `${km.toFixed(1)} km`],
      ['RUNS', String(runs.length)],
      ['SQUADS', String(squads.length)],
    ];
    $('headStats').innerHTML = cells.map(([k, v]) => `
      <div class="stat-cell"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('');
    $('headStats').hidden = false;
  } catch {
    // A missing head stat is not worth failing the page over.
  }
}

/**
 * The squad's consistency board for this week.
 *
 * Aggregated client-side from run_summaries, which co-members may read. Capped
 * at 60 members for the same reason the app caps it — above that this stops
 * being a query and starts being a download.
 */
async function paintBoard() {
  const card = $('boardCard');
  if (!activeSquad) { card.hidden = true; return; }
  try {
    const roster = await listMembers(sb, activeSquad.id, 60);
    if (roster.length === 0) { card.hidden = true; return; }
    const { data, error } = await sb.from('run_summaries')
      .select('user_id, distance_km')
      .in('user_id', roster.map(m => m.userId))
      .eq('week_key', isoWeekKey(new Date()));
    if (error) { card.hidden = true; return; }

    const tally = new Map(roster.map(m => [m.userId, { name: m.displayName, runs: 0, km: 0 }]));
    for (const r of data ?? []) {
      const row = tally.get(r.user_id);
      if (row) { row.runs += 1; row.km += Number(r.distance_km) || 0; }
    }
    const rows = [...tally.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.runs - a.runs || b.km - a.km)
      .slice(0, 6);

    $('boardClub').textContent = `YOUR SQUAD — ${activeSquad.name.toUpperCase()}`;
    $('boardRows').innerHTML = rows.map((r, i) => `
      <div class="board-row ${r.id === me.id ? 'me' : ''}">
        <span class="board-rank">${i + 1}</span>
        <span class="board-name">${esc(r.id === me.id ? 'You' : r.name)}</span>
        <span class="board-val">${r.runs} ${r.runs === 1 ? 'run' : 'runs'} · ${r.km.toFixed(1)} km</span>
      </div>`).join('');
    card.hidden = false;
  } catch {
    card.hidden = true;
  }
}

/** The design's "Runners to follow" — squadmates you don't already follow. */
async function paintSuggestions() {
  const card = $('sugCard');
  const people = await suggestedToFollow(sb, me.id, squads.map(s => s.id), [...followingIds]);
  if (people.length === 0) { card.hidden = true; return; }
  $('sugRows').innerHTML = people.slice(0, 5).map(m => `
    <div class="sug-row" data-uid="${esc(m.userId)}">
      <div class="sug-av">${esc(initials(m.displayName))}</div>
      <div class="sug-main">
        <div class="sug-name">${esc(m.displayName)}</div>
        <div class="sug-meta">IN YOUR SQUADS</div>
        <div class="sug-reason">Following them shows their runs from every squad they are in, not just the one you share.</div>
      </div>
      <button type="button" class="chip chip-follow" data-act="follow">Follow</button>
    </div>`).join('');
  card.hidden = false;
}

/**
 * Routes, from public.spots.
 *
 * The design shows a live "14 out" per route. There is no presence anywhere in
 * this product, so the right-hand slot carries the route's city instead of a
 * number that would be invented.
 */
async function paintRoutes() {
  const card = $('routesCard');
  try {
    const { data, error } = await sb.from('spots')
      .select('id, name, city, loop_km, surface')
      .limit(4);
    const rows = data ?? [];
    if (error || rows.length === 0) { card.hidden = true; return; }
    $('routeRows').innerHTML = rows.map(r => {
      const meta = [r.loop_km ? `${Number(r.loop_km).toFixed(1)} KM LOOP` : null, (r.surface || '').toUpperCase() || null]
        .filter(Boolean).join(' · ');
      return `<a class="route-row" href="/#routes">
        <span>
          <span class="route-name">${esc(r.name)}</span>
          <span class="route-meta">${esc(meta || 'ROUTE')}</span>
        </span>
        <span class="route-val">${esc(r.city ?? '')}</span>
      </a>`;
    }).join('');
    card.hidden = false;
  } catch {
    card.hidden = true;
  }
}

function paintCountLine(n) {
  $('countLine').textContent = `${n} ${n === 1 ? 'post' : 'posts'}`;
}

// ─── Wiring ─────────────────────────────────────────────────────────────────

async function switchSquad(id) {
  activeSquad = squads.find(s => s.id === id) ?? activeSquad;
  paintChips();
  targetIds = [activeSquad.id];
  paintTargets();
  setComposerEnabled();
  members = await listMembers(sb, activeSquad.id);
  await Promise.all([loadPage({ reset: true }), paintBoard()]);
}

function wirePostActions(host) {
  host.addEventListener('click', async (e) => {
    const article = e.target.closest('article.post');
    if (!article) return;
    const postId = article.dataset.id;
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;

    switch (btn.dataset.act) {
      case 'like':      return onLike(postId);
      case 'comments':  return openComments(article, postId);
      case 'unfollow':  return onUnfollow(postId);
      case 'mute':      return onMute(postId);
      case 'follow-author': return onFollowAuthor(postId);
      case 'pin':       return onPin(postId);
      case 'delete':    return onDelete(postId);
      case 'report':    return onReport(postId);
      case 'block':     return onBlock(postId);
      case 'cmt-delete': {
        const row = e.target.closest('.cmt');
        if (await deleteComment(sb, row.dataset.id)) {
          row.remove();
          const p = postState.get(postId);
          if (p) {
            p.comment_count = Math.max(0, p.comment_count - 1);
            article.querySelector('[data-act="comments"]').innerHTML =
              `${p.comment_count} ${p.comment_count === 1 ? 'comment' : 'comments'}`;
          }
        }
        return;
      }
    }
  });

  host.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-act="cmt-form"]');
    if (!form) return;
    e.preventDefault();
    const article = form.closest('article.post');
    submitComment(article, article.dataset.id, form);
  });
}

function wireComposer() {
  $('cTargets').addEventListener('click', (e) => {
    const aud = e.target.closest('button[data-aud]');
    if (aud) {
      if (aud.dataset.aud === 'public') {
        audience = audience === 'public' ? 'circle' : 'public';
      } else {
        // "+ Followers" is a toggle between circle and followers; it never
        // silently drops you out of public.
        audience = audience === 'circle' ? 'followers' : 'circle';
      }
      return paintTargets();
    }
    const btn = e.target.closest('button[data-target]');
    if (!btn || btn.disabled) return;
    const options = postableSquads();
    if (btn.dataset.target === '__all') {
      // ALL is a toggle: collapse back to the active squad rather than leaving
      // the runner with nothing selected.
      targetIds = currentTargets().length === options.length
        ? [activeSquad.id]
        : options.map(s => s.id);
    } else {
      const id = btn.dataset.target;
      const next = new Set(currentTargets());
      if (next.has(id)) next.delete(id); else next.add(id);
      targetIds = next.size === 0 ? [activeSquad.id] : [...next];
    }
    paintTargets();
  });

  $('cPhotoBtn').addEventListener('click', () => $('cPhoto').click());
  $('cPhoto').addEventListener('change', (e) => onPickPhoto(e.target.files?.[0] ?? null));
  $('cPreview').addEventListener('click', (e) => {
    if (e.target.closest('[data-act="drop-photo"]')) {
      $('cPhoto').value = '';
      onPickPhoto(null);
    }
  });
  $('cPost').addEventListener('click', onPost);
  wireMentions($('cBody'), $('cMentions'));
}

/**
 * Retraction.
 *
 * This replaces the old "show my posts to followers" toggle, which per-post
 * audience made redundant — you now choose the audience when you write. What
 * that toggle also did, and what a per-post choice cannot, is take everything
 * back at once. So the control that remains is the one worth keeping, stated as
 * the action it actually performs: it rewrites the posts.
 *
 * One-way on purpose. An un-retract would silently republish things.
 */
function paintPrivacy() {
  $('privacyBox').innerHTML = `
    <div class="vis-row">
      <div>
        <div class="vis-title">Pull everything back</div>
        <div class="vis-sub">Rewrites every post you have made to squad-only, in every squad it went to. Followers and Discover lose them immediately. This cannot be undone — posting them again means posting them again.</div>
      </div>
      <button type="button" class="btn-quiet" data-act="retract">Make all squad-only</button>
    </div>`;
}

function wireFollowingPane() {
  $('privacyBox').addEventListener('click', async (e) => {
    if (!e.target.closest('[data-act="retract"]')) return;
    const yes = await openModal({
      title: 'Make every post squad-only?',
      body: '<p>Every post you have written goes back to its squads and nowhere else. Followers and Discover lose them straight away.</p><p>This cannot be undone.</p>',
      options: [{ label: 'Cancel', value: false }, { label: 'Pull everything back', value: true, primary: true }],
    });
    if (!yes) return;
    const n = await retractMyPosts(sb);
    if (n === null) return msg($('followMsg'), "Couldn't do that. Try again.", 'err');
    msg($('followMsg'), n === 0 ? 'Nothing to pull back — everything was already squad-only.'
                                : `${n} ${n === 1 ? 'post is' : 'posts are'} squad-only again.`, 'ok');
    await reloadActive();
  });

  $('sugRows').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act="follow"]');
    if (!btn) return;
    const row = btn.closest('.sug-row');
    btn.disabled = true;
    btn.textContent = 'Following…';
    const res = await followUser(sb, me.id, row.dataset.uid);
    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = 'Follow';
      return msg($('followMsg'), reasonMessage(res.reason), 'err');
    }
    followingIds.add(row.dataset.uid);
    await paintSuggestions();
    if (tab === 'following') await loadFollowing({ reset: true });
  });

  $('followMore').addEventListener('click', () => loadFollowing({ reset: false }));
  $('discoverMore').addEventListener('click', () => loadDiscover({ reset: false }));
  wirePostActions($('followPosts'));
  wirePostActions($('discoverPosts'));
}

async function switchTab(next) {
  if (tab === next) return;
  tab = next;
  for (const b of document.querySelectorAll('#tabs button')) {
    b.setAttribute('aria-selected', String(b.dataset.tab === next));
  }
  $('paneSquad').hidden = next !== 'squad';
  $('paneFollowing').hidden = next !== 'following';
  $('paneDiscover').hidden = next !== 'discover';
  if (next === 'following') {
    paintPrivacy();
    await loadFollowing({ reset: true });
  } else if (next === 'discover') {
    await loadDiscover({ reset: true });
  }
}

/**
 * Run one startup step in isolation.
 *
 * Logs with a label so a browser console names the step that failed rather than
 * just the stack, and never rethrows: the caller keeps going.
 */
async function step(label, fn) {
  try { await fn(); } catch (e) { console.error(`[pacr] feed step "${label}" failed`, e); }
  return null;
}

async function showFeed() {
  $('paneBoot').hidden = true;
  $('paneFeed').hidden = false;

  // Display name drives both avatars and is not on the auth user.
  try {
    const { data } = await sb.from('users').select('display_name').eq('id', me.id).maybeSingle();
    paintIdentity(data?.display_name ?? me.email ?? '—');
  } catch { paintIdentity(me.email ?? '—'); }

  squads = await loadSquads();
  if (squads.length === 0) {
    $('squadChips').hidden = true;
    $('composer').hidden = true;
    $('tabs').hidden = true;
    $('posts').innerHTML = '';
    return msg($('feedMsg'),
      'You are not in a squad yet. Join or create one in the app and it will show up here.');
  }

  activeSquad = squads[0];
  paintChips();

  $('squadChips').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn || btn.dataset.id === activeSquad.id) return;
    switchSquad(btn.dataset.id);
  });
  $('moreBtn').addEventListener('click', () => loadPage({ reset: false }));
  $('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (btn) switchTab(btn.dataset.tab);
  });
  // Each of these is independently guarded. They were one unbroken sequence,
  // which meant a single throw anywhere in it silently killed everything after
  // — composer chips, posts and the whole sidebar — leaving a half-drawn page
  // with no error on it. The posts are the page; nothing optional gets to take
  // them down.
  await step('wire', async () => {
    wireComposer();
    wirePostActions($('posts'));
    wireFollowingPane();
  });
  await step('follows', async () => {
    followingIds = new Set(await listFollowingIds(sb, me.id));
  });
  await step('composer', async () => {
    targetIds = [activeSquad.id];
    paintTargets();
    setComposerEnabled();
  });
  await step('members', async () => { members = await listMembers(sb, activeSquad.id); });

  await step('posts', () => loadPage({ reset: true }));
  await Promise.all([
    step('headStats', paintHeadStats),
    step('board', paintBoard),
    step('suggestions', paintSuggestions),
    step('routes', paintRoutes),
  ]);
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
  try {
    await showFeed();
  } catch (e) {
    console.error('[pacr] feed failed to start', e);
    $('paneBoot').hidden = true;
    $('paneFeed').hidden = false;
    msg($('feedMsg'), "Something went wrong loading your feed. Refresh to try again.", 'err');
  }
}
