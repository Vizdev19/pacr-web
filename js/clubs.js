// ─────────────────────────────────────────────────────────────────────────────
// Clubs section — live public-club directory
//
// Progressive enhancement. The four sample clubs in index.html are the
// baseline: with JS off, the CDN blocked, the key unset, a failed request or an
// empty directory, the visitor sees exactly the page that shipped. This module
// only ever REPLACES that markup, and only after a successful fetch with rows
// in it.
//
// The data comes from three SECURITY DEFINER RPCs the app project already
// grants to anon (pacr/supabase/migrations/20260810120000_public_clubs.sql):
// discover_clubs, club_locations, get_public_club. They return a curated column
// set — crucially never invite_code — so the browser cannot see anything a
// stranger shouldn't. Only clubs whose owner opted in (is_public) appear.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase, esc, initials, num, signedUrlsFor } from './supabase.js';

const LIMIT = 5;

const S = {
  row: 'background:#FFFFFF; padding:26px 28px; display:grid; grid-template-columns:auto 1fr auto; gap:24px; align-items:center; transition:background .2s ease, box-shadow .2s ease;',
  tile: 'width:52px; height:52px; background:#F7F7F3; border:1px solid #DCDCD1; display:flex; align-items:center; justify-content:center; font-family:Outfit, sans-serif; font-weight:700; font-size:16px; color:#5A6B00; overflow:hidden;',
  name: 'font-family:Outfit, sans-serif; font-weight:700; font-size:21px; text-transform:uppercase;',
  meta: 'font-family:Manrope, sans-serif; font-weight:600; font-size:11px; letter-spacing:0.1em; color:#6A6A61; margin-top:6px;',
  join: 'font-family:Manrope, sans-serif; font-weight:600; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; border:1px solid #C8C8BD; padding:10px 16px; color:#0F0F0D; cursor:pointer; transition:all .16s ease; text-decoration:none; display:inline-block;',
  chip: 'font-family:Manrope, sans-serif; font-weight:600; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; border:1px solid #C8C8BD; background:#FFFFFF; color:#5C5C54; padding:8px 14px; cursor:pointer; transition:all .16s ease;',
  chipOn: 'font-family:Manrope, sans-serif; font-weight:600; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; border:1px solid #0F0F0D; background:#E8FF3A; color:#0A0A09; padding:8px 14px; cursor:pointer; transition:all .16s ease;',
};

// "Bengaluru" + 1240 → "BENGALURU · 1,240 MEMBERS". Matches the caps voice of
// the static rows it replaces.
function metaLine(club) {
  const bits = [];
  if (club.location) bits.push(esc(club.location));
  bits.push(`${num(club.member_count)} MEMBER${club.member_count === 1 ? '' : 'S'}`);
  return bits.join(' · ').toUpperCase();
}

function rowHtml(club, logoUrl) {
  const avatar = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="" width="52" height="52" style="width:52px; height:52px; object-fit:cover; display:block;">`
    : esc(initials(club.name));
  return `
    <div class="row-hover" style="${S.row}">
      <div style="${S.tile}">${avatar}</div>
      <div>
        <div style="${S.name}">${esc(club.name)}</div>
        <div style="${S.meta}">${metaLine(club)}</div>
      </div>
      <a class="join" href="#get" style="${S.join}">Join</a>
    </div>`;
}

async function render(sb, list, location) {
  const { data, error } = await sb.rpc('discover_clubs', {
    p_query: null,
    p_location: location ?? null,
    p_limit: LIMIT,
    p_offset: 0,
  });
  // Keep whatever is already on screen rather than blanking the section.
  if (error || !Array.isArray(data) || data.length === 0) return false;

  const logos = await signedUrlsFor(sb, 'club-avatars',
    data.map(c => c.avatar_path));

  list.innerHTML = data
    .map(c => rowHtml(c, logos.get(c.avatar_path)))
    .join('');
  return true;
}

async function renderChips(sb, host, list) {
  const { data, error } = await sb.rpc('club_locations');
  if (error || !Array.isArray(data) || data.length < 2) return; // 1 city = no filter worth showing

  let active = null;
  const cities = data.slice(0, 6);

  const paint = () => {
    host.innerHTML = [{ label: 'All', club_count: null }, ...cities]
      .map((c, i) => {
        const on = (active === null && i === 0) || active === c.label;
        return `<button type="button" data-loc="${i === 0 ? '' : esc(c.label)}" style="${on ? S.chipOn : S.chip}">${esc(c.label)}</button>`;
      })
      .join('');
  };
  paint();
  host.hidden = false;

  host.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-loc]');
    if (!btn) return;
    active = btn.dataset.loc || null;
    paint();
    await render(sb, list, active);
  });
}

export async function initClubs() {
  const list = document.getElementById('clubsList');
  const chips = document.getElementById('clubsChips');
  if (!list) return;

  const sb = await getSupabase();
  if (!sb) return;

  const ok = await render(sb, list);
  if (ok && chips) await renderChips(sb, chips, list);
}
