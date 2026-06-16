-- pacr.life — club_signups: dedupe by email + allow upsert updates.
-- Follows club_email_otp. api/signup.js now upserts on email (ON CONFLICT
-- (email) DO UPDATE), so a returning runner updates their row instead of
-- creating a duplicate. Emails are stored lowercased by the function, so this
-- unique index dedupes case-insensitively.
--
-- The DO UPDATE path needs an UPDATE policy + grant for anon. The anon key is
-- used server-side only (api/signup.js, behind OTP verification) and is never
-- shipped to the browser, so this is an acceptable relaxation of insert-only.
-- Reads remain blocked (no SELECT policy).

create unique index if not exists club_signups_email_key
  on public.club_signups (email);

grant update on public.club_signups to anon, authenticated;

drop policy if exists "anon can update club signups" on public.club_signups;
create policy "anon can update club signups"
  on public.club_signups for update
  to anon, authenticated
  using (true) with check (true);
