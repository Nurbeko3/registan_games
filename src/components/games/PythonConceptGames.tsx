'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronRight, X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { GameProps } from './GameProps';
import { playSfx } from '@/lib/sound';

interface Question {
  promptKey: string;
  explanationKey: string;
  code: string[];
  options: string[];
  optionKeys?: string[];
  answer: number;
}

interface ConceptGameProps extends GameProps {
  accent: string;
  questions: Question[];
}

const VARIABLES: Question[] = [
  {
    promptKey: 'mg.pyvars.q1.prompt',
    explanationKey: 'mg.pyvars.q1.explain',
    code: ['score = 5', 'score = score + 3', 'print(score)'],
    options: ['5', '8', '53'],
    answer: 1,
  },
  {
    promptKey: 'mg.pyvars.q2.prompt',
    explanationKey: 'mg.pyvars.q2.explain',
    code: ['name = "Ali"', 'print("Hello, " + name)'],
    options: ['Hello, name', 'Ali', 'Hello, Ali'],
    answer: 2,
  },
  {
    promptKey: 'mg.pyvars.q3.prompt',
    explanationKey: 'mg.pyvars.q3.explain',
    code: ['coins = 10', 'coins -= 4', 'print(coins)'],
    options: ['6', '14', '4'],
    answer: 0,
  },
  {
    promptKey: 'mg.pyvars.q4.prompt',
    explanationKey: 'mg.pyvars.q4.explain',
    code: ['width = 3', 'height = 4', 'area = width * height', 'print(area)'],
    options: ['7', '12', '34'],
    answer: 1,
  },
  {
    promptKey: 'mg.pyvars.q5.prompt',
    explanationKey: 'mg.pyvars.q5.explain',
    code: ['hero = "Pip"', 'hero = "Nova"', 'print(hero)'],
    options: ['Pip', 'Nova', 'PipNova'],
    answer: 1,
  },
];

const CONDITIONS: Question[] = [
  {
    promptKey: 'mg.pyif.q1.prompt',
    explanationKey: 'mg.pyif.q1.explain',
    code: ['age = 10', 'if age >= 8:', '    print("allowed")'],
    options: ['allowed', '—', '8'],
    answer: 0,
  },
  {
    promptKey: 'mg.pyif.q2.prompt',
    explanationKey: 'mg.pyif.q2.explain',
    code: ['score = 6', 'if score > 7:', '    print("great")', 'else:', '    print("keep going")'],
    options: ['great', 'keep going', '6'],
    answer: 1,
  },
  {
    promptKey: 'mg.pyif.q3.prompt',
    explanationKey: 'mg.pyif.q3.explain',
    code: ['key = True', 'door_open = False', 'if key and not door_open:', '    print("open door")'],
    options: ['open door', 'False', '—'],
    answer: 0,
  },
  {
    promptKey: 'mg.pyif.q4.prompt',
    explanationKey: 'mg.pyif.q4.explain',
    code: ['lives = 0', 'if lives == 0:', '    print("restart")', 'else:', '    print("play")'],
    options: ['play', '0', 'restart'],
    answer: 2,
  },
  {
    promptKey: 'mg.pyif.q5.prompt',
    explanationKey: 'mg.pyif.q5.explain',
    code: ['weather = "sunny"', 'if weather == "rainy":', '    print("umbrella")', 'elif weather == "sunny":', '    print("cap")'],
    options: ['umbrella', 'cap', '—'],
    answer: 1,
  },
];

const LISTS: Question[] = [
  {
    promptKey: 'mg.pylist.q1.prompt',
    explanationKey: 'mg.pylist.q1.explain',
    code: ['colors = ["red", "green", "blue"]', 'print(colors[0])'],
    options: ['red', 'green', 'blue'],
    answer: 0,
  },
  {
    promptKey: 'mg.pylist.q2.prompt',
    explanationKey: 'mg.pylist.q2.explain',
    code: ['coins = [2, 5, 3]', 'print(len(coins))'],
    options: ['10', '3', '5'],
    answer: 1,
  },
  {
    promptKey: 'mg.pylist.q3.prompt',
    explanationKey: 'mg.pylist.q3.explain',
    code: ['team = ["Ali", "Lola"]', 'team.append("Bek")', 'print(team)'],
    options: ['["Ali", "Lola"]', '["Bek", "Ali", "Lola"]', '["Ali", "Lola", "Bek"]'],
    answer: 2,
  },
  {
    promptKey: 'mg.pylist.q4.prompt',
    explanationKey: 'mg.pylist.q4.explain',
    code: ['points = [4, 7, 2]', 'points[1] = 9', 'print(points)'],
    options: ['[4, 9, 2]', '[9, 7, 2]', '[4, 7, 9]'],
    answer: 0,
  },
  {
    promptKey: 'mg.pylist.q5.prompt',
    explanationKey: 'mg.pylist.q5.explain',
    code: ['items = ["key", "map", "apple"]', 'for item in items:', '    print(item)'],
    options: ['mg.pylist.q5.a1', 'mg.pylist.q5.a2', 'mg.pylist.q5.a3'],
    optionKeys: ['mg.pylist.q5.a1', 'mg.pylist.q5.a2', 'mg.pylist.q5.a3'],
    answer: 1,
  },
];

function PythonConceptGame({ onWin, accent, questions }: ConceptGameProps) {
  const t = useT();
  const rounds = useMemo(() => questions, [questions]);
  const [step, setStep] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const question = rounds[step];
  const answered = picked !== null;
  const correct = picked === question.answer;

  const choose = (index: number) => {
    if (answered) return;
    setPicked(index);
    playSfx(index === question.answer ? 'success' : 'error');
    if (index !== question.answer) setMistakes((value) => value + 1);
  };

  const next = () => {
    if (step === rounds.length - 1) {
      const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
      onWin(stars);
      return;
    }
    setStep((value) => value + 1);
    setPicked(null);
  };

  return (
    <section className="card overflow-hidden !p-0">
      <div className={`h-1 bg-gradient-to-r ${accent}`} />
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">
            {t('mg.python.step', { current: step + 1, total: rounds.length })}
          </p>
          <div className="flex gap-1" aria-hidden>
            {rounds.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  index < step ? 'bg-success-500' : index === step ? 'bg-brand' : 'bg-border'
                }`}
              />
            ))}
          </div>
        </div>

        <h2 className="mt-4 font-display text-lg font-extrabold text-fg sm:text-xl">
          {t(question.promptKey)}
        </h2>

        <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-fg p-4 font-mono text-[15px] leading-7 text-success-300 dark:bg-bg-subtle sm:text-base">
          <code>{question.code.join('\n')}</code>
        </pre>

        <div className="mt-4 grid gap-3">
          {question.options.map((option, index) => {
            const isAnswer = index === question.answer;
            const isPicked = index === picked;
            const state = !answered
              ? 'border-border bg-surface text-fg hover:border-brand-300 hover:bg-brand-50'
              : isAnswer
                ? 'border-success-300 bg-success-50 text-success-700'
                : isPicked
                  ? 'border-danger-300 bg-danger-50 text-danger-700'
                  : 'border-border bg-surface text-fg-faint opacity-60';
            return (
              <motion.button
                key={option}
                type="button"
                whileTap={{ scale: 0.985 }}
                disabled={answered}
                onClick={() => choose(index)}
                className={`flex min-h-14 items-center justify-between rounded-xl border px-4 py-3 text-left font-mono text-[15px] font-bold transition sm:text-base ${state}`}
              >
                <span className="min-w-0 break-words">{question.optionKeys ? t(option) : option}</span>
                {answered && isAnswer && <Check className="ml-3 h-5 w-5 shrink-0" aria-hidden />}
                {answered && isPicked && !isAnswer && <X className="ml-3 h-5 w-5 shrink-0" aria-hidden />}
              </motion.button>
            );
          })}
        </div>

        {answered && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 rounded-xl border p-4 ${correct ? 'border-success-100 bg-success-50' : 'border-amber-200 bg-amber-50'}`}
            role="status"
          >
            <p className={`font-display font-extrabold ${correct ? 'text-success-700' : 'text-amber-800'}`}>
              {correct ? t('mg.python.correct') : t('mg.python.learn')}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-fg-soft">{t(question.explanationKey)}</p>
            <button type="button" onClick={next} className="btn-primary mt-4 w-full sm:w-auto">
              {step === rounds.length - 1 ? t('mg.python.finish') : t('mg.python.next')}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </motion.div>
        )}
      </div>
    </section>
  );
}

export function VariableVault(props: GameProps) {
  return <PythonConceptGame {...props} accent="from-info-500 to-info-600" questions={VARIABLES} />;
}

export function IfElseQuest(props: GameProps) {
  return <PythonConceptGame {...props} accent="from-warning-500 to-warning-600" questions={CONDITIONS} />;
}

export function ListLab(props: GameProps) {
  return <PythonConceptGame {...props} accent="from-brand-500 to-brand-600" questions={LISTS} />;
}
