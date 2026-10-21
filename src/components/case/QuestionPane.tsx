'use client';

import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';
import type { CaseQuestion } from '@/data/cases/types';
import { ChoiceList } from './ChoiceList';

/**
 * The question panel. Shows the prompt + answer choices. After the player locks
 * an answer (`revealed`), correct/incorrect states show and the evidence passage
 * is revealed in the SourcesPane (the teaching moment) — Bot Practice / solo only.
 */
export function QuestionPane({
  question,
  index,
  total,
  selected,
  revealed,
  onSelect,
  onSubmit,
  onNext,
}: {
  question: CaseQuestion;
  index: number;
  total: number;
  selected: number | null;
  revealed: boolean;
  onSelect: (choice: number) => void;
  onSubmit: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const correctIndex = question.answerIndex;
  const gotIt = revealed && selected === correctIndex;

  return (
    <div className="card flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand ring-1 ring-inset ring-brand-100">
            <Icon name="help" className="h-4 w-4" />
          </span>
          <p className="eyebrow">{t('case.questionN', { n: index + 1, total })}</p>
        </div>
        <div className="flex items-center gap-1" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`h-1.5 w-4 rounded-full ${i < index ? 'bg-brand' : i === index ? 'bg-brand-300' : 'bg-border'}`} />
          ))}
        </div>
      </div>

      <p className="font-display text-lg font-extrabold leading-snug tracking-tight text-fg sm:text-xl">{question.prompt}</p>

      <ChoiceList
        choices={question.choices}
        selected={selected}
        correctIndex={revealed ? correctIndex : null}
        locked={revealed}
        onSelect={onSelect}
      />

      {revealed && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-bold ${
            gotIt ? 'border-success-100 bg-success-50 text-success-700' : 'border-danger-100 bg-danger-50 text-danger-700'
          }`}
          role="status"
        >
          <Icon name={gotIt ? 'checkCircle' : 'eye'} className="h-4 w-4 shrink-0" />
          <span>{gotIt ? t('case.correct') : t('case.incorrect')}</span>
          <span className="ml-auto text-xs font-semibold opacity-80">{t('case.evidence')}</span>
        </div>
      )}

      <div className="mt-auto">
        {!revealed ? (
          <button type="button" disabled={selected === null} onClick={onSubmit} className="btn-primary w-full">
            {t('case.submit')}
          </button>
        ) : (
          <button type="button" onClick={onNext} className="btn-primary w-full">
            {t('case.next')}
            <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
