-- pacr.life — DB writes now go through the service role in api/signup.js, which
-- bypasses RLS. PostgreSQL's RLS handling of INSERT ... ON CONFLICT DO UPDATE
-- can't be satisfied for the anon role without also granting SELECT (which would
-- expose reads), so the upsert is done server-side with the service key instead.
--
-- Revert the anon UPDATE relaxation added in the previous migration. The anon
-- key keeps only: OTP auth (GoTrue) + the existing INSERT policy (vestigial, but
-- kept so the currently-deployed anon-insert build keeps working until redeploy).
-- The unique index on email stays — it's the upsert's conflict arbiter.

drop policy if exists "anon can update club signups" on public.club_signups;
revoke update on public.club_signups from anon, authenticated;
