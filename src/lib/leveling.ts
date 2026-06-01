/**
 * Leveling curve — pure functions, no dependencies.
 * Early levels are fast (quick dopamine), later levels stretch out.
 *
 *   totalXpForLevel(L) = 50 * (L - 1) * L   → 0, 100, 300, 600, 1000…
 */
export function totalXpForLevel(level: number): number {
  return 50 * (level - 1) * level;
}

export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2));
}

export interface LevelState {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressPct: number;
}

export function levelState(xp: number): LevelState {
  const level = levelForXp(xp);
  const floor = totalXpForLevel(level);
  const ceil = totalXpForLevel(level + 1);
  const xpIntoLevel = xp - floor;
  const xpForNextLevel = ceil - floor;
  return { level, xpIntoLevel, xpForNextLevel, progressPct: Math.round((xpIntoLevel / xpForNextLevel) * 100) };
}

/** UTC day key for streak math. */
export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Given the last active day and current streak, compute the new streak today. */
export function nextStreak(lastDay: string | null, current: number): number {
  if (!lastDay) return 1;
  const today = new Date(dayKey());
  const last = new Date(lastDay);
  const diff = Math.round((today.getTime() - last.getTime()) / 86_400_000);
  if (diff === 0) return current; // already counted today
  if (diff === 1) return current + 1; // consecutive
  return 1; // broken
}
