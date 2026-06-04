-- ════════════════════════════════════════════════════════════════════
--  KidsCode Quest — admin accounts (teachers) + student management
--  Admin auth lives in Supabase (bcrypt). The seeded SUPER admin can add
--  other admins and students; a normal admin manages students only.
--  All admin actions are authorized by the admin's session token (no shared
--  secret). Apply:  supabase db push   (or paste in SQL editor)
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.kcq_admins (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  pass_hash     text not null,
  name          text not null default '',
  role          text not null default 'admin' check (role in ('super', 'admin')),
  session_token uuid,
  created_at    timestamptz not null default now()
);
create unique index if not exists kcq_admins_email_uniq on public.kcq_admins (lower(email));

alter table public.kcq_admins enable row level security;
revoke all on public.kcq_admins from anon, authenticated;

-- ── LOGIN ────────────────────────────────────────────────────────────
create or replace function public.kcq_admin_login(p_email text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare a public.kcq_admins; tok uuid;
begin
  select * into a from public.kcq_admins where lower(email) = lower(trim(p_email));
  if not found or a.pass_hash <> crypt(p_password, a.pass_hash) then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;
  tok := gen_random_uuid();
  update public.kcq_admins set session_token = tok where id = a.id;
  return jsonb_build_object('ok', true, 'token', tok,
    'admin', jsonb_build_object('id', a.id, 'email', a.email, 'name', a.name, 'role', a.role));
end; $$;

create or replace function public.kcq_admin_whoami(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare a public.kcq_admins;
begin
  if p_token is null then return jsonb_build_object('ok', false); end if;
  select * into a from public.kcq_admins where session_token = p_token;
  if not found then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true,
    'admin', jsonb_build_object('id', a.id, 'email', a.email, 'name', a.name, 'role', a.role));
end; $$;

create or replace function public.kcq_admin_logout(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.kcq_admins set session_token = null where session_token = p_token;
  return jsonb_build_object('ok', true);
end; $$;

-- ── BOOTSTRAP: create the very first SUPER admin (only while none exist) ──
-- Safe to expose: self-disables once any admin row exists. No secrets in the
-- repo — the caller supplies the email + password once.
create or replace function public.kcq_admin_bootstrap(p_email text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
begin
  if exists (select 1 from public.kcq_admins) then
    return jsonb_build_object('ok', false, 'reason', 'exists');
  end if;
  if position('@' in coalesce(p_email, '')) = 0 or length(coalesce(p_password, '')) < 4 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into public.kcq_admins (email, pass_hash, name, role)
  values (trim(p_email), crypt(p_password, gen_salt('bf')), 'Super Admin', 'super');
  return jsonb_build_object('ok', true);
end; $$;

-- ── STUDENT management (any admin) ───────────────────────────────────
create or replace function public.kcq_admin_create_student(
  p_token uuid, p_username text, p_password text, p_display_name text default '')
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare a public.kcq_admins; new_id uuid;
begin
  select * into a from public.kcq_admins where session_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if p_username !~ '^[A-Za-z0-9._-]{3,20}$' then
    return jsonb_build_object('ok', false, 'reason', 'username');
  end if;
  if exists (select 1 from public.kcq_users where lower(username) = lower(trim(p_username))) then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;
  insert into public.kcq_users (username, pass_hash, display_name)
  values (trim(p_username), crypt(p_password, gen_salt('bf')),
          coalesce(nullif(trim(p_display_name), ''), trim(p_username)))
  returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id, 'username', trim(p_username), 'password', p_password);
end; $$;

create or replace function public.kcq_admin_list_students(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare a public.kcq_admins;
begin
  select * into a from public.kcq_admins where session_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  return jsonb_build_object('ok', true, 'users', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'username', username, 'display_name', display_name,
      'xp', xp, 'coins', coins, 'total_stars', total_stars, 'created_at', created_at
    ) order by created_at desc) from public.kcq_users), '[]'::jsonb));
end; $$;

create or replace function public.kcq_admin_reset_student(p_token uuid, p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare a public.kcq_admins; n int;
begin
  select * into a from public.kcq_admins where session_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  update public.kcq_users
    set pass_hash = crypt(p_password, gen_salt('bf')), session_token = null, updated_at = now()
    where lower(username) = lower(trim(p_username));
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'reason', 'notfound'); end if;
  return jsonb_build_object('ok', true, 'username', trim(p_username), 'password', p_password);
end; $$;

create or replace function public.kcq_admin_delete_student(p_token uuid, p_username text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare a public.kcq_admins; n int;
begin
  select * into a from public.kcq_admins where session_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  delete from public.kcq_users where lower(username) = lower(trim(p_username));
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0);
end; $$;

-- ── ADMIN management (SUPER only) ────────────────────────────────────
create or replace function public.kcq_admin_create_admin(
  p_token uuid, p_email text, p_password text, p_name text default '', p_role text default 'admin')
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare caller public.kcq_admins; new_id uuid; role text;
begin
  select * into caller from public.kcq_admins where session_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if caller.role <> 'super' then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
  role := case when p_role = 'super' then 'super' else 'admin' end;
  if position('@' in coalesce(p_email, '')) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'email');
  end if;
  if exists (select 1 from public.kcq_admins where lower(email) = lower(trim(p_email))) then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;
  insert into public.kcq_admins (email, pass_hash, name, role)
  values (trim(p_email), crypt(p_password, gen_salt('bf')),
          coalesce(nullif(trim(p_name), ''), split_part(trim(p_email), '@', 1)), role)
  returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id,
    'email', trim(p_email), 'password', p_password, 'role', role);
end; $$;

create or replace function public.kcq_admin_list_admins(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller public.kcq_admins;
begin
  select * into caller from public.kcq_admins where session_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if caller.role <> 'super' then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
  return jsonb_build_object('ok', true, 'admins', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'email', email, 'name', name, 'role', role, 'created_at', created_at,
      'is_self', id = caller.id
    ) order by created_at) from public.kcq_admins), '[]'::jsonb));
end; $$;

create or replace function public.kcq_admin_delete_admin(p_token uuid, p_email text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller public.kcq_admins; target public.kcq_admins; supers int;
begin
  select * into caller from public.kcq_admins where session_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if caller.role <> 'super' then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
  select * into target from public.kcq_admins where lower(email) = lower(trim(p_email));
  if not found then return jsonb_build_object('ok', false, 'reason', 'notfound'); end if;
  if target.id = caller.id then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  if target.role = 'super' then
    select count(*) into supers from public.kcq_admins where role = 'super';
    if supers <= 1 then return jsonb_build_object('ok', false, 'reason', 'last-super'); end if;
  end if;
  delete from public.kcq_admins where id = target.id;
  return jsonb_build_object('ok', true);
end; $$;

-- ── grants (security is enforced inside each function via token + role) ──
grant execute on function public.kcq_admin_login(text, text) to anon, authenticated;
grant execute on function public.kcq_admin_whoami(uuid) to anon, authenticated;
grant execute on function public.kcq_admin_logout(uuid) to anon, authenticated;
grant execute on function public.kcq_admin_bootstrap(text, text) to anon, authenticated;
grant execute on function public.kcq_admin_create_student(uuid, text, text, text) to anon, authenticated;
grant execute on function public.kcq_admin_list_students(uuid) to anon, authenticated;
grant execute on function public.kcq_admin_reset_student(uuid, text, text) to anon, authenticated;
grant execute on function public.kcq_admin_delete_student(uuid, text) to anon, authenticated;
grant execute on function public.kcq_admin_create_admin(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.kcq_admin_list_admins(uuid) to anon, authenticated;
grant execute on function public.kcq_admin_delete_admin(uuid, text) to anon, authenticated;

-- ── optional SUPER admin bootstrap ───────────────────────────────────
-- Never keep real admin credentials in a migration. To bootstrap a fresh DB,
-- set these DB GUCs for the migration session, or create the first admin with
-- an equivalent one-off SQL command in a private Supabase SQL editor session:
--
--   set app.kcq_bootstrap_admin_email = 'admin@example.com';
--   set app.kcq_bootstrap_admin_password = 'replace-with-a-private-password';
--
do $$
declare
  boot_email text := nullif(current_setting('app.kcq_bootstrap_admin_email', true), '');
  boot_password text := nullif(current_setting('app.kcq_bootstrap_admin_password', true), '');
begin
  if boot_email is not null and boot_password is not null then
    insert into public.kcq_admins (email, pass_hash, name, role)
    values (boot_email, extensions.crypt(boot_password, extensions.gen_salt('bf')), 'Super Admin', 'super')
    on conflict do nothing;
  end if;
end $$;
