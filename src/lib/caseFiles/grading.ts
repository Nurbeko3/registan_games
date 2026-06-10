/**
 * Case Files — offline grading. Pure + framework-free.
 *
 * In Bot Practice the client grades locally against the case answer keys. In
 * cloud multiplayer the SAME rubric is recomputed server-side (migration 0011's
 * `kcq_case_end_match`) so a client can never self-report a result — this module
 * is the offline mirror, not the authority.
 */

import type { CaseDef } from '@/data/cases/types';
import { caseStarsFor } from '@/lib/caseLeveling';

export interface CaseGrade {
  perQuestionCorrect: boolean[];
  correct: number;
  total: number;
  crossRefCorrect: number;
  stars: number;
}

/**
 * Grade a finished case run. `answers[i]` is the chosen choice index for
 * question i (or null/undefined if unanswered → counted wrong). `hintsUsed`
 * gates the 3rd star.
 */
export function gradeCaseRun(
  caseDef: CaseDef,
  answers: ReadonlyArray<number | null | undefined>,
  hintsUsed: boolean,
): CaseGrade {
  const perQuestionCorrect = caseDef.questions.map((q, i) => answers[i] === q.answerIndex);
  const correct = perQuestionCorrect.filter(Boolean).length;
  const total = caseDef.questions.length;
  const crossRefCorrect = caseDef.questions.reduce(
    (n, q, i) => n + (q.concept === 'crossRef' && perQuestionCorrect[i] ? 1 : 0),
    0,
  );
  const stars = caseStarsFor({ correct, total, crossRefCorrect, hintsUsed });
  return { perQuestionCorrect, correct, total, crossRefCorrect, stars };
}

/** Longest run of consecutive correct answers (drives the streak achievement). */
export function bestStreak(perQuestionCorrect: ReadonlyArray<boolean>): number {
  let best = 0;
  let run = 0;
  for (const ok of perQuestionCorrect) {
    run = ok ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}
