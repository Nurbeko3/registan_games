'use client';

import { Icon } from '@/components/ui/Icon';

/**
 * Answer-choice buttons, shared by offline Bot Practice (QuestionPane) and the
 * realtime room. `correctIndex` is null until the answer is revealed; when set,
 * the correct option turns green and a wrong pick turns red.
 */
export function ChoiceList({
  choices,
  selected,
  correctIndex,
  locked,
  onSelect,
}: {
  choices: string[];
  selected: number | null;
  correctIndex: number | null;
  locked: boolean;
  onSelect: (i: number) => void;
}) {
  const revealed = correctIndex !== null;
  return (
    <ul className="space-y-2" role="listbox" aria-activedescendant={selected !== null ? `choice-${selected}` : undefined}>
      {choices.map((choice, i) => {
        const isSelected = selected === i;
        const isCorrect = i === correctIndex;
        let tone = 'border-border bg-surface text-fg hover:border-border-strong hover:bg-surface-2';
        let letter = 'bg-surface-2 text-fg-soft';
        if (revealed) {
          if (isCorrect) { tone = 'border-success-300 bg-success-50 text-success-700 ring-2 ring-success-200'; letter = 'bg-success-600 text-white'; }
          else if (isSelected) { tone = 'border-danger-300 bg-danger-50 text-danger-700 ring-2 ring-danger-200'; letter = 'bg-danger-500 text-white'; }
          else tone = 'border-border bg-surface text-fg-faint opacity-60';
        } else if (isSelected) {
          tone = 'border-brand bg-brand-50 text-brand-700 ring-2 ring-brand';
          letter = 'bg-brand text-white';
        }
        return (
          <li key={i} id={`choice-${i}`} role="option" aria-selected={isSelected}>
            <button
              type="button"
              disabled={locked}
              onClick={() => onSelect(i)}
              aria-pressed={isSelected}
              className={`flex min-h-[3rem] w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-default ${tone}`}
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md font-display text-xs font-bold ${letter}`}>
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{choice}</span>
              {revealed && isCorrect && <Icon name="checkCircle" className="h-5 w-5 shrink-0" />}
              {revealed && isSelected && !isCorrect && <Icon name="x" className="h-5 w-5 shrink-0" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
