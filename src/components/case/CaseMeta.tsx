'use client';

import { useT } from '@/lib/i18n';
import type { CaseGradeBand, CaseSubject } from '@/data/cases/types';

/** Minimal shape shared by `CaseDef` and the answer-less `PublicCase`. */
export interface CaseMetaLike {
  gradeBand: CaseGradeBand;
  subject: CaseSubject;
  questions: readonly unknown[];
}

const SUBJECT_TONE: Record<CaseSubject, string> = {
  reading: 'badge-brand',
  history: 'badge-warning',
  science: 'badge-success',
  logic: 'badge bg-violet-50 text-violet-700',
};

/** Grade band + subject + question-count badges for a case row/card. */
export function CaseMetaBadges({ caseDef, className = '' }: { caseDef: CaseMetaLike; className?: string }) {
  const t = useT();
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="badge-neutral">{t('case.gradeBand', { band: caseDef.gradeBand })}</span>
      <span className={SUBJECT_TONE[caseDef.subject]}>{t(`case.subject.${caseDef.subject}`)}</span>
      <span className="text-2xs font-semibold text-fg-faint">{t('case.qCount', { n: caseDef.questions.length })}</span>
    </div>
  );
}
