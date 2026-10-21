'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';
import { Icon } from '@/components/ui/Icon';
import type { GameProps } from './GameProps';
import { playSfx } from '@/lib/sound';

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
      playSfx(d === 0 ? 'success' : 'tick');
      if (d === 0) {
        setFound(true);
        const digs = Object.keys(next).length;
        const stars = digs <= 3 ? 3 : digs <= 5 ? 2 : 1;
        setTimeout(() => onWin(stars), 700);
      }
    },
    [dug, found, onWin, treasure],
  );

  // heat: closer = warmer
  const heat = (d: number) =>
    d === 0
      ? 'border-amber-400 bg-amber-400 text-fg'
      : d <= 1
        ? 'border-danger-200 bg-danger-100 text-danger-700'
        : d <= 2
          ? 'border-warning-200 bg-warning-100 text-warning-700'
          : d <= 3
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-info-200 bg-info-50 text-info-700';

  return (
    <div className="card">
      <p className="text-center text-sm font-semibold text-fg-soft">
        {t('mg.treasure.instr')} <span className="font-bold text-amber-600">{t('mg.treasure.found')}</span>
      </p>
      <div className="mx-auto mt-5 grid w-full max-w-md grid-cols-5 gap-2 rounded-xl border border-border bg-surface-2 p-2">
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const x = i % SIZE;
          const y = Math.floor(i / SIZE);
          const key = `${x},${y}`;
          const d = dug[key];
          const open = d !== undefined;
          return (
            <motion.button
              key={key}
              type="button"
              onClick={() => dig(x, y)}
              whileTap={{ scale: 0.94 }}
              aria-label={open ? (d === 0 ? t('mg.treasure.found') : `${d}`) : `${x + 1},${y + 1}`}
              className={`grid aspect-square place-items-center rounded-lg border font-display text-xl font-extrabold tabular-nums transition ${
                open ? heat(d) : 'border-border bg-surface text-fg-faint hover:border-brand-300 hover:bg-brand-50'
              }`}
            >
              {open ? (d === 0 ? <Icon name="gem" className="h-6 w-6" /> : d) : <span className="h-2 w-2 rounded-full bg-border-strong" />}
            </motion.button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs font-semibold text-fg-faint">Digs: {Object.keys(dug).length} · fewer digs = more stars</p>
    </div>
  );
}
