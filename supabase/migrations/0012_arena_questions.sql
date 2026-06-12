-- ════════════════════════════════════════════════════════════════════
--  KidsCode Quest — BATTLE LEARN ARENA question bank (admin-managed)
--  Migration 0012 — additive, strictly offline-first-safe.
--
--  Teachers import arena questions from an Excel template (trilingual:
--  uz/ru/en) in the admin panel. Imported questions are stored here and
--  merged into the live arena pool on top of the static bank. With no
--  Supabase env the table is dead and the arena runs on the static bank
--  alone — nothing here is on a core game path.
--
--  Table:
--    kcq_arena_questions  — one row per question, trilingual text + grade
--
--  RPCs (SECURITY DEFINER, anon-key callable):
--    kcq_arena_questions_list()                      → PUBLIC: active rows for the game
--    kcq_admin_arena_q_list(p_token)                 → admin: all rows (incl. inactive)
--    kcq_admin_arena_q_import(p_token, p_rows jsonb) → admin: bulk upsert from Excel
--    kcq_admin_arena_q_delete(p_token, p_id)         → admin: delete one
--    kcq_admin_arena_q_clear(p_token)                → admin: delete all
--
--  Admin auth mirrors migration 0004: every admin RPC takes the session
--  token and resolves it against kcq_admins.session_token.
--
--  Rollback:
--    drop function if exists public.kcq_admin_arena_q_clear(uuid);
--    drop function if exists public.kcq_admin_arena_q_delete(uuid,text);
--    drop function if exists public.kcq_admin_arena_q_import(uuid,jsonb);
--    drop function if exists public.kcq_admin_arena_q_list(uuid);
--    drop function if exists public.kcq_arena_questions_list();
--    drop table if exists public.kcq_arena_questions;
-- ════════════════════════════════════════════════════════════════════

-- ── Question bank ────────────────────────────────────────────────────
-- Text fields carry all three locales. options_* are jsonb string arrays
-- (same length/order across locales). answer is the correct option index
-- (mcq/code-fill); bool_answer is for truefalse. grade is the Uzbek class.
create table if not exists public.kcq_arena_questions (
  id          text        primary key,
  type        text        not null default 'mcq'
                            check (type in ('mcq','truefalse','code-fill','debug','order','binary')),
  category    text        not null default 'hardware',
  difficulty  text        not null default 'easy'
                            check (difficulty in ('easy','medium','hard')),
  grade       smallint    not null check (grade between 1 and 11),
  emoji       text        not null default '❓',
  prompt_uz   text        not null default '',
  prompt_ru   text        not null default '',
  prompt_en   text        not null default '',
  options_uz  jsonb,
  options_ru  jsonb,
  options_en  jsonb,
  explain_uz  text        not null default '',
  explain_ru  text        not null default '',
  explain_en  text        not null default '',
  answer      smallint,
  bool_answer boolean,
  active      boolean     not null default true,
  created_by  uuid        references public.kcq_admins(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists kcq_arena_q_grade_idx
  on public.kcq_arena_questions (grade, difficulty);

-- Clients never touch this table directly — only the RPCs below.
alter table public.kcq_arena_questions enable row level security;
revoke all on public.kcq_arena_questions from anon, authenticated;

-- ── PUBLIC: the game reads active questions (no auth needed) ──────────
create or replace function public.kcq_arena_questions_list()
returns jsonb language sql security definer set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(to_jsonb(q) order by q.grade, q.id) filter (where q.active),
    '[]'::jsonb
  )
  from public.kcq_arena_questions q;
$$;

-- ── admin: list all rows (incl. inactive) for the management table ────
create or replace function public.kcq_admin_arena_q_list(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare a public.kcq_admins; rows jsonb;
begin
  if p_token is null then return jsonb_build_object('ok', false); end if;
  select * into a from public.kcq_admins where session_token = p_token;
  if not found then return jsonb_build_object('ok', false); end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.grade, q.id), '[]'::jsonb)
    into rows from public.kcq_arena_questions q;
  return jsonb_build_object('ok', true, 'questions', rows);
end;
$$;

-- ── admin: bulk upsert from the parsed Excel (one jsonb array) ────────
-- Each element: { id, type, category, difficulty, grade, emoji,
--   prompt_uz/ru/en, options_uz/ru/en (array|null), explain_uz/ru/en,
--   answer (int|null), bool_answer (bool|null) }
create or replace function public.kcq_admin_arena_q_import(p_token uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare a public.kcq_admins; r jsonb; n int := 0;
begin
  if p_token is null then return jsonb_build_object('ok', false); end if;
  select * into a from public.kcq_admins where session_token = p_token;
  if not found then return jsonb_build_object('ok', false); end if;
  if jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'rows must be an array');
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.kcq_arena_questions (
      id, type, category, difficulty, grade, emoji,
      prompt_uz, prompt_ru, prompt_en,
      options_uz, options_ru, options_en,
      explain_uz, explain_ru, explain_en,
      answer, bool_answer, created_by, updated_at
    ) values (
      r->>'id',
      coalesce(r->>'type', 'mcq'),
      coalesce(r->>'category', 'hardware'),
      coalesce(r->>'difficulty', 'easy'),
      (r->>'grade')::smallint,
      coalesce(r->>'emoji', '❓'),
      coalesce(r->>'prompt_uz', ''),
      coalesce(r->>'prompt_ru', ''),
      coalesce(r->>'prompt_en', ''),
      case when r ? 'options_uz' and jsonb_typeof(r->'options_uz') = 'array' then r->'options_uz' end,
      case when r ? 'options_ru' and jsonb_typeof(r->'options_ru') = 'array' then r->'options_ru' end,
      case when r ? 'options_en' and jsonb_typeof(r->'options_en') = 'array' then r->'options_en' end,
      coalesce(r->>'explain_uz', ''),
      coalesce(r->>'explain_ru', ''),
      coalesce(r->>'explain_en', ''),
      case when r ? 'answer' and r->>'answer' is not null then (r->>'answer')::smallint end,
      case when r ? 'bool_answer' and r->>'bool_answer' is not null then (r->>'bool_answer')::boolean end,
      a.id, now()
    )
    on conflict (id) do update set
      type = excluded.type, category = excluded.category,
      difficulty = excluded.difficulty, grade = excluded.grade, emoji = excluded.emoji,
      prompt_uz = excluded.prompt_uz, prompt_ru = excluded.prompt_ru, prompt_en = excluded.prompt_en,
      options_uz = excluded.options_uz, options_ru = excluded.options_ru, options_en = excluded.options_en,
      explain_uz = excluded.explain_uz, explain_ru = excluded.explain_ru, explain_en = excluded.explain_en,
      answer = excluded.answer, bool_answer = excluded.bool_answer,
      active = true, updated_at = now();
    n := n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'count', n);
end;
$$;

-- ── admin: delete one ────────────────────────────────────────────────
create or replace function public.kcq_admin_arena_q_delete(p_token uuid, p_id text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare a public.kcq_admins;
begin
  if p_token is null then return jsonb_build_object('ok', false); end if;
  select * into a from public.kcq_admins where session_token = p_token;
  if not found then return jsonb_build_object('ok', false); end if;
  delete from public.kcq_arena_questions where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── admin: clear all ─────────────────────────────────────────────────
create or replace function public.kcq_admin_arena_q_clear(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare a public.kcq_admins;
begin
  if p_token is null then return jsonb_build_object('ok', false); end if;
  select * into a from public.kcq_admins where session_token = p_token;
  if not found then return jsonb_build_object('ok', false); end if;
  delete from public.kcq_arena_questions;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── Grants (anon-key pattern: SECURITY DEFINER + token auth in body) ──
grant execute on function public.kcq_arena_questions_list() to anon, authenticated;
grant execute on function public.kcq_admin_arena_q_list(uuid) to anon, authenticated;
grant execute on function public.kcq_admin_arena_q_import(uuid, jsonb) to anon, authenticated;
grant execute on function public.kcq_admin_arena_q_delete(uuid, text) to anon, authenticated;
grant execute on function public.kcq_admin_arena_q_clear(uuid) to anon, authenticated;
