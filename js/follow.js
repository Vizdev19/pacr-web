// ─────────────────────────────────────────────────────────────────────────────
// Follows — the social graph alongside the circle graph.
//
// Backed by 20260908120000_follows.sql. Two things there decide everything in
// this file:
//
//   • Visibility lives on the PROFILE (users.public_since), not the post. The
//     shipped app only writes circle-scoped posts, so a per-post flag would be
//     set by nobody. Posts created AFTER public_since are visible to followers;
//     the strict inequality is what stops opting in from retroactively
//     publishing squad-only history.
//
//   • The Following feed comes from an RPC, not a PostgREST query. Keyset
//     pagination cannot survive RLS doing the filtering — `author_id in
//     (followees)` returns a page RLS then thins out, so a short page means
//     "most of that page was squad-only", not "no more posts", and paging stops
//     while older visible posts still exist.
//
// Following is the one write pacr.life performs that is not user content: no
// text, no image, nothing another user can report. That is why it is allowed
// here while posting run cards and moderating queues stay in the app.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

/** Ids this user follows. The graph is small; one query beats N membership checks. */
export async function listFollowingIds(sb, meId) {
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('follows')
      .select('followee_id')
      .eq('follower_id', meId);
    if (error) return [];
    return (data ?? []).map(r => r.followee_id);
  } catch {
    return [];
  }
}

/**
 * How many follow me, and how many I follow.
 *
 * Counted server-side rather than by pulling the edges: follows_select_own lets
 * me see every row I am an endpoint of, and the follower half of that is the
 * half a profile page wants as a number and cannot always name (users is only
 * readable for squadmates and for people I follow back).
 */
export async function followCounts(sb, meId) {
  const out = { followers: 0, following: 0 };
  if (!sb) return out;
  const one = async (column) => {
    try {
      const { count, error } = await sb.from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq(column, meId);
      return error ? 0 : (Number(count) || 0);
    } catch {
      return 0;
    }
  };
  const [followers, following] = await Promise.all([
    one('followee_id'), one('follower_id'),
  ]);
  return { followers, following };
}

/**
 * The edges themselves, newest first: 'following' returns who I follow,
 * 'followers' returns who follows me. Ids and dates only — resolving a name is
 * the caller's job, because whether a name resolves is an RLS question.
 */
export async function listFollowEdges(sb, meId, view = 'following', limit = 200) {
  if (!sb) return [];
  const mine = view === 'followers' ? 'followee_id' : 'follower_id';
  const theirs = view === 'followers' ? 'follower_id' : 'followee_id';
  try {
    const { data, error } = await sb.from('follows')
      .select(`${theirs}, created_at`)
      .eq(mine, meId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []).map(r => ({ userId: r[theirs], since: r.created_at }));
  } catch {
    return [];
  }
}

export async function followUser(sb, meId, userId) {
  if (!sb) return { ok: false, reason: 'error' };
  try {
    const { error } = await sb.from('follows')
      .insert({ follower_id: meId, followee_id: userId });
    if (error) {
      // 23505 — already following. Idempotent from the caller's point of view.
      if (error.code === '23505') return { ok: true };
      // The only gate a signed-in runner can realistically trip is the email
      // clause, which mirrors posting.
      if (error.code === '42501') return { ok: false, reason: 'email_required' };
      console.warn('[pacr] follow failed', error.message);
      return { ok: false, reason: 'error' };
    }
    return { ok: true };
  } catch (e) {
    console.warn('[pacr] follow failed', e);
    return { ok: false, reason: 'error' };
  }
}

export async function unfollowUser(sb, meId, userId) {
  if (!sb) return false;
  try {
    const { error } = await sb.from('follows')
      .delete().eq('follower_id', meId).eq('followee_id', userId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * One page of the Following feed, newest first.
 *
 * Rows come back flat from list_following_feed rather than as PostgREST embeds:
 * image_path is already nulled for run posts server-side, so a run card's
 * rasterized route line is not merely unrendered here — it is unreachable.
 */
export async function listFollowingFeed(sb, cursor) {
  if (!sb) return { rows: [], cursor: null };
  try {
    const { data, error } = await sb.rpc('list_following_feed', {
      p_limit: PAGE_SIZE,
      p_cursor_created_at: cursor?.createdAt ?? null,
      p_cursor_id: cursor?.id ?? null,
    });
    if (error) {
      console.warn('[pacr] following feed failed', error.message);
      return { rows: [], cursor: null, failed: true };
    }
    const rows = data ?? [];
    const last = rows[rows.length - 1];
    return {
      rows,
      cursor: rows.length === PAGE_SIZE && last
        ? { createdAt: last.created_at, id: last.id }
        : null,
    };
  } catch (e) {
    console.warn('[pacr] following feed failed', e);
    return { rows: [], cursor: null, failed: true };
  }
}

// The profile-visibility helpers that lived here are gone: 20260909120000 moved
// visibility onto the post, so there is no profile-level switch to read or
// write. users.public_since survives only as the server-side default for app
// builds released before the audience control. Retraction is retractMyPosts().

// ─── Suggestions ────────────────────────────────────────────────────────────

/**
 * People to follow: squadmates you don't already follow.
 *
 * Deliberately not a people directory. Squadmates are readable through the
 * existing users_select_co_members policy, so this needs no new exposure
 * surface and nothing here is enumerable by a stranger. Following a squadmate
 * is not redundant with the Squad tab — it is how you see their posts from the
 * OTHER squads they are in, which is the whole point of the graph.
 */
export async function suggestedToFollow(sb, meId, circleIds, alreadyFollowing) {
  if (!sb || circleIds.length === 0) return [];
  try {
    const { data, error } = await sb.from('memberships')
      .select('user_id, users(display_name)')
      .in('circle_id', circleIds)
      .limit(200);
    if (error) return [];
    const skip = new Set([meId, ...alreadyFollowing]);
    const seen = new Set();
    const out = [];
    for (const row of data ?? []) {
      if (skip.has(row.user_id) || seen.has(row.user_id)) continue;
      seen.add(row.user_id);
      out.push({ userId: row.user_id, displayName: row.users?.display_name ?? '—' });
    }
    return out;
  } catch {
    return [];
  }
}

// ─── Discover ───────────────────────────────────────────────────────────────

/**
 * One page of the public feed. Strictly chronological — no ranking, no
 * engagement weighting — and the same keyset shape as the Following feed.
 */
export async function listPublicFeed(sb, cursor) {
  if (!sb) return { rows: [], cursor: null };
  try {
    const { data, error } = await sb.rpc('list_public_feed', {
      p_limit: PAGE_SIZE,
      p_cursor_created_at: cursor?.createdAt ?? null,
      p_cursor_id: cursor?.id ?? null,
    });
    if (error) {
      console.warn('[pacr] public feed failed', error.message);
      return { rows: [], cursor: null, failed: true };
    }
    const rows = data ?? [];
    const last = rows[rows.length - 1];
    return {
      rows,
      cursor: rows.length === PAGE_SIZE && last
        ? { createdAt: last.created_at, id: last.id }
        : null,
    };
  } catch (e) {
    console.warn('[pacr] public feed failed', e);
    return { rows: [], cursor: null, failed: true };
  }
}

// ─── Mute ───────────────────────────────────────────────────────────────────

/**
 * One-way and silent, unlike a block: their posts leave your feeds, they keep
 * seeing yours, and they are never told. Discover puts strangers in front of
 * people — this is the low-stakes way out, block is the high-stakes one.
 */
export async function muteUser(sb, meId, userId) {
  if (!sb) return false;
  try {
    const { error } = await sb.from('user_mutes')
      .upsert({ muter_id: meId, muted_id: userId },
              { onConflict: 'muter_id,muted_id', ignoreDuplicates: true });
    return !error;
  } catch {
    return false;
  }
}

// ─── Retraction ─────────────────────────────────────────────────────────────

/**
 * Rewrite every one of my posts back to squad-only. One-way on purpose: an
 * un-retract would silently republish things people had pulled back.
 * Returns how many changed, or null on failure.
 */
export async function retractMyPosts(sb) {
  if (!sb) return null;
  try {
    const { data, error } = await sb.rpc('retract_my_posts');
    if (error) {
      console.warn('[pacr] retract failed', error.message);
      return null;
    }
    return Number(data) || 0;
  } catch {
    return null;
  }
}
