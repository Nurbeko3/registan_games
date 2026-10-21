'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';
import type { GameProps } from './GameProps';

const ICONS = ['🤖', '💾', '🐍', '⚙️', '🔢', '💡', '🚀', '🧩'];

interface Card { id: number; icon: string; flipped: boolean; matched: boolean }

function shuffle(): Card[] {
  return [...ICONS, ...ICONS]
    .map((icon, i) => ({ icon, id: i, flipped: false, matched: false }))
    .sort(() => Math.random() - 0.5)
    .map((c, i) => ({ ...c, id: i }));
}

export function MemoryMatch({ onWin }: GameProps) {
  const t = useT();
  const initial = useMemo(shuffle, []);
  const [cards, setCards] = useState<Card[]>(initial);
  const [picks, setPicks] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);

  const flip = useCallback(
    (idx: number) => {
      if (busy || cards[idx].flipped || cards[idx].matched) return;
      const next = cards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));
      const open = [...picks, idx];
      setCards(next);
      setPicks(open);

      if (open.length === 2) {
        setMoves((m) => m + 1);
        setBusy(true);
        const [a, b] = open;
        const match = next[a].icon === next[b].icon;
        setTimeout(() => {
          const resolved = next.map((c, i) =>
            i === a || i === b ? { ...c, matched: match, flipped: match } : c,
          );
          setCards(resolved);
          setPicks([]);
          setBusy(false);
          if (resolved.every((c) => c.matched)) {
            const m = moves + 1;
            const stars = m <= 10 ? 3 : m <= 14 ? 2 : 1;
            setTimeout(() => onWin(stars), 500);
          }
        }, 700);
      }
    },
    [busy, cards, picks, moves, onWin],
  );

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-fg-soft">{t('mg.memory.instr')}</p>
        <span className="chip bg-surface-2 text-fg-soft tabular-nums">{t('mg.memory.moves', { n: moves })}</span>
      </div>
      <div className="mx-auto mt-4 grid w-full max-w-lg grid-cols-4 gap-2 rounded-xl border border-border bg-surface-2 p-2 sm:gap-3 sm:p-3">
        {cards.map((c, i) => {
          const face = c.flipped || c.matched;
          return (
            <motion.button
              key={c.id}
              type="button"
              onClick={() => flip(i)}
              whileTap={{ scale: 0.94 }}
              aria-label={face ? c.icon : 'Hidden card'}
              className={`grid aspect-square place-items-center rounded-xl border text-4xl transition sm:text-5xl ${
                face ? 'border-border bg-surface' : 'border-brand-600 bg-brand text-white shadow-sm hover:bg-brand-600'
              } ${c.matched ? 'border-success-300 bg-success-50 opacity-80' : ''}`}
            >
              <motion.span animate={{ rotateY: face ? 0 : 180 }} className="select-none">
                {face ? c.icon : <span className="block h-3 w-3 rounded-full bg-white/60" />}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
