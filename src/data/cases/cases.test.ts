/**
 * Case Files — content structural proof. Mirrors codecaster/levels/levels.test.ts.
 *
 * This is the authoritative guarantee that every seed case is well-formed and
 * actually solvable by reading: every question's answer key is in range, points
 * at a real source, and its evidencePassage is literally present in that source.
 * (Per docs/find-info-about-me §QA: a case with a fabricated/absent answer would
 * make the cloud answer-key seed and the offline grader disagree.)
 */

import { describe, it, expect } from 'vitest';
import { CASES, getCase, casesForBand, dailyCaseForDay } from './index';
import { publicCase, crossRefCount, type CaseGradeBand, type QuestionConcept } from './types';

const GRADE_BANDS: CaseGradeBand[] = ['7-9', '10-12', '13-14'];
const CONCEPTS: QuestionConcept[] = ['literal', 'crossRef', 'inference'];

describe('CASES — registry invariants', () => {
  it('ships at least 5 seed cases (one week of daily rotation)', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(5);
  });

  it('all case ids are unique', () => {
    const ids = CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getCase() finds each case and returns undefined for unknown ids', () => {
    for (const c of CASES) expect(getCase(c.id)).toBe(c);
    expect(getCase('nope')).toBeUndefined();
    expect(getCase('')).toBeUndefined();
  });

  it('has at least one daily-eligible case', () => {
    expect(CASES.some((c) => c.isDaily)).toBe(true);
  });

  it('covers more than one grade band', () => {
    expect(new Set(CASES.map((c) => c.gradeBand)).size).toBeGreaterThan(1);
  });
});

describe('CASES — per-case structure', () => {
  for (const c of CASES) {
    describe(`${c.id} — ${c.title}`, () => {
      it('has a valid grade band and subject', () => {
        expect(GRADE_BANDS).toContain(c.gradeBand);
        expect(['reading', 'history', 'science', 'logic']).toContain(c.subject);
      });

      it('has a non-empty briefing and at least 2 sources', () => {
        expect(c.briefing.trim().length).toBeGreaterThan(0);
        expect(c.sources.length).toBeGreaterThanOrEqual(2);
      });

      it('has unique source ids with non-empty bodies', () => {
        const ids = c.sources.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const s of c.sources) expect(s.body.trim().length).toBeGreaterThan(0);
      });

      it('has at least 3 questions with unique ids', () => {
        expect(c.questions.length).toBeGreaterThanOrEqual(3);
        const ids = c.questions.map((q) => q.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('has at least one cross-reference question (needed for the 2★ gate)', () => {
        expect(crossRefCount(c)).toBeGreaterThanOrEqual(1);
      });

      for (const q of c.questions) {
        describe(`question ${q.id}`, () => {
          it('has a valid concept and at least 2 choices', () => {
            expect(CONCEPTS).toContain(q.concept);
            expect(q.choices.length).toBeGreaterThanOrEqual(2);
            expect(new Set(q.choices).size).toBe(q.choices.length); // no duplicate options
          });

          it('answerIndex points at a real choice', () => {
            expect(q.answerIndex).toBeGreaterThanOrEqual(0);
            expect(q.answerIndex).toBeLessThan(q.choices.length);
          });

          it('evidence source exists in this case', () => {
            expect(c.sources.some((s) => s.id === q.evidenceSourceId)).toBe(true);
          });

          it('evidencePassage is literally present in its evidence source (answer is findable)', () => {
            const src = c.sources.find((s) => s.id === q.evidenceSourceId)!;
            expect(q.evidencePassage.trim().length).toBeGreaterThan(0);
            expect(src.body).toContain(q.evidencePassage);
          });
        });
      }
    });
  }
});

describe('publicCase() — answer keys never leak to clients', () => {
  for (const c of CASES) {
    it(`${c.id} strips answerIndex + evidencePassage from every question`, () => {
      const pub = publicCase(c);
      for (const q of pub.questions) {
        expect(q).not.toHaveProperty('answerIndex');
        expect(q).not.toHaveProperty('evidencePassage');
        // but keeps the readable parts
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
      }
      // serialized public case must not contain the answer-key field name
      expect(JSON.stringify(pub)).not.toContain('answerIndex');
    });
  }
});

describe('helpers', () => {
  it('casesForBand filters correctly', () => {
    for (const band of GRADE_BANDS) {
      for (const c of casesForBand(band)) expect(c.gradeBand).toBe(band);
    }
  });

  it('dailyCaseForDay is deterministic and in-range for any day index', () => {
    expect(dailyCaseForDay(0)).toBe(dailyCaseForDay(0));
    for (const d of [-3, 0, 1, 7, 365]) {
      expect(CASES).toContain(dailyCaseForDay(d));
    }
  });
});
