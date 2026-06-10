# Studio Brief — "Find Info About Me" (working title: **Case Files**)

> Canonical shared context for all specialist agents. Read this before producing any artifact.
> Author: Studio Lead. Status: **SCOPE-LOCKED (2026-06-09).**
>
> **Locked decisions:**
> 1. **Content framing = FICTIONAL CASE FILES.** No real people, no real personal data.
>    Working title **"Case Files."** Educational pillar = reading comprehension + evidence
>    evaluation + cross-referencing sources.
> 2. **MVP modes = Bot Practice + Private/Friendly Room + Classroom Tournament.**
>    Ranked (MMR) and Escape-Room branching are fast-follows, explicitly OUT of MVP.
> 3. **Process = sequential agent waves**, dependency-ordered against this brief.

---

## 0. One-line definition

A **multiplayer reading-detective game**: players read a small set of **source documents**
(a character profile card, a chat log, an email, a note) and answer questions whose answers are
*found by reading and cross-referencing the sources*. Kahoot-style live competition, but the
"speed" is replaced by **comprehension + evidence-finding**.

It is, mechanically, an **authoritative multiplayer quiz where every question is grounded in
a document the player must actually read.** Everything else (escape-room branching, story arcs)
is a content/skin layer on top of that spine.

---

## 1. STUDIO LEAD PUSHBACK — read this first (we do not blindly agree)

### �down 1.1 The name + "personal data" framing is a real problem for a kids' product
"**Find Info About Me**" + "investigate **profiles, emails, chats, cards**" describes, almost
exactly, the behavior we should be teaching 7–14-year-olds **never** to do: snooping through
someone's personal profile/email/messages to extract personal information. For a platform whose
"highest priority is educational value," shipping a game that gamifies surveillance of personal
data is off-brand and a safeguarding risk.

**Decision required → recommended fix:** keep the *mechanic*, change the *framing*.
- Investigate **fictional case files** — invented characters, made-up mysteries, historical/science
  "mysteries," literary comprehension passages. **Never real people, never real personal data.**
- The educational pillar becomes **reading comprehension, evidence evaluation, and
  cross-referencing sources** — genuinely valuable, testable skills.
- Working title **"Case Files"** / "Detective Academy" / "Clue Quest" instead of
  "Find Info About Me."

### 🟡 1.2 Five genres at once = scope explosion
Kahoot + Quizizz + Detective + Escape Room + Duolingo is five products. MVP must pick **one
spine** (authoritative multiplayer quiz with document-grounded questions) and treat escape-room
branching, story progression, and Duolingo streak-trees as **post-MVP layers**.

### 🟡 1.3 "Read fast, answer fast" is anti-educational if scored naively
Pure speed scoring (Kahoot) rewards fast readers and punishes the careful readers who actually
comprehend — the opposite of our goal. **Scoring must be accuracy-first**: correct answer is the
bulk of the points; speed is a *small, capped* bonus and a *tiebreaker only*. Reading time itself
is never penalized (an "I'm still reading" investigation phase precedes the timed answer).

### 🟡 1.4 Five game modes at launch is too many
Ranked needs an MMR system + mature anti-cheat before it's safe. MVP ships the low-risk modes;
Ranked + full escape-room are fast-follows.

### 🟡 1.5 Answer-peeking is the #1 exploit
If correct answers ship to the client, kids open devtools and win. **Non-negotiable:** questions
ship *without* the correct-answer flag; answers are submitted and scored **server-side via RPC**,
exactly as Party already does in migration `0007`. Clue/document text may be client-side; the
answer key may not.

---

## 2. REUSE MAP — build on the existing stack, do not reinvent

| Need | Reuse from | New artifact |
|---|---|---|
| Realtime room (presence + broadcast) | `src/lib/party/useParty.ts` | `useCaseRoom.ts` (same presence→players, host-broadcasts-flow pattern) |
| Transport abstraction (Supabase ↔ local BroadcastChannel fallback) | `src/lib/arena/network/realtime.ts` | reuse `Transport` directly |
| **Authoritative match state + server-scored answers** | migrations `0005`–`0007` (`kcq_party_rooms`, per-room player tokens, RPC scoring, host-refresh resume) | `kcq_case_rooms` + `kcq_case_*` RPCs (near-clone) |
| Host-refresh resume from Postgres | `0006` / `0009` pattern | same |
| Player progress / XP / coins / achievements | `src/store/useGame.ts` (centralized actions, anti-farm delta, data-driven achievements) | `caseAnswerCorrect()`, `caseMatchEnd()` actions + achievement *data* entries |
| Teacher tournaments | `src/lib/admin/*` + `src/app/admin` (requireAdmin, rosters) | classroom case-tournament room type |
| Leaderboard | `src/lib/supabase/leaderboard.ts` + `0001` | extend |
| Content as data | `src/data/games.ts` pattern | `src/data/cases/*` (`CASES`, `getCase(id)`) |
| Icons / i18n | `src/components/ui/Icon.tsx`, `src/lib/i18n` (uz default) | extend unions/dictionaries only |

**Principle:** the safest fast path is "Party, but each question is attached to a document set."
If a design choice diverges from the Party authoritative pattern, justify why.

---

## 3. CONTENT MODEL (data-driven)

```
Case
 ├─ id, title, gradeBand (7-9 | 10-12 | 13-14), subject (reading | history | science | logic)
 ├─ briefing: short setup ("A museum artifact is missing. Read the files.")
 ├─ sources: SourceDoc[]            // FICTIONAL only
 │     └─ { kind: 'profileCard'|'chatLog'|'email'|'note'|'ticket', title, body }
 └─ questions: Question[]
       └─ { id, prompt, choices[], answerIndex (SERVER-ONLY), evidenceSourceId, concept }
```
Every `Question.answerIndex` lives **server-side only**. `evidenceSourceId` powers the
post-answer "here's where the answer was" teaching moment (and a 3rd-star "found it without hints"
gate, mirroring Codecaster).

---

## 4. GAME LOOP & DESIGN PRINCIPLES

```
Lobby → Case briefing → INVESTIGATION phase (read sources, untimed-ish, re-openable)
      → QUESTION rounds (each Q answerable from sources; docs stay reachable)
      → live scoreboard after each Q → Results → XP/coins → progress saved
```
- **Scoring:** correct = base (e.g. 100); speed bonus capped (≤ +30) and tiebreaker-only;
  streak multiplier (×1.0→×1.5); **no penalty for slow/reading**. Sources remain openable during
  questions (we test *finding* evidence, not memorization).
- **Win:** highest score. **Solo (Bot Practice):** clear an accuracy threshold to "solve the case."
- **XP/coins:** per correct + per case solved + first-case-of-day bonus; **anti-farm delta** on
  replay (only the improvement is paid), same rule as `completeGame`/`codecasterComplete`.
- **Progression:** data-driven Detective ranks; daily case; subject skill tracks (post-MVP tree).
- **Achievements:** pure `check(snapshot)` data entries — never hand-granted.

---

## 5. GAME MODES — MVP cut

| Mode | MVP? | Why |
|---|---|---|
| **Bot Practice** (vs AI) | ✅ MVP | Solo onboarding, zero netcode risk, teaches the loop |
| **Private / Friendly Room** (invite, P2P) | ✅ MVP | Direct clone of Party room transport |
| **Classroom Tournament** (teacher room → leaderboard) | ✅ MVP | Reuses admin layer; highest institutional value |
| **Ranked** (MMR) | ⏭ Fast-follow | Needs matchmaking + mature anti-cheat first |
| **Escape-Room branching** | ⏭ Post-MVP | Content/mechanic layer on the proven spine |

---

## 6. ANTI-CHEAT (principles — Supabase agent owns the full design)
1. Answer keys never leave the server; answers scored by RPC (clone `kcq_party` `0007`).
2. Per-room **player token** issued by DB; you can only score as yourself.
3. **One scored answer per (player, question)** — idempotent, survives host refresh.
4. Server authoritative phase/`q_index`; non-host clients cannot forge start/next/end.
5. Speed bonus computed from **server-side question-open timestamp**, not client clock.
6. XP/coins written only after server confirms the scored result (cloud); offline trusts client
   but never reconciles upward maliciously (mirror Codecaster `validated=false` MVP note).

---

## 7. DELIVERABLE OWNERSHIP (agent dispatch plan)
| # | Deliverable | Owner agent |
|---|---|---|
| 1 | Product analysis / retention / virality / MVP | edtech-game-strategist + Lead |
| 2 | Game Design Doc (loop, economy, ranks, dailies) | edtech-game-strategist |
| 3 | Multiplayer + DB architecture (rooms, RPCs, resume) | supabase-backend-architect |
| 4 | DB schema + RLS + anti-cheat | supabase-backend-architect |
| 5 | UI/UX flow + screens (lobby→result, mobile) | frontend-master |
| 6 | Competitor/retention research feeding all | web-research-supplier |
| 7 | QA plan + exploit hunt | qa-master-tester |

Waves: **W1** scope-lock (Lead) → **W2** strategist + research (design + evidence) →
**W3** supabase architect (schema/RPC) → **W4** frontend (UI) → **W5** QA (break it) → build.

---

## 8. LEAD RESOLUTIONS — open risks from GDD (`01`) closed (2026-06-09)

The GDD (`01-PRODUCT-AND-GDD.md`) and research (`02-RESEARCH.md`) are accepted. Resolutions:

1. **Audience narrowed → primary 10–14**; 7–9 served only by easy-`gradeBand` Bot Practice.
   Content authors must grade-band cases; no one-size-fits-all cases. **Locked.**
2. **`caseXp` parallel counter → APPROVED.** Detective rank derives from `caseXp` only (anti
   cross-mode farming). Extend `useGame` `Snapshot` with: `casesCompleted`, `cases3star`,
   `caseNoHintSolves`, `caseStreak`, `caseXp`, `classroomCaseTournamentWins`. Frontend + Supabase
   agents must build cloud-save schema around this. **Locked.**
3. **Speed-bonus anti-cheat → `q_opened_at` is IN SCOPE for migration `0011`.** The RPC that
   advances to a question records a server timestamp; speed bonus is computed server-side from it.
   Non-negotiable. **Locked.**
4. **Offline scope → confirmed cut:** Bot Practice = fully offline (localStorage only, no Supabase).
   Private Room + Classroom Tournament = **Supabase-required**, with an explicit UI message
   ("Multiplayer requires a connection") — **no silent failure**. **Locked.**
5. **Teacher UX <3-min setup → accepted as a hard constraint** for the frontend agent: admin
   case-picker → room-code → student join (display name only, **no account**, COPPA-safe) → launch.
   Must be prototyped/tested with a real teacher before v1. **Locked.**
6. **Content pipeline → build assumption:** v1 ships **5 hand-authored seed cases** in
   `src/data/cases/` (data-driven, like `games.ts`), proven well-formed by a test (mirror
   `levels.test.ts`: every question has a valid `evidenceSourceId` + exactly one server-side
   answer). A teacher-facing case **editor is v2/post-MVP**. ⚠️ **ESCALATED TO PRODUCT OWNER:**
   a *human* must own the ongoing 1–2 case/week authoring cadence — the daily-case design fails
   without it. This is an operational, not engineering, dependency.

### Locked economy/scoring (authoritative — from GDD §3, do not re-derive)
- **Per correct answer:** +15 XP, +3 coins. Wrong: 0/0.
- **Speed bonus:** `floor(5 * max(0,(45000 - elapsed_ms)/45000))` → **+0..+5 XP only**, server-side
  from `q_opened_at`. Tiebreaker-grade; never decisive.
- **Streak multiplier:** ×1.0 (streak 0–1) · ×1.2 (2–3) · ×1.5 (4+ consecutive correct).
- **Case-solve stars:** 1★ ≥50% correct (40 XP/8c) · 2★ ≥80% + ≥1 cross-ref correct (80/16) ·
  3★ 100% + zero hints (120/24). **Anti-farm delta** on solve XP; per-answer XP always pays.
- **First-case-of-day:** +30 XP, +6 coins, increments streak; once/day, any mode (not spectating).
- **Stars + speed bonus are computed SERVER-SIDE** from the graded answer record (mirror
  Codecaster `grading.ts` replay-authority). Clients never self-report stars/score.

---

## 9. LEAD RESOLUTIONS — backend questions from `03` (2026-06-09)

Backend architecture (`03-BACKEND-ARCHITECTURE.md`) accepted: 4 tables (`kcq_case_rooms`,
`kcq_case_answers` [server-only keys], `kcq_case_progress`, `kcq_case_leaderboard`) + 13 RPCs.

1. **Private Room auto-advance (120s) → DEFERRED to v1.1.** MVP = **host-controlled advance only**
   (host taps "Next"); a visible non-authoritative countdown may show, but no server-persistent
   timer / Edge Function in v1. Avoids durable-timer complexity. **Locked.**
2. **Streak multiplier → XP-only.** Coins stay flat (3/correct answer). Less economy inflation,
   simpler to reason about. **Locked.**
3. **Classroom max size → 35 students. Locked.** Requires a large-room realtime amendment (below).

### 9a. Large-classroom realtime amendment (Lead, supersedes `03` 8-peer assumption)
Private/Friendly rooms (≤8) keep the **Party presence+broadcast mesh** unchanged.
**Classroom Tournament (`is_classroom = true`, up to 35) uses a hub-and-spoke model**, not a peer mesh:
- **Canonical state lives in the single `kcq_case_rooms` row** (already the design). Students
  **subscribe to that one row via Postgres Realtime** (`postgres_changes` on the room PK) for
  phase/`q_index`/`q_opened_at`/scoreboard/revision — NOT a 35-way presence mesh.
- **Teacher is the only broadcaster**: teacher's `advance_question`/`advance_reveal`/`end_match`
  RPCs bump `revision`; the row update fans out to all students via the single subscription.
- **Students write only answers**, via `kcq_case_answer` RPC (already server-scored, idempotent).
  No student presence broadcast required for gameplay.
- **Presence is optional/diagnostic** for the roster ("who's here") and may be sampled/capped;
  it is not on the scoring path. Scoreboard is read from the room row's `scores`, not presence.
- Frontend already specced to render the roster/leaderboard **virtualized** for 30+.
- ⇒ Net change vs `03`: no schema change needed; it's a transport/subscription strategy split by
  `is_classroom`. The build agent must implement two `useCaseRoom` paths (mesh ≤8 / hub ≤35).

4. **Content ownership → product owner owns authoring; editor stays v2. Locked.** v1 ships
   **5 hand-authored seed cases** in `src/data/cases/` + a `cases.test.ts` validating structure
   (every question has a valid `evidenceSourceId` and exactly one server-side answer; gradeBand set;
   solvable from sources). Authoring is a documented manual human process post-launch.

### 9b. LEAD RESOLUTIONS — frontend questions from `04` (2026-06-09)
Frontend spec (`04-FRONTEND-UX.md`) accepted. Routes: `/case`, `/case/create`, `/case/[code]`,
`/case/result`, `/admin/cases`, `/admin/cases/[code]`. `useParty`→`useCaseRoom` clone;
Codecaster `PaneTab`→ extracted `SegmentedTabs`. Question resolutions:
1. **Classroom size** → already 35 (§9a hub-and-spoke); leaderboard virtualized for 30+. Wire the
   `@tanstack/react-virtual` path. **Locked.**
2. **Projector route `/case/[code]/display` → IN MVP.** The teacher's big screen IS the shared game
   board (Kahoot-style); it's core to the classroom value prop and the <3-min flow. ~2h. **Locked.**
3. **`Question.evidencePassage` authoring** → product owner (content pipeline, §4 above). Part of the
   5 seed cases; `cases.test.ts` validates it exists. **Locked.**
4. **Speed bonus in Bot Practice → hidden.** Calm, pressure-free reading in solo/practice; speed
   bonus still computes but isn't surfaced in Bot mode. **Locked.**

## 10. LEAD RESOLUTIONS — QA findings from `05` (2026-06-09) — ALL build-blocking issues closed

QA (`05-QA-PLAN.md`) confirmed the core RPC anti-cheat is sound (answer key never leaves server,
DB-clock speed bonus, idempotent scoring, phase forgery blocked). Fixes accepted:

1. **`kcq_case_players` relational table — REQUIRED, supersedes §9a "no schema change".** The
   JSONB-per-player room design caps cleanly at ~8; for 35-student classrooms, player rows move to
   `kcq_case_players(room_code, player_id, player_token, display_name, score, streak, answered,
   hints, is_teacher, joined_at)`. `scores`/`player_tokens`/`answered` JSONB on the room are dropped
   in favor of this table. `kcq_case_join`'s 8-cap becomes a per-room `max_players` (8 friendly /
   35 classroom). **This is the #1 pre-build schema change for migration `0011`.** (CRITICAL-02)
2. **`kcq_case_save_progress` must NOT trust client XP/stars.** Remove `p_case_xp` from the client
   input entirely; the server **derives `caseXp` from the stars→XP table** and the anti-farm delta.
   Add a **`case_id` existence check against `kcq_case_answers`** (reject unknown/fabricated cases).
   RPC is authenticated-student-only. Closes the leaderboard-forgery hole. (CRITICAL-01/03)
3. **`classroomCaseTournamentWins` is server-gated.** `caseMatchEnd()` increments the classroom-win
   counter/achievement **only when the server-authoritative room confirms `is_classroom`** — never
   from a client-supplied mode flag. Bot Practice (offline) can never earn classroom wins. (HIGH-02)
4. **Per-run question-order shuffle → MOVED to v1.0** (was v1.1). With only 5 seed cases, fixed
   order makes memorization trivial. Shuffle question order every run; the 4-of-6 *subset* selection
   stays v1.1. (QA Low gap)
5. **Display-name uniqueness enforced in `kcq_case_join`** (suffix dupes, e.g. "Ali (2)") so
   classroom CSV export is unambiguous.
6. **Separate daily counters:** `lastCaseDay` (first-case-of-day) is distinct from `claimDaily`'s
   `lastDailyClaim` — different values, must not share a key.
7. **Payload + UX:** add `streak`/current multiplier to the room payload (so it survives reconnect);
   surface the server's `reason:'phase'` late-answer rejection in the UI ("Time's up — next question").
8. **Load test** the 35-student answer burst (Realtime fan-out) before classroom launch.

`caseMatchEnd()` not existing (HIGH-01) is a build task, not a design gap → it is **Increment 1**
in the roadmap (mirrors `codecasterComplete`; first store action implemented).
