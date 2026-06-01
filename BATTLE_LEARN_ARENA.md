# ⚔️ Battle Learn Arena — Game Mode Design & Implementation

> A competitive team battle mode for **KidsCode Quest** where *getting tagged out
> is the best thing that can happen* — because it opens a learning challenge, and
> answering it is your way back into the fight.
>
> **Golden rule:** a child must **never** feel punished for dying.
> Death = a learning opportunity, dressed up as a power-up.
>
> Status: **shipped & building green** · offline-first · mock-multiplayer today,
> Supabase-Realtime-ready tomorrow · Date: 2026-06-01

---

## 0. TL;DR — what was built

A brand-new `/arena` mode, fully integrated into the existing offline-first
Next.js 15 + Zustand + Framer Motion app. It reuses every existing seam (the
`useGame` store, the achievement engine, the cosmetics/avatars, the kid-friendly
design tokens) and adds a self-contained arena engine.

It's a **real-time top-down shooter** (Counter-Strike / Brawl-Stars style): the
child actually moves, aims, takes cover, and fires — rendered on an HTML5
`<canvas>` with a `requestAnimationFrame` game loop. React drives only the
surrounding HUD, lobby, and learning/results overlays.

| Layer | Files |
| --- | --- |
| **Types** | `src/lib/arena/types.ts` |
| **Content (data)** | `src/data/arenaQuestions.ts` · `src/data/arenaModes.ts` |
| **Question engine (pure)** | `src/lib/arena/questionEngine.ts` |
| **Shooter engine (pure)** | `src/lib/arena/engine.ts` ⭐ movement · AI · bullets · collisions · HP |
| **Renderer (pure)** | `src/lib/arena/render.ts` — draws the world to a 2D canvas |
| **Game component** | `src/components/arena/ArenaGame.tsx` ⭐ canvas loop + controls + match flow |
| **UI** | `src/components/arena/{ArenaHUD,LearningPanel,QuestionRenderer,MatchResults}.tsx` |
| **Route** | `src/app/arena/page.tsx` (lobby → match) |
| **Store** | `useGame` gains `arenaAnswerCorrect` + `arenaMatchEnd` + 4 persisted stats |
| **Meta** | 3 new achievements · new `⚔️ Arena` tab in `BottomNav` |

---

## 1. Full game design

### Core fantasy
Kids join a colorful team battle (no violence — it's a high-energy game of *tag*).
Two teams, **🦊 Red Foxes** vs **🐳 Blue Whales**, race to a score target. When
your hero is tagged out, you don't sit and spectate — you drop into a **Learning
Pod**. Answer the question → **respawn instantly** with XP and coins. Miss it →
a friendly tip appears, your respawn pod "charges" for a few seconds, and a
**fresh** question arrives. You always have a path back. You always learn something.

### The main loop
```
        ┌─────────────────────────────────────────────────────────┐
        │                      ARENA MATCH                         │
        │                                                          │
   ┌────────────┐ eliminated  ┌──────────────┐  correct  ┌───────────┐
   │  PLAYING   │ ──────────▶ │ LEARNING POD │ ────────▶ │  RESPAWN  │
   │ move/aim/  │             │  (question)  │           │ +XP +💰   │
   │ shoot · HP │ ◀────────── └──────────────┘ ◀───────┐ └───────────┘
   └────────────┘   respawn          │  wrong          │
        ▲                            ▼                 │
        │                   ┌──────────────────┐       │
        │                   │ TIP + 8s charge  │───────┘ new question
        │                   │ (no XP, no shame)│
        │                   └──────────────────┘
        │
        └──── team hits the score target ──▶  RESULTS (XP, accuracy, coins)
```

**You actually play it:** you run around the arena with a movement stick, aim
with the fire stick (or mouse), shoot enemy fighters, and duck behind cover.
Enemy bots chase, strafe, take cover, and shoot back. Lose all your HP and you're
eliminated → the Learning Pod opens.

### Why it teaches *and* stays fun
- **Stakes:** the battle keeps running while you're in the pod, so answering
  quickly matters — that's the competitive pull.
- **No dead ends:** a wrong answer never ends your match; it teaches, then
  re-rolls. The pod *always* recharges.
- **Positive framing everywhere:** "Almost — here's the trick!", "You've got
  this!", a 🎓 graduation cap even on a loss, and a results screen that
  celebrates *accuracy and XP*, not just the scoreline.

### Question categories (all six in the bank)
Programming · Logic · Mathematics · Algorithms · Web Development · AI Basics.

### Difficulty scaling (from the brief)
Driven purely by player level via `difficultyForLevel(level)`:

| Player level | Difficulty |
| --- | --- |
| 1–4 | easy |
| 5–14 | medium |
| 15+ | hard |

The engine prefers the target difficulty and gracefully widens if a pool runs dry.

---

## 2. Component architecture

```
app/arena/page.tsx ─ lobby (pick mode + team size) ─▶ <ArenaGame config>
                                                          │
        ┌───────────────────────────────┬─────────────────┴───────────┐
        ▼                               ▼                               ▼
   requestAnimationFrame loop      <ArenaHUD>                      <LearningPanel>
   ├─ step(world)  (engine.ts)     team scores + race bars         (modal when
   ├─ drawWorld()  (render.ts)                                      phase==='learning';
   └─ <canvas> + pointer/keys                                       canvas blurred)
                                                                         │
                                                                         ▼
   on hero eliminated ─▶ phase 'learning'                          <QuestionRenderer>
   on win ─▶ phase 'ended' ─▶ <MatchResults>                       (6 question types)
```

**Design choices that match the codebase:**
- The real-time sim lives in **pure modules** (`engine.ts` = logic, `render.ts`
  = drawing) so they're testable and could later run authoritatively on a server.
- `ArenaGame` owns the canvas, the rAF loop, the input, and the match flow —
  the role `GameShell` plays for single-player games.
- **Per-frame state stays in refs** (`worldRef`, `ctl`, `phaseRef`), so the
  60fps loop never triggers React re-renders; React state changes only on real
  events (score, phase, question) — keeping it smooth.
- The canvas is **blurred** (`blur-sm brightness-90`) while the pod is open.
- Only **static** Tailwind class strings are used (e.g. `text-bubble-600`),
  never `text-${accent}-600`, so the JIT compiler picks them up.

---

## 3. State management design

The in-match world (positions, HP, bullets, scores) lives in a **`worldRef`**
mutated by the engine each frame — never in React state, so 60fps causes zero
re-renders. Persistent progress stays in the existing **`useGame` Zustand store**
so arena XP/coins/achievements flow through the *same* economy the rest of the
game uses (and persist to `localStorage["kcq.v2"]`, syncing to Supabase when enabled).

### Match state machine (`ArenaPhase`)
```
intro ──(3·2·1·GO)──▶ playing ──(eliminated)──▶ learning ──(correct)──▶ playing
                         │                          │
                    (target hit) ──────────────────┴──▶ ended
```
`LearnState` is a sub-state of `learning`: `answering → correct` (respawn) or
`answering → wrong-cooldown → answering` (new question).

### Why refs?
The game runs on `requestAnimationFrame`. The `worldRef`, the input ref (`ctl`),
and `phaseRef` let the loop read/write fresh values every frame without stale
closures or re-renders. React `setState` fires only on **events** the player
should *see* change: the score, the phase, a new question. (The score-sync uses
a `lastScores` ref to avoid setting state every frame.)

### Store additions (persisted)
```ts
arenaMatches, arenaWins, arenaCorrect, arenaBestElims   // lifetime stats
arenaAnswerCorrect(difficulty) → { xp, coins }          // per correct answer
arenaMatchEnd({ won, correct, elims }) → { bonusXp, bonusCoins, newAchievements }
```
Both actions run the **existing** achievement predicates against a draft
snapshot, so arena badges pop through the same `Celebrations` overlay as the
rest of the game — zero new plumbing.

---

## 4. Arena system design (the shooter, `engine.ts`)

- **A logical world** (`720×440` units) with cover **obstacles**, two team
  **bases**, `Fighter`s, and `Bullet`s. The canvas scales the world to fit any
  screen (DPR-aware for retina crispness).
- **`step(world, dt, now)`** is the heart: it moves the hero from input, runs
  bot AI, spawns/advances bullets, resolves circle-vs-rect collisions, applies
  damage, handles eliminations + bot respawns, and returns `{ kills, heroDied }`.
- **Bot AI** finds the nearest enemy, closes to a preferred range, **strafes**
  when too close, takes shots only with a **clear line of sight** (cheap sampled
  LOS so they don't shoot through walls), and **wanders** when no enemy is near.
- **Real combat numbers:** 100 HP, 25 dmg/hit (4 hits to down), hero fires every
  260ms, bots ~950ms, bullets live 1.4s. All tunable constants at the top of `engine.ts`.
- **Controls** (`ArenaGame`): twin-stick on touch (left = move, right = aim+fire;
  a quick tap auto-aims the nearest enemy) and **WASD + mouse-aim + click/Space**
  on desktop. Unified via the Pointer Events API, branching on `pointerType`.
- **Pacing per mode** comes from `targetScore` in `arenaModes.ts`.

---

## 5. Team mechanics

- Two fixed teams, `red` / `blue`, defined in `TEAMS` with name, emoji, and an
  accent token (`bubble` / `sky`). The hero leads the Red Foxes (left base);
  bots fill the rest of both rosters with friendly animal skins (🦊 / 🐳).
- Team size is chosen in the lobby: **3v3 / 5v5 / 10v10**.
- The **`ArenaHUD`** shows both tallies and two **race bars** filling toward the
  target — instant read on who's winning.
- **Every elimination scores for the shooter's team** (`world.scores[team]++`)
  and bumps that fighter's personal tally; the match ends the instant a team hits
  `targetScore`. Your personal eliminations feed the post-match scoreboard.

### The four modes (`ARENA_MODES`)
| Mode | Emoji | Target | Point unit | Feel |
| --- | --- | --- | --- | --- |
| **Team Tag-Out** (deathmatch) | ⚔️ | 30 | tag-outs | fast, classic |
| **Capture the Flag** | 🚩 | 5 | captures | slower, swingy ticks |
| **King of the Hill** | 👑 | 20 | hill ticks | rapid trickle |
| **Knowledge War** | 🧠 | 24 | tag-outs | `learnToRespawn: true` |

All four share one engine; they differ only in pacing, the win target, and the
word used for a point. **Knowledge War** flags `learnToRespawn` — the mode where
the *only* way back is a correct answer (which is already the universal rule, so
it's the "purest" learning mode).

---

## 6. Respawn mechanics

| Outcome | What happens |
| --- | --- |
| **Correct answer** | Respawn **immediately** at your base with full HP · `arenaAnswerCorrect` grants XP + coins by difficulty (8/14/22 XP, 4/7/11 coins) · confetti + reward chips · back to `playing`. |
| **Wrong answer** | **No XP** (per brief) · a warm teaching tip (`explain`) · the respawn pod "charges" for `WRONG_COOLDOWN_MS` (8s) · then a **fresh** question loads. Never a loss, never a dead end. |

The 8s cooldown is the brief's "wait, then another question appears", tuned
gentle for kids (the brief's 15s is the upper example). While the pod is open the
**action freezes** and the battlefield blurs, so the child focuses on learning
and is never double-eliminated — the respawn is the reward for getting it right.

---

## 7. Educational question engine

`src/data/arenaQuestions.ts` is a flat, append-only array — adding a question is
one line. `src/lib/arena/questionEngine.ts` does the thinking:

- **`pickQuestion({ level, exclude, categories })`** — difficulty by level,
  optional category filter, avoids ids already used this match.
- **`prepare(q)`** — randomizes presentation every time (anti-cheat-learning):
  - `mcq` / `code-fill` / `truefalse`: **options shuffled**, correct index tracked.
  - `order`: display order shuffled; correct order is the authored order.
  - `debug` / `binary`: already varied by their nature.
- **`isCorrect(prepared, response)`** — one pure grader for all six types.

### Six question types (all implemented in `QuestionRenderer`)
1. **Multiple Choice** — tap an option.
2. **True / False** — special two-option MCQ (order randomized).
3. **Code Completion** — choose the token that fills the `⬜` in a code block.
4. **Debug Challenge** — tap the buggy line in a numbered listing.
5. **Drag-and-drop / Order** — tap blocks into the correct sequence (mobile-first
   tap-to-build, with Reset + Check).
6. **Binary Challenge** — flip 5 bits (0–31) to match the target (reuses the
   beloved `BinaryChallenge` mechanic).

### Anti-cheat learning
- Question pool is large and **freely expandable** (append to the array).
- **Answer/option order is randomized on every presentation.**
- A per-match `usedIds` set prevents repeats; it recycles once well-used.

---

## 8. Reward system

| Event | XP | Coins | Notes |
| --- | --- | --- | --- |
| Correct answer (easy) | +8 | +4 | scales with difficulty |
| Correct answer (medium) | +14 | +7 | |
| Correct answer (hard) | +22 | +11 | |
| **Wrong answer** | **0** | **0** | per the brief — no XP for wrong |
| **Match win bonus** | +50 | +30 | applied in `arenaMatchEnd` |
| New achievement | +25 | +15 | same as the rest of the game |

All XP funnels into the existing leveling curve and HUD, so the arena makes the
player's global level/avatar/leaderboard standing go up — one unified economy.

---

## 9. Achievement ideas (3 shipped, predicate-only — trivially extendable)

| Code | Title | Unlock |
| --- | --- | --- |
| `ARENA_ROOKIE` | Arena Rookie ⚔️ | Win your first Arena match |
| `ARENA_SCHOLAR` | Battle Scholar 📚 | Answer 25 Arena questions correctly |
| `ARENA_LEGEND` | Arena Legend 🥇 | Win 5 Arena matches |

The `AchievementSnapshot` was extended with `arenaWins` + `arenaCorrect`, so
future ideas are one-liners, e.g.:
- **Comeback Kid** — win after trailing by 5+.
- **Polymath** — answer a question right in all six categories in one match.
- **Flawless Mind** — finish a match with 100% accuracy (5+ answered).
- **Speed Learner** — respawn within 3s of being tagged.
- **Knowledge Warlord** — win a Knowledge War match.

---

## 10. Future multiplayer roadmap

The mode is **offline-first today** (real-time play vs AI bots, zero setup). The
engine was built so real multiplayer is a *drop-in*, mirroring the existing
`useParty` Supabase Realtime pattern.

**Phase 1 — Realtime rooms (reuse the `useParty` blueprint)**
- The bots are just the `Fighter`s in `world.fighters` whose `id !== 'hero'`.
  For netcode, replace the bot-AI branch of `step()` with **remote players**: a
  Supabase channel where **Broadcast** carries each client's input/position and
  fire events, while one authoritative host (or an Edge Function) runs `step()`
  and broadcasts the world snapshot. `render.ts` and the UI stay untouched.
- Client-side prediction + the existing input ref make interpolation
  straightforward, since the world is already a plain serializable struct.

**Phase 2 — Matchmaking & rooms**
- Lobby table (`arena_rooms`) + a `find_match` RPC to auto-place players into a
  red/blue slot by skill/level. Room codes already exist as a pattern in `/party`.

**Phase 3 — Global rankings**
- Add `arena_elo` / `arena_wins` columns to the existing `progress` table and a
  `arena_leaderboard` view (the SQL pattern is already documented in `STATUS.md`
  §6.4). Surface it on the existing `/leaderboard` page.

**Phase 4 — Server-validated questions (anti-cheat at scale)**
- Move `pickQuestion`/`isCorrect` behind an Edge Function so answers are graded
  server-side and the answer key never ships to the client — the same seam as
  the planned real AI mentor (`getHint`).

**Kid-safety carries over for free:** anonymous auth, RLS isolating each child,
display-name-only leaderboards (all per `STATUS.md` §6.5/§6.10).

---

## How to play (manual test)

```bash
npm run dev      # http://localhost:3000/arena
```
1. Open the **⚔️ Arena** tab.
2. Pick a mode + team size → **Enter the arena**.
3. **Move** with the left stick (or WASD), **aim & shoot** with the right stick
   (or mouse + click/Space). Hide behind cover, blast the enemy team.
4. When your HP hits zero you're eliminated → answer in the **Learning Pod** to
   respawn. Miss one → read the tip, wait for the pod to charge, answer the next.
5. First team to the target score wins → **Results** show your eliminations,
   quiz accuracy, and XP/coins earned.

> Verified: `npm run build` passes — `/arena` prerenders at ~15.3 kB
> (163 kB first load), in line with the existing `/play/[game]` route.
