-- ════════════════════════════════════════════════════════════════════
--  KidsCode Quest — optional cloud save (offline-first)
--  Apply to your project:  supabase link --project-ref <ref> && supabase db push
--  Namespaced kcq_* so it safely coexists with other apps in the same project.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.kcq_progress (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  xp           integer not null default 0,
  coins        integer not null default 0,
  total_stars  integer not null default 0,
  state        jsonb   not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table public.kcq_progress enable row level security;

-- Public read of NON-PII game stats (needed for the leaderboard; intentional).
drop policy if exists "kcq_public_select" on public.kcq_progress;
create policy "kcq_public_select" on public.kcq_progress
  for select using (true);

-- Writes are restricted to the row's owner.
drop policy if exists "kcq_own_insert" on public.kcq_progress;
create policy "kcq_own_insert" on public.kcq_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "kcq_own_update" on public.kcq_progress;
create policy "kcq_own_update" on public.kcq_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Public leaderboard — top 100, safe columns only, respects caller RLS.
drop view if exists public.kcq_leaderboard;
create view public.kcq_leaderboard
  with (security_invoker = on) as
  select display_name, xp, total_stars
  from public.kcq_progress
  order by xp desc, total_stars desc
  limit 100;

grant select on public.kcq_leaderboard to anon, authenticated;
