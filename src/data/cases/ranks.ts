/**
 * Detective ranks — the visible identity layer for Case Files.
 *
 * Data-driven, like achievements: rank is a PURE derived value from cumulative
 * case-solve XP (`caseXp`), never a stored numeric field. See `rankForCaseXp`
 * in src/lib/caseLeveling.ts. Thresholds are locked in 00-BRIEF.md §GDD-4.1.
 *
 * `caseXp` is a SEPARATE counter from the global XP so Arena/Codecaster grinding
 * can never inflate a Detective rank (and vice-versa).
 */

export interface DetectiveRank {
  index: number;
  id: string;
  /** i18n key for the display name (strings added in the i18n pass / INC 9). */
  nameKey: string;
  /** Fallback English name (used until i18n strings land). */
  name: string;
  emoji: string;
  /** Minimum cumulative case-solve XP to hold this rank. */
  minCaseXp: number;
}

export const DETECTIVE_RANKS: DetectiveRank[] = [
  { index: 0, id: 'cadet',        nameKey: 'case.rank.cadet',        name: 'Cadet',              emoji: '🔰', minCaseXp: 0 },
  { index: 1, id: 'rookie',       nameKey: 'case.rank.rookie',       name: 'Rookie Detective',   emoji: '🕵️', minCaseXp: 150 },
  { index: 2, id: 'junior',       nameKey: 'case.rank.junior',       name: 'Junior Detective',   emoji: '🔎', minCaseXp: 400 },
  { index: 3, id: 'sergeant',     nameKey: 'case.rank.sergeant',     name: 'Detective Sergeant', emoji: '🎖️', minCaseXp: 800 },
  { index: 4, id: 'senior',       nameKey: 'case.rank.senior',       name: 'Senior Detective',   emoji: '🏅', minCaseXp: 1500 },
  { index: 5, id: 'lead',         nameKey: 'case.rank.lead',         name: 'Lead Investigator',  emoji: '⭐', minCaseXp: 2800 },
  { index: 6, id: 'chief',        nameKey: 'case.rank.chief',        name: 'Chief Inspector',    emoji: '👑', minCaseXp: 5000 },
  { index: 7, id: 'master',       nameKey: 'case.rank.master',       name: 'Master Sleuth',      emoji: '🧠', minCaseXp: 9000 },
];

export function getRankById(id: string): DetectiveRank | undefined {
  return DETECTIVE_RANKS.find((r) => r.id === id);
}
