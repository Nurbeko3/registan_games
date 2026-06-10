# 06 — Development Roadmap — "Case Files"

> Author: Studio Lead. Synthesis of `00`–`05`. Status: **BUILDING — INC 1–3 ✅ · 4 ✅ (SQL, unapplied) · 5 ✅.**
>
> **Build log:**
> - ✅ **INC 1** (2026-06-09): `src/data/cases/{types,ranks,case01..05,index}.ts`,
>   `src/lib/caseLeveling.ts` + tests (`cases.test.ts`, `caseLeveling.test.ts`). 133 tests.
> - ✅ **INC 2** (2026-06-09): `useGame` extended — `caseAnswerCorrect`, `caseMatchEnd`,
>   6 new Snapshot fields, 6 achievement data entries + `cases` group. `useGame.cases.test.ts`
>   (16 tests). Full suite **465 green**, typecheck clean. Anti-farm delta, caseXp isolation,
>   and server-gated classroom-win (QA HIGH-02) all proven.
> - ✅ **INC 3** (2026-06-09): offline Bot Practice UI — **🚢 shippable milestone 1.**
>   `src/lib/caseFiles/{botEngine,grading}.ts` + tests (11). `src/components/ui/SegmentedTabs.tsx`,
>   `src/components/case/{docMeta,SourcesPane,QuestionPane,Scoreboard,CaseResultCard,ResultsScreen,
>   CaseEntry,BotPracticeScreen}.tsx`. Routes `/case` + `/case/practice`. Icons + i18n (uz/ru/en).
>   Landing carousel card added. Full suite **476 green**, typecheck clean, routes render HTTP 200
>   with real content. PNG export of the result card deferred (no new dep) — visual card ships.
> - ✅ **INC 4** (2026-06-09): `supabase/migrations/0011_case_files.sql` — 6 tables
>   (relational `kcq_case_players` for 35-student classrooms; tokens in a separate LOCKED
>   `kcq_case_player_tokens` table so the public scoreboard/Realtime never leak them), 13 RPCs +
>   2 helpers, RLS revoke-all + public-read, Realtime publication, leaderboard view, seed answer
>   keys. Applied **all QA fixes** (relational players, server-derived caseXp + case_id check in
>   `save_progress`, `max_players` 8/35, unique display name). Guard test `seed.test.ts` (21) proves
>   the SQL seed == TS source. Probe `scripts/qa-case-rpc.mjs`. Full suite **497 green**.
>   ⚠️ **SQL NOT yet applied** — no Supabase env this session + user gates builds/migrations. Apply
>   with `supabase db push`, then validate with `node scripts/qa-case-rpc.mjs`.
> - ✅ **INC 5** (2026-06-09): realtime binding. `src/lib/caseFiles/useCaseRoom.ts` (clone of
>   `useParty.ts`) — RPC-authoritative phase machine, relational players over `postgres_changes`,
>   server-scored answers, host-driven advance (no auto-timers), reveal + results host broadcasts,
>   host-refresh resume, cloud clients get the answer-stripped `publicCase`. `src/lib/caseFiles/cloud.ts`
>   (no-op offline). Free migration tweak: `kcq_case_advance_reveal` now returns `correct_option`.
>   Typecheck clean, 497 tests green. ⚠️ Not live-verifiable without Supabase env + applied `0011`.
> - ⏭ **INC 6** next: Friendly Room UI — create/join screens + wire `useCaseRoom` to the case
>   components (🚢 shippable milestone 2: multiplayer).
> Principle: each increment is **independently shippable, typecheck-clean, and testable**. We build
> the pure/testable core first (offline Bot Practice fully playable) before any realtime/cloud.

---

## Build order at a glance

```
INC 1  Data + content layer  ────────────┐  (pure, offline, fully tested)
INC 2  Store actions + economy ──────────┤  → Bot Practice shippable at end of INC 3
INC 3  Bot Practice UI (offline) ────────┘
INC 4  Migration 0011 (schema + RPCs) ───┐  (cloud; no client changes yet)
INC 5  useCaseRoom + Friendly Room  ─────┤  → multiplayer shippable at end of INC 6
INC 6  Friendly Room UI + result card ───┘
INC 7  Classroom Tournament (35, hub) ───┐  → classroom shippable
INC 8  Admin classroom + CSV + projector ┘
INC 9  Polish: dailies, ranks, achievements, i18n, a11y
```
Gate after each increment: `npm run typecheck` clean + relevant Vitest green.

---

## INC 1 — Data + content layer  *(pure, no UI, no cloud)*
**Files:** `src/data/cases/types.ts`, `L*/case01..05.ts`, `index.ts` (`CASES`, `getCase`),
`src/data/cases/ranks.ts` (`DETECTIVE_RANKS`), `src/lib/caseLeveling.ts` (`rankForCaseXp`, stars→XP).
- `Case`, `SourceDoc`, `Question` types per brief §3. **Answer keys live in the case data for now but
  are the SERVER seed** (INC 4 loads them into `kcq_case_answers`; they are NEVER imported into a
  client bundle path — keep them in a `server/`-only module or strip at build).
- 5 hand-authored seed cases across gradeBands; each with `evidenceSourceId` + `evidencePassage`.
- **Tests (`cases.test.ts`, mirror `levels.test.ts`):** every question has exactly one valid
  `answerIndex`, a real `evidenceSourceId`, gradeBand set, ≥1 cross-ref question, solvable.
- `caseLeveling.test.ts`: `rankForCaseXp` thresholds, stars→XP table.
**Done when:** content validated by tests; zero UI.

## INC 2 — Store actions + economy  *(pure, the anti-cheat/anti-farm core)*
**Files:** extend `src/store/useGame.ts` + `useGame.cases.test.ts`.
- Extend `Snapshot` with `caseXp, casesCompleted, cases3star, caseNoHintSolves, caseStreak,
  classroomCaseTournamentWins, lastCaseDay` (persisted via `partialize`).
- `caseAnswerCorrect(difficulty)` → per-answer XP/coins (15/3, streak ×1/×1.2/×1.5 on XP only).
- **`caseMatchEnd({ caseId, stars, mode, isClassroomConfirmed, placement, hintsUsed })`** —
  mirrors `codecasterComplete`: **anti-farm star-delta** on solve XP; per-answer XP always paid;
  `caseXp` is the isolated rank counter; increments `classroomCaseTournamentWins` **only when
  `isClassroomConfirmed` (server-derived, never a raw client flag)** [QA HIGH-02].
- `firstCaseOfDay()` via `lastCaseDay` (separate from `claimDaily`'s `lastDailyClaim`) [QA Low].
- Add 6 MVP achievement **data entries** to `src/data/achievements.ts` (evaluated, not granted).
**Tests:** anti-farm delta (replay pays only improvement, never downgrades); caseXp isolation
(Arena/Codecaster don't move it); classroom-win counter refuses client-only flag; daily once/day.
**Done when:** Vitest proves every economy/anti-farm rule. **This is the highest-priority increment.**

## INC 3 — Bot Practice UI  *(offline, no Supabase — ships a complete playable mode)*
**Files:** `src/lib/caseFiles/botEngine.ts`, `src/app/case/page.tsx` (mode select),
`/case/play` (offline), shared `components/case/*`: `SourcesPane`, `QuestionPane`,
extract `components/ui/SegmentedTabs.tsx` from Codecaster `PaneTab`, `Scoreboard`, `ResultsScreen`,
`ResultCard` (client-side PNG). New `IconName`s + i18n keys.
- Two-pane Sources|Question (desktop side-by-side / mobile toggle); **sources stay open during
  questions**. Reduced-motion + a11y. Bot speed bonus hidden [§9b].
- Bots: 3 by default, accuracy by gradeBand, never answer <8s.
**Done when:** a kid can play a full case offline end-to-end; XP/coins/rank update; result card exports.
**🚢 Shippable milestone 1: offline Bot Practice.**

## INC 4 — Migration `0011` (cloud schema + RPCs)  *(no client changes)*
**Files:** `supabase/migrations/0011_case_files.sql` (+ `0012` if split), `scripts/qa-case-rpc.mjs`.
- Tables: `kcq_case_rooms` (phase/`q_index`/`q_set`/`q_opened_at`/`is_classroom`/`max_players`/
  `host_token`/revision), **`kcq_case_players`** (relational — supersedes JSONB-per-player) [QA C-02],
  `kcq_case_answers` (server-only keys, `revoke all`), `kcq_case_progress`, `kcq_case_leaderboard`.
- 13 RPCs from `03`, **with QA fixes:** `kcq_case_save_progress` drops `p_case_xp`, **server-derives
  caseXp from stars + checks `case_id` exists** [QA C-01/03]; `kcq_case_join` enforces `max_players`
  (8/35) + **unique display name** [QA]; payload includes `streak` [QA]; question-order shuffle in
  `kcq_case_advance_question`/`q_set` build [QA → v1.0].
- House style: RLS revoke-all, `SECURITY DEFINER` + `set search_path`, realtime publication.
- Seed `kcq_case_answers` from the 5 cases (server-side load).
**Tests:** `scripts/qa-case-rpc.mjs` (mirror `qa-party-rpc.mjs`) — scoring contract, idempotency,
phase/host-token forgery, save-progress validation. **Run live against `.env.local`.**
**Done when:** RPC probe green; no client wired yet.

## INC 5 — `useCaseRoom` + Friendly Room netcode  *(realtime binding)*
**Files:** `src/lib/caseFiles/useCaseRoom.ts` (clone `useParty.ts`), `caseFiles/cloud.ts` (no-op
offline, mirror Codecaster `cloud.ts`).
- Presence+broadcast **mesh for ≤8 friendly**; phases `lobby|investigation|question|reveal|ended`;
  host resume from Postgres; `openHint`, `advanceReveal`, `answeredCount` (no names — privacy).
- All scoring via RPC; offline no-ops cleanly.
**Done when:** two tabs play a Friendly match cross-tab (LocalTransport) and cross-device (Supabase).

## INC 6 — Friendly Room UI  → **🚢 Shippable milestone 2: multiplayer**
Wire INC 3 components to `useCaseRoom`: create/join (`/case/[code]`), waiting room, investigation
countdown, live scoreboard, shared result. "Multiplayer requires a connection" gate [§9.4].

## INC 7 — Classroom Tournament (35-student hub-and-spoke)
- `useCaseRoom` **second path**: `is_classroom` → students subscribe to the single room row via
  Postgres Realtime, submit answers via RPC, **teacher is sole broadcaster** (§9a). No student
  presence mesh. Virtualized roster (`@tanstack/react-virtual`).
- Load-test 35-student answer burst [QA].

## INC 8 — Admin classroom flow + CSV + projector
`/admin/cases` + `/admin/cases/[code]`: <3-min setup (pick case → code → launch), teacher pacing
(no auto-advance), **`/case/[code]/display` projector route** [§9b], CSV export
(`kcq_case_teacher_results`). **🚢 Shippable milestone 3: classroom.**

## INC 9 — Polish
Daily case wiring (`nextStreak`), Detective rank badges everywhere, full achievement set,
uz/ru/en strings complete, a11y/reduced-motion pass, landing-page card in the `/` carousel.

---

## Fast-follow (v1.1) — explicitly NOT in this roadmap
Auto-advance timer (Edge Function), 4-of-6 question subset, streak-freeze token, classroom accuracy
heatmap, subject skill-track UI, server-replay validation of Bot Practice (`validated=true`).

## Post-MVP (v2) — Ranked (MMR), escape-room branching, teacher case editor, student host access.

---

## Critical path & risk
- **INC 1→2→3** is pure/offline — zero external dependency, ship Bot Practice first, de-risk the loop.
- **INC 4** is the schema decision point; the `kcq_case_players` table [QA C-02] must be right here.
- **Top risk remains operational, not technical:** the content pipeline (5 cases → weekly cadence),
  owned by the product owner.
