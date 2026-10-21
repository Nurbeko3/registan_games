/**
 * Daily challenge — store integration.
 * Completing today's challenge target pays the bonus exactly once per day,
 * bumps the lifetime counter, and surfaces `dailyBonus` on the result.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({ supabase: null, isCloudEnabled: () => false }));

beforeAll(() => {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  (globalThis as unknown as { window: unknown }).window = { localStorage: ls, addEventListener: () => {}, removeEventListener: () => {} };
  (globalThis as unknown as { localStorage: unknown }).localStorage = ls;
});

const { useGame, selectDailyChallenge } = await import('./useGame');
const { dailyChallengeFor } = await import('@/data/dailyChallenges');
const { dayKey } = await import('@/lib/leveling');

beforeEach(() => {
  useGame.getState().resetProgress();
});

describe('daily challenge', () => {
  it('pays the bonus once when the target is met, and flags the result', () => {
    const today = dayKey();
    const before = useGame.getState();
    const c = selectDailyChallenge(before).challenge;
    expect(dailyChallengeFor(today, { totalStars: 0, codecaster: {} })).toEqual(c);
    expect(selectDailyChallenge(before).done).toBe(false);

    const r = c.kind === 'game'
      ? useGame.getState().completeGame(c.slug, 3)
      : useGame.getState().codecasterComplete(c.levelId, 3);

    expect(r.dailyBonus).toEqual({ xp: c.bonusXp, coins: c.bonusCoins });
    const after = useGame.getState();
    expect(after.lastDailyChallengeDone).toBe(today);
    expect(after.dailyChallengesDone).toBe(1);
    expect(selectDailyChallenge(after).done).toBe(true);
    // the recorded challenge stays the same even though completing it changed what is unlocked
    expect(selectDailyChallenge(after).challenge.id).toBe(c.id);
    expect(after.lastDailyChallengeId).toBe(c.id);
    // DAILY_1 achievement unlocks on the first completion (data-driven check)
    expect(after.unlockedAchievements).toContain('DAILY_1');

    // replaying never pays the bonus again
    const r2 = c.kind === 'game'
      ? useGame.getState().completeGame(c.slug, 3)
      : useGame.getState().codecasterComplete(c.levelId, 3);
    expect(r2.dailyBonus).toBeUndefined();
    expect(useGame.getState().dailyChallengesDone).toBe(1);
  });

  it('does not pay for a different target or too few stars', () => {
    const c = selectDailyChallenge(useGame.getState()).challenge;
    const other = c.kind === 'game' ? 'memory-match' : 'L05';
    const target = c.kind === 'game' ? c.slug : c.levelId;
    const otherSlug = other === target ? (c.kind === 'game' ? 'robot-maze' : 'L06') : other;
    const r = c.kind === 'game' ? useGame.getState().completeGame(otherSlug, 3) : useGame.getState().codecasterComplete(otherSlug, 3);
    expect(r.dailyBonus).toBeUndefined();
    if (c.stars > 1) {
      const low = c.kind === 'game' ? useGame.getState().completeGame(c.slug, 1) : useGame.getState().codecasterComplete(c.levelId, 1);
      expect(low.dailyBonus).toBeUndefined();
    }
    expect(useGame.getState().dailyChallengesDone).toBe(0);
  });
});
