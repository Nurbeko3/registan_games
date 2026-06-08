/**
 * L03 — "Turn the Corner"
 * Band A · Concept: order matters (direction change in a sequence)
 *
 * An L-shaped corridor: Pip must move right twice, then turn and move down
 * once.  Students discover that the order of commands determines the path
 * and that using the wrong direction walks into a wall.
 *
 * Grid (3 cols × 2 rows):
 *   H . .
 *   # # G
 *
 * TODO i18n
 */

import type { CodecasterLevel } from '../types';

const L03: CodecasterLevel = {
  // ── engine fields ──────────────────────────────────────────────────────────
  id: 'L03',
  cols: 3,
  rows: 2,
  tiles: [
    ['floor', 'floor', 'floor'],
    ['wall',  'wall',  'goal'],
  ],
  entities: [],
  heroStart: { x: 0, y: 0 },
  heroFacing: 'right',
  heroHp: 3,
  victory: { reachGoal: true },
  maxSteps: 20,

  // ── curriculum metadata ────────────────────────────────────────────────────
  title: 'Turn the Corner',
  band: 'A',
  concept: 'Order matters',
  objective: 'Guide Pip along the L-shaped path: first go right, then turn down.',
  starterCode: [
    '# Move right along the top row, then turn down',
    'hero.moveRight()',
  ].join('\n'),
  parSteps: 4,
  requireConcept: 'sequence',
  hints: [
    'Follow the path — go right until the corner, then switch to `hero.moveDown()`.',
    'If Pip bumps into a wall, check the order: right first, then down.',
    'Solution:\nhero.moveRight()\nhero.moveRight()\nhero.moveDown()',
  ],
  commands: ['moveRight','moveDown'],
};

export default L03;
