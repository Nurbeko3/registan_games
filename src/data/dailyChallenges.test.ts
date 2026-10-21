import { describe, expect, it } from 'vitest';
import { DAILY_POOL, dailyChallengeById, dailyChallengeFor, isGameReachable, isLevelReachable, dailyChallengeHref, dailyChallengeTitleKey, hashDay, msUntilNextChallenge, satisfiesDaily } from './dailyChallenges';
import { getGame } from './games';
import { getLevel } from './codecaster/levels';

describe('daily challenge pool', () => {
  it('has unique ids and every target resolves to real content', () => {
    const ids = new Set(DAILY_POOL.map((c) => c.id));
    expect(ids.size).toBe(DAILY_POOL.length);
    for (const c of DAILY_POOL) {
      if (c.kind === 'game') expect(getGame(c.slug), c.id).toBeDefined();
      else expect(getLevel(c.levelId), c.id).toBeDefined();
      expect(c.bonusXp).toBeGreaterThan(0);
      expect(c.bonusCoins).toBeGreaterThan(0);
    }
    expect(DAILY_POOL.length).toBeGreaterThanOrEqual(30);
  });

  it('is deterministic per day and varies across days', () => {
    expect(dailyChallengeFor('2026-10-21')).toEqual(dailyChallengeFor('2026-10-21'));
    const week = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
    const distinct = new Set(week.map((d) => dailyChallengeFor(d).id));
    expect(distinct.size).toBeGreaterThan(3);
    expect(hashDay('a')).not.toBe(hashDay('b'));
  });

  it('satisfiesDaily matches kind, target and star threshold', () => {
    const game = DAILY_POOL.find((c) => c.kind === 'game' && c.stars === 2)!;
    if (game.kind !== 'game') throw new Error();
    expect(satisfiesDaily(game, { kind: 'game', slug: game.slug, stars: 2 })).toBe(true);
    expect(satisfiesDaily(game, { kind: 'game', slug: game.slug, stars: 3 })).toBe(true);
    expect(satisfiesDaily(game, { kind: 'game', slug: game.slug, stars: 1 })).toBe(false);
    expect(satisfiesDaily(game, { kind: 'game', slug: 'other', stars: 3 })).toBe(false);
    expect(satisfiesDaily(game, { kind: 'quest', levelId: 'L01', stars: 3 })).toBe(false);
    const quest = DAILY_POOL.find((c) => c.kind === 'quest')!;
    if (quest.kind !== 'quest') throw new Error();
    expect(satisfiesDaily(quest, { kind: 'quest', levelId: quest.levelId, stars: 3 })).toBe(true);
  });

  it('builds hrefs and title keys', () => {
    const game = DAILY_POOL.find((c) => c.kind === 'game')!;
    const quest = DAILY_POOL.find((c) => c.kind === 'quest')!;
    expect(dailyChallengeHref(game)).toMatch(/^\/play\//);
    expect(dailyChallengeHref(quest)).toMatch(/^\/quest\/L/);
    expect(dailyChallengeTitleKey(game)).toMatch(/^game\./);
    expect(dailyChallengeTitleKey(quest)).toMatch(/^cc\.level\./);
  });

  it('restricts the pick to reachable content for a beginner', () => {
    const beginner = { totalStars: 0, codecaster: {} };
    for (let d = 1; d <= 28; d += 1) {
      const c = dailyChallengeFor(`2026-11-${String(d).padStart(2, '0')}`, beginner);
      if (c.kind === 'game') expect(isGameReachable(c.slug, beginner), c.id).toBe(true);
      else expect(c.levelId).toBe('L01');
    }
    expect(isLevelReachable('L02', beginner)).toBe(false);
    expect(isLevelReachable('L02', { totalStars: 0, codecaster: { L01: { stars: 1 } } })).toBe(true);
    expect(dailyChallengeById(DAILY_POOL[0]!.id)).toEqual(DAILY_POOL[0]);
  });

  it('counts down to the next UTC day', () => {
    const at = new Date(Date.UTC(2026, 9, 21, 23, 30, 0));
    expect(msUntilNextChallenge(at)).toBe(30 * 60 * 1000);
  });
});
