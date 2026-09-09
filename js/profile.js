// ─────────────────────────────────────────────────────────────────────────────
// /profile — a runner's profile: yours by default, someone else's with ?r=<ref>
//
// Implements "PACR Profile.dc.html" from the Claude Design project. Like /feed,
// this page needs a real identity and gets one the same way: every RLS policy in
// the app project keys off auth.uid(), so a signed-in browser reads exactly what
// the app reads and nothing else.
//
// ── Viewing someone else ────────────────────────────────────────────────────
//
// The link carries a base64url ref, not a uuid — see js/ids.js and
// [[never-surface-raw-ids]]. The ref is not access control; RLS is. A profile is
// readable when `users_select_co_members` or `users_select_followed` says so,
// which is to say: someone you share a squad with, or someone you follow. Any
// other ref lands on the "not visible" pane, because the row simply does not
// come back.
//
// Two things do not exist on someone else's profile, and their absence is the
// schema working, not a gap:
//
//   • THEIR followers and following. `follows_select_own` shows you only the
//     edges you are an endpoint of — there is deliberately no "who follows X"
//     for a third party, or the whole social graph would be walkable with the
//     shipped anon key. You can see whether they follow you and whether you
//     follow them, and that is the lot.
//   • Their run history, unless you share a squad. `run_summaries_select_followed`
//     exposes only the runs that back a post you can already see, so a follower's
//     view is a partial set by design. A twelve-week chart drawn from a partial
//     set is a lie with a y-axis, so the Overview and Milestones tabs are simply
//     absent for a runner you only follow.
//
// ── What the design carries and this page does not ──────────────────────────
// For want of a data source rather than for want of effort: cover photo (no
// column, no bucket — the band keeps the stripes), handle, bio and location
// (public.users has display_name, home_neighborhood and a streak, and no free
// text), and the current plan, next session, readiness and gear, all generated
// on the phone. Badges too, so the Achievements tab became Milestones: firsts
// that ARE derivable from run_summaries.
//
// Personal bests get the same treatment. The app's records are split records —
// the fastest 5 K *inside* a longer run — and splits are not synced. So this
// page shows whole-run bests and says so on the card, rather than printing a
// slower number under the same word the app uses.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase, esc, initials, num, signedUrlsFor } from './supabase.js';
import { mountHeaderAuth, signinHref, signOut } from './auth.js';
import { renderBody } from './mentions.js';
import { POST_SELECT } from './feed-write.js';
import {
  followCounts, listFollowEdges, followUser, unfollowUser, retractMyPosts,
} from './follow.js';
import { decodeUserRef, profileHref } from './ids.js';
import { openModal } from './modal.js';

const PAGE_SIZE = 10;
/** Runs pulled for the charts and bests. Rows are ~80 bytes; this is one
 *  request either way, and anything past it is reported rather than hidden. */
const RUN_CAP = 2000;
/** People listed under Squads. Above this it stops being a list. */
const PEOPLE_CAP = 200;

const $ = (id) => document.getElementById(id);

let sb = null;
let me = null;
/** My own users row — the header avatar stays mine on someone else's profile. */
let myRow = null;

/** Whose profile this is. subject.id === me.id when it is mine. */
let subjectId = null;
let subject = null;
let isMe = true;
/** Rendered once and reused on every post card. */
let subjectFaceHtml = '';

/** How I relate to the subject. Empty and unused when the profile is mine. */
let rel = { sharedSquads: [], iFollow: false, followsMe: false };
/**
 * Whether `runs` is their whole history or only the runs behind posts I can
 * see. Everything derived from a full history — the load chart, the bests, the
 * milestones — is gated on this.
 */
let runsComplete = true;

let runs = [];
let runCount = 0;
let postCount = 0;
/** Mine on my profile; the ones we share on someone else's. */
let squads = [];
let counts = { followers: 0, following: 0 };

let tab = 'overview';
const loaded = { posts: false, squads: false };
let postCursor = null;
let postsLoading = false;
let peopleView = 'following';

// ─── Formatting ─────────────────────────────────────────────────────────────
// Ported from feed.js so the two pages format a pace, a duration and a
// timestamp identically.

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

function fmtDate(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMonth(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function msg(el, text, kind) {
  if (!el) return;
  if (!text) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = text;
  el.className = `msg ${kind ?? ''}`.trim();
}

/** ISO-8601 week key, matching computeWeekKey in the app's runSync. */
function isoWeekKey(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** The Monday a week key names — the inverse of isoWeekKey, for axis labels. */
function isoWeekMonday(key) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(key ?? ''));
  if (!m) return null;
  const [year, week] = [Number(m[1]), Number(m[2])];
  // 4 January is always in ISO week 1, so its Monday anchors the year.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  return monday;
}

function weekLabel(key) {
  const monday = isoWeekMonday(key);
  return monday
    ? `WEEK OF ${monday.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : String(key ?? '');
}

/** Pace of a run: the recorded one, or derived when the row predates it. */
function runPace(r) {
  const recorded = Number(r.pace_sec_per_km);
  if (Number.isFinite(recorded) && recorded > 0) return recorded;
  const km = Number(r.distance_km);
  const sec = Number(r.duration_sec);
  return km > 0 && sec > 0 ? sec / km : null;
}

function placeOf(r) {
  return r.neighborhood ? String(r.neighborhood).toUpperCase() : null;
}

/** A face: signed avatar when the bucket lets us have one, initials otherwise. */
function faceHtml(name, url) {
  return url ? `<img src="${esc(url)}" alt="">` : esc(initials(name));
}

/** Copy for each discriminated follow failure, matching the feed's wording. */
function reasonMessage(reason) {
  return reason === 'email_required'
    ? 'Add an email to your account in the app before following anyone here.'
    : 'Something went wrong. Try again.';
}

// ─── Loads ──────────────────────────────────────────────────────────────────

/**
 * The subject's row, and mine alongside it.
 *
 * One query for both, because the header avatar stays mine while the page is
 * someone else's. A subject row that does not come back is not an error — it is
 * RLS saying this profile is not mine to see, which the caller turns into the
 * "not visible" pane.
 */
async function loadPeopleRows() {
  const ids = isMe ? [me.id] : [me.id, subjectId];
  const { data, error } = await sb.from('users')
    .select('id, display_name, avatar_path, home_neighborhood, current_streak_days, created_at')
    .in('id', ids);
  if (error) throw error;

  const byId = new Map((data ?? []).map(u => [u.id, u]));
  myRow = byId.get(me.id) ?? null;
  subject = byId.get(subjectId) ?? null;

  const signed = await signedUrlsFor(sb, 'avatars',
    [myRow?.avatar_path, subject?.avatar_path].filter(Boolean));
  if (myRow) myRow.avatarUrl = signed.get(myRow.avatar_path) ?? null;
  if (subject) subject.avatarUrl = signed.get(subject.avatar_path) ?? null;
}

/**
 * Squads in common, and the two follow edges between us.
 *
 * Both directions of the edge are readable — I am an endpoint of each — and
 * both are worth showing: "follows you" is the fact that makes a Follow button
 * feel like a reply rather than a cold approach.
 */
async function loadRelationship() {
  const mineIds = (await myCircleIds());
  let sharedSquads = [];
  if (mineIds.length > 0) {
    const { data } = await sb.from('memberships')
      .select('circle_id, role, joined_at, circles(id, name)')
      .eq('user_id', subjectId)
      .in('circle_id', mineIds);
    sharedSquads = (data ?? []).filter(r => r.circles).map(r => ({
      id: r.circles.id, name: r.circles.name, role: r.role, joinedAt: r.joined_at,
    }));
  }

  let iFollow = false;
  let followsMe = false;
  try {
    const { data } = await sb.from('follows')
      .select('follower_id, followee_id')
      .or(`and(follower_id.eq.${me.id},followee_id.eq.${subjectId}),`
        + `and(follower_id.eq.${subjectId},followee_id.eq.${me.id})`);
    for (const row of data ?? []) {
      if (row.follower_id === me.id) iFollow = true;
      if (row.followee_id === me.id) followsMe = true;
    }
  } catch {
    // Unknown reads as "not following", which the button can recover from.
  }
  rel = { sharedSquads, iFollow, followsMe };
}

async function myCircleIds() {
  const { data, error } = await sb.from('memberships')
    .select('circle_id')
    .eq('user_id', me.id);
  return error ? [] : (data ?? []).map(r => r.circle_id);
}

/**
 * The subject's runs, newest first.
 *
 * One query feeds the load chart, the bests table, the year card, the recent
 * list and the milestones. The exact count comes separately and is the number
 * shown, so the stat strip stays true even when the row pull is capped.
 *
 * On someone else's profile RLS decides what comes back: everything if we share
 * a squad, and otherwise only the runs behind posts I can already see — which
 * is why runsComplete gates every block derived from it.
 */
async function loadRuns() {
  const { count } = await sb.from('run_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', subjectId);

  const { data, error } = await sb.from('run_summaries')
    .select('started_at, distance_km, duration_sec, pace_sec_per_km, neighborhood, week_key')
    .eq('user_id', subjectId)
    .order('started_at', { ascending: false })
    .limit(RUN_CAP);
  if (error) throw error;

  runs = (data ?? []).filter(r => Number.isFinite(Number(r.distance_km)));
  runCount = Number.isFinite(count) ? count : runs.length;
}

/** How many of their posts I can see. RLS applies to a count as it does to a
 *  page, so this is the real number for THIS viewer, not their post total. */
async function loadPostCount() {
  const { count } = await sb.from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', subjectId);
  postCount = Number(count) || 0;
}

/** Ported from listMySquads() in pacr/src/services/squads.ts. */
async function loadMySquads() {
  const { data, error } = await sb.from('memberships')
    .select('circle_id, role, joined_at, circles(id, name)')
    .eq('user_id', me.id)
    .order('joined_at', { ascending: true });
  if (error) return [];
  return (data ?? []).filter(r => r.circles).map(r => ({
    id: r.circles.id,
    name: r.circles.name,
    role: r.role,
    joinedAt: r.joined_at,
  }));
}

/** Members per squad, tallied client-side — the same shape the board uses. */
async function memberCounts(circleIds) {
  const tally = new Map(circleIds.map(id => [id, 0]));
  if (circleIds.length === 0) return tally;
  try {
    const { data, error } = await sb.from('memberships')
      .select('circle_id')
      .in('circle_id', circleIds)
      .limit(2000);
    if (error) return tally;
    for (const row of data ?? []) {
      tally.set(row.circle_id, (tally.get(row.circle_id) ?? 0) + 1);
    }
  } catch {}
  return tally;
}

// ─── Identity ───────────────────────────────────────────────────────────────

function paintIdentity() {
  const name = subject?.display_name || (isMe ? (me.email ?? '—') : '—');
  subjectFaceHtml = faceHtml(name, subject?.avatarUrl);

  $('pAvatar').innerHTML = subjectFaceHtml;
  $('pName').textContent = name;
  if (!isMe) document.title = `${name} — PACR`;

  // The header avatar is always mine, whoever the page is about.
  const head = $('meAvatar');
  head.innerHTML = faceHtml(myRow?.display_name || me.email || '—', myRow?.avatarUrl);
  head.hidden = false;

  const streak = Number(subject?.current_streak_days) || 0;
  const bits = [];
  if (subject?.home_neighborhood) bits.push(`<span>${esc(subject.home_neighborhood)}</span>`);
  if (isMe && subject?.created_at) {
    bits.push(`<span>On PACR since ${new Date(subject.created_at).getFullYear()}</span>`);
  }
  if (streak > 0) bits.push(`<span class="live">● ${streak}-day streak</span>`);
  if (!isMe) {
    if (rel.sharedSquads.length > 0) {
      const names = rel.sharedSquads.map(s => s.name).join(', ');
      bits.push(`<span>In your ${rel.sharedSquads.length === 1 ? 'squad' : 'squads'} — ${esc(names)}</span>`);
    }
    if (rel.followsMe) bits.push('<span class="live">● Follows you</span>');
  }
  $('pMeta').innerHTML = bits.join('');
}

/**
 * The buttons under the name.
 *
 * Mine: the two links the design puts there. Someone else's: the design's
 * Follow control, which is the one write this page makes about another person.
 */
function paintActions() {
  if (isMe) {
    $('idActs').innerHTML = `
      <a class="btn" href="/feed">Your feed</a>
      <a class="btn-outline" href="/#get">Get the app</a>`;
    return;
  }
  $('idActs').innerHTML = `
    <button type="button" class="${rel.iFollow ? 'btn-outline' : 'btn'}" data-act="follow"
            aria-pressed="${rel.iFollow}">${rel.iFollow ? 'Following ✓' : 'Follow'}</button>
    <a class="btn-outline" href="/profile">Your profile</a>`;
}

/**
 * The design's five-cell strip.
 *
 * Mine carries the graph and the lifetime totals. Someone else's carries only
 * what this viewer may actually read — no follower counts, because there is no
 * third-party follower graph, and no distance unless we share a squad.
 */
function paintHeadStats() {
  const cells = [];
  if (isMe) {
    const km = runs.reduce((n, r) => n + (Number(r.distance_km) || 0), 0);
    cells.push(
      ['FOLLOWERS', num(counts.followers), 'squads'],
      ['FOLLOWING', num(counts.following), 'squads'],
      ['SQUADS', String(squads.length), 'squads'],
      ['RUNS LOGGED', num(runCount), 'overview'],
      ['DISTANCE', `${km.toFixed(0)} km`, 'overview'],
    );
  } else {
    const streak = Number(subject?.current_streak_days) || 0;
    cells.push(['SQUADS SHARED', String(rel.sharedSquads.length), 'squads']);
    cells.push(['POSTS YOU CAN SEE', num(postCount), 'posts']);
    if (runsComplete) {
      const km = runs.reduce((n, r) => n + (Number(r.distance_km) || 0), 0);
      cells.push(['RUNS LOGGED', num(runCount), 'overview']);
      cells.push(['DISTANCE', `${km.toFixed(0)} km`, 'overview']);
    }
    cells.push(['STREAK', streak > 0 ? `${streak} d` : '—', 'posts']);
  }

  $('headStats').innerHTML = cells.map(([k, v, go]) => `
    <button type="button" class="stat-cell" data-go="${go}">
      <span class="k">${esc(k)}</span>
      <span class="v" style="display:block;">${esc(v)}</span>
    </button>`).join('');
  $('headStats').hidden = false;
}

/**
 * Which tabs exist for this subject.
 *
 * Overview and Milestones are derived from a full run history, so they are
 * absent for a runner whose history RLS only shows in part. Settings is mine
 * alone.
 */
function paintTabs() {
  const allowed = new Set(isMe
    ? ['overview', 'posts', 'milestones', 'squads', 'settings']
    : [...(runsComplete ? ['overview', 'milestones'] : []), 'posts', 'squads']);
  for (const btn of document.querySelectorAll('#tabs button')) {
    btn.hidden = !allowed.has(btn.dataset.tab);
  }
  return allowed.has('overview') ? 'overview' : 'posts';
}

// ─── Overview ───────────────────────────────────────────────────────────────

/** The twelve week keys ending with this one, oldest first. */
function last12Weeks() {
  const out = [];
  const d = new Date();
  for (let i = 11; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(d.getDate() - i * 7);
    out.push(isoWeekKey(day));
  }
  return out;
}

function paintLoad() {
  if (runs.length === 0 || !runsComplete) return;
  const weeks = last12Weeks();
  const byWeek = new Map(weeks.map(w => [w, 0]));
  for (const r of runs) {
    if (byWeek.has(r.week_key)) {
      byWeek.set(r.week_key, byWeek.get(r.week_key) + (Number(r.distance_km) || 0));
    }
  }
  const vals = weeks.map(w => byWeek.get(w));
  const max = Math.max(...vals);

  // A twelve-week chart of zeroes is a chart of nothing. Say so instead.
  if (max <= 0) {
    $('loadHead').textContent = 'TWELVE-WEEK LOAD';
    $('loadBars').innerHTML = '';
    $('loadTrend').textContent = '';
    $('loadStats').innerHTML =
      '<div class="cell" style="grid-column:1/-1;"><div class="k">NOTHING IN THE LAST TWELVE WEEKS</div>'
      + `<div class="d" style="color:#6A6A61;">${isMe ? 'Your' : 'Their'} older runs are still counted everywhere else on this page.</div></div>`;
    $('loadCard').hidden = false;
    return;
  }

  $('loadBars').innerHTML = vals.map((v, i) => {
    const cls = i === vals.length - 1 ? 'now' : (v >= max * 0.78 ? 'mid' : '');
    const h = Math.max(2, Math.round((v / max) * 120));
    return `<span class="${cls}" style="height:${h}px" title="${esc(weekLabel(weeks[i]))} — ${v.toFixed(1)} km"></span>`;
  }).join('');

  const recent = vals.slice(6).reduce((a, b) => a + b, 0);
  const before = vals.slice(0, 6).reduce((a, b) => a + b, 0);
  if (before > 0) {
    const pct = Math.round(((recent - before) / before) * 100);
    $('loadTrend').textContent = pct === 0
      ? 'LEVEL WITH THE SIX BEFORE'
      : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% VS THE SIX WEEKS BEFORE`;
  } else {
    $('loadTrend').textContent = '';
  }

  const thisWeek = vals[vals.length - 1];
  const avg12 = vals.reduce((a, b) => a + b, 0) / 12;
  const totalKm = runs.reduce((n, r) => n + (Number(r.distance_km) || 0), 0);
  const totalSec = runs.reduce((n, r) => n + (Number(r.duration_sec) || 0), 0);
  const lifetimePace = totalKm > 0 ? fmtPace(totalSec / totalKm) : null;
  const longest = runs.reduce((best, r) =>
    (Number(r.distance_km) > Number(best?.distance_km ?? -1) ? r : best), null);

  const cells = [
    ['THIS WEEK', `${thisWeek.toFixed(1)} km`,
      avg12 > 0 ? `${thisWeek >= avg12 ? '+' : '−'}${Math.abs(Math.round(((thisWeek - avg12) / avg12) * 100))}% vs 12-week average` : ''],
    ['WEEKLY AVERAGE', `${avg12.toFixed(1)} km`, 'last twelve weeks'],
    ['AVERAGE PACE', lifetimePace ?? '—', lifetimePace ? 'every run, start to finish' : ''],
    ['LONGEST RUN', longest ? `${Number(longest.distance_km).toFixed(1)} km` : '—',
      longest ? fmtDate(longest.started_at).toLowerCase() : ''],
  ];
  $('loadStats').innerHTML = cells.map(([k, v, d]) => `
    <div class="cell">
      <div class="k">${esc(k)}</div>
      <div class="v">${esc(v)}</div>
      ${d ? `<div class="d">${esc(d)}</div>` : ''}
    </div>`).join('');
  $('loadCard').hidden = false;
}

/**
 * Whole-run bests.
 *
 * Every row here is a run that happened, start to finish. The app's records are
 * segment records — the fastest 5 K inside a longer run — and the segments are
 * not on the server, so the two will not agree and the card says which one this
 * is rather than borrowing the app's word for it.
 */
function paintBests() {
  if (runs.length === 0 || !runsComplete) return;

  const fastestOver = (minKm) => {
    let best = null;
    for (const r of runs) {
      if (Number(r.distance_km) < minKm) continue;
      const pace = runPace(r);
      if (pace === null) continue;
      if (best === null || pace < best.pace) best = { run: r, pace };
    }
    return best;
  };

  const byWeek = new Map();
  for (const r of runs) {
    const w = byWeek.get(r.week_key) ?? { km: 0, runs: 0 };
    w.km += Number(r.distance_km) || 0;
    w.runs += 1;
    byWeek.set(r.week_key, w);
  }
  const weeks = [...byWeek.entries()];
  const biggest = weeks.reduce((a, b) => (b[1].km > (a?.[1].km ?? -1) ? b : a), null);
  const busiest = weeks.reduce((a, b) => (b[1].runs > (a?.[1].runs ?? -1) ? b : a), null);

  const longest = runs.reduce((best, r) =>
    (Number(r.distance_km) > Number(best?.distance_km ?? -1) ? r : best), null);
  const five = fastestOver(5);
  const ten = fastestOver(10);

  const rows = [];
  if (longest) {
    rows.push({
      k: 'LONGEST RUN',
      v: `${Number(longest.distance_km).toFixed(2)} km`,
      w: [fmtDate(longest.started_at), placeOf(longest), fmtDuration(longest.duration_sec)]
        .filter(Boolean).join(' · '),
      top: true,
    });
  }
  if (five) {
    rows.push({
      k: 'FASTEST 5 KM+',
      v: fmtPace(five.pace) ?? '—',
      w: [`${Number(five.run.distance_km).toFixed(2)} km`, fmtDate(five.run.started_at), placeOf(five.run)]
        .filter(Boolean).join(' · '),
    });
  }
  if (ten) {
    rows.push({
      k: 'FASTEST 10 KM+',
      v: fmtPace(ten.pace) ?? '—',
      w: [`${Number(ten.run.distance_km).toFixed(2)} km`, fmtDate(ten.run.started_at), placeOf(ten.run)]
        .filter(Boolean).join(' · '),
    });
  }
  if (biggest && biggest[1].km > 0) {
    rows.push({
      k: 'BIGGEST WEEK',
      v: `${biggest[1].km.toFixed(1)} km`,
      w: `${weekLabel(biggest[0])} · ${biggest[1].runs} ${biggest[1].runs === 1 ? 'RUN' : 'RUNS'}`,
    });
  }
  if (busiest && busiest[1].runs > 1) {
    rows.push({
      k: 'MOST RUNS IN A WEEK',
      v: String(busiest[1].runs),
      w: `${weekLabel(busiest[0])} · ${busiest[1].km.toFixed(1)} KM`,
    });
  }
  if (rows.length === 0) return;

  $('bestsRows').innerHTML = rows.map(r => `
    <div class="best-row ${r.top ? 'top' : ''}">
      <span class="best-k">${esc(r.k)}</span>
      <span class="best-v">${esc(r.v)}</span>
      <span class="best-w">${esc(r.w)}</span>
    </div>`).join('');
  $('bestsCard').hidden = false;
}

// ─── Sidebar ────────────────────────────────────────────────────────────────

function paintYear() {
  if (!runsComplete) return;
  const year = new Date().getFullYear();
  const mine = runs.filter(r => new Date(r.started_at).getFullYear() === year);
  if (mine.length === 0) return;

  const km = mine.reduce((n, r) => n + (Number(r.distance_km) || 0), 0);
  const sec = mine.reduce((n, r) => n + (Number(r.duration_sec) || 0), 0);
  const longest = mine.reduce((b, r) => Math.max(b, Number(r.distance_km) || 0), 0);
  const byWeek = new Map();
  for (const r of mine) byWeek.set(r.week_key, (byWeek.get(r.week_key) ?? 0) + (Number(r.distance_km) || 0));
  const bestWeek = Math.max(0, ...byWeek.values());

  const cells = [
    ['DISTANCE', `${km.toFixed(0)} km`],
    ['RUNS', num(mine.length)],
    ['TIME', `${Math.round(sec / 3600)} h`],
    ['LONGEST', `${longest.toFixed(1)} km`],
    ['BEST WEEK', `${bestWeek.toFixed(0)} km`],
    ['WEEKS RUN', String(byWeek.size)],
  ];
  $('yearK').textContent = `${year}`;
  $('yearTitle').textContent = isMe ? 'Your running' : 'Their running';
  $('yearRows').innerHTML = cells.map(([k, v]) => `
    <div class="cell"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('');

  // Say it plainly when the numbers do not cover everything.
  if (runs.length < runCount) {
    $('yearNote').textContent =
      `TOTALS COVER THE MOST RECENT ${num(runs.length)} OF ${num(runCount)} RUNS`;
    $('yearNote').hidden = false;
  }
  $('yearCard').hidden = false;
}

function paintRecent() {
  if (!runsComplete) return;
  const recent = runs.slice(0, 5);
  if (recent.length === 0) return;
  $('recentRows').innerHTML = recent.map(r => {
    const pace = fmtPace(runPace(r));
    const meta = [fmtDate(r.started_at), placeOf(r)].filter(Boolean).join(' · ');
    return `<div class="run-row">
      <span>
        <span class="run-name">${esc(Number(r.distance_km).toFixed(2))} km</span>
        <span class="run-meta">${esc(meta)}</span>
      </span>
      <span class="run-val">${esc(pace ?? fmtDuration(r.duration_sec))}</span>
    </div>`;
  }).join('');
  $('recentCard').hidden = false;
}

/** The app card is a pitch on my own profile and an explanation on someone
 *  else's, where the missing blocks need a reason rather than a download link. */
function paintAppCard() {
  if (isMe) return;
  $('appTitle').textContent = 'What you cannot see';
  $('appBody').textContent = runsComplete
    ? 'Their route traces, splits, badges and coach plan never leave their phone. '
      + 'This page shows what has synced, and only to the squads you share.'
    : 'You follow this runner but share no squad, so their run history stays private. '
      + 'You see the posts they chose to share with followers, and nothing else.';
  $('appStores').hidden = true;
}

// ─── Milestones ─────────────────────────────────────────────────────────────

const DISTANCE_FIRSTS = [
  [5,    'First five kilometres'],
  [10,   'First ten kilometres'],
  [21.1, 'First half-marathon distance'],
  [42.2, 'First marathon distance'],
];

/**
 * Firsts, derived rather than recorded.
 *
 * "First" means first in the rows this page can see, which is the whole synced
 * history — the tab does not exist otherwise — so it is right unless the pull
 * was capped, and the note says so when it was.
 */
function paintMilestones() {
  const oldestFirst = [...runs].sort(
    (a, b) => new Date(a.started_at) - new Date(b.started_at));
  if (oldestFirst.length === 0) {
    msg($('mileMsg'), isMe
      ? 'Log a run in the app and your firsts show up here.'
      : 'No runs have synced for this runner yet.');
    $('mileCard').hidden = true;
    return;
  }

  const items = [];
  const first = oldestFirst[0];
  items.push({
    at: first.started_at,
    title: 'First run on PACR',
    detail: `${Number(first.distance_km).toFixed(2)} km in ${fmtDuration(first.duration_sec)}`
      + (first.neighborhood ? ` at ${first.neighborhood}.` : '.'),
    value: fmtPace(runPace(first)) ?? '',
  });

  for (const [km, title] of DISTANCE_FIRSTS) {
    const hit = oldestFirst.find(r => Number(r.distance_km) >= km);
    // Skip the one that IS the first run — it is already the row above.
    if (!hit || hit.started_at === first.started_at) continue;
    items.push({
      at: hit.started_at,
      title,
      detail: `${Number(hit.distance_km).toFixed(2)} km in ${fmtDuration(hit.duration_sec)}`
        + (hit.neighborhood ? ` at ${hit.neighborhood}.` : '.'),
      value: fmtPace(runPace(hit)) ?? '',
    });
  }

  const longest = oldestFirst.reduce((best, r) =>
    (Number(r.distance_km) > Number(best.distance_km) ? r : best), oldestFirst[0]);
  if (longest.started_at !== first.started_at) {
    items.push({
      at: longest.started_at,
      title: 'Longest run so far',
      detail: `Further than anything before it${longest.neighborhood ? `, at ${longest.neighborhood}` : ''}.`,
      value: `${Number(longest.distance_km).toFixed(2)} km`,
    });
  }

  // Newest first, the way the design lists them.
  items.sort((a, b) => new Date(b.at) - new Date(a.at));

  $('mileRows').innerHTML = items.map(m => `
    <div class="mile-row">
      <div class="mile-date">${esc(fmtDate(m.at))}</div>
      <div class="mile-main">
        <div class="mile-title">${esc(m.title)}</div>
        <div class="mile-detail">${esc(m.detail)}</div>
      </div>
      <div class="mile-val">${esc(m.value)}</div>
    </div>`).join('');
  $('mileCard').hidden = false;

  msg($('mileMsg'), runs.length < runCount
    ? `Firsts are read from the most recent ${num(runs.length)} runs.`
    : null);
}

// ─── Squads and people ──────────────────────────────────────────────────────

async function paintSquads() {
  const host = $('squadRows');
  if (squads.length === 0) {
    $('squadsHead').textContent = isMe ? 'SQUADS' : 'SQUADS YOU SHARE';
    host.innerHTML = `<div class="card-empty">${isMe
      ? 'You are not in a squad yet. Join or create one in the app and it will show up here.'
      : 'You share no squad with this runner. You can see them because you follow them.'}</div>`;
    return;
  }
  const tally = await memberCounts(squads.map(s => s.id));
  $('squadsHead').textContent = isMe
    ? `SQUADS & CLUBS — ${squads.length} JOINED`
    : `SQUADS YOU SHARE — ${squads.length}`;
  host.innerHTML = squads.map(s => {
    const n = tally.get(s.id) ?? 0;
    const meta = [
      n > 0 ? `${num(n)} ${n === 1 ? 'MEMBER' : 'MEMBERS'}` : null,
      s.joinedAt ? `JOINED ${fmtMonth(s.joinedAt)}` : null,
    ].filter(Boolean).join(' · ');
    return `<div class="squad-row">
      <div class="squad-chip ${s.role === 'owner' ? '' : 'guest'}">${esc(initials(s.name))}</div>
      <div class="squad-main">
        <div class="squad-name">${esc(s.name)}</div>
        <div class="squad-meta">${esc(meta)}</div>
      </div>
      <div class="squad-role">${s.role === 'owner' ? 'OWNER' : 'MEMBER'}</div>
      <a class="chip" href="/feed">Open</a>
    </div>`;
  }).join('');
}

/**
 * Followers and Following — mine only.
 *
 * The follows table lets me see the edges I am an endpoint of, but a NAME needs
 * public.users, which I may read only for squadmates and for people I follow.
 * So Following always resolves and Followers may not: a stranger who follows me
 * is a row I can count and cannot name. That is the schema working as designed
 * — there is no "who follows X" for anyone, mine included, which is also why
 * this card does not exist on someone else's profile.
 *
 * Every name that DOES resolve is a link to that runner's profile, which is the
 * only way into one: there is no directory, and no URL you can construct.
 */
async function paintPeople() {
  const host = $('peopleRows');
  const note = $('peopleNote');
  host.innerHTML = '<div class="card-empty">Loading…</div>';

  const edges = await listFollowEdges(sb, me.id, peopleView, PEOPLE_CAP);
  $('peopleHead').textContent = peopleView === 'following'
    ? `PEOPLE — ${num(counts.following)} FOLLOWING`
    : `PEOPLE — ${num(counts.followers)} ${counts.followers === 1 ? 'FOLLOWER' : 'FOLLOWERS'}`;

  if (edges.length === 0) {
    note.hidden = true;
    host.innerHTML = `<div class="card-empty">${peopleView === 'following'
      ? 'You are not following anyone yet. The Following and Discover tabs on your feed are where that starts.'
      : 'Nobody follows you yet.'}</div>`;
    return;
  }

  const ids = edges.map(e => e.userId);
  const people = new Map();
  try {
    const { data } = await sb.from('users')
      .select('id, display_name, avatar_path, home_neighborhood, current_streak_days')
      .in('id', ids);
    for (const u of data ?? []) people.set(u.id, u);
  } catch {
    // Names unresolved; handled below exactly like an unreadable row.
  }

  const signed = await signedUrlsFor(sb, 'avatars',
    [...people.values()].map(u => u.avatar_path).filter(Boolean));

  const rows = [];
  let hidden = 0;
  for (const edge of edges) {
    const u = people.get(edge.userId);
    if (!u) { hidden += 1; continue; }
    const href = profileHref(u.id);
    const url = u.avatar_path ? signed.get(u.avatar_path) : null;
    const streak = Number(u.current_streak_days) || 0;
    const meta = [
      u.home_neighborhood ? String(u.home_neighborhood).toUpperCase() : null,
      streak > 0 ? `${streak}-DAY STREAK` : null,
      edge.since ? `SINCE ${fmtMonth(edge.since).toUpperCase()}` : null,
    ].filter(Boolean).slice(0, 2).join(' · ');
    // No href should be unreachable — the id came from a uuid column — but a
    // plain div is the right fallback if one ever is.
    const tag = href ? 'a' : 'div';
    rows.push(`<${tag} class="person"${href ? ` href="${esc(href)}"` : ''}>
      <div class="person-av">${faceHtml(u.display_name, url)}</div>
      <div class="person-main">
        <div class="person-name">${esc(u.display_name ?? '—')}</div>
        <div class="person-meta">${esc(meta)}</div>
      </div>
      <span class="person-go">→</span>
    </${tag}>`);
  }

  host.innerHTML = rows.join('') || '<div class="card-empty">Nobody here you can see.</div>';
  if (hidden > 0) {
    note.textContent = peopleView === 'following'
      ? `${num(hidden)} MORE NOT SHOWN`
      : `${num(hidden)} ${hidden === 1 ? 'RUNNER FOLLOWS' : 'RUNNERS FOLLOW'} YOU WHOSE NAME YOU CANNOT SEE — `
        + 'PACR ONLY SHOWS THE NAMES OF PEOPLE YOU SHARE A SQUAD WITH OR FOLLOW BACK';
    note.hidden = false;
  } else {
    note.hidden = true;
  }
}

// ─── Posts ──────────────────────────────────────────────────────────────────
// Read-only on purpose. Kudos, comments, pinning, deleting and reporting all
// live on /feed, where the post sits next to the squad it went to; a second
// copy of those controls here would be a second copy of their failure paths.

function statsGridHtml(p) {
  const run = p.run;
  if (!run) return '';
  const km = Number(run.distance_km);
  if (!Number.isFinite(km)) return '';
  const cells = [
    ['DISTANCE', `${km.toFixed(2)} km`],
    ['TIME', fmtDuration(run.duration_sec)],
    ['AVG PACE', fmtPace(run.pace_sec_per_km) ?? '—'],
    ['STARTED', run.started_at
      ? new Date(run.started_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '—'],
  ];
  return `<div class="post-stats">${cells.map(([k, v]) => `
    <div class="cell"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>`;
}

function headlineHtml(p) {
  if (!p.run) return '';
  const km = Number(p.run.distance_km);
  if (!Number.isFinite(km)) return '';
  const where = p.run.neighborhood ? ` · ${p.run.neighborhood}` : '';
  return `<div class="post-headline">${esc(`${km.toFixed(2)} km${where}`)}</div>`;
}

function postHtml(p) {
  const audience = p.visibility === 'public' ? 'PUBLIC'
    : p.visibility === 'followers' ? 'FOLLOWERS' : 'SQUAD';
  const likes = `${num(p.like_count)} kudos`;
  const comments = `${num(p.comment_count)} ${p.comment_count === 1 ? 'comment' : 'comments'}`;
  return `
    <article class="post">
      <div class="post-top">
        <div class="avatar">${subjectFaceHtml}</div>
        <div class="post-who">
          <div class="post-name-row"><span class="post-name">${esc(p.author_name)}</span></div>
          <div class="post-meta">${esc(timeAgo(p.created_at))}${p.pinned ? ' · PINNED' : ''}</div>
        </div>
        <div class="post-tag">${audience}</div>
      </div>
      <div class="post-lede">
        ${headlineHtml(p)}
        ${p.body ? `<p class="post-body">${renderBody(p.body)}</p>` : ''}
      </div>
      ${statsGridHtml(p)}
      ${p.image_url ? `<div class="post-media"><img src="${esc(p.image_url)}" alt="" loading="lazy"></div>` : ''}
      <div class="post-foot">
        <span class="counts">${esc(likes)} · ${esc(comments)}</span>
        <a href="/feed">Open in your feed</a>
      </div>
    </article>`;
}

async function loadPosts({ reset }) {
  if (postsLoading) return;
  postsLoading = true;
  if (reset) { postCursor = null; $('myPosts').innerHTML = ''; }

  try {
    let q = sb.from('posts')
      .select(POST_SELECT)
      .eq('author_id', subjectId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE);
    if (postCursor) {
      q = q.or(
        `created_at.lt."${postCursor.createdAt}",`
        + `and(created_at.eq."${postCursor.createdAt}",id.lt."${postCursor.id}")`,
      );
    }
    const { data, error } = await q;
    if (error) throw error;

    const rows = data ?? [];
    const urlByPath = await signedUrlsFor(sb, 'post-images',
      rows.map(r => r.image_path).filter(Boolean));

    const html = rows.map(row => postHtml({
      author_name: subject?.display_name ?? me.email ?? '—',
      body: row.body,
      image_url: row.image_path ? (urlByPath.get(row.image_path) ?? null) : null,
      run: row.run ?? null,
      pinned: !!row.pinned,
      visibility: row.visibility ?? 'circle',
      created_at: row.created_at,
      like_count: Number(row.post_likes?.[0]?.count) || 0,
      comment_count: Number(row.post_comments?.[0]?.count) || 0,
    })).join('');

    $('myPosts').insertAdjacentHTML('beforeend', html);
    const last = rows[rows.length - 1];
    postCursor = rows.length === PAGE_SIZE && last
      ? { createdAt: last.created_at, id: last.id }
      : null;
    $('moreBtn').hidden = postCursor === null;

    const total = $('myPosts').children.length;
    msg($('postsMsg'), total === 0
      ? (isMe
        ? 'You have not posted yet. Runs and photos are posted from the app, or from the composer on your feed.'
        : 'Nothing from this runner that you can see. Posts reach their squads first, and only what they send to followers reaches you.')
      : null);
    if (tab === 'posts') paintCountLine();
  } catch (e) {
    console.warn('[pacr] profile posts failed', e);
    msg($('postsMsg'), "Couldn't load these posts. Refresh to try again.", 'err');
  } finally {
    postsLoading = false;
  }
}

// ─── Settings (mine only) ───────────────────────────────────────────────────

function paintSettings() {
  const name = subject?.display_name ?? '—';
  $('accountRows').innerHTML = `
    <div class="set-row">
      <div class="set-main">
        <div class="set-title">${esc(name)}</div>
        <div class="set-help">Your name and profile photo are edited in the app, under Profile.
          The app is where your account was made and where it stays the source of truth.</div>
      </div>
      <a class="chip" href="/#get">Get the app</a>
    </div>
    <div class="set-row">
      <div class="set-main">
        <div class="set-title">${esc(me.email ?? 'Signed in')}</div>
        <div class="set-help">The email this browser is signed in with.</div>
      </div>
      <button type="button" class="chip" data-act="signout">Sign out</button>
    </div>`;

  // Same control, same copy as the feed's Following pane — retraction is a
  // profile-level act and belongs on the profile too.
  $('privacyBox').innerHTML = `
    <div class="set-row">
      <div class="set-main">
        <div class="set-title">Pull everything back</div>
        <div class="set-help">Rewrites every post you have made to squad-only, in every squad it
          went to. Followers and Discover lose them immediately. This cannot be undone — posting
          them again means posting them again.</div>
      </div>
      <button type="button" class="chip" data-act="retract">Make all squad-only</button>
    </div>`;

  $('dataRows').innerHTML = `
    <div class="set-row">
      <div class="set-main">
        <div class="set-title">Delete your account</div>
        <div class="set-help">Deleting your account, runs, posts and photos everywhere is done in
          the app, under Profile. It is deliberately not a button on a web page.</div>
      </div>
    </div>
    <div class="set-row">
      <div class="set-main">
        <div class="set-title">What this page can see</div>
        <div class="set-help">Only what your phone has synced: whole runs, posts, squads and your
          following. Route traces, splits, badges and your coach plan never leave the app.</div>
      </div>
      <a class="chip" href="/privacy">Privacy</a>
    </div>`;
}

async function onRetract() {
  const yes = await openModal({
    title: 'Make every post squad-only?',
    body: '<p>Every post you have written goes back to its squads and nowhere else. '
      + 'Followers and Discover lose them straight away.</p><p>This cannot be undone.</p>',
    options: [
      { label: 'Cancel', value: false },
      { label: 'Pull everything back', value: true, primary: true },
    ],
  });
  if (!yes) return;
  const n = await retractMyPosts(sb);
  if (n === null) return msg($('privacyMsg'), "Couldn't do that. Try again.", 'err');
  msg($('privacyMsg'), n === 0
    ? 'Nothing to pull back — everything was already squad-only.'
    : `${n} ${n === 1 ? 'post is' : 'posts are'} squad-only again.`, 'ok');
  if (loaded.posts) await loadPosts({ reset: true });
}

/**
 * Follow / unfollow the runner this page is about.
 *
 * Unfollowing a runner you share no squad with costs you the sight of them, so
 * it asks first. Unfollowing a squadmate does not — their squad posts are still
 * yours to see, and a confirm on a reversible act is noise.
 */
async function onFollowToggle(btn) {
  if (isMe || !subjectId) return;
  if (rel.iFollow) {
    if (rel.sharedSquads.length === 0) {
      const yes = await openModal({
        title: `Unfollow ${subject?.display_name ?? 'this runner'}?`,
        body: '<p>You share no squad, so this is the whole connection: their posts leave your '
          + 'Following feed and this profile stops showing them.</p><p>You can follow again later.</p>',
        options: [
          { label: 'Cancel', value: false },
          { label: 'Unfollow', value: true, primary: true },
        ],
      });
      if (!yes) return;
    }
    btn.disabled = true;
    const ok = await unfollowUser(sb, me.id, subjectId);
    btn.disabled = false;
    if (!ok) return msg($('idMsg'), 'Something went wrong. Try again.', 'err');
    rel.iFollow = false;
  } else {
    btn.disabled = true;
    const res = await followUser(sb, me.id, subjectId);
    btn.disabled = false;
    if (!res.ok) return msg($('idMsg'), reasonMessage(res.reason), 'err');
    rel.iFollow = true;
  }
  msg($('idMsg'), null);
  paintActions();
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

function paintCountLine() {
  const el = $('countLine');
  if (tab === 'overview') {
    el.textContent = `${num(runCount)} ${runCount === 1 ? 'RUN' : 'RUNS'} LOGGED`;
  } else if (tab === 'posts') {
    const n = $('myPosts').children.length;
    el.textContent = postCursor ? `${num(n)}+ POSTS` : `${num(n)} ${n === 1 ? 'POST' : 'POSTS'}`;
  } else if (tab === 'squads') {
    el.textContent = isMe
      ? `${squads.length} ${squads.length === 1 ? 'SQUAD' : 'SQUADS'} · ${num(counts.following)} FOLLOWING`
      : `${squads.length} ${squads.length === 1 ? 'SQUAD' : 'SQUADS'} IN COMMON`;
  } else if (tab === 'milestones') {
    el.textContent = 'DERIVED FROM SYNCED RUNS';
  } else {
    el.textContent = '';
  }
}

async function switchTab(next, { force = false } = {}) {
  if (tab === next && !force) return;
  tab = next;
  for (const b of document.querySelectorAll('#tabs button')) {
    b.setAttribute('aria-selected', String(b.dataset.tab === next));
  }
  $('paneOverview').hidden = next !== 'overview';
  $('panePosts').hidden = next !== 'posts';
  $('paneMilestones').hidden = next !== 'milestones';
  $('paneSquads').hidden = next !== 'squads';
  $('paneSettings').hidden = next !== 'settings';
  paintCountLine();

  if (next === 'posts' && !loaded.posts) {
    loaded.posts = true;
    await loadPosts({ reset: true });
  } else if (next === 'squads' && !loaded.squads) {
    loaded.squads = true;
    await paintSquads();
    if (isMe) await paintPeople();
  }
}

// ─── Wiring ─────────────────────────────────────────────────────────────────

function wire() {
  $('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (btn) switchTab(btn.dataset.tab);
  });

  $('headStats').addEventListener('click', (e) => {
    const cell = e.target.closest('button[data-go]');
    // A cell can point at a tab this subject does not have (the streak cell
    // falls back to posts); only follow it when the tab is actually there.
    if (!cell) return;
    const btn = document.querySelector(`#tabs button[data-tab="${cell.dataset.go}"]`);
    if (btn && !btn.hidden) switchTab(cell.dataset.go);
  });

  $('moreBtn').addEventListener('click', () => loadPosts({ reset: false }));

  $('idActs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act="follow"]');
    if (btn) onFollowToggle(btn);
  });

  $('peopleCard').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-people]');
    if (!btn || btn.dataset.people === peopleView) return;
    peopleView = btn.dataset.people;
    for (const b of $('peopleCard').querySelectorAll('button[data-people]')) {
      b.setAttribute('aria-pressed', String(b.dataset.people === peopleView));
    }
    await paintPeople();
  });

  $('paneSettings').addEventListener('click', async (e) => {
    if (e.target.closest('[data-act="retract"]')) return onRetract();
    const out = e.target.closest('[data-act="signout"]');
    if (out) {
      out.disabled = true;
      await signOut();
      location.href = '/';
    }
  });
}

/** Run one startup step in isolation — same shape as the feed's. */
async function step(label, fn) {
  try { await fn(); } catch (e) { console.error(`[pacr] profile step "${label}" failed`, e); }
}

/** RLS said no: the runner exists or does not, and either way this viewer has
 *  no relationship that makes them visible. One page for both, so the answer
 *  does not confirm whether a ref names anybody. */
function showDenied() {
  $('paneBoot').hidden = true;
  $('paneDenied').hidden = false;
}

async function showProfile() {
  $('paneBoot').hidden = true;

  await loadPeopleRows();
  if (!subject) return showDenied();

  $('paneProfile').hidden = false;
  wire();

  if (!isMe) await step('relationship', loadRelationship);
  runsComplete = isMe || rel.sharedSquads.length > 0;

  paintIdentity();
  paintActions();
  if (isMe) paintSettings();

  // The runs are the page; the counts around them are not allowed to take them
  // down, so each of these is guarded on its own.
  await step('runs', loadRuns);
  if (isMe) {
    await step('counts', async () => { counts = await followCounts(sb, me.id); });
    await step('squads', async () => { squads = await loadMySquads(); });
  } else {
    await step('posts count', loadPostCount);
    squads = rel.sharedSquads;
  }

  const first = paintTabs();
  await step('headStats', paintHeadStats);
  await step('load', paintLoad);
  await step('bests', paintBests);
  await step('year', paintYear);
  await step('recent', paintRecent);
  paintAppCard();
  if (runsComplete) await step('milestones', paintMilestones);
  await switchTab(first, { force: true });

  if (runsComplete && runs.length === 0) {
    msg($('overviewMsg'), isMe
      ? 'No runs have synced to this account yet. Runs recorded in the app show up here once they sync.'
      : 'No runs have synced for this runner yet.');
  }
}

export async function initProfile() {
  sb = await getSupabase();

  // The gate is uniform with /feed: this page renders only with a confirmed
  // session, and every other outcome goes to /signin. replace(), not assign():
  // nobody should be able to press Back into a profile they cannot see.
  const user = sb ? (await sb.auth.getSession()).data?.session?.user : null;
  if (!user) {
    location.replace(signinHref('/profile' + location.search));
    return;
  }

  me = user;
  const ref = new URLSearchParams(location.search).get('r');
  const refId = ref ? decodeUserRef(ref) : null;
  // A ref that does not decode is treated as a profile you cannot see, not as
  // your own: silently showing someone their own profile from a broken link
  // would be the wrong answer to "whose page is this?".
  isMe = !ref || refId === me.id;
  subjectId = isMe ? me.id : refId;

  mountHeaderAuth($('authSlot'), { className: 'btn-quiet', signOutTo: '/' });

  if (!subjectId) {
    $('paneBoot').hidden = true;
    return showDenied();
  }

  try {
    await showProfile();
  } catch (e) {
    console.error('[pacr] profile failed to start', e);
    $('paneBoot').hidden = true;
    $('paneProfile').hidden = false;
    msg($('overviewMsg'), 'Something went wrong loading this profile. Refresh to try again.', 'err');
  }
}
