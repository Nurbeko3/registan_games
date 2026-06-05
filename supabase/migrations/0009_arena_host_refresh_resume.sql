-- KidsCode Quest — preserve active Arena room state when the same host refreshes.

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
        settings = case
          when public.arena_rooms.host_client_id = h and public.arena_rooms.updated_at >= now() - interval '2 hours'
            then public.arena_rooms.settings
          else excluded.settings
        end,
        status = case
          when public.arena_rooms.host_client_id = h and public.arena_rooms.updated_at >= now() - interval '2 hours'
            then public.arena_rooms.status
          else 'lobby'
        end,
        match_id = case
          when public.arena_rooms.host_client_id = h and public.arena_rooms.updated_at >= now() - interval '2 hours'
            then public.arena_rooms.match_id
          else null
        end,
        seed = case
          when public.arena_rooms.host_client_id = h and public.arena_rooms.updated_at >= now() - interval '2 hours'
            then public.arena_rooms.seed
          else null
        end,
        roster = case
          when public.arena_rooms.host_client_id = h and public.arena_rooms.updated_at >= now() - interval '2 hours'
            then public.arena_rooms.roster
          else '[]'::jsonb
        end,
        started_at = case
          when public.arena_rooms.host_client_id = h and public.arena_rooms.updated_at >= now() - interval '2 hours'
            then public.arena_rooms.started_at
          else null
        end,
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

grant execute on function public.arena_room_create(text, text, jsonb) to anon, authenticated;
