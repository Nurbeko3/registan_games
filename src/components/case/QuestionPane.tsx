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
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-grape to-bubble text-white">
          <Icon name="search" className="h-5 w-5" />
        </span>
        <p className="font-display text-xs font-extrabold uppercase tracking-wide text-ink-faint">
          {t('case.questionN', { n: index + 1, total })}
        </p>
      </div>

      <p className="font-display text-lg font-extrabold leading-snug text-ink">{question.prompt}</p>

      <ChoiceList
        choices={question.choices}
        selected={selected}
        correctIndex={revealed ? correctIndex : null}
        locked={revealed}
        onSelect={onSelect}
      />

      {revealed && (
        <div
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 font-display text-sm font-extrabold ${
            gotIt ? 'bg-mint/15 text-mint-600' : 'bg-bubble/10 text-bubble'
          }`}
          role="status"
        >
          <Icon name={gotIt ? 'check' : 'eye'} className="h-5 w-5" />
          {gotIt ? t('case.correct') : t('case.incorrect')}
          <span className="ml-1 font-bold text-ink-faint">· {t('case.evidence')} <span aria-hidden="true">👉</span></span>
        </div>
      )}

      <div className="mt-auto">
        {!revealed ? (
          <button
            type="button"
            disabled={selected === null}
            onClick={onSubmit}
            className="btn-primary w-full disabled:opacity-50"
          >
            {t('case.submit')}
          </button>
        ) : (
          <button type="button" onClick={onNext} className="btn-primary w-full">
            {t('case.next')} <Icon name="rocket" className="ml-1 h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
