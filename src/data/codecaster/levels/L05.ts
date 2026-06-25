/**
 * L05 — "Mind the Comment"
 * Band A · Concept: comments are ignored by Python (#)
 *
 * The starter code has a tempting `# hero.moveLeft()` comment-decoy on a
 * dead-end branch.  Students learn that lines starting with `#` are notes
 * for humans, not instructions for the hero.
 *
 * Grid (5 cols × 2 rows):
 *   # W W W W
 *   H . . . G
 *
 * (top row is all walls — the "decoy" branch, explained in the comment)
 * Solution: moveRight ×4 → 4 steps
 */

import type { CodecasterLevel } from '../types';

const L05: CodecasterLevel = {
  // ── engine fields ──────────────────────────────────────────────────────────
  id: 'L05',
  cols: 5,
  rows: 2,
  tiles: [
    ['wall', 'wall', 'wall', 'wall', 'wall'],
    ['floor', 'floor', 'floor', 'floor', 'goal'],
  ],
  entities: [],
  heroStart: { x: 0, y: 1 },
  heroFacing: 'right',
  heroHp: 3,
  victory: { reachGoal: true },
  maxSteps: 20,

  // ── curriculum metadata ────────────────────────────────────────────────────
  title: 'cc.level.L05.title',
  band: 'A',
  concept: 'cc.level.L05.concept',
  objective: 'cc.level.L05.objective',
  starterCode: 'cc.level.L05.starter',
  parSteps: 5,
  requireConcept: 'comment',
  hints: ['cc.level.L05.hint1', 'cc.level.L05.hint2', 'cc.level.L05.hint3'],
  commands: ['moveRight','comment'],
};

export default L05;
