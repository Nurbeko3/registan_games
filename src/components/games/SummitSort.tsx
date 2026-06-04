'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { GameProps } from './GameProps';

/**
 * SUMMIT SORT — Algorithm Mountain's flagship. Swap crystals until they line up
 * small → large, building a staircase the climber can scale to the summit. A
 * tactile, visual intro to sorting: fewer swaps = more stars.
 */

const ROUNDS = [5, 6, 7];

const shuffled = (n: number): number[] => {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  // guard against an already-sorted start
  if (a.every((v, i) => v === i + 1)) [a[0], a[1]] = [a[1], a[0]];
  return a;
};

export function SummitSort({ onWin }: GameProps) {
  const par = useMemo(() => ROUNDS.reduce((s, n) => s + (n - 1), 0), []);
  const [round, setRound] = useState(0);
  const n = ROUNDS[round];
  const [arr, setArr] = useState<number[]>(() => shuffled(ROUNDS[0]));
  const [sel, setSel] = useState<number | null>(null);
  const [swaps, setSwaps] = useState(0);
  const [justSorted, setJustSorted] = useState(false);

  const correct = arr.filter((v, i) => v === i + 1).length;
  const progress = correct / n;
  const sorted = correct === n;

  const tap = (i: number) => {
    if (justSorted) return;
    if (sel === null) { setSel(i); return; }
    if (sel === i) { setSel(null); return; }
    const next = [...arr];
    [next[sel], next[i]] = [next[i], next[sel]];
    setSel(null);
    setSwaps((s) => s + 1);
    setArr(next);
    if (next.every((v, idx) => v === idx + 1)) {
      setJustSorted(true);
      setTimeout(() => {
        if (round < ROUNDS.length - 1) {
          const nr = round + 1;
          setRound(nr); setArr(shuffled(ROUNDS[nr])); setJustSorted(false);
        } else {
          const total = swaps + 1;
          const stars = total <= par ? 3 : total <= Math.round(par * 1.7) ? 2 : 1;
          onWin(stars);
        }
      }, 900);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl2 bg-gradient-to-b from-[#cdeafe] to-[#a9d4f5] p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <span className="chip bg-white/70 text-sky-600">⛰️ {round + 1}/{ROUNDS.length}-cho‘qqi</span>
        <span className="chip bg-white/70 text-ink-soft">🔁 {swaps} almashtirish</span>
      </div>

      <div className="flex items-end gap-3">
        {/* climber track */}
        <div className="relative h-44 w-10 shrink-0 rounded-2xl bg-white/40">
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-xl">🚩</span>
          <motion.span
            className="absolute left-1/2 -translate-x-1/2 text-2xl"
            animate={{ bottom: `${4 + progress * 78}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 16 }}
          >🧗</motion.span>
        </div>

        {/* crystals */}
        <div className="flex flex-1 items-end justify-center gap-2 rounded-2xl bg-white/30 p-3">
          {arr.map((v, i) => {
            const placed = v === i + 1;
            return (
              <button key={i} onClick={() => tap(i)} disabled={justSorted}
                className="group flex flex-col items-center justify-end" style={{ height: 150 }}>
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  animate={sel === i ? { y: -8 } : { y: 0 }}
                  className={`grid w-9 place-items-end justify-center rounded-t-lg pb-1 font-display text-sm font-extrabold text-white shadow-card transition sm:w-11 ${
                    sel === i ? 'ring-4 ring-sun' : placed ? 'ring-2 ring-mint' : ''
                  } ${placed ? 'bg-gradient-to-t from-mint-600 to-mint' : 'bg-gradient-to-t from-grape-600 to-grape'}`}
                  style={{ height: 26 + v * 16 }}
                >
                  {placed ? '✓' : v}
                </motion.div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-center text-sm font-bold text-ink-soft">
        {justSorted ? '🎉 Zinapoya tayyor — alpinist chiqdi!' : '⬆️ Ikki kristalni bosib joyini almashtir. Kichikdan kattaga tartibla!'}
      </p>
      <p className="mt-1 text-center text-[11px] text-ink-faint">Kamroq almashtirish = ⭐⭐⭐</p>
    </div>
  );
}
