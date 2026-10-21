'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';
import { Icon } from '@/components/ui/Icon';
import type { GameProps } from './GameProps';

interface Puzzle { lines: string[]; bug: number; fix: string }

const PUZZLES: Puzzle[] = [
  { lines: ['let score = 0', 'score = score + 10', 'print(scor)'], bug: 2, fix: 'Typo! It should be "score", not "scor".' },
  { lines: ['for i in range(3)', '    print(i)'], bug: 0, fix: 'Missing ":" at the end of the for line.' },
  { lines: ['if x = 5:', '    print("five")'], bug: 0, fix: 'Use "==" to compare, not "=".' },
  { lines: ['name = "Aziz"', 'print("Hi " + nme)'], bug: 1, fix: 'Typo — "nme" should be "name".' },
  { lines: ['x = 10', 'y = 0', 'result = x / y', 'print(result)'], bug: 2, fix: "Can't divide by zero! Change y to a non-zero number." },
  { lines: ['def greet(name)', '    print("Hi " + name)'], bug: 0, fix: 'Function def needs ":" at the end — "def greet(name):".' },
  { lines: ['colors = ["red", "blue", "green"]', 'print(colors[3])'], bug: 1, fix: 'List index 3 is out of range! Lists start at 0, so max index is 2.' },
  { lines: ['while True', '    print("loop!")'], bug: 0, fix: 'Missing ":" — should be "while True:".' },
  { lines: ['total = 0', 'for n in [1, 2, 3]:', '    total = total - n', 'print(total)'], bug: 2, fix: 'Should add, not subtract! Change "-" to "+".' },
  { lines: ['age = "15"', 'if age > 10:', '    print("Teen!")'], bug: 1, fix: '"age" is a string, not a number. Use age = 15 (no quotes).' },
  { lines: ['def square(n):', '    return n * n', 'print(square)'], bug: 2, fix: 'Missing parentheses! Call the function: print(square(4)).' },
  { lines: ['fruits = ["apple", "banana"]', 'fruits.appnd("cherry")', 'print(fruits)'], bug: 1, fix: 'Typo in method name — "appnd" should be "append".' },
];

export function FixTheBug({ onWin }: GameProps) {
  const t = useT();
  const order = useMemo(
    () => [...Array(PUZZLES.length).keys()].sort(() => Math.random() - 0.5).slice(0, 5),
    [],
  );
  const [step, setStep] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const puzzle = PUZZLES[order[step]];

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const correct = i === puzzle.bug;
    if (!correct) setWrong((w) => w + 1);
    setTimeout(() => {
      if (step + 1 >= order.length) {
        const totalWrong = wrong + (correct ? 0 : 1);
        const stars = totalWrong === 0 ? 3 : totalWrong <= 1 ? 2 : 1;
        onWin(stars);
      } else {
        setStep((s) => s + 1);
        setPicked(null);
      }
    }, 1100);
  };

  const ok = picked !== null && picked === puzzle.bug;

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-fg-soft">{t('mg.bug.instr')}</p>
        <span className="chip bg-brand-50 text-brand-700 tabular-nums">{step + 1}/{order.length}</span>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-fg p-1.5 font-mono text-[15px] dark:bg-bg-subtle">
        {puzzle.lines.map((line, i) => {
          const isBug = i === puzzle.bug;
          const state =
            picked === null
              ? 'text-success-300 hover:bg-white/[0.06]'
              : isBug
                ? 'bg-success-500/25 text-success-200'
                : i === picked
                  ? 'bg-danger-500/25 text-danger-200'
                  : 'text-success-300/60';
          return (
            <motion.button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={picked !== null}
              whileHover={{ x: picked === null ? 3 : 0 }}
              className={`flex w-full items-center gap-4 rounded-lg px-3 py-3 text-left transition ${state}`}
            >
              <span className="w-4 select-none text-right text-white/25">{i + 1}</span>
              <span className="whitespace-pre">{line}</span>
            </motion.button>
          );
        })}
      </div>
      {picked !== null && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          className={`mt-4 flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm font-medium ${
            ok ? 'border-success-100 bg-success-50 text-success-700' : 'border-danger-100 bg-danger-50 text-danger-700'
          }`}
        >
          <Icon name={ok ? 'checkCircle' : 'warning'} className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{puzzle.fix}</span>
        </motion.div>
      )}
    </div>
  );
}
