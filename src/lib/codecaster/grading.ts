/**
 * grading.ts — turn a finished Codecaster run into a 0–3 star grade.
 *
 * PURE logic (no React/DOM). A thin wrapper over the engine's `gradeRun`
 * (star semantics live there) plus the curriculum "concept gate": did the
 * student actually demonstrate the level's target concept, or just brute-force
 * it? See docs/codecaster-design.md §1.7 / §5.
 *
 * Star rules (consistent with engine.ts `gradeRun`):
 *   ⭐   = won at all.
 *   ⭐⭐  = won AND steps ≤ level.parSteps.
 *   ⭐⭐⭐ = ⭐⭐ AND conceptUsed AND hintsUsed === 0.
 *           (Using a hint honestly caps the level at ⭐⭐.)
 *
 * --------------------------------------------------------------------------
 * requireConcept → check mapping (data ConceptKey, see data/codecaster/types.ts)
 * --------------------------------------------------------------------------
 * Two families:
 *   (a) PYTHON-STRUCTURE concepts → inspected via `analyzePython(code)` /
 *       `usedConcept`, the static (AST-ish) scanner. These describe *how* the
 *       code is written, independent of the run trace.
 *         single_call → at least one function call          → analyze.call
 *         sequence    → ≥1 statement                         → analyze.sequence
 *         comment     → a real `#` comment present           → analyze.comment
 *       (Future structural keys like 'for'/'while'/'def' map straight onto the
 *        matching staticChecks ConceptKey — left as a documented passthrough.)
 *
 *   (b) COMMAND-TRACE concepts → inspected via the realized `actions` trace
 *       (what the hero *did*), because the proof is behavioural, not syntactic:
 *         collect       → ≥1 'collect' op in the trace
 *         collect_multi → ≥3 'collect' ops in the trace
 *         useKey        → ≥1 'useKey' op in the trace
 *         say           → ≥1 'say' op in the trace
 *         boss_defeat   → the run is 'won' on a defeatBoss level
 *
 * If `requireConcept` is null/undefined there is NO concept gate: `conceptUsed`
 * defaults to true, so a flawless, hint-free win can still earn ⭐⭐⭐.
 */

import { DungeonEngine, gradeRun } from './engine';
import { analyzePython } from './staticChecks';
import type { Command, GameStatus } from './types';
import type { CodecasterLevel } from '@/data/codecaster/types';

/** The graded result of one Codecaster level attempt. */
export interface CodecasterGrade {
  won: boolean;
  stars: 0 | 1 | 2 | 3;
  steps: number;
  /** Did the run demonstrate the level's target concept? (gate for ⭐⭐⭐) */
  conceptUsed: boolean;
}

/** Count how many times a given primitive op appears in the realized trace. */
function countOp(actions: Command[], op: Command['op']): number {
  return actions.reduce((n, a) => (a.op === op ? n + 1 : n), 0);
}

/**
 * Decide whether the run demonstrates `level.requireConcept`.
 * null/undefined concept → no gate → true.
 */
function evalConcept(
  level: CodecasterLevel,
  code: string,
  actions: Command[],
  won: boolean,
  doorsOpened: number,
): boolean {
  const key = level.requireConcept;
  if (key == null) return true; // no concept gate

  switch (key) {
    // (a) Python-structure concepts — static code analysis.
    case 'single_call':
      return analyzePython(code).call;
    case 'sequence':
      return analyzePython(code).sequence;
    case 'comment':
      return analyzePython(code).comment;

    // (b) Command-trace concepts — realized action trace.
    case 'collect':
      return countOp(actions, 'collect') >= 1;
    case 'collect_multi':
      return countOp(actions, 'collect') >= 3;
    case 'useKey':
      // A whiffed useKey() (no key / no door ahead) must NOT earn the concept —
      // require the replay to have actually opened a door.
      return doorsOpened >= 1;
    case 'say':
      return countOp(actions, 'say') >= 1;
    case 'boss_defeat':
      // Proven by actually winning a defeatBoss level.
      return won && level.victory.defeatBoss === true;

    default: {
      // Exhaustiveness guard: a new ConceptKey must be handled above.
      const _never: never = key;
      return Boolean(_never);
    }
  }
}

/**
 * Grade a finished Codecaster attempt.
 *
 * `status`/`steps` come from the run that already happened (RunResult), but we
 * re-derive the win deterministically by replaying `actions` through the engine
 * (`runActions`) — the same server-replay path used for anti-cheat — so the
 * grade can never disagree with the canonical engine. `gradeRun` then applies
 * the par/hint/concept star rules.
 */
export function gradeCodecaster(
  input: { status: GameStatus; steps: number; actions: Command[]; code: string },
  level: CodecasterLevel,
  opts: { hintsUsed: number },
): CodecasterGrade {
  // Deterministic replay → authoritative win + step count. We replay manually
  // (rather than runActions) so we can observe per-step events — specifically
  // 'door' openings, which prove a useKey() actually worked (not a whiff).
  const engine = new DungeonEngine(level);
  let doorsOpened = 0;
  for (const a of input.actions) {
    if (engine.status !== 'playing') break;
    const { events } = engine.apply(a);
    doorsOpened += events.reduce((n, e) => (e.type === 'door' ? n + 1 : n), 0);
  }
  const won = engine.status === 'won';

  const conceptUsed = evalConcept(level, input.code, input.actions, won, doorsOpened);

  const grade = gradeRun(engine, {
    parSteps: level.parSteps,
    conceptUsed,
    hintsUsed: opts.hintsUsed,
  });

  return {
    won: grade.won,
    stars: grade.stars,
    steps: grade.steps,
    conceptUsed,
  };
}
