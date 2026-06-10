# Case Files — QA Plan & Exploit Hunt

> Author: qa-master-tester agent. Status: PRE-BUILD REVIEW — build-blocking findings flagged.
> Produced: 2026-06-09.
> Source review: `00-BRIEF.md`, `01-PRODUCT-AND-GDD.md`, `03-BACKEND-ARCHITECTURE.md`,
> `04-FRONTEND-UX.md`, `src/lib/codecaster/grading.ts`, `src/store/useGame.ts`,
> `scripts/qa-party-rpc.mjs`.

---

## 0. Audit Methodology

I read every RPC signature and guard condition verbatim from `03-BACKEND-ARCHITECTURE.md`
and traced each attack path end-to-end before writing a finding. Severity ratings:

- **Critical** — exploit produces fake progress, data corruption, or auth bypass.
- **High** — exploit breaks scoring correctness or lets a student cheat in class.
- **Medium** — degrades reliability or UX in a way a smart user can trigger intentionally.
- **Low** — cosmetic or edge-case inconsistency unlikely to affect real sessions.

"NEEDS VERIFICATION" = I identified the risk from the design doc but cannot confirm
the final migration SQL exists yet (it has not been built). These must be verified before
each finding is closed.

---

## 1. Exploit / Cheat Catalog

### 1.1 Answer-Peeking via `kcq_case_room_payload` Leakage

**Attack:** `kcq_case_room_payload()` returns `q_set` (the ordered array of question
indices for this room). A student calls `kcq_case_state(code)` directly in devtools (it is
publicly callable — `grant execute ... to anon`), gets the `q_set`, then calls
`kcq_case_answer` with `p_q_index = r.q_set[qi + 1]` for every question in advance.
They do not need to read a single source document.

**What this actually leaks:** `q_set` is the question-index ordering for this room. It
does NOT expose `answer_index` (that is locked in `kcq_case_answers`). So knowing the
`q_set` tells the attacker which questions will appear and in which order — which is
useful meta-information but not the answer key itself.

**Verdict: NOT a primary exploit.** The answer key never leaves the server. However —

**Secondary exploit:** because `q_set` is public, a cheater who has memorised answers out
of band (e.g. from a previous play) can pre-calculate `(q_index, player_id)` idempotency
keys and confirm whether their stored answer is still valid. In MVP with a fixed `q_set`
(all questions in order), a student who played the same case in Bot Practice the day
before and saw the `reveal` phase knows every answer. The 4-of-6 rotation deferred to
v1.1 partially mitigates this, but the REAL mitigation is the deferred rotation — its
absence in MVP is a known replay-memory risk that must be called out.

**Design gap:** The backend doc's TTL logic inside `kcq_case_create` deletes and
re-creates a room on `on conflict` — but only if the existing room is >4 hours old
(otherwise returns `reason: 'exists'`). So a classroom teacher who runs the same case code
twice within 4 hours gets a stale room silently. This is a session isolation bug.

**Required fix for answer pre-knowledge:** Implement the 4-of-6 rotation in v1.0, not
v1.1, if the case set is small (5 cases) and replay-memorisation is realistic in week 1.

---

### 1.2 `kcq_case_answer` Replay Before Phase Opens

**Attack:** A student captures the `q_index` from the `QUESTION_ADVANCED` broadcast
(the spec broadcasts `{ q_index }`). They then instantly fire `kcq_case_answer` for
the **next** anticipated `q_index` (the current + 1) before the host calls
`kcq_case_advance_question`. Because the RPC checks `r.phase <> 'question' or r.q_index
<> p_q_index`, this is rejected cleanly.

**BUT:** During `phase='question'` at `q_index=N`, a student can fire `kcq_case_answer`
with `p_q_index=N+1` — the RPC rejects it because `r.q_index != N+1`. No exploit here.

**However — speed bonus race:** There is a window between `kcq_case_advance_question`
writing `q_opened_at = now()` and the Realtime broadcast arriving at the student's client.
A student subscribed to `postgres_changes` on the room row receives the update slightly
before a student who receives the broadcast. Both paths converge to the same server-side
`q_opened_at` — so the student who subscribed to Postgres Realtime gets a marginally
earlier clock start. This is a **subscription-fairness asymmetry** (hub-and-spoke
classroom uses Postgres Realtime; Private Room uses broadcast). Students in classroom mode
who happen to receive the row-change event first get a few milliseconds of speed-bonus
advantage.

**Severity: Low.** Speed bonus is capped at +5 XP and is tiebreaker-only. But it must be
documented as a known skew in the classroom channel model.

---

### 1.3 Scoring as Another Player (Token Spoofing)

**Attack:** Student A intercepts Student B's `player_token` (a UUID) from network traffic
or from `sessionStorage` on a shared device. A then calls `kcq_case_answer` with
`p_player_id = B_id, p_player_token = B_token`.

**Design guard:** `player_tokens ->> pid` is compared against `p_player_token::text` in
`kcq_case_answer`. Token is a random UUID (128-bit). Guessing is not feasible.

**Real attack vector:** On a shared classroom computer, Student A opens DevTools after
Student B has joined, reads `sessionStorage['kcq.case.session.${code}']`, extracts B's
token, and submits answers as B. This is realistic in a physical classroom.

**Severity: High.** The shared-device classroom scenario is not hypothetical — it is the
default setup in many schools.

**Required fix:** Document explicitly that `sessionStorage` is the credential store, and
that browsers' private-browsing or tab isolation cannot prevent a technically-aware student
from reading another tab's sessionStorage. At minimum, the UI must warn: "Make sure you
are logged in as yourself." The deeper fix is to require student accounts (tied to the
`kcq_users` table) for classroom sessions, issuing tokens against authenticated sessions
rather than anonymous session storage. This conflicts with the COPPA-safe "no account"
design for classroom students — a product decision the Lead must resolve.

**Interim mitigation tested:** If a student token is only generated once per session
(idempotent `kcq_case_join`) and the room is locked to the classroom code, the attacker
needs the room code AND the victim's `player_id` string (which is also random, generated
client-side). This makes the attack harder but not impossible on a shared device.

---

### 1.4 Double-Scoring a Question (Idempotency)

**Attack:** Student submits `kcq_case_answer` twice for the same `(q_index, player_id)`.

**Design guard:** `answer_key = q_index::text || ':' || player_id`. The `r.answered ?
answer_key` check catches duplicates and returns `{ ok: true, duplicate: true }` without
re-scoring.

**Edge case: race condition.** Two requests arrive at the DB within the same transaction
window before the first `update ... set answered = ...` commits. The `for update` row lock
on `select * from kcq_case_rooms where code = c for update` serialises concurrent RPCs to
the same room row — only one writer at a time. So race condition is blocked at the DB
level.

**NEEDS VERIFICATION:** The idempotency check uses `r.answered ? answer_key` where
`answer_key = p_q_index::text || ':' || pid`. But `pid` is read from `p_player_id` (user
input), not from `r.player_tokens` keys. If a client sends a different string that maps to
the same player (e.g. `pid` normalised differently), the idempotency key could differ from
the existing one. The RPC validates `pid !~ '^[A-Za-z0-9_-]{2,40}$'` but does NOT
normalise to lowercase. Confirm the frontend always sends the same casing for `player_id`.

**Verdict: Likely safe** with `for update` + idempotency key. Log this as a verification
checkpoint.

---

### 1.5 Replaying `kcq_case_answer` for XP Farming

**Attack:** After a match ends (`phase='ended'`), the student calls `kcq_case_answer`
again for `q_index=0`, hoping to collect XP again.

**Design guard:** `r.phase <> 'question'` check in `kcq_case_answer` — a phase of
`'ended'` will always fail this guard. No re-scoring is possible post-match.

**Attack 2 — rejoin farming:** Student finishes a case, leaves, creates a NEW room for
the same case with a new code, joins, starts investigation, advances to questions alone,
and answers all questions again. Per-answer XP (`+15 per correct`) always pays, even on
replay — this is BY DESIGN per the brief ("per-answer XP always pays in full each run").

**Exploit assessment:** Playing the same case repeatedly and getting `+15 XP × 6
questions = 90 XP` per solo run is deliberate design. The anti-farm delta only applies to
the case-SOLVE bonus (40/80/120 XP), not per-answer XP. A motivated student could grind
easy cases for per-answer XP indefinitely.

**Rate analysis:** At 90 XP per 6-question case (~5-10 min assuming re-read time), and
level 5→6 requiring ~1000 XP, that's ~11 full case replays to gain one level. This is
comparable to Arena grinding. Whether this is "too fast" is a product decision, not a
security bug.

**BUT — the 5-case MVP library means all 5 cases are quickly memorised, reducing re-read
time to near-zero.** A student who memorises all 5 cases can answer instantly (within the
45-second window), collect max speed bonus (+5 XP per question), and grind ~115 XP per 5
minutes.

**Severity: Medium.** Not an exploit (it's paying for real effort in early plays) but
degrades as the library stays small. The mitigation is library growth (content pipeline)
and the 4-of-6 rotation (v1.1).

**Required action:** Add an explicit farming analysis to the v1.1 scope: "If library stays
at 5 cases for more than 2 weeks, cap per-answer XP to 3-per-day per case, not per-run."

---

### 1.6 Forging Phase Advance / `advance_question` as a Non-Host

**Attack:** Student calls `kcq_case_advance_question(code, fake_token)` directly.

**Design guard:** `host_token = p_token` in the `WHERE` clause — the RPC returns `reason:
'auth'` if the token does not match. Since the host_token is never broadcast, students
cannot call this RPC.

**Edge case:** The teacher's host_token is stored in `sessionStorage['kcq.case.session.${code}']`. If a student is on the teacher's device and opens DevTools on the admin panel tab (during a projector display session), they can extract the token.

**Severity: Medium.** Physical access to the teacher's browser session is required.
Standard classroom IT practice (lock screen) is the primary mitigation. Document this as
an operational risk in the teacher guide, not a code defect.

---

### 1.7 Forging `end_match` (Self-Granting Stars)

**Attack:** Student calls `kcq_case_end_match(code, fake_token)`.

**Design guard:** Same `host_token` check. Rejected if token does not match.

**Deeper attack:** `kcq_case_save_progress(p_token, p_case_id, p_stars, p_case_xp)` uses
`session_token` (a `kcq_users` auth token), NOT the room `host_token`. A logged-in student
calls this directly with `p_stars = 3`, bypassing the match entirely.

**THIS IS A CONFIRMED EXPLOIT — Critical.**

The design document (§8.6) explicitly acknowledges this as a known MVP trust limitation:
> "This risk acceptable MVP uchun — real-time match stars server-authoritative."

But the acceptance is imprecise. Let me be specific about what breaks:

1. **Bot Practice:** Stars come from the client entirely (no server match). A student
   playing Bot Practice can call `kcq_case_save_progress(session_token, 'case-museum-heist', 3, 120)` at any time to claim 3 stars without playing.
2. **Cloud-save after multiplayer:** After `kcq_case_end_match` returns the authoritative
   results object, the FRONTEND calls `kcq_case_save_progress` with those results.
   But there is no server-to-server call — the frontend constructs the `p_stars` and
   `p_case_xp` values and sends them. A student with DevTools can intercept this call and
   inflate the values before they reach the RPC.

**Required fix (BEFORE BUILD):**
- `kcq_case_save_progress` must accept a `p_room_code` and `p_match_token` and validate
  against `kcq_case_rooms.answered` server-side, similar to how Codecaster `grading.ts`
  re-replays actions through the engine. Otherwise any player with a `session_token` can
  set their own stars to 3 at any time.
- OR: `kcq_case_end_match` should directly write to `kcq_case_progress` for logged-in
  players (server-to-server), never trusting the client round-trip.
- Bot Practice remains client-trusted (documented `validated=false`). This is the same
  `validated=false` MVP note as Codecaster. Must be explicitly documented, not silent.

**Note on `p_case_xp` parameter:** `kcq_case_save_progress` accepts `p_case_xp` as a
client-supplied integer with no validation against the actual match record. A student can
pass `p_case_xp = 99999` and inflate their `caseXp` counter, their Detective Rank, and
the leaderboard. This bypasses the anti-farm delta entirely for cloud-saved progress.

**Severity: Critical.** This breaks the leaderboard, Detective Rank integrity, and the
3-star gate for achievements.

---

### 1.8 Hint-Then-Claim-No-Hint for the 3rd Star

**Attack:** A student opens a hint (calls `kcq_case_open_hint`), reads it, then tries to
claim 3 stars anyway.

**Design guard (multiplayer):** `kcq_case_open_hint` writes `hints[q_idx:pid] = true` to
the DB. `kcq_case_end_match` checks `r.hints ? answer_key` for every player and question —
if any hint was opened, `any_hint = true` and 3 stars are denied server-side.

**CONFIRMED SAFE for multiplayer.**

**Attack (Bot Practice — offline):** In Bot Practice, there is no server. Hints are
tracked locally. The `caseMatchEnd()` store action in `useGame.ts` receives the
client-reported stars. If the hint-tracking is done in the UI component and the client
sends `stars = 3` despite having opened a hint, there is no server to contradict it.

**Severity: Medium for Bot Practice.** The Bot Practice results do not feed the classroom
leaderboard and are not comparable across students. But they do affect personal achievements
(`case_first_3star`, `case_no_hints`) and the `caseXp` counter used for Detective Rank.

**Required fix:** `caseMatchEnd()` store action must receive a `hintsUsed: boolean`
parameter from the UI component, computed from the local hint-tracking state, and enforce
the 3-star rule client-side. The client can lie about this, but at least the store enforces
it for honest mistakes (accidentally opened hint, forgot). The `validated=false` note must
be in the code.

---

### 1.9 Faking the Speed Bonus (Client Clock vs Server `q_opened_at`)

**Attack:** Student manipulates their system clock backward before answering, making
`elapsed_ms` appear tiny, and hoping the server uses `now()` as the answer arrival time.

**Design:** The RPC computes `elapsed_ms = extract(epoch from (now() - r.q_opened_at)) *
1000.0`. `now()` here is the DB server's clock at the time the RPC executes, not the
client's clock. Client-side clock manipulation has zero effect.

**CONFIRMED SAFE.** Speed bonus is fully server-clock-derived.

**Edge case:** If the DB server experiences high load and the RPC executes significantly
later than the client submitted the answer, the student is penalised for server latency
they did not cause. The `greatest(0.0, ...)` guard prevents negative speed bonuses but
does not compensate for latency. This is a **fairness issue**, not a security issue.

**Speed bonus clamp logic:** The RPC does `speed_xp := least(speed_xp, 5)` AFTER
computing from the formula. If `q_opened_at` is null (e.g. the DB clock-drift race
described in §8.5 of the backend doc, where `elapsed_ms < 0`), the formula gives
`floor(5 * max(0, (45000 - negative) / 45000))` which is `floor(5 * (45000 +
abs(elapsed_ms)) / 45000)` — a value > 5. The `least(..., 5)` clamp catches this.

**CONFIRMED SAFE by cap.** Document this explicitly in the migration.

---

### 1.10 XP/Coin Farming via First-Case-of-Day Abuse

**Attack (localStorage edit):** Student opens DevTools, edits `localStorage['kcq.v2']`,
sets `lastDailyClaim` to yesterday's date, then claims the first-case-of-day bonus again.

**Design guard:** `claimDaily()` checks `get().lastDailyClaim === today`. If the student
edits localStorage to reset this date, they can re-trigger the daily bonus.

**Severity: Medium.** This is the same vulnerability that exists today for all localStorage-
persisted progress in KidsCode Quest. It is a known limitation of the offline-first
architecture. The existing `claimDaily()` in `useGame.ts` has the same exposure.

**Specific to Case Files:** `isFirstCaseToday()` is a NEW check that needs to be added to
`useGame.ts` for the Case Files first-case bonus. It must follow the same pattern as
`claimDaily()` — using `lastDailyClaim` (or a new `lastCaseClaim` key) — to prevent
separate farming of the two bonuses.

**DESIGN GAP:** The GDD specifies "first-case-of-day bonus" (+30 XP, +6 coins) but the
store currently only has `claimDaily` (+20 XP, +25 coins). These are DIFFERENT bonuses
with different values. The first-case-of-day is supposed to be separate from the existing
`claimDaily` (which may represent a general daily login/play reward). If both are tracked
with the same `lastDailyClaim` key, one bonus will gate the other unintentionally.

**Required fix:** Add a separate `lastCaseDay: string | null` to `GameState` and a
`caseFirstOfDay()` action that checks it independently of `claimDaily`.

---

### 1.11 `caseXp` Counter Not Gated by Anti-Farm Delta in the Store

**Attack:** Student plays the same case 10 times, earning the case-solve bonus each time.
The anti-farm delta is supposed to prevent this: `caseMatchEnd(caseId, stars)` should only
pay the delta over the best previous star rating for that case.

**Design gap:** The `useGame.ts` store currently has NO `caseMatchEnd` action. It must be
added. The GDD specifies it must mirror `completeGame` and `codecasterComplete` — storing
`bestStars` per case and paying only the delta. Without this, each replay pays the full
case-solve bonus.

**Critical detail on `caseXp`:** The backend doc (§5) states: "`caseAnswerCorrect()` action
does NOT increment `caseXp` — only `caseMatchEnd()` increments it." This separation is what
makes Detective Rank resistant to per-answer farming. If `caseMatchEnd` is not implemented
with the delta gate, `caseXp` accumulates indefinitely on replays.

**Severity: High.** This is a store action that does not exist yet. It is listed in the
design as a requirement. The build cannot proceed without it.

---

### 1.12 `classroomCaseTournamentWins` Achievement Self-Grant

**Attack:** The achievement `case_classroom_win` checks `s.classroomCaseTournamentWins >= 1`.
This counter is incremented by `caseMatchEnd()`. If `caseMatchEnd` trusts the client for
the "did you win a classroom tournament" flag, a student can call the store action with
`classroomWin: true` while playing Bot Practice.

**Design gap:** The `classroomCaseTournamentWins` counter should ONLY be incremented when:
1. The mode was `is_classroom = true`, AND
2. The server-confirmed final scores show this player in first place.

Both conditions must be verified server-side before any client increment. The mechanism
for communicating "you won the classroom tournament" to the client must be a server-signed
result, not a client flag. Specifically: `kcq_case_end_match` returns the final scores for
all players; the client can determine first place from that. But because the call to
`kcq_case_save_progress` (and thus `caseMatchEnd`) is initiated client-side after seeing
the result, a student can forge `classroomWin: true` by calling the store action directly.

**Severity: High.** Corrupts the classroom-win achievement and any future rewards tied to
it.

**Required fix:** `caseMatchEnd()` must receive the `is_classroom` flag AND the final rank
from the server-authoritative `kcq_case_end_match` result, validate that `is_classroom` is
consistent with the room's `kcq_case_rooms.is_classroom` flag (accessible via `kcq_case_state`),
and only then increment `classroomCaseTournamentWins`. The client should not be trusted
to self-assert classroom wins.

---

### 1.13 Hub-and-Spoke: Can a Student Call Teacher-Only RPCs?

**Attack (Classroom mode):** In hub-and-spoke, students subscribe to Postgres Realtime.
A student enumerates all the `kcq_case_*` RPCs and calls `kcq_case_advance_question(code,
teacher_token)`. The `teacher_token` (= `host_token`) is the gate.

**Design guard:** The `host_token` is a UUID stored only in the teacher's `sessionStorage`.
It is NOT present in any Realtime broadcast, NOT in the room row payload (confirmed in
`kcq_case_room_payload()` — host_token is NOT returned). Students cannot access it.

**CONFIRMED SAFE** unless the teacher's session is physically compromised (see §1.6).

**Additional check:** `kcq_case_teacher_results(code, token)` also requires `host_token`.
Students cannot call it.

---

### 1.14 Two Clients Sharing One Player Token (Multi-Device Cheating)

**Attack:** Student A logs in on their phone AND their friend's laptop with the same
`player_id` + `player_token`. Both submit answers. The second answer for the same question
hits the idempotency guard and is a no-op. No double-scoring is possible.

**BUT:** The first client to answer "wins" the speed bonus for that device's round-trip.
The second client gets no scoring benefit. The attack does not help either player.

**CONFIRMED SAFE for scoring.**

**Display name squatting:** `kcq_case_join` is idempotent — if `player_id` already exists
in `player_tokens`, it returns the existing token without re-writing `display_names`. So
a second client joining with the same `player_id` but a different `display_name` gets the
FIRST display name silently. This could be confusing but is not exploitable for scoring.

---

### 1.15 Answer Arriving After Phase Advanced

**Attack:** Student submits `kcq_case_answer` at `q_index=N`, but the host calls
`kcq_case_advance_reveal` before the answer arrives at the DB. The answer arrives at the
DB when `phase='reveal'`, not `'question'`.

**Design guard:** `r.phase <> 'question' or r.q_index <> p_q_index` check rejects the
late answer. The student gets no credit. This is by design — late answers are dropped.

**UX problem:** The student sees their selection in the UI as "submitted" (the UI locks
answer options on selection), but the server never recorded it. The reveal screen will
show the question as "unanswered" for that player. This is a discrepancy between client
state and server state.

**Severity: Medium UX, Low security.** The student loses XP they arguably earned. Not an
exploit, but a frustrating edge case in poor network conditions.

**Required fix:** The `answer()` function in `useCaseRoom.ts` must handle the `reason:
'phase'` response from `kcq_case_answer` and show a user-friendly "Too late — the host
moved on" toast, resetting the local "answered" state.

---

### 1.16 Simultaneous Answers From Multiple Players (Load Test)

**Attack:** All 35 students (classroom mode) submit answers to the same question within
the same second when the question opens.

**Design:** `kcq_case_answer` uses `for update` row locking on the room row. With 35
students writing concurrently, all 35 RPCs queue against the same row lock.

**Performance risk:** Each RPC holds the lock for the duration of its execution (index
lookup in `kcq_case_answers`, score computation, JSONB update, re-read). With 35 concurrent
writers, the last writer may wait up to 34x the single-RPC execution time.

**Severity: Medium performance.** The backend doc notes max 8 players. The Brief (§9.3)
locks classroom max at 35 and specifies hub-and-spoke. BUT the `kcq_case_join` RPC still
has `>= 8` hard cap. This means Classroom Tournament with 35 students CANNOT ACTUALLY
JOIN — the join RPC will return `reason: 'full'` after the 8th student.

**THIS IS A CONFIRMED DESIGN CONFLICT — Critical.**

`00-BRIEF.md §9.3` locks classroom max at 35. `03-BACKEND-ARCHITECTURE.md §6.4` still
shows `max players: 8 (matches Party cap)`. The RPC code in `kcq_case_join` hard-codes
`>= 8`. The schema must be updated: increase the cap, and replace the JSONB-per-player
design with a separate `kcq_case_players` table before classroom mode can support 35
students. This is a build-blocking schema conflict.

---

## 2. Multiplayer Race / Edge Cases

### 2.1 Host/Teacher Refresh Mid-Question

**Scenario:** Teacher refreshes browser during `phase='question'`.

**Recovery path:**
1. Teacher's browser reconnects and calls `kcq_case_host_resume(code, host_id, token)`.
2. RPC returns current `phase`, `q_index`, `scores`, `revision`.
3. Teacher sees the current question; students are unaffected (hub-and-spoke means students
   subscribe to the DB row, not the teacher's presence).

**Risk:** The Realtime subscription for classroom students is `postgres_changes` on the
room PK. If the Supabase Realtime channel disconnects during the teacher's refresh (e.g.
the channel is keyed to a channel name and re-established on reconnect), students may miss
the `QUESTION_ADVANCED` broadcast that was sent just before the disconnect.

**Recovery gap:** After teacher refresh, the teacher's `useCaseRoom` hook must re-sync to
the current question. The frontend spec says `useCaseRoom` calls `kcq_case_state` on mount
to recover — this will work. But students who missed the `QUESTION_ADVANCED` broadcast
will not know the `q_index` changed unless they also poll `kcq_case_state`.

**NEEDS VERIFICATION:** Does the classroom student's `useCaseRoom` implementation call
`kcq_case_state` on reconnect (not just on mount)? The Party pattern does this in
`useParty.ts` — confirm it is ported verbatim.

---

### 2.2 Student Disconnect and Rejoin

**Scenario:** Student disconnects mid-question and rejoins.

**Recovery path:**
1. Student calls `kcq_case_join(code, player_id, display_name)` — idempotent, returns
   existing token.
2. Student calls `kcq_case_state(code)` — gets current phase, q_index, scores.
3. If `phase='question'` and `q_index` matches the current question, student can still
   answer (IF the answer window has not expired server-side).

**Risk:** The student's `q_opened_at` window is based on the server timestamp from when
the question opened, not from when the student reconnected. A student who was disconnected
for 30 seconds of a 45-second window has only 15 seconds to answer. This is correct
behaviour but must be communicated to the student ("question opened X seconds ago").

**Confirmed safe, but UX gap:** The frontend spec does not describe showing elapsed time
to a reconnecting student.

---

### 2.3 Late Join (Joining During `phase='question'`)

**Attack/Scenario:** A student joins after the investigation phase has started and the
host has already advanced to `q_index=1`.

**Current design:** `kcq_case_join` accepts joins in any phase (no phase guard on join).
The joining player receives the current `phase` and `q_index` from `kcq_case_state`. They
can start answering from the current question.

**Risk:** A late joiner has NOT read the source documents (they joined during the question
phase). They are expected to find the answer by reading the sources mid-question (this is
the intended mechanic — sources are always accessible). However, they have had less
investigation time than other players.

**Bigger risk:** A late joiner who already knows the case (from a previous play) can join
mid-question, immediately answer all remaining questions correctly without re-reading
anything, and collect per-answer XP from a session they barely participated in.

**Severity: Low** for XP (per-answer is always-pay design). The case-solve bonus will only
apply if they answer enough questions, and they cannot retroactively answer questions they
missed (they receive 0 correct for those).

**Design gap for teacher UX:** The teacher control panel must clearly show when a student
joined late, so the teacher can decide whether to count the result in the class discussion.
The `display_names` JSONB doesn't track join timestamp.

---

### 2.4 Double-Join with Same Display Name

**Attack:** Two students both enter "Aziz" as their display name and join the same room.

**Design:** `player_id` is generated client-side as a random ID (sessionStorage). Two
different browsers generate different `player_id` values. Both join successfully with
`display_name = "Aziz"`. The `display_names` JSONB will have two entries:
`{ "p1_abc...": "Aziz", "p2_def...": "Aziz" }`.

**Risk:** The leaderboard and CSV export will show two "Aziz" rows with no way to
distinguish them. This is a UX problem for the teacher, not a scoring exploit.

**Required fix:** `kcq_case_join` should validate that `display_name` is unique within
the room. Add a check: `if exists (select 1 from jsonb_each_text(r.display_names) where
value = pname) then return 'duplicate_name'`. The frontend can prompt the student to
choose a different name.

---

### 2.5 Two Clients Sharing the Same `player_id` (Re-join Collision)

**Scenario:** The student uses the "Reconnect" button on a new device (or clears
sessionStorage and re-joins with the same display name, but the `player_id` is regenerated).

**Result:** New `player_id` → new token → treated as a new player slot. The original
player slot (old `player_id`) remains in `player_tokens` with no active client. This is
a ghost player in the roster.

**Severity: Low.** Ghost players score 0 on all remaining questions. They clutter the
leaderboard. They are indistinguishable from genuine players who disconnected.

**Required fix for classroom cleanliness:** Add a `kcq_case_remove_player` host-only RPC
so the teacher can clean ghost players from the roster.

---

### 2.6 Simultaneous `advance_question` Calls

**Attack:** Two teacher sessions (e.g. browser + projector display) both tap "Next
Question" within milliseconds of each other.

**Design guard:** `kcq_case_advance_question` takes a `for update` lock on the room row
AND checks `r.phase not in ('investigation', 'reveal')`. Once the first call advances to
`phase='question'`, the second call hits the phase guard and returns `reason: 'phase'`.

**CONFIRMED SAFE.** Phase guard serialises double-advances.

---

### 2.7 The 35-Student Hub-and-Spoke — Subscription Fan-Out

**Design concern:** 35 students subscribing to `postgres_changes` on `kcq_case_rooms`
all receive the SAME row update event. This is fan-out from one DB write to 35 Supabase
Realtime connections. Each student's answer also updates the room row (bumping `revision`
and `scores`), triggering another fan-out event to all 35 subscribers.

**Load:** In a worst-case synchronised answering burst (all 35 answer within 3 seconds),
there are 35 `kcq_case_answer` writes × 35 subscriber fan-outs = 1,225 Realtime events
per question. Over 6 questions = 7,350 events per match.

**Severity: Medium performance.** Within Supabase's free and pro tier limits for a single
classroom, but potentially noisy and slow for Supabase's free-tier realtime quotas. Must
be load-tested before classroom launch.

**Mitigation in design:** The `scores` JSONB update on every answer triggers a row
revision bump, which triggers a Realtime event for all 35 students. Consider batching the
score update: only write to the room row once when ALL players have answered, rather than
on each answer. This requires a separate `kcq_case_answers_submitted` counter.

---

## 3. Reward / Ranking Validation

### 3.1 `caseXp` Detective Rank Inflation

**Attack vector (Design gap):** `kcq_case_save_progress` accepts `p_case_xp` as an
unchecked client-supplied value. A logged-in student who knows their `session_token` can
call this RPC with `p_case_xp = 9001` and jump directly to Master Sleuth rank.

**Cross-reference §1.7.** This is the same `p_case_xp` inflation exploit.

**Required fix:** Remove `p_case_xp` from the client-facing RPC signature entirely. The
XP to store should be computed server-side: derive it from `p_stars` using the locked
economy table (1★=40, 2★=80, 3★=120), apply the anti-farm delta against `best_stars`
already stored, and never accept a client-supplied XP value.

---

### 3.2 First-Case-of-Day Can Be Claimed in Multiple Modes Simultaneously

**Attack:** Student starts a Bot Practice case AND joins a Private Room with the same case
simultaneously (two browser tabs). Both complete. Both call `caseMatchEnd()` with
`isFirstCaseToday = true`. If the store's `lastCaseDay` check is not atomic, both grants
succeed.

**Design (localStorage):** Both tabs share the same `localStorage` via the `kcq.v2` key.
Zustand's `persist` middleware uses `storage.setItem` which is synchronous in browsers.
However, two React instances in two tabs do NOT share in-memory Zustand state — they each
have their own store instance that reads from localStorage on hydration. A simultaneous
write from two tabs can cause a last-write-wins race where both grant the first-case bonus.

**Severity: Low.** Requires deliberate simultaneous multi-tab play. But in a school
computer lab, students may have multiple tabs open. The gain (+30 XP, +6 coins) is small.

**Mitigation:** The `caseFirstOfDay()` store action must re-read `lastCaseDay` at the
moment of write (not at the moment of render), similar to how `claimDaily()` works with
`get().lastDailyClaim === today` inside the action body.

---

### 3.3 Streak Multiplier Abuse

**Attack:** A student who has built a 4+ correct streak in a match deliberately
disconnects and rejoins. Do they retain the streak?

**Design:** The `streaks` JSONB in `kcq_case_rooms` stores `{ player_id: streak_count }`.
On disconnect, the streak is preserved in the DB. On reconnect, `kcq_case_state` returns
the current `scores` but NOT the `streaks` JSONB (it is excluded from
`kcq_case_room_payload`). The student's client cannot read their own streak count from
the payload.

**DESIGN GAP:** `kcq_case_room_payload` excludes `streaks` — meaning the reconnecting
student's UI cannot show their current streak. The UI spec shows a streak indicator
(`████████░░░░ Score: 145`). If the streak is not in the payload, how does the client
know what multiplier to display?

**Exploit assessment:** The streak state is authoritative server-side. The client display
is cosmetic. A student cannot fake a streak because `kcq_case_answer` reads from
`r.streaks ->> pid` which is DB-authoritative. The display discrepancy is a UI bug, not a
security bug.

**Required fix:** Add `streaks` to the client payload for the current player only (not all
players — other players' streaks are private). OR add `my_streak` to the `kcq_case_answer`
response so the client updates streak display after each answer.

---

### 3.4 Leaderboard Manipulation via `kcq_case_save_progress` Repeat Calls

**Attack:** A student calls `kcq_case_save_progress` 100 times with valid `p_stars=3` for
different `case_id` values they haven't actually completed.

**Design guard:** `kcq_case_answers` is seeded with exactly the 5 launch cases. Only
those case IDs exist in the DB. But `kcq_case_save_progress` does NOT validate that
`p_case_id` exists in `kcq_case_answers` — it upserts directly into `kcq_case_progress`.

**CONFIRMED EXPLOIT:** A student can call `kcq_case_save_progress(token, 'invented-case-id', 3, 120)` and fabricate progress for cases that do not exist. The `kcq_case_leaderboard`
view counts all rows in `kcq_case_progress` where `best_stars >= 1` — including fabricated ones.

**Severity: High.** Leaderboard is directly exploitable.

**Required fix:** Add a validation check in `kcq_case_save_progress`:
```sql
if not exists (select 1 from public.kcq_case_answers where case_id = p_case_id limit 1) then
  return jsonb_build_object('ok', false, 'reason', 'unknown_case');
end if;
```

---

## 4. Offline Degradation

### 4.1 Bot Practice With No Supabase

**Expected:** Bot Practice works 100% offline. No RPC calls. `botEngine.ts` handles all
simulation. Progress saved to localStorage via `caseMatchEnd()`.

**Attack surface:** `caseMatchEnd()` calls `kcq_case_save_progress` (cloud save) as a
side effect. If Supabase env is absent, `src/lib/supabase/client.ts` returns `null` —
the cloud save silently no-ops (mirrors `codecaster/cloud.ts` pattern).

**Test case:** Verify `caseFiles/cloud.ts` follows the `codecaster/cloud.ts` pattern
exactly: `const sb = getSupabase(); if (!sb) return;` at the top of every cloud function.

**Risk:** If `cloud.ts` is implemented incorrectly (e.g. throws on null client), Bot
Practice crashes on a user with no Supabase env. This is the same class of bug found
historically in the Arena cloud transport.

**Required verification:** `cloud.ts` must be reviewed at implementation time.

---

### 4.2 Multiplayer Offline — Explicit Error, Not Silent Hang

**Expected:** On mount of `/case/[code]`, if `!isCloudEnabled()`, show
"Multiplayer requires a connection" immediately without attempting any RPC.

**Attack surface:** If `useCaseRoom` attempts to create a Supabase Realtime channel before
checking `isCloudEnabled()`, it may throw or produce an unhandled promise rejection when
`getSupabase()` returns null.

**Required fix:** `useCaseRoom.ts` must call `isCloudEnabled()` as its FIRST action, before
any Supabase import or channel creation. Mirror the `useParty.ts` offline gate pattern
exactly.

---

### 4.3 Offline Progress Reconciliation on Cloud Return

**Scenario:** A student completes Bot Practice cases offline (no Supabase). Later they log
in to a student account. `applyToStore` (from `src/lib/supabase/account.ts`) overwrites
the local Zustand store with the cloud snapshot.

**Risk:** The cloud snapshot has no Case Files progress (never saved online). The local
store has Bot Practice stars. `applyToStore` overwrites local progress with cloud state,
discarding the offline Bot Practice results.

**Design note:** This is the same "cloud is authoritative" conflict documented in the
existing codebase. The fix is: `applyToStore` must merge (take the MAX of) each Case Files
counter rather than overwriting. This mirrors how `codecaster` records should be merged.

**Severity: Medium UX.** Students who grind offline then log in lose their progress.
Not a security issue but a retention killer.

---

## 5. Test Plan

### 5.1 Pure-Logic Vitest Tests (implement FIRST — P0/P1)

These tests use no Supabase and run in the existing Vitest environment.

#### TC-STORE-01: `caseMatchEnd` Anti-Farm Delta
**Test ID:** TC-STORE-01
**Description:** `caseMatchEnd(caseId, stars)` pays only the delta on replay.
**Preconditions:** Store initialized with `bestCaseStars['case-museum-heist'] = 1` (40 XP already earned).
**Steps:**
1. Call `caseMatchEnd('case-museum-heist', 2)`.
2. Assert XP delta = 80 - 40 = 40 (not full 80).
3. Call `caseMatchEnd('case-museum-heist', 2)` again.
4. Assert XP delta = 0 (no improvement).
5. Call `caseMatchEnd('case-museum-heist', 3)`.
6. Assert XP delta = 120 - 80 = 40.
**Expected:** Deltas match 40/0/40 respectively.
**Priority:** P0 — build-blocking; this action does not exist yet.

#### TC-STORE-02: `caseXp` Counter Isolation
**Test ID:** TC-STORE-02
**Description:** `caseAnswerCorrect()` does NOT increment `caseXp`; only `caseMatchEnd()` does.
**Steps:**
1. Record initial `caseXp`.
2. Call `caseAnswerCorrect()` 6 times (one full case).
3. Assert `caseXp` is unchanged.
4. Call `caseMatchEnd('case-x', 3)`.
5. Assert `caseXp` increased by the delta for 3 stars.
**Priority:** P0.

#### TC-STORE-03: First-Case-of-Day Isolation From `claimDaily`
**Test ID:** TC-STORE-03
**Description:** First-case bonus and `claimDaily` are independent.
**Steps:**
1. Call `claimDaily()` — succeeds.
2. Call `caseFirstOfDay()` — must also succeed (different counter).
3. Call `caseFirstOfDay()` again same day — must return null.
4. Check next day (set `lastCaseDay` to yesterday) — succeeds again.
**Priority:** P0.

#### TC-STORE-04: `classroomCaseTournamentWins` Only Increments in Classroom Mode
**Test ID:** TC-STORE-04
**Description:** Calling `caseMatchEnd(..., { mode: 'bot' })` never increments `classroomCaseTournamentWins`.
**Steps:**
1. Call `caseMatchEnd('case-x', 3, { mode: 'bot', placement: 1 })`.
2. Assert `classroomCaseTournamentWins` = 0.
3. Call `caseMatchEnd('case-x', 3, { mode: 'classroom', placement: 1 })`.
4. Assert `classroomCaseTournamentWins` = 1.
5. Call `caseMatchEnd('case-x', 3, { mode: 'classroom', placement: 2 })`.
6. Assert `classroomCaseTournamentWins` still = 1 (not first place).
**Priority:** P0.

#### TC-STORE-05: `progressLocked()` Gate on `caseMatchEnd`
**Test ID:** TC-STORE-05
**Description:** Guest in cloud mode earns nothing.
**Steps:**
1. Set `isCloudEnabled = true`, `hasStudentSession = false`.
2. Call `caseMatchEnd('case-x', 3)`.
3. Assert XP, coins, caseXp all unchanged.
**Priority:** P1.

#### TC-STORE-06: Hint-Blocked 3-Star in Bot Practice
**Test ID:** TC-STORE-06
**Description:** `caseMatchEnd` with `hintsUsed = true` cannot yield 3 stars.
**Steps:**
1. Call `caseMatchEnd('case-x', 3, { hintsUsed: true })`.
2. Assert stars recorded as max 2, not 3.
3. Assert `caseNoHintSolves` not incremented.
**Priority:** P1.

#### TC-LEVELING-01: `rankForCaseXp` Boundaries
**Test ID:** TC-LEVELING-01
**Description:** Rank transitions at exact thresholds and one below.
**Steps:**
1. Assert `rankForCaseXp(0)` = rank 0 (Cadet).
2. Assert `rankForCaseXp(149)` = rank 0.
3. Assert `rankForCaseXp(150)` = rank 1 (Rookie Detective).
4. Assert `rankForCaseXp(9000)` = rank 7 (Master Sleuth).
5. Assert `rankForCaseXp(-1)` = rank 0 (no negative rank).
6. Assert `rankForCaseXp(Number.MAX_SAFE_INTEGER)` = rank 7 (no overflow).
**Priority:** P1.

#### TC-ACHV-01: Achievement Predicates for Case Files
**Test ID:** TC-ACHV-01
**Description:** Each new achievement fires exactly once and not before threshold.
**Steps (for each achievement):**
1. `case_first_solve`: snapshot with `casesCompleted=0` → false; `casesCompleted=1` → true.
2. `case_first_3star`: `cases3star=0` → false; `cases3star=1` → true.
3. `case_no_hints`: `caseNoHintSolves=0` → false; `caseNoHintSolves=1` → true.
4. `case_streak_3`: `caseStreak=2` → false; `caseStreak=3` → true.
5. `case_rank_sergeant`: `caseXp=799` → false; `caseXp=800` → true.
6. `case_classroom_win`: `classroomCaseTournamentWins=0` → false; `classroomCaseTournamentWins=1` → true.
7. Confirm no double-award on second qualifying state (existing `unlockedAchievements` filter).
**Priority:** P1.

#### TC-CASES-01: Case Content Validation (mirror `levels.test.ts`)
**Test ID:** TC-CASES-01
**Description:** Every seed case is well-formed and solvable.
**Steps:** For each case in `CASES`:
1. Every question has `evidenceSourceId` matching a source in `case.sources`.
2. Every question has `evidencePassage` that is a non-empty string.
3. `gradeBand` is one of `'7-9'|'10-12'|'13-14'`.
4. `questions.length >= 3` (minimum for meaningful scoring).
5. At least one question has `is_cross_ref = true` (2-star gate must be reachable).
6. The case has 3+ source documents.
7. `case_id` exists in `kcq_case_answers` seed data (roundtrip check requires live DB).
**Priority:** P1.

---

### 5.2 RPC Integration Probe Script (mirror `qa-party-rpc.mjs`)

Create `scripts/qa-case-rpc.mjs`. This is the primary automated contract test for all
server-side anti-cheat guarantees. Requires `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.

```javascript
// scripts/qa-case-rpc.mjs
// Run with: node scripts/qa-case-rpc.mjs
// Tests the full kcq_case_* RPC contract against a live Supabase instance.
// All tests must PASS before the migration is considered build-ready.

// PROBE 1: Room Creation
// - kcq_case_create with valid args returns { ok: true, token: uuid }
// - creating with same code within 4 hours returns { ok: false, reason: 'exists' }
// - creating with invalid case_id returns { ok: false, reason: 'unknown_case' }

// PROBE 2: Player Join
// - first join returns new token
// - second join with same player_id returns SAME token (idempotent)
// - join after 8 players → { ok: false, reason: 'full' }
// - join with invalid player_id format → { ok: false, reason: 'bad' }

// PROBE 3: Phase Flow (host token required)
// - start_investigation without host_token → { ok: false, reason: 'auth' }
// - start_investigation with host_token from 'lobby' → { ok: true }
// - start_investigation from non-'lobby' phase → { ok: false, reason: 'phase' }
// - advance_question with host_token → { ok: true, q_index: 0 }
// - advance_question from 'question' phase (not 'reveal') → { ok: false, reason: 'phase' }

// PROBE 4: Answer Anti-Cheat (MOST IMPORTANT)
// - answer with valid player_id + token → { ok: true, correct: bool }
// - answer with wrong token (spoofed) → { ok: false, reason: 'auth' }
// - answer same question twice → second returns { ok: true, duplicate: true }; score unchanged
// - answer when phase != 'question' → { ok: false, reason: 'phase' }
// - answer with wrong q_index → { ok: false, reason: 'phase' }
// - speed_xp is 0-5 range only (never > 5)
// - stars computed correctly: 100% correct + no hints → 3 stars
// - stars computed correctly: 100% correct + hint opened → max 2 stars
// - wrong player_token for valid player_id → rejected

// PROBE 5: Hint Tracking
// - open_hint writes to hints JSONB
// - open_hint twice for same question is idempotent (no double entry)
// - end_match with hint opened → player's stars capped at 2

// PROBE 6: End Match / Star Computation
// - end_match with host_token from 'reveal' phase → { ok: true, results: {...} }
// - results.stars correct for each scenario (0/1/2/3 star conditions)
// - end_match without host_token → { ok: false, reason: 'auth' }
// - p_case_xp in save_progress cannot exceed computed value (CONFIRM THIS IS VALIDATED)

// PROBE 7: Host Resume
// - host_resume with matching host_id + token → { ok: true, token: same_uuid }
// - host_resume with wrong token → { ok: false, reason: 'auth' }
// - host_resume for room older than 8h → { ok: false, reason: 'auth' }

// PROBE 8: kcq_case_save_progress Exploit Checks
// - save_progress with invented case_id → SHOULD return error (currently missing validation)
// - save_progress with p_stars=5 → returns { ok: false, reason: 'bad_stars' }
// - save_progress with p_case_xp=99999 → SHOULD be capped or rejected (currently missing)
// - save_progress twice with same case, lower stars → best_stars does not decrease

// PROBE 9: kcq_case_answers table lockdown
// - Direct SELECT on kcq_case_answers returns RLS error (not accessible by anon/authenticated)
// - No RPC leaks answer_index values
```

**Priority order for implementation:** Probes 4 (Answer Anti-Cheat) and 8
(save_progress Exploits) are P0 — they cover the two confirmed Critical exploits.
Probes 3 and 5 are P1. Probes 1, 2, 6, 7, 9 are P2.

---

### 5.3 Manual / E2E Checklist

#### Classroom Teacher Flow (P0 — test before any classroom demo)

| ID | Test | Expected | Priority |
|---|---|---|---|
| E2E-T01 | Teacher opens /admin/cases, creates room for "Museum Heist" | Room code generated in < 2s | P0 |
| E2E-T02 | 8 students join with unique display names | All appear in teacher roster live | P0 |
| E2E-T03 | 9th student attempts to join | "Room is full" error shown | P0 |
| E2E-T04 | Teacher starts investigation; students see investigation screen | Phase change propagates within 500ms | P0 |
| E2E-T05 | Teacher advances to Q1; all students see question simultaneously | Q1 visible on all devices | P0 |
| E2E-T06 | Student answers; teacher's "Answered: N/8" counter increments | Count correct live | P1 |
| E2E-T07 | Teacher advances to reveal; correct answer shown to all | Correct option highlighted, evidence excerpt shown | P0 |
| E2E-T08 | Teacher refreshes mid-question | Teacher resumes to correct state; students unaffected | P0 |
| E2E-T09 | Teacher ends match | Final results shown to all; CSV downloadable | P0 |
| E2E-T10 | Student on disconnected device reconnects mid-match | State recovered; can answer remaining questions | P1 |
| E2E-T11 | Two students with same display name attempt to join | Second blocked with "name taken" error | P1 |
| E2E-T12 | Teacher downloads CSV | Columns correct: name, score, stars, Q1_correct, Q1_hint... | P1 |

#### Answer Anti-Cheat (P0 — ALWAYS run before any production deploy)

| ID | Test | Expected | Priority |
|---|---|---|---|
| E2E-AC01 | Open DevTools, call `kcq_case_state(code)` — inspect response for answer_index | answer_index NOT in response | P0 |
| E2E-AC02 | Call `kcq_case_answer` directly with wrong player_token | Rejected with `reason: 'auth'` | P0 |
| E2E-AC03 | Call `kcq_case_answer` twice for same question | Second call returns `duplicate: true`, score unchanged | P0 |
| E2E-AC04 | Call `kcq_case_advance_question` without host_token | Rejected | P0 |
| E2E-AC05 | Directly SELECT `kcq_case_answers` via Supabase anon client | RLS error — no rows returned | P0 |
| E2E-AC06 | Call `kcq_case_save_progress` with `p_stars=3, p_case_xp=99999` directly | Should be rejected (exploit — see §1.7) | P0 |
| E2E-AC07 | Call `kcq_case_save_progress` with invented `case_id` | Should be rejected (exploit — see §3.4) | P0 |

#### Bot Practice Offline (P1)

| ID | Test | Expected | Priority |
|---|---|---|---|
| E2E-BOT01 | Disable Supabase env vars; play Bot Practice to completion | No crash; progress saved to localStorage | P1 |
| E2E-BOT02 | Open hint, complete with 100% correct answers | Stars capped at 2 (3-star blocked by hint) | P1 |
| E2E-BOT03 | Answer all questions wrong | Case "unsolved"; no case-solve XP; per-answer XP = 0 | P1 |
| E2E-BOT04 | Play same case twice, improve from 1★ to 3★ | Case-solve delta = 120-40 = 80 XP (not full 120) | P1 |
| E2E-BOT05 | Build streak of 4 correct answers | XP on 4th correct = 15 × 1.5 = 22 XP | P1 |

#### Multiplayer Lobby & Phase (P1)

| ID | Test | Expected | Priority |
|---|---|---|---|
| E2E-MP01 | Create private room; join with 7 friends; host starts | All 8 players in investigation | P1 |
| E2E-MP02 | Player disconnects during investigation; reconnects | Player rejoins cleanly; has full investigation time | P1 |
| E2E-MP03 | Player disconnects during question; reconnects | Player sees current question; reduced time window | P1 |
| E2E-MP04 | Answer arrives after host advances to reveal | UI shows "Too late — host moved on" toast; 0 XP | P1 |
| E2E-MP05 | Private Room with no Supabase env | "Multiplayer requires a connection" shown immediately | P0 |

#### Offline / Connectivity Gate (P0)

| ID | Test | Expected | Priority |
|---|---|---|---|
| E2E-OFF01 | Visit /case with Supabase env absent | Private Room and Classroom cards show offline badge | P0 |
| E2E-OFF02 | Visit /case/[code] with Supabase env absent | "Multiplayer requires a connection" + "Try Bot Practice" CTA, no spinner | P0 |
| E2E-OFF03 | Complete Bot Practice with Supabase env absent | Progress saved to localStorage; no cloud error | P0 |

---

## 6. Critical Issues Summary (Build-Blocking)

### CRITICAL-01: `kcq_case_save_progress` Accepts Client-Supplied `p_stars` and `p_case_xp` Without Server Validation

**File:** `03-BACKEND-ARCHITECTURE.md` §3.13
**Exploit:** Any logged-in student calls `kcq_case_save_progress(session_token, 'case-id', 3, 9999)` to set 3 stars and inflate `caseXp` arbitrarily for any case, breaking Detective Rank and the leaderboard.
**Required fix:** Server-compute the XP delta from `p_stars` and existing `best_stars`; remove `p_case_xp` from client input; add `case_id` existence check.

### CRITICAL-02: 35-Student Classroom Conflicts with 8-Player Hard Cap in `kcq_case_join`

**File:** `03-BACKEND-ARCHITECTURE.md` §3.2, `00-BRIEF.md` §9.3
**Conflict:** The brief locks classroom max at 35. The RPC caps at 8. Classroom Tournament cannot serve its target audience. Must be resolved before any classroom build begins — requires schema redesign (separate `kcq_case_players` table instead of JSONB-per-player).

### CRITICAL-03: `kcq_case_save_progress` Accepts Invented `case_id` Values

**File:** `03-BACKEND-ARCHITECTURE.md` §3.13
**Exploit:** A student fabricates progress for non-existent cases, inflating `total_case_xp` in the `kcq_case_leaderboard` view.
**Required fix:** Add `case_id` existence check against `kcq_case_answers` at the start of `kcq_case_save_progress`.

### HIGH-01: `caseMatchEnd()` Store Action Does Not Exist

**File:** `src/store/useGame.ts`
**Issue:** The `caseMatchEnd()` action required for anti-farm delta, `caseXp` isolation, streak handling, and achievement evaluation is not present. Without it, the store is incomplete and per-case farming is unrestricted.
**Required fix:** Implement `caseMatchEnd(caseId, stars, opts: { mode, hintsUsed, placement })` mirroring `codecasterComplete`.

### HIGH-02: Token Theft on Shared Classroom Devices

**File:** `04-FRONTEND-UX.md` §4.3
**Risk:** `playerToken` and `hostToken` in `sessionStorage` are accessible to any JS on the same browser session. On shared classroom computers, a student can steal another student's token from a neighbouring tab.
**Required action:** Document explicitly in the teacher guide. Investigate whether tokens should be bound to a browser fingerprint or IP (server-side). At minimum, display a persistent "Are you [name]?" confirmation banner when a student joins so name-squatting is immediately visible.

### HIGH-03: `classroomCaseTournamentWins` Can Be Self-Granted in Bot Practice

**File:** `01-PRODUCT-AND-GDD.md` §4.3
**Exploit:** Client-side `caseMatchEnd()` with `mode: 'classroom', placement: 1` increments this counter even in Bot Practice. Achievement `case_classroom_win` and any future rewards tied to classroom wins are exploitable.
**Required fix:** `caseMatchEnd()` must refuse to increment `classroomCaseTournamentWins` if the room data was not confirmed as `is_classroom=true` by a server-authoritative source.

---

## 7. Recommended Fixes (Priority Order)

**Before writing any code (design fixes):**

1. **Remove `p_case_xp` from `kcq_case_save_progress`** and compute server-side from `p_stars`. Add `case_id` existence validation. This single fix closes CRITICAL-01 and CRITICAL-03.

2. **Raise the classroom player cap** from 8 to 35 by replacing the JSONB-per-player storage with a separate `kcq_case_players(room_code, player_id, display_name, token, score, streak, joined_at)` table. This closes CRITICAL-02 and also removes the per-answer `for update` JSONB contention issue for classroom scale.

3. **In `kcq_case_end_match`, write directly to `kcq_case_progress`** for all logged-in players rather than requiring a client round-trip to `kcq_case_save_progress`. This removes the client-forgery window for multiplayer matches.

**During store implementation:**

4. **Implement `caseMatchEnd()` and `caseAnswerCorrect()` store actions** in `useGame.ts` following the `codecasterComplete` pattern. Required parameters: `(caseId, stars, opts: { mode: 'bot'|'private'|'classroom', hintsUsed: boolean, placement?: number, isClassroom?: boolean })`. Anti-farm delta for case-solve XP; `caseXp` counter incremented only here; `classroomCaseTournamentWins` incremented only when `isClassroom && placement === 1`.

5. **Add `lastCaseDay: string | null` to `GameState`** and implement `caseFirstOfDay()` as a separate action from `claimDaily()`, gated by `lastCaseDay`.

6. **Add `my_streak` to the `kcq_case_answer` RPC response** so the client can display the correct multiplier without needing the full `streaks` JSONB in the room payload.

**During RPC implementation:**

7. **Add unique `display_name` constraint within room** in `kcq_case_join`: reject join if `display_name` already exists in `display_names` JSONB.

8. **Add `kcq_case_remove_player` host-only RPC** for ghost player cleanup after disconnect.

9. **Add `reason: 'phase'` handling in `useCaseRoom.answer()`** UI path, showing a "Too late" toast and resetting local answer state when the server rejects a late answer.

**For classroom deployment:**

10. **Load-test the hub-and-spoke Realtime fan-out** with 35 simultaneous connections before classroom launch. Target: all 35 students receive phase changes within 1 second. If not met, consider batching `revision` bumps (only bump on all-answered, not per-answer).

11. **Implement the 4-of-6 question rotation in v1.0, not v1.1**, because the 5-case MVP library makes replay-memorisation trivial from week one. This is the primary anti-memorisation control while the content pipeline ramps up.

---

## 8. QA Score: 42 / 100

**Justification:**

The core multiplayer anti-cheat architecture (server-side answer keys, per-player token, idempotent scoring, `q_opened_at` speed bonus) is well-designed and directly inherits proven patterns from Party and Codecaster. These are genuine strengths.

However, three Critical exploits and two High exploits prevent a higher score:

- `kcq_case_save_progress` accepting client-supplied `p_stars` and `p_case_xp` without validation is a direct leaderboard and rank exploit (Critical).
- The 35-student classroom cap conflicting with the 8-player RPC hard-limit makes the primary institutional use case undeployable (Critical, build-blocking).
- The missing `case_id` existence check in `kcq_case_save_progress` allows fabricated case IDs to inflate the leaderboard (Critical).
- `caseMatchEnd()` store action does not exist (High, build-blocking).
- `classroomCaseTournamentWins` can be self-granted client-side (High).

The score is 42 because: the design has sound principles, the schema and phase machine are largely correct, and every RPC properly gates against host_token abuse. The failures are in the cloud-save trust boundary (where the design explicitly deferred server validation) and the capacity planning conflict (8 vs 35) — both are fixable before build, which is the right time to find them.

---

## 9. Top-5 Must-Fix Exploits + Design Gap for Lead

**Ranked by severity:**

1. **`kcq_case_save_progress` trusts client `p_stars` and `p_case_xp`** — any logged-in student can claim 3 stars and max `caseXp` for any case without playing. Breaks Detective Rank, achievements, and the leaderboard. Fix: server-compute XP from stars + delta; remove the client `p_case_xp` input.

2. **`kcq_case_save_progress` accepts invented `case_id` values** — a student fabricates progress for cases that do not exist, inflating the global leaderboard indefinitely. Fix: add `case_id` existence check against `kcq_case_answers` in the RPC.

3. **35-student classroom cap conflicts with 8-player `kcq_case_join` hard-limit** — the primary institutional use case is technically impossible to deploy. Fix: redesign player storage from JSONB-per-player to a `kcq_case_players` table with a 35-player capacity.

4. **Token theft on shared classroom devices** — `playerToken` in `sessionStorage` is accessible to any JS on the same browser session. In a physical classroom, a student on a shared computer can steal another student's session. Mitigation: display name confirmation UI; teacher guide; investigate IP/fingerprint binding.

5. **`classroomCaseTournamentWins` counter is self-grantable client-side** — the Bot Practice offline path allows a student to increment this counter and unlock the `case_classroom_win` achievement without ever being in a classroom. Fix: `caseMatchEnd()` must refuse the increment if `is_classroom` was not confirmed by a server-authoritative source (the room's `kcq_case_rooms.is_classroom` flag).

**Design gap the Lead must close before build:**

The 8-vs-35 classroom capacity conflict is the highest-priority schema decision because it changes the fundamental data model (JSONB player maps cannot scale to 35 with acceptable Realtime fan-out and row-lock contention). This decision cascades into the RPC redesign, the `for update` locking strategy, and the Realtime subscription model. It cannot be resolved during build — it must be resolved in the migration schema before implementation begins.
