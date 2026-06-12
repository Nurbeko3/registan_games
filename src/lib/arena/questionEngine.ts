/** Educational question engine for BATTLE LEARN ARENA.
 *
 *  Responsibilities:
 *   • scale difficulty to the player's level
 *   • pick a fresh question (avoid repeats within a match)
 *   • randomize answer/option order every time it is shown  ← anti-cheat-learning
 *
 *  Pure & framework-free so it is trivially unit-testable and reusable. */

import { ARENA_QUESTIONS_L10N } from '@/data/arenaQuestions';
import { getCloudQuestions } from './cloudQuestions';
import { localize, type LocalizedQuestion } from './localize';
import type { ArenaQuestion, Category, Difficulty, Grade, PreparedQuestion } from './types';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';


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
  /** optional grade filter (1–11); widened away if it would empty the pool */
  grade?: Grade;
  /** when true, ignore the level→difficulty ramp and draw uniformly from the
   *  whole bank so every question can appear (the arena death pod uses this). */
  anyDifficulty?: boolean;
  locale?: Locale;
}

/** The full authoring pool: static bank + any admin-imported cloud questions.
 *  `getCloudQuestions()` is empty offline, so this is just the static bank. */
function allQuestions(): LocalizedQuestion[] {
  return [...ARENA_QUESTIONS_L10N, ...getCloudQuestions()];
}

/** Choose a question for the given level, preferring the target difficulty but
 *  gracefully widening if the pool is exhausted, then prepare it for display.
 *  Selection runs on the localized pool; the chosen one is flattened to the
 *  active locale at the end. */
export function pickQuestion({ level, exclude, categories, grade, anyDifficulty, locale = DEFAULT_LOCALE }: PickOptions): PreparedQuestion {
  const wanted = difficultyForLevel(level);
  const all = allQuestions();

  const matches = (q: LocalizedQuestion, diffs: Difficulty[], useGrade: boolean) =>
    diffs.includes(q.difficulty) &&
    (!categories || categories.length === 0 || categories.includes(q.category)) &&
    (!useGrade || grade === undefined || q.grade === grade) &&
    !(exclude?.has(q.id));

  // anyDifficulty → one rung over the whole bank; otherwise ramp to the level's
  // difficulty first, then widen. Either way grade is tried first, then dropped.
  const ALL_DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
  const ladder: Difficulty[][] = anyDifficulty ? [ALL_DIFFS] : [[wanted], ALL_DIFFS];
  let pool: LocalizedQuestion[] = [];
  for (const useGrade of [true, false]) {
    for (const diffs of ladder) {
      pool = all.filter((q) => matches(q, diffs, useGrade));
      if (pool.length) break;
    }
    if (pool.length) break;
  }
  if (!pool.length) pool = all.filter((q) => !categories || categories.includes(q.category));
  if (!pool.length) pool = [...all];

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  return prepare(localize(chosen, locale));
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
      const labels = q.answer ? ['True', 'False'] : ['True', 'False'];
      const options = trueFirst ? labels : [...labels].reverse();
      const correctIndex = options.indexOf(q.answer ? labels[0] : labels[1]);
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
