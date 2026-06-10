/**
 * Case Files scoring + ranking math — pure-function proofs.
 * Numbers are locked in docs/find-info-about-me/00-BRIEF.md §8.
 */

import { describe, it, expect } from 'vitest';
import {
  CASE_ANSWER_XP,
  CASE_ANSWER_COINS,
  caseStreakMultiplier,
  caseAnswerXp,
  caseSolveXp,
  caseSolveCoins,
  caseStarsFor,
  rankForCaseXp,
  nextRankForCaseXp,
} from './caseLeveling';
import { DETECTIVE_RANKS } from '@/data/cases/ranks';

describe('per-answer reward', () => {
  it('base values match the locked economy', () => {
    expect(CASE_ANSWER_XP).toBe(15);
    expect(CASE_ANSWER_COINS).toBe(3);
  });

  it('streak multiplier tiers: ×1.0 (0-1) · ×1.2 (2-3) · ×1.5 (4+)', () => {
    expect(caseStreakMultiplier(0)).toBe(1.0);
    expect(caseStreakMultiplier(1)).toBe(1.0);
    expect(caseStreakMultiplier(2)).toBe(1.2);
    expect(caseStreakMultiplier(3)).toBe(1.2);
    expect(caseStreakMultiplier(4)).toBe(1.5);
    expect(caseStreakMultiplier(99)).toBe(1.5);
  });

  it('caseAnswerXp applies the multiplier and rounds', () => {
    expect(caseAnswerXp(1)).toBe(15); // 15 × 1.0
    expect(caseAnswerXp(2)).toBe(18); // 15 × 1.2
    expect(caseAnswerXp(4)).toBe(23); // round(15 × 1.5 = 22.5)
  });
});

describe('case-solve reward (star-gated)', () => {
  it('XP table: 0/40/80/120', () => {
    expect(caseSolveXp(0)).toBe(0);
    expect(caseSolveXp(1)).toBe(40);
    expect(caseSolveXp(2)).toBe(80);
    expect(caseSolveXp(3)).toBe(120);
  });
  it('coin table: 0/8/16/24', () => {
    expect(caseSolveCoins(0)).toBe(0);
    expect(caseSolveCoins(1)).toBe(8);
    expect(caseSolveCoins(2)).toBe(16);
    expect(caseSolveCoins(3)).toBe(24);
  });
  it('clamps out-of-range stars', () => {
    expect(caseSolveXp(5)).toBe(120);
    expect(caseSolveXp(-1)).toBe(0);
  });
});

describe('caseStarsFor — star rubric', () => {
  it('3★ requires 100% correct AND no hints', () => {
    expect(caseStarsFor({ correct: 4, total: 4, crossRefCorrect: 1, hintsUsed: false })).toBe(3);
  });
  it('100% correct but hints used drops to 2★ (still has a cross-ref correct)', () => {
    expect(caseStarsFor({ correct: 4, total: 4, crossRefCorrect: 1, hintsUsed: true })).toBe(2);
  });
  it('2★ requires ≥80% AND ≥1 cross-ref correct', () => {
    expect(caseStarsFor({ correct: 4, total: 5, crossRefCorrect: 1, hintsUsed: false })).toBe(2); // 80%
    // ≥80% but no cross-ref correct → only 1★
    expect(caseStarsFor({ correct: 4, total: 5, crossRefCorrect: 0, hintsUsed: false })).toBe(1);
  });
  it('1★ requires ≥50%', () => {
    expect(caseStarsFor({ correct: 2, total: 4, crossRefCorrect: 0, hintsUsed: false })).toBe(1);
  });
  it('below 50% is 0★ (case unsolved)', () => {
    expect(caseStarsFor({ correct: 1, total: 4, crossRefCorrect: 0, hintsUsed: false })).toBe(0);
  });
  it('empty case is 0★ (no divide-by-zero)', () => {
    expect(caseStarsFor({ correct: 0, total: 0, crossRefCorrect: 0, hintsUsed: false })).toBe(0);
  });
});

describe('Detective ranks — derived purely from caseXp', () => {
  it('starts at Cadet with 0 caseXp', () => {
    expect(rankForCaseXp(0).id).toBe('cadet');
  });

  it('returns the highest rank whose threshold is reached', () => {
    expect(rankForCaseXp(149).id).toBe('cadet');
    expect(rankForCaseXp(150).id).toBe('rookie');
    expect(rankForCaseXp(799).id).toBe('junior');
    expect(rankForCaseXp(800).id).toBe('sergeant');
    expect(rankForCaseXp(999_999).id).toBe('master');
  });

  it('rank thresholds are strictly increasing', () => {
    for (let i = 1; i < DETECTIVE_RANKS.length; i++) {
      expect(DETECTIVE_RANKS[i].minCaseXp).toBeGreaterThan(DETECTIVE_RANKS[i - 1].minCaseXp);
    }
  });

  it('nextRankForCaseXp points at the upcoming rank, null at the top', () => {
    expect(nextRankForCaseXp(0)?.id).toBe('rookie');
    expect(nextRankForCaseXp(150)?.id).toBe('junior');
    expect(nextRankForCaseXp(9000)).toBeNull();
  });
});
