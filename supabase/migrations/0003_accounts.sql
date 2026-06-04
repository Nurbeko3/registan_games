-- ════════════════════════════════════════════════════════════════════
--  KidsCode Quest — username/password student accounts (classroom model)
--  Admins (see 0004) pre-create accounts; students log in with login + password.
--  No email, no Supabase Auth: a locked table reachable only through
--  SECURITY DEFINER RPCs. Apply:  supabase db push   (or paste in SQL editor)
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions; -- crypt(), gen_salt()

-- ── accounts ─────────────────────────────────────────────────────────
create table if not exists public.kcq_users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null,
  pass_hash     text not null,
  display_name  text not null default '',
  session_token uuid,
  xp            integer not null default 0,
  coins         integer not null default 0,
  total_stars   integer not null default 0,
  avatar_id     text not null default 'kid',
  theme_id      text not null default 'cloud',
  state         jsonb   not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists kcq_users_username_uniq on public.kcq_users (lower(username));

-- Lock the table: only the SECURITY DEFINER funcs below ever touch it.
alter table public.kcq_users enable row level security;
revoke all on public.kcq_users from anon, authenticated;

-- ── LOGIN: verify password → rotate a session token → return profile ──
create or replace function public.kcq_login(p_username text, p_password text)
returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare u public.kcq_users; tok uuid;
begin
  select * into u from public.kcq_users where lower(username) = lower(trim(p_username));
  if not found or u.pass_hash <> crypt(p_password, u.pass_hash) then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;
  tok := gen_random_uuid();
  update public.kcq_users set session_token = tok, updated_at = now() where id = u.id;
  return jsonb_build_object('ok', true, 'token', tok, 'user', jsonb_build_object(
    'id', u.id, 'username', u.username, 'display_name', u.display_name,
    'xp', u.xp, 'coins', u.coins, 'total_stars', u.total_stars,
    'avatar_id', u.avatar_id, 'theme_id', u.theme_id, 'state', u.state));
end; $$;

-- ── RESUME: re-fetch profile from a stored session token ──────────────
create or replace function public.kcq_session(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare u public.kcq_users;
begin
  if p_token is null then return jsonb_build_object('ok', false); end if;
  select * into u from public.kcq_users where session_token = p_token;
  if not found then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'user', jsonb_build_object(
    'id', u.id, 'username', u.username, 'display_name', u.display_name,
    'xp', u.xp, 'coins', u.coins, 'total_stars', u.total_stars,
    'avatar_id', u.avatar_id, 'theme_id', u.theme_id, 'state', u.state));
end; $$;

-- ── SAVE: persist progress for a valid session token ──────────────────
create or replace function public.kcq_save(
  p_token uuid, p_xp integer, p_coins integer, p_total_stars integer,
  p_avatar text, p_theme text, p_display_name text, p_state jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare u public.kcq_users;
begin
  select * into u from public.kcq_users where session_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  update public.kcq_users set
    xp = greatest(coalesce(p_xp, xp), 0),
    coins = greatest(coalesce(p_coins, coins), 0),
    total_stars = greatest(coalesce(p_total_stars, total_stars), 0),
    avatar_id = coalesce(p_avatar, avatar_id),
    theme_id = coalesce(p_theme, theme_id),
    display_name = coalesce(p_display_name, display_name),
    state = coalesce(p_state, state),
    updated_at = now()
  where id = u.id;
  return jsonb_build_object('ok', true);
end; $$;

-- ── public leaderboard (safe columns only; bypasses RLS as a definer view) ──
drop view if exists public.kcq_leaderboard;
create view public.kcq_leaderboard as
  select username, display_name, xp, total_stars
  from public.kcq_users
  where xp > 0
  order by xp desc, total_stars desc
  limit 100;

grant execute on function public.kcq_login(text, text) to anon, authenticated;
grant execute on function public.kcq_session(uuid) to anon, authenticated;
grant execute on function public.kcq_save(uuid, integer, integer, integer, text, text, text, jsonb) to anon, authenticated;
grant select on public.kcq_leaderboard to anon, authenticated;
