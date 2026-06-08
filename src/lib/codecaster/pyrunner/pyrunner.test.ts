/**
 * Codecaster PyRunner — unit and integration tests.
 *
 * Test strategy:
 *   Vitest runs in Node (no DOM, no real Worker). We test the testable pieces:
 *
 *   1. `runPythonCore` with real Skulpt loaded in-process — this covers the
 *      happy path (move + win), syntax errors, timeout (infinite loops), and
 *      output capture. Skulpt works in Node when `globalThis.window` is set to
 *      `globalThis` first (it looks for `typeof window` to locate its global).
 *
 *   2. `mapSkulptError`-style logic — covered by the runPythonCore tests above;
 *      we also add direct unit tests for the error-kind mapping.
 *
 *   3. Pieces that CANNOT run under Vitest/Node and are explicitly noted:
 *      - WorkerRunner / MainThreadRunner (require a real browser Worker / DOM).
 *      - `createRunner()` (guards on `typeof window`).
 *      - importScripts (Worker-only API).
 *
 * Skulpt loading in Node:
 *   We `eval()` the skulpt.js source with `globalThis.window = globalThis` so
 *   Skulpt attaches `Sk` to the global as it does in a browser. The stdlib is
 *   evaluated next. This is test-only — production code uses importScripts (worker)
 *   or <script> injection (main-thread fallback).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type { LevelDef, TileType, EntityKind, EntitySpec, VictorySpec } from '../types';
import { runPythonCore } from './runCore';
import type { SkulptGlobal } from './runCore';

// ---------------------------------------------------------------------------
// Skulpt bootstrap — load once for the whole test suite.
// ---------------------------------------------------------------------------

let Sk: SkulptGlobal;

beforeAll(() => {
  // Skulpt's webpack bundle references the `Sk` global as a free variable in
  // every webpack module. In Node.js CJS context (non-strict mode), undeclared
  // variable references fall back to `global`. So the loading trick is:
  //   1. Pre-seed `globalThis.Sk = {}` before loading skulpt.
  //   2. Use `createRequire` to load skulpt's CJS bundle — it sees global.Sk
  //      and attaches all its pieces to it.
  //
  // We cannot use eval() inside an async/ESM beforeAll because ESM is strict
  // mode and `var Sk` inside eval() does NOT leak to the enclosing scope there.
  // We cannot use the `new Function()` trick because the webpack bundle's inner
  // modules reference `Sk` from the outer webpack IIFE's closure, not from the
  // function argument. createRequire is the clean solution.

  (globalThis as unknown as Record<string, unknown>)['Sk'] = {};
  (globalThis as unknown as Record<string, unknown>)['window'] = globalThis;

  const require = createRequire(import.meta.url);
  const root = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../node_modules/skulpt/dist',
  );

  // CJS require — skulpt.min.js sees global.Sk (pre-seeded above) and attaches
  // itself. NOTE: skulpt.js (non-minified) does NOT work here because webpack
  // module ordering in the non-min build causes "Sk is not defined" before
  // util.js sets it up. The min build handles this correctly.
  require(join(root, 'skulpt.min.js'));
  require(join(root, 'skulpt-stdlib.js'));

  Sk = (globalThis as unknown as Record<string, unknown>)['Sk'] as SkulptGlobal;
  if (!Sk || typeof Sk.configure !== 'function') {
    throw new Error('Skulpt did not attach to globalThis.Sk after require()');
  }
});

// ---------------------------------------------------------------------------
// Level builder helper — reused from engine.test.ts pattern.
// ---------------------------------------------------------------------------

const TILE: Record<string, TileType> = {
  '#': 'wall',
  '.': 'floor',
  G: 'goal',
  P: 'pit',
  S: 'spike',
  D: 'door',
};
const ENTITY: Record<string, EntityKind> = {
  c: 'coin',
  g: 'goblin',
  k: 'key',
};
const ENEMY_HP: Partial<Record<EntityKind, number>> = { goblin: 1 };

function makeLevel(map: string, victory: VictorySpec, extra: Partial<LevelDef> = {}): LevelDef {
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
        entities.push(e);
        line.push('floor');
      } else {
        line.push('floor');
      }
    });
    tiles.push(line);
  });
  return {
    id: 'test',
    cols: tiles[0].length,
    rows: tiles.length,
    tiles,
    entities,
    heroStart,
    victory,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runPythonCore — happy path', () => {
  it('hero.moveRight() produces a move frame and the level is won', () => {
    // Map: H.G — hero at x=0, goal at x=2.  Needs 2 moves right.
    const level = makeLevel('H.G', { reachGoal: true });
    const result = runPythonCore({
      level,
      code: 'hero.moveRight()\nhero.moveRight()',
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.finalStatus).toBe('won');
    expect(result.frames).toHaveLength(2);
    expect(result.actions).toEqual([
      { op: 'move', dir: 'right' },
      { op: 'move', dir: 'right' },
    ]);
    expect(result.steps).toBe(2);
  });

  it('initialState captures the world BEFORE any action', () => {
    const level = makeLevel('H.G', { reachGoal: true });
    const result = runPythonCore({
      level,
      code: 'hero.moveRight()',
      execLimitMs: 2000,
      Sk,
    });

    // initialState must have hero at heroStart (x=0), not x=1.
    expect(result.initialState.hero.pos).toEqual({ x: 0, y: 0 });
    // After the one move the frame state has hero at x=1.
    expect(result.frames[0].state.hero.pos).toEqual({ x: 1, y: 0 });
  });

  it('hero.move("right") is equivalent to hero.moveRight()', () => {
    const level = makeLevel('H.G', { reachGoal: true });
    const result = runPythonCore({
      level,
      code: 'hero.move("right")\nhero.move("right")',
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(true);
    expect(result.finalStatus).toBe('won');
  });

  it('hero.say() adds to output and produces a say frame', () => {
    const level = makeLevel('H.G', { reachGoal: true });
    const result = runPythonCore({
      level,
      code: 'hero.say("hello dungeon")',
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain('hello dungeon');
    expect(result.frames[0].events.some((e) => e.type === 'say')).toBe(true);
  });

  it('print() output is captured in result.output', () => {
    const level = makeLevel('H.G', { reachGoal: true });
    const result = runPythonCore({
      level,
      code: 'print("printed line")',
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain('printed line');
  });

  it('sensor hero.canMove() returns a bool without recording a frame', () => {
    const level = makeLevel('H#G', { reachGoal: true }); // wall at x=1
    const result = runPythonCore({
      level,
      code: [
        'if not hero.canMove("right"):',
        '    hero.say("blocked")',
      ].join('\n'),
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(true);
    // canMove doesn't produce a frame; say produces 1
    expect(result.frames).toHaveLength(1);
    expect(result.output).toContain('blocked');
  });

  it('hero.seeEnemy() returns True when a goblin is in front', () => {
    const level = makeLevel('HgG', { reachGoal: true }); // goblin at x=1
    const result = runPythonCore({
      level,
      code: [
        'if hero.seeEnemy():',
        '    hero.say("i see you")',
      ].join('\n'),
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain('i see you');
  });

  it('hero.health() returns the hero hp as an int', () => {
    const level = makeLevel('H.G', { reachGoal: true }, { heroHp: 3 });
    const result = runPythonCore({
      level,
      code: 'hero.say(str(hero.health()))',
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain('3');
  });

  it('hero.nearbyEnemy() returns None when no enemy is in front', () => {
    const level = makeLevel('H.G', { reachGoal: true });
    const result = runPythonCore({
      level,
      code: [
        'e = hero.nearbyEnemy()',
        'if e is None:',
        '    hero.say("no enemy")',
      ].join('\n'),
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain('no enemy');
  });

  it('for loop moves hero multiple times', () => {
    // H....G — 5 tiles, need 5 moves right.
    const level = makeLevel('H....G', { reachGoal: true });
    const result = runPythonCore({
      level,
      code: 'for i in range(5):\n    hero.moveRight()',
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(true);
    expect(result.finalStatus).toBe('won');
    expect(result.frames).toHaveLength(5);
  });

  it('each frame state is a fresh EngineState snapshot (not a shared reference)', () => {
    const level = makeLevel('H..G', { reachGoal: true });
    const result = runPythonCore({
      level,
      code: 'hero.moveRight()\nhero.moveRight()\nhero.moveRight()',
      execLimitMs: 2000,
      Sk,
    });

    // frame[0] hero should be at x=1, frame[1] at x=2.
    expect(result.frames[0].state.hero.pos.x).toBe(1);
    expect(result.frames[1].state.hero.pos.x).toBe(2);
  });

  it('ok=true but finalStatus="playing" when code does not win', () => {
    const level = makeLevel('H..G', { reachGoal: true });
    const result = runPythonCore({
      level,
      code: 'hero.moveRight()',
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(true);
    expect(result.finalStatus).toBe('playing');
  });
});

describe('runPythonCore — error handling', () => {
  it('syntax error sets ok=false and error.kind="syntax"', () => {
    const level = makeLevel('H.G', { reachGoal: true });
    const result = runPythonCore({
      level,
      code: 'if x',  // missing colon — SyntaxError
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.kind).toBe('syntax');
    expect(result.frames).toHaveLength(0);
    expect(result.finalStatus).toBe('playing');
  });

  it('timeout on infinite loop sets ok=false and error.kind="timeout"', () => {
    const level = makeLevel('H.G', { reachGoal: true });
    const result = runPythonCore({
      level,
      code: 'while True:\n    pass',
      execLimitMs: 200,  // short budget to keep the test fast
      Sk,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.kind).toBe('timeout');
  }, 5000);

  it('runtime error (NameError) sets ok=false and error.kind="runtime"', () => {
    const level = makeLevel('H.G', { reachGoal: true });
    const result = runPythonCore({
      level,
      code: 'undefined_variable_xyz()',
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.kind).toBe('runtime');
  });

  it('frames collected before an error are preserved in the result', () => {
    const level = makeLevel('H..G', { reachGoal: true });
    // Move once successfully, then crash.
    const result = runPythonCore({
      level,
      code: 'hero.moveRight()\nundefined_boom()',
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(false);
    // The first move frame was already recorded.
    expect(result.frames).toHaveLength(1);
    expect(result.actions).toHaveLength(1);
    expect(result.steps).toBe(1);
  });
});

describe('runPythonCore — action recording', () => {
  it('actions array matches the realized command trace', () => {
    const level = makeLevel('H.G', { reachGoal: true }, { heroHp: 9 });
    const result = runPythonCore({
      level,
      code: 'hero.moveRight()\nhero.wait()\nhero.moveRight()',
      execLimitMs: 2000,
      Sk,
    });

    expect(result.actions).toEqual([
      { op: 'move', dir: 'right' },
      { op: 'wait' },
      { op: 'move', dir: 'right' },
    ]);
  });

  it('hero.attack() records an attack command', () => {
    // H faces right by default — goblin at x=1.
    const level = makeLevel('HgG', { reachGoal: true }, { heroHp: 9 });
    const result = runPythonCore({
      level,
      code: 'hero.attack()',
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(true);
    expect(result.actions[0]).toEqual({ op: 'attack', target: undefined });
    expect(result.frames[0].events.some((e) => e.type === 'attack')).toBe(true);
  });

  it('hero.collect() records a collect command', () => {
    // Move to coin tile, then collect.
    const level = makeLevel('HcG', { collectAllCoins: true });
    const result = runPythonCore({
      level,
      code: 'hero.moveRight()\nhero.collect()',
      execLimitMs: 2000,
      Sk,
    });

    expect(result.ok).toBe(true);
    expect(result.actions).toEqual([
      { op: 'move', dir: 'right' },
      { op: 'collect', target: undefined },
    ]);
  });
});

describe('runPythonCore — determinism', () => {
  it('running the same code twice on the same level produces identical results', () => {
    const level = makeLevel('H..G', { reachGoal: true });
    const code = 'hero.moveRight()\nhero.moveRight()\nhero.moveRight()';

    const r1 = runPythonCore({ level, code, execLimitMs: 2000, Sk });
    const r2 = runPythonCore({ level, code, execLimitMs: 2000, Sk });

    expect(r1.finalStatus).toBe(r2.finalStatus);
    expect(r1.actions).toEqual(r2.actions);
    expect(r1.steps).toBe(r2.steps);
    expect(r1.frames.map((f) => f.state.hero.pos)).toEqual(
      r2.frames.map((f) => f.state.hero.pos),
    );
  });

  it('does not mutate the LevelDef between runs', () => {
    const level = makeLevel('H..G', { reachGoal: true });
    const snapshot = JSON.stringify(level);
    runPythonCore({ level, code: 'hero.moveRight()', execLimitMs: 2000, Sk });
    expect(JSON.stringify(level)).toBe(snapshot);
  });
});
