/**
 * L10 — "The Sleeping Golem" (Mini-Boss)
 * Band B/Synthesis · Concept: precise sequencing under pressure + combat
 *
 * Band A & B synthesis boss.  A Stone Golem with 3 hit points blocks the
 * exit.  Students must attack it three times in sequence, then walk to the
 * goal.  The twist: the Golem counterattacks every turn it is adjacent to
 * Pip — students learn that their code executes in order and that standing
 * next to a boss has consequences, making the step budget real.
 *
 * Grid (5 cols × 1 row):
 *   H B . . G
 *   (0) (1)=boss(hp3) (2) (3) (4)=goal
 *
 * Turn model (heroHp starts at 3):
 *   Turn 1: attack → boss hp 2; enemy phase: boss adj → hero hp 2
 *   Turn 2: attack → boss hp 1; enemy phase: boss adj → hero hp 1
 *   Turn 3: attack → boss hp 0, defeated (removed); enemy phase: no boss → safe
 *   Turn 4: moveRight → (1,0)
 *   Turn 5: moveRight → (2,0)   [no enemies, spike-phase not relevant]
 *   Turn 6: moveRight → (3,0)
 *   Turn 7: moveRight → (4,0)=goal → WON
 *
 * Pip survives with hp = 1.  Total: 7 steps.
 *
 * Victory: defeatBoss AND reachGoal
 *
 * TODO i18n
 */

import type { CodecasterLevel } from '../types';

const L10: CodecasterLevel = {
  // ── engine fields ──────────────────────────────────────────────────────────
  id: 'L10',
  cols: 5,
  rows: 1,
  tiles: [['floor', 'floor', 'floor', 'floor', 'goal']],
  entities: [
    { id: 'boss-1', kind: 'boss', pos: { x: 1, y: 0 }, hp: 3 },
  ],
  heroStart: { x: 0, y: 0 },
  heroFacing: 'right',
  heroHp: 3,
  victory: { defeatBoss: true, reachGoal: true },
  maxSteps: 30,

  // ── curriculum metadata ────────────────────────────────────────────────────
  title: 'The Sleeping Golem',
  band: 'B',
  concept: 'Sequencing synthesis + combat',
  objective: 'The Stone Golem has 3 hit points. Strike it three times in order, then escape to the exit!',
  starterCode: [
    '# The Golem has 3 HP — hit it once for each HP point',
    'hero.attack()  # hit 1',
    '# add two more attacks, then walk to the goal',
  ].join('\n'),
  parSteps: 8,
  requireConcept: 'boss_defeat',
  hints: [
    'The Golem blocks the path — you cannot walk through it. Call `hero.attack()` to hit it.',
    'The Golem has 3 hit points, so you need three `hero.attack()` calls to defeat it.',
    'After three attacks the Golem falls. Then walk right four times to reach the goal:\nattack × 3\nmoveRight × 4',
  ],
  commands: ['attack','moveRight'],
};

export default L10;
