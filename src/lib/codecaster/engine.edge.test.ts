/**
 * engine.ts — additional edge-case hardening (companion to engine.test.ts).
 *
 * Targets the specific gaps called out for QA hardening: attacking/acting off
 * the grid edge, useKey misuse (no key / no door / wrong direction), a
 * simultaneous goal+enemy-adjacency turn, the maxSteps boundary precisely,
 * and determinism across the full action vocabulary (not just moves).
 *
 * Reuses the ASCII-map convention from engine.test.ts (kept local to avoid
 * cross-file coupling on a non-exported helper).
 */

import { describe, it, expect } from 'vitest';
import { DungeonEngine, runActions } from './engine';
import type { Command, Direction, EntityKind, EntitySpec, LevelDef, TileType, VictorySpec } from './types';

const TILE: Record<string, TileType> = {
  '#': 'wall', '.': 'floor', 'G': 'goal', 'P': 'pit', 'S': 'spike', 'D': 'door',
};
const ENTITY: Record<string, EntityKind> = {
  c: 'coin', m: 'gem', k: 'key', x: 'chest', g: 'goblin', l: 'slime', t: 'bat', r: 'guard', B: 'boss',
};
const ENEMY_HP: Partial<Record<EntityKind, number>> = { goblin: 1, slime: 2, bat: 1, guard: 1, boss: 3 };

function level(map: string, victory: VictorySpec, extra: Partial<LevelDef> = {}): LevelDef {
  const rows = map.trim().split('\n').map((r) => r.trim());
  const tiles: TileType[][] = [];
  const entities: EntitySpec[] = [];
  let heroStart = { x: 0, y: 0 };
  let id = 0;
  rows.forEach((row, y) => {
    const line: TileType[] = [];
    [...row].forEach((ch, x) => {
      if (ch === 'H') {
        heroStart = { x, y };
        line.push('floor');
      } else if (TILE[ch]) {
        line.push(TILE[ch]);
      } else if (ENTITY[ch]) {
        const kind = ENTITY[ch];
        const e: EntitySpec = { id: `${kind}-${id++}`, kind, pos: { x, y } };
        if (ENEMY_HP[kind] !== undefined) e.hp = ENEMY_HP[kind];
        if (kind === 'bat') e.patrol = ['right', 'left'];
        entities.push(e);
        line.push('floor');
      } else {
        line.push('floor');
      }
    });
    tiles.push(line);
  });
  return { id: 'test', cols: tiles[0].length, rows: tiles.length, tiles, entities, heroStart, victory, ...extra };
}

const NEVER_WINS = { reachGoal: true } as const;

// ── attack / act off the grid edge ───────────────────────────────────────────

describe('DungeonEngine — acting at the grid boundary', () => {
  it('EDGE-01: attacking while facing off the top-left corner whiffs harmlessly (no crash, no out-of-bounds read)', () => {
    const e = new DungeonEngine(level('H.', NEVER_WINS, { heroFacing: 'up' }));
    expect(() => e.attack()).not.toThrow();
    const r = e.attack();
    expect(r.events.some((ev) => ev.type === 'whiff')).toBe(true);
    expect(e.status).toBe('playing');
  });

  it('EDGE-02: attacking off the right/bottom edge of the grid whiffs without throwing', () => {
    const e = new DungeonEngine(level('.H', NEVER_WINS, { heroFacing: 'right' }));
    expect(() => e.attack()).not.toThrow();
    expect(e.attack().events.some((ev) => ev.type === 'whiff')).toBe(true);
  });

  it('EDGE-03: collecting while facing off-grid is irrelevant — collect always checks the HERO tile, not the faced tile, so it whiffs on an empty hero tile at the corner', () => {
    const e = new DungeonEngine(level('H.', NEVER_WINS, { heroFacing: 'up' }));
    const r = e.collect();
    expect(r.events.some((ev) => ev.type === 'whiff')).toBe(true);
  });

  it('EDGE-04: useKey while facing off-grid whiffs without throwing (inBounds guard holds)', () => {
    const e = new DungeonEngine(level('H.', NEVER_WINS, { heroFacing: 'up', startKeys: 1 }));
    expect(() => e.useKey()).not.toThrow();
    const r = e.useKey();
    expect(r.events.some((ev) => ev.type === 'whiff')).toBe(true);
    expect(e.state.hero.keys).toBe(1); // key not consumed on a whiff
  });

  it('EDGE-05: repeatedly bumping into a wall/edge never corrupts position or turn counting', () => {
    const e = new DungeonEngine(level('H#', NEVER_WINS));
    for (let i = 0; i < 5; i += 1) e.move('right');
    expect(e.state.hero.pos).toEqual({ x: 0, y: 0 });
    expect(e.turn).toBe(5); // each blocked bump still consumes a turn
  });
});

// ── useKey misuse ─────────────────────────────────────────────────────────────

describe('DungeonEngine — useKey misuse', () => {
  it('KEY-01: useKey with zero keys against a real door whiffs and does not open it', () => {
    const e = new DungeonEngine(level('HDG', { reachGoal: true }, { startKeys: 0 }));
    const r = e.useKey();
    expect(r.events.some((ev) => ev.type === 'whiff')).toBe(true);
    expect(e.canMove('right')).toBe(false);
  });

  it('KEY-02: useKey while facing a floor tile (no door) whiffs and does not consume the key', () => {
    const e = new DungeonEngine(level('H.G', { reachGoal: true }, { startKeys: 2 }));
    const r = e.useKey();
    expect(r.events.some((ev) => ev.type === 'whiff')).toBe(true);
    expect(e.state.hero.keys).toBe(2);
  });

  it('KEY-03: useKey facing an enemy (not a door) whiffs and does not consume the key or harm the enemy', () => {
    const e = new DungeonEngine(level('Hg', NEVER_WINS, { startKeys: 1 }));
    const r = e.useKey();
    expect(r.events.some((ev) => ev.type === 'whiff')).toBe(true);
    expect(e.state.hero.keys).toBe(1);
    expect(e.state.entities.some((en) => en.kind === 'goblin')).toBe(true);
  });

  it('KEY-04: useKey in the wrong facing direction (door is to the side, not ahead) whiffs', () => {
    // Door is below the hero; hero faces right (default) — useKey should miss it.
    const e = new DungeonEngine(level('H.\nD.', { reachGoal: true }, { startKeys: 1, heroFacing: 'right' }));
    const r = e.useKey();
    expect(r.events.some((ev) => ev.type === 'whiff')).toBe(true);
    expect(e.state.hero.keys).toBe(1);
  });

  it('KEY-05: a key is consumed exactly once even if useKey is spammed after the door opens', () => {
    const e = new DungeonEngine(level('HkDG', { reachGoal: true }));
    e.move('right');   // onto key
    e.collect();       // pick up
    expect(e.state.hero.keys).toBe(1);
    e.useKey();        // opens the door, keys -> 0
    expect(e.state.hero.keys).toBe(0);
    expect(e.state.entities.length).toBe(0); // (no entities besides the consumed key)
    const r2 = e.useKey(); // door already open (now floor) — should whiff, not go negative
    expect(r2.events.some((ev) => ev.type === 'whiff')).toBe(true);
    expect(e.state.hero.keys).toBe(0); // never goes negative
  });
});

// ── simultaneous goal + enemy adjacency ───────────────────────────────────────

describe('DungeonEngine — simultaneous win/lose ordering', () => {
  it('SIM-01: reaching the goal while an enemy is adjacent — the enemy gets to strike BEFORE victory is evaluated (enemyPhase runs before checkVictory)', () => {
    // Goal at x=2; goblin sits at (3,0), adjacent to the goal tile. Hero moves
    // onto the goal; the goblin (manhattan distance 1) should land a hit in the
    // SAME turn's enemyPhase, then win is still evaluated true (hero survives).
    const e = new DungeonEngine(level('H.Gg', { reachGoal: true }, { heroHp: 3 }));
    e.move('right'); // turn 1
    e.move('right'); // turn 2: lands on goal; goblin at distance 1 strikes first
    expect(e.state.hero.hp).toBe(2); // damage applied
    expect(e.status).toBe('won');     // then victory still triggers (hero survived)
  });

  it('SIM-02: [DOCUMENTS ENGINE TIE-BREAK] reaching the goal in the same turn an adjacent enemy lands a lethal hit resolves as a WIN — checkVictory() is evaluated before the hp<=0 check in `act()` (engine.ts lines ~243-248), so a 0-HP hero standing on the goal still wins, not loses', () => {
    // Hero at 1 HP steps onto the goal while simultaneously becoming adjacent
    // to an enemy. enemyPhase runs first and drops HP to 0, but `act()`'s
    // final branch is `if (checkVictory()) { won } else if (hp <= 0) { lost }`
    // — checkVictory short-circuits the lose check. This is FROZEN engine
    // behavior (not something this QA pass may change); flagged as a candidate
    // design review: a kid could "win by dying on the goal tile", which reads
    // oddly ("you won!" while at 0 HP) even if functionally harmless (you
    // already won). Reported, not fixed — see QA findings.
    const e = new DungeonEngine(level('H.Gg', { reachGoal: true }, { heroHp: 1 }));
    e.move('right'); // turn 1: not yet adjacent to goblin (distance 2) — survives
    expect(e.status).toBe('playing');
    const r = e.move('right'); // turn 2: lands on goal AND becomes adjacent to goblin
    expect(e.state.hero.hp).toBe(0);     // lethal damage was applied...
    expect(e.status).toBe('won');        // ...but checkVictory() wins the race over hp<=0
    expect(r.events.some((ev) => ev.type === 'win')).toBe(true);
    expect(r.events.some((ev) => ev.type === 'lose')).toBe(false);
  });

  it('SIM-03: defeating the boss and stepping onto the goal in the same turn (composite victory) wins immediately', () => {
    // Boss directly ahead, goal one tile beyond it. Final attack defeats the
    // boss; victory requires {defeatBoss, reachGoal} — hero is NOT yet on the
    // goal tile after the attack (attack doesn't move the hero), so this
    // documents that defeating the boss alone does not yet satisfy reachGoal.
    const e = new DungeonEngine(level('HBG', { defeatBoss: true, reachGoal: true }, { heroHp: 9 }));
    e.attack(); e.attack(); e.attack(); // boss hp 3 -> 0, defeated
    expect(e.state.entities.some((en) => en.kind === 'boss')).toBe(false);
    expect(e.status).toBe('playing'); // not on goal tile yet — composite victory not met
    e.move('right'); // step onto former boss tile
    e.move('right'); // step onto goal — now both conditions hold simultaneously
    expect(e.status).toBe('won');
  });
});

// ── maxSteps boundary precision ───────────────────────────────────────────────

describe('DungeonEngine — maxSteps boundary precision', () => {
  it('STEP-01: a run that wins EXACTLY on the maxSteps-th turn still wins (the cap does not pre-empt a same-turn victory)', () => {
    const e = new DungeonEngine(level('H..G', { reachGoal: true }, { maxSteps: 3 }));
    e.move('right'); // turn 1
    e.move('right'); // turn 2
    const r = e.move('right'); // turn 3 == maxSteps, lands on goal
    expect(e.turn).toBe(3);
    expect(e.status).toBe('won');
    expect(r.events.some((ev) => ev.type === 'win')).toBe(true);
    expect(r.events.some((ev) => ev.type === 'lose')).toBe(false);
  });

  it('STEP-02: the (maxSteps+1)-th action loses with reason "maxSteps", and no further game-state mutation occurs from it', () => {
    const e = new DungeonEngine(level('H...G', { reachGoal: true }, { maxSteps: 3 }));
    e.move('right'); // 1
    e.move('right'); // 2
    e.move('right'); // 3 — still playing, not on goal
    expect(e.status).toBe('playing');
    const posBefore = { ...e.state.hero.pos };
    const r = e.move('right'); // 4 > maxSteps -> lose, the move itself must not apply
    expect(e.turn).toBe(4);
    expect(e.status).toBe('lost');
    expect(e.state.loseReason).toBe('maxSteps');
    expect(e.state.hero.pos).toEqual(posBefore); // hero did not actually move on the losing turn
    expect(r.events).toEqual([{ type: 'lose', reason: 'maxSteps' }]);
  });

  it('STEP-03: maxSteps=0 means the very first action immediately loses (degenerate boundary)', () => {
    const e = new DungeonEngine(level('H.G', { reachGoal: true }, { maxSteps: 0 }));
    const r = e.wait();
    expect(e.turn).toBe(1);
    expect(e.status).toBe('lost');
    expect(e.state.loseReason).toBe('maxSteps');
    expect(r.events.some((ev) => ev.type === 'lose')).toBe(true);
  });

  it('STEP-04: default maxSteps (200, when omitted) is honored — 200 actions are allowed, the 201st is not', () => {
    const e = new DungeonEngine(level('H' + '.'.repeat(250), NEVER_WINS)); // never wins, just count turns
    for (let i = 0; i < 200; i += 1) {
      const r = e.wait();
      expect(r.status).toBe('playing');
    }
    expect(e.turn).toBe(200);
    const r201 = e.wait();
    expect(r201.status).toBe('lost');
    expect(e.state.loseReason).toBe('maxSteps');
  });
});

// ── determinism across the full command vocabulary ───────────────────────────

describe('DungeonEngine — determinism across mixed action types', () => {
  const fullTrace: Command[] = [
    { op: 'say', text: 'go' },
    { op: 'move', dir: 'right' },
    { op: 'collect' },
    { op: 'wait' },
    { op: 'attack' },
    { op: 'move', dir: 'down' },
    { op: 'useKey' },
    { op: 'move', dir: 'right' },
  ];

  it('DET-01: identical mixed-vocabulary traces against the same level produce byte-identical resulting state, twice', () => {
    const lvl = level('Hck\n.D.\n..G', { reachGoal: true }, { startKeys: 0 });
    const a = runActions(lvl, fullTrace).state;
    const b = runActions(lvl, fullTrace).state;
    expect(a).toEqual(b);
  });

  it('DET-02: running the SAME engine instance through the same trace twice (after rebuilding) is also stable, including the log and turn counter', () => {
    const lvl = level('H.c', { collectAllCoins: true });
    const trace: Command[] = [{ op: 'say', text: 'hi' }, { op: 'move', dir: 'right' }, { op: 'move', dir: 'right' }, { op: 'collect' }];
    const e1 = runActions(lvl, trace);
    const e2 = runActions(lvl, trace);
    expect(e1.state.log).toEqual(e2.state.log);
    expect(e1.turn).toBe(e2.turn);
    expect(e1.status).toBe(e2.status);
  });

  it('DET-03: a trace with whiffs/blocked moves interleaved is still fully deterministic (no hidden RNG / Date.now in the engine)', () => {
    const lvl = level('H#G', { reachGoal: true });
    const trace: Command[] = [
      { op: 'move', dir: 'right' },  // blocked by wall
      { op: 'attack' },               // whiff (wall, not enemy)
      { op: 'collect' },              // whiff (nothing here)
      { op: 'useKey' },               // whiff (no key/door)
      { op: 'wait' },
    ];
    const a = runActions(lvl, trace).state;
    const b = runActions(lvl, trace).state;
    expect(a).toEqual(b);
    expect(a.hero.pos).toEqual({ x: 0, y: 0 }); // never actually moved
  });
});
