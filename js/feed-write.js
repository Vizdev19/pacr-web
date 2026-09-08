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
  'id, circle_id, author_id, kind, body, image_path, pinned, hidden_at, created_at, run_id, ' +
  'author:users!posts_author_id_fkey(display_name), ' +
  'run:run_summaries!posts_run_id_fkey(distance_km, duration_sec, pace_sec_per_km, started_at), ' +
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

async function insertPost(sb, fields, circleId, kind) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, reason: 'error' };

  const { data, error } = await sb.from('posts')
    .insert({ ...fields, author_id: user.id, circle_id: circleId, kind })
    .select(POST_SELECT)
    .single();
  if (error || !data) {
    const reason = await classifyPostInsertFailure(sb, circleId, error?.message ?? '');
    console.warn('[pacr] post insert failed', reason, error?.message);
    return { ok: false, reason };
  }
  return { ok: true, row: data };
}

/** Plain text post (body required, mentions inline). */
export async function createTextPost(sb, circleId, body) {
  if (!sb) return { ok: false, reason: 'error' };
  const trimmed = String(body ?? '').trim();
  if (!trimmed || trimmed.length > MAX_BODY) return { ok: false, reason: 'error' };
  try {
    return await insertPost(sb, { body: trimmed }, circleId, 'text');
  } catch (e) {
    console.warn('[pacr] post insert failed', e);
    return { ok: false, reason: 'error' };
  }
}

function uploadPathFor(circleId, contentType) {
  const isPng = contentType === 'image/png';
  const rand = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${circleId}/${rand}.${isPng ? 'png' : 'jpg'}`;
}

/**
 * Photo post: upload the bytes first, then insert the row. On insert failure
 * the freshly-uploaded object is best-effort removed so we don't strand it.
 *
 * `blob` rather than the app's local file URI — in a browser the picker hands
 * us a File and downscaleImage returns a Blob, so there is nothing to read off
 * a filesystem.
 */
export async function createImagePost(sb, circleId, kind, blob, caption, runId) {
  if (!sb) return { ok: false, reason: 'error' };

  const body = String(caption ?? '').trim() ? String(caption).trim().slice(0, MAX_BODY) : null;
  const contentType = blob?.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const path = uploadPathFor(circleId, contentType);
  try {
    const { error: upErr } = await sb.storage
      .from(POST_IMAGE_BUCKET)
      .upload(path, blob, { contentType, upsert: false });
    if (upErr) {
      // An upload rejected by storage RLS carries the same gates as the posts
      // insert — classify it the same way.
      const reason = await classifyPostInsertFailure(sb, circleId, upErr.message ?? '');
      console.warn('[pacr] image upload failed', reason, upErr.message);
      return { ok: false, reason: reason === 'error' ? 'upload_failed' : reason };
    }

    const result = await insertPost(
      sb, { body, image_path: path, run_id: runId ?? null }, circleId, kind,
    );
    if (!result.ok) {
      try { await sb.storage.from(POST_IMAGE_BUCKET).remove([path]); } catch {}
    }
    return result;
  } catch (e) {
    console.warn('[pacr] image post failed', e);
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

export async function listComments(sb, postId, meId) {
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('post_comments')
      .select('id, post_id, author_id, body, hidden_at, created_at, users(display_name)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(COMMENTS_CAP);
    if (error) return [];
    return (data ?? []).map(row => ({
      id: row.id,
      post_id: row.post_id,
      author_id: row.author_id,
      author_name: row.users?.display_name ?? '—',
      body: row.body,
      created_at: row.created_at,
      is_mine: row.author_id === meId,
      hidden: !!row.hidden_at,
    }));
  } catch {
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
