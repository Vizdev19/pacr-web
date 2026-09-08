// ─────────────────────────────────────────────────────────────────────────────
// Feed writes — post, like, comment, pin, delete.
//
// Ported from the write half of pacr/src/services/feed.ts. Every RLS policy in
// the project keys off auth.uid() rather than a role, so a signed-in browser is
// indistinguishable from the app as far as Postgres is concerned: none of this
// needed a schema change. The gates below are the server's, mirrored here only
// so the UI can explain a refusal instead of showing a bare failure.
//
// Conventions kept from the app: null-safe (never throws), and every result the
// UI branches on is discriminated —
//   { ok:true, row } | { ok:false, reason:'email_required'|'read_only'
//                                        |'upload_failed'|'blocked_content'|'error' }
//
// The site has no analytics module, so the app's trackEvent calls become
// console.warn on the failure paths and nothing on the success paths.
// ─────────────────────────────────────────────────────────────────────────────

import { isBlockedContentError } from './content-filter.js';

const POST_IMAGE_BUCKET = 'post-images';

/**
 * The shared post projection.
 *
 * Lives here rather than in feed.js so the insert's returning-select and the
 * feed query can never drift apart. The author embed MUST name its foreign
 * key: post_likes and post_comments each carry FKs to both posts and users, so
 * PostgREST sees three possible posts→users paths and a bare users(...) fails
 * the whole request with PGRST201. The run embed names its FK for the same
 * reason.
 *
 * run_id has been written on every run post since the feature shipped
 * (pacr/src/services/feed.ts createImagePost) but was never selected by any
 * client — embedding run_summaries here lights up real stats on existing posts
 * retroactively.
 */
export const POST_SELECT =
  'id, circle_id, author_id, kind, body, image_path, pinned, hidden_at, created_at, run_id, visibility, ' +
  // Joined, not filtered on posts.circle_id: a post can name several squads and
  // circle_id holds only the first, so filtering on it would hide the post in
  // every other squad it was sent to. `!inner` makes it a real join.
  'post_targets!inner(circle_id), ' +
  'author:users!posts_author_id_fkey(display_name), ' +
  'run:run_summaries!posts_run_id_fkey(distance_km, duration_sec, pace_sec_per_km, started_at, neighborhood), ' +
  'post_likes(count), post_comments(count)';

export const MAX_BODY = 2000;
export const MAX_COMMENT = 1000;

// ─── Failure classification ─────────────────────────────────────────────────

/**
 * Classify an insert failure. RLS rejections all surface as the same 42501, so
 * this looks at what the caller's context makes most likely: no linked email →
 * the email gate; owners-only circle and I'm not the owner → read only.
 * Failure path only — no extra queries on success.
 */
async function classifyPostInsertFailure(sb, circleId, message) {
  // Unlike the RLS rejections below, the filter names itself — no guessing.
  if (isBlockedContentError(message)) return 'blocked_content';
  if (!/row-level security|42501/i.test(String(message ?? ''))) return 'error';
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user?.email) return 'email_required';
    const { data } = await sb.from('memberships')
      .select('role, circles(posting_mode)')
      .eq('circle_id', circleId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (data && data.circles?.posting_mode === 'owners_only' && data.role !== 'owner') {
      return 'read_only';
    }
  } catch {
    // fall through to generic
  }
  return 'error';
}

// ─── Posts ──────────────────────────────────────────────────────────────────

/**
 * Create one post with an audience.
 *
 * One row, many targets — not the one-row-per-squad fan-out the app still uses.
 * That shape existed because image reads were gated by the circle id in the
 * object path; 20260909120000 re-keys images to "<author_id>/<random>" so an
 * object follows its post, which is what makes a single row possible. Post to
 * two squads and your followers now and the followers see it ONCE, with one
 * like count.
 *
 * circle_id is still written (the first target) so app builds that predate the
 * audience control keep finding the post in at least one of its squads.
 *
 * `visibility` is 'circle' | 'followers' | 'public'. Public also targets every
 * squad the author is in — that is the caller's job, since only it knows the
 * full list.
 */
export async function createPost(sb, { targets, visibility, body, blob, kind, runId }) {
  if (!sb) return { ok: false, reason: 'error' };
  const circleIds = [...new Set(targets ?? [])];
  if (circleIds.length === 0) return { ok: false, reason: 'error' };

  const trimmed = String(body ?? '').trim();
  const text = trimmed ? trimmed.slice(0, MAX_BODY) : null;
  if (!text && !blob) return { ok: false, reason: 'error' };

  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return { ok: false, reason: 'error' };

    // Upload first: the path keys on the author, the only thing known before
    // the row exists.
    let imagePath = null;
    if (blob) {
      const contentType = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
      imagePath = `${user.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}` +
        (contentType === 'image/png' ? '.png' : '.jpg');
      const { error: upErr } = await sb.storage
        .from(POST_IMAGE_BUCKET)
        .upload(imagePath, blob, { contentType, upsert: false });
      if (upErr) {
        const reason = await classifyPostInsertFailure(sb, circleIds[0], upErr.message ?? '');
        console.warn('[pacr] image upload failed', reason, upErr.message);
        return { ok: false, reason: reason === 'error' ? 'upload_failed' : reason };
      }
    }

    const { data, error } = await sb.from('posts')
      .insert({
        author_id: user.id,
        circle_id: circleIds[0],
        kind: kind ?? (imagePath ? 'photo' : 'text'),
        body: text,
        image_path: imagePath,
        run_id: runId ?? null,
        visibility,
      })
      .select(POST_SELECT)
      .single();

    if (error || !data) {
      const reason = await classifyPostInsertFailure(sb, circleIds[0], error?.message ?? '');
      console.warn('[pacr] post insert failed', reason, error?.message);
      if (imagePath) { try { await sb.storage.from(POST_IMAGE_BUCKET).remove([imagePath]); } catch {} }
      return { ok: false, reason };
    }

    // The remaining targets. The insert trigger already filed circle_id, so
    // ignoreDuplicates rather than letting the first one collide.
    const rest = circleIds.map(id => ({ post_id: data.id, circle_id: id }));
    const { error: tErr } = await sb.from('post_targets')
      .upsert(rest, { onConflict: 'post_id,circle_id', ignoreDuplicates: true });
    if (tErr) {
      // A post that reached only some of its squads is worse than none: roll it
      // back rather than leave the author believing it landed everywhere.
      console.warn('[pacr] post targets failed', tErr.message);
      try { await sb.from('posts').delete().eq('id', data.id); } catch {}
      if (imagePath) { try { await sb.storage.from(POST_IMAGE_BUCKET).remove([imagePath]); } catch {} }
      return { ok: false, reason: 'error' };
    }

    return { ok: true, row: data };
  } catch (e) {
    console.warn('[pacr] post failed', e);
    return { ok: false, reason: 'error' };
  }
}

/**
 * Downscale a picked image to fit the bucket's 5 MiB / jpeg-png limits.
 *
 * The app downscales to ≤1600px before upload; matching that here keeps a
 * 12 MP phone photo dropped onto the site from bouncing off the bucket. PNGs
 * are re-encoded to JPEG for the same reason — a screenshot-sized PNG blows
 * the budget where its JPEG is a tenth the size.
 */
export async function downscaleImage(file, maxEdge = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
  if (!blob) throw new Error('encode_failed');
  return blob;
}

/** Delete a post (author deletes own, owner moderates any — RLS decides). */
export async function deletePost(sb, postId) {
  if (!sb) return false;
  try {
    // The Storage object is cleaned by the posts-DELETE webhook, not here.
    const { data, error } = await sb.from('posts')
      .delete().eq('id', postId).select('id');
    return !error && !!data?.length;
  } catch {
    return false;
  }
}

export async function toggleLike(sb, postId, like) {
  if (!sb) return false;
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;

    if (like) {
      const { error } = await sb.from('post_likes').upsert(
        { post_id: postId, user_id: user.id },
        { onConflict: 'post_id,user_id', ignoreDuplicates: true },
      );
      return !error;
    }
    const { error } = await sb.from('post_likes')
      .delete().eq('post_id', postId).eq('user_id', user.id);
    return !error;
  } catch {
    return false;
  }
}

/** Owner-only pin/unpin via the set_post_pinned RPC. */
export async function setPinned(sb, postId, pinned) {
  if (!sb) return false;
  try {
    const { error } = await sb.rpc('set_post_pinned', {
      p_post_id: postId, p_pinned: pinned,
    });
    return !error;
  } catch {
    return false;
  }
}

// ─── Comments ───────────────────────────────────────────────────────────────

const COMMENTS_CAP = 200;

/**
 * Comments for a post, via list_post_comments.
 *
 * Not a PostgREST read any more. The comment ROWS are readable wherever their
 * post is, but users.display_name is not — a commenter on a public post is
 * often neither a squadmate nor someone you follow, so a direct read renders
 * them as "—". The RPC returns the names alongside the rows and applies the
 * viewer's own block / mute / report filters.
 */
export async function listComments(sb, postId, meId) {
  if (!sb) return [];
  try {
    const { data, error } = await sb.rpc('list_post_comments', { p_post_id: postId });
    if (error) {
      console.warn('[pacr] comments failed', error.message);
      return [];
    }
    return (data ?? []).map(row => ({
      id: row.id,
      post_id: row.post_id,
      author_id: row.author_id,
      author_name: row.author_name ?? '—',
      body: row.body,
      created_at: row.created_at,
      is_mine: row.author_id === meId,
      hidden: !!row.hidden,
    }));
  } catch (e) {
    console.warn('[pacr] comments failed', e);
    return [];
  }
}

export async function addComment(sb, postId, body) {
  if (!sb) return { ok: false, reason: 'error' };
  const trimmed = String(body ?? '').trim();
  if (!trimmed || trimmed.length > MAX_COMMENT) return { ok: false, reason: 'error' };
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return { ok: false, reason: 'error' };

    const { data, error } = await sb.from('post_comments')
      .insert({ post_id: postId, author_id: user.id, body: trimmed })
      .select('id, post_id, author_id, body, created_at, users(display_name)')
      .single();
    if (error || !data) {
      // The filter names itself; RLS doesn't. A block also lands here as 42501,
      // but a blocked runner can't reach this composer in the first place — the
      // post never renders for them — so the only 42501 worth explaining is the
      // email gate.
      let reason;
      if (isBlockedContentError(error?.message)) {
        reason = 'blocked_content';
      } else if (/row-level security|42501/i.test(error?.message ?? '')) {
        reason = user.email ? 'error' : 'email_required';
      } else {
        reason = 'error';
      }
      console.warn('[pacr] comment failed', reason, error?.message);
      return { ok: false, reason };
    }
    return {
      ok: true,
      comment: {
        id: data.id,
        post_id: data.post_id,
        author_id: data.author_id,
        author_name: data.users?.display_name ?? 'You',
        body: data.body,
        created_at: data.created_at,
        is_mine: true,
        hidden: false,
      },
    };
  } catch (e) {
    console.warn('[pacr] comment failed', e);
    return { ok: false, reason: 'error' };
  }
}

export async function deleteComment(sb, commentId) {
  if (!sb) return false;
  try {
    const { data, error } = await sb.from('post_comments')
      .delete().eq('id', commentId).select('id');
    return !error && !!data?.length;
  } catch {
    return false;
  }
}

// ─── Members ────────────────────────────────────────────────────────────────

/**
 * Members of a circle — feeds @-autocomplete.
 *
 * Bounded because public clubs are. Oldest members first, so the owner is
 * always in the first page.
 */
export async function listMembers(sb, circleId, limit = 200) {
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('memberships')
      .select('user_id, role, joined_at, users(display_name)')
      .eq('circle_id', circleId)
      .order('joined_at', { ascending: true })
      .limit(limit);
    if (error) return [];
    return (data ?? []).map(row => ({
      userId: row.user_id,
      displayName: row.users?.display_name ?? '—',
      role: row.role === 'owner' ? 'owner' : 'member',
    }));
  } catch {
    return [];
  }
}
