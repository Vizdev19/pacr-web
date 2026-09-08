// Stub of js/supabase.js for the smoke harness. Swapped in via an import map so
// the REAL js/feed.js runs its true startup path against canned data.
export const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function initials(name) {
  const p = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return p.length === 1 ? p[0].slice(0,2).toUpperCase() : (p[0][0]+p[p.length-1][0]).toUpperCase();
}
export async function signedUrlsFor(sb, bucket, paths) {
  // Three shapes so cropping is measurable: 4:5 portrait, an extreme 9:16, and
  // a 3:2 landscape. `charset=utf-8` matters — some browsers reject the
  // non-standard `;utf8,` form outright and the image never loads.
  const svg = (w, h) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="${w}" height="${h}" fill="#B9C36A"/></svg>`);
  const shapes = { 'me/a.jpg': svg(1080, 1350), 'me/b.jpg': svg(1080, 1920), 'me/c.jpg': svg(1500, 1000) };
  return new Map((paths ?? []).filter(Boolean).map(p => [p, shapes[p] ?? svg(1080, 1350)]));
}


const ME = '11111111-1111-4111-8111-111111111111';
const SQ = '66666666-6666-4666-8666-666666666666';
const post = (i) => ({
  id: `0b00000${i}-0000-4000-8000-00000000000a`, circle_id: SQ, author_id: '22222222-2222-4222-8222-222222222222',
  kind: 'photo', body: `Tempo ${i}. Held the pace.`, image_path: ['me/a.jpg','me/b.jpg','me/c.jpg'][i-1], pinned: false, hidden_at: null,
  created_at: new Date(Date.now() - i*3600e3).toISOString(), run_id: null, visibility: 'followers',
  post_targets: [{ circle_id: SQ }],
  author: { display_name: 'Ananya R' },
  run: { distance_km: 12.4, duration_sec: 3862, pace_sec_per_km: 311, started_at: new Date().toISOString(), neighborhood: 'Cubbon' },
  post_likes: [{ count: 7 }], post_comments: [{ count: 2 }],
});
const DATA = {
  memberships: [
    { circle_id: SQ, role: 'owner', user_id: ME, users: { display_name: 'Me' },
      circles: { id: SQ, name: 'HSR Layout Run Club', posting_mode: 'all' } },
    { circle_id: '77777777-7777-4777-8777-777777777777', role: 'member', user_id: ME, users: { display_name: 'Me' },
      circles: { id: '77777777-7777-4777-8777-777777777777', name: 'Pacr One Club', posting_mode: 'all' } },
  ],
  posts: [post(1), post(2), post(3)],
  post_likes: [], follows: [], users: [{ display_name: 'Vishnu P', public_since: null }],
  run_summaries: [{ user_id: ME, distance_km: 8.2 }, { user_id: ME, distance_km: 10.0 }],
  spots: [{ id: 's1', name: 'Cubbon Park Loop', city: 'Bengaluru', loop_km: 4.1, surface: 'tarmac' }],
  post_targets: [{ post_id: 'x', circle_id: SQ }],
};

function builder(table) {
  const rows = DATA[table] ?? [];
  const api = {
    select() { return api; }, eq() { return api; }, in() { return api; }, or() { return api; },
    order() { return api; }, limit() { return api; }, insert(v) { api._ins = v; return api; },
    upsert() { return api; }, delete() { return api; }, update() { return api; },
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    single: async () => ({ data: rows[0] ?? null, error: null }),
    then(res) { return Promise.resolve({ data: rows, error: null }).then(res); },
  };
  return api;
}

export async function getSupabase() {
  return {
    from: builder,
    rpc: async (name) => ({ data: name === 'retract_my_posts' ? 0 : [], error: null }),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: ME, email: 'me@x.com' } } } }),
      getUser: async () => ({ data: { user: { id: ME, email: 'me@x.com' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
  };
}
