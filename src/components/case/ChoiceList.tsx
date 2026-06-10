'use client';

import { Icon } from '@/components/ui/Icon';

/**
 * Answer-choice buttons, shared by offline Bot Practice (QuestionPane) and the
 * realtime room. `correctIndex` is null until the answer is revealed; when set,
 * the correct option turns green and a wrong pick turns pink.
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
    <ul className="space-y-2">
      {choices.map((choice, i) => {
        const isSelected = selected === i;
        const isCorrect = i === correctIndex;
        let tone = 'border-grape-100 bg-white text-ink-soft hover:border-grape-400 hover:shadow-card';
        if (revealed) {
          if (isCorrect) tone = 'border-mint bg-mint/15 text-ink';
          else if (isSelected) tone = 'border-bubble bg-bubble/10 text-ink';
          else tone = 'border-grape-100/60 bg-white/60 text-ink-faint';
        } else if (isSelected) {
          tone = 'border-grape-400 bg-grape-50 text-ink shadow-card';
        }
        return (
          <li key={i}>
            <button
              type="button"
              disabled={locked}
              onClick={() => onSelect(i)}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape disabled:cursor-default ${tone}`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-grape-50 font-display text-sm font-extrabold text-grape">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{choice}</span>
              {revealed && isCorrect && <Icon name="check" className="h-5 w-5 text-mint-600" />}
              {revealed && isSelected && !isCorrect && <Icon name="x" className="h-5 w-5 text-bubble" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
