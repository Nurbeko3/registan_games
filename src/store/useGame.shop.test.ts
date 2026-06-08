/**
 * Shop purchase gate tests — buyAvatar / buyTheme
 *
 * Truth table under test (for an otherwise-valid purchase):
 *
 *   cloud enabled | kcq.session present | buy succeeds?
 *   no            | no                  | YES  (offline-first)
 *   no            | yes                 | YES
 *   yes           | no                  | NO   (must log in)
 *   yes           | yes                 | YES
 *
 * Design notes:
 * - isCloudEnabled() is module-level in @/lib/supabase/client so we vi.mock the
 *   whole module and control the return value per-test via a shared flag.
 * - hasStudentSession() checks `typeof window === 'undefined'` first; the test
 *   environment is node (no jsdom installed), so we vi.stubGlobal('window', ...) to
 *   make that guard pass, then provide an in-memory localStorage.
 * - The store (Zustand persist) also tries window.localStorage on init — our stub
 *   satisfies that call too so the store initialises cleanly.
 * - Store state is reset via resetProgress() before every test so cases don't leak.
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
//    hasStudentSession() guards on `typeof window === 'undefined'`, so we need
//    window to be defined; zustand persist also calls window.localStorage.
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
  // Make window defined so typeof window !== 'undefined' inside hasStudentSession
  vi.stubGlobal('window', globalThis);
  // Attach our mock storage to both window and global
  vi.stubGlobal('localStorage', localStorageMock);
});

// ---------------------------------------------------------------------------
// 3. Import the store AFTER stubs are in place
// ---------------------------------------------------------------------------
import { useGame } from './useGame';

// ---------------------------------------------------------------------------
// 4. Helpers
// ---------------------------------------------------------------------------

/** Put enough coins in the store for any purchase */
function giveCoins(amount: number) {
  useGame.setState({ coins: amount });
}

/** Write a valid kcq.session entry to localStorage */
function setSession() {
  localStorageMock.setItem('kcq.session', JSON.stringify({ token: 'abc', userId: 'u1' }));
}

/** Remove the kcq.session entry from localStorage */
function clearSession() {
  localStorageMock.removeItem('kcq.session');
}

beforeEach(() => {
  // Reset store to DEFAULTS (resetProgress does this + sets hydrated:true)
  useGame.getState().resetProgress();
  // Clear the localStorage mock (session + any persisted store data)
  localStorageMock.clear();
  // Default: cloud disabled
  cloudEnabled = false;
});

// ---------------------------------------------------------------------------
// 5. Tests
// ---------------------------------------------------------------------------

describe('buyAvatar — purchase gate', () => {
  it('SHOP-A-01: cloud DISABLED, no session → buy succeeds (offline-first)', () => {
    cloudEnabled = false;
    // 'robot' costs 50 coins and has no level requirement
    giveCoins(500);

    const result = useGame.getState().buyAvatar('robot');

    expect(result).toBe(true);
    const s = useGame.getState();
    expect(s.unlockedAvatars).toContain('robot');
    expect(s.avatarId).toBe('robot');
    expect(s.coins).toBe(450); // 500 - 50
  });

  it('SHOP-A-02: cloud DISABLED, session present → buy succeeds', () => {
    cloudEnabled = false;
    setSession();
    giveCoins(500);

    const result = useGame.getState().buyAvatar('robot');

    expect(result).toBe(true);
    expect(useGame.getState().unlockedAvatars).toContain('robot');
  });

  it('SHOP-A-03: cloud ENABLED, no session → buy blocked', () => {
    cloudEnabled = true;
    clearSession();
    giveCoins(500);

    const result = useGame.getState().buyAvatar('robot');

    expect(result).toBe(false);
    const s = useGame.getState();
    expect(s.unlockedAvatars).not.toContain('robot');
    expect(s.coins).toBe(500); // no coins deducted
  });

  it('SHOP-A-04: cloud ENABLED, session present → buy succeeds', () => {
    cloudEnabled = true;
    setSession();
    giveCoins(500);

    const result = useGame.getState().buyAvatar('robot');

    expect(result).toBe(true);
    const s = useGame.getState();
    expect(s.unlockedAvatars).toContain('robot');
    expect(s.avatarId).toBe('robot');
    expect(s.coins).toBe(450); // 500 - 50
  });

  it('SHOP-A-05: returns false and keeps equip when avatar already owned', () => {
    cloudEnabled = false;
    giveCoins(500);
    useGame.getState().buyAvatar('robot');                  // first buy
    const coinsBefore = useGame.getState().coins;

    const result = useGame.getState().buyAvatar('robot');   // duplicate

    expect(result).toBe(false);
    expect(useGame.getState().coins).toBe(coinsBefore);     // no double-deduction
  });

  it('SHOP-A-06: returns false when coins are insufficient', () => {
    cloudEnabled = false;
    giveCoins(10); // robot costs 50

    const result = useGame.getState().buyAvatar('robot');

    expect(result).toBe(false);
    expect(useGame.getState().unlockedAvatars).not.toContain('robot');
    expect(useGame.getState().coins).toBe(10); // untouched
  });

  it('SHOP-A-07: returns false when avatar level requirement not met', () => {
    cloudEnabled = false;
    // 'wizard' requires level 5; fresh store is level 1
    giveCoins(1000);

    const result = useGame.getState().buyAvatar('wizard');

    expect(result).toBe(false);
    expect(useGame.getState().unlockedAvatars).not.toContain('wizard');
    expect(useGame.getState().coins).toBe(1000); // untouched
  });

  it('SHOP-A-08: cloud ENABLED + no session does NOT equip avatar', () => {
    // Regression: ensure avatarId is also unchanged when gate blocks
    cloudEnabled = true;
    clearSession();
    giveCoins(500);
    const avatarBefore = useGame.getState().avatarId;

    useGame.getState().buyAvatar('robot');

    expect(useGame.getState().avatarId).toBe(avatarBefore);
  });
});

describe('buyTheme — purchase gate', () => {
  it('SHOP-T-01: cloud DISABLED, no session → buy succeeds (offline-first)', () => {
    cloudEnabled = false;
    giveCoins(500);

    const result = useGame.getState().buyTheme('sunset'); // costs 60

    expect(result).toBe(true);
    const s = useGame.getState();
    expect(s.unlockedThemes).toContain('sunset');
    expect(s.themeId).toBe('sunset');
    expect(s.coins).toBe(440); // 500 - 60
  });

  it('SHOP-T-02: cloud DISABLED, session present → buy succeeds', () => {
    cloudEnabled = false;
    setSession();
    giveCoins(500);

    const result = useGame.getState().buyTheme('sunset');

    expect(result).toBe(true);
    expect(useGame.getState().unlockedThemes).toContain('sunset');
  });

  it('SHOP-T-03: cloud ENABLED, no session → buy blocked', () => {
    cloudEnabled = true;
    clearSession();
    giveCoins(500);

    const result = useGame.getState().buyTheme('sunset');

    expect(result).toBe(false);
    const s = useGame.getState();
    expect(s.unlockedThemes).not.toContain('sunset');
    expect(s.coins).toBe(500); // no coins deducted
  });

  it('SHOP-T-04: cloud ENABLED, session present → buy succeeds', () => {
    cloudEnabled = true;
    setSession();
    giveCoins(500);

    const result = useGame.getState().buyTheme('sunset');

    expect(result).toBe(true);
    const s = useGame.getState();
    expect(s.unlockedThemes).toContain('sunset');
    expect(s.themeId).toBe('sunset');
    expect(s.coins).toBe(440); // 500 - 60
  });

  it('SHOP-T-05: returns false and keeps equip when theme already owned', () => {
    cloudEnabled = false;
    giveCoins(500);
    useGame.getState().buyTheme('sunset');                   // first buy
    const coinsBefore = useGame.getState().coins;

    const result = useGame.getState().buyTheme('sunset');    // duplicate

    expect(result).toBe(false);
    expect(useGame.getState().coins).toBe(coinsBefore);      // no double-deduction
  });

  it('SHOP-T-06: returns false when coins are insufficient', () => {
    cloudEnabled = false;
    giveCoins(20); // sunset costs 60

    const result = useGame.getState().buyTheme('sunset');

    expect(result).toBe(false);
    expect(useGame.getState().unlockedThemes).not.toContain('sunset');
    expect(useGame.getState().coins).toBe(20); // untouched
  });

  it('SHOP-T-07: cloud ENABLED + no session does NOT equip theme', () => {
    cloudEnabled = true;
    clearSession();
    giveCoins(500);
    const themeBefore = useGame.getState().themeId;

    useGame.getState().buyTheme('sunset');

    expect(useGame.getState().themeId).toBe(themeBefore);
  });

  it('SHOP-T-08: cloud ENABLED gate is checked before other guards (locked before coins check)', () => {
    // With cloud enabled + no session, return false regardless of coin state
    cloudEnabled = true;
    clearSession();
    giveCoins(0); // also insufficient — gate fires first, same observable result

    const result = useGame.getState().buyTheme('galaxy'); // costs 150

    expect(result).toBe(false);
    expect(useGame.getState().coins).toBe(0);
  });
});

describe('purchasesLocked cross-cutting — state isolation', () => {
  it('SHOP-ISO-01: toggling cloud flag between tests does not bleed state', () => {
    // First call: locked
    cloudEnabled = true;
    clearSession();
    giveCoins(500);
    expect(useGame.getState().buyAvatar('robot')).toBe(false);

    // Reset store; now disable cloud
    useGame.getState().resetProgress();
    localStorageMock.clear();
    cloudEnabled = false;
    giveCoins(500);
    expect(useGame.getState().buyAvatar('robot')).toBe(true);
  });

  it('SHOP-ISO-02: buying an expensive item exactly at coin threshold succeeds', () => {
    cloudEnabled = false;
    giveCoins(50); // robot costs exactly 50

    const result = useGame.getState().buyAvatar('robot');

    expect(result).toBe(true);
    expect(useGame.getState().coins).toBe(0);
  });

  it('SHOP-ISO-03: buying an expensive item one coin short fails', () => {
    cloudEnabled = false;
    giveCoins(49); // robot costs 50

    const result = useGame.getState().buyAvatar('robot');

    expect(result).toBe(false);
    expect(useGame.getState().coins).toBe(49);
  });
});
