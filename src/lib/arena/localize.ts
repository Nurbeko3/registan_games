/** Localized authoring model for the BATTLE LEARN ARENA question bank.
 *
 *  The static bank (`src/data/arenaQuestions.ts`) and admin-imported questions
 *  (Excel → Supabase) both use `LocalizedQuestion`: every human-readable field
 *  carries all three locales (uz/ru/en), while code/structure fields stay
 *  language-neutral. `localize()` flattens one locale into the runtime
 *  `ArenaQuestion` the engine + renderer already understand, so nothing
 *  downstream changes. */

import type { ArenaQuestion, Category, Difficulty, Grade } from './types';
import type { Locale } from '@/lib/i18n/config';

export interface L10n {
  uz: string;
  ru: string;
  en: string;
}
export interface L10nList {
  uz: string[];
  ru: string[];
  en: string[];
}

export interface LocalizedQuestion {
  id: string;
  type: ArenaQuestion['type'];
  category: Category;
  difficulty: Difficulty;
  grade: Grade;
  emoji: string;
  prompt: L10n;
  explain: L10n;
  /** mcq / code-fill — option labels per locale (same length & order across locales). */
  options?: L10nList;
  /** mcq / code-fill — index of the correct option. */
  answer?: number;
  /** truefalse. */
  boolAnswer?: boolean;
  /** code-fill — the snippet with the literal "___" blank (language-neutral). */
  code?: string;
  /** debug — code lines (language-neutral) + the buggy line index. */
  lines?: string[];
  buggyLine?: number;
  /** order — blocks in the CORRECT order (language-neutral). */
  blocks?: string[];
  /** binary — target value 1..31. */
  target?: number;
}

/** Locales to fall back through when the requested one is empty — never blank. */
const FALLBACK: Locale[] = ['en', 'ru', 'uz'];

export function pickText(t: L10n, locale: Locale): string {
  if (t[locale]?.trim()) return t[locale];
  for (const l of FALLBACK) if (t[l]?.trim()) return t[l];
  return '';
}

function pickList(t: L10nList | undefined, locale: Locale): string[] {
  if (!t) return [];
  if (t[locale]?.length) return t[locale];
  for (const l of FALLBACK) if (t[l]?.length) return t[l];
  return [];
}

/** Flatten a localized question into a runtime ArenaQuestion for one locale. */
export function localize(q: LocalizedQuestion, locale: Locale): ArenaQuestion {
  const base = {
    id: q.id,
    category: q.category,
    difficulty: q.difficulty,
    grade: q.grade,
    emoji: q.emoji,
    prompt: pickText(q.prompt, locale),
    explain: pickText(q.explain, locale),
  };
  switch (q.type) {
    case 'truefalse':
      return { ...base, type: 'truefalse', answer: !!q.boolAnswer };
    case 'code-fill':
      return { ...base, type: 'code-fill', code: q.code ?? '', options: pickList(q.options, locale), answer: q.answer ?? 0 };
    case 'debug':
      return { ...base, type: 'debug', lines: q.lines ?? [], buggyLine: q.buggyLine ?? 0 };
    case 'order':
      return { ...base, type: 'order', blocks: q.blocks ?? [] };
    case 'binary':
      return { ...base, type: 'binary', target: q.target ?? 1 };
    case 'mcq':
    default:
      return { ...base, type: 'mcq', options: pickList(q.options, locale), answer: q.answer ?? 0 };
  }
}
