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
      <p className="text-center text-xl font-extrabold text-ink-soft">{t('mg.memory.instr')}</p>
      <div className="mx-auto mt-5 grid w-full max-w-lg grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <motion.button
            key={c.id}
            onClick={() => flip(i)}
            whileTap={{ scale: 0.92 }}
            className={`grid aspect-square place-items-center rounded-2xl text-5xl shadow-card transition ${
              c.flipped || c.matched ? 'bg-white' : 'bg-grape text-grape'
            } ${c.matched ? 'opacity-60 ring-2 ring-mint' : ''}`}
          >
            <motion.span animate={{ rotateY: c.flipped || c.matched ? 0 : 180 }}>
              {c.flipped || c.matched ? c.icon : '❓'}
            </motion.span>
          </motion.button>
        ))}
      </div>
      <p className="mt-4 text-center text-lg font-extrabold text-ink-faint">{t('mg.memory.moves', { n: moves })}</p>
    </div>
  );
}
