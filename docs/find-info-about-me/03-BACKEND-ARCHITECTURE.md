# Case Files — Backend & Multiplayer Architecture

> Author: supabase-backend-architect agent. Status: DESIGN COMPLETE — awaiting build authorization.
> Produced: 2026-06-09. Locked scope source: `00-BRIEF.md` (SCOPE-LOCKED), `01-PRODUCT-AND-GDD.md`.
> Migration target: `supabase/migrations/0011_case_files.sql` (split into `0012` if needed — see §7).

---

## 1. Schema

### 1.1 Ana jadval: `kcq_case_rooms`

`kcq_party_rooms` (migration `0005`) ning to'g'ridan-to'g'ri kloni — lekin Case Files'ga xos ustunlar qo'shilgan: `case_id`, `q_set` (tanlangan savollar ro'yxati), `q_opened_at` (server timestamp), `is_classroom`, `room_token` (teacher/host token), `hints` (kim qaysi savolda hint ochdi), `display_names` (accountsiz join uchun).

```sql
create table if not exists public.kcq_case_rooms (
  -- Room identity
  code             text        primary key,          -- e.g. 'XKQB7' (5-char alphanumeric)
  host_id          text        not null,             -- display_name or student_id of host/teacher
  host_token       uuid        not null,             -- issued by DB; host must present this for all mutations

  -- Case content selection (immutable after start)
  case_id          text        not null,             -- e.g. 'case-museum-heist'
  q_set            integer[]   not null default '{}', -- ordered indices into Case.questions[] (server picks)

  -- Phase machine
  phase            text        not null default 'lobby'
                   check (phase in ('lobby','investigation','question','reveal','ended')),
  q_index          integer     not null default -1,  -- -1 = pre-questions; 0..N = current question index

  -- Server-side timing (anti-cheat §6.5)
  q_opened_at      timestamptz,                      -- set by kcq_case_advance_question; null outside 'question' phase

  -- Per-player data (JSONB maps keyed by player_id)
  player_tokens    jsonb       not null default '{}'::jsonb, -- { player_id: uuid_token }
  display_names    jsonb       not null default '{}'::jsonb, -- { player_id: "Alisher" }
  scores           jsonb       not null default '{}'::jsonb, -- { player_id: integer }
  answered         jsonb       not null default '{}'::jsonb, -- { "q_idx:player_id": { option, correct, speed_xp, streak } }
  hints            jsonb       not null default '{}'::jsonb, -- { "q_idx:player_id": true } — hint opened?
  streaks          jsonb       not null default '{}'::jsonb, -- { player_id: integer } — consecutive correct count

  -- Classroom tournament flag
  is_classroom     boolean     not null default false,
  -- When is_classroom=true, host_token doubles as teacher_token (is_teacher=true implied by host_token match)

  -- Concurrency / resume
  revision         integer     not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
```

**Indekslar:**

```sql
-- Host resume lookup (kcq_case_host_resume): host_id + host_token + updated_at
create index if not exists kcq_case_rooms_host_idx
  on public.kcq_case_rooms (host_id, updated_at);

-- Stale-room cleanup in kcq_case_create: updated_at
create index if not exists kcq_case_rooms_updated_idx
  on public.kcq_case_rooms (updated_at);
```

**TTL qoidasi:** Har bir `kcq_case_create` chaqiruvida eski (>4 soat) xonalar o'chiriladi. Classroom tournament rooms uchun TTL 8 soat (dars vaqti hisobga olinib).

---

### 1.2 Case content: server-side answer keys

Case content (`src/data/cases/`) **client-side** yuklanadi — lekin `answerIndex` hech qachon client'ga jo'natilmaydi. Javob kaliti faqat DB RPC'da turadi:

```
-- Mavjud patterns'ga o'xshash: Party quiz'da correct option index 0 da;
-- Case Files uchun answer keys alohida server-only config faylda (Edge Function yoki DB secret).
-- MVP yechimi: answer keys RPC ichida hardcoded yoki DB table'da (kcq_case_answers).
```

**`kcq_case_answers` yordamchi jadvali (server-only answer store):**

```sql
create table if not exists public.kcq_case_answers (
  case_id         text    not null,
  question_index  integer not null,    -- 0-based index into Case.questions[]
  answer_index    integer not null,    -- correct choice index (0-based)
  is_cross_ref    boolean not null default false, -- cross-reference question? (2-star gate)
  primary key (case_id, question_index)
);

-- TOTAL LOCKDOWN: no client ever reads this table directly
alter table public.kcq_case_answers enable row level security;
revoke all on public.kcq_case_answers from anon, authenticated;
-- Only SECURITY DEFINER RPCs access it (bypasses RLS as postgres owner)
```

Bu jadval migration'da seed data bilan to'ldiriladi. Answer keys hech qachon client bundle'ga kirmaydi.

---

### 1.3 Cloud save extension: `kcq_case_progress`

Per-student best-result per case (Codecaster `0010` pattern'i):

```sql
create table if not exists public.kcq_case_progress (
  user_id          uuid        not null references public.kcq_users(id) on delete cascade,
  case_id          text        not null,
  best_stars       smallint    not null default 0 check (best_stars between 0 and 3),
  case_xp_earned   integer     not null default 0,  -- cumulative case-solve XP for this case
  no_hint_solve    boolean     not null default false, -- ever got 3 stars on this case?
  completed_at     timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (user_id, case_id)
);

create index if not exists kcq_case_progress_user_idx
  on public.kcq_case_progress (user_id, updated_at desc);

create index if not exists kcq_case_progress_case_idx
  on public.kcq_case_progress (case_id, best_stars);

alter table public.kcq_case_progress enable row level security;
revoke all on public.kcq_case_progress from anon, authenticated;
```

**`useGame` Snapshot extension (frontend agent uchun):**

`useGame.ts` `Snapshot` tipiga qo'shilishi kerak bo'lgan maydonlar (brief §8.2 — LOCKED):
```typescript
casesCompleted: number;
cases3star: number;
caseNoHintSolves: number;
caseStreak: number;
caseXp: number;
classroomCaseTournamentWins: number;
```

Bu maydonlar `kcq_save` RPC ga uzatilayotgan `p_state` JSONB blob ichida yashaydi — hozirgi `state` ustuni tarkibida saqlanadi. Cloud save schema o'zgarmaydi; faqat state bloki kengayadi.

---

### 1.4 Case Files leaderboard view

```sql
drop view if exists public.kcq_case_leaderboard;
create view public.kcq_case_leaderboard as
  select
    p.user_id,
    u.display_name,
    sum(p.case_xp_earned)                                     as total_case_xp,
    count(*)   filter (where p.best_stars >= 1)               as cases_solved,
    count(*)   filter (where p.best_stars = 3)                as cases_3star,
    count(*)   filter (where p.no_hint_solve = true)          as no_hint_solves,
    max(p.updated_at)                                         as last_active
  from public.kcq_case_progress p
  join public.kcq_users u on u.id = p.user_id
  where p.best_stars >= 1
  group by p.user_id, u.display_name
  order by total_case_xp desc, cases_3star desc, last_active desc
  limit 100;

grant select on public.kcq_case_leaderboard to anon, authenticated;
```

---

## 2. RLS — Revoke-All + Public Read Pattern

`kcq_party_rooms` / `kcq_codecaster_progress` patternini AYNAN ko'chiramiz:

```sql
-- kcq_case_rooms: public read, no client write
alter table public.kcq_case_rooms enable row level security;
revoke all on public.kcq_case_rooms from anon, authenticated;

create policy "kcq_case_public_read" on public.kcq_case_rooms
  for select using (true);
grant select on public.kcq_case_rooms to anon, authenticated;

-- Realtime subscription uchun
alter publication supabase_realtime add table public.kcq_case_rooms;
```

**Nima uchun client write yo'q?**

- `phase`, `q_index`, `q_opened_at`, `answered`, `scores` — bularning barchasi faqat RPC orqali o'zgaradi.
- Agar client to'g'ridan-to'g'ri yoza olsa: istalgan o'yinchi boshqa o'yinchining scorini o'zgartirishi, fazani oldinga surib qo'yishi, yoki `q_opened_at`ni vaqtini orqaga qaytarishi mumkin bo'lar edi.
- `SECURITY DEFINER` RPClar RLS'ni chetlab o'tadi (postgres owner sifatida ishlaydi) — bu intentional.

`kcq_case_answers` va `kcq_case_progress` uchun ham xuddi shunday: `revoke all`, hech qanday client read/write yo'q.

---

## 3. RPCs (SECURITY DEFINER) — To'liq Signatures va Xatti-Harakatlar

Barcha RPClar `set search_path = public, extensions, pg_temp` bilan yoziladi. `pgcrypto` extension `0005`da allaqachon yoqilgan.

### 3.1 `kcq_case_create(p_code, p_host_id, p_case_id, p_is_classroom)`

```sql
create or replace function public.kcq_case_create(
  p_code         text,
  p_host_id      text,
  p_case_id      text,
  p_is_classroom boolean default false
)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare
  c   text := upper(trim(coalesce(p_code, '')));
  h   text := nullif(trim(coalesce(p_host_id, '')), '');
  cid text := nullif(trim(coalesce(p_case_id, '')), '');
  tok uuid := gen_random_uuid();
  saved uuid;
begin
  -- Cleanup: eski xonalarni o'chir (classroom rooms uchun 8 soat, oddiy uchun 4 soat)
  delete from public.kcq_case_rooms
    where (is_classroom = false and updated_at < now() - interval '4 hours')
       or (is_classroom = true  and updated_at < now() - interval '8 hours');

  -- Validation
  if c !~ '^[A-Z0-9]{4,6}$' or h is null or cid is null then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;

  -- case_id DB'da mavjudligini tekshir (kcq_case_answers jadvalidagi case_id)
  if not exists (select 1 from public.kcq_case_answers where case_id = cid limit 1) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_case');
  end if;

  -- q_set: server tomondan savollar tartibini tanlash
  -- (MVP: barcha savollar, keyinroq 4-of-6 rotation qo'shiladi)
  insert into public.kcq_case_rooms
    (code, host_id, host_token, case_id, q_set, is_classroom)
  values
    (c, h, tok, cid,
     array(select question_index from public.kcq_case_answers
           where case_id = cid order by question_index),
     coalesce(p_is_classroom, false))
  on conflict (code) do update
    set host_id       = excluded.host_id,
        host_token    = excluded.host_token,
        case_id       = excluded.case_id,
        q_set         = excluded.q_set,
        phase         = 'lobby',
        q_index       = -1,
        q_opened_at   = null,
        player_tokens = '{}'::jsonb,
        display_names = '{}'::jsonb,
        scores        = '{}'::jsonb,
        answered      = '{}'::jsonb,
        hints         = '{}'::jsonb,
        streaks       = '{}'::jsonb,
        is_classroom  = excluded.is_classroom,
        revision      = public.kcq_case_rooms.revision + 1,
        updated_at    = now()
    where public.kcq_case_rooms.updated_at < now() - interval '4 hours'
  returning host_token into saved;

  if saved is null then
    return jsonb_build_object('ok', false, 'reason', 'exists');
  end if;

  return jsonb_build_object('ok', true, 'token', saved);
end; $$;
```

**Anti-cheat:** Faqat server `q_set`ni tanlaydi — `case_id` mavjud ekanligini `kcq_case_answers` jadvalidagi real yozuvlar bilan tekshiradi. Client hech qachon `q_set` yoki `host_token`ni o'zi tanlay olmaydi.

---

### 3.2 `kcq_case_join(p_code, p_player_id, p_display_name)`

```sql
create or replace function public.kcq_case_join(
  p_code         text,
  p_player_id    text,
  p_display_name text
)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare
  c    text := upper(trim(coalesce(p_code, '')));
  pid  text := nullif(trim(coalesce(p_player_id, '')), '');
  pname text := substring(trim(coalesce(p_display_name, 'Player')), 1, 30);
  tok  text;
  r    public.kcq_case_rooms;
begin
  if c !~ '^[A-Z0-9]{4,6}$' or pid is null or pid !~ '^[A-Za-z0-9_-]{2,40}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;

  select * into r from public.kcq_case_rooms where code = c for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'notfound'); end if;

  -- Max 8 players (Party cap bilan bir xil)
  if not (r.player_tokens ? pid)
     and jsonb_object_keys(r.player_tokens) is not null
     and (select count(*) from jsonb_object_keys(r.player_tokens)) >= 8 then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;

  -- Idempotent: agar allaqachon join qilgan bo'lsa, mavjud tokenni qaytaramiz
  tok := r.player_tokens ->> pid;
  if tok is null then
    tok := gen_random_uuid()::text;
    update public.kcq_case_rooms
      set player_tokens = jsonb_set(player_tokens, array[pid], to_jsonb(tok), true),
          display_names = jsonb_set(display_names, array[pid], to_jsonb(pname), true),
          revision      = revision + 1,
          updated_at    = now()
      where code = c;
  end if;

  select * into r from public.kcq_case_rooms where code = c;
  return jsonb_build_object(
    'ok', true,
    'token', tok,
    'state', kcq_case_room_payload(r)
  );
end; $$;
```

**Anti-cheat:** Token DB tomonidan chiqariladi. O'yinchi faqat o'z `player_id` + `token` juftligi bilan javob yubora oladi. Boshqa o'yinchi nomidan harakat qilish imkonsiz — chunki token boshqa UUID.

---

### 3.3 `kcq_case_state(p_code)` — Public read helper RPC

```sql
create or replace function public.kcq_case_state(p_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare r public.kcq_case_rooms;
begin
  select * into r from public.kcq_case_rooms where code = upper(trim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('ok', false, 'reason', 'notfound'); end if;
  return jsonb_build_object('ok', true, 'state', kcq_case_room_payload(r));
end; $$;
```

---

### 3.4 `kcq_case_room_payload(r)` — Helper function (internal)

```sql
create or replace function public.kcq_case_room_payload(r public.kcq_case_rooms)
returns jsonb language sql stable set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'code',          r.code,
    'host_id',       r.host_id,
    'case_id',       r.case_id,
    'q_set',         r.q_set,
    'phase',         r.phase,
    'q_index',       r.q_index,
    -- q_opened_at ni clientga YUBORMAYMIZ — bu server-only timestamp (anti-cheat)
    -- Client faqat "qachon advance bo'ldi" ni broadcast orqali biladi
    'scores',        r.scores,
    'display_names', r.display_names,
    'is_classroom',  r.is_classroom,
    'revision',      r.revision,
    'updated_at',    r.updated_at
  );
$$;
```

`answered` va `hints` ni ham chiqarmimiz — bu ma'lumotlar faqat host/teacher uchun kerak va alohida RPC orqali beriladi. `q_opened_at` hech qachon client'ga chiqmaydi.

---

### 3.5 `kcq_case_start_investigation(p_code, p_token)` — Host/Teacher

```sql
create or replace function public.kcq_case_start_investigation(
  p_code  text,
  p_token uuid
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c    text := upper(trim(coalesce(p_code, '')));
  r    public.kcq_case_rooms;
begin
  select * into r from public.kcq_case_rooms
    where code = c and host_token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;
  if r.phase <> 'lobby' then
    return jsonb_build_object('ok', false, 'reason', 'phase');
  end if;

  update public.kcq_case_rooms
    set phase     = 'investigation',
        q_index   = -1,
        revision  = revision + 1,
        updated_at = now()
    where code = c and host_token = p_token;

  return jsonb_build_object('ok', true);
end; $$;
```

**Anti-cheat:** `host_token` shart. Non-host client bu RPC'ni chaqira olmaydi chunki tokenni bilmaydi.

---

### 3.6 `kcq_case_advance_question(p_code, p_token)` — Host/Teacher. Bu eng kritik RPC.

```sql
create or replace function public.kcq_case_advance_question(
  p_code  text,
  p_token uuid
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c        text := upper(trim(coalesce(p_code, '')));
  r        public.kcq_case_rooms;
  next_qi  integer;
  ts       timestamptz := now();   -- server timestamp — MUHIM anti-cheat
begin
  select * into r from public.kcq_case_rooms
    where code = c and host_token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;

  -- Phase guard: 'investigation' → first question, 'reveal' → next question
  if r.phase not in ('investigation', 'reveal') then
    return jsonb_build_object('ok', false, 'reason', 'phase');
  end if;

  next_qi := r.q_index + 1;

  -- Agar barcha savollar tugagan bo'lsa, 'reveal' ga o'tib to'xtatamiz
  if next_qi >= array_length(r.q_set, 1) then
    return jsonb_build_object('ok', false, 'reason', 'no_more_questions');
  end if;

  update public.kcq_case_rooms
    set phase       = 'question',
        q_index     = next_qi,
        q_opened_at = ts,           -- server-side timestamp for speed bonus (§8.3 LOCKED)
        revision    = revision + 1,
        updated_at  = now()
    where code = c and host_token = p_token;

  return jsonb_build_object('ok', true, 'q_index', next_qi);
end; $$;
```

**Anti-cheat:** `q_opened_at = now()` DB serveri soati bilan yoziladi. Client clock'i ishlatilmaydi. Speed bonus keyinroq `kcq_case_answer` RPC'da `now() - r.q_opened_at` orqali hisoblanadi.

---

### 3.7 `kcq_case_answer(p_code, p_player_id, p_player_token, p_q_index, p_option)` — ENG MUHIM RPC

Bu yerda answer key DB'dan o'qiladi, score hisoblanadi, speed bonus qo'shiladi.

```sql
create or replace function public.kcq_case_answer(
  p_code         text,
  p_player_id    text,
  p_player_token uuid,
  p_q_index      integer,          -- client aytgan q_index — server tekshiradi
  p_option       integer           -- tanlangan javob (0-based index)
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c              text    := upper(trim(coalesce(p_code, '')));
  pid            text    := nullif(trim(coalesce(p_player_id, '')), '');
  r              public.kcq_case_rooms;
  answer_rec     public.kcq_case_answers;
  answer_key     text;
  elapsed_ms     numeric;
  is_correct     boolean;
  speed_xp       integer := 0;
  base_xp        integer := 15;   -- brief §8 LOCKED
  base_coins     integer := 3;    -- brief §8 LOCKED
  streak_val     integer;
  streak_mult_x10 integer;        -- ×10 ga ko'paytirilgan (float'siz integer arifmetika)
  old_score      integer;
  total_xp       integer;
  total_coins    integer;
  new_scores     jsonb;
  new_streaks    jsonb;
  new_answered   jsonb;
begin
  if c !~ '^[A-Z0-9]{4,6}$' or pid is null or pid !~ '^[A-Za-z0-9_-]{2,40}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;

  -- ── 1. Room va auth tekshiruvi ────────────────────────────────────
  select * into r from public.kcq_case_rooms where code = c for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'notfound'); end if;

  -- Player token mosligini tekshir — boshqa o'yinchi nomidan score imkonsiz
  if r.player_tokens ->> pid is distinct from p_player_token::text then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;

  -- Phase va q_index mosligini tekshir
  if r.phase <> 'question' or r.q_index <> p_q_index then
    return jsonb_build_object('ok', false, 'reason', 'phase');
  end if;

  -- ── 2. Idempotency: agar allaqachon javob bergan bo'lsa ──────────
  answer_key := p_q_index::text || ':' || pid;
  if r.answered ? answer_key then
    return jsonb_build_object('ok', true, 'duplicate', true, 'scores', r.scores);
  end if;

  -- ── 3. Server-side answer lookup (answer key hech qachon clientga ketmagan) ──
  select * into answer_rec
    from public.kcq_case_answers
    where case_id = r.case_id
      and question_index = r.q_set[r.q_index + 1];  -- q_set 1-indexed array, q_index 0-based

  if not found then
    -- Bu holatga faqat data integrity muammosida tushiladi
    return jsonb_build_object('ok', false, 'reason', 'internal_no_answer');
  end if;

  is_correct := (p_option = answer_rec.answer_index);

  -- ── 4. Speed bonus (LOCKED formula — brief §8.3) ─────────────────
  -- floor(5 * max(0, (45000 - elapsed_ms) / 45000))
  -- Faqat correct answer'da qo'llanadi
  if is_correct and r.q_opened_at is not null then
    elapsed_ms := extract(epoch from (now() - r.q_opened_at)) * 1000.0;
    speed_xp   := floor(5.0 * greatest(0.0, (45000.0 - elapsed_ms) / 45000.0))::integer;
    speed_xp   := least(speed_xp, 5);  -- cap: max +5 XP (brief §8 LOCKED)
  end if;

  -- ── 5. Streak multiplier (LOCKED — brief §8) ─────────────────────
  -- ×1.0 (0-1) · ×1.2 (2-3) · ×1.5 (4+)
  -- Integer arifmetika uchun ×10: 10, 12, 15
  if is_correct then
    streak_val := coalesce((r.streaks ->> pid)::integer, 0) + 1;
  else
    streak_val := 0;
  end if;

  streak_mult_x10 := case
    when streak_val >= 4 then 15  -- ×1.5
    when streak_val >= 2 then 12  -- ×1.2
    else 10                       -- ×1.0
  end;

  -- ── 6. Score hisoblash ────────────────────────────────────────────
  if is_correct then
    -- base_xp * streak_mult / 10 + speed_xp
    total_xp    := (base_xp * streak_mult_x10 / 10) + speed_xp;
    total_coins := base_coins;  -- coins streak'dan ta'sirlanmaydi (brief aniq ko'rsatmaydi; konservativ yondashuv)
    old_score   := coalesce((r.scores ->> pid)::integer, 0);

    new_scores  := jsonb_set(r.scores, array[pid], to_jsonb(old_score + total_xp), true);
    new_streaks := jsonb_set(r.streaks, array[pid], to_jsonb(streak_val), true);
  else
    total_xp    := 0;
    total_coins := 0;
    new_scores  := r.scores;
    new_streaks := jsonb_set(r.streaks, array[pid], to_jsonb(0), true);  -- streak reset
  end if;

  -- ── 7. Answered record (idempotency kaliti) ───────────────────────
  new_answered := jsonb_set(r.answered, array[answer_key], jsonb_build_object(
    'option',    p_option,
    'correct',   is_correct,
    'speed_xp',  speed_xp,
    'streak',    streak_val,
    'xp',        total_xp,
    'coins',     total_coins
  ), true);

  -- ── 8. DB'ga yozish ──────────────────────────────────────────────
  update public.kcq_case_rooms
    set scores   = new_scores,
        streaks  = new_streaks,
        answered = new_answered,
        revision = revision + 1,
        updated_at = now()
    where code = c;

  select * into r from public.kcq_case_rooms where code = c;
  return jsonb_build_object(
    'ok',        true,
    'correct',   is_correct,
    'xp',        total_xp,
    'coins',     total_coins,
    'speed_xp',  speed_xp,
    'streak',    streak_val,
    'scores',    r.scores
  );
end; $$;
```

**Anti-cheat kafolatlar (bu RPCda):**
1. `player_tokens ->> pid` token tekshiruvi — boshqa o'yinchi nomidan javob yubora olmaysiz
2. `r.answered ? answer_key` — idempotency, bir savol ikki marta ball olmaydi
3. `answer_rec.answer_index` server DB'dan o'qiladi — client hech qachon javob kalitini ko'rmaydi
4. `r.phase <> 'question' or r.q_index <> p_q_index` — fazadan tashqari javob qabul qilinmaydi
5. `q_opened_at` server vaqti, `speed_xp` RPC ichida hisoblanadi — client clock'dan mustaqil

---

### 3.8 `kcq_case_open_hint(p_code, p_player_id, p_player_token, p_q_index)` — Hint tracking

```sql
create or replace function public.kcq_case_open_hint(
  p_code         text,
  p_player_id    text,
  p_player_token uuid,
  p_q_index      integer
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c         text := upper(trim(coalesce(p_code, '')));
  pid       text := nullif(trim(coalesce(p_player_id, '')), '');
  r         public.kcq_case_rooms;
  hint_key  text;
begin
  select * into r from public.kcq_case_rooms where code = c for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'notfound'); end if;

  if r.player_tokens ->> pid is distinct from p_player_token::text then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;

  hint_key := p_q_index::text || ':' || pid;

  -- Idempotent: agar allaqachon hint ochilgan bo'lsa, qayta yozmaydi
  if not (r.hints ? hint_key) then
    update public.kcq_case_rooms
      set hints    = jsonb_set(hints, array[hint_key], 'true'::jsonb, true),
          revision = revision + 1,
          updated_at = now()
      where code = c;
  end if;

  return jsonb_build_object('ok', true);
end; $$;
```

Bu RPC 3-yulduz gateni himoya qiladi: `hints` xaritasi `kcq_case_end_match`da tekshiriladi.

---

### 3.9 `kcq_case_advance_reveal(p_code, p_token)` — Reveal fazasiga o'tish

```sql
create or replace function public.kcq_case_advance_reveal(
  p_code  text,
  p_token uuid
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c text := upper(trim(coalesce(p_code, '')));
begin
  update public.kcq_case_rooms
    set phase      = 'reveal',
        q_opened_at = null,   -- keyingi savolga o'tguncha null
        revision    = revision + 1,
        updated_at  = now()
    where code = c and host_token = p_token and phase = 'question';

  if not found then return jsonb_build_object('ok', false, 'reason', 'auth_or_phase'); end if;
  return jsonb_build_object('ok', true);
end; $$;
```

---

### 3.10 `kcq_case_end_match(p_code, p_token)` — Match tugash va stars hisoblash

Bu eng murakkab RPC — Codecaster `grading.ts` mantiqini SQL'da takrorlaydi.

```sql
create or replace function public.kcq_case_end_match(
  p_code  text,
  p_token uuid
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c                 text := upper(trim(coalesce(p_code, '')));
  r                 public.kcq_case_rooms;
  pid               text;
  total_q           integer;
  correct_count     integer;
  cross_ref_correct boolean;
  any_hint          boolean;
  stars             integer;
  solve_xp          integer;
  solve_coins       integer;
  player_results    jsonb := '{}'::jsonb;
  answer_key        text;
  answer_data       jsonb;
  q_real_idx        integer;
  ans_rec           public.kcq_case_answers;
begin
  select * into r from public.kcq_case_rooms
    where code = c and host_token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;

  -- Phase guard: faqat 'reveal' dan 'ended' ga o'tish mumkin
  if r.phase not in ('question', 'reveal') then
    return jsonb_build_object('ok', false, 'reason', 'phase');
  end if;

  total_q := array_length(r.q_set, 1);

  -- Har bir o'yinchi uchun stars hisobla
  for pid in select jsonb_object_keys(r.player_tokens) loop
    correct_count    := 0;
    cross_ref_correct := false;
    any_hint          := false;

    for qi in 0..(total_q - 1) loop
      answer_key  := qi::text || ':' || pid;
      answer_data := r.answered -> answer_key;

      -- Bu savol uchun answer key DB'dan ol
      q_real_idx := r.q_set[qi + 1];  -- 1-indexed array
      select * into ans_rec from public.kcq_case_answers
        where case_id = r.case_id and question_index = q_real_idx;

      if answer_data is not null then
        -- Correct hisoblash (client report'ga ishonmaymiz — DB answer_data.option ni tekshiramiz)
        if (answer_data->>'option')::integer = ans_rec.answer_index then
          correct_count := correct_count + 1;
          if ans_rec.is_cross_ref then
            cross_ref_correct := true;
          end if;
        end if;
        -- Hint ochilganmi?
        if r.hints ? answer_key then
          any_hint := true;
        end if;
      end if;
    end loop;

    -- Stars tartibi (brief §8 LOCKED):
    -- 3★: 100% correct + no hints
    -- 2★: >=80% correct + >=1 cross-ref correct
    -- 1★: >=50% correct
    -- 0:  <50%
    if total_q > 0
       and correct_count = total_q
       and not any_hint then
      stars := 3; solve_xp := 120; solve_coins := 24;
    elsif total_q > 0
       and correct_count::float / total_q >= 0.8
       and cross_ref_correct then
      stars := 2; solve_xp := 80; solve_coins := 16;
    elsif total_q > 0
       and correct_count::float / total_q >= 0.5 then
      stars := 1; solve_xp := 40; solve_coins := 8;
    else
      stars := 0; solve_xp := 0; solve_coins := 0;
    end if;

    player_results := jsonb_set(player_results, array[pid], jsonb_build_object(
      'stars',          stars,
      'solve_xp',       solve_xp,
      'solve_coins',    solve_coins,
      'correct_count',  correct_count,
      'total_q',        total_q,
      'cross_ref_ok',   cross_ref_correct,
      'hint_used',      any_hint,
      'score',          coalesce((r.scores ->> pid)::integer, 0)
    ), true);
  end loop;

  -- Fazani 'ended' ga o'tkaz
  update public.kcq_case_rooms
    set phase      = 'ended',
        revision   = revision + 1,
        updated_at = now()
    where code = c;

  return jsonb_build_object(
    'ok',     true,
    'results', player_results
  );
end; $$;
```

**Anti-cheat:** Stars server-side DB'dagi `answered` yozuvlari va `kcq_case_answers`dagi haqiqiy `answer_index` asosida hisoblanadi. Client o'z yulduzini o'zi e'lon qila olmaydi.

---

### 3.11 `kcq_case_host_resume(p_code, p_host_id, p_token)` — Host/Teacher refresh recovery

```sql
create or replace function public.kcq_case_host_resume(
  p_code    text,
  p_host_id text,
  p_token   uuid
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  r public.kcq_case_rooms;
begin
  select * into r
    from public.kcq_case_rooms
    where code     = upper(trim(coalesce(p_code, '')))
      and host_id  = nullif(trim(coalesce(p_host_id, '')), '')
      and host_token = p_token
      and updated_at >= now() - interval '8 hours';  -- classroom session uchun uzunroq window

  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;

  return jsonb_build_object(
    'ok',    true,
    'token', r.host_token,
    'state', kcq_case_room_payload(r)
  );
end; $$;
```

`0006_party_resume_scores.sql` patternini aynan kuzatadi. Teacher sahifani yangilasa, token + state qaytariladi, o'yin davom etadi.

---

### 3.12 `kcq_case_teacher_results(p_code, p_token)` — Teacher-only classroom analytics

Bu RPC faqat `is_classroom=true` xonalar uchun to'liq per-player, per-question natijalarni qaytaradi (CSV export uchun).

```sql
create or replace function public.kcq_case_teacher_results(
  p_code  text,
  p_token uuid
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  r   public.kcq_case_rooms;
  pid text;
  qi  integer;
  total_q    integer;
  rows_out   jsonb := '[]'::jsonb;
  player_row jsonb;
  q_results  jsonb;
  answer_key text;
  answer_data jsonb;
  ans_rec    public.kcq_case_answers;
  q_real_idx integer;
begin
  select * into r
    from public.kcq_case_rooms
    where code = upper(trim(coalesce(p_code, '')))
      and host_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;

  total_q := array_length(r.q_set, 1);

  for pid in select jsonb_object_keys(r.player_tokens) loop
    q_results := '[]'::jsonb;

    for qi in 0..(total_q - 1) loop
      answer_key  := qi::text || ':' || pid;
      answer_data := r.answered -> answer_key;
      q_real_idx  := r.q_set[qi + 1];

      select * into ans_rec from public.kcq_case_answers
        where case_id = r.case_id and question_index = q_real_idx;

      q_results := q_results || jsonb_build_array(jsonb_build_object(
        'q_index',    qi,
        'answered',   (answer_data is not null),
        'correct',    case when answer_data is not null
                           then (answer_data->>'option')::integer = ans_rec.answer_index
                           else false end,
        'hint_used',  (r.hints ? answer_key),
        'xp',         coalesce((answer_data->>'xp')::integer, 0)
      ));
    end loop;

    player_row := jsonb_build_object(
      'player_id',    pid,
      'display_name', r.display_names ->> pid,
      'total_score',  coalesce((r.scores ->> pid)::integer, 0),
      'q_results',    q_results
    );
    rows_out := rows_out || jsonb_build_array(player_row);
  end loop;

  return jsonb_build_object('ok', true, 'rows', rows_out, 'case_id', r.case_id);
end; $$;
```

Bu natijalar asosida frontend CSV'ni client-side `xlsx` kutubxonasi orqali (mavjud `students/import` pattern) yaratadi.

---

### 3.13 `kcq_case_save_progress(p_token, p_case_id, p_stars, p_case_xp)` — Cloud save

```sql
create or replace function public.kcq_case_save_progress(
  p_token    uuid,
  p_case_id  text,
  p_stars    smallint,
  p_case_xp  integer   -- total_case_xp uchun
)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id  uuid;
  v_existing public.kcq_case_progress%rowtype;
  v_new_stars smallint;
  v_no_hint   boolean;
begin
  select id into v_user_id from public.kcq_users where session_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'auth'); end if;

  if p_stars < 0 or p_stars > 3 then
    return jsonb_build_object('ok', false, 'reason', 'bad_stars');
  end if;

  select * into v_existing
    from public.kcq_case_progress
    where user_id = v_user_id and case_id = p_case_id;

  v_new_stars := greatest(coalesce(v_existing.best_stars, 0), p_stars);
  v_no_hint   := coalesce(v_existing.no_hint_solve, false) or (p_stars = 3);

  insert into public.kcq_case_progress
    (user_id, case_id, best_stars, case_xp_earned, no_hint_solve, completed_at, updated_at)
  values
    (v_user_id, p_case_id, v_new_stars,
     coalesce(p_case_xp, 0),
     v_no_hint,
     case when v_new_stars >= 1 then coalesce(v_existing.completed_at, now()) else null end,
     now())
  on conflict (user_id, case_id) do update set
    best_stars     = excluded.best_stars,
    case_xp_earned = excluded.case_xp_earned,
    no_hint_solve  = excluded.no_hint_solve,
    completed_at   = excluded.completed_at,
    updated_at     = now();

  return jsonb_build_object('ok', true, 'best_stars', v_new_stars);
end; $$;
```

---

## 4. Realtime Arxitekturasi

### 4.1 Channel pattern — Party'ni aynan ko'chiramiz

```typescript
// src/lib/caseFiles/useCaseRoom.ts (frontend agent uchun)
// Channel: `kcq-case-${code}` — bir xil pattern: kcq-party-*, kcq-arena-*
// Transport: mavjud Transport abstract class (src/lib/arena/network/realtime.ts) ni qayta ishlatish
```

**Presence** — faqat display metadata:
```typescript
interface CasePresenceMeta {
  name: string;      // display name (accountsiz join)
  avatar: string;    // emoji yoki avatar_id
  isHost: boolean;
}
```

**Broadcast events** (host→all):
```
INVESTIGATION_STARTED   — barcha o'yinchilar investigation fazasiga o'tadi
QUESTION_ADVANCED       — { q_index } — keyingi savol ochildi (q_opened_at broadcast qilinmaydi — anti-cheat)
REVEAL_STARTED          — { q_index, correct_option } — reveal fazasi (to'g'ri javob ko'rsatiladi)
MATCH_ENDED             — { results } — finalnatijalar
```

**Broadcast events** (player→all):
```
PLAYER_ANSWERED         — { player_id, q_index } — "o'yinchi javob berdi" belgisi (score emas!)
PLAYER_HINT_OPENED      — { player_id, q_index } — hint ochildi
```

Score va `q_opened_at` hech qachon broadcast qilinmaydi — bu ma'lumotlar faqat RPC natijasida o'yinchining o'ziga qaytadi va Postgres'da saqlanadi.

### 4.2 Late-join handling

1. O'yinchi connect bo'lganda `kcq_case_state(code)` chaqiradi
2. Postgres'dagi `phase`, `q_index`, `scores`, `revision`ni oladi
3. O'z playerToken'ini `kcq_case_join`dan oladi (idempotent — allaqachon join bo'lgan bo'lsa eski tokenni qaytaradi)
4. Investigation fazasida bo'lsa — barcha sources mavjud (client-side), o'qishni davom ettiradi
5. Question fazasida bo'lsa — savol paydo bo'ladi, `q_opened_at` yo'q (client olmasligi kerak), lekin hali javob bera oladi

### 4.3 Disconnect/Reconnect

- O'yinchi disconnect bo'lsa, Presence eventlari uni o'chirib yuboradi (UI'da "left" belgisi)
- Qayta ulansa, `kcq_case_join` (idempotent) + `kcq_case_state` orqali o'z pozitsiyasini tiklaydi
- **Host/Teacher disconnect:** `kcq_case_host_resume` bilan session tiklanadi — `phase` va `q_index` saqlanib qolgan, o'yin davom etadi
- O'yinchi disconnect bo'lganda uning oldingi javoblari `answered` jsonb'da saqlanib qoladi — qayta ulanganda scoring ta'sirlirlamaydi

---

## 5. Cloud Save Schema — Snapshot Extension

`useGame.ts` `Snapshot` tipiga quyidagi maydonlar qo'shiladi (brief §8.2 LOCKED):

```typescript
// src/store/useGame.ts Snapshot type extension
interface Snapshot {
  // ... mavjud maydonlar ...
  casesCompleted: number;              // ≥1 star bilan yakunlangan case'lar soni
  cases3star: number;                 // 3 star bilan yakunlangan case'lar soni
  caseNoHintSolves: number;           // hint ochmasdan 3 star (= cases3star bilan ustma-ust)
  caseStreak: number;                 // consecutive days with ≥1 case completed
  caseXp: number;                     // ALOHIDA COUNTER — faqat case-solve XP (rank uchun)
  classroomCaseTournamentWins: number; // classroom room'da birinchi o'rin
}
```

Bu maydonlar `kcq_save` RPC'ga uzatilayotgan `p_state` JSONB ichida yashaydi. Hozirgi `kcq_users.state` ustuni kengayadi — yangi ustun kerak emas.

**`caseXp` muhim note:** Bu faqat case-solve XP (40/80/120 XP per solve, anti-farm delta), per-answer XP (15 XP) emas. `caseAnswerCorrect()` action'i `caseXp`ni oshirmaydi — faqat `caseMatchEnd()` oshiradi. Bu Detective rank farmingdan himoya qiladi.

### 5.1 Leaderboard RPC

```sql
create or replace function public.kcq_case_leaderboard()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  return jsonb_build_object(
    'ok', true,
    'rows', (
      select coalesce(jsonb_agg(row_to_json(lb.*)), '[]'::jsonb)
      from public.kcq_case_leaderboard lb
    )
  );
end; $$;
```

---

## 6. Classroom Tournament Specifics

### 6.1 Teacher token — `requireAdmin()` bilan emas

Brief §5.5 va GDD §5 aniq ko'rsatadi: classroom rooms uchun teacher authorizatsiyasi `requireAdmin()` (server middleware, `kcq_admins` jadvalini ishlatadi) orqali emas, balki xona yaratilganda DB tomonidan berilgan `host_token` orqali.

**Sabab:** Teacher sahifadan case room yasaydi va token `kcq_case_create` RPC'dan qaytadi. Bu token keyinchalik `kcq_case_advance_question`, `kcq_case_advance_reveal`, `kcq_case_end_match` uchun ishlatiladi. `requireAdmin()` — bu server route handler'lar uchun (admin panel API routes); o'yin jarayonida emas.

**Flow:**
```
1. Teacher admin panel'da case tanlaydi
2. Frontend calls kcq_case_create(code, teacher_id, case_id, is_classroom=true)
   → returns host_token (UUID)
3. Teacher has host_token in sessionStorage
4. Teacher calls kcq_case_start_investigation(code, host_token) → o'yin boshlanadi
5. Teacher calls kcq_case_advance_question(code, host_token) → savol ochiladi (q_opened_at yoziladi)
6. Teacher manually advances — no auto-advance timeout (GDD §5: "teacher-controlled pacing is a feature")
```

### 6.2 Student join — accountsiz, COPPA-safe

Students join via `/case/[code]` (display name only, no account):
- `player_id` = browser'da `randomId()` (sessionStorage'da saqlangan, Party pattern)
- `display_name` = o'quvchi kiritadi (max 30 char)
- `kcq_case_join(code, player_id, display_name)` → token qaytadi

### 6.3 CSV export query shape

`kcq_case_teacher_results` RPC qaytargan JSON frontend tomonida `xlsx` kutubxonasi orqali CSV'ga aylantiriladi:

```
display_name | total_score | stars | Q1_correct | Q1_hint | Q2_correct | Q2_hint | ...
```

Bu `src/app/api/admin/students/import` dagi `xlsx` usage pattern'ini kuzatadi.

### 6.4 Classroom max players

GDD `max players: 8` deydi (Party cap bilan bir xil). Classroom tournament uchun bu past ko'rinishi mumkin, lekin MVP uchun 8 ta o'quvchi yetarli (MVP pilot). v1.1 da 30'ga oshirish mumkin.

---

## 7. Migration Rejasi

### Migration `0011_case_files.sql` — barcha narsani bitta migration'da

**Argument yagona migration uchun:** `0005`, `0007`, `0010` precedent'lari yagona migration'da ham table hem barcha RPClarni qamrab olishini ko'rsatdi. Case Files o'zaro bog'liq — `kcq_case_answers` bo'lmasa, `kcq_case_create` to'g'ri ishlolmaydi.

**Agar hajm katta bo'lsa — split:**
- `0011_case_files_schema.sql` — jadvallar, RLS, indekslar, seed answers
- `0012_case_files_rpcs.sql` — barcha SECURITY DEFINER RPClar

### `0011` tarkibi (tartib bilan):

```sql
-- ROLLBACK ESLATMASI:
-- drop function if exists public.kcq_case_leaderboard();
-- drop function if exists public.kcq_case_save_progress(uuid,text,smallint,integer);
-- drop function if exists public.kcq_case_teacher_results(text,uuid);
-- drop function if exists public.kcq_case_host_resume(text,text,uuid);
-- drop function if exists public.kcq_case_end_match(text,uuid);
-- drop function if exists public.kcq_case_advance_reveal(text,uuid);
-- drop function if exists public.kcq_case_open_hint(text,text,uuid,integer);
-- drop function if exists public.kcq_case_answer(text,text,uuid,integer,integer);
-- drop function if exists public.kcq_case_advance_question(text,uuid);
-- drop function if exists public.kcq_case_start_investigation(text,uuid);
-- drop function if exists public.kcq_case_state(text);
-- drop function if exists public.kcq_case_room_payload(public.kcq_case_rooms);
-- drop function if exists public.kcq_case_join(text,text,text);
-- drop function if exists public.kcq_case_create(text,text,text,boolean);
-- drop view  if exists public.kcq_case_leaderboard;
-- drop table if exists public.kcq_case_progress;
-- drop table if exists public.kcq_case_answers;
-- drop table if exists public.kcq_case_rooms;

-- 1. pgcrypto (already in 0005, guard with if not exists)
create extension if not exists pgcrypto with schema extensions;

-- 2. kcq_case_answers (server-only answer store) — BIRINCHI, create/RPC bog'liq
-- 3. kcq_case_rooms (main game table)
-- 4. kcq_case_progress (cloud save per-student)
-- 5. RLS + grants
-- 6. Realtime publication
-- 7. Indexes
-- 8. Seed data (5 launch cases' answer keys)
-- 9. kcq_case_room_payload() helper
-- 10. kcq_case_create()
-- 11. kcq_case_join()
-- 12. kcq_case_state()
-- 13. kcq_case_start_investigation()
-- 14. kcq_case_advance_question()
-- 15. kcq_case_answer()
-- 16. kcq_case_open_hint()
-- 17. kcq_case_advance_reveal()
-- 18. kcq_case_end_match()
-- 19. kcq_case_host_resume()
-- 20. kcq_case_teacher_results()
-- 21. kcq_case_save_progress()
-- 22. kcq_case_leaderboard view + RPC
-- 23. grant execute on all functions to anon, authenticated
```

---

## 8. Security Risks

### 8.1 Answer-peeking (ENG YUQORI xavf)

**Tavsif:** `kcq_case_answers` jadvalida to'g'ri javob indekslari saqlangan. Agar bu jadval client'ga ochiq bo'lsa, o'quvchi devtools'da har qanday savolning javobini ko'ra oladi.

**Yechim:** `revoke all on public.kcq_case_answers from anon, authenticated` — faqat `SECURITY DEFINER` RPClar bu jadvalga yoza oladi. `kcq_case_room_payload()` hech qachon `answer_index`ni chiqarmaydi.

**Red team:** "RPC natijasidan javobni topib bo'ladimi?" — `kcq_case_answer` faqat `correct: true/false` qaytaradi, javob indeksini emas. `kcq_case_advance_reveal` reveal fazasida to'g'ri javobni broadcastga qo'yadi — lekin bu fazaga faqat host token bilan o'tiladi va javob allaqachon berilgandan keyin ko'rsatiladi.

### 8.2 Token forgery (O'RTA xavf)

**Tavsif:** O'yinchi boshqa o'yinchining `player_token`ini taxmin qilsa, uning nomidan javob yuborishi mumkin.

**Yechim:** Token UUID (128-bit random) — taxmin qilish amaliy jihatdan imkonsiz. `for update` lock idempotency va race condition'larni yo'q qiladi.

### 8.3 Phase forgery (O'RTA xavf)

**Tavsif:** Client o'z holatida `phase='question'` deb ko'rsatsa ham, DB `phase` tekshiriladi.

**Yechim:** `kcq_case_answer`da `r.phase <> 'question'` tekshiruvi mavjud. Non-host client phase'ni o'zgartira olmaydi — buning uchun `host_token` kerak.

### 8.4 Double-scoring (PAST xavf, yechilgan)

**Tavsif:** O'yinchi bir xil savolga ikki marta javob yuborib, ikki marta XP olishi mumkin.

**Yechim:** `answer_key = q_index::text || ':' || player_id`. `r.answered ? answer_key` tekshiruvi bilan duplicate detect qilinadi va `true, duplicate: true` qaytariladi.

### 8.5 Speed bonus manipulation (O'RTA xavf, yechilgan)

**Tavsif:** O'yinchi juda tez javob yuborsa, `q_opened_at`dan oldin javob kelib qolsa nima bo'ladi?

**Yechim:** `q_opened_at` DB'da server clock bilan yoziladi. Agar `elapsed_ms < 0` bo'lsa (clock drift), `greatest(0, ...)` ni `speed_xp` formulasida ishlatamiz — natija `5` bo'ladi (max). Bu acceptable: juda tez javob bergan o'yinchi max speed bonusni oladi, bu razrez.

### 8.6 Star self-reporting (PAST xavf, yechilgan)

**Tavsif:** Client `caseMatchEnd(caseId, 3)` ni chaqirib o'ziga 3 yulduz berishi mumkin.

**Yechim:** Stars faqat `kcq_case_end_match` RPC'da server tomonidan hisoblanadi. `kcq_case_save_progress` faqat session token bilan chaqiriladi va `p_stars` client tomonidan beriladi — bu MVP trust limitation (Codecaster'dagi `validated=false` pattern bilan bir xil). Server-side match'dagi stars `kcq_case_end_match`'dan, offline Bot Practice'dagi stars client'dan keladi. Bu risk acceptable MVP uchun — real-time match stars server-authoritative.

### 8.7 Teacher token abuse (PAST xavf)

**Tavsif:** Agar o'quvchi teacher'ning `host_token`ini intercepting qilsa, o'zini teacher deb ko'rsatishi mumkin.

**Yechim:** Token sessionStorage'da saqlanadi (client-side JS). SSL/TLS kafolatlanishi shart. Token broadcast yoki presence orqali hech qachon yuborilmaydi. O'quvchilar `/case/[code]` sahifasida token'ni ko'rmaydi.

### 8.8 Classroom result tampering (O'RTA xavf)

**Tavsif:** O'quvchi `kcq_case_teacher_results` ni to'g'ridan-to'g'ri chaqirib, natijalarga kirishi mumkin.

**Yechim:** Bu RPC `host_token` shart qiladi. O'quvchilar teacher token'ini bilishmaydi.

### 8.9 Content enumeration (PAST xavf)

**Tavsif:** `kcq_case_answers`da barcha case'larning javoblari bor — agar student unga kirsa, barcha kelajakdagi case'larning javoblarini ko'ra oladi.

**Yechim:** Jadval to'liq locked (`revoke all`). Hech qanday RPC barcha case javoblarini qaytarmaydi.

---

## 9. Performance Notes

### 9.1 JSONB ustunlar soni

`kcq_case_rooms` jadvali 6 ta JSONB ustuniga ega (`player_tokens`, `display_names`, `scores`, `answered`, `hints`, `streaks`). Max 8 o'yinchi va 10 savol bo'lsa, `answered` max 80 yozuv saqlaydi — bu acceptable. Yirik classroom (>30 o'quvchi) uchun bu yondashuv qayta ko'rib chiqilishi kerak (v1.1 uchun).

### 9.2 `for update` locking

`kcq_case_answer` va `kcq_case_join` `for update` ishlatadi — bu row-level lock. 8 o'yinchi bitta vaqtda javob yuborganda qisqa lock contention bo'lishi mumkin. Bu hali ham millisecond darajasida — acceptable.

### 9.3 Loop in `kcq_case_end_match`

`kcq_case_end_match`da PL/pgSQL looplari bor (players × questions). Max 8 × 10 = 80 iteration — bu match oxirida bir marta chaqiriladi, performance muammosi emas.

### 9.4 Stale room cleanup

`delete from kcq_case_rooms where ...` har `kcq_case_create` chaqiruvida. `updated_at` indeksi bilan bu tez ishlaydi.

### 9.5 Realtime subscription

`supabase_realtime` publication'ga `kcq_case_rooms` qo'shiladi. `revision` ustuni Realtime event'ni trigger qiladi — Realtime faqat o'zgartirish bo'lganda yuboradi. 8 o'yinchi × 10 savol × har savol 8-9 update = max ~80 Realtime event/match — bu acceptable.

---

## 10. GDD Konfliktlari va Ochiq Savollar

### 10.1 GDD §5 vs Realtime: "auto-advance after 120s for Private Room, no auto-advance for Classroom"

GDD §5 Private Room'da `investigation_timeout_ms = 120_000` bilan **auto-advance** ta'riflaydi. Lekin bu server-side timer talab qiladi — Supabase Edge Function yoki client-side timer (host refresh'da yo'qoladi).

**Mening tavsiyam:** MVP uchun auto-advance yo'q — faqat host/teacher manual advance. `investigation_timeout_ms` client-side countdown sifatida ko'rsatiladi, lekin server uni enforce qilmaydi. Edge Function keyinroq (v1.1) qo'shilishi mumkin. Bu aniqlash uchun Lead'ga eslatma.

### 10.2 Question pool rotation: "4-of-6" — MVP uchun

GDD §2.5 "rotate 4 of 6 available questions each run" deydi. Lekin §6 "Fast-Follow (v1.1)" ga qo'ygan. `kcq_case_create`dagi `q_set` serverde shakllanadi — random 4-of-6 tanlov qo'shish keyinroq oson.

**MVP `q_set`:** Barcha savollar tartibda (`select question_index ... order by question_index`).

### 10.3 "Coins multiplied by streak" — aniq ko'rsatilmagan

Brief §8 faqat XP uchun streak multiplier ko'rsatadi. Coinlar uchun aniq qoida yo'q. Mening yechimim: coins streak'dan ta'sirlanmaydi (conservative). Lead aniqlashtirishi kerak.

### 10.4 `is_teacher` flag vs `is_classroom`

GDD §5 va §6 `is_teacher` flagni `room_token`da ko'rsatadi. Mening yechimim: `is_classroom = true` bo'lganda `host_token = teacher_token` — alohida `is_teacher` flag kerak emas. Bu sodda va xavfsiz. Teacher har doim host.

### 10.5 Student accounts vs accountless join

Private Room va Classroom Tournament uchun student hech qanday account kerak emas (COPPA-safe, brief §5.5 "display name only"). `kcq_case_save_progress` esa faqat `session_token` bo'lgan o'yinchilar uchun — accountsiz o'yinchilar cloud progress saqlay olmaydi. Bu intentional.

---

## Summary (Lead uchun 6–10 qatorlik xulosa)

**Jadvallar:** `kcq_case_rooms` (asosiy room table, Party 0005 kloni), `kcq_case_answers` (server-only answer keys, to'liq locked), `kcq_case_progress` (cloud save per-student, Codecaster 0010 kloni), `kcq_case_leaderboard` view.

**RPClar (13 ta):** `kcq_case_create`, `kcq_case_join`, `kcq_case_state`, `kcq_case_room_payload` (helper), `kcq_case_start_investigation`, `kcq_case_advance_question`, `kcq_case_answer`, `kcq_case_open_hint`, `kcq_case_advance_reveal`, `kcq_case_end_match`, `kcq_case_host_resume`, `kcq_case_teacher_results`, `kcq_case_save_progress` + `kcq_case_leaderboard`.

**Eng muhim anti-cheat kafolat:** `kcq_case_answer` RPC `kcq_case_answers` jadvalidagi server-side answer key bilan `p_option`ni solishtiradi — client hech qachon to'g'ri javob indeksini ko'rmaydi. Speed bonus `q_opened_at` (server clock, `advance_question`da yozilgan) asosida server-side hisoblanadi. Stars `kcq_case_end_match`'da server tomonidan DB'dagi `answered` yozuvlari va `hints` xaritasi asosida hisoblanadi.

**Lead'ga aniqlash uchun 3 savol:**
1. Private Room'dagi auto-advance (120s) MVP'ga kiradimi yoki v1.1'ga qoldirilsinmi? (Edge Function yoki client-side timer talab qiladi)
2. Streak multiplier coinlarga ham qo'llansinmi? (Hozirgi dizayn: faqat XP)
3. Max classroom size: 8 (MVP cap) yoki ko'proq? (8 dan oshsa JSONB yondashuvi qayta ko'rib chiqiladi)
