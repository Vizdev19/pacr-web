// ─────────────────────────────────────────────────────────────────────────────
// Routes section — live route directory
//
// Reads public.spots (pacr/supabase/migrations/20260906120000_running_spots.sql),
// the curated table that replaced the app's bundled spots-bangalore.json. The
// table is anon-readable and client-unwritable, so the browser needs no session
// and can do no harm.
//
// Same progressive-enhancement contract as clubs.js: the four sample routes in
// index.html stay as the baseline and are replaced only on a successful fetch.
//
// The SVG behind the list stays static. It is a stylised illustration, not a
// map of anything — no row carries route_geometry yet, and pretending otherwise
// would be a nicer lie than the honest drawing.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase, esc } from './supabase.js';

const MAX_ROWS = 4;

const S = {
  row: 'background:#FFFFFF; padding:22px 24px; flex:1; display:flex; flex-direction:column; justify-content:center; transition:background .2s ease, box-shadow .2s ease;',
  head: 'display:flex; justify-content:space-between; align-items:baseline; gap:16px;',
  name: 'font-family:Outfit, sans-serif; font-weight:700; font-size:18px; text-transform:uppercase;',
  dist: 'font-family:Manrope, sans-serif; font-weight:600; font-size:12px; color:#5A6B00;',
  meta: 'font-family:Manrope, sans-serif; font-weight:600; font-size:11px; letter-spacing:0.1em; color:#6A6A61; margin-top:8px;',
  chip: 'font-family:Manrope, sans-serif; font-weight:600; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; border:1px solid #C8C8BD; background:#FFFFFF; color:#5C5C54; padding:8px 14px; cursor:pointer; transition:all .16s ease;',
  chipOn: 'font-family:Manrope, sans-serif; font-weight:600; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; border:1px solid #0F0F0D; background:#E8FF3A; color:#0A0A09; padding:8px 14px; cursor:pointer; transition:all .16s ease;',
};

const SURFACE = { paved: 'PAVED', dirt: 'SOFT TRAIL', tartan: 'TARTAN TRACK', mixed: 'MIXED SURFACE' };
const FEATURE = {
  'shaded': 'SHADED',
  'low-pollution': 'CLEAN AIR',
  'low-traffic': 'LOW TRAFFIC',
  'traffic-free-sundays': 'CAR-FREE SUNDAYS',
  'water-available': 'WATER',
  'washrooms': 'WASHROOMS',
  'parking': 'PARKING',
  'safe-for-women': 'SAFE FOR WOMEN',
  'free-entry': 'FREE ENTRY',
  'scenic': 'SCENIC',
  'scenic-elevation': 'HILLY',
  'bird-watching': 'BIRDLIFE',
};
const BEST = { 'pre-dawn': 'BEST PRE-DAWN', 'morning': 'BEST AT SUNRISE', 'evening': 'BEST AT DUSK', 'night': 'LIT AFTER DARK' };

// Build the caps detail line in the same voice as the static markup it
// replaces: "FLAT · PROMENADE · SEA BREEZE AFTER 06:00". Three facts, no more —
// a fourth makes the row wrap on a phone.
function metaLine(s) {
  const bits = [SURFACE[s.surface] ?? String(s.surface).toUpperCase()];
  const feat = (s.features ?? []).map(f => FEATURE[f]).filter(Boolean);
  if (feat.length) bits.push(feat[0]);
  const best = (s.best_times ?? []).map(b => BEST[b]).filter(Boolean);
  if (best.length) bits.push(best[0]);
  return bits.slice(0, 3).join(' · ');
}

function rowHtml(s) {
  const km = s.loop_km != null ? `${Number(s.loop_km).toFixed(1)} km` : '';
  return `
    <div class="row-hover" style="${S.row}">
      <div style="${S.head}">
        <div style="${S.name}">${esc(s.name)}</div>
        <div style="${S.dist}">${esc(km)}</div>
      </div>
      <div style="${S.meta}">${esc(metaLine(s))}</div>
    </div>`;
}

export async function initRoutes() {
  const list = document.getElementById('routesList');
  const chips = document.getElementById('routesChips');
  const count = document.getElementById('routesCount');
  const countLabel = document.getElementById('routesCountLabel');
  if (!list) return;

  const sb = await getSupabase();
  if (!sb) return;

  const { data, error } = await sb
    .from('spots')
    .select('id, name, city, loop_km, type, surface, features, best_times')
    .eq('is_published', true)
    .order('city', { ascending: true })
    .order('name', { ascending: true });

  if (error || !Array.isArray(data) || data.length === 0) return;

  // Group by city, then default to the city with the most routes — for now
  // that is always Bangalore, but the section should not need editing the day
  // Mumbai overtakes it.
  const byCity = new Map();
  for (const s of data) {
    if (!byCity.has(s.city)) byCity.set(s.city, []);
    byCity.get(s.city).push(s);
  }
  const cities = [...byCity.keys()].sort(
    (a, b) => byCity.get(b).length - byCity.get(a).length || a.localeCompare(b),
  );
  let active = cities[0];

  const paint = () => {
    const rows = byCity.get(active) ?? [];
    list.innerHTML = rows.slice(0, MAX_ROWS).map(rowHtml).join('');
    if (count) count.textContent = `${rows.length} route${rows.length === 1 ? '' : 's'}`;
    if (countLabel) countLabel.textContent = `In ${active}`;
    if (chips) {
      chips.innerHTML = cities
        .map(c => `<button type="button" data-city="${esc(c)}" style="${c === active ? S.chipOn : S.chip}">${esc(c)}</button>`)
        .join('');
    }
  };

  paint();
  if (chips && cities.length > 1) chips.hidden = false;

  chips?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-city]');
    if (!btn) return;
    active = btn.dataset.city;
    paint();
  });
}
