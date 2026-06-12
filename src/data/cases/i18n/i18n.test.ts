/**
 * Case content localisation guards.
 *
 * These protect the two invariants that keep trilingual content SAFE:
 *  1. Translations never change choice count/order or any answer-affecting field
 *     → server-seeded answerIndex stays valid in every language.
 *  2. Every translated evidencePassage is an exact substring of its translated
 *     source body → the Bot-Practice reveal highlight lands on real text.
 * Plus full uz/ru coverage so no document silently falls back to English.
 */

import { describe, it, expect } from 'vitest';
import { CASES } from '../index';
import { localizeCase, CASE_TRANSLATIONS } from './index';
import type { Locale } from '@/lib/i18n/config';

const LOCALES: Locale[] = ['uz', 'ru'];

describe('case content localisation', () => {
  it('every case has uz + ru translations', () => {
    for (const c of CASES) {
      const tr = CASE_TRANSLATIONS[c.id];
      expect(tr, `no translations for ${c.id}`).toBeDefined();
      for (const loc of LOCALES) {
        expect(tr![loc], `${c.id} missing ${loc}`).toBeDefined();
      }
    }
  });

  for (const c of CASES) {
    for (const loc of LOCALES) {
      describe(`${c.id} [${loc}]`, () => {
        const localized = localizeCase(c, loc);

        it('translates every source title + body (no English left)', () => {
          const tr = CASE_TRANSLATIONS[c.id]![loc]!;
          for (const s of c.sources) {
            expect(tr.sources[s.id], `missing source ${s.id}`).toBeDefined();
            expect(tr.sources[s.id].title.length).toBeGreaterThan(0);
            expect(tr.sources[s.id].body.length).toBeGreaterThan(0);
          }
        });

        it('preserves answerIndex, concept, ids and choice count', () => {
          expect(localized.id).toBe(c.id);
          expect(localized.questions.length).toBe(c.questions.length);
          localized.questions.forEach((q, i) => {
            const canon = c.questions[i];
            expect(q.id).toBe(canon.id);
            expect(q.answerIndex).toBe(canon.answerIndex);
            expect(q.concept).toBe(canon.concept);
            expect(q.evidenceSourceId).toBe(canon.evidenceSourceId);
            expect(q.choices.length).toBe(canon.choices.length);
          });
        });

        it('every evidence passage is a substring of its localised source body', () => {
          for (const q of localized.questions) {
            const src = localized.sources.find((s) => s.id === q.evidenceSourceId);
            expect(src, `no source ${q.evidenceSourceId}`).toBeDefined();
            expect(
              src!.body.includes(q.evidencePassage),
              `${c.id}/${q.id} [${loc}]: passage not found in body:\n  passage: ${q.evidencePassage}`,
            ).toBe(true);
          }
        });

        it('translates title, briefing, and every prompt/choices set', () => {
          expect(localized.title).not.toBe('');
          expect(localized.briefing).not.toBe('');
          for (const q of localized.questions) {
            expect(q.prompt.length).toBeGreaterThan(0);
            for (const choice of q.choices) expect(choice.length).toBeGreaterThan(0);
          }
        });
      });
    }
  }

  it('en returns the canonical case unchanged', () => {
    for (const c of CASES) {
      expect(localizeCase(c, 'en')).toBe(c);
    }
  });
});
