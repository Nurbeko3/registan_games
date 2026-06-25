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
  title: 'cc.level.L03.title',
  band: 'A',
  concept: 'cc.level.L03.concept',
  objective: 'cc.level.L03.objective',
  starterCode: 'cc.level.L03.starter',
  parSteps: 4,
  requireConcept: 'sequence',
  hints: ['cc.level.L03.hint1', 'cc.level.L03.hint2', 'cc.level.L03.hint3'],
  commands: ['moveRight','moveDown'],
};

export default L03;
