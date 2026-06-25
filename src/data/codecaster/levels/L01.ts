/**
 * L01 — "First Step"
 * Band A · Concept: single function call
 *
 * The simplest possible dungeon: one straight corridor, one step to the right.
 * Students learn that a function call moves the hero exactly one tile.
 */

import type { CodecasterLevel } from '../types';

const L01: CodecasterLevel = {
  // ── engine fields ──────────────────────────────────────────────────────────
  id: 'L01',
  cols: 4,
  rows: 1,
  // Row 0: H . . G
  tiles: [['floor', 'floor', 'floor', 'goal']],
  entities: [],
  heroStart: { x: 0, y: 0 },
  heroFacing: 'right',
  heroHp: 3,
  victory: { reachGoal: true },
  maxSteps: 20,

  // ── curriculum metadata ────────────────────────────────────────────────────
  title: 'cc.level.L01.title',
  band: 'A',
  concept: 'cc.level.L01.concept',
  objective: 'cc.level.L01.objective',
  starterCode: 'cc.level.L01.starter',
  parSteps: 3,
  requireConcept: 'single_call',
  hints: ['cc.level.L01.hint1', 'cc.level.L01.hint2', 'cc.level.L01.hint3'],
  commands: ['moveRight'],
};

export default L01;
