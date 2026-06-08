/**
 * L07 — "Three Coins"
 * Band B · Concept: collect multiple items; order / route planning
 *
 * Three coins are laid out along a simple zig-zag path.  Students must
 * visit each coin's tile and collect it before reaching the goal.
 * This level previews the tedium that loops will later solve.
 *
 * Grid (3 cols × 3 rows):
 *   H c .
 *   . c .
 *   . c G
 *
 * Positions:
 *   Hero   (0,0)
 *   Coin 1 (1,0)
 *   Coin 2 (1,1)
 *   Coin 3 (1,2)
 *   Goal   (2,2)
 *
 * Solution:
 *   moveRight, collect          → (1,0) pick up coin-1   [2]
 *   moveDown,  collect          → (1,1) pick up coin-2   [4]
 *   moveDown,  collect          → (1,2) pick up coin-3   [6]
 *   moveRight                   → (2,2) goal             [7]
 *   Total: 7 steps
 *
 * Victory: collectAllCoins AND reachGoal
 *
 * TODO i18n
 */

import type { CodecasterLevel } from '../types';

const L07: CodecasterLevel = {
  // ── engine fields ──────────────────────────────────────────────────────────
  id: 'L07',
  cols: 3,
  rows: 3,
  tiles: [
    ['floor', 'floor', 'floor'],
    ['floor', 'floor', 'floor'],
    ['floor', 'floor', 'goal'],
  ],
  entities: [
    { id: 'coin-1', kind: 'coin', pos: { x: 1, y: 0 } },
    { id: 'coin-2', kind: 'coin', pos: { x: 1, y: 1 } },
    { id: 'coin-3', kind: 'coin', pos: { x: 1, y: 2 } },
  ],
  heroStart: { x: 0, y: 0 },
  heroFacing: 'right',
  heroHp: 3,
  victory: { collectAllCoins: true, reachGoal: true },
  maxSteps: 30,

  // ── curriculum metadata ────────────────────────────────────────────────────
  title: 'Three Coins',
  band: 'B',
  concept: 'Collect multiple items',
  objective: 'Grab all three coins as you travel down the path, then reach the goal.',
  starterCode: [
    '# Collect each coin as you pass it',
    'hero.moveRight()',
    'hero.collect()  # pick up coin 1',
    '# keep going down and collecting',
  ].join('\n'),
  parSteps: 8,
  requireConcept: 'collect_multi',
  hints: [
    'You must stand on each coin\'s tile and call `hero.collect()` before moving on.',
    'The coins are in a column — move right once, then keep moving down and collecting.',
    'Pattern:\nmoveRight → collect\nmoveDown → collect\nmoveDown → collect\nmoveRight (goal)',
  ],
  commands: ['moveRight','moveDown','collect'],
};

export default L07;
