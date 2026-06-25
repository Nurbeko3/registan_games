# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⛔ HARD RULE — git & build are user-gated

**NEVER run `git commit`, `git push`, or any build (`npm run build`, `vercel`, deploys) unless the user explicitly orders it in the current conversation.** No exceptions: not "to be safe", not as part of "finishing" a task, and a go-ahead given for one piece of work does not carry over to the next. Leave changes in the working tree, verify with `npm run typecheck` + `npm test` only, then stop and report.

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
npm test          # vitest run (one-shot); npx vitest for watch mode
```

**No ESLint** is configured — both `npm run lint` and `npm run typecheck` just run `tsc --noEmit`. Typecheck is the primary correctness gate; run it after non-trivial changes. The `@/*` import alias maps to `src/*` (mirrored in `vitest.config.ts`).

Vitest (~320 tests, 24 files) covers the pure logic that's deliberately framework-free: leveling (`leveling.test.ts` + `caseLeveling.test.ts`), the `useGame` store (`useGame.test.ts` + `.shop` + `.codecaster` + `.cases` + `.progress`), the arena engine/`eventQueue`/`matchService`/`questionImport`, the **Case Files** logic (`src/lib/caseFiles/caseFiles.test.ts` + `src/data/cases/*.test.ts`, which prove every case is answerable and its trilingual i18n is complete), and the whole **Codecaster** layer (`src/lib/codecaster/*.test.ts` — engine, grading, errors, staticChecks, pyrunner; plus `src/data/codecaster/levels/levels.test.ts` which proves every level is solvable). Run one file with `npx vitest run src/lib/codecaster/engine.test.ts` (or `npx vitest -t "<name>"` for a single case). The React/UI layers are untested — keep new testable logic in the pure modules. Beyond Vitest+typecheck there are two live integration probes of the Postgres RPCs (each needs Supabase env in `.env.local`): `node scripts/qa-party-rpc.mjs` (Party) and `node scripts/qa-case-rpc.mjs` (Case Files).

### Supabase (optional)

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` to enable cloud. Migrations live in `supabase/migrations/`, applied in order with `supabase link --project-ref <ref> && supabase db push`:

- `0001` cloud save + leaderboard (`kcq_*`) · `0002` arena rooms (`arena_*`)
- `0003` student username/password accounts · `0004` admin (teacher) accounts, bcrypt — see Classroom/admin below
- `0005`–`0007` authoritative **Party** room state: match flow, host-refresh resume, and answers scored server-side in Postgres via RPC (clients can't score as another player)
- `0008`–`0009` authoritative **Arena** "match started" handshake + host-refresh resume, so joiners who miss a Realtime broadcast recover from Postgres
- `0010` **Codecaster** cloud progress/solves + leaderboard (`kcq_codecaster_*`), RLS revoke-all + `SECURITY DEFINER` RPCs. MVP trusts the client (`validated=false`) pending a future server-replay edge function
- `0011` authoritative **Case Files** multiplayer (`kcq_case_*`): RPC-driven phase machine, answer keys seeded server-side (clients get an answer-less projection), per-player score/streak in a relational table streamed over `postgres_changes`, match scored server-side
- `0012` admin-managed **Arena question bank** (`kcq_arena_questions`): trilingual + grade-tagged rows merged into the static pool at runtime, written via the `/admin/arena` Excel import

Note: live arena/party *gameplay* still runs over Realtime presence/broadcast; the tables are the canonical-state/recovery fallback, not the fast path.

## Architecture

### Single source of truth: `src/store/useGame.ts`

One Zustand store (persisted under key `kcq.v2`) holds **all** player progress: XP, coins, streaks, completed games, unlocked achievements/avatars/themes, locale, and lifetime arena stats. Key conventions:

- **Mutations are centralized as store actions**, not scattered in components. `completeGame(slug, stars)`, `arenaAnswerCorrect(difficulty)`, `arenaMatchEnd(...)`, `claimDaily()`, `buyAvatar/buyTheme`, `codecasterComplete(levelId, stars)`, etc. Each returns a result object (XP/coins awarded, level-ups, newly-unlocked achievements) that the UI uses to drive celebrations. Star-gated progress actions (`completeGame`, `codecasterComplete`) are **anti-farm**: replaying a level awards only the XP/coin *delta* of a star improvement and never downgrades.
- **Shop purchases are login-gated when cloud is on.** `buyAvatar`/`buyTheme` bail early via `purchasesLocked()` = `isCloudEnabled() && !hasStudentSession()` — so with Supabase configured you must be signed into a student account to spend coins (offline/no-Supabase keeps buying free). `hasStudentSession()` reads `localStorage['kcq.session']` inline to avoid a circular import with `src/lib/supabase/account.ts`; `/shop` mirrors the same gate in the UI and calls `accountSave()` after a successful buy.
- **Achievements are evaluated, never manually granted.** Actions build a draft state, call `buildSnapshot()`, then filter `ACHIEVEMENTS` by `a.check(snap)`. Each achievement is a pure `check(snapshot)` predicate in `src/data/achievements.ts`. To add an achievement, add a data entry — do not write granting logic.
- **Hydration safety**: `hydrated` and `celebrations` are transient (excluded via `partialize`). `onRehydrateStorage` flips `hydrated` once localStorage loads. Use `useHydrated()` and gate any locale/progress-dependent render on it to avoid SSR/client mismatch (see the i18n hooks for the pattern).
- Leveling/streak math is pure functions in `src/lib/leveling.ts` (`levelForXp`, `totalXpForLevel`, `nextStreak`). XP curve: `50*(L-1)*L`.

### Data-driven content: `src/data/`

Content is declarative and decoupled from rendering. `games.ts` holds game **metadata**; the playable component is wired separately in `src/components/games/registry.ts` (`GAME_REGISTRY` maps slug → component). Adding a mini-game = (1) implement a component satisfying the `GameProps` contract (`onWin(stars: 1|2|3)` — kept in its own `GameProps.ts` to avoid a circular import with `GameShell`), (2) register the slug, (3) add metadata to `GAMES`. Worlds/zones (`worlds.ts`), cosmetics (`cosmetics.ts`), arena questions/modes/maps, and offline hints (`hints.ts`) follow the same data-driven shape.

`src/data/hints.ts` `getHint()` is the **single seam** for plugging in a real AI/cloud mentor later; today "Byte" (`AIMentor.tsx`) is fully offline.

**Icons** are centralized in `src/components/ui/Icon.tsx` — one `IconName` union and an `ICON_REGISTRY: Record<IconName, LucideIcon>` mapping each name to a [`lucide-react`](https://lucide.dev) component. The whole app renders `<Icon name=… className=… />` (size via Tailwind `h-/w-` utilities, colour via `currentColor`); `gameIcon(slug)`/`worldIcon(slug)` map content slugs to `IconName`s. To add an icon: extend the `IconName` union and add the registry entry — the `Record` type makes a missing mapping a typecheck error. Don't reintroduce raw inline `<svg>` at call sites.

### Battle Learn Arena (`src/lib/arena/` + `src/components/arena/`)

A realtime top-down arena shooter where elimination opens a "Learning Pod" — answering a coding question correctly respawns you. Layered design:

- **`engine.ts`** — framework-free, deterministic-ish game simulation (movement, bullets, HP, 4-personality bot AI). No React. Designed to be unit-testable and eventually run authoritatively. `step()` optionally emits effects (`effects.ts`) and accumulates sound events (`audio.ts`) for the presentation layer.
- **`network/realtime.ts`** — `Transport` abstraction with two backings: `SupabaseTransport` (Realtime channel: presence + broadcast, real cross-device) and `LocalTransport` (`BroadcastChannel`, cross-tab on one device, zero backend). Selected by `isCloudEnabled()`. The transport only moves messages.
- **`network/roomService.ts`** — lobby orchestration on top of the transport (presence → player list, host broadcasts settings + start, ready/team toggles). Two host models: custom rooms have a fixed host (creator); quick-match **elects** the lowest-present id as host.
- **`network/useArenaRoom.ts`** — the React binding: connects on mount, exposes live `RoomState` + lobby actions, leaves on unmount.
- **`network/matchService.ts` + `eventQueue.ts`** — the in-match netcode (powers embodied 1v1 multiplayer). During play it ships only **events** (`MOVE`/`SHOOT`/`HIT`/`RESPAWN`/`ANSWERED`/`SCORE`/`MATCH_END`), never full state: `OutboundQueue` coalesces `move` (latest-wins) and batches the rest, flushed at a fixed ~12 Hz over the **same** transport/channel as the room. Persistence to `arena_matches`/`arena_match_events` is cloud-only and never blocks gameplay.
- **`questionEngine.ts` + `localize.ts` + the question bank** — questions are the **trilingual** `LocalizedQuestion` shape (`prompt`/`options`/`explain` each carry `uz`/`ru`/`en`) and are also `grade`-tagged (1–11 Uzbek school class, orthogonal to `difficulty`, which still drives matchmaking). The static bank is `src/data/arenaQuestions.ts` (`ARENA_QUESTIONS_L10N`); admin-imported rows (`cloudQuestions.ts`, migration 0012) share the exact shape and merge in. `localize()` flattens one locale into the runtime question; `questionEngine.ts` scales difficulty to player level, avoids repeats, and **re-shuffles option order every time** (anti-cheat-by-memorization). `questionImport.ts` parses the trilingual Excel upload for `/admin/arena` — **no AI translation**, the spreadsheet carries all three languages.

The presence+broadcast pattern originated in `src/lib/party/useParty.ts` (a simpler shared-quiz "party" feature) and was lifted into the arena services — keep them consistent.

### Codecaster — Code Dungeon (`src/lib/codecaster/` + `src/data/codecaster/` + `src/components/codecaster/`)

A CodeCombat-style (but fully original) two-pane Python learning game: a dungeon world on the left, a Python editor on the right. The hero executes real Python (`hero.moveRight()`, `hero.attack()`, …) and the moves replay step-by-step. Reachable at `/quest` (level select) → `/quest/[level]` (play). Layered like the arena, and **server-replay-authoritative**:

- **`engine.ts`** — `DungeonEngine`, a pure framework-free grid simulation (hero move/attack/collect/useKey/say + sensors, enemy/trap phases, win-before-lose ordering). Never mutates the input `LevelDef`. `runActions()` and `gradeRun()` make it re-runnable. This is the canonical authority.
- **`pyrunner/`** — runs student Python via **Skulpt** (`public/skulpt/*`, served locally so it works offline) inside a **Web Worker** with `Sk.execLimit` for infinite-loop protection; `protocol.ts` is the worker contract, with a `MainThreadRunner` fallback. `createRunner()` is the factory.
- **`grading.ts`** — turns a finished run into 0–3 stars. **Anti-cheat by replay**: it ignores the client-claimed `status` and re-runs the `actions` trace through `DungeonEngine`, so a client lying about a win gets 0 stars. Third star requires `parSteps` met + the level's target concept demonstrated + zero hints. The "concept gate" mixes static code analysis (`staticChecks.ts` → `analyzePython`) and behavioural checks on the realized trace.
- **`errors.ts`** — `explainError(PyError)` maps Skulpt errors to kid-friendly i18n keys (`cc.err.*`).
- **`cloud.ts`** — save/load/leaderboard, all no-op offline (mirrors the arena cloud pattern; backed by migration `0010`).
- **Content** lives in `src/data/codecaster/levels/L01..L10.ts` (`CODECASTER_LEVELS` + `getLevel(id)`); each level is a `CodecasterLevel` with `parSteps`, `requireConcept`, `starterCode`, and a 3-hint ladder. Adding a level = add an `L*.ts` proven solvable by a `Command[]` trace in `levels.test.ts`, then export it from `index.ts`. L10 is the boss.
- **UI**: `PlayScreen.tsx` composes `DungeonView` + `CodePane` (CodeMirror via `next/dynamic({ ssr: false })`) + `MissionPanel` + `FeedbackModal`. Responsive: side-by-side on desktop, a `[World | Code]` segmented toggle on mobile; honours reduced-motion.

### Case Files — detective reading mode (`src/lib/caseFiles/` + `src/data/cases/` + `src/components/case/`)

A multiplayer reading-comprehension detective game: each **case** is a set of *fictional* source documents (profile cards, chat logs, emails, notes, tickets — no real people or personal data) plus questions answered by reading and cross-referencing them. Reachable at `/case` (lobby) with `/case/friendly`, `/case/practice` (offline Bot Practice), `/case/[code]` (room), and `/case/[code]/display` (classroom projector view). Modeled on the Party feature and **server-authoritative** like it:

- **Content** is data-driven in `src/data/cases/case01..05.ts` (`CaseDef` + `getCase(id)`), grade-banded (`7-9`/`10-12`/`13-14`) and subject-tagged. The `answerIndex` keys live in the `CaseDef`; the cloud ships clients an **answer-less `publicCase()` projection** so devtools can't peek. Trilingual copy is split into `src/data/cases/i18n/` and applied with `localizeCase()`. Tests prove every case is answerable (`cases.test.ts`/`seed.test.ts`) and every translation is complete (`i18n/i18n.test.ts`).
- **`grading.ts`** — pure offline grader used by Bot Practice; it's the **mirror**, not the authority. In cloud play the same rubric is recomputed server-side (`kcq_case_end_match`, migration 0011) so a client can't self-report. Star/XP math is in `caseLeveling.ts` (`caseStarsFor`, detective ranks in `ranks.ts`).
- **`botEngine.ts`** — drives offline Bot Practice opponents.
- **`useCaseRoom.ts`** — the React realtime binding (cloned from `useParty.ts`): an RPC-authoritative phase machine (`lobby→investigation→question→reveal→ended`, host-driven, no auto-advance in MVP), per-player score/streak streamed over `postgres_changes` (relational table, scales to a classroom — **not** presence), and the just-closed question's correct option delivered via the host's `reveal` broadcast.
- **`cloud.ts`** — save/leaderboard, no-op offline.
- Progress is recorded through `useGame` (`useGame.cases.test.ts`).

### Cloud is strictly additive

`src/lib/supabase/client.ts` returns `null` when env vars are missing or on the server, and **never throws**. All of `src/lib/supabase/*` (auth, leaderboard, sync) and the arena cloud transport must degrade silently to offline/local behavior. Never make a core game path depend on `supabase` being non-null.

### Classroom / admin (`src/lib/admin/`, `src/app/admin`, `src/app/api/admin/*`)

The only **server-side** part of the app — a teacher-facing classroom layer that's also strictly additive (dead without Supabase env). `src/lib/admin/server.ts` is server-only (imports `next/headers`): admins (`kcq_admins`, bcrypt) and student accounts (migrations 0003/0004) live in Supabase; the `kcq_admin` cookie carries a DB-issued session token validated on **every** request by `kcq_admin_*` RPCs through the anon-key client — no secrets reach the client bundle. `requireAdmin()` is the gate for the API route handlers (`login`/`logout`/`me`/`admins`/`students` + `students/import` and `students/reset`, plus `arena-questions` and `arena-questions/[id]` for the trilingual question-bank CRUD/import). Student roster and arena-question import/export both use `xlsx`. Keep all `requireAdmin()`-gated logic and secrets in `server.ts`/route handlers, never in client components.

### Server API routes (`src/app/api/`)

Two groups, both no-op without their env: the admin routes above, and `api/arena/authority` — a health probe (gated by `ARENA_AUTHORITY_ENABLED`/`ARENA_AUTHORITY_STATUS_URL`) for an **optional** external authoritative arena server. When disabled (the default), arena stays peer/host-authoritative over Realtime as described above.

### i18n (`src/lib/i18n/`)

Three locales — **`uz` (Uzbek, default)**, `ru`, and `en` (`Locale = 'uz' | 'ru' | 'en'` in `config.ts`); `translations.ts` is the trilingual dictionary. Translate via the `useT()` hook → `t(key, vars?)`. Before hydration it forces `DEFAULT_LOCALE` so SSR and first paint match, then switches to the persisted locale. Add strings to `translations.ts`.

### Routing (`src/app/`)

App Router. Notable routes: `/` (landing — the "extra game modes" section is a snap carousel of Arena/Party/Codecaster/Case-Files cards), `/map` (world map), `/play/[game]` (delegates to `GameShell`), `/quest` + `/quest/[level]` (Codecaster level select + play), `/case` + `/case/friendly` + `/case/practice` + `/case/[code]` + `/case/[code]/display` (Case Files lobby/bot-practice/room/projector), `/rewards` (profile/achievements/settings), `/shop` (avatar/theme store, split out from `/rewards`), `/arena`, `/leaderboard`, `/party` + `/party/[code]`, `/admin` (teacher classroom UI, gated by the admin cookie). Dynamic route params are React 19 `Promise`s — unwrap with `use(params)`. App-wide chrome (theme, reduced-motion) is in `AppChrome.tsx`; HUD in `layout/TopBar.tsx`.
