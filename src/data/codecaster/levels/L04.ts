/**
 * L04 — "The Long Hall"
 * Band A · Concept: longer sequences / counting tiles
 *
 * A longer path with one bend: students must count floor tiles carefully
 * and write a matching sequence of commands.  Reinforces that one command
 * = one tile and teaches deliberate counting before coding.
 *
 * Grid (5 cols × 2 rows):
 *   H . . . .
 *   # # # # G
 *
 * Solution: moveRight ×4, moveDown → 5 steps
 *
 * TODO i18n
 */

import type { CodecasterLevel } from '../types';

const L04: CodecasterLevel = {
  // ── engine fields ──────────────────────────────────────────────────────────
  id: 'L04',
  cols: 5,
  rows: 2,
  tiles: [
    ['floor', 'floor', 'floor', 'floor', 'floor'],
    ['wall',  'wall',  'wall',  'wall',  'goal'],
  ],
  entities: [],
  heroStart: { x: 0, y: 0 },
  heroFacing: 'right',
  heroHp: 3,
  victory: { reachGoal: true },
  maxSteps: 30,

  // ── curriculum metadata ────────────────────────────────────────────────────
  title: 'The Long Hall',
  band: 'A',
  concept: 'Counting tiles',
  objective: 'Pip must reach the end of a long corridor and then drop down to the goal. Count each tile!',
  starterCode: [
    '# Count the tiles, then write one command per tile',
    'hero.moveRight()',
    '# Keep going...',
  ].join('\n'),
  parSteps: 6,
  requireConcept: 'sequence',
  hints: [
    'Count the floor tiles in the top row — that tells you how many times to call `moveRight()`.',
    'After you reach the far-right column, use `hero.moveDown()` to step onto the goal.',
    'Four `hero.moveRight()` calls followed by one `hero.moveDown()` will get you there.',
  ],
  commands: ['moveRight','moveDown'],
};

export default L04;
