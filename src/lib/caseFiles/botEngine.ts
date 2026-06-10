/**
 * Case Files — offline Bot Practice opponents. Pure, framework-free, deterministic
 * (seedable) so it's unit-testable and the scoreboard never flickers on re-render.
 *
 * Bots are *cosmetic competitors* — they fill a Kahoot-style scoreboard so solo
 * practice feels social. They NEVER affect the player's own score, XP, or stars.
 * Accuracy is calibrated by grade band; bots never answer faster than 8s so they
 * can't monopolise the speed bonus (per GDD §5 Bot Practice).
 */

import type { CaseGradeBand } from '@/data/cases/types';

export interface BotProfile {
  id: string;
  name: string;
  emoji: string;
}

export interface BotPlanItem {
  correct: boolean;
  timeMs: number;
  points: number; // display score for this question (0 if wrong)
}

export interface Bot extends BotProfile {
  accuracy: number; // 0..1 chance of a correct answer
  plan: BotPlanItem[]; // one entry per question (precomputed, deterministic)
}

const BOT_PROFILES: BotProfile[] = [
  { id: 'bot-ada', name: 'Ada', emoji: '🦉' },
  { id: 'bot-max', name: 'Max', emoji: '🦊' },
  { id: 'bot-iris', name: 'Iris', emoji: '🐱' },
  { id: 'bot-leo', name: 'Leo', emoji: '🐼' },
  { id: 'bot-nia', name: 'Nia', emoji: '🦝' },
];

/** Accuracy band: easier cases → more forgiving bots, harder cases → sharper bots. */
const BAND_ACCURACY: Record<CaseGradeBand, number> = {
  '7-9': 0.7,
  '10-12': 0.8,
  '13-14': 0.9,
};

export const ANSWER_WINDOW_MS = 45_000;
const BOT_MIN_MS = 8_000; // never beat a careful reader on raw speed
const BOT_MAX_MS = 38_000;

/** Display score for a correct answer at a given response time (Kahoot-style). */
export function questionPoints(correct: boolean, timeMs: number): number {
  if (!correct) return 0;
  const speed = Math.max(0, Math.round(30 * (1 - Math.min(timeMs, ANSWER_WINDOW_MS) / ANSWER_WINDOW_MS)));
  return 100 + speed;
}

/** Small deterministic PRNG (mulberry32) so a seed reproduces the same match. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build `count` bots for a case with `questionCount` questions, each with a
 * fully precomputed deterministic plan. Pass a stable `seed` for reproducibility
 * (defaults to a random match seed).
 */
export function makeBots(
  band: CaseGradeBand,
  questionCount: number,
  count = 3,
  seed = (Math.random() * 1e9) | 0,
): Bot[] {
  const n = Math.max(0, Math.min(count, BOT_PROFILES.length));
  const baseAccuracy = BAND_ACCURACY[band];
  const rand = rng(seed);

  return BOT_PROFILES.slice(0, n).map((p, i) => {
    // Spread bot skill a little around the band baseline so the board has variety.
    const accuracy = Math.max(0.4, Math.min(0.97, baseAccuracy + (i - (n - 1) / 2) * 0.06));
    const plan: BotPlanItem[] = Array.from({ length: questionCount }, () => {
      const correct = rand() < accuracy;
      const timeMs = Math.round(BOT_MIN_MS + rand() * (BOT_MAX_MS - BOT_MIN_MS));
      return { correct, timeMs, points: questionPoints(correct, timeMs) };
    });
    return { ...p, accuracy, plan };
  });
}

/** A bot's cumulative display score through (and including) question `index`. */
export function botScoreThrough(bot: Bot, index: number): number {
  return bot.plan.slice(0, index + 1).reduce((sum, item) => sum + item.points, 0);
}
