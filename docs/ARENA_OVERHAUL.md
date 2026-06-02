# ⚔️ Battle Learn Arena — Gameplay Realism Overhaul

> Mission: make the arena feel like a **professional game** (Brawl Stars / Squad Busters / CS2 game-feel) while staying child-friendly and educational. Architecture (`engine.ts`, `render.ts`, `questionEngine.ts`) is **preserved and improved**, not rewritten away.

---

## PART A — ANALYSIS (current state)

### A1. Current strengths

- **Clean layered architecture** — pure logic (`lib/arena/*`) is fully decoupled from React (`components/arena/*`) and data (`data/*`). This is the single best asset: we can bolt on juice without fighting the structure.
- **Deterministic-ish engine** — `step(world, dt, now)` is a pure-ish function; trivially testable and future server-authoritative.
- **Solid fundamentals already present** — HP, respawn timers, bullet lifetime, line-of-sight (`hasLOS`), strafing bots, cover obstacles, team bases, dual input (touch joysticks + WASD/mouse), retina-crisp responsive canvas, `dt`-clamped rAF loop.
- **Seamless educational hook** — death → learning pod → respawn is a genuinely novel, well-framed loop.

### A2. Weaknesses

- **No game feel.** Every action is mechanically correct but emotionally flat: no recoil, no screen shake, no hit flash, no particles, no damage numbers, no crits, no kill confirmation.
- **Robotic movement.** Hero position is `input × speed` applied directly — instant start/stop, zero momentum. `Fighter.vx/vy` exist but are unused.
- **Static bullets.** Dots with a 0.02s stub trail; no muzzle flash, no impact feedback.
- **Jarring death.** Instant cut from battle to the question modal — no slow-mo, freeze, or zoom. The educational layer *interrupts* instead of *punctuating*.
- **No feedback systems.** No kill feed, no multi-kill / streak callouts, no comeback or match-point alerts.
- **One static map.** A single 7-obstacle layout; no arena variety, chokepoints, or designed flank/risk zones.
- **No audio architecture** at all.
- **Plain respawn.** Alpha pulse only — no portal, no protective shield, so players get spawn-killed.

### A3. Missing game-feel systems (the gap to "professional")

| System | Status |
|--------|--------|
| Screen shake (trauma-based) | ❌ missing |
| Weapon recoil (visual) | ❌ missing |
| Muzzle flash | ❌ missing |
| Hit flash + hit particles | ❌ missing |
| Floating damage numbers | ❌ missing |
| Critical hits | ❌ missing |
| Kill confirmation burst | ❌ missing |
| Impact particles (wall/player/obstacle) | ❌ missing |
| Movement momentum (accel/decel) | ❌ missing |
| Death slow-mo / freeze / zoom | ❌ missing |
| Respawn portal + temp shield | ❌ missing |
| Kill feed / multi-kill / comeback | ❌ missing |
| Audio event hooks | ❌ missing |

### A4. AI weaknesses

- **Single behavior for all bots** — "find nearest enemy, strafe/close/jockey." Predictable and identical across every fighter.
- **No self-preservation** — bots fight to the death, never retreat at low HP.
- **No target selection** — always nearest, never the *weakest* or *most dangerous*.
- **Crossfire-blind** — bots happily fire through their own teammates.
- **No personalities, no flanking, no cover-seeking, no focus-fire.**

### A5. Rendering limitations

- `ctx.fillText(emoji, …)` per fighter per frame — emoji rasterization is the most expensive draw call and scales badly.
- Full clear + full redraw every frame; background grid is re-pathed each frame instead of cached.
- No particle/text/ring layer exists to draw at all.
- No camera (zoom/pan/shake) — transform is a fixed `dpr·scale`.

### A6. Performance bottlenecks (vs. the 100-fighter / 200-projectile target)

- **Collision is O(B×F)** — every bullet tests every fighter each frame → 200×100 = 20,000 checks/frame.
- **Targeting is O(F²)** — every fighter scans every other fighter via `nearestEnemy` → 100 fighters = 10,000 distance calls/frame.
- **GC pressure** — `world.bullets` is rebuilt (`push`/`filter`) every frame; `spawnPoint`, `kills`, etc. allocate per call.
- **Emoji text draws** dominate at scale.
- *(Note: the lobby currently caps at 10v10 = 20 fighters, so this target is a forward-looking requirement met in Phase 5 via a spatial hash grid + pooling + draw LOD.)*

---

## PART B — PRIORITY ROADMAP

| Phase | Theme | Impact | Status |
|-------|-------|--------|--------|
| **P1** | **Game-feel foundation** — `effects.ts` (particles, damage numbers, rings, trauma shake), recoil, muzzle flash, hit/kill confirmation, crits, momentum movement, enhanced trails, audio event architecture | 🔥🔥🔥 | **THIS PASS** |
| **P2** | **Cinematic death→learn** — slow-mo + freeze-frame + camera zoom on death; respawn portal + temporary shield; supportive wrong-answer flow | 🔥🔥🔥 | **THIS PASS** |
| **P3** | **AI overhaul** — state machine + 4 personalities (Aggressive / Defensive / Sniper / Support); retreat at low HP, focus weak, crossfire avoidance | 🔥🔥 | **THIS PASS (compact)** |
| **P4** | **Feedback systems** — kill feed, multi-kill (Double/Triple), comeback + match-point alerts | 🔥🔥 | **THIS PASS** |
| **P5** | **Arena variety** — 5 designed maps (Training Facility, Tech Lab, Cyber City, AI Factory, Algorithm Temple) with cover / chokepoints / flank routes / risk zones | 🔥🔥 | next pass |
| **P6** | **New modes** — Payload Escort, Energy Core Defense, Battle Quiz Royale (+ tune existing 4) | 🔥 | next pass |
| **P7** | **Performance at scale** — spatial hash grid (collision + targeting), bullet pooling, cached background layer, draw LOD → 100 fighters / 200 projectiles @ 60 FPS | 🔥 | next pass |

**This pass delivers P1–P4** (the highest game-feel-per-effort tier). P5–P7 are scoped and ready to trigger next.

---

## PART C — WHAT SHIPPED THIS PASS

- **`lib/arena/effects.ts`** (new) — allocation-light `Fx` system: particles, floating damage numbers, expanding impact rings, muzzle flashes, trauma-based screen shake, hero hit-vignette. Pure logic, capped at 600 particles for 60 FPS.
- **`lib/arena/audio.ts`** (new) — `ArenaAudio` event bus + zero-asset WebAudio synth (`createSynth`). Semantic events: `shoot, hit, crit, kill, multikill, hurt, respawn, shield, correct, wrong, victory, defeat, streak, countdown`. No audio files bundled; respects the `sound` setting.
- **`engine.ts`** (improved, API preserved) — momentum movement (accel/decel via `vx/vy`), recoil kick + decay, white hit-flash, **critical hits**, temporary respawn **shield**, impact/kill effect emission, `StepResult.sounds`, and a **4-personality bot AI** (retreat at low HP, focus weakest, crossfire-aware fire-hold).
- **`render.ts`** (improved) — draws the full effects layer, recoil-offset bodies, hit-flash tint, hero shield ring, beefier bullet trails + glow.
- **`ArenaGame.tsx`** (improved) — camera with **zoom + trauma shake**, **slow-mo freeze-frame death** → learning pod, respawn portal + shield, **kill feed**, **multi-kill & comeback / match-point announcements**, audio wiring (resumes on first input, honors `reducedMotion`).
- **`types.ts`** — `ArenaPhase` gains `'dying'`.

Success bar: kids say **"Again!"**, not "I finished." The learning layer now *punctuates* the action (freeze → zoom → pod → portal respawn) instead of interrupting it.
