import { describe, expect, it } from 'vitest';
import { isCorrect, prepare, TF_FALSE, TF_TRUE } from './questionEngine';
import type { ArenaQuestion } from './types';

const base = { id: 'q', category: 'logic', difficulty: 'easy', emoji: '🧠', prompt: 'p', explain: 'e' } as const;

describe('prepare', () => {
  it('truefalse uses locale-neutral tokens and points correctIndex at the answer', () => {
    for (const answer of [true, false]) {
      const q: ArenaQuestion = { ...base, type: 'truefalse', answer };
      for (let i = 0; i < 20; i++) {
        const p = prepare(q);
        expect([...(p.options ?? [])].sort()).toEqual([TF_FALSE, TF_TRUE].sort());
        expect(p.options?.[p.correctIndex!]).toBe(answer ? TF_TRUE : TF_FALSE);
        expect(isCorrect(p, p.correctIndex!)).toBe(true);
        expect(isCorrect(p, 1 - p.correctIndex!)).toBe(false);
      }
    }
  });

  it('mcq keeps the correct option reachable after shuffling', () => {
    const q: ArenaQuestion = { ...base, type: 'mcq', options: ['a', 'b', 'c', 'd'], answer: 2 };
    for (let i = 0; i < 20; i++) {
      const p = prepare(q);
      expect(p.options?.[p.correctIndex!]).toBe('c');
    }
  });
});
