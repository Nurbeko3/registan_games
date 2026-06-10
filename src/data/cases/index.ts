/**
 * Case Files content registry. Mirrors src/data/codecaster/levels/index.ts.
 * Adding a case = create caseNN.ts, import it here, and the cases.test.ts
 * structural validator proves it well-formed.
 */

import type { CaseDef } from './types';
import case01 from './case01';
import case02 from './case02';
import case03 from './case03';
import case04 from './case04';
import case05 from './case05';

export const CASES: CaseDef[] = [case01, case02, case03, case04, case05];

export function getCase(id: string): CaseDef | undefined {
  return CASES.find((c) => c.id === id);
}

/** Cases filtered to a grade band (used by mode setup / classroom case picker). */
export function casesForBand(band: CaseDef['gradeBand']): CaseDef[] {
  return CASES.filter((c) => c.gradeBand === band);
}

/** The daily-rotation case for a given day index (deterministic, offline-safe). */
export function dailyCaseForDay(dayIndex: number): CaseDef {
  const pool = CASES.filter((c) => c.isDaily);
  const list = pool.length > 0 ? pool : CASES;
  return list[((dayIndex % list.length) + list.length) % list.length];
}

export type { CaseDef } from './types';
