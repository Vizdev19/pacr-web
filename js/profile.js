// ─────────────────────────────────────────────────────────────────────────────
// /profile — your own profile
//
// Implements "PACR Profile.dc.html" from the Claude Design project. Like /feed,
// this page needs a real identity and gets one the same way: every RLS policy
// in the app project keys off auth.uid(), so a signed-in browser reads exactly
// what the app reads and nothing else.
//
// This is YOUR profile and only yours. There is deliberately no /profile?u=…:
// there are no usernames in this product, so a third-party profile would have
// to be addressed by uuid — a raw id in the URL bar, and a walkable directory
// of everyone whose id you can guess. The design's Follow button belongs to
// that page and is therefore absent here; following happens on /feed, where a
// real person's post is the thing you are choosing to follow.
//
// What the design carries and this page does not, for want of a data source
// rather than for want of effort:
//
//   • Cover photo — no column, no bucket. The band keeps the stripes.
//   • Handle, bio, location — public.users has display_name, home_neighborhood
//     and a streak, and no free text. A bio field would be a new moderation
//     surface, which is a product decision, not a port.
//   • Current plan, next session, readiness, gear — the coach prescription is
//     generated and kept on the phone. None of it is on the server.
//   • Badges — computed from the full local run history (splits included),
//     which never leaves the device. run_summaries has whole runs only, so the
//     Achievements tab becomes Milestones: firsts that ARE derivable, honestly
//     labelled, with the badges pointed back at the app.
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
import { followCounts, listFollowEdges, retractMyPosts } from './follow.js';
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
let profile = null;
/** My run_summaries, newest first, capped at RUN_CAP. */
let runs = [];
/** Exact count from the server — may exceed runs.length when capped. */
let runCount = 0;
let squads = [];
let counts = { followers: 0, following: 0 };
let tab = 'overview';
/** Panes that fetch on first view, so opening the page is one round of queries. */
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

// ─── Loads ──────────────────────────────────────────────────────────────────

/**
 * Every run I have synced, newest first.
 *
 * One query feeds the load chart, the bests table, the year card, the recent
 * list and the milestones — five blocks that would otherwise be five scans of
 * the same rows. The exact count comes separately and is the number shown, so
 * the stat strip stays true even when the row pull is capped.
 */
async function loadRuns() {
  const { count } = await sb.from('run_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', me.id);

  const { data, error } = await sb.from('run_summaries')
    .select('started_at, distance_km, duration_sec, pace_sec_per_km, neighborhood, week_key')
    .eq('user_id', me.id)
    .order('started_at', { ascending: false })
    .limit(RUN_CAP);
  if (error) throw error;

  runs = (data ?? []).filter(r => Number.isFinite(Number(r.distance_km)));
  runCount = Number.isFinite(count) ? count : runs.length;
}

/** Ported from listMySquads() in pacr/src/services/squads.ts. */
async function loadSquads() {
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

async function paintIdentity() {
  const name = profile?.display_name || me.email || '—';
  const ini = initials(name);

  let avatarUrl = null;
  if (profile?.avatar_path) {
    const signed = await signedUrlsFor(sb, 'avatars', [profile.avatar_path]);
    avatarUrl = signed.get(profile.avatar_path) ?? null;
  }
  const face = avatarUrl
    ? `<img src="${esc(avatarUrl)}" alt="">`
    : esc(ini);

  $('pAvatar').innerHTML = face;
  const head = $('meAvatar');
  head.innerHTML = face;
  head.hidden = false;

  $('pName').textContent = name;

  const since = profile?.created_at ? new Date(profile.created_at).getFullYear() : null;
  const streak = Number(profile?.current_streak_days) || 0;
  const bits = [];
  if (profile?.home_neighborhood) bits.push(`<span>${esc(profile.home_neighborhood)}</span>`);
  if (since) bits.push(`<span>On PACR since ${since}</span>`);
  if (streak > 0) {
    bits.push(`<span class="live">● ${streak}-day streak</span>`);
  }
  $('pMeta').innerHTML = bits.join('');
}

/**
 * The design's five-cell strip. FOLLOWERS, FOLLOWING and SQUADS jump to the tab
 * that lists them, the way the design's cells pick a tab.
 *
 * The design's fifth cell is BADGES; badges live on the phone, so the slot
 * carries total distance, which is the one lifetime number this page can add up
 * from real rows.
 */
function paintHeadStats() {
  const km = runs.reduce((n, r) => n + (Number(r.distance_km) || 0), 0);
  const cells = [
    ['FOLLOWERS', num(counts.followers), 'squads'],
    ['FOLLOWING', num(counts.following), 'squads'],
    ['SQUADS', String(squads.length), 'squads'],
    ['RUNS LOGGED', num(runCount), 'overview'],
    ['DISTANCE', `${km.toFixed(0)} km`, 'overview'],
  ];
  $('headStats').innerHTML = cells.map(([k, v, go]) => `
    <button type="button" class="stat-cell" data-go="${go}">
      <span class="k">${esc(k)}</span>
      <span class="v" style="display:block;">${esc(v)}</span>
    </button>`).join('');
  $('headStats').hidden = false;
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
  if (runs.length === 0) return;
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
      + '<div class="d" style="color:#6A6A61;">Your older runs are still counted everywhere else on this page.</div></div>';
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
  if (runs.length === 0) return;

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
  $('yearRows').innerHTML = cells.map(([k, v]) => `
    <div class="cell"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('');

  // Say it plainly when the numbers do not cover everything.
  if (runs.length < runCount) {
    $('yearNote').textContent =
      `TOTALS COVER YOUR MOST RECENT ${num(runs.length)} OF ${num(runCount)} RUNS`;
    $('yearNote').hidden = false;
  }
  $('yearCard').hidden = false;
}

function paintRecent() {
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
 * "First" means first in the rows this page can see, which is every run you
 * have synced — so it is right unless the pull was capped, and the note says so
 * when it was.
 */
function paintMilestones() {
  const oldestFirst = [...runs].sort(
    (a, b) => new Date(a.started_at) - new Date(b.started_at));
  if (oldestFirst.length === 0) {
    msg($('mileMsg'), 'Log a run in the app and your firsts show up here.');
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
    ? `Firsts are read from your most recent ${num(runs.length)} runs.`
    : null);
}

// ─── Squads and people ──────────────────────────────────────────────────────

async function paintSquads() {
  const host = $('squadRows');
  if (squads.length === 0) {
    $('squadsHead').textContent = 'SQUADS';
    host.innerHTML = '<div class="card-empty">You are not in a squad yet. '
      + 'Join or create one in the app and it will show up here.</div>';
    return;
  }
  const tally = await memberCounts(squads.map(s => s.id));
  $('squadsHead').textContent =
    `SQUADS & CLUBS — ${squads.length} JOINED`;
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
 * Followers and Following.
 *
 * The follows table lets me see the edges I am an endpoint of, but a NAME needs
 * public.users, which I may read only for squadmates and for people I follow.
 * So Following always resolves and Followers may not: a stranger who follows me
 * is a row I can count and cannot name. That is the schema working as designed
 * — there is no "who follows X" for anyone — so the unnameable ones are
 * reported as a number instead of being rendered as blank rows.
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
  let people = new Map();
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
    const url = u.avatar_path ? signed.get(u.avatar_path) : null;
    const streak = Number(u.current_streak_days) || 0;
    const meta = [
      u.home_neighborhood ? String(u.home_neighborhood).toUpperCase() : null,
      streak > 0 ? `${streak}-DAY STREAK` : null,
      edge.since ? `SINCE ${fmtMonth(edge.since).toUpperCase()}` : null,
    ].filter(Boolean).slice(0, 2).join(' · ');
    rows.push(`<div class="person">
      <div class="person-av">${url ? `<img src="${esc(url)}" alt="">` : esc(initials(u.display_name))}</div>
      <div class="person-main">
        <div class="person-name">${esc(u.display_name ?? '—')}</div>
        <div class="person-meta">${esc(meta)}</div>
      </div>
    </div>`);
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
  const likes = `${num(p.like_count)} ${p.like_count === 1 ? 'kudos' : 'kudos'}`;
  const comments = `${num(p.comment_count)} ${p.comment_count === 1 ? 'comment' : 'comments'}`;
  return `
    <article class="post">
      <div class="post-top">
        <div class="avatar">${p.avatar_html}</div>
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
      .eq('author_id', me.id)
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

    // One avatar, mine, on every card — resolved once for the whole page.
    const avatarHtml = $('pAvatar').innerHTML;

    const html = rows.map(row => postHtml({
      author_name: profile?.display_name ?? me.email ?? '—',
      avatar_html: avatarHtml,
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
      ? 'You have not posted yet. Runs and photos are posted from the app, or from the composer on your feed.'
      : null);
    if (tab === 'posts') paintCountLine();
  } catch (e) {
    console.warn('[pacr] my posts failed', e);
    msg($('postsMsg'), "Couldn't load your posts. Refresh to try again.", 'err');
  } finally {
    postsLoading = false;
  }
}

// ─── Settings ───────────────────────────────────────────────────────────────

function paintSettings() {
  const name = profile?.display_name ?? '—';
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

// ─── Tabs ───────────────────────────────────────────────────────────────────

function paintCountLine() {
  const el = $('countLine');
  if (tab === 'overview') {
    el.textContent = `${num(runCount)} ${runCount === 1 ? 'RUN' : 'RUNS'} LOGGED`;
  } else if (tab === 'posts') {
    const n = $('myPosts').children.length;
    el.textContent = postCursor ? `${num(n)}+ POSTS` : `${num(n)} ${n === 1 ? 'POST' : 'POSTS'}`;
  } else if (tab === 'squads') {
    el.textContent = `${squads.length} ${squads.length === 1 ? 'SQUAD' : 'SQUADS'} · ${num(counts.following)} FOLLOWING`;
  } else if (tab === 'milestones') {
    el.textContent = 'DERIVED FROM YOUR SYNCED RUNS';
  } else {
    el.textContent = '';
  }
}

async function switchTab(next) {
  if (tab === next) return;
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
    await Promise.all([paintSquads(), paintPeople()]);
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
    if (cell) switchTab(cell.dataset.go);
  });

  $('moreBtn').addEventListener('click', () => loadPosts({ reset: false }));

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

async function showProfile() {
  $('paneBoot').hidden = true;
  $('paneProfile').hidden = false;

  await step('identity', async () => {
    const { data } = await sb.from('users')
      .select('display_name, avatar_path, home_neighborhood, current_streak_days, created_at')
      .eq('id', me.id)
      .maybeSingle();
    profile = data ?? null;
    await paintIdentity();
  });

  wire();
  paintSettings();

  // The runs are the page; the counts around them are not allowed to take them
  // down, so each of these is guarded on its own.
  await step('runs', loadRuns);
  await step('counts', async () => { counts = await followCounts(sb, me.id); });
  await step('squads', async () => { squads = await loadSquads(); });

  await step('headStats', paintHeadStats);
  await step('load', paintLoad);
  await step('bests', paintBests);
  await step('year', paintYear);
  await step('recent', paintRecent);
  await step('milestones', paintMilestones);
  paintCountLine();

  if (runs.length === 0) {
    msg($('overviewMsg'),
      'No runs have synced to this account yet. Runs recorded in the app show up here once they sync.');
  }
}

export async function initProfile() {
  sb = await getSupabase();

  // The gate is uniform with /feed: this page renders only with a confirmed
  // session, and every other outcome goes to /signin. replace(), not assign():
  // nobody should be able to press Back into a profile they cannot see.
  const user = sb ? (await sb.auth.getSession()).data?.session?.user : null;
  if (!user) {
    location.replace(signinHref('/profile'));
    return;
  }

  me = user;
  mountHeaderAuth($('authSlot'), { className: 'btn-quiet', signOutTo: '/' });
  try {
    await showProfile();
  } catch (e) {
    console.error('[pacr] profile failed to start', e);
    $('paneBoot').hidden = true;
    $('paneProfile').hidden = false;
    msg($('overviewMsg'), 'Something went wrong loading your profile. Refresh to try again.', 'err');
  }
}
