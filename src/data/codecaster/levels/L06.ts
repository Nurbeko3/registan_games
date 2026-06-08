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
 *
 * TODO i18n
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
  title: 'Coin Run',
  band: 'B',
  concept: 'hero.collect()',
  objective: 'Pick up the coin on your way to the goal. You must stand on it and then call collect().',
  starterCode: [
    '# Move to the coin, collect it, then reach the goal',
    'hero.moveRight()   # step onto the coin',
    '# collect it here',
    '# then keep going',
  ].join('\n'),
  parSteps: 5,
  requireConcept: 'collect',
  hints: [
    'Move onto the coin\'s tile first — you can\'t collect from a distance.',
    'Once Pip is standing on the coin, call `hero.collect()` to pick it up.',
    'Full solution:\nhero.moveRight()\nhero.collect()\nhero.moveRight()\nhero.moveRight()',
  ],
  commands: ['moveRight','collect'],
};

export default L06;
