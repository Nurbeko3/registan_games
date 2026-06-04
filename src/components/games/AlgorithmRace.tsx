'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';
import type { GameProps } from './GameProps';

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
      if (newNext === sorted.length) {
        if (timer.current) clearInterval(timer.current);
        const stars = time < 6 ? 3 : time < 10 ? 2 : 1;
        setTimeout(() => onWin(stars), 300);
      }
    } else {
      setWrong(true);
      setTime((t) => t + 1); // penalty
    }
  };

  return (
    <div className="card text-center">
      {!started ? (
        <div className="py-6">
          <p className="font-bold text-ink-soft">{tr('mg.race.instr')}</p>
          <button onClick={start} className="btn-primary mt-4 text-lg">{tr('mg.race.start')}</button>
        </div>
      ) : (
        <>
          <p className="font-display text-lg font-extrabold">⏱️ {time.toFixed(1)}s · {tr('mg.race.next')} <span className="text-grape">{sorted[next] ?? '🎉'}</span></p>
          {wrong && <p className="text-sm font-bold text-bubble-600">{tr('mg.race.oops')}</p>}
          <div className="mx-auto mt-5 grid max-w-md grid-cols-4 gap-3">
            {numbers.map((n) => {
              const done = sorted.indexOf(n) < next;
              return (
                <motion.button
                  key={n}
                  onClick={() => tap(n)}
                  disabled={done}
                  whileTap={{ scale: 0.9 }}
                  className={`grid aspect-square min-h-20 place-items-center rounded-2xl font-display text-3xl font-extrabold shadow-card ${
                    done ? 'bg-mint/30 text-mint-600' : 'bg-white hover:bg-grape-50'
                  }`}
                >
                  {done ? '✓' : n}
                </motion.button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
