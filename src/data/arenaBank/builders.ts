/** Compact authoring helpers for the arena question bank.
 *
 *  Every builder returns a `LocalizedQuestion`. Human-readable text carries all
 *  three locales; code / emoji fields stay language-neutral. For option-based
 *  questions the CORRECT option is always authored FIRST — the engine
 *  re-shuffles options on every showing, so on-screen order is random. */

import type { Category, Difficulty, Grade } from '@/lib/arena/types';
import type { L10n, LocalizedQuestion } from '@/lib/arena/localize';

/** Shared header: id, category, grade, difficulty, emoji. */
export type Meta = [id: string, category: Category, grade: Grade, difficulty: Difficulty, emoji: string];

/** Multiple choice. Each locale row is `[prompt, correct, wrong, wrong, wrong, explain]`. */
export function mcq(meta: Meta, uz: string[], ru: string[], en: string[]): LocalizedQuestion {
  const [id, category, grade, difficulty, emoji] = meta;
  return {
    id, type: 'mcq', category, difficulty, grade, emoji, answer: 0,
    prompt: { uz: uz[0], ru: ru[0], en: en[0] },
    options: { uz: uz.slice(1, 5), ru: ru.slice(1, 5), en: en.slice(1, 5) },
    explain: { uz: uz[5], ru: ru[5], en: en[5] },
  };
}

/** Multiple choice whose options are language-neutral (code, tags, numbers):
 *  one `options` list shared by every locale, correct one first. */
export function pick(meta: Meta, prompt: L10n, options: string[], explain: L10n): LocalizedQuestion {
  const [id, category, grade, difficulty, emoji] = meta;
  return {
    id, type: 'mcq', category, difficulty, grade, emoji, answer: 0,
    prompt, options: { uz: options, ru: options, en: options }, explain,
  };
}

/** True / false statement. */
export function tf(meta: Meta, answer: boolean, prompt: L10n, explain: L10n): LocalizedQuestion {
  const [id, category, grade, difficulty, emoji] = meta;
  return { id, type: 'truefalse', category, difficulty, grade, emoji, boolAnswer: answer, prompt, explain };
}

/** Code completion: `code` holds a literal `___`; `options` are code tokens
 *  (same in every locale), correct one first. */
export function fill(meta: Meta, code: string, options: string[], prompt: L10n, explain: L10n): LocalizedQuestion {
  const [id, category, grade, difficulty, emoji] = meta;
  return {
    id, type: 'code-fill', category, difficulty, grade, emoji, code, answer: 0,
    options: { uz: options, ru: options, en: options },
    prompt, explain,
  };
}

/** Put the blocks in order. `blocks` is the CORRECT order and must be unique. */
export function order(meta: Meta, blocks: string[], prompt: L10n, explain: L10n): LocalizedQuestion {
  const [id, category, grade, difficulty, emoji] = meta;
  return { id, type: 'order', category, difficulty, grade, emoji, blocks, prompt, explain };
}

/** Find the buggy line. */
export function debug(meta: Meta, lines: string[], buggyLine: number, prompt: L10n, explain: L10n): LocalizedQuestion {
  const [id, category, grade, difficulty, emoji] = meta;
  return { id, type: 'debug', category, difficulty, grade, emoji, lines, buggyLine, prompt, explain };
}

/** Build the binary (0–31) toggle question. */
export function binary(meta: Meta, target: number, prompt: L10n, explain: L10n): LocalizedQuestion {
  const [id, category, grade, difficulty, emoji] = meta;
  return { id, type: 'binary', category, difficulty, grade, emoji, target, prompt, explain };
}

/** Shorthand for an L10n triple. */
export const L = (uz: string, ru: string, en: string): L10n => ({ uz, ru, en });
