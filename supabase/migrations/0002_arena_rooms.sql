-- ════════════════════════════════════════════════════════════════════
--  Battle Learn Arena — multiplayer rooms (optional persistence)
--  Apply:  supabase link --project-ref <ref> && supabase db push
--
--  NOTE: live gameplay runs over Supabase Realtime presence+broadcast and
--  needs NO tables. These arena_* tables are for room persistence, reconnect
--  and optional match replay/analytics. Namespaced to coexist with kcq_*.
-- ════════════════════════════════════════════════════════════════════

-- ── rooms ────────────────────────────────────────────────────────────
create table if not exists public.arena_rooms (
  code        text primary key,                         -- 6-digit join code
  host_id     uuid references auth.users(id) on delete set null,
  settings    jsonb       not null default '{}'::jsonb,  -- RoomSettings
  status      text        not null default 'lobby',      -- lobby | playing | ended
  created_at  timestamptz not null default now()
);

alter table public.arena_rooms enable row level security;

drop policy if exists "arena_rooms_read" on public.arena_rooms;
create policy "arena_rooms_read" on public.arena_rooms
  for select using (true);                               -- joinable by code

drop policy if exists "arena_rooms_insert" on public.arena_rooms;
create policy "arena_rooms_insert" on public.arena_rooms
  for insert with check (auth.uid() = host_id);

drop policy if exists "arena_rooms_host_update" on public.arena_rooms;
create policy "arena_rooms_host_update" on public.arena_rooms
  for update using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- ── room players ─────────────────────────────────────────────────────
create table if not exists public.arena_room_players (
  room_code  text references public.arena_rooms(code) on delete cascade,
  player_id  uuid not null,
  name       text,
  avatar     text,
  team       text not null default 'red',               -- red | blue
  is_host    boolean not null default false,
  joined_at  timestamptz not null default now(),
  primary key (room_code, player_id)
);

alter table public.arena_room_players enable row level security;

drop policy if exists "arena_players_read" on public.arena_room_players;
create policy "arena_players_read" on public.arena_room_players
  for select using (true);

drop policy if exists "arena_players_own_write" on public.arena_room_players;
create policy "arena_players_own_write" on public.arena_room_players
  for all using (auth.uid() = player_id) with check (auth.uid() = player_id);

-- ── matches ──────────────────────────────────────────────────────────
create table if not exists public.arena_matches (
  id          uuid primary key default gen_random_uuid(),
  room_code   text references public.arena_rooms(code) on delete set null,
  mode        text,
  map         text,
  won_team    text,                                      -- red | blue | null (draw)
  red_score   integer not null default 0,
  blue_score  integer not null default 0,
  ended_at    timestamptz not null default now()
);

alter table public.arena_matches enable row level security;

drop policy if exists "arena_matches_read" on public.arena_matches;
create policy "arena_matches_read" on public.arena_matches
  for select using (true);

drop policy if exists "arena_matches_insert" on public.arena_matches;
create policy "arena_matches_insert" on public.arena_matches
  for insert with check (auth.role() = 'authenticated');

-- ── match events (optional replay / audit stream) ────────────────────
create table if not exists public.arena_match_events (
  id        bigint generated always as identity primary key,
  match_id  uuid references public.arena_matches(id) on delete cascade,
  ts        timestamptz not null default now(),
  type      text not null,                               -- move | shoot | hit | respawn | answered | score | match_end
  payload   jsonb not null default '{}'::jsonb
);

alter table public.arena_match_events enable row level security;

drop policy if exists "arena_events_read" on public.arena_match_events;
create policy "arena_events_read" on public.arena_match_events
  for select using (true);

drop policy if exists "arena_events_insert" on public.arena_match_events;
create policy "arena_events_insert" on public.arena_match_events
  for insert with check (auth.role() = 'authenticated');

create index if not exists arena_match_events_match_idx on public.arena_match_events (match_id, ts);
