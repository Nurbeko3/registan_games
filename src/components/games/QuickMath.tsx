'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import type { GameProps } from './GameProps';

interface Q { prompt: string; answer: number; options: number[] }

function makeQuestion(): Q {
  const kind = Math.floor(Math.random() * 3);
  let prompt: string;
  let answer: number;
  if (kind === 0) {
    const a = 1 + Math.floor(Math.random() * 9);
    const b = 1 + Math.floor(Math.random() * 9);
    prompt = `${a} + ${b}`;
    answer = a + b;
  } else if (kind === 1) {
    const a = 5 + Math.floor(Math.random() * 10);
    const b = 1 + Math.floor(Math.random() * a);
    prompt = `${a} − ${b}`;
    answer = a - b;
  } else {
    const step = 2 + Math.floor(Math.random() * 3);
    const start = 1 + Math.floor(Math.random() * 5);
    prompt = `${start}, ${start + step}, ${start + step * 2}, ?`;
    answer = start + step * 3;
  }
  const opts = new Set<number>([answer]);
  while (opts.size < 4) opts.add(Math.max(0, answer + (Math.floor(Math.random() * 7) - 3)));
  return { prompt, answer, options: [...opts].sort(() => Math.random() - 0.5) };
}

const TOTAL = 6;

/** Fast arithmetic & sequences — tap the right answer before time runs out. */
export function QuickMath({ onWin }: GameProps) {
  const questions = useMemo(() => Array.from({ length: TOTAL }, makeQuestion), []);
  const [step, setStep] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [time, setTime] = useState(0);
  const [flash, setFlash] = useState<'ok' | 'no' | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => setTime((t) => t + 0.1), 100);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const q = questions[step];

  const answer = (n: number) => {
    if (flash) return;
    const ok = n === q.answer;
    setFlash(ok ? 'ok' : 'no');
    if (ok) setCorrect((c) => c + 1);
    setTimeout(() => {
      setFlash(null);
      if (step + 1 >= TOTAL) {
        if (timer.current) clearInterval(timer.current);
        const finalCorrect = correct + (ok ? 1 : 0);
        const stars = finalCorrect >= 6 && time < 20 ? 3 : finalCorrect >= 4 ? 2 : 1;
        onWin(stars);
      } else {
        setStep((s) => s + 1);
      }
    }, 350);
  };

  return (
    <div className="card text-center">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="chip bg-surface-2 text-fg-soft tabular-nums"><Icon name="timer" className="h-3.5 w-3.5" /> {time.toFixed(1)}s</span>
        <span className="chip bg-surface-2 text-fg-soft tabular-nums">{step + 1}/{TOTAL}</span>
        <span className="chip bg-success-50 text-success-700 tabular-nums"><Icon name="check" className="h-3.5 w-3.5" /> {correct}</span>
      </div>
      <motion.p
        key={step}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mt-5 font-display text-4xl font-extrabold tabular-nums tracking-tight text-fg sm:text-5xl"
      >
        {q.prompt}
      </motion.p>
      <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3">
        {q.options.map((opt) => (
          <motion.button
            key={opt}
            type="button"
            onClick={() => answer(opt)}
            whileTap={{ scale: 0.96 }}
            className={`grid h-20 place-items-center rounded-xl border font-display text-3xl font-extrabold tabular-nums transition ${
              flash === 'ok' && opt === q.answer
                ? 'border-success-300 bg-success-50 text-success-700'
                : flash === 'no' && opt !== q.answer
                  ? 'border-border bg-surface opacity-60'
                  : 'border-border bg-surface text-fg hover:border-brand-300 hover:bg-brand-50'
            }`}
          >
            {opt}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
