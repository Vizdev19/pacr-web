// ─────────────────────────────────────────────────────────────────────────────
// /host/new and /host/e/<ref> — make and edit an event.
//
// A new event is created as a draft from the basics (host, title, kind, when,
// where, tickets, who can see it); the page then becomes that draft's editor,
// because the poster and course map upload into the event's own folder of the
// `event-covers` bucket, which only exists for an event that exists.
//
//   Host           which squad (where I'm a run leader or above) or my
//                  approved organizer — new events only
//   The basics     title, kind, description, start and end (browser's zone)
//   Where          Google Places search, plus a meet note ("Gate 2")
//   Tickets        capacity (empty = no limit), who can see it, women only,
//                  the host's own cancellation/refund note. Free for now:
//                  paid tiers arrive with payments (20261201)
//   Poster         2:3, cropped here, shown on the app's Events grid
//   Race details   surface, chip timing, distances, terrain
//   Event day      the schedule timeline (time · step · note)
//   Course         a course map (16:9) and up to six facts
//   Good to know   up to eight questions and answers
//   Included       one per line, up to twelve
//   Actions        Save · Publish (drafts) · Delete draft · Cancel event
//
// Everything maps to update_event's patch keys, which validate on the server
// too. Start and end are sent only when changed, so editing a running event's
// notes never trips the "start must be in the future" rule. Pictures save as
// soon as they're cropped (and the replaced one is removed), so a page left
// without Save never strands an upload.
// ─────────────────────────────────────────────────────────────────────────────

import { openModal } from '../modal.js';
import {
  myHosting, getEventForEdit, createEvent, updateEvent, publishEvent, deleteDraft, cancelEvent,
  uploadImage, removeImages, imageUrls, avatarUrls, failText,
} from './api.js';
import {
  $, esc, editHref, attendeesHref, toLocalInput, fromLocalInput, localZone, STATUS, goingLine, say, when,
} from './util.js';
import { mountPlaceSearch } from './places.js';
import { cropImage } from './crop.js';

const MAX = { schedule: 12, course: 6, faq: 8, included: 12 };

export async function renderEditor(app, { id }) {
  app.innerHTML = `<div class="wrap"><div class="skel"><div></div></div></div>`;
  const [h, ev] = await Promise.all([myHosting(), id ? getEventForEdit(id) : Promise.resolve(null)]);
  const hosting = h.ok ? h.value ?? {} : {};
  if (id && !ev?.ok) {
    app.innerHTML = `
      <div class="wrap narrow">
        <a class="back" href="/host/events">← Your events</a>
        <h1 class="h1">Can’t open this event</h1>
        <p class="lede">${esc(ev?.text ?? failText('not_found'))}</p>
      </div>`;
    return;
  }
  if (!id && !hosting.can_host) {
    app.innerHTML = `
      <div class="wrap narrow">
        <a class="back" href="/host/events">← Your events</a>
        <div class="eyebrow">New event</div>
        <h1 class="h1">You can’t host yet</h1>
        <p class="lede">Squad owners, organisers and run leaders can host for their squad. To host as yourself or a brand, ask the PACR team first.</p>
        <a class="btn" href="/host/apply">Ask to host</a>
      </div>`;
    return;
  }
  const e = ev?.value ?? null;
  const editable = !e || e.status === 'draft' || e.status === 'published';
  const created = new URLSearchParams(location.search).get('created') === '1';

  // What the form doesn't hold in inputs.
  const state = {
    place: e?.place?.name ? e.place : null,
    placeChanged: false,
    cover: e?.cover_path ?? null,
    map: e?.course_map_path ?? null,
    schedule: (e?.schedule ?? []).map(x => ({ ...x })),
    course: (e?.course_facts ?? []).map(x => ({ ...x })),
    faq: (e?.faq ?? []).map(x => ({ ...x })),
  };
  const urls = e ? await imageUrls([state.cover, state.map]) : new Map();

  const squads = hosting.squads ?? [];
  const org = hosting.organizer?.status === 'approved' ? hosting.organizer : null;
  const hostIsSquad = e ? e.host?.kind === 'squad' : true;

  // Who it's for, always shown: a picker for a new event (starting on the
  // host picked in the dashboard's switcher), a fixed card once it exists.
  const [squadPics, orgPics] = await Promise.all([
    avatarUrls('club-avatars', squads.map(s => s.avatar_path)),
    avatarUrls('avatars', [hosting.organizer?.avatar_path]),
  ]);
  const hostOptions = [
    ...squads.map(s => ({
      key: `squad:${s.id}`, kind: 'squad', name: s.name, pic: squadPics.get(s.avatar_path), verified: !!s.verified,
      disabled: !s.verified,
      sub: s.verified
        ? ['Squad', ROLE_LINE[s.role] ?? null, s.members != null ? `${s.members} ${s.members === 1 ? 'member' : 'members'}` : null].filter(Boolean).join(' · ')
        : 'Not verified yet · only verified squads host events',
    })),
    ...(org ? [{ key: `organizer:${org.id}`, kind: 'organizer', name: org.name, pic: orgPics.get(org.avatar_path), verified: true, disabled: false, sub: 'Organizer account' }] : []),
  ];
  const hostPick = !e ? (hostOptions.find(o => o.key === rememberedHost() && !o.disabled) ?? hostOptions.find(o => !o.disabled) ?? null) : null;
  const hostNow = e ? (hostOptions.find(o => o.key === `${e.host?.kind}:${e.host?.id}`)
    ?? { kind: e.host?.kind === 'organizer' ? 'organizer' : 'squad', name: e.host?.name ?? '', pic: null, verified: false, sub: e.host?.kind === 'organizer' ? 'Organizer account' : 'Squad' }) : null;
  const tier = e?.tiers?.[0] ?? null;

  app.innerHTML = `
    <div class="wrap">
      <a class="back" href="/host/events">← Your events</a>
      <header class="page-head">
        <div>
          <div class="eyebrow">${e ? `${esc(e.host?.name ?? '')} · <span class="tag tag-${esc(e.status)}">${esc(STATUS[e.status] ?? e.status)}</span>` : 'New event'}</div>
          <h1 class="h1">${e ? esc(e.title) : 'New event'}</h1>
          ${e ? `<p class="lede">${esc(when(e.starts_at))}${e.status !== 'draft' ? ` · ${esc(goingLine(e.sold ?? 0, tier?.capacity ?? null))}` : ''}</p>` : `<p class="lede">Start with the basics. Once it’s saved as a draft you can add a poster and the event-day details, then publish.</p>`}
        </div>
        ${e && e.status !== 'draft' ? `<a class="btn-outline" href="${attendeesHref(e.id)}">Attendees</a>` : ''}
      </header>
      ${created ? `<p class="msg ok">Draft saved. Add a poster and the details runners will look for, then publish.</p>` : ''}
      ${!editable ? `<p class="msg">${e.status === 'cancelled' ? 'This event was cancelled' : 'This event is over'}, so it can’t be edited.</p>` : ''}

      <form id="ev" class="form" novalidate ${editable ? '' : 'inert'}>
        <fieldset class="card">
          <legend>Host</legend>
          ${e ? `
          ${hostCard(hostNow)}
          <p class="fine">Runners see the host on the event page. It can’t change once the event is made.</p>` : hostPick ? `
          <div class="choices">${hostOptions.map(o => hostChoice(o, o === hostPick)).join('')}</div>
          <p class="fine">Runners see the host on the event page. It can’t change once the event is made.</p>` : `
          ${hostOptions.length ? `<div class="choices">${hostOptions.map(o => hostChoice(o, false)).join('')}</div>` : ''}
          <p class="fine">Only verified squads host events. The owner can ask for verification in Settings.</p>`}
        </fieldset>

        <fieldset class="card">
          <legend>The basics</legend>
          <label class="field"><span>Title</span>
            <input name="title" maxlength="80" required value="${esc(e?.title ?? '')}" placeholder="Cubbon Park 10K"></label>
          <label class="field"><span>Kind</span>
            <select name="kind">
              ${[['run', 'Run or race'], ['workshop', 'Workshop or clinic'], ['social', 'Social']].map(([v, l]) =>
                `<option value="${v}" ${(e?.kind ?? 'run') === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select></label>
          <label class="field"><span>About it <i>optional</i></span>
            <textarea name="description" maxlength="2000" rows="5" placeholder="The route, who it’s for, what makes it worth getting up for">${esc(e?.description ?? '')}</textarea></label>
          <div class="two">
            <label class="field"><span>Starts</span>
              <input name="starts" type="datetime-local" required value="${esc(toLocalInput(e?.starts_at))}"></label>
            <label class="field"><span>Ends</span>
              <input name="ends" type="datetime-local" value="${esc(toLocalInput(e?.ends_at))}"></label>
          </div>
          <p class="fine">Times are in your time zone (${esc(localZone())}). No end time means two hours after the start.</p>
        </fieldset>

        <fieldset class="card">
          <legend>Where</legend>
          <div id="place"></div>
          <label class="field"><span>Where to meet <i>optional</i></span>
            <input name="meet_note" maxlength="120" value="${esc(e?.meet_note ?? '')}" placeholder="Gate 2, by the bandstand"></label>
        </fieldset>

        <fieldset class="card">
          <legend>Tickets</legend>
          <label class="field short"><span>How many people <i>empty for no limit</i></span>
            <input name="capacity" type="number" min="1" max="100000" inputmode="numeric" value="${esc(tier?.capacity ?? '')}"></label>
          <p class="fine">Tickets are free for now. Paid tickets, with payouts to you, are coming.</p>
          <div class="choices">
            ${choice('visibility', 'public', 'Everyone', 'Listed on the PACR Events tab for runners nearby', (e?.visibility ?? 'public') === 'public')}
            ${choice('visibility', 'link', 'Anyone with the link', 'Not listed — share the link yourself', e?.visibility === 'link')}
            ${hostIsSquad ? choice('visibility', 'squad', 'Squad members only', 'Only your squad sees it and can get a ticket', e?.visibility === 'squad') : ''}
          </div>
          <label class="check"><input type="checkbox" name="women_only" ${e?.women_only ? 'checked' : ''}>
            <span>Women only <i>only runners whose PACR profile says woman can get a ticket</i></span></label>
          <label class="field"><span>Cancellation &amp; refund note <i>optional</i></span>
            <textarea name="refund_note" maxlength="300" rows="2" placeholder="Can’t make it? Give your spot back in the app so someone else can come.">${esc(e?.refund_note ?? '')}</textarea></label>
        </fieldset>

        ${e ? `
        <fieldset class="card">
          <legend>Poster</legend>
          <div class="pic-row">
            <div class="poster" id="posterBox">${state.cover && urls.get(state.cover) ? `<img src="${esc(urls.get(state.cover))}" alt="Event poster">` : '<span>2:3</span>'}</div>
            <div>
              <p class="fine">A portrait poster, like a race poster. It’s the picture on the app’s Events grid and the top of the event page.</p>
              <div class="acts">
                <label class="btn-outline file"><span data-label>${state.cover ? 'Replace poster' : 'Add poster'}</span><input type="file" accept="image/*" id="posterFile" hidden></label>
                <button type="button" class="btn-quiet" id="posterRemove" ${state.cover ? '' : 'hidden'}>Remove</button>
              </div>
              <p class="msg" id="posterMsg" hidden></p>
            </div>
          </div>
        </fieldset>

        <fieldset class="card">
          <legend>Race details <i>optional</i></legend>
          <div class="two">
            <label class="field"><span>Surface</span>
              <select name="surface">
                ${[['', '—'], ['road', 'Road'], ['trail', 'Trail'], ['track', 'Track'], ['mixed', 'Mixed']].map(([v, l]) =>
                  `<option value="${v}" ${(e.surface ?? '') === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select></label>
            <label class="field"><span>Terrain</span>
              <input name="terrain" maxlength="40" value="${esc(e.terrain ?? '')}" placeholder="Flat road · +410 m climb"></label>
          </div>
          <label class="field"><span>Distances in km</span>
            <input name="distances" value="${esc((e.distances_km ?? []).map(Number).join(', '))}" placeholder="5, 10, 21.1"></label>
          <label class="check"><input type="checkbox" name="timed" ${e.timed ? 'checked' : ''}><span>Chip timed</span></label>
        </fieldset>

        <fieldset class="card">
          <legend>Event day <i>optional</i></legend>
          <p class="fine">The timeline runners see: bib pickup, bag drop, the start, when the course closes.</p>
          <div id="schedule" class="list"></div>
          <button type="button" class="btn-quiet" id="addSched">+ Add a step</button>
        </fieldset>

        <fieldset class="card">
          <legend>Course <i>optional</i></legend>
          <div class="pic-row">
            <div class="map" id="mapBox">${state.map && urls.get(state.map) ? `<img src="${esc(urls.get(state.map))}" alt="Course map">` : '<span>16:9</span>'}</div>
            <div>
              <p class="fine">A course map or route screenshot.</p>
              <div class="acts">
                <label class="btn-outline file"><span data-label>${state.map ? 'Replace map' : 'Add map'}</span><input type="file" accept="image/*" id="mapFile" hidden></label>
                <button type="button" class="btn-quiet" id="mapRemove" ${state.map ? '' : 'hidden'}>Remove</button>
              </div>
              <p class="msg" id="mapMsg" hidden></p>
            </div>
          </div>
          <div id="course" class="list"></div>
          <button type="button" class="btn-quiet" id="addCourse">+ Add a fact</button>
        </fieldset>

        <fieldset class="card">
          <legend>Good to know <i>optional</i></legend>
          <div id="faq" class="list"></div>
          <button type="button" class="btn-quiet" id="addFaq">+ Add a question</button>
        </fieldset>

        <fieldset class="card">
          <legend>Included <i>optional</i></legend>
          <label class="field"><span>One per line</span>
            <textarea name="included" rows="4" placeholder="Chip timing&#10;Finisher medal&#10;Aid at 3 &amp; 7 km">${esc((e.included ?? []).join('\n'))}</textarea></label>
        </fieldset>` : ''}

        ${editable ? `
        <div class="bar">
          <p class="msg" id="saveMsg" hidden></p>
          <div class="acts">
            <button type="submit" class="btn" id="save">${e ? 'Save' : 'Create draft'}</button>
            ${e?.status === 'draft' ? `<button type="button" class="btn-outline" id="publish">Publish</button>` : ''}
            ${e?.status === 'draft' ? `<button type="button" class="btn-quiet" id="delete">Delete draft</button>` : ''}
            ${e?.status === 'published' ? `<button type="button" class="btn-quiet danger" id="cancel">Cancel event</button>` : ''}
          </div>
        </div>` : ''}
      </form>
    </div>`;

  mountPlaceSearch($('place'), {
    initial: state.place,
    onPick: (p) => { state.place = p; state.placeChanged = true; },
  });

  if (e) {
    drawRows('schedule', state.schedule, MAX.schedule, [
      ['time', 'Time', 20, '6:15 AM'], ['label', 'What happens', 60, 'Bib pickup opens'], ['note', 'Note', 160, 'Bandstand tent. Bring your ticket QR.'],
    ]);
    drawRows('course', state.course, MAX.course, [['label', 'Fact', 20, 'Elevation'], ['value', 'Value', 30, '+38 m']]);
    drawRows('faq', state.faq, MAX.faq, [['q', 'Question', 80, 'Where do I park?'], ['a', 'Answer', 500, 'Free parking at Gate 3 until 6 AM.', true]]);
    $('addSched').addEventListener('click', () => addRow('schedule', state.schedule, MAX.schedule));
    $('addCourse').addEventListener('click', () => addRow('course', state.course, MAX.course));
    $('addFaq').addEventListener('click', () => addRow('faq', state.faq, MAX.faq));
    wirePicture({ eventId: e.id, key: 'cover_path', fileInput: 'posterFile', removeBtn: 'posterRemove', box: 'posterBox', msg: 'posterMsg',
      crop: { aspect: 2 / 3, outW: 1200, outH: 1800, title: 'Crop the poster' }, state, stateKey: 'cover' });
    wirePicture({ eventId: e.id, key: 'course_map_path', fileInput: 'mapFile', removeBtn: 'mapRemove', box: 'mapBox', msg: 'mapMsg',
      crop: { aspect: 16 / 9, outW: 1600, outH: 900, title: 'Crop the course map' }, state, stateKey: 'map' });
  }
  if (!editable) return;

  const form = $('ev');
  const msg = $('saveMsg');
  const saveBtn = $('save');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    saveBtn.disabled = true;
    say(msg, e ? 'Saving…' : 'Creating…');
    const r = e ? await save(e, form, state) : await create(form, state);
    saveBtn.disabled = false;
    if (!r.ok) return say(msg, r.text, 'err');
    if (!e) { location.replace(editHref(r.value) + '?created=1'); return; }
    say(msg, 'Saved.', 'ok');
  });

  $('publish')?.addEventListener('click', async () => {
    saveBtn.disabled = true;
    say(msg, 'Publishing…');
    const s = await save(e, form, state);
    if (!s.ok) { saveBtn.disabled = false; return say(msg, s.text, 'err'); }
    const p = await publishEvent(e.id);
    saveBtn.disabled = false;
    if (!p.ok) return say(msg, p.text, 'err');
    location.replace(editHref(e.id));
  });

  $('delete')?.addEventListener('click', async () => {
    const go = await openModal({
      title: 'Delete this draft?',
      body: '<p>It’s gone for good, with its poster and course map.</p>',
      options: [{ label: 'Delete draft', value: true, primary: true }, { label: 'Keep it', value: false }],
    });
    if (!go) return;
    const r = await deleteDraft(e.id);
    if (!r.ok) return say(msg, r.text, 'err');
    await removeImages([state.cover, state.map]);
    location.replace('/host/events');
  });

  $('cancel')?.addEventListener('click', async () => {
    let reason = '';
    const going = e.sold ?? 0;
    const ask = openModal({
      title: 'Cancel this event?',
      body: `<p>${going ? `${going} ${going === 1 ? 'person has a ticket' : 'people have tickets'}. Each gets a notification that it’s off.` : 'Nobody has a ticket yet.'} This can’t be undone.</p>
        <label class="field"><span>Tell them why <i>optional</i></span><textarea id="cancelWhy" maxlength="300" rows="2" placeholder="Heavy rain forecast — we’ll run it on the 22nd instead."></textarea></label>`,
      options: [{ label: 'Cancel event', value: true, primary: true }, { label: 'Keep it', value: false }],
    });
    document.getElementById('cancelWhy')?.addEventListener('input', (x) => { reason = x.target.value; });
    if (!(await ask)) return;
    const r = await cancelEvent(e.id, reason.trim());
    if (!r.ok) return say(msg, r.text, 'err');
    location.replace(editHref(e.id));
  });
}

// ── Saving ──────────────────────────────────────────────────────────────────

function read(form) {
  const f = new FormData(form);
  const get = (k) => String(f.get(k) ?? '').trim();
  return { f, get };
}

function capacityOf(v) {
  if (v === '') return { ok: true, value: null };
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 100000 ? { ok: true, value: n } : { ok: false, text: failText('invalid_capacity') };
}

function placeJson(p) {
  return { name: p.name, address: p.address ?? null, lat: p.lat ?? null, lng: p.lng ?? null, google_place_id: p.google_place_id ?? null };
}

async function create(form, state) {
  const { f, get } = read(form);
  const [hostKind, hostId] = String(f.get('host') ?? '').split(':');
  if (!hostKind || !hostId) return { ok: false, text: 'Choose who’s hosting.' };
  if (!get('title')) return { ok: false, text: failText('title_required') };
  const startsAt = fromLocalInput(get('starts'));
  if (!startsAt) return { ok: false, text: 'Choose when it starts.' };
  if (!state.place) return { ok: false, text: failText('place_required') };
  const cap = capacityOf(get('capacity'));
  if (!cap.ok) return cap;
  return createEvent({
    hostKind, hostId,
    kind: get('kind') || 'run',
    title: get('title'),
    description: get('description'),
    startsAt,
    endsAt: fromLocalInput(get('ends')),
    timezone: localZone(),
    place: placeJson(state.place),
    meetNote: get('meet_note'),
    visibility: get('visibility') || 'public',
    womenOnly: f.get('women_only') === 'on',
    capacity: cap.value,
    refundNote: get('refund_note'),
  });
}

async function save(e, form, state) {
  const { f, get } = read(form);
  if (!get('title')) return { ok: false, text: failText('title_required') };
  const cap = capacityOf(get('capacity'));
  if (!cap.ok) return cap;
  const distances = get('distances').split(/[,\s]+/).filter(Boolean).map(Number);
  if (distances.some(n => !Number.isFinite(n))) return { ok: false, text: failText('invalid_distances') };

  const patch = {
    title: get('title'),
    kind: get('kind') || 'run',
    description: get('description'),
    meet_note: get('meet_note'),
    visibility: get('visibility') || 'public',
    women_only: f.get('women_only') === 'on',
    capacity: cap.value,
    refund_note: get('refund_note'),
    surface: get('surface') || null,
    terrain: get('terrain'),
    timed: f.get('timed') === 'on',
    distances_km: distances,
    schedule: clean(state.schedule, ['time', 'label', 'note'], 'label'),
    course_facts: clean(state.course, ['label', 'value'], 'label'),
    faq: clean(state.faq, ['q', 'a'], 'q'),
    included: get('included').split('\n').map(s => s.trim()).filter(Boolean),
  };
  // Times only when moved: a running event's notes must stay editable.
  const startsAt = fromLocalInput(get('starts'));
  const endsAt = fromLocalInput(get('ends'));
  if (startsAt && toLocalInput(startsAt) !== toLocalInput(e.starts_at)) patch.starts_at = startsAt;
  if (endsAt && toLocalInput(endsAt) !== toLocalInput(e.ends_at)) patch.ends_at = endsAt;
  if (patch.starts_at || patch.ends_at) patch.timezone = localZone();
  if (state.placeChanged && state.place) patch.place = placeJson(state.place);

  const r = await updateEvent(e.id, patch);
  if (r.ok) {
    if (patch.starts_at) e.starts_at = patch.starts_at;
    if (patch.ends_at) e.ends_at = patch.ends_at;
    state.placeChanged = false;
  }
  return r;
}

/** Rows with their key field filled, other fields trimmed. */
function clean(rows, keys, must) {
  return rows
    .map(r => Object.fromEntries(keys.map(k => [k, String(r[k] ?? '').trim()])))
    .filter(r => r[must]);
}

// ── Repeating rows ──────────────────────────────────────────────────────────

const ROW_FIELDS = {};

function drawRows(id, rows, max, fields) {
  ROW_FIELDS[id] = fields;
  const host = $(id);
  host.innerHTML = rows.map((r, i) => `
    <div class="list-row" data-i="${i}">
      ${fields.map(([k, label, len, ph, area]) => area
        ? `<label class="field"><span>${label}</span><textarea data-k="${k}" maxlength="${len}" rows="2" placeholder="${esc(ph)}">${esc(r[k] ?? '')}</textarea></label>`
        : `<label class="field"><span>${label}</span><input data-k="${k}" maxlength="${len}" value="${esc(r[k] ?? '')}" placeholder="${esc(ph)}"></label>`).join('')}
      <button type="button" class="row-x" aria-label="Remove">×</button>
    </div>`).join('');
  host.querySelectorAll('.list-row').forEach(node => {
    const i = Number(node.dataset.i);
    node.querySelectorAll('[data-k]').forEach(inp => inp.addEventListener('input', () => { rows[i][inp.dataset.k] = inp.value; }));
    node.querySelector('.row-x').addEventListener('click', () => { rows.splice(i, 1); drawRows(id, rows, max, fields); });
  });
  const add = { schedule: 'addSched', course: 'addCourse', faq: 'addFaq' }[id];
  if ($(add)) $(add).hidden = rows.length >= max;
}

function addRow(id, rows, max) {
  if (rows.length >= max) return;
  rows.push({});
  drawRows(id, rows, max, ROW_FIELDS[id]);
  $(id).lastElementChild?.querySelector('input,textarea')?.focus();
}

// ── Pictures ────────────────────────────────────────────────────────────────

function wirePicture({ eventId, key, fileInput, removeBtn, box, msg, crop, state, stateKey }) {
  const noun = crop.aspect < 1 ? 'poster' : 'map';
  const show = async (path) => {
    const url = path ? (await imageUrls([path])).get(path) : null;
    $(box).innerHTML = url ? `<img src="${esc(url)}" alt="">` : `<span>${crop.aspect < 1 ? '2:3' : '16:9'}</span>`;
    $(removeBtn).hidden = !path;
    const label = $(fileInput)?.parentElement?.querySelector('[data-label]');
    if (label) label.textContent = `${path ? 'Replace' : 'Add'} ${noun}`;
  };
  $(fileInput)?.addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    const blob = await cropImage(file, crop);
    if (!blob) return;
    say($(msg), 'Uploading…');
    const up = await uploadImage(eventId, blob);
    if (!up.ok) return say($(msg), up.text, 'err');
    const r = await updateEvent(eventId, { [key]: up.path });
    if (!r.ok) { await removeImages([up.path]); return say($(msg), r.text, 'err'); }
    await removeImages([r.value?.old_cover_path, r.value?.old_course_map_path]);
    state[stateKey] = up.path;
    await show(up.path);
    say($(msg), 'Saved.', 'ok');
  });
  $(removeBtn)?.addEventListener('click', async () => {
    const r = await updateEvent(eventId, { [key]: null });
    if (!r.ok) return say($(msg), r.text, 'err');
    await removeImages([r.value?.old_cover_path, r.value?.old_course_map_path]);
    state[stateKey] = null;
    await show(null);
    say($(msg), 'Removed.', 'ok');
  });
}

// ── Bits ────────────────────────────────────────────────────────────────────

const ROLE_LINE = { owner: 'you’re the owner', organiser: 'you’re an organiser', run_leader: 'you’re a run leader' };

/** The host the dashboard's switcher was on ("squad:<id>" / "organizer:<id>"), same origin. */
function rememberedHost() {
  try { return localStorage.getItem('pacr.host.ctx'); } catch { return null; }
}

const TICK = `<svg class="host-tick" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Verified"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>`;

function hostFace(o) {
  const initials = String(o.name ?? '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return o.pic
    ? `<img class="host-face ${o.kind}" src="${esc(o.pic)}" alt="">`
    : `<span class="host-face ${o.kind}" aria-hidden="true">${esc(initials)}</span>`;
}

function hostChoice(o, checked) {
  return `
    <label class="choice host-choice${o.disabled ? ' is-off' : ''}">
      <input type="radio" name="host" value="${esc(o.key)}" ${checked ? 'checked' : ''} ${o.disabled ? 'disabled' : ''}>
      ${hostFace(o)}
      <span><b>${esc(o.name)}${o.verified ? TICK : ''}</b><i>${esc(o.sub)}</i></span>
    </label>`;
}

function hostCard(o) {
  return `
    <div class="host-card">
      ${hostFace(o)}
      <span><b>${esc(o.name)}${o.verified ? TICK : ''}</b><i>${esc(o.sub)}</i></span>
    </div>`;
}

function choice(name, value, title, sub, checked) {
  return `
    <label class="choice">
      <input type="radio" name="${name}" value="${esc(value)}" ${checked ? 'checked' : ''}>
      <span><b>${esc(title)}</b><i>${esc(sub)}</i></span>
    </label>`;
}
