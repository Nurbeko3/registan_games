/**
 * Case Files — scoring + ranking math. Pure functions, no dependencies, framework-free.
 *
 * Authoritative numbers come from docs/find-info-about-me/00-BRIEF.md §8 (locked).
 * These are mirrored server-side in migration 0011 (the RPCs recompute stars + the
 * speed bonus); the offline Bot Practice path uses these directly.
 */

import { DETECTIVE_RANKS, type DetectiveRank } from '@/data/cases/ranks';

// ── per-answer reward (offline + the base of the cloud reward) ──────────────
export const CASE_ANSWER_XP = 15;
export const CASE_ANSWER_COINS = 3; // flat — streak multiplier applies to XP only (§9.2)

// ── first-case-of-day bonus (§3.3) ──────────────────────────────────────────
export const FIRST_CASE_OF_DAY_XP = 30;
export const FIRST_CASE_OF_DAY_COINS = 6;

/**
 * Streak multiplier on per-answer XP, by the number of consecutive correct
 * answers SO FAR in the match (the current correct answer counts):
 *   1 correct → ×1.0 · 2–3 → ×1.2 · 4+ → ×1.5   (§8 locked)
 */
export function caseStreakMultiplier(consecutiveCorrect: number): number {
  if (consecutiveCorrect >= 4) return 1.5;
  if (consecutiveCorrect >= 2) return 1.2;
  return 1.0;
}

/** XP for a single correct answer given the in-match correct streak. */
export function caseAnswerXp(consecutiveCorrect: number): number {
  return Math.round(CASE_ANSWER_XP * caseStreakMultiplier(consecutiveCorrect));
}

// ── case-solve reward (star-gated; feeds the caseXp rank counter) ───────────
const SOLVE_XP: Record<number, number> = { 0: 0, 1: 40, 2: 80, 3: 120 };
const SOLVE_COINS: Record<number, number> = { 0: 0, 1: 8, 2: 16, 3: 24 };

export function caseSolveXp(stars: number): number {
  return SOLVE_XP[Math.max(0, Math.min(3, Math.round(stars)))] ?? 0;
}
export function caseSolveCoins(stars: number): number {
  return SOLVE_COINS[Math.max(0, Math.min(3, Math.round(stars)))] ?? 0;
}

/**
 * Star rubric (§8 locked). Pure — used by offline grading AND mirrored by the
 * `kcq_case_end_match` RPC, which recomputes this server-side so a client can
 * never self-report stars.
 *   1★  ≥50% correct
 *   2★  ≥80% correct AND ≥1 cross-reference question correct
 *   3★  100% correct AND zero hints opened
 */
export function caseStarsFor(r: {
  correct: number;
  total: number;
  crossRefCorrect: number;
  hintsUsed: boolean;
}): number {
  if (r.total <= 0) return 0;
  const pct = r.correct / r.total;
  if (pct >= 1 && !r.hintsUsed) return 3;
  if (pct >= 0.8 && r.crossRefCorrect >= 1) return 2;
  if (pct >= 0.5) return 1;
  return 0;
}

// ── Detective rank (derived purely from cumulative case-solve XP) ───────────
/** Highest rank whose threshold the given caseXp has reached. */
export function rankForCaseXp(caseXp: number): DetectiveRank {
  let current = DETECTIVE_RANKS[0];
  for (const rank of DETECTIVE_RANKS) {
    if (caseXp >= rank.minCaseXp) current = rank;
    else break;
  }
  return current;
}

/** The next rank above the current caseXp, or null if already at the top. */
export function nextRankForCaseXp(caseXp: number): DetectiveRank | null {
  return DETECTIVE_RANKS.find((r) => r.minCaseXp > caseXp) ?? null;
}
