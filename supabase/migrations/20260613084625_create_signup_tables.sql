-- pacr.life — signup tables for the marketing-site forms
-- Applied to the Pacr-Web Supabase project via `supabase db push`.
--
-- Security model: the anon key is used server-side by the Vercel function
-- (api/signup.js) and never ships to the browser. RLS is enabled here with an
-- INSERT-only policy as defense-in-depth — even that key can only insert, not
-- read/update/delete. Read collected signups from the Supabase dashboard.
--
-- Re-runnable: guarded with IF NOT EXISTS / DROP POLICY IF EXISTS.

-- ── club signups (primary CTA — top of funnel) ──────────────────────────
create table if not exists public.club_signups (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null,
  city         text not null,
  frequency    text,           -- '2-3' | '3-4' | '5+'  (captain signal, plan §5)
  contact      text not null,  -- WhatsApp number or email — runner's choice
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_term     text,
  utm_content  text
);

-- ── early access signups (secondary CTA — app conversion) ───────────────
create table if not exists public.early_access_signups (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null,
  email        text not null,
  city         text not null,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_term     text,
  utm_content  text
);

-- ── Row Level Security ──────────────────────────────────────────────────
alter table public.club_signups         enable row level security;
alter table public.early_access_signups enable row level security;

-- Explicit table grant so the anon/authenticated roles may INSERT.
-- (No SELECT/UPDATE/DELETE grant — and with no SELECT policy below, reads
--  return zero rows even where SELECT is granted by Supabase defaults.)
grant insert on public.club_signups         to anon, authenticated;
grant insert on public.early_access_signups to anon, authenticated;

drop policy if exists "anon can insert club signups" on public.club_signups;
create policy "anon can insert club signups"
  on public.club_signups for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anon can insert early access signups" on public.early_access_signups;
create policy "anon can insert early access signups"
  on public.early_access_signups for insert
  to anon, authenticated
  with check (true);
