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
import { renderBody, activeMentionQuery, applyMention, countMentions, MAX_MENTIONS_PER_BODY } from './mentions.js';
import { findBlockedTerm, BLOCKED_CONTENT_MESSAGE } from './content-filter.js';
import {
  POST_SELECT, MAX_BODY, MAX_COMMENT,
  createTextPost, createImagePost, downscaleImage,
  toggleLike, setPinned, deletePost,
  listComments, addComment, deleteComment, listMembers,
} from './feed-write.js';
import {
  REPORT_REASONS, reportContent, blockUser, hasAcceptedRules, acceptRules,
} from './moderation.js';

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

function runStatsHtml(run) {
  if (!run) return '';
  const km = Number(run.distance_km);
  if (!Number.isFinite(km)) return '';
  const pace = fmtPace(run.pace_sec_per_km);
  return `
    <div class="run-stats">
      <span class="run-hero">${km.toFixed(2)}<small>KM</small></span>
      <span class="run-meta">
        <span>Time <b>${esc(fmtDuration(run.duration_sec))}</b></span>
        ${pace ? `<span>Pace <b>${esc(pace)}</b></span>` : ''}
      </span>
    </div>`;
}

function menuHtml(p) {
  const isOwner = activeSquad?.role === 'owner';
  const items = [];
  if (isOwner) {
    items.push(`<button type="button" data-act="pin">${p.pinned ? 'Unpin' : 'Pin to top'}</button>`);
  }
  if (p.is_mine || isOwner) {
    items.push('<button type="button" data-act="delete">Delete post</button>');
  }
  if (!p.is_mine) {
    items.push('<button type="button" data-act="report">Report post</button>');
    items.push('<button type="button" data-act="block">Block this runner</button>');
  }
  if (items.length === 0) return '';
  return `
    <details class="menu">
      <summary aria-label="Post actions">···</summary>
      <div class="menu-list">${items.join('')}</div>
    </details>`;
}

function postHtml(p) {
  const likeWord = p.like_count === 1 ? 'like' : 'likes';
  const cmtWord = p.comment_count === 1 ? 'comment' : 'comments';
  return `
    <article class="post" data-id="${esc(p.id)}">
      <div class="post-top">
        <div class="avatar">${esc(initials(p.author_name))}</div>
        <div style="flex:1; min-width:0;">
          <div class="author">${esc(p.author_name)}</div>
          <div class="when">${esc(timeAgo(p.created_at))}</div>
        </div>
        ${p.pinned ? '<span class="pill">Pinned</span>' : ''}
        ${menuHtml(p)}
      </div>
      ${p.body ? `<p class="body">${renderBody(p.body)}</p>` : ''}
      ${p.image_url ? `<img class="post-img" src="${esc(p.image_url)}" alt="" loading="lazy">` : ''}
      ${runStatsHtml(p.run)}
      <div class="acts">
        <button type="button" class="act ${p.liked_by_me ? 'on' : ''}" data-act="like"
                aria-pressed="${!!p.liked_by_me}">
          <span class="act-mark">▲</span> ${p.like_count} ${likeWord}
        </button>
        <button type="button" class="act" data-act="comments" aria-expanded="false">
          ${p.comment_count} ${cmtWord}
        </button>
      </div>
      <div class="comments" hidden></div>
    </article>`;
}

/** Re-render one card in place from postState — used after like/pin/comment. */
function repaint(postId) {
  const el = document.querySelector(`article.post[data-id="${CSS.escape(postId)}"]`);
  const p = postState.get(postId);
  if (!el || !p) return;
  const openComments = !el.querySelector('.comments').hidden;
  const commentsHtml = el.querySelector('.comments').innerHTML;
  el.outerHTML = postHtml(p);
  if (openComments) {
    const next = document.querySelector(`article.post[data-id="${CSS.escape(postId)}"]`);
    const box = next.querySelector('.comments');
    box.innerHTML = commentsHtml;
    box.hidden = false;
    next.querySelector('[data-act="comments"]').setAttribute('aria-expanded', 'true');
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
      created_at: row.created_at,
      like_count: Number(row.post_likes?.[0]?.count) || 0,
      comment_count: Number(row.post_comments?.[0]?.count) || 0,
      liked_by_me: likedIds.has(row.id),
      is_mine: row.author_id === me.id,
    };
    postState.set(p.id, p);
    return postHtml(p);
  }).join('');
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
    msg(feedMsg, 'No posts in this squad yet. Be the first — say something below.');
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
    <form class="cmt-form" data-act="cmt-form">
      <input type="text" class="input cmt-input" name="body" maxlength="${MAX_COMMENT}"
             placeholder="Add a comment" aria-label="Add a comment" autocomplete="off">
      <button type="submit" class="btn-quiet">Reply</button>
    </form>
    <p class="msg cmt-msg" hidden></p>`;
}

async function submitComment(article, postId, form) {
  const input = form.querySelector('.cmt-input');
  const note = article.querySelector('.cmt-msg');
  const body = input.value.trim();
  if (!body) return;

  const term = findBlockedTerm(body);
  if (term) return msg(note, BLOCKED_CONTENT_MESSAGE, 'err');
  if (!(await ensureRules())) return;

  msg(note, '');
  input.disabled = true;
  const res = await addComment(sb, postId, body);
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
  await loadPage({ reset: true });
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

/** Target chips: which squads this post goes to. Defaults to the active one. */
function paintTargets() {
  const host = $('cTargets');
  const options = postableSquads();
  if (options.length === 0) {
    host.innerHTML = '';
    return;
  }
  const selected = currentTargets();
  const all = options.length > 1 && selected.length === options.length;
  host.innerHTML = [
    ...options.map(s => `
      <button type="button" class="chip" data-target="${esc(s.id)}"
              aria-pressed="${selected.includes(s.id)}">${esc(s.name)}</button>`),
    options.length > 1
      ? `<button type="button" class="chip chip-all" data-target="__all"
                 aria-pressed="${all}">All squads</button>`
      : '',
  ].join('');
}

let targetIds = [];
function currentTargets() {
  // Resolved against the live list, so a squad that disappears (left, or
  // flipped to owners-only) silently drops out of the targets.
  const ids = new Set(postableSquads().map(s => s.id));
  return targetIds.filter(id => ids.has(id));
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
  const body = $('cBody').value.trim();
  const note = $('cMsg');
  const targets = currentTargets();

  if (targets.length === 0) return msg(note, 'Pick at least one squad to post to.', 'err');
  if (!body && !pendingPhoto) return msg(note, 'Write something, or add a photo.', 'err');
  if (body.length > MAX_BODY) return msg(note, `Keep it under ${MAX_BODY} characters.`, 'err');
  if (countMentions(body) > MAX_MENTIONS_PER_BODY) {
    return msg(note, `That is more than ${MAX_MENTIONS_PER_BODY} mentions.`, 'err');
  }

  // The server trigger is the authority; this refuses in the same frame rather
  // than round-tripping to a 400.
  const term = findBlockedTerm(body);
  if (term) return msg(note, BLOCKED_CONTENT_MESSAGE, 'err');

  if (!(await ensureRules())) return;

  const btn = $('cPost');
  btn.disabled = true;
  msg(note, targets.length > 1 ? `Posting to ${targets.length} squads…` : 'Posting…');

  // One post per squad, sequentially — mirroring onPostToSquad in the app.
  // Storage reads are gated by the circle id in the object path, so each squad
  // needs its own copy of the image: squad A's members cannot read an object
  // filed under squad B.
  const posted = [];
  const failed = [];
  for (const id of targets) {
    const squad = squads.find(s => s.id === id);
    const res = pendingPhoto
      ? await createImagePost(sb, id, 'photo', pendingPhoto, body || null, null)
      : await createTextPost(sb, id, body);
    if (res.ok) posted.push({ id, row: res.row });
    else failed.push({ name: squad?.name ?? 'that squad', reason: res.reason });
  }

  btn.disabled = false;

  if (posted.length > 0) {
    $('cBody').value = '';
    await onPickPhoto(null);
    $('cPhoto').value = '';
    // Show the copy that landed in the squad currently on screen, if any.
    const here = posted.find(p => p.id === activeSquad.id);
    if (here) {
      const html = await hydrate([here.row]);
      $('posts').insertAdjacentHTML('afterbegin', html);
      msg($('feedMsg'), '');
    }
  }

  if (failed.length === 0) {
    msg(note, posted.length > 1 ? `Posted to ${posted.length} squads.` : 'Posted.', 'ok');
    setTimeout(() => msg(note, ''), 4000);
  } else if (posted.length === 0) {
    msg(note, reasonMessage(failed[0].reason), 'err');
  } else {
    msg(note, `Posted to ${posted.length}. Failed for ${failed.map(f => f.name).join(', ')}.`, 'err');
  }
}

// ─── Mention autocomplete ───────────────────────────────────────────────────

function paintMentionPicker(input, box) {
  const q = activeMentionQuery(input.value, input.selectionStart ?? 0);
  if (q === null || members.length === 0) { box.hidden = true; box.innerHTML = ''; return; }
  const needle = q.toLowerCase();
  const hits = members
    .filter(m => m.userId !== me.id && m.displayName.toLowerCase().includes(needle))
    .slice(0, 6);
  if (hits.length === 0) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = hits.map(m => `
    <button type="button" data-uid="${esc(m.userId)}" data-name="${esc(m.displayName)}">
      ${esc(m.displayName)}
    </button>`).join('');
}

function wireMentions(input, box) {
  const refresh = () => paintMentionPicker(input, box);
  input.addEventListener('input', refresh);
  input.addEventListener('click', refresh);
  input.addEventListener('keyup', (e) => { if (e.key.startsWith('Arrow')) refresh(); });
  input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
  box.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('button[data-uid]');
    if (!btn) return;
    e.preventDefault();
    const { body, caret } = applyMention(
      input.value, input.selectionStart ?? 0, btn.dataset.name, btn.dataset.uid,
    );
    input.value = body;
    input.setSelectionRange(caret, caret);
    box.hidden = true;
    input.focus();
  });
}

// ─── Wiring ─────────────────────────────────────────────────────────────────

async function switchSquad(id) {
  activeSquad = squads.find(s => s.id === id) ?? activeSquad;
  paintChips();
  targetIds = [activeSquad.id];
  paintTargets();
  setComposerEnabled();
  members = await listMembers(sb, activeSquad.id);
  await loadPage({ reset: true });
}

function wirePostActions() {
  $('posts').addEventListener('click', async (e) => {
    const article = e.target.closest('article.post');
    if (!article) return;
    const postId = article.dataset.id;
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;

    switch (btn.dataset.act) {
      case 'like':      return onLike(postId);
      case 'comments':  return openComments(article, postId);
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

  $('posts').addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-act="cmt-form"]');
    if (!form) return;
    e.preventDefault();
    const article = form.closest('article.post');
    submitComment(article, article.dataset.id, form);
  });
}

function wireComposer() {
  $('cTargets').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-target]');
    if (!btn) return;
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

async function showFeed() {
  $('paneBoot').hidden = true;
  $('paneFeed').hidden = false;

  squads = await loadSquads();
  if (squads.length === 0) {
    $('feedTitle').textContent = 'No squad yet';
    $('squadChips').hidden = true;
    $('composer').hidden = true;
    $('posts').innerHTML = '';
    return msg($('feedMsg'),
      'You are not in a squad yet. Join or create one in the app and it will show up here.');
  }

  activeSquad = squads[0];
  $('feedTitle').textContent = squads.length > 1 ? 'Your feed' : activeSquad.name;
  paintChips();

  $('squadChips').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn || btn.dataset.id === activeSquad.id) return;
    switchSquad(btn.dataset.id);
  });
  $('moreBtn').addEventListener('click', () => loadPage({ reset: false }));
  wireComposer();
  wirePostActions();

  targetIds = [activeSquad.id];
  paintTargets();
  setComposerEnabled();
  members = await listMembers(sb, activeSquad.id);
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
