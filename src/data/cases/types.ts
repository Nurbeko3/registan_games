/**
 * Case Files — content model (data-driven, mirrors src/data/games.ts + codecaster).
 *
 * A `CaseDef` is a fictional detective case: a small set of FICTIONAL source
 * documents + questions whose answers are found by READING and cross-referencing
 * those sources. There are NO real people and NO real personal data — this is a
 * reading-comprehension game, not a snoop-on-people game (see docs/find-info-about-me).
 *
 * `answerIndex` is the answer key. Offline (Bot Practice) the client grades
 * locally against it. In cloud multiplayer the keys are seeded server-side into
 * `kcq_case_answers` and the client is shipped the answer-less `PublicCase`
 * projection (see `publicCase`) so a kid with devtools can't peek the answers.
 */

export type CaseGradeBand = '7-9' | '10-12' | '13-14';
export type CaseSubject = 'reading' | 'history' | 'science' | 'logic';

/** The kind of fictional document a clue is presented as (drives the UI skin). */
export type SourceKind = 'profileCard' | 'chatLog' | 'email' | 'note' | 'ticket';

export interface SourceDoc {
  id: string;
  kind: SourceKind;
  title: string;
  /** Fictional body text. Markdown-lite (newlines preserved). No real personal data. */
  body: string;
}

/**
 * Reading-comprehension question concept (powers the post-MVP skill tree and the
 * 2★/3★ gates). `crossRef` = answer requires reconciling two sources; `inference`
 * = answer is implied, not stated verbatim.
 */
export type QuestionConcept = 'literal' | 'crossRef' | 'inference';

export interface CaseQuestion {
  id: string;
  prompt: string;
  choices: string[];
  /** Answer key — index into `choices`. SERVER-SEED; stripped from `PublicCase`. */
  answerIndex: number;
  /** Which source contains the evidence (drives the post-answer "here's where" moment). */
  evidenceSourceId: string;
  /** The exact passage from the evidence source to highlight after answering. */
  evidencePassage: string;
  concept: QuestionConcept;
}

export interface CaseDef {
  id: string;
  title: string;
  gradeBand: CaseGradeBand;
  subject: CaseSubject;
  /** Short setup shown before the investigation phase. */
  briefing: string;
  sources: SourceDoc[];
  questions: CaseQuestion[];
  /** Marks the case eligible for the daily rotation (retention loop). */
  isDaily?: boolean;
}

/** A question with the answer key removed — safe to ship to multiplayer clients. */
export type PublicQuestion = Omit<CaseQuestion, 'answerIndex' | 'evidencePassage'>;
/** A case with all answer keys + evidence passages stripped (cloud client bundle). */
export type PublicCase = Omit<CaseDef, 'questions'> & { questions: PublicQuestion[] };

/** Strip answer keys + evidence passages so the case can be sent to clients safely. */
export function publicCase(c: CaseDef): PublicCase {
  return {
    ...c,
    questions: c.questions.map(({ answerIndex: _a, evidencePassage: _e, ...q }) => {
      void _a; void _e;
      return q;
    }),
  };
}

/** Count of questions in a case that require cross-referencing two sources. */
export function crossRefCount(c: CaseDef): number {
  return c.questions.filter((q) => q.concept === 'crossRef').length;
}
