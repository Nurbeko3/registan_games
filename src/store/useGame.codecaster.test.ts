/**
 * codecasterComplete tests — XP/coin awards, anti-farm, and level-up celebration.
 *
 * Mirrors the shop test's setup: cloud is mocked off, window + an in-memory
 * localStorage are stubbed so the zustand persist store initialises cleanly in
 * node. Store state is reset via resetProgress() before each test.
 *
 * Reward scale (must match the action, derived from completeGame's baseXp=30):
 *   xpFor(s)    = round(30 * (0.5 + 0.25*s))  → 1:23  2:30  3:38
 *   coinsFor(s) = s * 10                       → 1:10  2:20  3:30
 * Anti-farm: only the BEST stars are stored and only the DELTA between old and
 * new best is awarded; equal/lower replays award nothing.
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

import { useGame } from './useGame';

beforeEach(() => {
  useGame.getState().resetProgress();
  localStorageMock.clear();
});

describe('codecasterComplete — rewards & records', () => {
  it('CC-01: first completion awards XP + coins and records stars', () => {
    const r = useGame.getState().codecasterComplete('L01', 2);

    expect(r.xpAwarded).toBe(30);   // xpFor(2)
    expect(r.coinsAwarded).toBe(20); // coinsFor(2)
    expect(r.improved).toBe(true);
    expect(r.bestStars).toBe(2);

    const s = useGame.getState();
    expect(s.xp).toBe(30);
    expect(s.coins).toBe(20);
    expect(s.codecaster['L01']).toEqual({ stars: 2 });
  });
});

describe('codecasterComplete — anti-farm', () => {
  it('CC-02: replaying with EQUAL stars awards nothing', () => {
    useGame.getState().codecasterComplete('L01', 2);
    const xpAfterFirst = useGame.getState().xp;
    const coinsAfterFirst = useGame.getState().coins;

    const r = useGame.getState().codecasterComplete('L01', 2);

    expect(r.xpAwarded).toBe(0);
    expect(r.coinsAwarded).toBe(0);
    expect(r.improved).toBe(false);
    expect(r.bestStars).toBe(2);
    expect(useGame.getState().xp).toBe(xpAfterFirst);
    expect(useGame.getState().coins).toBe(coinsAfterFirst);
  });

  it('CC-03: replaying with LOWER stars awards nothing and keeps best', () => {
    useGame.getState().codecasterComplete('L01', 3);
    const xpAfterFirst = useGame.getState().xp;
    const coinsAfterFirst = useGame.getState().coins;

    const r = useGame.getState().codecasterComplete('L01', 1);

    expect(r.xpAwarded).toBe(0);
    expect(r.coinsAwarded).toBe(0);
    expect(r.improved).toBe(false);
    expect(r.bestStars).toBe(3); // best preserved, never downgraded
    expect(useGame.getState().xp).toBe(xpAfterFirst);
    expect(useGame.getState().coins).toBe(coinsAfterFirst);
    expect(useGame.getState().codecaster['L01']).toEqual({ stars: 3 });
  });

  it('CC-04: replaying with HIGHER stars awards only the improvement delta', () => {
    useGame.getState().codecasterComplete('L01', 1); // xp 23, coins 10
    expect(useGame.getState().xp).toBe(23);
    expect(useGame.getState().coins).toBe(10);

    const r = useGame.getState().codecasterComplete('L01', 3); // best 1 -> 3

    // delta xp = xpFor(3) - xpFor(1) = 38 - 23 = 15
    // delta coins = coinsFor(3) - coinsFor(1) = 30 - 10 = 20
    expect(r.xpAwarded).toBe(15);
    expect(r.coinsAwarded).toBe(20);
    expect(r.improved).toBe(true);
    expect(r.bestStars).toBe(3);
    expect(useGame.getState().xp).toBe(38);
    expect(useGame.getState().coins).toBe(30);
    expect(useGame.getState().codecaster['L01']).toEqual({ stars: 3 });
  });
});

describe('codecasterComplete — celebration pipeline', () => {
  it('CC-05: queues a level-up celebration when crossing an XP threshold', () => {
    // Level 2 needs 100 XP. Sit at 90, then a +23 win (1 star) crosses to 100+.
    useGame.setState({ xp: 90, celebrations: [] });

    const r = useGame.getState().codecasterComplete('L01', 1);

    expect(r.leveledUp).toBe(true);
    expect(r.newLevel).toBe(2);
    const levelUps = useGame.getState().celebrations.filter((c) => 'kind' in c && c.kind === 'level');
    expect(levelUps).toContainEqual({ code: 'LEVEL_UP_2', kind: 'level', level: 2 });
  });

  it('CC-06: no level-up celebration when staying in the same level', () => {
    useGame.setState({ xp: 0, celebrations: [] });

    const r = useGame.getState().codecasterComplete('L01', 1); // xp 0 -> 23, still level 1

    expect(r.leveledUp).toBe(false);
    expect(useGame.getState().celebrations.filter((c) => 'kind' in c && c.kind === 'level')).toHaveLength(0);
  });
});
