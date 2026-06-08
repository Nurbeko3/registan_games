/**
 * Codecaster — Level 01–10 correctness proof.
 *
 * For every level we:
 *   1. Run a known-good canonical solution through the engine.
 *   2. Assert the engine status is 'won'.
 *   3. Assert the hero started on a floor tile (level geometry sanity).
 *   4. Assert parSteps >= solution length (grading config is sane).
 *   5. Assert the level id is unique across the set.
 *
 * This file is the authoritative proof that each map is winnable.
 */

import { describe, it, expect } from 'vitest';
import { runActions } from '@/lib/codecaster/engine';
import type { Command } from '@/lib/codecaster/types';
import { CODECASTER_LEVELS, getLevel } from './index';

// ── canonical solutions ──────────────────────────────────────────────────────

/** Shorthand builders so solution arrays stay readable. */
const right  = (): Command => ({ op: 'move', dir: 'right' });
const left   = (): Command => ({ op: 'move', dir: 'left' });
const down   = (): Command => ({ op: 'move', dir: 'down' });
// left/up kept for completeness even if unused in L01-L10
const _up    = (): Command => ({ op: 'move', dir: 'up' });
const _left  = (): Command => left();
void _up; void _left; // suppress unused-variable warnings

const collect = (): Command => ({ op: 'collect' });
const useKey  = (): Command => ({ op: 'useKey' });
const attack  = (): Command => ({ op: 'attack' });
const say     = (text: string): Command => ({ op: 'say', text });

/**
 * Map from level id to its canonical winning action trace.
 * Each trace is the *shortest* clean solution that proves the level winnable.
 */
const SOLUTIONS: Record<string, Command[]> = {
  // ── Band A ──────────────────────────────────────────────────────────────
  // L01: H . . G  (4 cols × 1 row) — move right 3 times
  L01: [right(), right(), right()],

  // L02: H . . . G  (5 cols × 1 row) — move right 4 times
  L02: [right(), right(), right(), right()],

  // L03: H . .   — move right×2 then down×1
  //       # # G
  L03: [right(), right(), down()],

  // L04: H . . . .   — right×4 then down×1
  //       # # # # G
  L04: [right(), right(), right(), right(), down()],

  // L05: # # # # #   — heroStart (0,1); move right×4
  //       H . . . G
  L05: [right(), right(), right(), right()],

  // ── Band B ──────────────────────────────────────────────────────────────
  // L06: H c . G — move right (onto coin), collect, right, right
  L06: [right(), collect(), right(), right()],

  // L07: H c .    move right → collect coin1
  //       . c .   move down  → collect coin2
  //       . c G   move down  → collect coin3 → move right → goal
  L07: [
    right(), collect(),
    down(),  collect(),
    down(),  collect(),
    right(),
  ],

  // L08: H k D . G — right (onto key), collect, useKey (opens door), right×3 to goal (4,0)
  L08: [right(), collect(), useKey(), right(), right(), right()],

  // L09: H . . G — say("open"), then right×3
  L09: [say('open'), right(), right(), right()],

  // ── Band B synthesis / Mini-Boss ────────────────────────────────────────
  // L10: H B . . G (boss hp=3, heroHp=3)
  //   Turn 1: attack → boss hp=2; boss phase: boss adj → hero hp=2
  //   Turn 2: attack → boss hp=1; boss phase: boss adj → hero hp=1
  //   Turn 3: attack → boss hp=0, defeated; no adjacent enemy → hero safe (hp=1)
  //   Turns 4-7: move right×4 to goal at (4,0)
  L10: [attack(), attack(), attack(), right(), right(), right(), right()],
};

// ── id-uniqueness check (must hold before individual tests) ─────────────────

describe('CODECASTER_LEVELS — metadata invariants', () => {
  it('all level ids are unique', () => {
    const ids = CODECASTER_LEVELS.map((l) => l.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('getLevel() finds each registered level by id', () => {
    for (const level of CODECASTER_LEVELS) {
      expect(getLevel(level.id)).toBe(level);
    }
  });

  it('getLevel() returns undefined for unknown ids', () => {
    expect(getLevel('UNKNOWN')).toBeUndefined();
    expect(getLevel('')).toBeUndefined();
  });
});

// ── per-level correctness proofs ─────────────────────────────────────────────

describe('Codecaster levels — canonical solutions', () => {
  for (const level of CODECASTER_LEVELS) {
    const solution = SOLUTIONS[level.id];

    describe(`${level.id} — ${level.title}`, () => {
      it('has a canonical solution defined in this test file', () => {
        expect(solution).toBeDefined();
        expect(solution.length).toBeGreaterThan(0);
      });

      it('hero starts on a floor tile (geometry sanity)', () => {
        const startTile = level.tiles[level.heroStart.y]?.[level.heroStart.x];
        expect(startTile).toBe('floor');
      });

      it('parSteps >= solution length (grading config is sane)', () => {
        expect(level.parSteps).toBeGreaterThanOrEqual(solution.length);
      });

      it('canonical solution wins', () => {
        const engine = runActions(level, solution);
        // Provide a helpful failure message with lose reason if it did not win
        expect(
          engine.status,
          `Expected 'won' but got '${engine.status}' ` +
          `(loseReason: ${engine.state.loseReason ?? 'none'}, ` +
          `hero hp: ${engine.state.hero.hp}, ` +
          `turn: ${engine.turn})`,
        ).toBe('won');
      });

      it('canonical solution step count matches parSteps expectation', () => {
        // The solution must be short enough to earn at least ⭐⭐
        expect(solution.length).toBeLessThanOrEqual(level.parSteps);
      });
    });
  }
});

// ── individual edge-case checks ───────────────────────────────────────────────

describe('L06 — coin is collected (hero.coins increments)', () => {
  it('hero ends with coins = 1', () => {
    const level = getLevel('L06')!;
    const engine = runActions(level, SOLUTIONS.L06);
    expect(engine.state.hero.coins).toBe(1);
  });
});

describe('L07 — all three coins are collected', () => {
  it('hero ends with coins = 3', () => {
    const level = getLevel('L07')!;
    const engine = runActions(level, SOLUTIONS.L07);
    expect(engine.state.hero.coins).toBe(3);
    // No coins should remain on the board
    expect(engine.state.entities.some((e) => e.kind === 'coin')).toBe(false);
  });
});

describe('L08 — key is collected and door is opened', () => {
  it('hero ends with keys = 0 (used the key)', () => {
    const level = getLevel('L08')!;
    const engine = runActions(level, SOLUTIONS.L08);
    expect(engine.state.hero.keys).toBe(0);
  });
});

describe('L09 — say() is logged', () => {
  it('engine log contains "open"', () => {
    const level = getLevel('L09')!;
    const engine = runActions(level, SOLUTIONS.L09);
    expect(engine.state.log).toContain('open');
  });
});

describe('L10 — boss is defeated and hero survives', () => {
  it('no boss entity remains after the solution', () => {
    const level = getLevel('L10')!;
    const engine = runActions(level, SOLUTIONS.L10);
    expect(engine.state.entities.some((e) => e.kind === 'boss')).toBe(false);
  });

  it('hero hp > 0 (survives the counterattacks)', () => {
    const level = getLevel('L10')!;
    const engine = runActions(level, SOLUTIONS.L10);
    expect(engine.state.hero.hp).toBeGreaterThan(0);
  });
});
