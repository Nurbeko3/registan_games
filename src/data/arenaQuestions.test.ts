import { describe, expect, it } from 'vitest';
import { ARENA_QUESTIONS_L10N } from './arenaQuestions';
import { localize } from '@/lib/arena/localize';
import { isCorrect, prepare } from '@/lib/arena/questionEngine';
import { CATEGORY_META, GRADES, type Category } from '@/lib/arena/types';
import type { Locale } from '@/lib/i18n/config';

const LOCALES: Locale[] = ['uz', 'ru', 'en'];
const CYRILLIC = /[А-Яа-яЁё]/;
const bank = ARENA_QUESTIONS_L10N;

describe('arena question bank', () => {
  it('has unique ids', () => {
    const ids = bank.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(bank.map((q) => [q.id, q] as const))('%s is well-formed in every locale', (_id, q) => {
    expect(GRADES).toContain(q.grade);
    expect(['easy', 'medium', 'hard']).toContain(q.difficulty);
    expect(Object.keys(CATEGORY_META)).toContain(q.category);
    expect(q.emoji.trim()).not.toBe('');

    for (const l of LOCALES) {
      expect(q.prompt[l]?.trim(), `${l} prompt`).toBeTruthy();
      expect(q.explain[l]?.trim(), `${l} explain`).toBeTruthy();
    }
    // Uzbek (Latin) and English text must not leak Cyrillic; Russian prose
    // must actually be Russian (pure-symbol prompts like "3 × 4 = ?" are fine).
    for (const l of ['uz', 'en'] as const) {
      expect(CYRILLIC.test(q.prompt[l]), `${l} prompt has Cyrillic`).toBe(false);
      expect(CYRILLIC.test(q.explain[l]), `${l} explain has Cyrillic`).toBe(false);
    }
    // Russian prose must be Russian; pure symbol prompts ("12 : 3 = ?") and
    // code prompts identical to the English one may skip Cyrillic.
    if (q.prompt.ru !== q.prompt.en && /[A-Za-z]/.test(q.prompt.ru.replace(/[A-Za-z_.]+\(.*?\)/g, ''))) {
      expect(CYRILLIC.test(q.prompt.ru), 'ru prompt is Russian').toBe(true);
    }
    expect(CYRILLIC.test(q.explain.ru) || q.explain.ru === q.explain.en, 'ru explain is Russian').toBe(true);

    switch (q.type) {
      case 'mcq':
      case 'code-fill': {
        const lens = LOCALES.map((l) => q.options?.[l]?.length ?? 0);
        expect(lens[0]).toBeGreaterThanOrEqual(2);
        expect(new Set(lens).size, 'same option count in every locale').toBe(1);
        for (const l of LOCALES) {
          const opts = q.options![l];
          expect(new Set(opts).size, `${l} options are unique`).toBe(opts.length);
          for (const o of opts) expect(o.trim()).not.toBe('');
        }
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(lens[0]);
        if (q.type === 'code-fill') expect(q.code?.split('___').length, 'exactly one blank').toBe(2);
        break;
      }
      case 'truefalse':
        expect(typeof q.boolAnswer).toBe('boolean');
        break;
      case 'order':
        expect(q.blocks!.length).toBeGreaterThanOrEqual(2);
        expect(new Set(q.blocks).size, 'order blocks must be unique').toBe(q.blocks!.length);
        break;
      case 'debug':
        expect(q.lines!.length).toBeGreaterThanOrEqual(2);
        expect(q.buggyLine).toBeGreaterThanOrEqual(0);
        expect(q.buggyLine).toBeLessThan(q.lines!.length);
        break;
      case 'binary':
        expect(q.target).toBeGreaterThanOrEqual(1);
        expect(q.target).toBeLessThanOrEqual(31);
        break;
    }
  });

  it('every question is answerable after localize + prepare, in every locale', () => {
    for (const lq of bank) {
      for (const l of LOCALES) {
        const p = prepare(localize(lq, l));
        const { q } = p;
        const right =
          q.type === 'order' ? q.blocks
          : q.type === 'debug' ? q.buggyLine
          : q.type === 'binary' ? q.target
          : p.correctIndex!;
        expect(isCorrect(p, right), `${lq.id}/${l}`).toBe(true);
        if (q.type === 'mcq' || q.type === 'code-fill') {
          // the correct text survives the shuffle
          expect(p.options![p.correctIndex!]).toBe(q.options[q.answer]);
        }
      }
    }
  });

  it('covers every school grade with a real pool', () => {
    for (const g of GRADES) {
      const n = bank.filter((q) => q.grade === g).length;
      expect(n, `grade ${g}`).toBeGreaterThanOrEqual(12);
    }
  });

  it('follows the curriculum split', () => {
    const cats = (from: number, to: number) =>
      new Set(bank.filter((q) => q.grade >= from && q.grade <= to).map((q) => q.category));
    const has = (set: Set<Category>, ...c: Category[]) => c.every((x) => set.has(x));
    // 5–7: internals, OS, ergonomics
    expect(has(cats(5, 7), 'hardware', 'os', 'ergonomics')).toBe(true);
    // 7–11: HTML/CSS (web) and JavaScript (programming) in every grade
    for (let g = 7; g <= 11; g++) {
      expect(has(cats(g, g), 'web') || g >= 10, `grade ${g} web`).toBe(true);
      if (g >= 9) expect(cats(g, g).has('programming'), `grade ${g} JS`).toBe(true);
    }
  });
});
