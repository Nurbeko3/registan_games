/**
 * Daily challenge — one short, concrete goal per calendar day.
 *
 * The challenge for a day is picked DETERMINISTICALLY from a pool by hashing
 * the day key, so every student (and every device) sees the same task and it
 * never changes mid-day. Completing it pays a bonus on top of the normal
 * reward; the store guards it to once per day (`lastDailyChallengeDone`).
 *
 * Data-driven like the rest of `src/data`: add entries to `DAILY_POOL` to
 * widen variety. Targets reference real content (mini-game slugs / Codecaster
 * level ids) — `dailyChallenges.test.ts` proves every entry resolves.
 */

import { GAMES } from './games';
import { CODECASTER_LEVELS } from './codecaster/levels';
import { zoneOfGame } from './worlds';

export type DailyChallengeDef =
  | { id: string; kind: 'game'; slug: string; stars: 1 | 2 | 3; bonusXp: number; bonusCoins: number }
  | { id: string; kind: 'quest'; levelId: string; stars: 1 | 2 | 3; bonusXp: number; bonusCoins: number };

const bonusFor = (stars: 1 | 2 | 3) => ({ bonusXp: 20 + stars * 15, bonusCoins: 10 + stars * 5 });

/** Every mini-game at 2★ and 3★, plus every Codecaster level at 1★ and 3★. */
export const DAILY_POOL: DailyChallengeDef[] = [
  ...GAMES.flatMap((g) => ([2, 3] as const).map((stars) => ({ id: `game:${g.slug}:${stars}`, kind: 'game' as const, slug: g.slug, stars, ...bonusFor(stars) }))),
  ...CODECASTER_LEVELS.flatMap((l) => ([1, 3] as const).map((stars) => ({ id: `quest:${l.id}:${stars}`, kind: 'quest' as const, levelId: l.id, stars, ...bonusFor(stars) }))),
];

/** Small, stable string hash (FNV-1a) → non-negative int. */
export function hashDay(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** What a student can currently open — used to keep the daily pick reachable. */
export interface DailyReach {
  /** Total mini-game stars (unlocks worlds). */
  totalStars: number;
  /** Best stars per Codecaster level (L(n) unlocks when L(n-1) has ≥1 star). */
  codecaster: Record<string, { stars: number }>;
}

export function isGameReachable(slug: string, reach: DailyReach): boolean {
  const zone = zoneOfGame(slug);
  return !zone || zone.unlockStars <= reach.totalStars;
}

export function isLevelReachable(levelId: string, reach: DailyReach): boolean {
  const idx = CODECASTER_LEVELS.findIndex((l) => l.id === levelId);
  if (idx <= 0) return idx === 0;
  const prev = CODECASTER_LEVELS[idx - 1]!;
  return (reach.codecaster[prev.id]?.stars ?? 0) >= 1;
}

/**
 * The challenge for a `YYYY-MM-DD` day key. Same day + same reach → same
 * challenge. With `reach` the pick is restricted to content the student can
 * actually open (a beginner never gets a locked world or level); without it
 * the whole pool is used.
 */
export function dailyChallengeFor(dayKey: string, reach?: DailyReach): DailyChallengeDef {
  const pool = reach
    ? DAILY_POOL.filter((c) => (c.kind === 'game' ? isGameReachable(c.slug, reach) : isLevelReachable(c.levelId, reach)))
    : DAILY_POOL;
  const list = pool.length > 0 ? pool : DAILY_POOL;
  return list[hashDay(dayKey) % list.length]!;
}

/** Find a pool entry by id (e.g. the one recorded as completed today). */
export function dailyChallengeById(id: string): DailyChallengeDef | undefined {
  return DAILY_POOL.find((c) => c.id === id);
}

/** Does a just-finished activity satisfy the day's challenge? */
export function satisfiesDaily(
  challenge: DailyChallengeDef,
  activity: { kind: 'game'; slug: string; stars: number } | { kind: 'quest'; levelId: string; stars: number },
): boolean {
  if (challenge.kind !== activity.kind) return false;
  if (activity.stars < challenge.stars) return false;
  return challenge.kind === 'game'
    ? challenge.slug === (activity as { slug: string }).slug
    : challenge.levelId === (activity as { levelId: string }).levelId;
}

/** Route to play the challenge. */
export function dailyChallengeHref(c: DailyChallengeDef): string {
  return c.kind === 'game' ? `/play/${c.slug}` : `/quest/${c.levelId}`;
}

/** i18n key of the target's display title (game or level). */
export function dailyChallengeTitleKey(c: DailyChallengeDef): string {
  if (c.kind === 'game') return `game.${c.slug}.title`;
  return CODECASTER_LEVELS.find((l) => l.id === c.levelId)?.title ?? c.levelId;
}

/** Milliseconds until the next UTC day (when the challenge rotates). */
export function msUntilNextChallenge(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(0, next - now.getTime());
}
