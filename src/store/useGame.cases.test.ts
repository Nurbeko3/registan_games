/**
 * Case Files store actions — economy, anti-farm, caseXp isolation, and the
 * server-gated classroom-win counter (QA HIGH-02). Mirrors the codecaster test's
 * cloud-off + in-memory-localStorage harness.
 *
 * Locked economy (00-BRIEF §8):
 *   per answer:    15 XP × streak mult (×1.0/×1.2/×1.5), 3 coins flat
 *   case solve:    1★ 40/8 · 2★ 80/16 · 3★ 120/24, anti-farm DELTA into caseXp + global
 *   first of day:  +30 XP / +6 coins, once/day, on a solve
 *   achievement:   +25 XP / +15 coins each (existing platform rule)
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({
  supabase: null,
  isCloudEnabled: () => false,
}));

type StoreLike = Record<string, string | null>;
function makeLocalStorageMock(): Storage & { _store: StoreLike } {
  const _store: StoreLike = {};
  return {
    _store,
    get length() { return Object.keys(_store).length; },
    key(i: number) { return Object.keys(_store)[i] ?? null; },
    getItem(k: string) { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
    setItem(k: string, v: string) { _store[k] = v; },
    removeItem(k: string) { delete _store[k]; },
    clear() { Object.keys(_store).forEach((k) => delete _store[k]); },
  } as Storage & { _store: StoreLike };
}
const localStorageMock = makeLocalStorageMock();

beforeAll(() => {
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('localStorage', localStorageMock);
});

import { useGame, type CaseMatchInput } from './useGame';

const g = () => useGame.getState();

/** A solved bot-practice run (overridable). */
function botRun(over: Partial<CaseMatchInput> = {}): CaseMatchInput {
  return {
    caseId: 'case01', stars: 2, correct: 3, total: 4,
    hintsUsed: false, bestStreak: 2, mode: 'bot', ...over,
  };
}

beforeEach(() => {
  useGame.getState().resetProgress();
  localStorageMock.clear();
});

describe('caseAnswerCorrect — per-answer reward', () => {
  it('CA-01: base reward at streak 1 = 15 XP / 3 coins', () => {
    const r = g().caseAnswerCorrect(1);
    expect(r).toEqual({ xp: 15, coins: 3 });
    expect(g().xp).toBe(15);
    expect(g().coins).toBe(3);
  });

  it('CA-02: streak multiplier lifts XP only, coins stay flat', () => {
    expect(g().caseAnswerCorrect(2)).toEqual({ xp: 18, coins: 3 }); // ×1.2
    expect(g().caseAnswerCorrect(4)).toEqual({ xp: 23, coins: 3 }); // round(×1.5)
  });
});

describe('caseMatchEnd — first solve records + bonuses', () => {
  it('CM-01: first 2★ solve awards solve bonus + first-of-day + unlocks case achievements', () => {
    const r = g().caseMatchEnd(botRun());

    expect(r.bestStars).toBe(2);
    expect(r.improved).toBe(true);
    expect(r.firstOfDay).toBe(true);
    expect(r.caseXpAwarded).toBe(80); // solve XP for 2★, delta from 0

    const s = g();
    expect(s.cases['case01']).toEqual({ stars: 2 });
    expect(s.caseXp).toBe(80);
    expect(s.caseNoHintSolves).toBe(1);
    expect(s.caseStreak).toBe(2);
    expect(s.lastCaseDay).not.toBeNull();

    const codes = r.newAchievements.map((a) => a.code);
    expect(codes).toContain('CASE_FIRST_SOLVE');
    expect(codes).toContain('CASE_NO_HINTS');
    expect(r.newAchievements).toHaveLength(2);

    // global pools: solve 80 + day 30 + 2 achievements ×25 = 160 XP
    expect(s.xp).toBe(160);
    expect(s.coins).toBe(52); // 16 + 6 + 2×15
  });

  it('CM-02: a hinted solve does not count as a no-hint solve', () => {
    const r = g().caseMatchEnd(botRun({ hintsUsed: true }));
    expect(g().caseNoHintSolves).toBe(0);
    expect(r.newAchievements.map((a) => a.code)).not.toContain('CASE_NO_HINTS');
  });
});

describe('caseMatchEnd — anti-farm delta (caseXp + best stars)', () => {
  it('CM-03: replaying with EQUAL stars awards no caseXp and keeps best', () => {
    g().caseMatchEnd(botRun({ stars: 2 }));
    const xpAfter = g().caseXp;
    const r = g().caseMatchEnd(botRun({ stars: 2 }));
    expect(r.caseXpAwarded).toBe(0);
    expect(r.improved).toBe(false);
    expect(r.bestStars).toBe(2);
    expect(g().caseXp).toBe(xpAfter);
  });

  it('CM-04: replaying with LOWER stars awards nothing and never downgrades', () => {
    g().caseMatchEnd(botRun({ stars: 3, hintsUsed: false, correct: 4, total: 4 }));
    const xpAfter = g().caseXp;
    const r = g().caseMatchEnd(botRun({ stars: 1 }));
    expect(r.caseXpAwarded).toBe(0);
    expect(r.bestStars).toBe(3);
    expect(g().cases['case01']).toEqual({ stars: 3 });
    expect(g().caseXp).toBe(xpAfter);
  });

  it('CM-05: improving stars awards only the caseXp delta', () => {
    g().caseMatchEnd(botRun({ stars: 1 })); // caseXp 40
    expect(g().caseXp).toBe(40);
    const r = g().caseMatchEnd(botRun({ stars: 3, correct: 4, total: 4 }));
    expect(r.caseXpAwarded).toBe(80); // 120 - 40
    expect(g().caseXp).toBe(120);
    expect(g().cases['case01']).toEqual({ stars: 3 });
  });
});

describe('caseMatchEnd — first-case-of-day', () => {
  it('CM-06: only the first solve of the day pays the daily bonus', () => {
    const r1 = g().caseMatchEnd(botRun({ caseId: 'case01' }));
    expect(r1.firstOfDay).toBe(true);
    const r2 = g().caseMatchEnd(botRun({ caseId: 'case02' }));
    expect(r2.firstOfDay).toBe(false);
  });

  it('CM-07: an unsolved run (0★) never triggers the daily bonus', () => {
    const r = g().caseMatchEnd(botRun({ stars: 0, correct: 1, total: 4 }));
    expect(r.firstOfDay).toBe(false);
    expect(g().caseXp).toBe(0);
    expect(g().lastCaseDay).toBeNull();
  });
});

describe('caseXp isolation — other modes cannot inflate Detective rank', () => {
  it('CM-08: codecaster + arena progress leave caseXp at 0', () => {
    g().codecasterComplete('L01', 3);
    g().arenaAnswerCorrect('hard');
    g().arenaMatchEnd({ won: true, correct: 3, elims: 2 });
    expect(g().caseXp).toBe(0);
    // and a real case solve moves it
    g().caseMatchEnd(botRun({ stars: 1 }));
    expect(g().caseXp).toBe(40);
  });
});

describe('classroom-win counter — server-gated (QA HIGH-02)', () => {
  it('CM-09: Bot Practice cannot self-grant a classroom win even with placement 1', () => {
    g().caseMatchEnd(botRun({ mode: 'bot', placement: 1, isClassroomConfirmed: true }));
    expect(g().classroomCaseTournamentWins).toBe(0);
  });

  it('CM-10: classroom mode without server confirmation does not count', () => {
    g().caseMatchEnd(botRun({ mode: 'classroom', placement: 1, isClassroomConfirmed: false }));
    expect(g().classroomCaseTournamentWins).toBe(0);
  });

  it('CM-11: confirmed classroom but not 1st place does not count', () => {
    g().caseMatchEnd(botRun({ mode: 'classroom', placement: 2, isClassroomConfirmed: true }));
    expect(g().classroomCaseTournamentWins).toBe(0);
  });

  it('CM-12: confirmed classroom + 1st place counts and unlocks the achievement', () => {
    const r = g().caseMatchEnd(botRun({ mode: 'classroom', placement: 1, isClassroomConfirmed: true }));
    expect(g().classroomCaseTournamentWins).toBe(1);
    expect(r.newAchievements.map((a) => a.code)).toContain('CASE_CLASSROOM_WIN');
  });
});

describe('caseStreak — high-water mark', () => {
  it('CM-13: best in-match streak is kept and a lower later run does not lower it', () => {
    const r = g().caseMatchEnd(botRun({ bestStreak: 4 }));
    expect(g().caseStreak).toBe(4);
    expect(r.newAchievements.map((a) => a.code)).toContain('CASE_STREAK_3');
    g().caseMatchEnd(botRun({ caseId: 'case02', bestStreak: 1 }));
    expect(g().caseStreak).toBe(4);
  });
});

describe('progressLocked — classroom guest no-op handled by store (cloud off here)', () => {
  it('CM-14: with cloud disabled, offline play always settles (no lock)', () => {
    const r = g().caseMatchEnd(botRun({ stars: 1 }));
    expect(r.caseXpAwarded).toBe(40);
    expect(g().caseXp).toBe(40);
  });
});
