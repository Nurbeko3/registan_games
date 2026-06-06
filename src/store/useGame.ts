'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { levelForXp, dayKey, nextStreak } from '@/lib/leveling';
import { getGame } from '@/data/games';
import { ZONES } from '@/data/worlds';
import { ACHIEVEMENTS, type Achievement, type AchievementSnapshot } from '@/data/achievements';
import { AVATARS, THEMES, getAvatar, getTheme } from '@/data/cosmetics';
import type { Locale } from '@/lib/i18n/config';

interface GameRecord {
  stars: number;
  plays: number;
}

interface Settings {
  sound: boolean;
  reducedMotion: boolean;
}

export interface CompleteResult {
  xpAwarded: number;
  coinsAwarded: number;
  stars: number;
  bestStars: number;
  improved: boolean;
  leveledUp: boolean;
  newLevel: number;
  newAchievements: Achievement[];
}

export interface LevelCelebration {
  code: string;
  kind: 'level';
  level: number;
}

export type Celebration = Achievement | LevelCelebration;

/** XP + coins granted for a correct Battle Learn Arena question, by difficulty. */
const ARENA_REWARD: Record<'easy' | 'medium' | 'hard', { xp: number; coins: number }> = {
  easy: { xp: 8, coins: 4 },
  medium: { xp: 14, coins: 7 },
  hard: { xp: 22, coins: 11 },
};
const ARENA_WIN_BONUS = { xp: 50, coins: 30 };

interface GameState {
  // persisted progress
  xp: number;
  coins: number;
  gems: number;
  streak: number;
  lastPlayedDay: string | null;
  lastDailyClaim: string | null;
  completed: Record<string, GameRecord>;
  unlockedAchievements: string[];
  avatarId: string;
  unlockedAvatars: string[];
  themeId: string;
  unlockedThemes: string[];
  settings: Settings;
  locale: Locale;
  playerName: string;
  /** freely-chosen emoji avatar for the Arena (not tied to the coin shop). */
  arenaAvatar: string;
  // Battle Learn Arena lifetime stats
  arenaMatches: number;
  arenaWins: number;
  arenaCorrect: number;
  arenaBestElims: number;

  // transient (not persisted)
  hydrated: boolean;
  celebrations: Celebration[];

  // actions
  setPlayerName: (name: string) => void;
  setArenaAvatar: (emoji: string) => void;
  setLocale: (locale: Locale) => void;
  setHydrated: () => void;
  completeGame: (slug: string, stars: number) => CompleteResult;
  arenaAnswerCorrect: (difficulty: 'easy' | 'medium' | 'hard') => { xp: number; coins: number };
  arenaMatchEnd: (r: { won: boolean; correct: number; elims: number }) => {
    bonusXp: number;
    bonusCoins: number;
    newAchievements: Achievement[];
  };
  claimDaily: () => { coins: number; xp: number } | null;
  buyAvatar: (id: string) => boolean;
  selectAvatar: (id: string) => void;
  buyTheme: (id: string) => boolean;
  selectTheme: (id: string) => void;
  toggleSetting: (key: keyof Settings) => void;
  dismissCelebration: (code: string) => void;
  resetProgress: () => void;
}

const DEFAULTS = {
  xp: 0,
  coins: 0,
  gems: 0,
  streak: 0,
  lastPlayedDay: null as string | null,
  lastDailyClaim: null as string | null,
  completed: {} as Record<string, GameRecord>,
  unlockedAchievements: [] as string[],
  avatarId: 'kid',
  unlockedAvatars: ['kid', 'boy', 'girl'],
  themeId: 'cloud',
  unlockedThemes: ['cloud'],
  settings: { sound: true, reducedMotion: false } as Settings,
  locale: 'uz' as Locale,
  playerName: '',
  arenaAvatar: '🦊',
  arenaMatches: 0,
  arenaWins: 0,
  arenaCorrect: 0,
  arenaBestElims: 0,
};

// ── derived selectors (use with useGame(selector)) ──────────────────
export const selectTotalStars = (s: GameState): number =>
  Object.values(s.completed).reduce((n, r) => n + r.stars, 0);

function buildSnapshot(s: GameState): AchievementSnapshot {
  const totalStars = selectTotalStars(s);
  const records = Object.values(s.completed);
  return {
    xp: s.xp,
    level: levelForXp(s.xp),
    coins: s.coins,
    streak: s.streak,
    totalStars,
    gamesCompleted: records.filter((r) => r.stars > 0).length,
    perfectGames: records.filter((r) => r.stars >= 3).length,
    zonesUnlocked: ZONES.filter((z) => z.unlockStars <= totalStars).length,
    arenaWins: s.arenaWins,
    arenaCorrect: s.arenaCorrect,
  };
}

export function levelCelebrationsBetween(fromXp: number, toXp: number): LevelCelebration[] {
  const fromLevel = levelForXp(fromXp);
  const toLevel = levelForXp(toXp);
  if (toLevel <= fromLevel) return [];
  return Array.from({ length: toLevel - fromLevel }, (_, i) => {
    const level = fromLevel + i + 1;
    return { code: `LEVEL_UP_${level}`, kind: 'level', level };
  });
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      hydrated: false,
      celebrations: [],

      setPlayerName: (name) => set({ playerName: name.slice(0, 20) }),

      setArenaAvatar: (emoji) => set({ arenaAvatar: emoji }),

      setLocale: (locale) => set({ locale }),

      // Flipped from a post-mount effect (AppChrome). Driving it here — instead of
      // inside persist's onRehydrateStorage — avoids the temporal-dead-zone trap:
      // localStorage is synchronous, so that callback runs during create() before
      // `useGame` exists, and its setState silently no-ops, leaving the locale
      // toggle frozen on the default language. An effect runs after first paint,
      // so it also keeps SSR and the first client render matching.
      setHydrated: () => set({ hydrated: true }),

      completeGame: (slug, stars) => {
        const state = get();
        const meta = getGame(slug);
        const baseXp = meta?.baseXp ?? 30;

        const prev = state.completed[slug];
        const prevStars = prev?.stars ?? 0;
        const improved = stars > prevStars;
        const firstClear = !prev;

        const xpAwarded = firstClear || improved ? Math.round(baseXp * (0.5 + 0.25 * stars)) : 5;
        const coinsAwarded = firstClear || improved ? stars * 10 : 0;

        // streak: count once per day on any play
        const today = dayKey();
        const streak = state.lastPlayedDay === today ? state.streak : nextStreak(state.lastPlayedDay, state.streak);

        const newXp = state.xp + xpAwarded;

        const completed: Record<string, GameRecord> = {
          ...state.completed,
          [slug]: { stars: Math.max(prevStars, stars), plays: (prev?.plays ?? 0) + 1 },
        };

        // evaluate achievements against the would-be new state
        const draft: GameState = {
          ...state,
          xp: newXp,
          coins: state.coins + coinsAwarded,
          streak,
          completed,
        };
        const snap = buildSnapshot(draft);
        const newlyUnlocked = ACHIEVEMENTS.filter((a) => !state.unlockedAchievements.includes(a.code) && a.check(snap));
        const achvXp = newlyUnlocked.length * 25;
        const achvCoins = newlyUnlocked.length * 15;
        const finalXp = newXp + achvXp;
        const levelUps = levelCelebrationsBetween(state.xp, finalXp);

        set({
          xp: finalXp,
          coins: state.coins + coinsAwarded + achvCoins,
          streak,
          lastPlayedDay: today,
          completed,
          unlockedAchievements: [...state.unlockedAchievements, ...newlyUnlocked.map((a) => a.code)],
          celebrations: [...state.celebrations, ...levelUps, ...newlyUnlocked],
        });

        return {
          xpAwarded: xpAwarded + achvXp,
          coinsAwarded: coinsAwarded + achvCoins,
          stars,
          bestStars: Math.max(prevStars, stars),
          improved,
          leveledUp: levelUps.length > 0,
          newLevel: levelForXp(finalXp),
          newAchievements: newlyUnlocked,
        };
      },

      // ── Battle Learn Arena: a correct answer respawns the player + pays out ──
      arenaAnswerCorrect: (difficulty) => {
        const reward = ARENA_REWARD[difficulty];
        set((s) => {
          const newXp = s.xp + reward.xp;
          return {
            xp: newXp,
            coins: s.coins + reward.coins,
            arenaCorrect: s.arenaCorrect + 1,
            celebrations: [...s.celebrations, ...levelCelebrationsBetween(s.xp, newXp)],
          };
        });
        return reward;
      },

      // ── Battle Learn Arena: end-of-match bookkeeping, bonuses & achievements ──
      arenaMatchEnd: ({ won, elims }) => {
        const state = get();
        const bonusXp = won ? ARENA_WIN_BONUS.xp : 0;
        const bonusCoins = won ? ARENA_WIN_BONUS.coins : 0;

        const draft: GameState = {
          ...state,
          xp: state.xp + bonusXp,
          coins: state.coins + bonusCoins,
          arenaMatches: state.arenaMatches + 1,
          arenaWins: state.arenaWins + (won ? 1 : 0),
          // arenaCorrect was already incremented per-answer
          arenaBestElims: Math.max(state.arenaBestElims, elims),
        };
        const snap = buildSnapshot(draft);
        const newlyUnlocked = ACHIEVEMENTS.filter(
          (a) => !state.unlockedAchievements.includes(a.code) && a.check(snap),
        );
        const finalXp = draft.xp + newlyUnlocked.length * 25;
        const levelUps = levelCelebrationsBetween(state.xp, finalXp);

        set({
          xp: finalXp,
          coins: draft.coins + newlyUnlocked.length * 15,
          arenaMatches: draft.arenaMatches,
          arenaWins: draft.arenaWins,
          arenaBestElims: draft.arenaBestElims,
          unlockedAchievements: [...state.unlockedAchievements, ...newlyUnlocked.map((a) => a.code)],
          celebrations: [...state.celebrations, ...levelUps, ...newlyUnlocked],
        });

        return { bonusXp, bonusCoins, newAchievements: newlyUnlocked };
      },

      claimDaily: () => {
        const today = dayKey();
        if (get().lastDailyClaim === today) return null;
        const coins = 25;
        const xp = 20;
        set((s) => {
          const newXp = s.xp + xp;
          return {
            coins: s.coins + coins,
            xp: newXp,
            lastDailyClaim: today,
            celebrations: [...s.celebrations, ...levelCelebrationsBetween(s.xp, newXp)],
          };
        });
        return { coins, xp };
      },

      buyAvatar: (id) => {
        const s = get();
        const a = AVATARS.find((x) => x.id === id);
        if (!a || s.unlockedAvatars.includes(id)) return false;
        if (a.unlockLevel && levelForXp(s.xp) < a.unlockLevel) return false;
        if (s.coins < a.cost) return false;
        set({ coins: s.coins - a.cost, unlockedAvatars: [...s.unlockedAvatars, id], avatarId: id });
        return true;
      },
      selectAvatar: (id) => {
        // free characters (cost 0, e.g. boy/girl) are always selectable
        const free = getAvatar(id).cost === 0;
        if (free || get().unlockedAvatars.includes(id)) set({ avatarId: id });
      },

      buyTheme: (id) => {
        const s = get();
        const t = THEMES.find((x) => x.id === id);
        if (!t || s.unlockedThemes.includes(id)) return false;
        if (s.coins < t.cost) return false;
        set({ coins: s.coins - t.cost, unlockedThemes: [...s.unlockedThemes, id], themeId: id });
        return true;
      },
      selectTheme: (id) => {
        if (get().unlockedThemes.includes(id)) set({ themeId: id });
      },

      toggleSetting: (key) => set((s) => ({ settings: { ...s.settings, [key]: !s.settings[key] } })),

      dismissCelebration: (code) => set((s) => ({ celebrations: s.celebrations.filter((c) => c.code !== code) })),

      resetProgress: () => set({ ...DEFAULTS, hydrated: true, celebrations: [] }),
    }),
    {
      name: 'kcq.v2',
      // never persist transient fields
      partialize: ({ hydrated, celebrations, ...persisted }) => persisted,
    },
  ),
);

/** True once the persisted store has loaded on the client. */
export function useHydrated(): boolean {
  return useGame((s) => s.hydrated);
}

export { getAvatar, getTheme };
