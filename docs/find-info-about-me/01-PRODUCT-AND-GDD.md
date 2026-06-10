# Case Files — Product Analysis & Game Design Document

> Author: edtech-game-strategist agent. Status: DRAFT for Lead review.
> Produced: 2026-06-09. Locked scope source: `00-BRIEF.md`.

---

## 1. Product Analysis

### 1.1 Target User

**Primary:** students 10–14 in a classroom session with a teacher running a Classroom Tournament.
The reading volume per case (3–5 source docs, ~400–700 words total) is too high for an unsupported
7-year-old; the 7–9 age band is a secondary user served only by the easiest `gradeBand: '7-9'` cases
and Bot Practice. Never assume both bands play the same content at the same pace.

**Stakeholder who decides adoption:** the teacher. The Classroom Tournament mode must be
operable in under 3 minutes from the admin panel with zero student account setup. If it takes
longer, teachers use Kahoot instead.

### 1.2 Learning Outcome

The mode teaches three distinct but linked skills:

| Skill | Mechanic that proves it | Measurable signal |
|---|---|---|
| Literal comprehension | "answer is explicitly in one source doc" questions | accuracy on single-source Qs |
| Cross-referencing | "answer requires two sources to reconcile" questions | accuracy on multi-source Qs |
| Evidence evaluation | post-answer "show me where" moment; 3rd-star "no-hint" gate | hint usage rate |

These are **curriculum-aligned skills** (common core ELA, UK KS2/3, Uzbek national curriculum
reading standards). That matters for teacher adoption. Arena and Codecaster teach coding;
Case Files is the first mode that serves ELA/humanities teachers — a new audience and a new
distribution wedge.

### 1.3 Why This Mode Earns Its Place

Arena = coding under combat pressure. Codecaster = coding by doing. Party = coding trivia.
Case Files = **reading + reasoning under light competition**. No other mode in the stack serves
the teacher who wants to assess reading comprehension in a game format. Blooket and Quizizz do
reading quizzes but without the document-investigation mechanic — the open-sources-during-questions
rule is the genuine differentiator. Kahoot has no equivalent.

**The risk to flag:** Case Files competes for classroom time with Kahoot/Blooket, not just Arena.
The teacher UX (setup speed, result export) must be at least as fast as those products or the
reading mechanic will not save it. This is the single biggest adoption risk.

---

## 2. Retention, Virality, Replayability

### 2.1 Daily Case (core retention driver)

One new case unlocks each day at midnight (server time, or local midnight in offline mode).
It is flagged `isDaily: true` in the content model and grants a **First-Case-of-Day bonus** (see
Section 3). Mechanics:

- Integrate with the existing `nextStreak` / `claimDaily` infrastructure in `useGame.ts`.
- A case counts as "today's case" if the player completes it (≥ 1-star solve) before the next
  reset. Bot Practice and Private Room both count; Classroom Tournament counts only if the case
  assigned by the teacher is the day's daily.
- Streak freeze token: one token automatically granted at rank Detective Sergeant (rank 3).
  The player can hold at most 2 freeze tokens. This mirrors the Duolingo freeze but is gated by
  progression so it does not trivialize the streak from day one.

### 2.2 Detective Ranks (see Section 4)

Ranks are the visible identity layer. They appear on the result card, on the classroom
leaderboard, and next to the player's name in the lobby. A student whose rank advances during
a classroom session creates a social moment the teacher can call out. That social proof loop is
the main viral mechanic inside a classroom.

### 2.3 Shareable Result Card

After every case (not just classroom): a static summary card showing case title, score, star
rating, rank badge, and one highlighted "best evidence find" (the question the player answered
correctly fastest without opening a hint). Exportable as a PNG (HTML-to-canvas, client-side,
no server needed). Teachers share these on classroom displays; students share with parents.
This is the low-cost virality mechanism — it requires no account and works offline.

### 2.4 Classroom Social Loop

- Live leaderboard after every question (same pattern as Party). Each student sees their rank
  delta ("up 2 places").
- Teacher sees per-question accuracy heatmap (% of class who got Q3 wrong). This is a teaching
  moment; the teacher pauses, re-reads the source, class discusses. This feature differentiates
  Case Files from every Kahoot-clone because it makes the teacher a pedagogical actor, not just a
  session launcher.
- Classroom result export: CSV of (student, score, stars, Q-by-Q accuracy) for grade entry.
  This is table-stakes for school adoption.

### 2.5 Replayability Tuning

Anti-farm delta applies (Section 3), but the replayability problem for a document-based game
is different from a coding level: once you know the answers, re-reading is low-value.
Mitigations:
- Cases rotate question order and vary which 4 of 6 available questions are asked each run
  (server-controlled via `q_set` selection at room creation). This adds genuine variance.
- New cases weekly (content pipeline, not a day-1 build requirement). Content is the
  primary replayability lever; the mechanic cannot fully substitute.
- Cross-referencing questions have higher replay tolerance because they require re-reading
  relationships, not recalling a single fact.

---

## 3. Core Economy

### 3.1 Per-Answer Reward

```
Correct answer (any mode):   base XP = 15 XP,  coins = 3
Incorrect answer:            XP = 0,            coins = 0
Speed bonus (tiebreaker):    +0 to +5 XP only (≤ 3.3% of base — never the deciding factor)
Streak multiplier:           ×1.0 at streak 0-1 | ×1.2 at 2-3 | ×1.5 at 4+ consecutive correct
```

Speed bonus formula: `floor(5 * max(0, (ANSWER_WINDOW_MS - elapsed_ms) / ANSWER_WINDOW_MS))`
where `ANSWER_WINDOW_MS = 45_000` (45 seconds). Speed bonus is computed server-side from the
server-issued `q_opened_at` timestamp (anti-cheat principle 5).

### 3.2 Per-Case Reward (case solve)

Star rating determines the case solve reward. Stars are computed server-side after the final
question using the graded answer record, mirroring `grading.ts` in Codecaster.

| Stars | Condition | XP | Coins |
|---|---|---|---|
| 1 star | >= 50% correct answers | 40 | 8 |
| 2 stars | >= 80% correct, at least one cross-ref Q correct | 80 | 16 |
| 3 stars | 100% correct + no hint opened on any question | 120 | 24 |

**Anti-farm delta rule:** `caseMatchEnd(caseId, stars)` in `useGame.ts` stores the player's best
star count per case and pays only the delta on replay. A 1-star first attempt gets 40 XP; a 2-star
replay gets `80 - 40 = 40 XP` additional; a 3-star replay after a previous 3-star gets 0 case-solve
XP. Per-answer XP still pays in full each run (the player read and answered correctly; that effort
is real).

### 3.3 First-Case-of-Day Bonus

`isFirstCaseToday()` check (same pattern as `claimDaily`): +30 XP, +6 coins, streak incremented.
Applies once per calendar day regardless of mode. Bot Practice counts; spectating does not.

### 3.4 XP Curve Integration

Existing curve: `50 * (L-1) * L`. Sample checkpoints:
- Level 1 → 2: 50 XP (about 2 well-played cases)
- Level 5 → 6: 1000 XP cumulative to reach level 5; cases contribute meaningfully alongside
  Arena/Codecaster but don't short-circuit the curve.
- A full 3-star case with streak: `(6 questions × 15 XP × 1.5 streak) + 120 solve XP + 30 daily
  = 135 + 120 + 30 = 285 XP max` — roughly comparable to a full Arena match, which is appropriate
  for equivalent time investment (~12–15 min per case).

---

## 4. Progression

### 4.1 Detective Ranks

Data-driven list; stored as `DETECTIVE_RANKS` in `src/data/cases/ranks.ts`. Rank is derived
from cumulative case-solve XP only (separate counter from main XP to avoid cross-polluting with
Arena/Codecaster farming), stored as `caseXp` in the `useGame` store.

| # | Rank | caseXp threshold | Unlock |
|---|---|---|---|
| 0 | Cadet | 0 | access to Bot Practice, Friendly Room |
| 1 | Rookie Detective | 150 | shareable rank badge |
| 2 | Junior Detective | 400 | access to harder gradeBand cases |
| 3 | Detective Sergeant | 800 | streak freeze token granted |
| 4 | Senior Detective | 1 500 | custom case-file UI theme (cosmetic, no coins cost) |
| 5 | Lead Investigator | 2 800 | Classroom Tournament host access for students (post-MVP) |
| 6 | Chief Inspector | 5 000 | animated rank badge (cosmetic) |
| 7 | Master Sleuth | 9 000 | all-time leaderboard eligibility |

Rank is computed as a pure derived value from `caseXp` — never stored as a numeric field.
Same pattern as achievements: add a `rankForCaseXp(xp)` pure function in `src/lib/caseLeveling.ts`.

### 4.2 Subject Skill Tracks

**Post-MVP.** In MVP, `question.concept` is stored but not surfaced to the player. Post-MVP it
powers a skill tree (e.g., "Literal Reading 3/5", "Cross-Reference 1/5") mirroring Codecaster's
concept gate, visible on the player's rewards/profile page. Do not build the UI in v1; collect the
data from day one so it is available when the tree ships.

### 4.3 Achievement Data Entries (MVP set)

All `check(snapshot)` predicates in `src/data/achievements.ts`. Suggested MVP entries:

| key | condition |
|---|---|
| `case_first_solve` | `s.casesCompleted >= 1` |
| `case_first_3star` | `s.cases3star >= 1` |
| `case_no_hints` | `s.caseNoHintSolves >= 1` |
| `case_streak_3` | `s.caseStreak >= 3` |
| `case_rank_sergeant` | `s.caseXp >= 800` |
| `case_classroom_win` | `s.classroomCaseTournamentWins >= 1` |

`useGame.ts` must extend the `Snapshot` type with: `casesCompleted`, `cases3star`,
`caseNoHintSolves`, `caseStreak`, `caseXp`, `classroomCaseTournamentWins`.

---

## 5. Win / Lose Conditions Per Mode

### Bot Practice

- **Win:** achieve >= 50% correct (1-star threshold). Case is "solved." Bot difficulty adjusts
  answer speed only — bots never affect the player's own score; they exist to fill a leaderboard
  and provide social comparison.
- **Lose:** < 50% correct. Case is "unsolved." XP from correct per-answer rewards still paid;
  no case-solve bonus. Player is shown which questions they missed and which source contained
  the answer (teaching moment, always shown in solo mode).
- **Bot count:** 3 bots by default (makes the leaderboard feel populated).
- **Bot accuracy:** calibrated by `gradeBand` — easy band bots answer ~70% correct; hard band
  bots answer ~90% correct. Bots never answer in under 8 seconds (prevents "bot always wins speed
  bonus" optic).

### Private / Friendly Room

- **Win:** highest total score at end of final question. Ties broken by cumulative speed bonus.
- **Lose:** any score below the winner. No "failed" state; every player gets their per-answer XP.
- **Case-solve bonus:** awarded to every player who hit the 1-star accuracy threshold (>= 50%),
  scaled by their star level. The winner does not take a monopoly on the solve bonus.
- **Room flow:** host picks case → host starts investigation phase → all players read → host
  advances to questions (or auto-advance after `investigation_timeout_ms = 120_000` with a
  visible countdown) → question rounds → final scoreboard → results.
- **Min players:** 2 (host + 1). Max players: 8 (matches Party room cap; transport handles it).

### Classroom Tournament

- **Win:** teacher-visible: per-student scores ranked. Student-visible: their personal rank on
  the live leaderboard.
- **Case-solve bonus:** same as Friendly Room — every student who hits >= 50% accuracy earns it.
- **Teacher controls:** `advance_question` RPC callable only by the teacher's admin token (not
  the `requireAdmin()` middleware — that's server-side only — but a `room_token` with `is_teacher`
  flag issued at room creation). Teacher can pause between questions for discussion; there is no
  auto-advance timeout in tournament mode (teacher-controlled pacing is a feature, not a bug).
- **Setup flow from admin panel:** teacher selects case → sets `gradeBand` filter → room code
  generated → students join via `/case/[code]` (no account required, enter display name only) →
  teacher launches. Target: under 3 minutes from admin panel open to first question on screen.
- **Result export:** CSV download available to teacher after session ends (student display name,
  score, stars, Q-by-Q correct/incorrect).

---

## 6. MVP Cut Line

### Ships in v1

- Bot Practice (3 bots, 3 difficulty tiers mapped to gradeBand)
- Private / Friendly Room (up to 8 players, room code, no account required)
- Classroom Tournament (teacher-launched from admin panel, CSV export)
- Core scoring: correct base (15 XP / 3 coins), speed bonus (capped +5 XP), streak multiplier
- Case solve XP (1/2/3-star thresholds), anti-farm delta, first-case-of-day bonus
- Detective Ranks 0–7 (computed from `caseXp`, no UI tree — rank badge only)
- Daily case mechanic (flagged in content data, streak counter integration)
- Post-answer teaching moment (show `evidenceSourceId`, highlight source passage) — solo/bot only
  in v1; classroom post-round reveal is teacher-triggered
- MVP achievement set (6 entries above)
- Shareable result card (client-side PNG, no server)
- Anti-cheat: answer keys server-side, per-player token, one answer per (player, question),
  server-side phase control, speed bonus from server timestamp
- Content: minimum 5 cases at launch across 3 gradeBands (enough for 1 week of daily cases
  before repetition; content pipeline, not a build blocker)
- Offline (Bot Practice only): full Bot Practice mode works with localStorage only, no Supabase.
  Private Room and Classroom Tournament require Supabase (realtime transport).
- i18n: all UI strings in uz/ru/en from day one; case content can be uz/ru only at launch

### Fast-Follow (v1.1)

- Post-answer teaching moment in Classroom Tournament (teacher-triggered "reveal source")
- Subject skill track UI (concept data already collected in v1)
- Question pool variance (rotate 4-of-6 per run)
- Streak freeze token (rank 3 unlock mechanic)
- Classroom result heatmap (per-Q accuracy % for teacher)

### Post-MVP (v2+)

- Ranked mode (MMR matchmaking)
- Escape-room branching (multi-path cases)
- Student tournament host access (rank 5 unlock)
- Animated rank badges
- Cross-case story arcs

---

## 7. Open Risks for Lead to Resolve

1. **Content pipeline is the critical path.** The game mechanic is sound but worthless without
   cases. Five launch cases is the minimum; someone must own a 1–2 case/week authoring cadence
   or the daily case and replayability design collapses within 2 weeks. Who owns case authoring?
   Is there a teacher-facing case editor on the roadmap?

2. **Offline scope for Private/Classroom.** The brief says offline-first is non-negotiable, but
   Private Room and Classroom Tournament fundamentally require realtime transport. The current
   decision (Bot Practice = offline, multiplayer = Supabase-required) is the right pragmatic cut,
   but it must be communicated clearly in the UI: "Multiplayer requires a connection." No silent
   failure.

3. **Teacher UX is the adoption gate.** The < 3 minute setup target is aggressive. It requires
   that the admin panel case-picker, room-code generation, and student join flow work with zero
   friction. This is a UX risk, not an architecture risk — but it must be prototyped and tested
   with a real teacher before v1 ships.

4. **`caseXp` as a separate counter.** Adding a parallel XP counter avoids farming Case Files to
   level up Arena rank, but it adds complexity to the store snapshot and the achievements
   predicate. Confirm with the frontend agent that extending `Snapshot` in `useGame.ts` is
   acceptable before the backend agent designs the cloud save schema around it.

5. **Speed bonus anti-cheat.** Server-side `q_opened_at` timestamp requires the Supabase RPC
   to record when each question was served. This is a non-trivial migration addition. Confirm
   the Supabase architect has this in scope for the `0011`+ migrations.
