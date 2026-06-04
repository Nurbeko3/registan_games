-- KidsCode Quest — Party host refresh recovery.
-- Adds a host resume RPC and returns updated_at so the refreshed host can
-- rebuild local timers from the authoritative room row.

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
      'revision', r.revision,
      'updated_at', r.updated_at
    )
  );
end; $$;

grant execute on function public.kcq_party_host_resume(text, text, uuid) to anon, authenticated;
