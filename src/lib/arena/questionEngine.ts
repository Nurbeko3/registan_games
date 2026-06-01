/** Educational question engine for BATTLE LEARN ARENA.
 *
 *  Responsibilities:
 *   • scale difficulty to the player's level
 *   • pick a fresh question (avoid repeats within a match)
 *   • randomize answer/option order every time it is shown  ← anti-cheat-learning
 *
 *  Pure & framework-free so it is trivially unit-testable and reusable. */

import { ARENA_QUESTIONS } from '@/data/arenaQuestions';
import type { ArenaQuestion, Category, Difficulty, PreparedQuestion } from './types';

/** Fisher–Yates shuffle returning a new array (never mutates the input). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Difficulty ramp from the spec: Lv 1–4 easy · 5–14 medium · 15+ hard. */
export function difficultyForLevel(level: number): Difficulty {
  if (level >= 15) return 'hard';
  if (level >= 5) return 'medium';
  return 'easy';
}

interface PickOptions {
  level: number;
  /** ids already used this match — skipped so questions feel fresh */
  exclude?: ReadonlySet<string>;
  /** optional category filter (defaults to all six) */
  categories?: Category[];
}

/** Choose a question for the given level, preferring the target difficulty but
 *  gracefully widening if the pool is exhausted, then prepare it for display. */
export function pickQuestion({ level, exclude, categories }: PickOptions): PreparedQuestion {
  const wanted = difficultyForLevel(level);

  const matches = (q: ArenaQuestion, diffs: Difficulty[]) =>
    diffs.includes(q.difficulty) &&
    (!categories || categories.length === 0 || categories.includes(q.category)) &&
    !(exclude?.has(q.id));

  // try exact difficulty → adjacent difficulties → ignore the exclude set
  const ladder: Difficulty[][] = [[wanted], ['easy', 'medium', 'hard']];
  let pool: ArenaQuestion[] = [];
  for (const diffs of ladder) {
    pool = ARENA_QUESTIONS.filter((q) => matches(q, diffs));
    if (pool.length) break;
  }
  if (!pool.length) pool = ARENA_QUESTIONS.filter((q) => !categories || categories.includes(q.category));
  if (!pool.length) pool = [...ARENA_QUESTIONS];

  const q = pool[Math.floor(Math.random() * pool.length)];
  return prepare(q);
}

/** Randomize the presentation of a question so it never looks identical twice. */
export function prepare(q: ArenaQuestion): PreparedQuestion {
  switch (q.type) {
    case 'mcq':
    case 'code-fill': {
      const correctText = q.options[q.answer];
      const options = shuffle(q.options);
      return { q, options, correctIndex: options.indexOf(correctText) };
    }
    case 'truefalse': {
      // present in a random order; correctIndex points at the right one
      const trueFirst = Math.random() < 0.5;
      const options = trueFirst ? ['True', 'False'] : ['False', 'True'];
      const correctIndex = options.indexOf(q.answer ? 'True' : 'False');
      return { q, options, correctIndex };
    }
    case 'order':
      return { q, shuffledBlocks: shuffle(q.blocks) };
    case 'debug':
    case 'binary':
      return { q }; // already varied (random target / line layout)
  }
}

/** Grade a prepared question against the player's response.
 *  `response` shape depends on the type:
 *    mcq/code-fill/truefalse → number (chosen option index)
 *    order                   → string[] (chosen block order)
 *    debug                   → number (chosen line index)
 *    binary                  → number (assembled value)            */
export function isCorrect(p: PreparedQuestion, response: number | string[]): boolean {
  const { q } = p;
  switch (q.type) {
    case 'mcq':
    case 'code-fill':
    case 'truefalse':
      return response === p.correctIndex;
    case 'debug':
      return response === q.buggyLine;
    case 'binary':
      return response === q.target;
    case 'order':
      return Array.isArray(response) && response.join('|') === q.blocks.join('|');
  }
}
