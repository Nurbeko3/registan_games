# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**KidsCode Quest** (package name `kidscode-quest`) — an offline-first educational game platform teaching kids 7–14 to code through play. Next.js 15 (App Router) · React 19 · TypeScript · TailwindCSS · Zustand · Framer Motion.

The core game is **frontend-only**: no backend, no auth, no database required. Progress lives in `localStorage`. Supabase is **optional** and additive — it powers cloud save, a leaderboard, and the realtime multiplayer "Battle Learn Arena". When Supabase env vars are absent, every cloud feature must no-op gracefully and the game keeps working.

## Commands

```bash
npm run dev       # dev server on http://localhost:3000
npm run build     # production build
npm run start     # serve production build on :3000
npm run lint      # ALIAS for tsc --noEmit (NOT next lint, despite the name)
npm run typecheck # tsc --noEmit (identical to lint)
```

There is **no test runner** and **no ESLint** configured. Both `npm run lint` and `npm run typecheck` just run `tsc --noEmit` — that single typecheck is the only correctness gate; run it after non-trivial changes. The `@/*` import alias maps to `src/*`. The one runnable check beyond typecheck is `node scripts/qa-party-rpc.mjs`, a live integration probe of the Party Postgres RPCs (needs Supabase env in `.env.local`).

### Supabase (optional)

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` to enable cloud. Migrations live in `supabase/migrations/`, applied in order with `supabase link --project-ref <ref> && supabase db push`:

- `0001` cloud save + leaderboard (`kcq_*`) · `0002` arena rooms (`arena_*`)
- `0003` student username/password accounts · `0004` admin (teacher) accounts, bcrypt — see Classroom/admin below
- `0005`–`0007` authoritative **Party** room state: match flow, host-refresh resume, and answers scored server-side in Postgres via RPC (clients can't score as another player)
- `0008`–`0009` authoritative **Arena** "match started" handshake + host-refresh resume, so joiners who miss a Realtime broadcast recover from Postgres

Note: live arena/party *gameplay* still runs over Realtime presence/broadcast; the tables are the canonical-state/recovery fallback, not the fast path.

## Architecture

### Single source of truth: `src/store/useGame.ts`

One Zustand store (persisted under key `kcq.v2`) holds **all** player progress: XP, coins, streaks, completed games, unlocked achievements/avatars/themes, locale, and lifetime arena stats. Key conventions:

- **Mutations are centralized as store actions**, not scattered in components. `completeGame(slug, stars)`, `arenaAnswerCorrect(difficulty)`, `arenaMatchEnd(...)`, `claimDaily()`, `buyAvatar/buyTheme`, etc. Each returns a result object (XP/coins awarded, level-ups, newly-unlocked achievements) that the UI uses to drive celebrations.
- **Achievements are evaluated, never manually granted.** Actions build a draft state, call `buildSnapshot()`, then filter `ACHIEVEMENTS` by `a.check(snap)`. Each achievement is a pure `check(snapshot)` predicate in `src/data/achievements.ts`. To add an achievement, add a data entry — do not write granting logic.
- **Hydration safety**: `hydrated` and `celebrations` are transient (excluded via `partialize`). `onRehydrateStorage` flips `hydrated` once localStorage loads. Use `useHydrated()` and gate any locale/progress-dependent render on it to avoid SSR/client mismatch (see the i18n hooks for the pattern).
- Leveling/streak math is pure functions in `src/lib/leveling.ts` (`levelForXp`, `totalXpForLevel`, `nextStreak`). XP curve: `50*(L-1)*L`.

### Data-driven content: `src/data/`

Content is declarative and decoupled from rendering. `games.ts` holds game **metadata**; the playable component is wired separately in `src/components/games/registry.ts` (`GAME_REGISTRY` maps slug → component). Adding a mini-game = (1) implement a component satisfying the `GameProps` contract (`onWin(stars: 1|2|3)` — kept in its own `GameProps.ts` to avoid a circular import with `GameShell`), (2) register the slug, (3) add metadata to `GAMES`. Worlds/zones (`worlds.ts`), cosmetics (`cosmetics.ts`), arena questions/modes/maps, and offline hints (`hints.ts`) follow the same data-driven shape.

`src/data/hints.ts` `getHint()` is the **single seam** for plugging in a real AI/cloud mentor later; today "Byte" (`AIMentor.tsx`) is fully offline.

### Battle Learn Arena (`src/lib/arena/` + `src/components/arena/`)

A realtime top-down arena shooter where elimination opens a "Learning Pod" — answering a coding question correctly respawns you. Layered design:

- **`engine.ts`** — framework-free, deterministic-ish game simulation (movement, bullets, HP, 4-personality bot AI). No React. Designed to be unit-testable and eventually run authoritatively. `step()` optionally emits effects (`effects.ts`) and accumulates sound events (`audio.ts`) for the presentation layer.
- **`network/realtime.ts`** — `Transport` abstraction with two backings: `SupabaseTransport` (Realtime channel: presence + broadcast, real cross-device) and `LocalTransport` (`BroadcastChannel`, cross-tab on one device, zero backend). Selected by `isCloudEnabled()`. The transport only moves messages.
- **`network/roomService.ts`** — lobby orchestration on top of the transport (presence → player list, host broadcasts settings + start, ready/team toggles). Two host models: custom rooms have a fixed host (creator); quick-match **elects** the lowest-present id as host.
- **`network/useArenaRoom.ts`** — the React binding: connects on mount, exposes live `RoomState` + lobby actions, leaves on unmount.
- **`network/matchService.ts` + `eventQueue.ts`** — the in-match netcode (powers embodied 1v1 multiplayer). During play it ships only **events** (`MOVE`/`SHOOT`/`HIT`/`RESPAWN`/`ANSWERED`/`SCORE`/`MATCH_END`), never full state: `OutboundQueue` coalesces `move` (latest-wins) and batches the rest, flushed at a fixed ~12 Hz over the **same** transport/channel as the room. Persistence to `arena_matches`/`arena_match_events` is cloud-only and never blocks gameplay.

The presence+broadcast pattern originated in `src/lib/party/useParty.ts` (a simpler shared-quiz "party" feature) and was lifted into the arena services — keep them consistent.

### Cloud is strictly additive

`src/lib/supabase/client.ts` returns `null` when env vars are missing or on the server, and **never throws**. All of `src/lib/supabase/*` (auth, leaderboard, sync) and the arena cloud transport must degrade silently to offline/local behavior. Never make a core game path depend on `supabase` being non-null.

### Classroom / admin (`src/lib/admin/`, `src/app/admin`, `src/app/api/admin/*`)

The only **server-side** part of the app — a teacher-facing classroom layer that's also strictly additive (dead without Supabase env). `src/lib/admin/server.ts` is server-only (imports `next/headers`): admins (`kcq_admins`, bcrypt) and student accounts (migrations 0003/0004) live in Supabase; the `kcq_admin` cookie carries a DB-issued session token validated on **every** request by `kcq_admin_*` RPCs through the anon-key client — no secrets reach the client bundle. `requireAdmin()` is the gate for the API route handlers (`login`/`logout`/`me`/`admins`/`students` + `students/import` and `students/reset`). Student roster import/export uses `xlsx`. Keep all `requireAdmin()`-gated logic and secrets in `server.ts`/route handlers, never in client components.

### Server API routes (`src/app/api/`)

Two groups, both no-op without their env: the admin routes above, and `api/arena/authority` — a health probe (gated by `ARENA_AUTHORITY_ENABLED`/`ARENA_AUTHORITY_STATUS_URL`) for an **optional** external authoritative arena server. When disabled (the default), arena stays peer/host-authoritative over Realtime as described above.

### i18n (`src/lib/i18n/`)

Default locale is **`uz` (Uzbek)**; `en` is the fallback dictionary. Translate via the `useT()` hook → `t(key, vars?)`. Before hydration it forces `DEFAULT_LOCALE` so SSR and first paint match, then switches to the persisted locale. Add strings to `translations.ts`.

### Routing (`src/app/`)

App Router. Notable routes: `/` (landing), `/map` (world map), `/play/[game]` (delegates to `GameShell`), `/rewards` (profile/achievements/shop/settings), `/arena`, `/leaderboard`, `/party` + `/party/[code]`, `/admin` (teacher classroom UI, gated by the admin cookie). Dynamic route params are React 19 `Promise`s — unwrap with `use(params)`. App-wide chrome (theme, reduced-motion) is in `AppChrome.tsx`; HUD in `layout/TopBar.tsx`.
