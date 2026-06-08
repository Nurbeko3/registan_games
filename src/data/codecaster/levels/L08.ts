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
 *
 * TODO i18n
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
  title: 'Locked Door',
  band: 'B',
  concept: 'hero.useKey()',
  objective: 'Pick up the key, open the door, and reach the goal on the other side.',
  starterCode: [
    '# Step 1: move onto the key and collect it',
    'hero.moveRight()',
    'hero.collect()   # picks up the key',
    '# Step 2: face the door and use the key',
    '# Step 3: walk through to the goal',
  ].join('\n'),
  parSteps: 7,
  requireConcept: 'useKey',
  hints: [
    'You need a key before you can open a door — move onto the glowing key tile and call `hero.collect()` first.',
    'Once you have the key, call `hero.useKey()` while facing the door to unlock it.',
    'Full solution:\nhero.moveRight()\nhero.collect()\nhero.useKey()\nhero.moveRight()\nhero.moveRight()\nhero.moveRight()',
  ],
  commands: ['moveRight','collect','useKey'],
};

export default L08;
