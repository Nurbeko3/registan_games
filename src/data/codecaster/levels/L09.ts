/**
 * L09 — "Speak, Friend"
 * Band B · Concept: hero.say() — producing output (like print)
 *
 * A short corridor with a rune inscription on the wall (flavour only — a
 * wall tile the hero never needs to enter).  Students must call hero.say()
 * with the secret word before walking to the goal.  This teaches that
 * programs can *output* text, mirroring Python's print() concept.
 *
 * Grid (4 cols × 1 row):
 *   H . . G
 *
 * Victory: reachGoal  (say() is graded by requireConcept, not by victory flag)
 * Solution: say("open"), moveRight, moveRight, moveRight → 4 steps
 *
 * NOTE: The engine's `say` command appends to the log — there is no
 *       "victory requires say" condition in the current engine, so we
 *       gate the 3rd star via requireConcept: 'say' instead.
 */

import type { CodecasterLevel } from '../types';

const L09: CodecasterLevel = {
  // ── engine fields ──────────────────────────────────────────────────────────
  id: 'L09',
  cols: 4,
  rows: 1,
  tiles: [['floor', 'floor', 'floor', 'goal']],
  entities: [],
  heroStart: { x: 0, y: 0 },
  heroFacing: 'right',
  heroHp: 3,
  victory: { reachGoal: true },
  maxSteps: 20,

  // ── curriculum metadata ────────────────────────────────────────────────────
  title: 'cc.level.L09.title',
  band: 'B',
  concept: 'cc.level.L09.concept',
  objective: 'cc.level.L09.objective',
  starterCode: 'cc.level.L09.starter',
  parSteps: 5,
  requireConcept: 'say',
  hints: ['cc.level.L09.hint1', 'cc.level.L09.hint2', 'cc.level.L09.hint3'],
  commands: ['moveRight','say'],
};

export default L09;
