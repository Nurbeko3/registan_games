# 02 — Research Reference (Competitors · Retention · Reading Assessment)

> **Author: Studio Lead** (research agent was blocked — `WebSearch`/`WebFetch` denied this session).
> Written from training knowledge (cutoff ~early 2026). **Every factual claim below is tagged
> `[verify]` and should be live-confirmed before any number is treated as production-accurate.**
> To get a fully web-verified dossier, grant `WebSearch`/`WebFetch` and I'll re-run the research agent.

---

## 1. Competitor teardown

### Kahoot `[verify]`
- **Scoring:** points = correctness × speed. Faster correct answers score more, up to ~1000/question;
  wrong = 0. A **streak bonus** rewards consecutive correct answers.
- **Hook:** big-screen "host + players-on-phones" social energy; podium reveal; music/tension.
- **Steal:** the live podium + streak tension; question-by-question scoreboard reveal.
- **Avoid:** *speed-dominant scoring* — it punishes careful readers and rewards twitch. **We invert
  this**: accuracy-first, speed only as a small capped tiebreaker (brief §1.3).

### Quizizz `[verify]`
- **Scoring:** correctness-weighted with a smaller speed component; **power-ups** (×2, 50-50,
  streak, immunity) add variance and comeback potential. Self-paced "homework" mode decouples from
  the live host.
- **Hook:** memes/feedback after each answer; redemption questions; leaderboard.
- **Steal:** the **self-paced async mode** (maps to our Bot Practice + classroom homework) and
  power-ups as an optional coin sink/comeback mechanic.
- **Avoid:** meme spam that distracts from the learning content.

### Blooket `[verify]`
- **Model:** the *quiz* is the engine; the *game mode* (Gold Quest, Tower Defense, Café…) is a
  reward skin layered on top. Same questions feel fresh across modes.
- **Steal:** **decouple content from presentation** — our Case content should be replayable under
  future mode skins (this validates keeping `Case` data pure and modes as a layer, brief §3/§5).
- **Avoid:** RNG-heavy modes where luck swamps knowledge (steal-other-players mechanics can feel
  unfair to younger kids).

### Gimkit `[verify]`
- **Model:** answer questions → earn in-game **cash** → spend on upgrades/power-ups (an economy
  loop). Team modes; KitCollab content creation.
- **Steal:** the **earn → spend → upgrade** loop maps cleanly to our existing coins/shop. A case
  can feed coins that unlock cosmetics (we already have a shop).
- **Avoid:** pay-to-win-feeling upgrade spirals; keep upgrades cosmetic/cosmetic-adjacent for a
  kids' ed product.

### Reading/detective-learning adjacents `[verify]`
- Products in the "read-a-passage-then-answer" space (reading-comprehension apps, "escape room"
  classroom kits, interactive-fiction learning) consistently show the **document must stay
  reachable during questions** or it becomes a memory test, not comprehension. Confirms brief §4
  ("sources remain openable during questions").

---

## 2. Live multiplayer quiz mechanics — fairness & netcode `[verify]`

- **Late joiners / disconnects:** Kahoot/Quizizz lock a player into the current question and resume
  them on the next — they don't retroactively award missed questions. **Our resume model** (clone
  Party `0006`/`0009`: rejoin reads authoritative `phase`/`q_index`/`scores` from Postgres) is the
  right pattern; a refreshed host or dropped player resumes mid-match without losing score.
- **Question timing authority:** the *server/host* owns the clock. If the client owns timing, kids
  stall to read answers off-screen or game the speed bonus. **We compute speed from the server-side
  question-open timestamp** (brief §6.5).
- **Fast vs slow readers:** speed-weighted scoring measurably advantages fluent readers and can
  *discourage* the struggling readers we most want to help. `[verify — reading-fluency vs
  comprehension literature]`. Our **separate untimed-ish Investigation phase + accuracy-first
  scoring** is the deliberate counter-design. Speed bonus stays ≤ ~30% of a correct answer's value
  and breaks ties only.

---

## 3. Retention / gamification systems `[verify]`

- **Streaks (Duolingo):** daily-streak mechanics are among the strongest documented return-drivers;
  streak-freeze/repair items reduce rage-quit churn when a streak breaks. We already have
  `nextStreak` — wire a **daily case** into it, and consider a coin-priced "streak freeze."
  `[verify — Duolingo streak retention studies]`.
- **Variable reward cadence:** unpredictable small rewards (Quizizz power-ups, Blooket crate-style
  drops) sustain engagement, but for kids keep them **bounded and non-monetized**.
- **Ranks/leagues:** visible tiered progression (Duolingo leagues, our Detective ranks) gives
  medium-term goals between the per-match dopamine and long-term mastery. Data-driven rank list
  (brief §4).
- **Social/classroom loop:** the strongest institutional retention is the **teacher** — a class
  that plays weekly tournaments returns as a cohort. Our Classroom Tournament (reusing the admin
  layer) is the highest-leverage retention surface; prioritize its result/leaderboard polish.

## 4. Reading-comprehension question design `[verify]`

Patterns for fair, non-guessable, document-grounded MCQs:
1. **Evidence-anchored:** every correct answer must be locatable in exactly one source
   (`Question.evidenceSourceId` enforces this). Post-answer, highlight where it was — the teaching
   moment.
2. **Plausible distractors:** wrong options should reflect common misreadings (right source, wrong
   detail; or a detail from the wrong source), not nonsense — that's what trains careful reading.
3. **Mix question types:** literal retrieval → cross-reference (combine two sources) →
   inference (what does the evidence imply?). Tag with `concept` to power the 3rd-star concept gate
   (mirrors Codecaster).
4. **Avoid guessable cues:** don't make the longest/most-specific option always correct; vary
   answer position; avoid "all/none of the above."
5. **Grade-band the text:** lexile-appropriate source length per `gradeBand` (brief §3).

## 5. Safeguarding `[verify]`

- Kids-product privacy regimes (COPPA in the US, GDPR-K / age-appropriate-design in the EU/UK)
  push hard toward **data minimization** and away from anything that models surveillance of real
  people. This independently validates the **scope-lock decision**: *fictional case files only, no
  real personal data*. No real names, photos, or scrapeable personal info in any `SourceDoc`.
- Keep all case content authored/curated; if user-generated cases are ever added (post-MVP),
  they need moderation before they're playable in classrooms.

---

## TL;DR for downstream agents
1. **Invert Kahoot's scoring** — accuracy-first, speed as a small capped tiebreaker. This is the
   core pedagogical differentiator; don't let it erode.
2. **Keep `Case` content pure/data-driven** (Blooket lesson) so modes are a presentation layer.
3. **Server owns the clock and the answer key** — fairness + anti-cheat both depend on it.
4. **Classroom/teacher loop is the top retention surface** — polish the tournament results screen.
5. **Sources stay reachable during questions** — we test evidence-finding, not memory.
6. All numbers here are `[verify]`; grant web tools for a live-confirmed dossier.
