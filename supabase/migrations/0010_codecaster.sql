-- ════════════════════════════════════════════════════════════════════
--  KidsCode Quest — Codecaster (Python Dungeon) cloud persistence
--  Migration 0010 — additive, never blocks offline-first gameplay.
--
--  Tables:
--    kcq_codecaster_progress  — best result per (user, level), monotonic
--    kcq_codecaster_solves    — append-only audit; validated=false until an
--                               edge function re-runs the engine (see §7 note)
--
--  RPCs (SECURITY DEFINER, anon-key callable, session-token auth):
--    kcq_cc_progress(p_token)                          → read my rows
--    kcq_cc_submit(p_token, p_level, p_stars, ...)     → upsert + audit
--    kcq_cc_leaderboard()                              → public ranking view
--
--  MVP trust limitation (IMPORTANT — read before enabling the leaderboard):
--    The submit RPC trusts the client's reported stars / concept_ok / steps.
--    It stores code_hash + command_count + validated=false so a later Edge
--    Function (supabase/functions/cc-validate/) can re-run the pure engine.ts
--    over the submitted command trace against the canonical LevelDef and flip
--    validated=true only on a confirmed win.  Until that edge function is
--    deployed, the competitive leaderboard MUST stay private (teacher-view
--    only) — exposing it publicly would let any student forge top scores.
--    See docs/codecaster-design.md §7 for the full security model.
--
--  Rollback (if you need to revert this migration):
--    drop view  if exists public.kcq_codecaster_leaderboard;
--    drop function if exists public.kcq_cc_progress(uuid);
--    drop function if exists public.kcq_cc_submit(uuid,text,smallint,integer,boolean,smallint,text,integer);
--    drop function if exists public.kcq_cc_leaderboard();
--    drop table if exists public.kcq_codecaster_solves;
--    drop table if exists public.kcq_codecaster_progress;
--    -- (kcq_users is owned by 0003 — do NOT drop it here)
-- ════════════════════════════════════════════════════════════════════

-- pgcrypto already enabled by 0003 — guard with `if not exists` just in case.
create extension if not exists pgcrypto with schema extensions;

-- ── Per-student best result per level ────────────────────────────────
-- Only the BEST result is kept (monotonic: stars never decrease).
-- completed_at is null until the student wins at least once.
create table if not exists public.kcq_codecaster_progress (
  user_id      uuid        not null references public.kcq_users(id) on delete cascade,
  level_id     text        not null check (level_id ~ '^L[0-9]{2}$'), -- 'L01'..'L30'
  best_stars   smallint    not null default 0 check (best_stars between 0 and 3),
  best_steps   integer,                        -- lowest step count at max stars
  concept_ok   boolean     not null default false, -- used the target Python concept
  hints_used   smallint    not null default 0 check (hints_used >= 0),
  completed_at timestamptz,                    -- first win timestamp
  updated_at   timestamptz not null default now(),
  primary key (user_id, level_id)
);

-- Index: the leaderboard view aggregates over user_id; token auth looks up
-- user_id first (covered by PK). Extra index for the teacher dashboard query
-- that may filter by level_id across many students.
create index if not exists kcq_cc_progress_level_idx
  on public.kcq_codecaster_progress (level_id, best_stars);

-- Lock: clients never write this table directly — only kcq_cc_submit() does.
alter table public.kcq_codecaster_progress enable row level security;
revoke all on public.kcq_codecaster_progress from anon, authenticated;

-- ── Append-only audit of every submitted solve ───────────────────────
-- validated=false at insert; a future Edge Function flips it to true after
-- re-running engine.ts over command_count commands from the code_hash trace.
-- This design means the submit RPC is non-blocking (no edge-function call on
-- the hot path) while still providing a forensic trail for anti-cheat review.
create table if not exists public.kcq_codecaster_solves (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references public.kcq_users(id) on delete cascade,
  level_id      text        not null check (level_id ~ '^L[0-9]{2}$'),
  stars         smallint    not null check (stars between 0 and 3),
  -- code_hash: deterministic hash of the submitted source (see cloud.ts hashCode).
  -- NOT cryptographic in the MVP client; replace with sha256 in the edge function.
  code_hash     text        not null,
  command_count integer     not null check (command_count >= 0),
  -- validated: false = client-submitted (untrusted MVP);
  --            true  = edge function confirmed engine replay = win.
  validated     boolean     not null default false,
  created_at    timestamptz not null default now()
);

-- Index for the teacher dashboard and edge-function validation queue
-- (find all unvalidated solves for a given level, oldest first).
create index if not exists kcq_cc_solves_pending_idx
  on public.kcq_codecaster_solves (level_id, validated, created_at)
  where validated = false;

-- Index for per-user solve history (analytics / teacher drill-down).
create index if not exists kcq_cc_solves_user_idx
  on public.kcq_codecaster_solves (user_id, created_at desc);

-- Lock: append-only via kcq_cc_submit(); no client direct writes.
alter table public.kcq_codecaster_solves enable row level security;
revoke all on public.kcq_codecaster_solves from anon, authenticated;

-- ── Leaderboard view ─────────────────────────────────────────────────
-- Rank by 3-star count (concept mastery) then boss clears (L10/L20/L30).
-- NOT by raw XP — this reduces grinding incentive and is harder to fake
-- without genuine solves (see §7 of design doc).
-- Joining kcq_users to expose display_name; username is intentionally
-- excluded (classrooms may share devices — prefer display_name).
drop view if exists public.kcq_codecaster_leaderboard;
create view public.kcq_codecaster_leaderboard as
  select
    p.user_id,
    u.display_name,
    count(*)        filter (where p.best_stars = 3)                                as three_stars,
    count(*)        filter (where p.level_id in ('L10','L20','L30')
                                  and p.best_stars > 0)                            as bosses,
    max(p.updated_at)                                                              as last_active
  from public.kcq_codecaster_progress p
  join public.kcq_users u on u.id = p.user_id
  where p.best_stars > 0                  -- only students with at least one win
  group by p.user_id, u.display_name
  order by three_stars desc, bosses desc, last_active desc
  limit 100;

-- The view inherits SECURITY DEFINER semantics from the function that reads it.
-- Direct grant is safe because it exposes only display_name (no email/password).
grant select on public.kcq_codecaster_leaderboard to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────
-- RPC: kcq_cc_progress
-- Returns all progress rows for the authenticated student.
-- Auth: session token from kcq_users.session_token (same pattern as kcq_save).
-- ────────────────────────────────────────────────────────────────────
create or replace function public.kcq_cc_progress(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  -- Resolve session token → user_id (same gate as kcq_save / kcq_session).
  select id into v_user_id
    from public.kcq_users
    where session_token = p_token;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;

  -- Return all rows for this user as an array of objects.
  -- The client converts this to Record<levelId, {stars:number}> (see cloud.ts).
  return jsonb_build_object(
    'ok', true,
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'level_id',    level_id,
        'best_stars',  best_stars,
        'best_steps',  best_steps,
        'concept_ok',  concept_ok,
        'hints_used',  hints_used,
        'completed_at', completed_at
      )), '[]'::jsonb)
      from public.kcq_codecaster_progress
      where user_id = v_user_id
    )
  );
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- RPC: kcq_cc_submit
-- Validates session token → upserts progress (monotonic: never downgrade stars)
-- → appends a solves audit row (validated=false).
-- Returns the stored (possibly updated) progress row for the level.
--
-- MVP trust: stars / concept_ok / hints_used are trusted from the client.
-- The code_hash + command_count stored here are the hook for the future edge
-- function that will set validated=true after server-side engine replay.
-- ────────────────────────────────────────────────────────────────────
create or replace function public.kcq_cc_submit(
  p_token         uuid,
  p_level         text,      -- 'L01'..'L30'
  p_stars         smallint,  -- 0..3
  p_steps         integer,   -- hero action count for this run
  p_concept_ok    boolean,   -- static-check: used the target Python concept?
  p_hints         smallint,  -- hints consumed this run
  p_code_hash     text,      -- deterministic hash of submitted source (cloud.ts hashCode)
  p_command_count integer    -- command queue length (for edge-fn replay budget)
)
returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id      uuid;
  v_level        text    := upper(trim(coalesce(p_level, '')));
  v_stars        smallint := coalesce(p_stars, 0);
  v_steps        integer  := coalesce(p_steps, 0);
  v_concept_ok   boolean  := coalesce(p_concept_ok, false);
  v_hints        smallint := coalesce(p_hints, 0);
  v_code_hash    text    := coalesce(nullif(trim(p_code_hash), ''), 'empty');
  v_cmd_count    integer  := greatest(coalesce(p_command_count, 0), 0);
  v_existing     public.kcq_codecaster_progress%rowtype;
  v_new_stars    smallint;
  v_new_steps    integer;
  v_new_concept  boolean;
  v_new_hints    smallint;
  v_first_win    timestamptz;
begin
  -- ── 1. Authenticate ──────────────────────────────────────────────
  select id into v_user_id
    from public.kcq_users
    where session_token = p_token;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;

  -- ── 2. Validate inputs ───────────────────────────────────────────
  if v_level !~ '^L[0-9]{2}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_level');
  end if;
  if v_stars < 0 or v_stars > 3 then
    return jsonb_build_object('ok', false, 'reason', 'bad_stars');
  end if;
  if v_hints < 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_hints');
  end if;

  -- ── 3. Load existing best (if any) ───────────────────────────────
  select * into v_existing
    from public.kcq_codecaster_progress
    where user_id = v_user_id and level_id = v_level;

  -- ── 4. Compute monotonic best values ─────────────────────────────
  -- Stars never decrease.
  v_new_stars := greatest(coalesce(v_existing.best_stars, 0), v_stars);

  -- best_steps: lower is better; only update when the new run matches or
  -- exceeds the best star count (don't replace a 3-star step count with
  -- a 1-star run's step count even if numerically lower).
  if v_existing is null or v_stars >= coalesce(v_existing.best_stars, 0) then
    v_new_steps := case
      when v_existing is null then v_steps
      when v_stars > coalesce(v_existing.best_stars, 0) then v_steps
      else least(coalesce(v_existing.best_steps, v_steps), v_steps)
    end;
  else
    v_new_steps := v_existing.best_steps;
  end if;

  -- concept_ok is sticky: once true, stays true.
  v_new_concept := coalesce(v_existing.concept_ok, false) or v_concept_ok;

  -- hints_used: keep the minimum (best solve used fewer hints).
  v_new_hints := least(
    coalesce(v_existing.hints_used, v_hints),
    v_hints
  );

  -- completed_at: set on first win (stars > 0), never reset.
  v_first_win := case
    when coalesce(v_existing.completed_at, null) is not null then v_existing.completed_at
    when v_stars > 0 then now()
    else null
  end;

  -- ── 5. Upsert progress (monotonic) ───────────────────────────────
  insert into public.kcq_codecaster_progress
    (user_id, level_id, best_stars, best_steps, concept_ok, hints_used, completed_at, updated_at)
  values
    (v_user_id, v_level, v_new_stars, v_new_steps, v_new_concept, v_new_hints, v_first_win, now())
  on conflict (user_id, level_id) do update set
    best_stars   = excluded.best_stars,
    best_steps   = excluded.best_steps,
    concept_ok   = excluded.concept_ok,
    hints_used   = excluded.hints_used,
    completed_at = excluded.completed_at,
    updated_at   = now();

  -- ── 6. Append audit row (validated=false — edge fn sets it later) ─
  insert into public.kcq_codecaster_solves
    (user_id, level_id, stars, code_hash, command_count, validated, created_at)
  values
    (v_user_id, v_level, v_stars, v_code_hash, v_cmd_count, false, now());

  -- ── 7. Return the stored row ─────────────────────────────────────
  return jsonb_build_object(
    'ok', true,
    'row', jsonb_build_object(
      'level_id',    v_level,
      'best_stars',  v_new_stars,
      'best_steps',  v_new_steps,
      'concept_ok',  v_new_concept,
      'hints_used',  v_new_hints,
      'completed_at', v_first_win
    )
  );
end; $$;

-- ────────────────────────────────────────────────────────────────────
-- RPC: kcq_cc_leaderboard
-- Public read — no auth required; returns the top-100 view rows.
-- Intentionally exposed to anon because it's a classroom motivator.
-- MVP note: until validated=true rows are gated here, this shows
-- client-reported scores. Add `where exists (validated solves)` predicate
-- once the edge function is live (see §7 of design doc).
-- ────────────────────────────────────────────────────────────────────
create or replace function public.kcq_cc_leaderboard()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  return jsonb_build_object(
    'ok', true,
    'rows', (
      select coalesce(jsonb_agg(row_to_json(lb.*)), '[]'::jsonb)
      from public.kcq_codecaster_leaderboard lb
    )
  );
end; $$;

-- ── Grant execute to anon + authenticated (anon-key pattern) ─────────
grant execute on function public.kcq_cc_progress(uuid)
  to anon, authenticated;

grant execute on function public.kcq_cc_submit(uuid,text,smallint,integer,boolean,smallint,text,integer)
  to anon, authenticated;

grant execute on function public.kcq_cc_leaderboard()
  to anon, authenticated;

-- Tables remain fully locked (no direct client access).
-- The SECURITY DEFINER functions bypass RLS as the Postgres owner.
