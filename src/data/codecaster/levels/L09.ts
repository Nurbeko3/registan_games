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
 *
 * TODO i18n
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
  title: 'Speak, Friend',
  band: 'B',
  concept: 'hero.say() / output',
  objective: 'Say the magic word "open" to the rune gate, then walk to the goal.',
  starterCode: [
    '# Speak the magic word (this is like Python\'s print() function)',
    'hero.say("open")',
    '# Now walk to the goal',
  ].join('\n'),
  parSteps: 5,
  requireConcept: 'say',
  hints: [
    '`hero.say("open")` makes Pip speak — it\'s like Python\'s `print("open")` command.',
    'Text must be inside quotes. `hero.say(open)` will fail; `hero.say("open")` works.',
    'After saying the word, walk right three times:\nhero.say("open")\nhero.moveRight()\nhero.moveRight()\nhero.moveRight()',
  ],
  commands: ['moveRight','say'],
};

export default L09;
