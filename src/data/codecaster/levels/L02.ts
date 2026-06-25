/**
 * L02 — "Two Steps"
 * Band A · Concept: sequence (statements run top-to-bottom)
 *
 * A slightly longer corridor: students must call moveRight() twice and
 * discover that Python runs each line in order, one after another.
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
  title: 'cc.level.L02.title',
  band: 'A',
  concept: 'cc.level.L02.concept',
  objective: 'cc.level.L02.objective',
  starterCode: 'cc.level.L02.starter',
  parSteps: 5,
  requireConcept: 'sequence',
  hints: ['cc.level.L02.hint1', 'cc.level.L02.hint2', 'cc.level.L02.hint3'],
  commands: ['moveRight'],
};

export default L02;
