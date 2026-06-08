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
 *
 * TODO i18n
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
  title: 'Mind the Comment',
  band: 'A',
  concept: 'Comments (#)',
  objective: 'Only real commands move Pip. A commented-out line is a note — it does nothing. Reach the goal!',
  starterCode: [
    '# This is a comment — Python ignores it completely',
    '# hero.moveUp()  ← this does NOT run',
    '',
    '# Write your real commands below:',
    'hero.moveRight()',
  ].join('\n'),
  parSteps: 5,
  requireConcept: 'comment',
  hints: [
    'Lines that start with `#` are comments — they are notes for humans and Python skips them entirely.',
    'The `# hero.moveUp()` line does NOT move Pip — it is just a note. Only un-commented lines run.',
    'Keep going right: four `hero.moveRight()` calls will reach the goal.',
  ],
  commands: ['moveRight','comment'],
};

export default L05;
