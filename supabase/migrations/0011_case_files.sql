-- ════════════════════════════════════════════════════════════════════
--  KidsCode Quest — Case Files (reading-detective mode)
--

--  Authoritative, server-scored multiplayer quiz where every question is
--  answered by reading fictional source documents. Clones the Party authoritative
--  model (migrations 0005–0007) + the Codecaster cloud-progress pattern (0010),
--  with the Lead-locked changes from docs/find-info-about-me/00-BRIEF.md §8–10:
--
--   • RELATIONAL per-player state (kcq_case_players), NOT JSONB-per-player —
--     so a Classroom Tournament scales to 35 students (QA CRITICAL-02).
--   • Player tokens live in a SEPARATE locked table so the public scoreboard +
--     Realtime stream never leak them.
--   • Answer keys live server-only in kcq_case_answers (revoke-all); the client
--     never sees a correct-answer index (QA: answer-peeking).
--   • Speed bonus computed from the server clock (q_opened_at), capped +5 XP.
--   • Stars recomputed server-side at match end from stored responses (QA: star
--     self-reporting). kcq_case_save_progress DERIVES caseXp from stars and checks
--     the case exists — it never trusts a client-supplied XP (QA CRITICAL-01/03).
--
--  ── ROLLBACK ──
--  drop function if exists public.kcq_case_leaderboard();
--  drop function if exists public.kcq_case_save_progress(uuid,text,smallint);
--  drop function if exists public.kcq_case_teacher_results(text,uuid);
--  drop function if exists public.kcq_case_host_resume(text,text,uuid);
--  drop function if exists public.kcq_case_end_match(text,uuid);
--  drop function if exists public.kcq_case_advance_reveal(text,uuid);
--  drop function if exists public.kcq_case_open_hint(text,text,uuid,integer);
--  drop function if exists public.kcq_case_answer(text,text,uuid,integer,integer);
--  drop function if exists public.kcq_case_advance_question(text,uuid);
--  drop function if exists public.kcq_case_start_investigation(text,uuid);
--  drop function if exists public.kcq_case_state(text);
--  drop function if exists public.kcq_case_join(text,text,text);
--  drop function if exists public.kcq_case_create(text,text,text,boolean);
--  drop function if exists public.kcq_case_room_payload(public.kcq_case_rooms);
--  drop function if exists public.kcq_case_solve_xp(smallint);
--  drop view  if exists public.kcq_case_leaderboard;
--  drop table if exists public.kcq_case_responses;
--  drop table if exists public.kcq_case_player_tokens;
--  drop table if exists public.kcq_case_players;
--  drop table if exists public.kcq_case_progress;
--  drop table if exists public.kcq_case_answers;
--  drop table if exists public.kcq_case_rooms;
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ════════════════════════════════════════════════════════════════════
--  1. TABLES
-- ════════════════════════════════════════════════════════════════════

-- ── 1a. Server-only answer keys ─────────────────────────────────────
-- Seeded from src/data/cases/*. NEVER readable by a client; only SECURITY
-- DEFINER RPCs (running as owner) touch it.
create table if not exists public.kcq_case_answers (
  case_id         text    not null,
  question_index  integer not null,            -- 0-based index into Case.questions[]
  answer_index    integer not null,            -- correct choice index (0-based)
  is_cross_ref    boolean not null default false, -- cross-reference question? (2★ gate)
  primary key (case_id, question_index)
);
alter table public.kcq_case_answers enable row level security;
revoke all on public.kcq_case_answers from anon, authenticated;

-- ── 1b. Rooms (authoritative match state) ───────────────────────────
create table if not exists public.kcq_case_rooms (
  code         text        primary key,
  host_id      text        not null,
  host_token   uuid        not null,
  case_id      text        not null,
  q_set        integer[]   not null default '{}',  -- ordered question_index values
  phase        text        not null default 'lobby'
               check (phase in ('lobby','investigation','question','reveal','ended')),
  q_index      integer     not null default -1,    -- -1 = pre-questions; else position in q_set
  q_opened_at  timestamptz,                         -- server clock; never sent to clients
  is_classroom boolean     not null default false,
  max_players  integer     not null default 8,      -- 8 friendly · 35 classroom
  revision     integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists kcq_case_rooms_host_idx on public.kcq_case_rooms (host_id, updated_at);
create index if not exists kcq_case_rooms_updated_idx on public.kcq_case_rooms (updated_at);

alter table public.kcq_case_rooms enable row level security;
revoke all on public.kcq_case_rooms from anon, authenticated;
drop policy if exists "kcq_case_room_public_read" on public.kcq_case_rooms;
create policy "kcq_case_room_public_read" on public.kcq_case_rooms for select using (true);
grant select on public.kcq_case_rooms to anon, authenticated;

-- ── 1c. Players (relational — scales to 35; NO token here) ──────────
-- Public-read + Realtime so every client renders the live roster/scoreboard.
-- The secret token is deliberately NOT in this table (see 1d).
create table if not exists public.kcq_case_players (
  room_code    text        not null references public.kcq_case_rooms(code) on delete cascade,
  player_id    text        not null,
  display_name text        not null,
  score        integer     not null default 0,
  streak       integer     not null default 0,     -- consecutive correct (in-match)
  is_host      boolean     not null default false,
  joined_at    timestamptz not null default now(),
  primary key (room_code, player_id)
);
create index if not exists kcq_case_players_room_idx on public.kcq_case_players (room_code);

alter table public.kcq_case_players enable row level security;
revoke all on public.kcq_case_players from anon, authenticated;
drop policy if exists "kcq_case_players_public_read" on public.kcq_case_players;
create policy "kcq_case_players_public_read" on public.kcq_case_players for select using (true);
grant select on public.kcq_case_players to anon, authenticated;

-- ── 1d. Player tokens (LOCKED — never public, never in Realtime) ────
create table if not exists public.kcq_case_player_tokens (
  room_code    text not null references public.kcq_case_rooms(code) on delete cascade,
  player_id    text not null,
  player_token uuid not null,
  primary key (room_code, player_id)
);
alter table public.kcq_case_player_tokens enable row level security;
revoke all on public.kcq_case_player_tokens from anon, authenticated;

-- ── 1e. Responses (per player per question — idempotency + scoring + hints) ──
-- LOCKED: a player's own result returns from the answer RPC; teachers read via
-- kcq_case_teacher_results. No client reads this table directly.
create table if not exists public.kcq_case_responses (
  room_code   text        not null references public.kcq_case_rooms(code) on delete cascade,
  player_id   text        not null,
  q_index     integer     not null,           -- position in q_set
  option      integer,                         -- chosen choice; null if only a hint was opened
  correct     boolean     not null default false,
  xp          integer     not null default 0,
  hint_used   boolean     not null default false,
  answered_at timestamptz,                     -- null until an answer is submitted
  primary key (room_code, player_id, q_index)
);
alter table public.kcq_case_responses enable row level security;
revoke all on public.kcq_case_responses from anon, authenticated;

-- ── 1f. Cloud progress (per-student best result; Codecaster 0010 pattern) ──
create table if not exists public.kcq_case_progress (
  user_id        uuid        not null references public.kcq_users(id) on delete cascade,
  case_id        text        not null,
  best_stars     smallint    not null default 0 check (best_stars between 0 and 3),
  case_xp_earned integer     not null default 0,  -- SERVER-DERIVED from best_stars
  no_hint_solve  boolean     not null default false,
  completed_at   timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (user_id, case_id)
);
create index if not exists kcq_case_progress_user_idx on public.kcq_case_progress (user_id, updated_at desc);
alter table public.kcq_case_progress enable row level security;
revoke all on public.kcq_case_progress from anon, authenticated;

-- ── 1g. Realtime publication (rooms + players only; secrets excluded) ──
do $$
begin
  alter publication supabase_realtime add table public.kcq_case_rooms;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.kcq_case_players;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- ── 1h. Leaderboard view (sums server-derived case XP) ──────────────
drop view if exists public.kcq_case_leaderboard;
create view public.kcq_case_leaderboard as
  select
    p.user_id,
    u.display_name,
    sum(p.case_xp_earned)                          as total_case_xp,
    count(*) filter (where p.best_stars >= 1)      as cases_solved,
    count(*) filter (where p.best_stars = 3)       as cases_3star,
    count(*) filter (where p.no_hint_solve)        as no_hint_solves,
    max(p.updated_at)                              as last_active
  from public.kcq_case_progress p
  join public.kcq_users u on u.id = p.user_id
  where p.best_stars >= 1
  group by p.user_id, u.display_name
  order by total_case_xp desc, cases_3star desc, last_active desc
  limit 100;
grant select on public.kcq_case_leaderboard to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
--  2. SCALAR HELPERS
-- ════════════════════════════════════════════════════════════════════

-- Locked solve-XP table (00-BRIEF §8): 1★ 40 · 2★ 80 · 3★ 120.
create or replace function public.kcq_case_solve_xp(p_stars smallint)
returns integer language sql immutable as $$
  select case p_stars when 3 then 120 when 2 then 80 when 1 then 40 else 0 end;
$$;

-- Public room payload — joins the live roster but NEVER exposes q_opened_at,
-- answer keys, or player tokens.
create or replace function public.kcq_case_room_payload(r public.kcq_case_rooms)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'code',         r.code,
    'host_id',      r.host_id,
    'case_id',      r.case_id,
    'q_set',        r.q_set,
    'phase',        r.phase,
    'q_index',      r.q_index,
    'is_classroom', r.is_classroom,
    'max_players',  r.max_players,
    'revision',     r.revision,
    'updated_at',   r.updated_at,
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'player_id',    p.player_id,
        'display_name', p.display_name,
        'score',        p.score,
        'streak',       p.streak,
        'is_host',      p.is_host
      ) order by p.score desc, p.joined_at), '[]'::jsonb)
      from public.kcq_case_players p where p.room_code = r.code
    )
  );
$$;

-- ════════════════════════════════════════════════════════════════════
--  3. RPCs  (all SECURITY DEFINER, fixed search_path)
-- ════════════════════════════════════════════════════════════════════

-- ── 3.1 create room (host/teacher) ──────────────────────────────────
create or replace function public.kcq_case_create(
  p_code text, p_host_id text, p_case_id text, p_is_classroom boolean default false
)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  c   text := upper(trim(coalesce(p_code, '')));
  h   text := nullif(trim(coalesce(p_host_id, '')), '');
  cid text := nullif(trim(coalesce(p_case_id, '')), '');
  cls boolean := coalesce(p_is_classroom, false);
  tok uuid := gen_random_uuid();
  saved uuid;
begin
  -- stale-room TTL: 4h normal, 8h classroom (cascades to children)
  delete from public.kcq_case_rooms
    where (is_classroom = false and updated_at < now() - interval '4 hours')
       or (is_classroom = true  and updated_at < now() - interval '8 hours');

  if c !~ '^[A-Z0-9]{4,6}$' or h is null or cid is null then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;

  -- case must exist server-side (QA CRITICAL-03: reject fabricated case ids)
  if not exists (select 1 from public.kcq_case_answers where case_id = cid limit 1) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_case');
  end if;

  insert into public.kcq_case_rooms (code, host_id, host_token, case_id, q_set, is_classroom, max_players)
  values (
    c, h, tok, cid,
    array(select question_index from public.kcq_case_answers where case_id = cid order by question_index),
    cls,
    case when cls then 35 else 8 end
  )
  on conflict (code) do nothing
  returning host_token into saved;

  if saved is null then
    return jsonb_build_object('ok', false, 'reason', 'exists');
  end if;
  return jsonb_build_object('ok', true, 'token', saved);
end; $$;

-- ── 3.2 join (player) — issues a token, enforces capacity + unique name ──
create or replace function public.kcq_case_join(
  p_code text, p_player_id text, p_display_name text
)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  c     text := upper(trim(coalesce(p_code, '')));
  pid   text := nullif(trim(coalesce(p_player_id, '')), '');
  pname text := substring(trim(coalesce(nullif(trim(p_display_name), ''), 'Player')), 1, 30);
  r     public.kcq_case_rooms;
  tok   uuid;
  n     integer;
  exists_player boolean;
  candidate text;
  suffix int := 1;
begin
  if c !~ '^[A-Z0-9]{4,6}$' or pid is null or pid !~ '^[A-Za-z0-9_-]{2,40}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;

  select * into r from public.kcq_case_rooms where code = c for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'notfound'); end if;

  select true into exists_player from public.kcq_case_players where room_code = c and player_id = pid;

  -- Reconnect is always allowed; a NEW player may only join before questions start.
  if exists_player is not true and r.phase not in ('lobby', 'investigation') then
    return jsonb_build_object('ok', false, 'reason', 'started');
  end if;

  if exists_player is not true then
    select count(*) into n from public.kcq_case_players where room_code = c;
    if n >= r.max_players then
      return jsonb_build_object('ok', false, 'reason', 'full');
    end if;

    -- unique display name within the room (suffix duplicates: "Ali (2)")
    candidate := pname;
    while exists (select 1 from public.kcq_case_players where room_code = c and display_name = candidate) loop
      suffix := suffix + 1;
      candidate := substring(pname, 1, 26) || ' (' || suffix || ')';
    end loop;

    tok := gen_random_uuid();
    insert into public.kcq_case_players (room_code, player_id, display_name, is_host)
      values (c, pid, candidate, (pid = r.host_id));
    insert into public.kcq_case_player_tokens (room_code, player_id, player_token)
      values (c, pid, tok);
    update public.kcq_case_rooms set revision = revision + 1, updated_at = now() where code = c;
  else
    select player_token into tok from public.kcq_case_player_tokens where room_code = c and player_id = pid;
  end if;

  select * into r from public.kcq_case_rooms where code = c;
  return jsonb_build_object('ok', true, 'token', tok, 'state', public.kcq_case_room_payload(r));
end; $$;

-- ── 3.3 public state read ───────────────────────────────────────────
create or replace function public.kcq_case_state(p_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.kcq_case_rooms;
begin
  select * into r from public.kcq_case_rooms where code = upper(trim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('ok', false, 'reason', 'notfound'); end if;
  return jsonb_build_object('ok', true, 'state', public.kcq_case_room_payload(r));
end; $$;

-- ── 3.4 start investigation (host) ──────────────────────────────────
create or replace function public.kcq_case_start_investigation(p_code text, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare c text := upper(trim(coalesce(p_code, ''))); r public.kcq_case_rooms;
begin
  select * into r from public.kcq_case_rooms where code = c and host_token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if r.phase <> 'lobby' then return jsonb_build_object('ok', false, 'reason', 'phase'); end if;
  update public.kcq_case_rooms
    set phase = 'investigation', q_index = -1, revision = revision + 1, updated_at = now()
    where code = c;
  return jsonb_build_object('ok', true);
end; $$;

-- ── 3.5 advance to next question (host) — records server q_opened_at ──
create or replace function public.kcq_case_advance_question(p_code text, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare c text := upper(trim(coalesce(p_code, ''))); r public.kcq_case_rooms; next_qi integer;
begin
  select * into r from public.kcq_case_rooms where code = c and host_token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if r.phase not in ('investigation', 'reveal') then
    return jsonb_build_object('ok', false, 'reason', 'phase');
  end if;
  next_qi := r.q_index + 1;
  if next_qi >= coalesce(array_length(r.q_set, 1), 0) then
    return jsonb_build_object('ok', false, 'reason', 'no_more_questions');
  end if;
  update public.kcq_case_rooms
    set phase = 'question', q_index = next_qi, q_opened_at = now(),
        revision = revision + 1, updated_at = now()
    where code = c;
  return jsonb_build_object('ok', true, 'q_index', next_qi);
end; $$;

-- ── 3.6 answer (player) — THE anti-cheat core ───────────────────────
create or replace function public.kcq_case_answer(
  p_code text, p_player_id text, p_player_token uuid, p_q_index integer, p_option integer
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c          text := upper(trim(coalesce(p_code, '')));
  pid        text := nullif(trim(coalesce(p_player_id, '')), '');
  r          public.kcq_case_rooms;
  real_qi    integer;
  key_index  integer;
  is_cross   boolean;
  is_correct boolean;
  elapsed_ms numeric;
  speed_xp   integer := 0;
  base_xp    integer := 15;          -- §8 LOCKED
  streak_val integer;
  mult_x10   integer;
  gained     integer;
  new_score  integer;
begin
  if c !~ '^[A-Z0-9]{4,6}$' or pid is null then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;

  select * into r from public.kcq_case_rooms where code = c for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'notfound'); end if;

  -- auth: you can only answer as yourself (128-bit token, never broadcast)
  if not exists (
    select 1 from public.kcq_case_player_tokens
    where room_code = c and player_id = pid and player_token = p_player_token
  ) then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;

  -- must be the open question
  if r.phase <> 'question' or r.q_index <> p_q_index then
    return jsonb_build_object('ok', false, 'reason', 'phase');
  end if;

  -- idempotency: one scored answer per (player, question)
  if exists (
    select 1 from public.kcq_case_responses
    where room_code = c and player_id = pid and q_index = p_q_index and answered_at is not null
  ) then
    select score into new_score from public.kcq_case_players where room_code = c and player_id = pid;
    return jsonb_build_object('ok', true, 'duplicate', true, 'score', new_score);
  end if;

  -- server-side answer lookup (key never left the server)
  real_qi := r.q_set[p_q_index + 1];
  select answer_index, is_cross_ref into key_index, is_cross
    from public.kcq_case_answers where case_id = r.case_id and question_index = real_qi;
  if not found then return jsonb_build_object('ok', false, 'reason', 'internal_no_answer'); end if;

  is_correct := (p_option = key_index);

  -- streak (consecutive correct) read from the player row
  select streak into streak_val from public.kcq_case_players where room_code = c and player_id = pid;
  streak_val := coalesce(streak_val, 0);
  if is_correct then streak_val := streak_val + 1; else streak_val := 0; end if;

  if is_correct then
    -- speed bonus from the SERVER clock; clamp guards clock drift (§8.5)
    if r.q_opened_at is not null then
      elapsed_ms := extract(epoch from (now() - r.q_opened_at)) * 1000.0;
      speed_xp := least(5, floor(5.0 * greatest(0.0, (45000.0 - elapsed_ms) / 45000.0))::integer);
    end if;
    -- streak multiplier ×1.0/×1.2/×1.5 (integer ×10), XP only
    mult_x10 := case when streak_val >= 4 then 15 when streak_val >= 2 then 12 else 10 end;
    gained := (base_xp * mult_x10 / 10) + speed_xp;
  else
    gained := 0;
  end if;

  update public.kcq_case_players
    set score = score + gained, streak = streak_val
    where room_code = c and player_id = pid
    returning score into new_score;

  insert into public.kcq_case_responses (room_code, player_id, q_index, option, correct, xp, answered_at)
    values (c, pid, p_q_index, p_option, is_correct, gained, now())
  on conflict (room_code, player_id, q_index) do update
    set option = excluded.option, correct = excluded.correct,
        xp = excluded.xp, answered_at = excluded.answered_at;

  update public.kcq_case_rooms set revision = revision + 1, updated_at = now() where code = c;

  -- NB: the correct answer index is NEVER returned, only correct true/false.
  return jsonb_build_object(
    'ok', true, 'correct', is_correct, 'xp', gained,
    'coins', case when is_correct then 3 else 0 end,
    'speed_xp', speed_xp, 'streak', streak_val, 'score', new_score
  );
end; $$;

-- ── 3.7 open hint (player) — flips the 3★ gate, idempotent ──────────
create or replace function public.kcq_case_open_hint(
  p_code text, p_player_id text, p_player_token uuid, p_q_index integer
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare c text := upper(trim(coalesce(p_code, ''))); pid text := nullif(trim(coalesce(p_player_id, '')), '');
begin
  if not exists (
    select 1 from public.kcq_case_player_tokens
    where room_code = c and player_id = pid and player_token = p_player_token
  ) then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;

  insert into public.kcq_case_responses (room_code, player_id, q_index, hint_used)
    values (c, pid, p_q_index, true)
  on conflict (room_code, player_id, q_index) do update set hint_used = true;

  return jsonb_build_object('ok', true);
end; $$;

-- ── 3.8 advance to reveal (host) — also returns the now-safe correct option ──
-- The question is closing, so revealing its answer is safe; the host broadcasts
-- this to all clients for the teaching moment (cloud clients never hold keys).
create or replace function public.kcq_case_advance_reveal(p_code text, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare c text := upper(trim(coalesce(p_code, ''))); r public.kcq_case_rooms; key_index integer;
begin
  select * into r from public.kcq_case_rooms
    where code = c and host_token = p_token and phase = 'question' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth_or_phase'); end if;

  select answer_index into key_index from public.kcq_case_answers
    where case_id = r.case_id and question_index = r.q_set[r.q_index + 1];

  update public.kcq_case_rooms
    set phase = 'reveal', q_opened_at = null, revision = revision + 1, updated_at = now()
    where code = c;

  return jsonb_build_object('ok', true, 'q_index', r.q_index, 'correct_option', key_index);
end; $$;

-- ── 3.9 end match (host) — recompute stars server-side ──────────────
create or replace function public.kcq_case_end_match(p_code text, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c        text := upper(trim(coalesce(p_code, '')));
  r        public.kcq_case_rooms;
  total_q  integer;
  results  jsonb := '{}'::jsonb;
  pr       record;
  correct_count integer;
  cross_ok boolean;
  any_hint boolean;
  stars    smallint;
begin
  select * into r from public.kcq_case_rooms where code = c and host_token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if r.phase not in ('question', 'reveal') then return jsonb_build_object('ok', false, 'reason', 'phase'); end if;

  total_q := coalesce(array_length(r.q_set, 1), 0);

  for pr in select player_id, display_name, score from public.kcq_case_players where room_code = c loop
    -- correct count is recomputed from stored responses vs the real answer key —
    -- the client's claimed correctness is ignored (QA: star self-reporting).
    select
      count(*) filter (where resp.correct_real),
      bool_or(resp.correct_real and resp.is_cross),
      bool_or(resp.hint_used)
    into correct_count, cross_ok, any_hint
    from (
      select
        (cr.option is not null and cr.option = ka.answer_index) as correct_real,
        ka.is_cross_ref as is_cross,
        cr.hint_used
      from public.kcq_case_responses cr
      join public.kcq_case_answers ka
        on ka.case_id = r.case_id and ka.question_index = r.q_set[cr.q_index + 1]
      where cr.room_code = c and cr.player_id = pr.player_id
    ) resp;

    correct_count := coalesce(correct_count, 0);
    cross_ok := coalesce(cross_ok, false);
    any_hint := coalesce(any_hint, false);

    if total_q > 0 and correct_count = total_q and not any_hint then
      stars := 3;
    elsif total_q > 0 and correct_count::float / total_q >= 0.8 and cross_ok then
      stars := 2;
    elsif total_q > 0 and correct_count::float / total_q >= 0.5 then
      stars := 1;
    else
      stars := 0;
    end if;

    results := jsonb_set(results, array[pr.player_id], jsonb_build_object(
      'display_name',  pr.display_name,
      'stars',         stars,
      'solve_xp',      public.kcq_case_solve_xp(stars),
      'correct_count', correct_count,
      'total_q',       total_q,
      'cross_ref_ok',  cross_ok,
      'hint_used',     any_hint,
      'score',         pr.score
    ), true);
  end loop;

  update public.kcq_case_rooms set phase = 'ended', revision = revision + 1, updated_at = now() where code = c;
  return jsonb_build_object('ok', true, 'results', results);
end; $$;

-- ── 3.10 host/teacher refresh recovery ──────────────────────────────
create or replace function public.kcq_case_host_resume(p_code text, p_host_id text, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.kcq_case_rooms;
begin
  select * into r from public.kcq_case_rooms
    where code = upper(trim(coalesce(p_code, '')))
      and host_id = nullif(trim(coalesce(p_host_id, '')), '')
      and host_token = p_token
      and updated_at >= now() - interval '8 hours';
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  return jsonb_build_object('ok', true, 'token', r.host_token, 'state', public.kcq_case_room_payload(r));
end; $$;

-- ── 3.11 teacher results (host only) — per-player per-question for CSV ──
create or replace function public.kcq_case_teacher_results(p_code text, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r        public.kcq_case_rooms;
  total_q  integer;
  rows_out jsonb := '[]'::jsonb;
  pr       record;
  q_results jsonb;
  qi       integer;
  cr       public.kcq_case_responses;
  key_index integer;
begin
  select * into r from public.kcq_case_rooms where code = upper(trim(coalesce(p_code, ''))) and host_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  total_q := coalesce(array_length(r.q_set, 1), 0);

  for pr in select player_id, display_name, score from public.kcq_case_players where room_code = r.code loop
    q_results := '[]'::jsonb;
    for qi in 0 .. (total_q - 1) loop
      select * into cr from public.kcq_case_responses
        where room_code = r.code and player_id = pr.player_id and q_index = qi;
      select answer_index into key_index from public.kcq_case_answers
        where case_id = r.case_id and question_index = r.q_set[qi + 1];
      q_results := q_results || jsonb_build_array(jsonb_build_object(
        'q_index',   qi,
        'answered',  (cr.answered_at is not null),
        'correct',   (cr.option is not null and cr.option = key_index),
        'hint_used', coalesce(cr.hint_used, false),
        'xp',        coalesce(cr.xp, 0)
      ));
    end loop;
    rows_out := rows_out || jsonb_build_array(jsonb_build_object(
      'player_id', pr.player_id, 'display_name', pr.display_name,
      'total_score', pr.score, 'q_results', q_results
    ));
  end loop;

  return jsonb_build_object('ok', true, 'case_id', r.case_id, 'rows', rows_out);
end; $$;

-- ── 3.12 cloud save (account-only) — server DERIVES caseXp ──────────
-- QA CRITICAL-01/03: no client XP is trusted. The case must exist; caseXp is
-- computed from the monotonic best stars.
create or replace function public.kcq_case_save_progress(
  p_token uuid, p_case_id text, p_stars smallint
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id   uuid;
  cid         text := nullif(trim(coalesce(p_case_id, '')), '');
  v_stars     smallint := coalesce(p_stars, 0);
  v_existing  public.kcq_case_progress%rowtype;
  v_new_stars smallint;
  v_no_hint   boolean;
  v_xp        integer;
begin
  select id into v_user_id from public.kcq_users where session_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;

  if cid is null or not exists (select 1 from public.kcq_case_answers where case_id = cid limit 1) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_case');
  end if;
  if v_stars < 0 or v_stars > 3 then return jsonb_build_object('ok', false, 'reason', 'bad_stars'); end if;

  select * into v_existing from public.kcq_case_progress where user_id = v_user_id and case_id = cid;

  v_new_stars := greatest(coalesce(v_existing.best_stars, 0), v_stars);
  v_no_hint   := coalesce(v_existing.no_hint_solve, false) or (v_stars = 3);
  v_xp        := public.kcq_case_solve_xp(v_new_stars);   -- SERVER-DERIVED, never client-supplied

  insert into public.kcq_case_progress
    (user_id, case_id, best_stars, case_xp_earned, no_hint_solve, completed_at, updated_at)
  values
    (v_user_id, cid, v_new_stars, v_xp, v_no_hint,
     case when v_new_stars >= 1 then coalesce(v_existing.completed_at, now()) else null end, now())
  on conflict (user_id, case_id) do update set
    best_stars     = excluded.best_stars,
    case_xp_earned = excluded.case_xp_earned,
    no_hint_solve  = excluded.no_hint_solve,
    completed_at   = excluded.completed_at,
    updated_at     = now();

  return jsonb_build_object('ok', true, 'best_stars', v_new_stars, 'case_xp', v_xp);
end; $$;

-- ── 3.13 leaderboard (public read) ──────────────────────────────────
create or replace function public.kcq_case_leaderboard()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return jsonb_build_object('ok', true, 'rows', (
    select coalesce(jsonb_agg(row_to_json(lb.*)), '[]'::jsonb) from public.kcq_case_leaderboard lb
  ));
end; $$;

-- ════════════════════════════════════════════════════════════════════
--  4. GRANTS  (accountless players call these, like Party/Arena)
-- ════════════════════════════════════════════════════════════════════
grant execute on function public.kcq_case_create(text,text,text,boolean)            to anon, authenticated;
grant execute on function public.kcq_case_join(text,text,text)                       to anon, authenticated;
grant execute on function public.kcq_case_state(text)                                to anon, authenticated;
grant execute on function public.kcq_case_start_investigation(text,uuid)             to anon, authenticated;
grant execute on function public.kcq_case_advance_question(text,uuid)                to anon, authenticated;
grant execute on function public.kcq_case_answer(text,text,uuid,integer,integer)     to anon, authenticated;
grant execute on function public.kcq_case_open_hint(text,text,uuid,integer)          to anon, authenticated;
grant execute on function public.kcq_case_advance_reveal(text,uuid)                  to anon, authenticated;
grant execute on function public.kcq_case_end_match(text,uuid)                       to anon, authenticated;
grant execute on function public.kcq_case_host_resume(text,text,uuid)                to anon, authenticated;
grant execute on function public.kcq_case_teacher_results(text,uuid)                 to anon, authenticated;
grant execute on function public.kcq_case_save_progress(uuid,text,smallint)          to anon, authenticated;
grant execute on function public.kcq_case_leaderboard()                              to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
--  5. SEED — answer keys for the 5 launch cases (src/data/cases/*)
--  case01/02 keep in sync with the TS source; cases.test.ts is the source of truth.
-- ════════════════════════════════════════════════════════════════════
insert into public.kcq_case_answers (case_id, question_index, answer_index, is_cross_ref) values
  ('case01', 0, 1, false), ('case01', 1, 1, false), ('case01', 2, 2, false), ('case01', 3, 1, true),
  ('case02', 0, 2, false), ('case02', 1, 0, false), ('case02', 2, 1, true),  ('case02', 3, 1, false),
  ('case03', 0, 1, false), ('case03', 1, 1, false), ('case03', 2, 1, true),  ('case03', 3, 1, false),
  ('case04', 0, 2, false), ('case04', 1, 3, false), ('case04', 2, 1, true),  ('case04', 3, 2, false),
  ('case05', 0, 1, false), ('case05', 1, 2, false), ('case05', 2, 2, true),  ('case05', 3, 2, true)
on conflict (case_id, question_index) do update
  set answer_index = excluded.answer_index, is_cross_ref = excluded.is_cross_ref;
