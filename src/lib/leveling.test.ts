import { describe, expect, it } from 'vitest';
import { dayKey, levelForXp, levelState, totalXpForLevel } from './leveling';

describe('leveling', () => {
  it('uses the documented quadratic XP curve', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(100);
    expect(totalXpForLevel(3)).toBe(300);
    expect(totalXpForLevel(4)).toBe(600);
  });

  it('maps XP to the current level boundary', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
  });

  it('reports progress within the current level', () => {
    expect(levelState(150)).toEqual({
      level: 2,
      xpIntoLevel: 50,
      xpForNextLevel: 200,
      progressPct: 25,
    });
  });

  it('formats UTC day keys', () => {
    expect(dayKey(new Date('2026-06-07T23:30:00.000Z'))).toBe('2026-06-07');
  });
});
