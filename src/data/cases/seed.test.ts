/**
 * Migration seed ↔ TS source consistency guard.
 *
 * The server seeds answer keys into `kcq_case_answers` (migration 0011); the
 * offline Bot Practice grader uses the TS `answerIndex`. If these ever drift,
 * a cloud match would grade differently from offline — a correctness/anti-cheat
 * hazard (QA). This test parses the migration's seed rows and asserts every
 * (case_id, question_index, answer_index, is_cross_ref) tuple matches CASES.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CASES } from './index';

const SQL = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/0011_case_files.sql'),
  'utf8',
);

/** Parse `('case01', 0, 1, false)` tuples from the seed block. */
function parseSeed(): Map<string, { answerIndex: number; isCrossRef: boolean }> {
  const map = new Map<string, { answerIndex: number; isCrossRef: boolean }>();
  const re = /\('(case\d+)',\s*(\d+),\s*(\d+),\s*(true|false)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(SQL)) !== null) {
    map.set(`${m[1]}:${m[2]}`, { answerIndex: Number(m[3]), isCrossRef: m[4] === 'true' });
  }
  return map;
}

describe('0011 seed answer keys match the TS case source', () => {
  const seed = parseSeed();

  it('parsed a non-trivial number of seed rows', () => {
    const expected = CASES.reduce((n, c) => n + c.questions.length, 0);
    expect(seed.size).toBe(expected);
  });

  for (const c of CASES) {
    c.questions.forEach((q, i) => {
      it(`${c.id} q${i}: answer + cross-ref flag match the migration seed`, () => {
        const row = seed.get(`${c.id}:${i}`);
        expect(row, `missing seed row for ${c.id}:${i}`).toBeDefined();
        expect(row!.answerIndex).toBe(q.answerIndex);
        expect(row!.isCrossRef).toBe(q.concept === 'crossRef');
      });
    });
  }
});
