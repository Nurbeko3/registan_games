-- ════════════════════════════════════════════════════════════════════
--  KidsCode Quest — authoritative Party room state
--  Presence still carries live names/scores; match flow is now controlled by
--  RPC-validated room state so non-host clients cannot forge start/question/end.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.kcq_party_rooms (
  code          text primary key,
  host_id       text not null,
  host_token    uuid not null,
  phase         text not null default 'lobby' check (phase in ('lobby', 'question', 'reveal', 'ended')),
  order_indices integer[] not null default '{}',
  q_index       integer not null default -1,
  revision      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.kcq_party_rooms enable row level security;
revoke all on public.kcq_party_rooms from anon, authenticated;

drop policy if exists "kcq_party_public_read" on public.kcq_party_rooms;
create policy "kcq_party_public_read" on public.kcq_party_rooms
  for select using (true);
grant select on public.kcq_party_rooms to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.kcq_party_rooms;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

create or replace function public.kcq_party_create(p_code text, p_host_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare
  c text := upper(trim(coalesce(p_code, '')));
  h text := nullif(trim(coalesce(p_host_id, '')), '');
  tok uuid := gen_random_uuid();
  saved uuid;
begin
  delete from public.kcq_party_rooms where updated_at < now() - interval '2 hours';
  if c !~ '^[A-Z0-9]{3,6}$' or h is null then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;

  insert into public.kcq_party_rooms (code, host_id, host_token)
  values (c, h, tok)
  on conflict (code) do update
    set host_id = excluded.host_id,
        host_token = excluded.host_token,
        phase = 'lobby',
        order_indices = '{}',
        q_index = -1,
        revision = public.kcq_party_rooms.revision + 1,
        updated_at = now()
    where public.kcq_party_rooms.updated_at < now() - interval '2 hours'
  returning host_token into saved;

  if saved is null then
    return jsonb_build_object('ok', false, 'reason', 'exists');
  end if;
  return jsonb_build_object('ok', true, 'token', saved);
end; $$;

create or replace function public.kcq_party_state(p_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  r public.kcq_party_rooms;
begin
  select * into r from public.kcq_party_rooms where code = upper(trim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('ok', false, 'reason', 'notfound'); end if;
  return jsonb_build_object(
    'ok', true,
    'state', jsonb_build_object(
      'code', r.code,
      'host_id', r.host_id,
      'phase', r.phase,
      'order', r.order_indices,
      'q_index', r.q_index,
      'revision', r.revision
    )
  );
end; $$;

create or replace function public.kcq_party_host_state(
  p_code text,
  p_token uuid,
  p_phase text,
  p_q_index integer,
  p_order integer[] default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c text := upper(trim(coalesce(p_code, '')));
  room public.kcq_party_rooms;
  next_order integer[];
begin
  select * into room from public.kcq_party_rooms where code = c and host_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if p_phase not in ('lobby', 'question', 'reveal', 'ended') then
    return jsonb_build_object('ok', false, 'reason', 'phase');
  end if;
  if p_q_index < -1 or p_q_index > 20 then
    return jsonb_build_object('ok', false, 'reason', 'index');
  end if;

  next_order := coalesce(p_order, room.order_indices);
  if exists (select 1 from unnest(next_order) as n where n < 0 or n > 500) then
    return jsonb_build_object('ok', false, 'reason', 'order');
  end if;

  update public.kcq_party_rooms
    set phase = p_phase,
        q_index = p_q_index,
        order_indices = next_order,
        revision = revision + 1,
        updated_at = now()
    where code = c and host_token = p_token;

  return jsonb_build_object('ok', true);
end; $$;

grant execute on function public.kcq_party_create(text, text) to anon, authenticated;
grant execute on function public.kcq_party_state(text) to anon, authenticated;
grant execute on function public.kcq_party_host_state(text, uuid, text, integer, integer[]) to anon, authenticated;
