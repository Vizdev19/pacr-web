// ─────────────────────────────────────────────────────────────────────────────
// Live run — the watcher's page
//
// Reads get_live_run(token) from the app's project
// (pacr/supabase/migrations/20261009120000_live_run.sql). No session: the token
// in the query string IS the authorisation, and the RPC is the only thing that
// can read those tables at all.
//
// Same no-session, progressive-enhancement contract as js/routes.js — if the
// CDN is blocked or the project is unconfigured, the markup already in
// live.html stays on screen and says something true.
//
// The thing this page is actually for: someone slightly worried, on a phone,
// asking whether a person they love is OK. So the status line is the hero and
// staleness is written in words. A dot that has not moved for twenty minutes
// must never look like a runner who is standing still — that is the one
// confusion this page cannot afford, and it is why 'stale' and 'lost' are
// states the server computes rather than something the page infers.
//
// The token must not leak. live.html sets referrer=no-referrer precisely so
// the OSM tile requests below don't carry it; nothing here may add an outbound
// request that includes the URL.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase, esc } from './supabase.js';

const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;
const POLL_VISIBLE_MS = 10_000;   // the runner pushes every ~10s
const POLL_HIDDEN_MS  = 30_000;   // backgrounded tab: keep it cheap
const TERMINAL = new Set(['finished', 'ended', 'closed']);
const DEGRADED = new Set(['stale', 'lost', 'ended']);

const el = (id) => document.getElementById(id);

let map = null;
let trailLine = null;
let pin = null;
let userMoved = false;   // once they pan, stop yanking the view back
let fitted = false;
let timer = null;
let done = false;

// ── Formatting ──────────────────────────────────────────────────────────────

function fmtTime(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${m}:${String(ss).padStart(2, '0')}`;
}

function fmtPace(secPerKm) {
  const v = Number(secPerKm);
  if (!Number.isFinite(v) || v <= 0) return '—';
  const m = Math.floor(v / 60);
  const s = Math.round(v % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Humanised staleness. Seconds while it's seconds; minutes once it matters. */
function fmtAgo(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m ago` : `${h}h ago`;
}

// ── Copy per state ──────────────────────────────────────────────────────────

function copyFor(d) {
  const name = d.runner || 'A runner';
  const ago = fmtAgo(d.stale_sec);

  switch (d.state) {
    case 'armed':
      return {
        flag: 'Link active',
        headline: `${name} hasn't started yet`,
        sub: 'The link works. This page fills in once the run begins.',
      };
    case 'live':
      return {
        flag: `Live · updated ${ago}`,
        headline: `${name} is running`,
        sub: 'Updating every few seconds, as long as the phone has signal.',
      };
    case 'paused':
      return {
        flag: `Paused · updated ${ago}`,
        headline: `${name} is paused`,
        sub: 'A crossing, a water stop, or a breather. The clock is stopped.',
      };
    case 'stale':
      return {
        flag: `Last update ${ago}`,
        headline: `No update for ${ago.replace(' ago', '')}`,
        sub: 'That is usually signal rather than trouble. The last known position is below.',
      };
    case 'lost':
      return {
        flag: `Last seen ${ago}`,
        headline: `No update for ${ago.replace(' ago', '')}`,
        sub: `${name}'s phone has stopped reporting — it may have lost signal or run out of battery. The map shows where it last was.`,
      };
    case 'ended':
      return {
        flag: 'No longer reporting',
        headline: 'This run ended without finishing',
        sub: 'The phone stopped reporting and the run was never saved. These are the last numbers it sent.',
      };
    case 'finished':
      return {
        flag: 'Run complete',
        headline: `${name} finished`,
        sub: 'Saved. This page stays as the record of it.',
      };
    default:
      return {
        flag: 'Link closed',
        headline: "This link isn't active",
        sub: 'It may have been turned off, or it was never a run. Ask the runner for a new one.',
      };
  }
}

// ── Render ──────────────────────────────────────────────────────────────────

function renderClosed() {
  done = true;
  const c = copyFor({ state: 'closed' });
  el('dot').className = 'lv-dot';
  el('flag').textContent = c.flag;
  el('headline').textContent = c.headline;
  el('headline').classList.remove('warn');
  el('sub').textContent = c.sub;
  el('runTitle').hidden = true;
  el('stats').hidden = true;
  el('map').hidden = true;
  el('note').hidden = true;
}

function render(d) {
  const c = copyFor(d);
  const degraded = DEGRADED.has(d.state);

  el('dot').className = 'lv-dot'
    + (d.state === 'live' ? ' on' : '')
    + (degraded ? ' warn' : '');
  el('flag').textContent = c.flag;
  el('headline').textContent = c.headline;
  el('headline').classList.toggle('warn', degraded);
  el('sub').textContent = c.sub;

  if (d.title) {
    el('runTitle').textContent = d.title;
    el('runTitle').hidden = false;
  } else {
    el('runTitle').hidden = true;
  }

  // Nothing has happened yet in 'armed', and the server sends no numbers for
  // it — showing three dashes would just look broken.
  if (d.state === 'armed') {
    el('stats').hidden = true;
    el('map').hidden = true;
  } else {
    el('dist').textContent = (Number(d.distance_km) || 0).toFixed(2);
    el('time').textContent = fmtTime(d.elapsed_sec);
    el('pace').textContent = fmtPace(d.pace_sec_per_km);
    el('stats').hidden = false;
    drawMap(d, degraded);
  }

  el('note').innerHTML =
    `<b>${esc(d.runner || 'A runner')}</b> shared this link from Pacr. It updates only `
    + `while their phone has a connection, and it stops working the moment they turn it off. `
    + `This page doesn't notify anyone and isn't an emergency service.`;
  el('note').hidden = false;

  if (TERMINAL.has(d.state)) done = true;
}

// ── Map ─────────────────────────────────────────────────────────────────────

function ensureMap() {
  if (map || typeof window.L === 'undefined') return map;

  map = window.L.map('map', { zoomControl: true, attributionControl: true });
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    // Required by the OSM tile usage policy.
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  map.on('dragstart zoomstart', () => { userMoved = true; });
  return map;
}

function drawMap(d, degraded) {
  const trail = Array.isArray(d.trail) ? d.trail.filter(p => Array.isArray(p) && p.length === 2) : [];
  const last = Array.isArray(d.last) && d.last.length === 2 ? d.last : trail[trail.length - 1];
  if (!last) { el('map').hidden = true; return; }

  el('map').hidden = false;
  const m = ensureMap();
  if (!m) return;   // Leaflet blocked — the status band above still works.

  if (trail.length > 1) {
    if (trailLine) trailLine.setLatLngs(trail);
    else trailLine = window.L.polyline(trail, { color: '#E8FF3A', weight: 4, opacity: .9 }).addTo(m);
  }

  const icon = window.L.divIcon({
    className: '',
    html: `<div class="lv-pin${degraded ? ' warn' : ''}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  if (pin) { pin.setLatLng(last); pin.setIcon(icon); }
  else pin = window.L.marker(last, { icon, keyboard: false }).addTo(m);

  if (!fitted) {
    fitted = true;
    if (trail.length > 1) m.fitBounds(window.L.latLngBounds(trail).pad(0.25));
    else m.setView(last, 16);
  } else if (!userMoved) {
    m.panTo(last, { animate: true, duration: .5 });
  }
}

// ── Poll ────────────────────────────────────────────────────────────────────

function schedule() {
  clearTimeout(timer);
  if (done) return;
  timer = setTimeout(tick, document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS);
}

async function tick() {
  const token = new URLSearchParams(location.search).get('t');
  if (!TOKEN_RE.test(String(token ?? ''))) { renderClosed(); return; }

  const sb = await getSupabase();
  if (!sb) return;   // Unconfigured or CDN-blocked: leave the baseline markup.

  try {
    const { data, error } = await sb.rpc('get_live_run', { p_token: token });
    if (error) throw error;
    // A null payload is every closed case at once — unknown, malformed,
    // revoked. The server makes them identical on purpose, and so does this.
    if (!data) renderClosed();
    else render(data);
  } catch (e) {
    // Keep whatever is on screen rather than replacing a real position with an
    // error; the status line will age into 'stale' on the next success anyway.
    console.warn('[pacr] live run fetch failed', e);
  }
  schedule();
}

// A tab coming back to the foreground should refresh now, not in 30s.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !done) tick();
});

tick();
