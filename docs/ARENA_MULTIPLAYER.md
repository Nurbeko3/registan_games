# ⚔️ Battle Learn Arena — Multiplayer & Host System

> Mission: turn the offline bot arena into a **hybrid** arena — Practice vs Bots · Online Multiplayer · Custom Rooms — **without rebuilding** the engine. Extend cleanly.

---

## PART A — ANALYSIS

### A1. What can be reused (the big wins)

The codebase **already ships a working realtime room system** — `src/lib/party/useParty.ts` + `src/app/party/[code]`. It is the blueprint:

- **One Supabase channel per room** (`supabase.channel('kcq-room-<code>')`).
- **Presence** → live player list + per-player state (name, avatar, score, isHost). Exactly what a lobby needs.
- **Broadcast** → host drives phase transitions (start / question / reveal / end). Exactly what match flow needs.
- **Zero DB tables** — rooms are ephemeral, like a party game. Cheap, fast, no migrations in the hot path.
- **Offline-first seam** — `src/lib/supabase/client.ts` (`supabase` nullable, `isCloudEnabled()`), anonymous auth, graceful "needs internet" degradation. **Nothing throws when cloud is off.**

Also reusable as-is:
- `engine.ts` `step()` — already pure and accepts external input; humans and bots are the same `Fighter` shape (the spec's "same engine, same rules" is already true).
- `createWorld(perTeam, hero, obstacles?)` — **already** accepts custom obstacle layouts (added in the game-feel pass), so per-room maps drop in.
- Learning Pod, question engine, XP/achievements, MatchResults — all unchanged.

### A2. What must change

- **Entry point.** `app/arena/page.tsx` is a single lobby. It becomes an **ArenaMenu** (Practice / Online / Create / Join) that routes into the right flow.
- **Fighter ownership.** Today fighter[0] is the hero, the rest are host-simulated bots. Online, each **human owns their own hero** and the **host owns the bots** + scoring. Engine needs a way to drive a fighter from network input instead of local input (a thin seam — `Fighter` already has the fields).
- **Bot-fill.** Match builder must create `perTeam*2` slots, seat humans first, fill the rest with bots.
- **Difficulty.** Practice needs Easy/Medium/Hard/Expert → scale bot skill (cooldown / spread / speed). New `Fighter.skill` field.

### A3. Multiplayer risks

| Risk | Mitigation |
|------|------------|
| No backend provisioned | Everything degrades gracefully (`isCloudEnabled()`); Practice always works. A `LocalTransport` (BroadcastChannel) lets the room flow run cross-tab on one device for dev/testing. |
| Host leaves mid-match | Host migration: presence picks the lowest-id remaining player as new host (Phase 3). |
| Cheating (fake respawns) | Learning Pod is **local**; only a `respawn` *event* is broadcast after a correct answer. Host validates score deltas (Phase 3). |
| Players on different app versions | Room settings carry a `v` field; mismatched clients are rejected at join. |

### A4. Sync risks & the SYNC MODEL

**Decision: event-based presence + broadcast — never ship full game state.** This matches the spec ("send only events") and the proven party pattern.

- **Lobby:** Presence (player list, team, ready, settings echo).
- **In match — distributed ownership:**
  - Each human broadcasts **only their own hero**: `move` (throttled to ~12 Hz, latest-wins), `shoot`, `respawn`. ~12 small msgs/sec/player.
  - The **host** simulates bots locally and broadcasts their pooled state at ~10 Hz, plus authoritative `score` / `match_end`.
  - Remote fighters are **interpolated** between the last two `move` packets (smooth on screen, low bandwidth).
  - `hit` is resolved **locally by the shooter's owner** and sent as an event (good enough for a friendly kids' game; host reconciles score).
- **Why not host-authoritative full sim?** It triples bandwidth and adds input-lag for remote players. Distributed ownership is the Brawl-Stars-class choice for this scale (≤20 fighters).

### A5. Performance risks

- Throttle/coalesce `move` (latest-wins) in an **`EventQueue`** so movement never floods the channel.
- Interpolate remote fighters (no per-frame network reads in the render path).
- Supabase Realtime free tier handles this easily at ≤10 players/room.

### A6. Database design

The hot path needs **no tables** (presence + broadcast are ephemeral). Tables are for **persistence/analytics/reconnect**, namespaced `arena_*` to coexist with `kcq_*`:

```
arena_rooms        (code PK, host_id, settings jsonb, status, created_at)
arena_room_players (room_code FK, player_id, name, avatar, team, is_host, joined_at)
arena_matches      (id PK, room_code, mode, map, won_team, red_score, blue_score, ended_at)
arena_match_events (id PK, match_id FK, ts, type, payload jsonb)  -- optional replay/audit
```

Migration shipped (not applied): `supabase/migrations/0002_arena_rooms.sql`.

---

## PART B — ROADMAP

| Phase | Scope | Status |
|-------|-------|--------|
| **M1** | **ArenaMenu** (Practice / Online / Create / Join) + **Practice upgrade** (difficulty + map + team size). 5 maps. Engine difficulty seam. | **THIS PASS** ✅ verifiable offline |
| **M2** | **Network foundation** — `network/{types,eventQueue,realtime,roomService,matchService}.ts` + `useArenaRoom` hook (Supabase + Local transports). **Room lobby UI** — CreateRoom, JoinRoom, RoomLobby, PlayerList, ReadyPanel, ConnectionStatus. DB migration. | **THIS PASS** ✅ compiles; lobby works vs Supabase / cross-tab |
| **M3** | **In-match netcode** — drive remote fighters from `move/shoot/respawn` events, host bot authority + score reconciliation, bot-fill seating, interpolation. Persist `arena_matches`/`arena_match_events`. | **NEXT** — needs a provisioned Supabase project + 2 clients to verify |
| **M4** | **Matchmaking** (quick match into open rooms), host migration, anti-cheat score validation. | next |

**This pass = M1 + M2.** It delivers the menu, a fully-playable upgraded Practice mode, and the complete room/lobby system on the proven realtime pattern. The in-engine cross-client fighter sync (M3) is wired as a clean seam but deliberately **not claimed as verified** — it can't be, without provisioning + two devices.

---

## PART C — WHAT SHIPPED THIS PASS

- `data/arenaMaps.ts` — 5 maps: Training Facility, Tech Lab, Cyber City, AI Factory, Algorithm Temple (cover / chokepoints / flank routes).
- `engine.ts` — `Fighter.skill` + `ArenaDifficulty` seam (Easy/Medium/Hard/Expert) scaling bot cooldown / spread / speed; `createWorld(perTeam, hero, obstacles?, difficulty?)`.
- `lib/arena/network/` — `types.ts`, `eventQueue.ts`, `realtime.ts` (`SupabaseTransport` + `LocalTransport` + `createTransport`), `roomService.ts`, `matchService.ts`.
- `lib/arena/network/useArenaRoom.ts` — React hook (presence-backed lobby, host settings, ready, countdown).
- UI: `ArenaMenu`, `PracticeSetup`, `CreateRoomModal`, `JoinRoomModal`, `RoomLobby`, `PlayerList`, `ReadyPanel`, `ConnectionStatus`.
- `app/arena/page.tsx` — rewired to the menu → Practice / room flows.
- `supabase/migrations/0002_arena_rooms.sql` (not applied).

**Existing Practice gameplay, party system, XP and achievements are untouched.**
