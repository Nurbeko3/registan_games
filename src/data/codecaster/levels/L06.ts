/**
 * L06 — "Coin Run"
 * Band B · Concept: hero.collect() — pick up a coin while standing on it
 *
 * A coin sits in the middle of a short corridor.  Students must move onto
 * the coin's tile and then call collect() before continuing to the goal.
 * Introduces the two-step "move onto → collect" pattern.
 *
 * Grid (4 cols × 1 row):
 *   H c . G
 *   (0,0) (1,0)=coin (2,0) (3,0)=goal
 *
 * Victory: collectAllCoins AND reachGoal
 * Solution: move right, collect, move right, move right → 4 steps
 */

import type { CodecasterLevel } from '../types';

const L06: CodecasterLevel = {
  // ── engine fields ──────────────────────────────────────────────────────────
  id: 'L06',
  cols: 4,
  rows: 1,
  tiles: [['floor', 'floor', 'floor', 'goal']],
  entities: [
    { id: 'coin-1', kind: 'coin', pos: { x: 1, y: 0 } },
  ],
  heroStart: { x: 0, y: 0 },
  heroFacing: 'right',
  heroHp: 3,
  victory: { collectAllCoins: true, reachGoal: true },
  maxSteps: 20,

  // ── curriculum metadata ────────────────────────────────────────────────────
  title: 'cc.level.L06.title',
  band: 'B',
  concept: 'cc.level.L06.concept',
  objective: 'cc.level.L06.objective',
  starterCode: 'cc.level.L06.starter',
  parSteps: 5,
  requireConcept: 'collect',
  hints: ['cc.level.L06.hint1', 'cc.level.L06.hint2', 'cc.level.L06.hint3'],
  commands: ['moveRight','collect'],
};

export default L06;
