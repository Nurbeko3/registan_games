/**
 * Codecaster data-layer types.
 *
 * CodecasterLevel extends the engine's LevelDef with authoring / curriculum
 * metadata (titles, hints, starter code, grading config).  The engine itself
 * only needs the LevelDef fields — this wrapper is what the UI and curriculum
 * system consume.
 *
 * TODO i18n — all human-readable strings are plain English for now.
 *             Replace with i18n key lookups in a later pass.
 */

import type { LevelDef } from '@/lib/codecaster/types';
import type { CommandId } from './commands';

/** Curriculum bands A–C cover levels 1–10 in this first release. */
export type Band = 'A' | 'B' | 'C';

/**
 * Identifies the Python concept that unlocks the 3rd star.
 * The grading layer checks whether the student's command trace "demonstrates"
 * the concept (e.g. a real loop, a variable, etc.).  null = no concept gate
 * (stars 1–2 only require winning within par).
 */
export type ConceptKey =
  | 'single_call'       // Band A: one function call
  | 'sequence'          // Band A/B: ordered list of calls
  | 'comment'           // Band A: # comment present
  | 'collect'           // Band B: hero.collect()
  | 'collect_multi'     // Band B: collect ≥ 3 items
  | 'useKey'            // Band B: hero.useKey()
  | 'say'               // Band B: hero.say()
  | 'boss_defeat';      // Synthesis: defeatBoss victory

/** Three escalating hints Byte the mentor can offer. */
export type HintTriple = [string, string, string];

/**
 * A fully-described Codecaster level: simulation fields from LevelDef plus
 * authoring/curriculum metadata consumed by the UI and grading system.
 */
export interface CodecasterLevel extends LevelDef {
  /** Display title shown in the level-select card and mission header. */
  title: string;
  /** Curriculum band this level belongs to. */
  band: Band;
  /** Short name of the Python concept being practised (shown in UI). */
  concept: string;
  /** One-sentence mission objective shown to the student before they code. */
  objective: string;
  /**
   * Pre-filled code placed in the editor when the level loads.
   * Use Python-style placeholder comments to guide the student.
   */
  starterCode: string;
  /**
   * Maximum action-count that earns ⭐⭐ (under-par).
   * Must be ≥ the length of the canonical solution.
   */
  parSteps: number;
  /**
   * The ConceptKey whose presence in the run unlocks ⭐⭐⭐.
   * null means the level does not have a concept gate (stops at ⭐⭐).
   */
  requireConcept: ConceptKey | null;
  /** Three escalating hints from Byte the mentor [easy, medium, specific]. */
  hints: HintTriple;
  /**
   * The ONLY commands surfaced in the palette + autocomplete for this level,
   * in teaching order. Keeps young learners from being shown commands they
   * haven't been taught yet — see `src/data/codecaster/commands.ts`.
   */
  commands: CommandId[];
}
