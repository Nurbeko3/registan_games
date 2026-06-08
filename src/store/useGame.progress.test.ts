/**
 * Progress-earning gate tests — completeGame / codecasterComplete /
 * arenaAnswerCorrect / arenaMatchEnd / claimDaily / resetToGuest
 *
 * Truth table under test (for an otherwise-valid earn action):
 *
 *   cloud enabled | kcq.session present | earns reward & mutates progress?
 *   no            | no                  | YES  (offline-first)
 *   no            | yes                 | YES
 *   yes           | no                  | NO   (guest — full no-op, zero result)
 *   yes           | yes                 | YES
 *
 * Mirrors the mocking pattern from useGame.shop.test.ts: mock isCloudEnabled
 * at module level, stub window/localStorage, then drive the store directly.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Mock isCloudEnabled BEFORE any import that transitively touches the store
// ---------------------------------------------------------------------------
let cloudEnabled = false;

vi.mock('@/lib/supabase/client', () => ({
  supabase: null,
  isCloudEnabled: () => cloudEnabled,
}));

// ---------------------------------------------------------------------------
// 2. Provide window + localStorage in the node environment
// ---------------------------------------------------------------------------
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
  // account.ts emitSessionChange() calls window.dispatchEvent(new Event(...)) —
  // provide harmless stubs so accountLogout() can run in the node test env.
  const g = globalThis as unknown as { dispatchEvent?: (...a: unknown[]) => boolean; Event?: unknown };
  if (typeof g.dispatchEvent !== 'function') g.dispatchEvent = () => true;
  if (typeof g.Event !== 'function') g.Event = class { constructor(public type: string) {} };
});

// ---------------------------------------------------------------------------
// 3. Import the store AFTER stubs are in place
// ---------------------------------------------------------------------------
import { useGame } from './useGame';
import { accountLogout } from '@/lib/supabase/account';

// ---------------------------------------------------------------------------
// 4. Helpers
// ---------------------------------------------------------------------------
function setSession() {
  localStorageMock.setItem('kcq.session', JSON.stringify({ token: 'abc', username: 'student1' }));
}
function clearSession() {
  localStorageMock.removeItem('kcq.session');
}

beforeEach(() => {
  useGame.getState().resetProgress();
  localStorageMock.clear();
  cloudEnabled = false;
});

// ---------------------------------------------------------------------------
// 5. completeGame
// ---------------------------------------------------------------------------
describe('completeGame — earning gate', () => {
  it('PROG-CG-01: cloud ENABLED, no session → zero reward, no mutation', () => {
    cloudEnabled = true;
    clearSession();
    const before = useGame.getState();

    const result = useGame.getState().completeGame('typing-tap', 3);

    expect(result).toEqual({
      xpAwarded: 0,
      coinsAwarded: 0,
      stars: 3,
      bestStars: 0,
      improved: false,
      leveledUp: false,
      newLevel: 1,
      newAchievements: [],
    });
    const after = useGame.getState();
    expect(after.xp).toBe(before.xp);
    expect(after.coins).toBe(before.coins);
    expect(after.completed).toEqual(before.completed);
    expect(after.streak).toBe(before.streak);
    expect(after.unlockedAchievements).toEqual(before.unlockedAchievements);
    expect(after.celebrations).toEqual(before.celebrations);
  });

  it('PROG-CG-02: cloud ENABLED, session present → awards normally', () => {
    cloudEnabled = true;
    setSession();

    const result = useGame.getState().completeGame('typing-tap', 3);

    expect(result.xpAwarded).toBeGreaterThan(0);
    expect(result.coinsAwarded).toBeGreaterThan(0);
    const s = useGame.getState();
    expect(s.xp).toBeGreaterThan(0);
    expect(s.coins).toBeGreaterThan(0);
    expect(s.completed['typing-tap']).toBeDefined();
  });

  it('PROG-CG-03: cloud DISABLED → awards normally regardless of session (offline-first)', () => {
    cloudEnabled = false;
    clearSession();

    const result = useGame.getState().completeGame('typing-tap', 3);

    expect(result.xpAwarded).toBeGreaterThan(0);
    expect(result.coinsAwarded).toBeGreaterThan(0);
    expect(useGame.getState().completed['typing-tap']).toBeDefined();
  });

  it('PROG-CG-04: locked guest result reflects existing best stars, not a fresh zero', () => {
    // First earn legitimately while logged in...
    cloudEnabled = true;
    setSession();
    useGame.getState().completeGame('typing-tap', 2);
    expect(useGame.getState().completed['typing-tap'].stars).toBe(2);

    // ...then log out (simulated by clearing session) and try again as guest.
    clearSession();
    const result = useGame.getState().completeGame('typing-tap', 3);

    expect(result.xpAwarded).toBe(0);
    expect(result.coinsAwarded).toBe(0);
    expect(result.bestStars).toBe(2); // existing best, untouched
    expect(useGame.getState().completed['typing-tap'].stars).toBe(2); // not bumped to 3
  });
});

// ---------------------------------------------------------------------------
// 6. codecasterComplete
// ---------------------------------------------------------------------------
describe('codecasterComplete — earning gate', () => {
  it('PROG-CC-01: cloud ENABLED, no session → zero reward, no mutation', () => {
    cloudEnabled = true;
    clearSession();
    const before = useGame.getState();

    const result = useGame.getState().codecasterComplete('L01', 3);

    expect(result).toEqual({
      xpAwarded: 0,
      coinsAwarded: 0,
      stars: 3,
      bestStars: 0,
      improved: false,
      leveledUp: false,
      newLevel: 1,
      newAchievements: [],
    });
    const after = useGame.getState();
    expect(after.xp).toBe(before.xp);
    expect(after.coins).toBe(before.coins);
    expect(after.codecaster).toEqual(before.codecaster);
  });

  it('PROG-CC-02: cloud ENABLED, session present → awards normally', () => {
    cloudEnabled = true;
    setSession();

    const result = useGame.getState().codecasterComplete('L01', 3);

    expect(result.xpAwarded).toBeGreaterThan(0);
    expect(result.coinsAwarded).toBeGreaterThan(0);
    expect(useGame.getState().codecaster['L01']).toEqual({ stars: 3 });
  });

  it('PROG-CC-03: cloud DISABLED → awards normally (offline-first)', () => {
    cloudEnabled = false;
    clearSession();

    const result = useGame.getState().codecasterComplete('L01', 3);

    expect(result.xpAwarded).toBeGreaterThan(0);
    expect(useGame.getState().codecaster['L01']).toEqual({ stars: 3 });
  });
});

// ---------------------------------------------------------------------------
// 7. arenaAnswerCorrect
// ---------------------------------------------------------------------------
describe('arenaAnswerCorrect — earning gate', () => {
  it('PROG-AA-01: cloud ENABLED, no session → zero reward, no mutation', () => {
    cloudEnabled = true;
    clearSession();
    const before = useGame.getState();

    const result = useGame.getState().arenaAnswerCorrect('medium');

    expect(result).toEqual({ xp: 0, coins: 0 });
    const after = useGame.getState();
    expect(after.xp).toBe(before.xp);
    expect(after.coins).toBe(before.coins);
    expect(after.arenaCorrect).toBe(before.arenaCorrect);
  });

  it('PROG-AA-02: cloud ENABLED, session present → awards normally', () => {
    cloudEnabled = true;
    setSession();

    const result = useGame.getState().arenaAnswerCorrect('medium');

    expect(result).toEqual({ xp: 14, coins: 7 });
    expect(useGame.getState().arenaCorrect).toBe(1);
  });

  it('PROG-AA-03: cloud DISABLED → awards normally (offline-first)', () => {
    cloudEnabled = false;
    clearSession();

    const result = useGame.getState().arenaAnswerCorrect('easy');

    expect(result).toEqual({ xp: 8, coins: 4 });
    expect(useGame.getState().arenaCorrect).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 8. arenaMatchEnd
// ---------------------------------------------------------------------------
describe('arenaMatchEnd — earning gate', () => {
  it('PROG-AM-01: cloud ENABLED, no session → zero bonus, no mutation', () => {
    cloudEnabled = true;
    clearSession();
    const before = useGame.getState();

    const result = useGame.getState().arenaMatchEnd({ won: true, correct: 5, elims: 3 });

    expect(result).toEqual({ bonusXp: 0, bonusCoins: 0, newAchievements: [] });
    const after = useGame.getState();
    expect(after.xp).toBe(before.xp);
    expect(after.coins).toBe(before.coins);
    expect(after.arenaMatches).toBe(before.arenaMatches);
    expect(after.arenaWins).toBe(before.arenaWins);
    expect(after.arenaBestElims).toBe(before.arenaBestElims);
  });

  it('PROG-AM-02: cloud ENABLED, session present → awards normally', () => {
    cloudEnabled = true;
    setSession();

    const result = useGame.getState().arenaMatchEnd({ won: true, correct: 5, elims: 3 });

    expect(result.bonusXp).toBeGreaterThan(0);
    expect(result.bonusCoins).toBeGreaterThan(0);
    const s = useGame.getState();
    expect(s.arenaMatches).toBe(1);
    expect(s.arenaWins).toBe(1);
    expect(s.arenaBestElims).toBe(3);
  });

  it('PROG-AM-03: cloud DISABLED → awards normally (offline-first)', () => {
    cloudEnabled = false;
    clearSession();

    const result = useGame.getState().arenaMatchEnd({ won: false, correct: 2, elims: 1 });

    expect(result.bonusXp).toBe(0); // no win bonus, but match still recorded
    const s = useGame.getState();
    expect(s.arenaMatches).toBe(1);
    expect(s.arenaBestElims).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 9. claimDaily
// ---------------------------------------------------------------------------
describe('claimDaily — earning gate', () => {
  it('PROG-CD-01: cloud ENABLED, no session → returns null, no mutation', () => {
    cloudEnabled = true;
    clearSession();
    const before = useGame.getState();

    const result = useGame.getState().claimDaily();

    expect(result).toBeNull();
    const after = useGame.getState();
    expect(after.xp).toBe(before.xp);
    expect(after.coins).toBe(before.coins);
    expect(after.lastDailyClaim).toBe(before.lastDailyClaim);
  });

  it('PROG-CD-02: cloud ENABLED, session present → claims normally', () => {
    cloudEnabled = true;
    setSession();

    const result = useGame.getState().claimDaily();

    expect(result).toEqual({ coins: 25, xp: 20 });
    expect(useGame.getState().coins).toBe(25);
  });

  it('PROG-CD-03: cloud DISABLED → claims normally (offline-first)', () => {
    cloudEnabled = false;
    clearSession();

    const result = useGame.getState().claimDaily();

    expect(result).toEqual({ coins: 25, xp: 20 });
    expect(useGame.getState().coins).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// 10. resetToGuest
// ---------------------------------------------------------------------------
describe('resetToGuest — preserves device prefs, zeroes progress', () => {
  it('PROG-RG-01: zeroes progress fields but keeps locale & settings', () => {
    cloudEnabled = false;
    // Build up some progress + change device prefs
    useGame.setState({
      xp: 500,
      coins: 200,
      gems: 10,
      streak: 7,
      completed: { 'typing-tap': { stars: 3, plays: 2 } },
      unlockedAchievements: ['FIRST_GAME'],
      avatarId: 'robot',
      themeId: 'sunset',
      playerName: 'Alice',
      arenaMatches: 4,
      codecaster: { L01: { stars: 3 } },
      locale: 'en',
      settings: { sound: false, reducedMotion: true },
    });

    useGame.getState().resetToGuest();

    const s = useGame.getState();
    // progress reset to baseline
    expect(s.xp).toBe(0);
    expect(s.coins).toBe(0);
    expect(s.gems).toBe(0);
    expect(s.streak).toBe(0);
    expect(s.completed).toEqual({});
    expect(s.unlockedAchievements).toEqual([]);
    expect(s.avatarId).toBe('kid');
    expect(s.themeId).toBe('cloud');
    expect(s.playerName).toBe('');
    expect(s.arenaMatches).toBe(0);
    expect(s.codecaster).toEqual({});
    // device prefs preserved
    expect(s.locale).toBe('en');
    expect(s.settings).toEqual({ sound: false, reducedMotion: true });
    // transient state sane
    expect(s.hydrated).toBe(true);
    expect(s.celebrations).toEqual([]);
  });

  it('PROG-RG-02 (regression guard): accountLogout() zeroes progress + clears the session but ' +
     'PRESERVES device prefs (locale / sound / reduced-motion). Pins the fix for the former ' +
     'AccountCard.onLogout & SettingsPanel.onReset double-reset bug, where a redundant ' +
     'resetProgress() after accountLogout() stomped the just-preserved language/accessibility ' +
     'settings on every logout/erase.', () => {
    cloudEnabled = true;
    setSession();
    useGame.setState({
      xp: 500, coins: 200,
      completed: { 'typing-tap': { stars: 3, plays: 1 } },
      locale: 'en',
      settings: { sound: false, reducedMotion: true },
    });

    // The real logout/erase path: a single accountLogout() — no follow-up resetProgress().
    accountLogout();

    const s = useGame.getState();
    // session cleared (shared-device isolation)
    expect(localStorageMock.getItem('kcq.session')).toBeNull();
    // progress zeroed so the next student never inherits a balance
    expect(s.xp).toBe(0);
    expect(s.coins).toBe(0);
    expect(s.completed).toEqual({});
    // device prefs SURVIVE logout — the fix
    expect(s.locale).toBe('en');
    expect(s.settings).toEqual({ sound: false, reducedMotion: true });
  });
});
