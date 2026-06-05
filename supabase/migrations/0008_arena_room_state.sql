-- KidsCode Quest — Arena persistent room start state.
-- Realtime broadcast is still the fast path, but the canonical "match started"
-- handshake also lives in Postgres so joiners who miss a broadcast can recover.

alter table public.arena_rooms
  add column if not exists host_client_id text,
  add column if not exists host_token uuid,
  add column if not exists match_id text,
  add column if not exists seed integer,
  add column if not exists roster jsonb not null default '[]'::jsonb,
  add column if not exists started_at timestamptz,
  add column if not exists revision integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.arena_room_payload(r public.arena_rooms)
returns jsonb language sql stable set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'code', r.code,
    'host_client_id', r.host_client_id,
    'settings', r.settings,
    'status', r.status,
    'match_id', r.match_id,
    'seed', r.seed,
    'roster', r.roster,
    'started_at', r.started_at,
    'revision', r.revision,
    'updated_at', r.updated_at
  );
$$;

create or replace function public.arena_room_create(
  p_code text,
  p_host_client_id text,
  p_settings jsonb
)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare
  c text := upper(trim(coalesce(p_code, '')));
  h text := nullif(trim(coalesce(p_host_client_id, '')), '');
  tok uuid := gen_random_uuid();
  saved public.arena_rooms;
begin
  delete from public.arena_rooms where updated_at < now() - interval '2 hours' and status <> 'playing';

  if c !~ '^[0-9]{6}$' or h is null or h !~ '^[A-Za-z0-9_-]{2,48}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;

  insert into public.arena_rooms (
    code, host_client_id, host_token, settings, status, match_id, seed, roster, started_at, revision, updated_at
  )
  values (
    c, h, tok, coalesce(p_settings, '{}'::jsonb), 'lobby', null, null, '[]'::jsonb, null, 1, now()
  )
  on conflict (code) do update
    set host_client_id = excluded.host_client_id,
        host_token = excluded.host_token,
        settings = excluded.settings,
        status = 'lobby',
        match_id = null,
        seed = null,
        roster = '[]'::jsonb,
        started_at = null,
        revision = public.arena_rooms.revision + 1,
        updated_at = now()
    where public.arena_rooms.updated_at < now() - interval '2 hours'
       or public.arena_rooms.host_client_id = h
  returning * into saved;

  if saved.code is null then
    return jsonb_build_object('ok', false, 'reason', 'exists');
  end if;

  return jsonb_build_object('ok', true, 'token', saved.host_token, 'state', public.arena_room_payload(saved));
end; $$;

create or replace function public.arena_room_state(p_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  r public.arena_rooms;
begin
  select * into r from public.arena_rooms where code = upper(trim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('ok', false, 'reason', 'notfound'); end if;
  return jsonb_build_object('ok', true, 'state', public.arena_room_payload(r));
end; $$;

create or replace function public.arena_room_start(
  p_code text,
  p_host_token uuid,
  p_match_id text,
  p_seed integer,
  p_roster jsonb,
  p_settings jsonb,
  p_countdown_ms integer default 3200
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c text := upper(trim(coalesce(p_code, '')));
  saved public.arena_rooms;
  delay_ms integer := least(greatest(coalesce(p_countdown_ms, 3200), 0), 15000);
begin
  if c !~ '^[0-9]{6}$'
     or nullif(trim(coalesce(p_match_id, '')), '') is null
     or p_seed is null
     or p_seed < 0
     or p_seed > 2147483647
     or jsonb_typeof(coalesce(p_roster, '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;

  update public.arena_rooms
    set settings = coalesce(p_settings, settings),
        status = 'playing',
        match_id = p_match_id,
        seed = p_seed,
        roster = coalesce(p_roster, '[]'::jsonb),
        started_at = now() + (delay_ms::text || ' milliseconds')::interval,
        revision = revision + 1,
        updated_at = now()
    where code = c and host_token = p_host_token
  returning * into saved;

  if saved.code is null then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;

  return jsonb_build_object('ok', true, 'state', public.arena_room_payload(saved));
end; $$;

create or replace function public.arena_room_end(p_code text, p_host_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c text := upper(trim(coalesce(p_code, '')));
begin
  update public.arena_rooms
    set status = 'ended', revision = revision + 1, updated_at = now()
    where code = c and host_token = p_host_token;
  return jsonb_build_object('ok', found);
end; $$;

grant execute on function public.arena_room_create(text, text, jsonb) to anon, authenticated;
grant execute on function public.arena_room_state(text) to anon, authenticated;
grant execute on function public.arena_room_start(text, uuid, text, integer, jsonb, jsonb, integer) to anon, authenticated;
grant execute on function public.arena_room_end(text, uuid) to anon, authenticated;
