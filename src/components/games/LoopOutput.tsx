'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';
import type { GameProps } from './GameProps';

interface Round { code: string[]; options: string[]; answer: number }

const ALL_ROUNDS: Round[] = [
  { code: ['for i in range(3):', '    print("Hi")'], options: ['Hi Hi Hi', 'Hi', '3'], answer: 0 },
  { code: ['x = 2', 'x = x + 3', 'print(x)'], options: ['23', '5', '2'], answer: 1 },
  { code: ['for n in [1,2,3]:', '    print(n * 2)'], options: ['2 4 6', '1 2 3', '6'], answer: 0 },
  { code: ['count = 0', 'for i in range(4):', '    count = count + 1', 'print(count)'], options: ['0', '4', '10'], answer: 1 },
  { code: ['x = 10', 'if x > 5:', '    print("big")', 'else:', '    print("small")'], options: ['small', 'big', 'nothing'], answer: 1 },
  { code: ['result = 1', 'for i in range(3):', '    result = result * 2', 'print(result)'], options: ['6', '8', '3'], answer: 1 },
  { code: ['word = "code"', 'print(word[0])'], options: ['code', 'c', 'd'], answer: 1 },
  { code: ['total = 0', 'nums = [3, 7, 2]', 'for n in nums:', '    total = total + n', 'print(total)'], options: ['12', '3', '7'], answer: 0 },
  { code: ['for i in range(5):', '    if i == 3:', '        print(i)'], options: ['3', '5', '0 1 2 3 4'], answer: 0 },
  { code: ['name = "Zara"', 'print("Hello, " + name + "!")'], options: ['Hello, Zara!', 'Hello, name!', 'Hello!'], answer: 0 },
];

export function LoopOutput({ onWin }: GameProps) {
  const t = useT();
  const rounds = useMemo(
    () => [...ALL_ROUNDS].sort(() => Math.random() - 0.5).slice(0, 5),
    [],
  );
  const [step, setStep] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const round = rounds[step];

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const correct = i === round.answer;
    if (!correct) setWrong((w) => w + 1);
    setTimeout(() => {
      if (step + 1 >= rounds.length) {
        const totalWrong = wrong + (correct ? 0 : 1);
        onWin(totalWrong === 0 ? 3 : totalWrong <= 1 ? 2 : 1);
      } else {
        setStep((s) => s + 1);
        setPicked(null);
      }
    }, 1000);
  };

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-fg-soft">{t('mg.loop.instr')}</p>
        <span className="chip bg-brand-50 text-brand-700 tabular-nums">{step + 1}/{rounds.length}</span>
      </div>
      <CodeBlock lines={round.code} />
      <div className="mt-4 grid gap-2">
        {round.options.map((opt, i) => {
          const state =
            picked === null
              ? 'border-border bg-surface hover:border-brand-300 hover:bg-brand-50'
              : i === round.answer
                ? 'border-success-300 bg-success-50 text-success-700'
                : i === picked
                  ? 'border-danger-300 bg-danger-50 text-danger-700'
                  : 'border-border bg-surface opacity-60';
          return (
            <motion.button
              key={i}
              type="button"
              onClick={() => choose(i)}
              whileTap={{ scale: 0.99 }}
              disabled={picked !== null}
              className={`rounded-xl border p-4 text-center font-mono text-lg font-bold transition ${state}`}
            >
              {opt}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/** Dark code listing used by the "what will it print" style games. */
export function CodeBlock({ lines, className = '' }: { lines: string[]; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-border bg-fg p-4 font-mono text-[15px] leading-relaxed text-success-300 dark:border-border dark:bg-bg-subtle ${className}`}>
      {lines.map((line, i) => (
        <div key={i} className="flex gap-4 whitespace-pre">
          <span className="w-4 select-none text-right text-white/25">{i + 1}</span>
          <span>{line}</span>
        </div>
      ))}
    </div>
  );
}
