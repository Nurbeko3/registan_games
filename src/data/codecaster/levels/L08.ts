/**
 * L08 — "Locked Door"
 * Band B · Concept: hero.useKey() — pick up a key, open a door, pass through
 *
 * A key sits one step to the right of the hero.  A closed door blocks the
 * path to the goal.  Students must:
 *   1. Move onto the key tile.
 *   2. Collect the key (hero.collect()).
 *   3. Face the door and call hero.useKey().
 *   4. Walk through the now-open door to the goal.
 *
 * Grid (5 cols × 1 row):
 *   H k D . G
 *   (0) (1)=key (2)=door (3) (4)=goal
 *
 * Victory: reachGoal
 * Solution: moveRight, collect, useKey, moveRight, moveRight → 5 steps
 */

import type { CodecasterLevel } from '../types';

const L08: CodecasterLevel = {
  // ── engine fields ──────────────────────────────────────────────────────────
  id: 'L08',
  cols: 5,
  rows: 1,
  tiles: [['floor', 'floor', 'door', 'floor', 'goal']],
  entities: [
    { id: 'key-1', kind: 'key', pos: { x: 1, y: 0 } },
  ],
  heroStart: { x: 0, y: 0 },
  heroFacing: 'right',
  heroHp: 3,
  startKeys: 0,
  victory: { reachGoal: true },
  maxSteps: 20,

  // ── curriculum metadata ────────────────────────────────────────────────────
  title: 'cc.level.L08.title',
  band: 'B',
  concept: 'cc.level.L08.concept',
  objective: 'cc.level.L08.objective',
  starterCode: 'cc.level.L08.starter',
  parSteps: 7,
  requireConcept: 'useKey',
  hints: ['cc.level.L08.hint1', 'cc.level.L08.hint2', 'cc.level.L08.hint3'],
  commands: ['moveRight','collect','useKey'],
};

export default L08;
