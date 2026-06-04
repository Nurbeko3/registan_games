'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';
import type { GameProps } from './GameProps';

const SIZE = 5;

/** Deduction game: dig tiles; each reveals its distance to the treasure.
 *  Find it in few digs for more stars. Teaches search & deduction. */
export function TreasureHunt({ onWin }: GameProps) {
  const t = useT();
  const treasure = useMemo(() => ({ x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE) }), []);
  const [dug, setDug] = useState<Record<string, number>>({});
  const [found, setFound] = useState(false);

  const dist = (x: number, y: number) => Math.abs(x - treasure.x) + Math.abs(y - treasure.y);

  const dig = useCallback(
    (x: number, y: number) => {
      if (found) return;
      const key = `${x},${y}`;
      if (dug[key] !== undefined) return;
      const d = dist(x, y);
      const next = { ...dug, [key]: d };
      setDug(next);
      if (d === 0) {
        setFound(true);
        const digs = Object.keys(next).length;
        const stars = digs <= 3 ? 3 : digs <= 5 ? 2 : 1;
        setTimeout(() => onWin(stars), 700);
      }
    },
    [dug, found, onWin, treasure],
  );

  const heat = (d: number) => (d === 0 ? 'bg-mango text-white' : d <= 1 ? 'bg-bubble/40' : d <= 2 ? 'bg-sun/40' : d <= 3 ? 'bg-mint/30' : 'bg-sky/20');

  return (
    <div className="card">
      <p className="text-center font-bold text-ink-soft">{t('mg.treasure.instr')} <span className="text-mango">{t('mg.treasure.found')}</span></p>
      <div className="mx-auto mt-5 grid w-full max-w-md grid-cols-5 gap-3">
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const x = i % SIZE;
          const y = Math.floor(i / SIZE);
          const key = `${x},${y}`;
          const d = dug[key];
          const open = d !== undefined;
          return (
            <motion.button
              key={key}
              onClick={() => dig(x, y)}
              whileTap={{ scale: 0.9 }}
              className={`grid aspect-square min-h-16 place-items-center rounded-xl font-display text-2xl font-extrabold shadow-card ${open ? heat(d) : 'bg-white hover:bg-grape-50'}`}
            >
              {open ? (d === 0 ? '💎' : d) : '⛏️'}
            </motion.button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-sm font-bold text-ink-faint">Digs: {Object.keys(dug).length} · fewer digs = more ⭐</p>
    </div>
  );
}
