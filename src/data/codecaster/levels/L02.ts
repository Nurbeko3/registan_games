/**
 * L02 — "Two Steps"
 * Band A · Concept: sequence (statements run top-to-bottom)
 *
 * A slightly longer corridor: students must call moveRight() twice and
 * discover that Python runs each line in order, one after another.
 *
 * TODO i18n
 */

import type { CodecasterLevel } from '../types';

const L02: CodecasterLevel = {
  // ── engine fields ──────────────────────────────────────────────────────────
  id: 'L02',
  cols: 5,
  rows: 1,
  // Row 0: H . . . G
  tiles: [['floor', 'floor', 'floor', 'floor', 'goal']],
  entities: [],
  heroStart: { x: 0, y: 0 },
  heroFacing: 'right',
  heroHp: 3,
  victory: { reachGoal: true },
  maxSteps: 20,

  // ── curriculum metadata ────────────────────────────────────────────────────
  title: 'Two Steps',
  band: 'A',
  concept: 'Sequence',
  objective: 'Chain multiple move commands to guide Pip all the way to the goal.',
  starterCode: [
    '# Each line runs in order, top to bottom',
    'hero.moveRight()',
    '# Add more commands below',
  ].join('\n'),
  parSteps: 5,
  requireConcept: 'sequence',
  hints: [
    'Write one `hero.moveRight()` call per tile you want to move.',
    'Each command must be on its own line — Python reads them one by one from top to bottom.',
    'You need four `hero.moveRight()` calls in a row to reach the goal.',
  ],
  commands: ['moveRight'],
};

export default L02;
