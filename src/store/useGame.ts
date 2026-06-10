'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { levelForXp, dayKey, nextStreak } from '@/lib/leveling';
import { getGame } from '@/data/games';
import { ZONES } from '@/data/worlds';
import { ACHIEVEMENTS, type Achievement, type AchievementSnapshot } from '@/data/achievements';
import { AVATARS, THEMES, getAvatar, getTheme } from '@/data/cosmetics';
import type { Locale } from '@/lib/i18n/config';
import { isCloudEnabled } from '@/lib/supabase/client';
import {
  caseAnswerXp,
  caseSolveXp,
  caseSolveCoins,
  CASE_ANSWER_COINS,
  FIRST_CASE_OF_DAY_XP,
  FIRST_CASE_OF_DAY_COINS,
} from '@/lib/caseLeveling';

// Mirrors SESSION_KEY from src/lib/supabase/account.ts. Kept inline to avoid
// a circular import (account.ts imports this store). Returns true only when a
// student session token is present in localStorage on the client.
function hasStudentSession(): boolean {
  if (typeof window === 'undefined') return false;
  try { return JSON.parse(localStorage.getItem('kcq.session') || 'null') !== null; }
  catch { return false; }
}

// Shop purchases are gated to logged-in students ONLY when cloud is enabled
// (classroom mode). With no Supabase env there are no profiles at all, so the
// gate would brick the offline-first shop — keep buying open in that case.
// (Cloud must stay strictly additive — see CLAUDE.md.)
function purchasesLocked(): boolean {
  return progressLocked();
}

// Earning XP/coins (and any other persistent progress mutation) is gated the
// same way as purchases: in classroom (cloud) mode a guest with no logged-in
// student profile must earn NOTHING and persist NOTHING — otherwise phantom
// progress accumulates in localStorage that gets wiped on the next login
// anyway (account login is authoritative, see account.ts applyToStore).
// With no Supabase env this always returns false — offline-first is untouched.
function progressLocked(): boolean {
  return isCloudEnabled() && !hasStudentSession();
}

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

/** Result of finishing a Case Files case (drives the results screen + celebrations). */
export interface CaseMatchResult {
  xpAwarded: number;       // global XP added (solve-bonus delta + first-of-day + achievements)
  coinsAwarded: number;    // global coins added
  caseXpAwarded: number;   // case-solve XP added to the Detective-rank counter (delta only)
  stars: number;
  bestStars: number;
  improved: boolean;
  firstOfDay: boolean;
  leveledUp: boolean;
  newLevel: number;
  newAchievements: Achievement[];
}

/** Mode + outcome a finished case reports to the store. `isClassroomConfirmed`
 * must come from server-authoritative room state, never a raw client flag —
 * it gates the classroom-win counter so Bot Practice can't self-grant it. */
export interface CaseMatchInput {
  caseId: string;
  stars: number;           // offline: client-graded; cloud: recomputed server-side
  correct: number;
  total: number;
  hintsUsed: boolean;
  bestStreak: number;      // best consecutive-correct run within the match
  mode: 'bot' | 'friendly' | 'classroom';
  isClassroomConfirmed?: boolean;
  placement?: number;      // 1 = winner
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
  /** Codecaster dungeon: best stars per level (key = level id like 'L01'). */
  codecaster: Record<string, { stars: number }>;
  // ── Case Files (reading-detective mode) ──
  /** Best stars per case (key = case id like 'case01'). Anti-farm: best only. */
  cases: Record<string, { stars: number }>;
  /** Cumulative case-solve XP — the SEPARATE counter that drives Detective rank. */
  caseXp: number;
  /** Lifetime count of cases solved with no hints opened. */
  caseNoHintSolves: number;
  /** Best consecutive-correct streak achieved in any single case (high-water). */
  caseStreak: number;
  /** 1st-place finishes in server-confirmed classroom tournaments. */
  classroomCaseTournamentWins: number;
  /** Day key of the last solved case (for the first-case-of-day bonus). */
  lastCaseDay: string | null;

  // transient (not persisted)
  hydrated: boolean;
  celebrations: Celebration[];

  // actions
  setPlayerName: (name: string) => void;
  setArenaAvatar: (emoji: string) => void;
  setLocale: (locale: Locale) => void;
  setHydrated: () => void;
  completeGame: (slug: string, stars: number) => CompleteResult;
  codecasterComplete: (levelId: string, stars: number) => CompleteResult;
  /** Case Files: per-answer reward (live multiplayer feedback). `consecutiveCorrect`
   *  is the in-match correct streak SO FAR (this answer counts) — drives the multiplier. */
  caseAnswerCorrect: (consecutiveCorrect: number) => { xp: number; coins: number };
  /** Case Files: end-of-case settlement — solve bonus (anti-farm delta into caseXp +
   *  global XP/coins), first-of-day bonus, stats, achievements. */
  caseMatchEnd: (r: CaseMatchInput) => CaseMatchResult;
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
  /**
   * Reset PROGRESS to baseline (xp/coins/streak/completed/achievements/
   * cosmetics/arena/codecaster) while PRESERVING device-level prefs (locale,
   * settings). Used on logout / failed-resume in classroom mode so a shared
   * device never displays or carries a previous student's balance forward.
   */
  resetToGuest: () => void;
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
  codecaster: {} as Record<string, { stars: number }>,
  cases: {} as Record<string, { stars: number }>,
  caseXp: 0,
  caseNoHintSolves: 0,
  caseStreak: 0,
  classroomCaseTournamentWins: 0,
  lastCaseDay: null as string | null,
};

// ── derived selectors (use with useGame(selector)) ──────────────────
export const selectTotalStars = (s: GameState): number =>
  Object.values(s.completed).reduce((n, r) => n + r.stars, 0);

function buildSnapshot(s: GameState): AchievementSnapshot {
  const totalStars = selectTotalStars(s);
  const records = Object.values(s.completed);
  const caseRecords = Object.values(s.cases);
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
    // ── Case Files ── casesCompleted/cases3star are DERIVED from the best-stars map
    casesCompleted: caseRecords.filter((r) => r.stars > 0).length,
    cases3star: caseRecords.filter((r) => r.stars >= 3).length,
    caseXp: s.caseXp,
    caseNoHintSolves: s.caseNoHintSolves,
    caseStreak: s.caseStreak,
    classroomCaseTournamentWins: s.classroomCaseTournamentWins,
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

        // Classroom mode + guest (no logged-in student): full no-op. Recording
        // anonymous progress would only create phantom XP/coins that vanish on
        // the next login (account progress is authoritative) — so we award and
        // persist nothing, and report the existing best back to the UI.
        if (progressLocked()) {
          const prevStars = state.completed[slug]?.stars ?? 0;
          return {
            xpAwarded: 0,
            coinsAwarded: 0,
            stars,
            bestStars: prevStars,
            improved: false,
            leveledUp: false,
            newLevel: levelForXp(state.xp),
            newAchievements: [],
          };
        }

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

      // ── Codecaster dungeon: record a solved level, award by stars ──
      // Mirrors completeGame's reward scale & celebration pipeline. Anti-farm:
      // we store only the BEST stars per level and award only the DELTA of XP/
      // coins between the old best and the new best — replaying at equal/lower
      // stars pays nothing, and improving pays only the difference, so a level
      // can never be farmed for repeat rewards.
      codecasterComplete: (levelId, stars) => {
        const state = get();

        // Same guest-lockout as completeGame — see its comment for rationale.
        if (progressLocked()) {
          const prevStars = state.codecaster[levelId]?.stars ?? 0;
          return {
            xpAwarded: 0,
            coinsAwarded: 0,
            stars,
            bestStars: prevStars,
            improved: false,
            leveledUp: false,
            newLevel: levelForXp(state.xp),
            newAchievements: [],
          };
        }

        const prev = state.codecaster[levelId];
        const prevStars = prev?.stars ?? 0;
        const bestStars = Math.max(prevStars, stars);
        const improved = stars > prevStars;

        // Reward scale matches completeGame (baseXp 30): xp = round(30*(0.5+0.25*s)),
        // coins = s*10. We award the DELTA between the new best and old best so
        // re-solving better only tops up the difference.
        const CC_BASE_XP = 30;
        const xpFor = (s: number) => (s > 0 ? Math.round(CC_BASE_XP * (0.5 + 0.25 * s)) : 0);
        const coinsFor = (s: number) => s * 10;
        const xpAwarded = improved ? xpFor(bestStars) - xpFor(prevStars) : 0;
        const coinsAwarded = improved ? coinsFor(bestStars) - coinsFor(prevStars) : 0;

        // streak: count once per day on any play (same as completeGame)
        const today = dayKey();
        const streak = state.lastPlayedDay === today ? state.streak : nextStreak(state.lastPlayedDay, state.streak);

        const newXp = state.xp + xpAwarded;
        const codecaster = { ...state.codecaster, [levelId]: { stars: bestStars } };

        // Achievements evaluate against the would-be new state (data-driven).
        const draft: GameState = {
          ...state,
          xp: newXp,
          coins: state.coins + coinsAwarded,
          streak,
          codecaster,
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
          codecaster,
          unlockedAchievements: [...state.unlockedAchievements, ...newlyUnlocked.map((a) => a.code)],
          celebrations: [...state.celebrations, ...levelUps, ...newlyUnlocked],
        });

        return {
          xpAwarded: xpAwarded + achvXp,
          coinsAwarded: coinsAwarded + achvCoins,
          stars,
          bestStars,
          improved,
          leveledUp: levelUps.length > 0,
          newLevel: levelForXp(finalXp),
          newAchievements: newlyUnlocked,
        };
      },

      // ── Case Files: per-answer reward (live multiplayer feedback) ──
      // Mirrors arenaAnswerCorrect: pays into the global XP/coin pools immediately
      // for the "+XP" pop. Streak multiplier applies to XP only; coins are flat.
      // The case-SOLVE bonus + caseXp (rank) are settled separately in caseMatchEnd.
      caseAnswerCorrect: (consecutiveCorrect) => {
        if (progressLocked()) return { xp: 0, coins: 0 };

        const xp = caseAnswerXp(consecutiveCorrect);
        const coins = CASE_ANSWER_COINS;
        set((s) => {
          const newXp = s.xp + xp;
          return {
            xp: newXp,
            coins: s.coins + coins,
            celebrations: [...s.celebrations, ...levelCelebrationsBetween(s.xp, newXp)],
          };
        });
        return { xp, coins };
      },

      // ── Case Files: end-of-case settlement ──
      // Anti-farm (mirrors codecasterComplete): stores BEST stars per case and pays
      // only the DELTA of the solve bonus between old and new best — into BOTH the
      // global XP/coin pools AND the separate caseXp rank counter. Per-answer XP was
      // already paid live (caseAnswerCorrect), so it is NOT re-paid here.
      caseMatchEnd: (input) => {
        const state = get();
        const newLevel0 = levelForXp(state.xp);

        // Guest in classroom (cloud) mode: full no-op (see completeGame rationale).
        if (progressLocked()) {
          const prevStars = state.cases[input.caseId]?.stars ?? 0;
          return {
            xpAwarded: 0, coinsAwarded: 0, caseXpAwarded: 0,
            stars: input.stars, bestStars: prevStars, improved: false,
            firstOfDay: false, leveledUp: false, newLevel: newLevel0, newAchievements: [],
          };
        }

        const stars = Math.max(0, Math.min(3, Math.round(input.stars)));
        const prev = state.cases[input.caseId];
        const prevStars = prev?.stars ?? 0;
        const bestStars = Math.max(prevStars, stars);
        const improved = stars > prevStars;
        const solved = stars >= 1;

        // Solve-bonus delta (anti-farm): only the improvement over the previous best.
        const solveXpAwarded = improved ? caseSolveXp(bestStars) - caseSolveXp(prevStars) : 0;
        const solveCoinsAwarded = improved ? caseSolveCoins(bestStars) - caseSolveCoins(prevStars) : 0;

        // First-case-of-day bonus: once per calendar day, only on an actual solve.
        // Uses lastCaseDay (DISTINCT from claimDaily's lastDailyClaim — different values).
        const today = dayKey();
        const firstOfDay = solved && state.lastCaseDay !== today;
        const dayXp = firstOfDay ? FIRST_CASE_OF_DAY_XP : 0;
        const dayCoins = firstOfDay ? FIRST_CASE_OF_DAY_COINS : 0;
        // Daily play-streak bumps on the first solve of the day (like completeGame).
        const streak = firstOfDay ? nextStreak(state.lastPlayedDay, state.streak) : state.streak;

        // Classroom-win counter — ONLY when the SERVER confirmed this was a real
        // classroom tournament AND the player placed 1st. A client-supplied mode
        // flag is never trusted (Bot Practice can never self-grant this) [QA HIGH-02].
        const wonClassroom =
          input.mode === 'classroom' && input.isClassroomConfirmed === true && input.placement === 1;

        const cases = { ...state.cases, [input.caseId]: { stars: bestStars } };
        const caseNoHintSolves = state.caseNoHintSolves + (solved && !input.hintsUsed ? 1 : 0);
        const caseStreak = Math.max(state.caseStreak, input.bestStreak);
        const classroomCaseTournamentWins = state.classroomCaseTournamentWins + (wonClassroom ? 1 : 0);

        // Evaluate achievements against the would-be new state (data-driven).
        const baseXp = state.xp + solveXpAwarded + dayXp;
        const draft: GameState = {
          ...state,
          xp: baseXp,
          coins: state.coins + solveCoinsAwarded + dayCoins,
          streak,
          cases,
          caseXp: state.caseXp + solveXpAwarded,
          caseNoHintSolves,
          caseStreak,
          classroomCaseTournamentWins,
        };
        const snap = buildSnapshot(draft);
        const newlyUnlocked = ACHIEVEMENTS.filter(
          (a) => !state.unlockedAchievements.includes(a.code) && a.check(snap),
        );
        const achvXp = newlyUnlocked.length * 25;
        const achvCoins = newlyUnlocked.length * 15;
        const finalXp = baseXp + achvXp;
        const levelUps = levelCelebrationsBetween(state.xp, finalXp);

        set({
          xp: finalXp,
          coins: state.coins + solveCoinsAwarded + dayCoins + achvCoins,
          streak,
          lastPlayedDay: firstOfDay ? today : state.lastPlayedDay,
          lastCaseDay: solved ? today : state.lastCaseDay,
          cases,
          caseXp: state.caseXp + solveXpAwarded,
          caseNoHintSolves,
          caseStreak,
          classroomCaseTournamentWins,
          unlockedAchievements: [...state.unlockedAchievements, ...newlyUnlocked.map((a) => a.code)],
          celebrations: [...state.celebrations, ...levelUps, ...newlyUnlocked],
        });

        return {
          xpAwarded: solveXpAwarded + dayXp + achvXp,
          coinsAwarded: solveCoinsAwarded + dayCoins + achvCoins,
          caseXpAwarded: solveXpAwarded,
          stars,
          bestStars,
          improved,
          firstOfDay,
          leveledUp: levelUps.length > 0,
          newLevel: levelForXp(finalXp),
          newAchievements: newlyUnlocked,
        };
      },

      // ── Battle Learn Arena: a correct answer respawns the player + pays out ──
      arenaAnswerCorrect: (difficulty) => {
        // Guest in classroom mode: no reward, no mutation (see completeGame).
        if (progressLocked()) return { xp: 0, coins: 0 };

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
        // Guest in classroom mode: no bonus, no mutation (see completeGame).
        if (progressLocked()) return { bonusXp: 0, bonusCoins: 0, newAchievements: [] };

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
        // Guest in classroom mode: treat as unavailable, no mutation.
        if (progressLocked()) return null;

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
        // In classroom (cloud) mode, buying requires a logged-in student.
        if (purchasesLocked()) return false;
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
        // In classroom (cloud) mode, buying requires a logged-in student.
        if (purchasesLocked()) return false;
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

      resetToGuest: () =>
        set((s) => ({ ...DEFAULTS, locale: s.locale, settings: s.settings, hydrated: true, celebrations: [] })),
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
