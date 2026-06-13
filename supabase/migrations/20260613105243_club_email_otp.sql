-- pacr.life — club_signups: require a verified email, make mobile optional.
-- Follows the create_signup_tables migration. The club form now collects an
-- OTP-verified email (Supabase Auth email OTP) plus an optional mobile,
-- replacing the single freetext "contact" field. Inserts happen server-side
-- (api/signup.js) only after the OTP is verified, which sets email_verified.
--
-- club_signups is empty at apply time, so dropping/adding columns is safe.

alter table public.club_signups drop column if exists contact;

alter table public.club_signups add column if not exists email          text;
alter table public.club_signups add column if not exists mobile         text;
alter table public.club_signups add column if not exists email_verified boolean not null default false;

-- Email is the verified identifier for a club signup, so it's required.
alter table public.club_signups alter column email set not null;
