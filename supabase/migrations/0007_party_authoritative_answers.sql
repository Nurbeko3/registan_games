-- KidsCode Quest — Party authoritative answers + duplicate protection.
-- Players receive a per-room token from the DB; answers are submitted through
-- RPC and scored in Postgres, so clients cannot score as another player or
-- score the same question twice after a host refresh.

alter table public.kcq_party_rooms
  add column if not exists player_tokens jsonb not null default '{}'::jsonb,
  add column if not exists scores jsonb not null default '{}'::jsonb,
  add column if not exists answered jsonb not null default '{}'::jsonb;

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
        player_tokens = '{}'::jsonb,
        scores = '{}'::jsonb,
        answered = '{}'::jsonb,
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
      'scores', r.scores,
      'revision', r.revision,
      'updated_at', r.updated_at
    )
  );
end; $$;

create or replace function public.kcq_party_host_resume(p_code text, p_host_id text, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  r public.kcq_party_rooms;
begin
  select * into r
  from public.kcq_party_rooms
  where code = upper(trim(coalesce(p_code, '')))
    and host_id = nullif(trim(coalesce(p_host_id, '')), '')
    and host_token = p_token
    and updated_at >= now() - interval '2 hours';

  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;

  return jsonb_build_object(
    'ok', true,
    'token', r.host_token,
    'state', jsonb_build_object(
      'code', r.code,
      'host_id', r.host_id,
      'phase', r.phase,
      'order', r.order_indices,
      'q_index', r.q_index,
      'scores', r.scores,
      'revision', r.revision,
      'updated_at', r.updated_at
    )
  );
end; $$;

create or replace function public.kcq_party_join(p_code text, p_player_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare
  c text := upper(trim(coalesce(p_code, '')));
  pid text := nullif(trim(coalesce(p_player_id, '')), '');
  tok text;
  r public.kcq_party_rooms;
begin
  if c !~ '^[A-Z0-9]{3,6}$' or pid is null or pid !~ '^[A-Za-z0-9_-]{2,40}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;

  select * into r from public.kcq_party_rooms where code = c for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'notfound'); end if;

  tok := r.player_tokens ->> pid;
  if tok is null then
    tok := gen_random_uuid()::text;
    update public.kcq_party_rooms
      set player_tokens = jsonb_set(player_tokens, array[pid], to_jsonb(tok), true)
      where code = c;
  end if;

  select * into r from public.kcq_party_rooms where code = c;
  return jsonb_build_object(
    'ok', true,
    'token', tok,
    'state', jsonb_build_object(
      'code', r.code,
      'host_id', r.host_id,
      'phase', r.phase,
      'order', r.order_indices,
      'q_index', r.q_index,
      'scores', r.scores,
      'revision', r.revision,
      'updated_at', r.updated_at
    )
  );
end; $$;

create or replace function public.kcq_party_answer(
  p_code text,
  p_player_id text,
  p_player_token uuid,
  p_q_index integer,
  p_option integer
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c text := upper(trim(coalesce(p_code, '')));
  pid text := nullif(trim(coalesce(p_player_id, '')), '');
  r public.kcq_party_rooms;
  answer_key text;
  old_score integer;
  award integer;
  next_scores jsonb;
begin
  if c !~ '^[A-Z0-9]{3,6}$' or pid is null or pid !~ '^[A-Za-z0-9_-]{2,40}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;

  select * into r from public.kcq_party_rooms where code = c for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'notfound'); end if;
  if r.player_tokens ->> pid is distinct from p_player_token::text then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;
  if r.phase <> 'question' or r.q_index <> p_q_index then
    return jsonb_build_object('ok', false, 'reason', 'phase');
  end if;

  answer_key := p_q_index::text || ':' || pid;
  if r.answered ? answer_key then
    return jsonb_build_object('ok', true, 'duplicate', true, 'scores', r.scores);
  end if;

  next_scores := r.scores;
  if p_option = 0 then
    old_score := coalesce((r.scores ->> pid)::integer, 0);
    award := greatest(20, 100 - floor(extract(epoch from (now() - r.updated_at)) * 1000 / 120)::integer);
    next_scores := jsonb_set(r.scores, array[pid], to_jsonb(old_score + award), true);
  end if;

  update public.kcq_party_rooms
    set answered = jsonb_set(answered, array[answer_key], 'true'::jsonb, true),
        scores = next_scores,
        revision = revision + 1
    where code = c;

  select * into r from public.kcq_party_rooms where code = c;
  return jsonb_build_object('ok', true, 'scores', r.scores);
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
        scores = case when p_phase = 'lobby' and p_q_index = -1 then '{}'::jsonb else scores end,
        answered = case when p_phase = 'lobby' and p_q_index = -1 then '{}'::jsonb else answered end,
        revision = revision + 1,
        updated_at = now()
    where code = c and host_token = p_token;

  return jsonb_build_object('ok', true);
end; $$;

grant execute on function public.kcq_party_join(text, text) to anon, authenticated;
grant execute on function public.kcq_party_answer(text, text, uuid, integer, integer) to anon, authenticated;
