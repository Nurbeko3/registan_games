/**
 * Case Files — content localisation layer.
 *
 * The canonical `CaseDef` (case01.ts … case05.ts) stays ENGLISH: it is the
 * source of truth for the SQL answer-key seed (migration 0011), the offline
 * grader (`answerIndex`), and the structural tests. This layer adds uz/ru
 * DISPLAY translations only — it never touches `answerIndex`, `concept`,
 * `evidenceSourceId`, or choice ORDER, so server-side scoring stays identical
 * across languages.
 *
 * Why this matters: the game is a READING-comprehension game whose default
 * locale is Uzbek. The UI chrome was already trilingual, but the documents and
 * questions kids actually read were English-only — so the game itself didn't
 * work in 3 languages. This layer fixes that.
 */

import type { Locale } from '@/lib/i18n/config';
import type { CaseDef } from '../types';

/** Per-source display overrides, keyed by the source's `id` (e.g. 's1'). */
export interface SourceL10n {
  title: string;
  body: string;
}

/** Per-question display overrides, keyed by the question's `id` (e.g. 'q1').
 *  `choices` MUST stay the same length & order as the canonical case so the
 *  server-seeded `answerIndex` still points at the right option.
 *  `evidencePassage` should be an exact substring of this locale's source body
 *  (used only for the Bot-Practice reveal highlight; a miss degrades to no
 *  highlight, never an error). */
export interface QuestionL10n {
  prompt: string;
  choices: string[];
  evidencePassage: string;
}

/** A full case translated for one locale. */
export interface CaseL10n {
  title: string;
  briefing: string;
  /** by source id */
  sources: Record<string, SourceL10n>;
  /** by question id */
  questions: Record<string, QuestionL10n>;
}

/** uz/ru overrides for one case (en is the canonical CaseDef, no entry needed). */
export type CaseTranslations = Partial<Record<Locale, CaseL10n>>;

/** Merge a locale's display overrides onto the canonical English case.
 *  Returns the case unchanged for `en` or when a translation is missing — the
 *  English text is always the safe fallback. Structure (ids, answerIndex,
 *  concept, choice order) is preserved exactly. */
export function applyCaseL10n(c: CaseDef, tr: CaseL10n | undefined): CaseDef {
  if (!tr) return c;
  return {
    ...c,
    title: tr.title || c.title,
    briefing: tr.briefing || c.briefing,
    sources: c.sources.map((s) => {
      const st = tr.sources[s.id];
      return st ? { ...s, title: st.title || s.title, body: st.body || s.body } : s;
    }),
    questions: c.questions.map((q) => {
      const qt = tr.questions[q.id];
      if (!qt) return q;
      // guard: never let a bad translation change the option count/order
      const choices = qt.choices.length === q.choices.length ? qt.choices : q.choices;
      return {
        ...q,
        prompt: qt.prompt || q.prompt,
        choices,
        evidencePassage: qt.evidencePassage || q.evidencePassage,
      };
    }),
  };
}
