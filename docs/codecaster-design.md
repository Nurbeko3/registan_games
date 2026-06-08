# Codecaster — Python Dungeon Learning Game (System Design)

> **Working title:** *Codecaster* (a young "code-caster" casts Python "spells" to move through a dungeon). Alternatives: *Code Crawler*, *PyDungeon*, *Loop Knight*. **All names, maps, characters, art, and text are original.** This is a genre (write-code-to-move-a-hero), which is not protected — we copy **nothing** from CodeCombat (no levels, names, maps, sprites, or copy).
>
> This document is the canonical design for integrating an original Python dungeon game into **KidsCode Quest**. It is written to fit the existing architecture (Zustand single-source store, data-driven content, deterministic engine + thin renderer, Supabase strictly additive), **not** to bolt on a parallel app.

---

## 0. Executive summary & the three decisions that matter

The brief proposed Phaser + Monaco + Pyodide + Supabase-authoritative. Against this platform's real constraints (offline-first, tablet/mobile, ages 7–14, cloud strictly additive), I recommend **three deviations** and explain each below. Everything else in the brief is adopted.

| Area | Brief proposed | Recommendation | Why |
|---|---|---|---|
| Python runtime | Pyodide **or** Skulpt | **Skulpt for MVP**, behind a `PyRunner` interface so Pyodide can power "advanced" levels later | Pyodide = 6–10 MB WASM + slow cold start → breaks offline-first & kills tablet UX. Skulpt is small, pure-JS, naturally sandboxed, offline. |
| Code editor | Monaco | **CodeMirror 6 for MVP**; Monaco only as a desktop "pro" toggle later | Monaco is heavy and poor on touch. CodeMirror 6 is light, touch-friendly, has a Python mode, tree-shakes well. |
| Renderer | Phaser.js | **Renderer-agnostic engine** (`engine.ts`) + start with a **Canvas2D/DOM-grid** renderer; Phaser becomes an optional richer renderer later | Grid movement doesn't need Phaser's weight; the existing `ForestTrail` already does grid "program the fox" in React. Keep the engine framework-free like `lib/arena/engine.ts`. |

**The one architectural idea that ties it all together:** the Python interpreter does **not** drive the animation. It compiles the student's code into a deterministic **command queue** (`['moveRight','collect:coin','attack:goblin', ...]`). A framework-free **engine** consumes that queue step-by-step and emits **frames + events**. A thin **renderer** draws frames. This split (copied from `lib/arena/engine.ts` ↔ presentation) gives us: deterministic playback, unit-testability, **and** the ability to **re-run the exact same engine on the server to validate a win** (the cornerstone of anti-cheat — see §7).

---

## 1. Gameplay

### 1.1 World model — grid

* The dungeon is a **grid of tiles** (`cols × rows`, typ. 6×6 → 12×12). Each tile is one of: `floor`, `wall`, `pit` (trap), `spike` (timed trap), `door`, `goal`, `chest`.
* Tiles hold at most one **entity**: `hero`, `enemy`, `coin`, `gem`, `key`, `chest`, `boss`.
* **One command = one tile of movement** (or one action). Movement is **turn-based / step-based**, not real-time physics — this is what makes student code map 1:1 to visible steps and makes the engine deterministic.

### 1.2 Hero

* Original character: **Pip**, an apprentice code-caster (a small robed kid with a glowing keyboard-staff). Has `hp` (default 3), `position {x,y}`, `facing`.
* Hero API exposed to Python (the "spellbook"):

```python
hero.moveRight()      hero.moveLeft()      hero.moveUp()      hero.moveDown()
hero.move(direction)  # "right" | "left" | "up" | "down" | variable
hero.attack("enemy")  # attacks the entity in the faced/adjacent tile
hero.collect("coin")  # picks up coin/gem/key on/adjacent to hero
hero.useKey()         # opens an adjacent door if hero has a key
hero.wait()           # skip a turn (used with timed spikes)
hero.say(text)        # prints to the mission log (teaches print-like output)

# Sensors (unlock at the conditionals band, level ~18):
hero.canMove(direction) -> bool
hero.seeEnemy()         -> bool
hero.seeCoin()          -> bool
hero.health()           -> int
hero.nearbyEnemy()      -> "goblin" | None
```

> Design rule: **introduce API surface progressively.** Levels 1–5 only know `moveX()`. Sensors don't exist (are hidden) until conditionals are taught, so students can't "peek ahead" into syntax they haven't learned.

### 1.3 Enemies

* `goblin` (hp 1, stationary), `slime` (hp 2), `bat` (patrols a fixed path — introduces the need for loops/conditionals), `guard` (blocks a door until defeated).
* Enemies act on **their turn** after the hero's step (turn order is deterministic: hero step → enemy reactions → resolve). Contact damage or a missed `attack` costs hero `hp`.

### 1.4 Collectibles & gates

* **Coins** → in-game currency (feeds platform `coins`). **Gems** → rarer, bonus. **Keys** → consumed to open **doors**. **Chests** → reward burst (coins + cosmetic shard), sometimes locked behind a key.

### 1.5 Traps

* **Pit**: instant fail if stepped on (teaches reading the map / careful sequencing).
* **Spikes**: toggle on/off on a fixed period (e.g., every 2 turns). Crossing on an "on" turn damages; `hero.wait()` + loops + `if` teach timing.

### 1.6 Boss levels

* Every 10th level (`L10`, `L20`, `L30`) is a **boss**. Bosses have multi-hit `hp`, a telegraphed attack pattern, and require **combining** the band's concepts (e.g., loop to dodge + conditional to strike when vulnerable + a function to repeat the combo).

### 1.7 Win / lose conditions

* **Win** = level's `victory` predicate true when the command queue finishes (e.g., `hero on goal`, `all coins collected`, `boss.hp == 0`). Stars are graded:
  * ⭐ win at all.
  * ⭐⭐ win **and** under a "par" line count / no wasted moves.
  * ⭐⭐⭐ win **and** used the **target concept** (e.g., a real `for` loop, not 8 copied `moveRight()` calls) — enforced by static checks on the AST/command pattern.
* **Lose** = hero `hp == 0`, stepped in a pit, queue ends without satisfying victory, or runtime/syntax error (shown in the Error panel, not a "fail" punishment).

---

## 2. Python learning model

A strict **concept ladder**. Each band unlocks new syntax **and** new hero API; nothing appears before it's taught.

| Band | Levels | Python concept | Unlocked in-game |
|---|---|---|---|
| A | 1–5 | statements, function calls, the Run loop, comments `#` | `moveX()` |
| B | 6–9 | sequences, ordering, `hero.say()` (print) | `collect`, `useKey` |
| C | 10–12 | **variables** (`steps = 3`), reuse | parametric moves |
| D | 13–17 | **loops** (`for i in range(n)`, `while`) | patrolling enemies, long corridors |
| E | 18–21 | **if / elif / else**, booleans, comparison | sensors (`seeEnemy`, `canMove`) |
| F | 22–25 | **functions** (`def`), parameters, return | repeatable combos |
| G | 26–28 | **lists** (`path = ["right","up"]`), indexing, iteration | data-driven movement |
| H | 29 | **debugging** (read tracebacks, fix logic) | broken pre-filled code |
| Boss | 10/20/30 | **synthesis** of all prior bands | boss patterns |

**Debugging is a first-class skill**, not an afterthought: the Error panel (§4.8) translates Skulpt tracebacks into kid English ("Python expected a `:` at the end of your `if` line"), and L29 is a dedicated "the code is broken — fix it" level.

---

## 3. The 30 beginner levels

Format per level: **Objective · Map · Concept · Victory · Common mistakes · Hint ladder** (Byte the mentor gives 3 escalating hints).

> Maps below are *ideas* (original layouts); the actual tile arrays live in `src/data/codecaster/levels/`.

### Band A — First spells (sequencing)

**L1 — "First Step"**
- Objective: run a single command. · Map: 1×3 corridor, hero left, goal right, 1 floor between. · Concept: one function call. · Victory: hero on goal. · Mistakes: forgetting `()`, typo `moveright`. · Hints: 1) "Type `hero.moveRight()`." 2) "Functions need `()` at the end." 3) shows the exact line.

**L2 — "Two Steps"**
- Obj: chain two commands. · Map: 1×4 corridor. · Concept: statements run top-to-bottom. · Victory: reach goal. · Mistakes: one move short; both on one line. · Hints: "Each command on its own line."

**L3 — "Turn the Corner"**
- Obj: combine right + down. · Map: L-shaped path. · Concept: order matters. · Victory: reach goal. · Mistakes: wrong order (walks into wall). · Hints: "First go to the corner, then turn."

**L4 — "The Long Hall"**
- Obj: 5 commands in sequence. · Map: long straight + 1 bend. · Concept: longer sequences. · Victory: goal. · Mistakes: miscount tiles. · Hints: "Count the floor tiles to the corner."

**L5 — "Mind the Comment"**
- Obj: use a `#` comment, ignore a decoy. · Map: branch with a dead-end labeled by a comment. · Concept: comments are ignored by Python. · Victory: goal. · Mistakes: thinking the comment runs. · Hints: "Lines starting with `#` are notes for humans, not the hero."

### Band B — Treasure & keys (sequencing+)

**L6 — "Coin Run"** — collect 1 coin then reach goal. Map: coin mid-path. Concept: `hero.collect("coin")`. Victory: coin gathered + goal. Mistake: walking past coin without collecting. Hint: "Stand on the coin's tile, then `collect`."

**L7 — "Three Coins"** — collect 3 coins. Map: zig-zag with coins. Concept: repeated collect (sets up loops later). Victory: 3/3 + goal. Mistake: order/missed coin. Hint: "Collect each coin as you pass it."

**L8 — "Locked Door"** — get key, open door. Map: key left, door blocks goal. Concept: `useKey()`. Victory: door open + goal. Mistake: `useKey` before owning key. Hint: "Pick up the key first."

**L9 — "Speak Friend"** — use `hero.say("open")` at a rune door + reach goal. Map: rune gate. Concept: `say()` = print/output. Victory: goal. Mistake: missing quotes. Hint: "Text needs quotes: `\"open\"`."

### Band C — Variables

**L10 — BOSS: "The Sleeping Golem"** — *(mini-boss, sequencing synthesis)* hit the golem's 3 weak runes in order then exit. Map: arena with 3 marked tiles. Concept: precise sequencing under a step budget. Victory: all 3 + exit. Mistake: wrong order. Hints: escalate to the route.

**L11 — "Name Your Steps"** — `steps = 3`, then move using the idea of a counted distance. Map: corridor length 3. Concept: assign + read a variable. Victory: goal. Mistake: using a string `"3"`. Hint: "A variable stores a value: `steps = 3`."

**L12 — "Reuse the Number"** — same variable used twice (two equal corridors). Map: two equal segments. Concept: variables avoid repetition. Victory: goal. Mistake: changing the number by hand. Hint: "Use `steps` in both places."

### Band D — Loops

**L13 — "Repeat Right"** — `for i in range(4): hero.moveRight()`. Map: 1×5 corridor. Concept: `for` + `range`. Victory: goal. Mistake: missing `:` or indentation. Hints: 1) "A loop repeats a block." 2) "End the `for` line with `:` and indent the body." 3) full snippet.

**L14 — "Loop the Square"** — loop a move+turn pattern around a small ring. Map: 3×3 ring. Concept: loop body with multiple lines. Victory: full lap to goal. Mistake: only one line indented. Hint: "Everything indented under `for` repeats."

**L15 — "Count the Coins"** — `for` over a coin line, collecting each. Map: straight coin line. Concept: loop + action. Victory: all coins + goal. Mistake: collect outside the loop. Hint: "Put `collect` inside the loop."

**L16 — "While There's Floor"** — `while hero.canMove("right"): moveRight()`. Map: variable-length corridor. Concept: `while` + sensor. Victory: goal. Mistake: infinite loop (engine caps steps → friendly timeout). Hint: "Stop when there's no floor: use `canMove`."

**L17 — "Spike Timing"** — loop with `hero.wait()` to cross toggling spikes. Map: spike corridor. Concept: loops + waiting/timing. Victory: cross alive. Mistake: moving on an "on" turn. Hint: "Wait one turn, then move when spikes are down."

### Band E — Conditionals

**L18 — "Look Before You Leap"** — `if hero.canMove("down"): moveDown() else: moveRight()`. Map: forked path. Concept: `if/else`. Victory: goal. Mistake: indentation of `else`. Hint: "`else` lines up with `if`."

**L19 — "Fight or Flight"** — `if hero.seeEnemy(): attack("enemy")`. Map: corridor with 1 goblin. Concept: condition → action. Victory: goal (alive). Mistake: attacking empty air / wrong direction. Hint: "Only attack when you see an enemy."

**L20 — BOSS: "Bridge Troll"** — loop across a bridge, `if` to dodge a swipe (`wait`) and strike when the troll is `vulnerable`. Map: bridge + boss. Concept: loops + conditionals synthesis. Victory: `boss.hp==0` + cross. Mistake: striking during invulnerable phase. Hints: explain the tell, then the loop+if.

**L21 — "Health Check"** — `if hero.health() <= 1: useKey()` (heal shrine) else push on. Map: branching with a heal tile. Concept: comparisons. Victory: goal alive. Mistake: `=` vs `==`. Hint: "Compare with `<=`; a single `=` assigns."

### Band F — Functions

**L22 — "Define a Move"** — `def step(): hero.moveRight()` then call it. Map: corridor. Concept: `def` + call. Victory: goal. Mistake: defining but never calling. Hint: "Defining a function doesn't run it — you must call `step()`."

**L23 — "Combo Spell"** — function bundling move+attack, called at each goblin. Map: 3 goblins. Concept: functions reduce repetition. Victory: all cleared + goal. Mistake: copy-paste instead of calling. Hint: "Call your function 3 times."

**L24 — "Function with a Number"** — `def go(n): for i in range(n): moveRight()`. Map: two corridors of different lengths. Concept: parameters. Victory: goal. Mistake: ignoring the parameter. Hint: "Pass the length: `go(4)` then `go(2)`."

**L25 — "Return the Path"** — function returns a direction used to move. Map: puzzle. Concept: `return`. Victory: goal. Mistake: forgetting to use the returned value. Hint: "Use what the function gives back."

### Band G — Lists

**L26 — "Follow the Map"** — `path = ["right","right","down"]`, loop and `hero.move(d)`. Map: pre-set route. Concept: list + iterate. Victory: goal. Mistake: indexing past the end. Hint: "Loop over the list: `for d in path:`."

**L27 — "Collect the Set"** — list of coin directions; iterate, move + collect. Map: scattered coins. Concept: list-driven actions. Victory: all coins + goal. Mistake: wrong list order. Hint: "The list order is your route."

**L28 — "Pick the Right Door"** — list of door names + `if name == target`. Map: 3 doors. Concept: lists + conditionals + `==`. Victory: correct door + goal. Mistake: comparing to the wrong string. Hint: "Match the name exactly, quotes and all."

### Band H — Debugging & final boss

**L29 — "It's Broken!"** — pre-filled code with 3 planted bugs (missing `:`, wrong indentation, `=` vs `==`). Map: medium dungeon. Concept: read tracebacks, fix. Victory: goal with fixed code. Mistake: rewriting from scratch instead of reading the error. Hints: each hint points at one traceback line in kid English.

**L30 — BOSS: "The Null Dragon"** — capstone. Requires: a `def` combo function, a `for` to repeat it, an `if` on the dragon's `vulnerable` tell, a `list` route to reach each rune, and reading one error. Map: large multi-room arena. Concept: full synthesis. Victory: dragon defeated + escape. Hints: break the fight into the four sub-skills.

---

## 4. UI / UX

### 4.1 Layout (the two-pane core)

```
┌───────────────────────────────────────────────────────────────┐
│ TopBar (existing): coins · XP bar · level · avatar · 🌐 locale  │
├──────────────────────────────┬────────────────────────────────┤
│  GAME WORLD (left, ~55%)     │  CODE (right, ~45%)             │
│  ┌────────────────────────┐  │  ┌──────────────────────────┐  │
│  │ dungeon grid canvas     │  │  │ Mission panel (collapsible)│ │
│  │ hero, enemies, coins... │  │  ├──────────────────────────┤  │
│  └────────────────────────┘  │  │ CodeMirror editor         │  │
│  step indicator · ❤❤❤ · 🪙   │  │  (Python, line numbers)   │  │
│                              │  ├──────────────────────────┤  │
│                              │  │ [▶ Run] [⟲ Reset] [💡 Hint]│ │
│                              │  ├──────────────────────────┤  │
│                              │  │ Output / Error panel       │ │
│                              │  └──────────────────────────┘  │
└──────────────────────────────┴────────────────────────────────┘
```

### 4.2 Level selection
* A **dungeon-map screen**: 30 nodes on a winding path, boss nodes larger, locked nodes greyed with a 🔒. Shows stars per node. Mirrors the existing `/map` zone aesthetic and gating-by-stars pattern.

### 4.3 Game screen
* Left renderer auto-scales to fit (tiles sized to viewport). Hero/enemy sprites animate **one tile per engine step** with Framer Motion easing (or Phaser tween later).

### 4.4 Code editor
* **CodeMirror 6**, Python mode, large touch-friendly font, auto-indent, a kid-friendly theme matching the platform palette. A **command palette** of insertable snippets (`moveRight()`, `for …`) for young/touch users who can't type fast.

### 4.5 Run button
* Runs `PyRunner.compile(code)` → command queue → engine playback **animated** step-by-step (with a speed slider 0.5×–4× and a step/pause control so kids can watch each line execute). Disabled while a run is playing.

### 4.6 Reset button
* Restores the level to its initial tile state and reloads the level's starter code (with a confirm if the student edited a lot).

### 4.7 Hint button — **Byte the mentor** (reuse existing `AIMentor` + `getHint()` seam)
* 3 escalating hints per level (concept nudge → mechanic → near-solution). Costs nothing but is tracked (using more hints caps the level at ⭐⭐, never ⭐⭐⭐, to keep mastery honest). Byte already exists offline in this codebase — we plug level hints through `src/data/hints.ts`'s `getHint()`.

### 4.8 Mission panel
* Top of the right pane (collapsible): level title, objective, the **target concept** badge ("Today: `for` loops"), star requirements, and allowed API for this level.

### 4.9 XP / reward popup
* On win: reuses the platform's celebration system (`completeGame` returns awarded XP/coins + level-ups + new achievements → the existing `Confetti` + celebration modal). Shows stars earned, coins, "concept mastered," and any chest/badge.

### 4.10 Error explanation panel
* Skulpt traceback → **kid-English translation table** (regex-mapped): e.g. `SyntaxError: bad input` near `if x` → "Did you forget the `:` at the end of your `if` line?" Highlights the offending editor line. Never says "you failed" — frames errors as "the hero got confused at line N."

### 4.11 Mobile / tablet behavior
* **Tablet (primary target):** side-by-side stays, panes resize; editor uses the snippet palette heavily.
* **Phone (portrait):** stack vertically with a **segmented toggle [World | Code]**; Run shows a mini-world preview overlay so kids see the result without losing the editor. Touch targets ≥ 44px. No reliance on hover. Honors the existing `reducedMotion` setting.

---

## 5. Engagement systems

All of these **reuse the existing store + achievements-as-data engine** rather than inventing parallel logic.

* **XP** — per level via a new `codecasterLevelComplete(levelId, stars, concept)` store action that funnels into the same XP curve (`50*(L-1)*L`) and celebration pipeline as `completeGame`.
* **Coins** — collected coins + level rewards feed the platform `coins`; spendable in the existing shop (now gated to logged-in students — see the student-login work already shipped).
* **Hero skins** — new cosmetic category `heroSkin` added to `src/data/cosmetics.ts` (e.g., Robe of Loops, Recursion Cloak). Bought with coins/gems in the shop; `selectHeroSkin` mirrors `selectAvatar`.
* **Pets** — a companion entity that walks behind the hero and gives a tiny perk (e.g., "owl" reveals one hint free per level). Data-driven in `src/data/codecaster/pets.ts`.
* **Daily quests** — e.g., "Beat 1 level using a `for` loop," "Collect 10 coins." A new `dailyQuests.ts` data file + a `claimQuest` action; surfaced on the dungeon-map screen. Extends the existing `claimDaily` pattern.
* **Achievement badges** — pure `check(snapshot)` predicates added to `src/data/achievements.ts` (e.g., "First Loop," "Bug Squasher — beat L29 with 0 resets," "Dragonslayer — beat L30"). **No granting logic** — just data, evaluated by the existing snapshot engine.
* **Streak system** — reuse the existing `streak`/`nextStreak` plumbing; a dungeon level played counts toward the daily streak.
* **Treasure chests** — per-level and milestone chests give coin bursts + cosmetic shards; a "shard → skin" collection meta.
* **Leaderboard** — extends the existing `kcq_*` leaderboard: rank by *concept mastery* (3-star count) and *boss clears*, **not** raw XP, to reduce grind-cheating incentive. **Server-validated** (see §7).
* **Boss battles** — L10/L20/L30 as described; a special "boss cleared" celebration + badge.

---

## 6. Technical architecture

### 6.1 Layered design (mirrors `lib/arena`)

```
Student code (Python text)
      │  PyRunner.compile()  ── Skulpt (MVP) / Pyodide (advanced, later)
      ▼
Command queue: [{op:'move',dir:'right'}, {op:'attack',target:'enemy'}, ...]
      │  + static AST checks (did they use a real `for`? → 3-star gate)
      ▼
engine.ts (framework-free, deterministic)  ── step() → {frame, events, status}
      │
      ├─► renderer (Canvas2D/DOM-grid for MVP; Phaser optional later)
      ├─► audio/effects (reuse arena effects/audio pattern)
      └─► result → store action → celebrations
```

* **`engine.ts` is pure** (no React, no DOM) — exactly like `src/lib/arena/engine.ts`. This is what makes it **server-replayable** for anti-cheat.
* **`PyRunner` interface** isolates the interpreter so Skulpt↔Pyodide is a swap, never a rewrite:

```ts
interface PyRunner {
  compile(code: string, api: HeroApiSpec): Promise<CompileResult>; // → command queue or PyError
  staticChecks(code: string): ConceptUsage; // usedFor, usedWhile, usedDef, usedIf, usedList...
}
```

* **Sandboxing:** Skulpt cannot touch DOM/network/filesystem by construction; we still (a) cap total executed steps (`MAX_STEPS`, e.g. 10k) to kill infinite loops, (b) run compilation in a **Web Worker** with a hard timeout so a runaway program can't freeze the UI, (c) expose only the whitelisted `hero.*` API to the Python global scope.

### 6.2 Proposed stack (final)

| Layer | Choice |
|---|---|
| App | Next.js 15 App Router, React 19, TypeScript (existing) |
| Styling | Tailwind + Framer Motion (existing) |
| State | Zustand `useGame` store (existing) — extended, not replaced |
| Editor | **CodeMirror 6** (`@codemirror/lang-python`) |
| Python | **Skulpt** (MVP) in a Web Worker; `PyRunner` abstraction for Pyodide later |
| Renderer | Canvas2D / DOM-grid + Framer Motion (MVP); Phaser optional richer renderer |
| Cloud | Supabase (strictly additive): auth, progress, XP, rewards, leaderboard, **server-side win validation** |

### 6.3 Folder structure (follows the existing `lib/<feature>` + `components/<feature>` + `data/<feature>` convention)

```
src/
  app/
    quest/                       # the dungeon mode (parallel to /arena)
      page.tsx                   # dungeon-map level select
      [level]/page.tsx           # play a level (unwrap params via use())
  components/
    codecaster/
      QuestMap.tsx               # level-select screen
      PlayScreen.tsx             # two-pane shell
      DungeonView.tsx            # renderer (Canvas/DOM)
      CodePane.tsx               # CodeMirror wrapper + Run/Reset/Hint
      MissionPanel.tsx
      ErrorPanel.tsx             # traceback → kid English
      RewardPopup.tsx            # reuses celebration system
  lib/
    codecaster/
      engine.ts                  # PURE deterministic sim (server-replayable)
      engine.test.ts             # vitest (matches existing test convention)
      types.ts                   # Tile, Entity, Command, LevelDef, ...
      pyrunner/
        index.ts                 # PyRunner interface
        skulpt.ts                # Skulpt impl (worker)
        worker.ts                # web worker host + timeout/step caps
      staticChecks.ts            # concept-usage detection for 3-star gating
      validate.ts                # shared validator used by client + server (edge fn)
  data/
    codecaster/
      levels/                    # 01.ts ... 30.ts (LevelDef each)
      index.ts                   # LEVELS registry (slug → LevelDef)
      heroSkins.ts
      pets.ts
      dailyQuests.ts
  store/
    useGame.ts                   # + codecaster slice & actions
supabase/migrations/
  0010_codecaster.sql            # tables below
```

> Integration choice: the dungeon is a **standalone mode** (`/quest`, like `/arena`) — 30 levels + bosses + its own progression are too big for a single `GAME_REGISTRY` slot. But **all rewards flow through the existing store** (single source of truth) and the existing achievements/celebration/leaderboard machinery. It is **not** a separate app.

### 6.4 Database schema (Supabase, additive — migration `0010`, `kcq_`-style naming)

```sql
-- Per-student level progress (authoritative store of best result)
create table kcq_codecaster_progress (
  user_id      uuid not null references kcq_users(id) on delete cascade,
  level_id     text not null,                 -- 'L01'..'L30'
  best_stars   smallint not null default 0 check (best_stars between 0 and 3),
  best_steps   int,                           -- for par/efficiency
  concept_ok   boolean not null default false,-- used the target concept
  hints_used   smallint not null default 0,
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, level_id)
);

-- Append-only audit of validated solves (anti-cheat + analytics)
create table kcq_codecaster_solves (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references kcq_users(id) on delete cascade,
  level_id     text not null,
  stars        smallint not null,
  code_hash    text not null,                 -- sha256 of submitted code
  command_count int not null,
  validated    boolean not null,              -- server re-ran engine → win?
  created_at   timestamptz not null default now()
);

-- Cosmetics owned (hero skins / pets) — or fold into existing kcq state JSON
create table kcq_codecaster_inventory (
  user_id   uuid not null references kcq_users(id) on delete cascade,
  item_id   text not null,
  kind      text not null check (kind in ('heroSkin','pet')),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- Leaderboard view: rank by 3-star count then boss clears (NOT raw XP)
create view kcq_codecaster_leaderboard as
select user_id,
       count(*) filter (where best_stars = 3) as three_stars,
       count(*) filter (where level_id in ('L10','L20','L30') and best_stars > 0) as bosses,
       max(updated_at) as last_active
from kcq_codecaster_progress group by user_id;
```

All access via **`SECURITY DEFINER` RPCs** through the anon key (the established pattern): `kcq_cc_submit(p_token, p_level, p_code, p_commands)` validates server-side then upserts progress; `kcq_cc_progress(p_token)`; `kcq_cc_leaderboard()`. **No table is writable directly by clients.** When Supabase env is absent, the whole mode runs offline against `localStorage` and simply doesn't sync/leaderboard — the game still fully works (offline-first preserved).

---

## 7. Security & anti-cheat

> **Reality check first.** Today this platform is **client-authoritative**: the Zustand store grants XP/coins locally and `kcq_save` only enforces `coins = greatest(old, new)` (monotonic). That is fine for self-progress (no incentive to cheat yourself) but is **not** enough for a competitive leaderboard. The brief's anti-cheat goals therefore require a **new server-validation path** for anything ranked. Here is the model.

| Threat | Defense |
|---|---|
| **Fake level completion** | Client submits `{level_id, code, command_queue}` to `kcq_cc_submit`. An edge function **re-runs the pure `engine.ts`** (shared TS, same `validate.ts`) over the submitted commands against the canonical level definition. XP/stars are awarded **only if the server's engine reports a win**. The client's claim is never trusted. |
| **Fake XP** | XP for ranked progress is **derived server-side** from validated solves, not sent by the client. Local (offline) XP stays client-side but is **reconciled/overwritten** by the server total on login (the account is already authoritative on login — see `applyToStore`). |
| **Leaderboard cheating** | Leaderboard reads only from `kcq_codecaster_progress` rows written by the validated RPC. Rank by 3-star/boss clears (hard to fake without a real solve). Rate-limit submissions; flag improbable solves (e.g., L30 solved seconds after account creation) in `kcq_codecaster_solves` for teacher review. |
| **Direct reward manipulation** | No client write path to reward tables — only `SECURITY DEFINER` RPCs validated by session token. The cosmetic price/ownership is checked server-side on purchase. |
| **Unsafe Python execution** | Skulpt has **no DOM/network/FS** access by design; runs in a **Web Worker** with a wall-clock timeout and a `MAX_STEPS` cap (kills infinite loops). Only the whitelisted `hero.*` API is injected. No `eval` of arbitrary JS. Pyodide (if added later) likewise runs in a worker with the same caps. |
| **Replay/duplication** | Each solve stores `code_hash`; the RPC is idempotent per `(user_id, level_id)` keeping only the **best** result, so resubmitting can't inflate counts. |

**Phasing:** MVP can ship client-authoritative for **personal progress only** (no public leaderboard) — honest and low-risk. The **server-replay validator** is the gate that must land **before** the competitive leaderboard goes live. Because the engine is pure TS from day one, "run it on the server too" is configuration, not a rewrite.

---

## 8. Roadmap & risks

### 8.1 MVP (target ~4–6 focused build phases)

1. **Engine + types** (`lib/codecaster/engine.ts` + tests): grid, hero, move/collect/attack, win/lose, command queue, `MAX_STEPS`. No UI yet — proven by vitest.
2. **PyRunner (Skulpt) in a worker**: code → command queue, traceback capture, timeout/step caps.
3. **Play screen**: DungeonView (DOM/Canvas) + CodeMirror CodePane + Run/Reset/Hint + Error panel + animated step playback.
4. **Levels 1–10** (Bands A–C + first boss) in `data/codecaster/levels/`, plus the QuestMap select screen with star gating.
5. **Store integration**: `codecasterLevelComplete` action → XP/coins/celebrations; 3-star concept gating via `staticChecks`; Byte hints via `getHint()`.
6. **Offline-first polish + mobile/tablet** layout (segmented toggle on phone), reduced-motion support, locale strings (uz/en).

*MVP definition of done:* 10 levels playable **fully offline**, real Python (Skulpt), deterministic playback, XP/coins/stars/achievements wired, tablet-usable. No leaderboard yet.

### 8.2 Full version

7. **Levels 11–30** (loops, conditionals, functions, lists, debugging, final boss).
8. **Engagement meta:** hero skins, pets, daily quests, treasure chests, streak hooks, badges.
9. **Supabase sync (additive):** `0010` migration + RPCs; progress/inventory sync; offline still primary.
10. **Server-replay validator + competitive leaderboard** (the security gate from §7).
11. **Pyodide-backed "advanced" track** behind `PyRunner` for older kids (real CPython, libraries).
12. **Optional Phaser renderer** for richer boss spectacle; **teacher dashboard** tie-in (the existing `/admin` classroom layer) showing per-student concept mastery.

### 8.3 Risks & mitigations

| Risk | Mitigation |
|---|---|
| Pyodide weight breaks offline/mobile | Skulpt for MVP; Pyodide gated to opt-in advanced track only. |
| Monaco poor on touch / heavy | CodeMirror 6 instead; snippet palette for young kids. |
| Phaser scope creep | Renderer-agnostic engine; ship Canvas/DOM first, Phaser optional. |
| Infinite loops freeze the tab | Web Worker + wall-clock timeout + `MAX_STEPS` cap; friendly "your loop never ended" message. |
| Anti-cheat vs. client-authoritative store | Server-replay validator before any public leaderboard; personal progress can stay client-side. |
| Skulpt is a Python *subset* (gaps vs CPython) | Constrain the curriculum to the supported subset (which covers all 8 target concepts); validate each level's starter/solution against Skulpt in CI. |
| 3-star "concept" gating false negatives | Static checks are advisory + generous; never block a *win*, only the 3rd star; allow multiple valid patterns. |
| Kids frustrated by errors | Error panel translates tracebacks to kid English; framing is "the hero got confused," not "fail"; Byte hints always available. |
| IP / originality concerns | Original names, art, copy, maps, and characters; the only shared element with CodeCombat is the *genre*, which isn't protectable. Document asset provenance. |
| Content authoring cost (30 levels) | `LevelDef` is pure data; build a tiny internal level-preview harness early so designers iterate without code. |

---

## Appendix — `LevelDef` shape (data-driven, like `games.ts`)

```ts
export interface LevelDef {
  id: string;                 // 'L01'
  title: string;
  band: 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'BOSS';
  concept: string;            // 'for-loop'
  objective: string;          // i18n key
  grid: TileType[][];         // initial map
  entities: EntitySpec[];     // hero start, enemies, coins, keys, doors, boss
  api: HeroApiSpec;           // which hero.* calls are unlocked this level
  starterCode: string;
  victory: VictorySpec;       // onGoal | allCoins | bossDefeated | composite
  parSteps?: number;          // for the 2nd star
  requireConcept?: ConceptKey;// for the 3rd star (checked by staticChecks)
  hints: [string, string, string]; // Byte's escalating hints (i18n keys)
  bugs?: BugSpec[];           // for the L29 debugging level
}
```

*All strings are i18n keys (default `uz`, fallback `en`) per the platform's i18n convention.*
