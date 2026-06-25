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
  title: 'cc.level.L04.title',
  band: 'A',
  concept: 'cc.level.L04.concept',
  objective: 'cc.level.L04.objective',
  starterCode: 'cc.level.L04.starter',
  parSteps: 6,
  requireConcept: 'sequence',
  hints: ['cc.level.L04.hint1', 'cc.level.L04.hint2', 'cc.level.L04.hint3'],
  commands: ['moveRight','moveDown'],
};

export default L04;
