'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';
import { Icon } from '@/components/ui/Icon';
import type { GameProps } from './GameProps';
import { playSfx } from '@/lib/sound';

/** Tap the numbers from smallest to largest as fast as you can. Teaches sorting. */
export function AlgorithmRace({ onWin }: GameProps) {
  const tr = useT();
  const numbers = useMemo(() => {
    const set = new Set<number>();
    while (set.size < 8) set.add(1 + Math.floor(Math.random() * 99));
    return [...set];
  }, []);
  const sorted = useMemo(() => [...numbers].sort((a, b) => a - b), [numbers]);

  const [next, setNext] = useState(0);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [wrong, setWrong] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const start = () => {
    setStarted(true);
    timer.current = setInterval(() => setTime((t) => t + 0.1), 100);
  };

  const tap = (n: number) => {
    if (!started) return;
    if (n === sorted[next]) {
      const newNext = next + 1;
      setNext(newNext);
      setWrong(false);
      playSfx('tick');
      if (newNext === sorted.length) {
        if (timer.current) clearInterval(timer.current);
        const stars = time < 6 ? 3 : time < 10 ? 2 : 1;
        setTimeout(() => onWin(stars), 300);
      }
    } else {
      setWrong(true);
      playSfx('error');
      setTime((t) => t + 1); // penalty
    }
  };

  return (
    <div className="card text-center">
      {!started ? (
        <div className="py-6">
          <p className="text-sm font-semibold text-fg-soft">{tr('mg.race.instr')}</p>
          <button type="button" onClick={start} className="btn-primary btn-lg mt-5">
            <Icon name="play" className="h-4 w-4" /> {tr('mg.race.start')}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="chip bg-surface-2 text-fg-soft tabular-nums">
              <Icon name="timer" className="h-3.5 w-3.5" /> {time.toFixed(1)}s
            </span>
            <span className="chip bg-brand-50 text-brand-700">
              {tr('mg.race.next')} <span className="font-display text-sm tabular-nums">{sorted[next] ?? '✓'}</span>
            </span>
          </div>
          {wrong && <p className="mt-2 text-sm font-bold text-danger">{tr('mg.race.oops')}</p>}
          <div className="mx-auto mt-5 grid max-w-md grid-cols-4 gap-2 sm:gap-3">
            {numbers.map((n) => {
              const done = sorted.indexOf(n) < next;
              return (
                <motion.button
                  key={n}
                  type="button"
                  onClick={() => tap(n)}
                  disabled={done}
                  whileTap={{ scale: 0.94 }}
                  className={`grid aspect-square place-items-center rounded-xl border font-display text-2xl font-extrabold tabular-nums transition sm:text-3xl ${
                    done
                      ? 'border-success-200 bg-success-50 text-success-600'
                      : 'border-border bg-surface text-fg hover:border-brand-300 hover:bg-brand-50'
                  }`}
                >
                  {done ? <Icon name="check" className="h-6 w-6" /> : n}
                </motion.button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
