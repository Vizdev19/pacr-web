// ─────────────────────────────────────────────────────────────────────────────
// Moderation — report, block, and the one-time community-rules consent.
//
// Ported from pacr/src/services/moderation.ts, which backs App Store Guideline
// 1.2 (migration 20260826140000). Same conventions as the rest of this site:
// every function is null-safe when the backend is unavailable (returns
// null / [] / false — never throws), and results the UI branches on are
// discriminated.
//
// The server is the authority throughout. A block is enforced in RLS, so the
// blocked party's posts stop being *fetchable*, not merely hidden.
//
// This ships in the same release as the composer, deliberately: a surface that
// accepts user content without report and block is the actual risk, not web
// posting itself.
// ─────────────────────────────────────────────────────────────────────────────

/** Sheet order is deliberate: the two most-used reasons sit at the top. */
export const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'spam',       label: 'Spam or a scam' },
  { value: 'hate',       label: 'Hate speech' },
  { value: 'sexual',     label: 'Sexual content' },
  { value: 'violence',   label: 'Violence or threats' },
  { value: 'self_harm',  label: 'Self-harm' },
  { value: 'other',      label: 'Something else' },
];

/**
 * File a report against a post, comment or user.
 *
 * Returns { ok:true } or { ok:false, reason } where reason is
 * 'already_reported' | 'email_required' | 'error'.
 */
export async function reportContent(sb, { target, targetId, reason, note }) {
  if (!sb) return { ok: false, reason: 'error' };
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return { ok: false, reason: 'error' };

    const { error } = await sb.from('content_reports').insert({
      reporter_id: user.id,
      target_type: target,
      target_id: targetId,
      reason,
      note: note?.trim() || null,
    });

    if (error) {
      // 23505 — the (reporter, type, target) unique constraint.
      if (error.code === '23505') return { ok: false, reason: 'already_reported' };
      // RLS rejections all surface as 42501. The only gate a signed-in member
      // can realistically trip is the email clause, which mirrors posting.
      if (error.code === '42501') return { ok: false, reason: 'email_required' };
      console.warn('[pacr] report failed', error.message);
      return { ok: false, reason: 'error' };
    }
    return { ok: true };
  } catch (e) {
    console.warn('[pacr] report failed', e);
    return { ok: false, reason: 'error' };
  }
}

export async function blockUser(sb, userId) {
  if (!sb) return false;
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    // ignoreDuplicates → ON CONFLICT DO NOTHING. A plain upsert would compile
    // to DO UPDATE, which needs an UPDATE grant + policy that user_blocks
    // deliberately doesn't have — so re-blocking someone already blocked
    // would fail outright.
    const { error } = await sb.from('user_blocks')
      .upsert(
        { blocker_id: user.id, blocked_id: userId },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      )
      .select('blocked_id');
    if (error) {
      console.warn('[pacr] block failed', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[pacr] block failed', e);
    return false;
  }
}

export async function unblockUser(sb, userId) {
  if (!sb) return false;
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { error } = await sb.from('user_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', userId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Has this runner accepted the community rules?
 *
 * users.rules_accepted_at is shared across surfaces, so someone who accepted
 * in the app is never re-prompted here.
 */
export async function hasAcceptedRules(sb) {
  if (!sb) return false;
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { data, error } = await sb.from('users')
      .select('rules_accepted_at')
      .eq('id', user.id)
      .maybeSingle();
    if (error) return false;
    return !!data?.rules_accepted_at;
  } catch {
    return false;
  }
}

export async function acceptRules(sb) {
  if (!sb) return false;
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { data, error } = await sb.from('users')
      .update({ rules_accepted_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id');
    return !error && !!data?.length;
  } catch {
    return false;
  }
}
