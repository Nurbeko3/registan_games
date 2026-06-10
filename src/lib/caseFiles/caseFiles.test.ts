/**
 * Case Files offline logic — bot engine + grading proofs.
 */

import { describe, it, expect } from 'vitest';
import { makeBots, botScoreThrough, questionPoints, ANSWER_WINDOW_MS } from './botEngine';
import { gradeCaseRun, bestStreak } from './grading';
import { getCase } from '@/data/cases';

const c1 = getCase('case01')!; // 4 questions, easiest

describe('botEngine', () => {
  it('is deterministic for a fixed seed', () => {
    const a = makeBots('10-12', 4, 3, 12345);
    const b = makeBots('10-12', 4, 3, 12345);
    expect(a.map((x) => x.plan)).toEqual(b.map((x) => x.plan));
  });

  it('respects the bot count and caps at the profile pool', () => {
    expect(makeBots('7-9', 4, 3).length).toBe(3);
    expect(makeBots('7-9', 4, 99).length).toBeLessThanOrEqual(5);
    expect(makeBots('7-9', 4, 0).length).toBe(0);
  });

  it('every bot has one plan item per question, never faster than 8s', () => {
    for (const bot of makeBots('13-14', c1.questions.length, 4, 7)) {
      expect(bot.plan).toHaveLength(c1.questions.length);
      for (const item of bot.plan) {
        expect(item.timeMs).toBeGreaterThanOrEqual(8_000);
        expect(item.timeMs).toBeLessThanOrEqual(ANSWER_WINDOW_MS);
      }
    }
  });

  it('questionPoints: wrong = 0, correct = 100 + capped speed bonus', () => {
    expect(questionPoints(false, 1000)).toBe(0);
    expect(questionPoints(true, 0)).toBe(130); // max speed
    expect(questionPoints(true, ANSWER_WINDOW_MS)).toBe(100); // no speed
    expect(questionPoints(true, ANSWER_WINDOW_MS * 2)).toBe(100); // clamped, never negative
  });

  it('higher bands trend toward higher accuracy', () => {
    const easy = makeBots('7-9', 4, 3, 1);
    const hard = makeBots('13-14', 4, 3, 1);
    const avg = (b: ReturnType<typeof makeBots>) => b.reduce((s, x) => s + x.accuracy, 0) / b.length;
    expect(avg(hard)).toBeGreaterThan(avg(easy));
  });

  it('botScoreThrough accumulates points up to a question index', () => {
    const [bot] = makeBots('10-12', 4, 1, 42);
    expect(botScoreThrough(bot, 0)).toBe(bot.plan[0].points);
    expect(botScoreThrough(bot, 3)).toBe(bot.plan.reduce((s, i) => s + i.points, 0));
  });
});

describe('gradeCaseRun', () => {
  it('all-correct, no hints → 3 stars', () => {
    const answers = c1.questions.map((q) => q.answerIndex);
    const g = gradeCaseRun(c1, answers, false);
    expect(g.correct).toBe(c1.questions.length);
    expect(g.stars).toBe(3);
    expect(g.perQuestionCorrect.every(Boolean)).toBe(true);
  });

  it('all-correct but hints used → caps at 2 stars (has a cross-ref correct)', () => {
    const answers = c1.questions.map((q) => q.answerIndex);
    expect(gradeCaseRun(c1, answers, true).stars).toBe(2);
  });

  it('unanswered questions count as wrong', () => {
    const answers = c1.questions.map(() => null);
    const g = gradeCaseRun(c1, answers, false);
    expect(g.correct).toBe(0);
    expect(g.stars).toBe(0);
  });

  it('counts only cross-ref questions answered correctly', () => {
    // answer ONLY the cross-ref questions correctly, others wrong
    const answers = c1.questions.map((q) => (q.concept === 'crossRef' ? q.answerIndex : -1));
    const g = gradeCaseRun(c1, answers, false);
    expect(g.crossRefCorrect).toBeGreaterThanOrEqual(1);
  });
});

describe('bestStreak', () => {
  it('finds the longest consecutive-correct run', () => {
    expect(bestStreak([true, true, false, true])).toBe(2);
    expect(bestStreak([true, true, true, true])).toBe(4);
    expect(bestStreak([false, false])).toBe(0);
    expect(bestStreak([])).toBe(0);
  });
});
