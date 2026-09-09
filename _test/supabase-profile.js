// Stub of js/supabase.js for the PROFILE smoke harness. Swapped in via an
// import map so the REAL js/profile.js runs its true startup path against
// canned rows. Separate from _test/supabase.js because the profile reads
// tables the feed does not (a full users row, a season of run_summaries, both
// directions of follows) and the feed harness should not shift under it.
//
// The builder here honours eq/in/limit and the { count, head } select option,
// because the profile branches on all three.

export const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

export function initials(name) {
  const p = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return p.length === 1 ? p[0].slice(0,2).toUpperCase() : (p[0][0]+p[p.length-1][0]).toUpperCase();
}

export function num(n) { return Number(n ?? 0).toLocaleString('en-IN'); }

export async function signedUrlsFor(sb, bucket, paths) {
  const svg = (fill) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">` +
    `<rect width="600" height="600" fill="${fill}"/></svg>`);
  const fills = ['#B9C36A', '#8FA33F', '#C8D96A'];
  return new Map((paths ?? []).filter(Boolean).map((p, i) => [p, svg(fills[i % fills.length])]));
}

const ME = '11111111-1111-4111-8111-111111111111';
const SQ = '66666666-6666-4666-8666-666666666666';
const SQ2 = '77777777-7777-4777-8777-777777777777';
const DAY = 86400e3;

function isoWeekKey(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// 52 runs over the last 15 weeks: three a week, one of them long, with a
// half-marathon in the middle so the milestone rows have something to find.
const RUNS = (() => {
  const out = [];
  for (let w = 14; w >= 0; w--) {
    for (const [dayOffset, km, pace] of [[0, 6.1, 352], [2, 9.4, 336], [5, 14.8 + (14 - w) * 0.6, 365]]) {
      const started = new Date(Date.now() - (w * 7 - dayOffset) * DAY - 3 * 3600e3);
      if (started.getTime() > Date.now()) continue;
      const distance = w === 5 && dayOffset === 5 ? 21.4 : km;
      out.push({
        user_id: ME,
        started_at: started.toISOString(),
        distance_km: distance,
        duration_sec: Math.round(distance * pace),
        pace_sec_per_km: pace,
        neighborhood: dayOffset === 5 ? 'Cubbon Park' : 'HSR Layout',
        week_key: isoWeekKey(started),
      });
    }
  }
  return out.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
})();

const post = (i, visibility) => ({
  id: `0b00000${i}-0000-4000-8000-00000000000a`, circle_id: SQ, author_id: ME,
  kind: i === 1 ? 'photo' : 'run', body: `Session ${i}. Held the pace to the end.`,
  image_path: i === 1 ? 'me/a.jpg' : null, pinned: i === 2, hidden_at: null,
  created_at: new Date(Date.now() - i * 30 * 3600e3).toISOString(), run_id: 'r1', visibility,
  post_targets: [{ circle_id: SQ }],
  author: { display_name: 'Vishnu P' },
  run: { distance_km: 12.4, duration_sec: 3862, pace_sec_per_km: 311,
         started_at: new Date().toISOString(), neighborhood: 'Cubbon Park' },
  post_likes: [{ count: 7 * i }], post_comments: [{ count: i }],
});

const DATA = {
  users: [
    { id: ME, display_name: 'Vishnu P', avatar_path: 'me/face.jpg',
      home_neighborhood: 'HSR Layout', current_streak_days: 9,
      created_at: new Date(Date.now() - 720 * DAY).toISOString() },
    { id: 'a1', display_name: 'Ananya R', avatar_path: 'a1/face.jpg',
      home_neighborhood: 'Indiranagar', current_streak_days: 22 },
    { id: 'a2', display_name: 'Kiran M', avatar_path: null,
      home_neighborhood: 'Jayanagar', current_streak_days: 0 },
  ],
  memberships: [
    { circle_id: SQ, role: 'owner', user_id: ME, joined_at: new Date(Date.now() - 300 * DAY).toISOString(),
      circles: { id: SQ, name: 'HSR Layout Run Club' } },
    { circle_id: SQ2, role: 'member', user_id: ME, joined_at: new Date(Date.now() - 90 * DAY).toISOString(),
      circles: { id: SQ2, name: 'Pacr One Club' } },
  ],
  posts: [post(1, 'followers'), post(2, 'circle'), post(3, 'public')],
  post_likes: [],
  follows: [
    { follower_id: ME, followee_id: 'a1', created_at: new Date(Date.now() - 40 * DAY).toISOString() },
    { follower_id: ME, followee_id: 'a2', created_at: new Date(Date.now() - 12 * DAY).toISOString() },
    { follower_id: 'a1', followee_id: ME, created_at: new Date(Date.now() - 60 * DAY).toISOString() },
    { follower_id: 'zz', followee_id: ME, created_at: new Date(Date.now() - 3 * DAY).toISOString() },
  ],
  run_summaries: RUNS,
};

function builder(table) {
  const state = { rows: DATA[table] ?? [], count: false, limit: null };
  const api = {
    select(_cols, opts) { if (opts?.count) state.count = true; return api; },
    eq(col, val) { state.rows = state.rows.filter(r => r[col] === val); return api; },
    in(col, vals) { state.rows = state.rows.filter(r => vals.includes(r[col])); return api; },
    or() { return api; },
    order() { return api; },
    limit(n) { state.limit = n; return api; },
    insert() { return api; }, upsert() { return api; }, delete() { return api; }, update() { return api; },
    maybeSingle: async () => ({ data: state.rows[0] ?? null, error: null }),
    single: async () => ({ data: state.rows[0] ?? null, error: null }),
    then(res) {
      const rows = state.limit ? state.rows.slice(0, state.limit) : state.rows;
      return Promise.resolve({
        data: state.count ? null : rows,
        count: state.count ? state.rows.length : undefined,
        error: null,
      }).then(res);
    },
  };
  return api;
}

export async function getSupabase() {
  return {
    from: builder,
    rpc: async (name) => ({ data: name === 'retract_my_posts' ? 2 : [], error: null }),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: ME, email: 'me@pacr.life' } } } }),
      getUser: async () => ({ data: { user: { id: ME, email: 'me@pacr.life' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
  };
}
