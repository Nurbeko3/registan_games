'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';
import type { GameProps } from './GameProps';

const BITS = [16, 8, 4, 2, 1]; // 5-bit → 0..31

export function BinaryChallenge({ onWin }: GameProps) {
  const t = useT();
  const target = useMemo(() => 1 + Math.floor(Math.random() * 31), []);
  const [bits, setBits] = useState<boolean[]>([false, false, false, false, false]);
  const [tries, setTries] = useState(0);
  const [shake, setShake] = useState(false);

  const value = bits.reduce((sum, on, i) => sum + (on ? BITS[i] : 0), 0);

  const toggle = (i: number) => setBits((b) => b.map((v, idx) => (idx === i ? !v : v)));

  const check = useCallback(() => {
    setTries((t) => t + 1);
    if (value === target) {
      const stars = tries === 0 ? 3 : tries <= 2 ? 2 : 1;
      onWin(stars);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }, [value, target, tries, onWin]);

  return (
    <div className="card text-center">
      <p className="font-bold text-ink-soft">{t('mg.binary.instr')}</p>
      <p className="mt-1 font-display text-5xl font-extrabold text-grape">{target}</p>

      <motion.div animate={shake ? { x: [-8, 8, -6, 6, 0] } : {}} className="mt-6 flex justify-center gap-3">
        {BITS.map((bit, i) => (
          <button
            key={bit}
            onClick={() => toggle(i)}
            className={`grid h-20 w-16 place-items-center rounded-2xl font-display text-3xl font-extrabold shadow-card transition ${
              bits[i] ? 'bg-grape text-white' : 'bg-white text-ink-faint'
            }`}
          >
            {bits[i] ? 1 : 0}
            <span className="mt-0.5 block text-[10px] font-bold opacity-70">{bit}</span>
          </button>
        ))}
      </motion.div>

      <p className="mt-4 font-display text-lg font-extrabold">
        {t('arena.q.your')} <span className={value === target ? 'text-mint' : 'text-bubble-600'}>{value}</span>
      </p>
      <button onClick={check} className="btn-primary mt-3 w-full">{t('mg.check')}</button>
      <p className="mt-3 text-lg font-extrabold text-ink-faint">{t('mg.binary.tries', { n: tries })}</p>
    </div>
  );
}
