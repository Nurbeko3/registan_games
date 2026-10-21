'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import type { GameProps } from './GameProps';
import { playSfx } from '@/lib/sound';

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
      playSfx('success');
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
    <div className="card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="chip bg-info-50 text-info-700"><Icon name="mountain" className="h-3.5 w-3.5" /> {round + 1}/{ROUNDS.length}-cho‘qqi</span>
        <span className="chip bg-surface-2 text-fg-soft tabular-nums"><Icon name="refresh" className="h-3.5 w-3.5" /> {swaps} almashtirish</span>
      </div>

      <div className="flex items-end gap-3 rounded-xl border border-border bg-gradient-to-b from-info-50 to-surface-2 p-3">
        {/* climber track */}
        <div className="relative h-44 w-10 shrink-0 rounded-lg border border-border bg-surface">
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-base" aria-hidden>🚩</span>
          <motion.span
            className="absolute left-1/2 -translate-x-1/2 text-2xl"
            animate={{ bottom: `${4 + progress * 78}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 16 }}
            aria-hidden
          >🧗</motion.span>
        </div>

        {/* crystals */}
        <div className="flex flex-1 items-end justify-center gap-2 border-b-2 border-border-strong pb-0">
          {arr.map((v, i) => {
            const placed = v === i + 1;
            return (
              <button key={i} type="button" onClick={() => tap(i)} disabled={justSorted} aria-pressed={sel === i}
                className="group flex flex-col items-center justify-end rounded-md" style={{ height: 150 }}>
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  animate={sel === i ? { y: -8 } : { y: 0 }}
                  className={`grid w-9 place-items-end justify-center rounded-t-md pb-1 font-display text-sm font-extrabold tabular-nums text-white shadow-xs transition sm:w-11 ${
                    sel === i ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-surface' : ''
                  } ${placed ? 'bg-success-500' : 'bg-brand'}`}
                  style={{ height: 26 + v * 16 }}
                >
                  {placed ? <Icon name="check" className="h-4 w-4" /> : v}
                </motion.div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-center text-sm font-semibold text-fg-soft" aria-live="polite">
        {justSorted ? 'Zinapoya tayyor — alpinist chiqdi!' : 'Ikki kristalni bosib joyini almashtir. Kichikdan kattaga tartibla!'}
      </p>
      <p className="mt-1 text-center text-xs text-fg-faint">{sorted ? '' : 'Kamroq almashtirish = ko‘proq yulduz'}</p>
    </div>
  );
}
