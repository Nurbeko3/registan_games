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
      <p className="eyebrow">{t('mg.binary.instr')}</p>
      <p className="mt-2 font-display text-5xl font-extrabold tabular-nums tracking-tight text-brand">{target}</p>

      <motion.div animate={shake ? { x: [-8, 8, -6, 6, 0] } : {}} className="mt-6 flex justify-center gap-2 sm:gap-3">
        {BITS.map((bit, i) => (
          <button
            key={bit}
            type="button"
            onClick={() => toggle(i)}
            aria-pressed={bits[i]}
            className={`grid h-20 w-14 place-items-center rounded-xl border font-display text-3xl font-extrabold tabular-nums transition sm:w-16 ${
              bits[i]
                ? 'border-brand bg-brand text-white shadow-sm'
                : 'border-border bg-surface text-fg-faint hover:border-border-strong hover:bg-surface-2'
            }`}
          >
            {bits[i] ? 1 : 0}
            <span className={`mt-0.5 block text-2xs font-bold ${bits[i] ? 'text-white/70' : 'text-fg-faint'}`}>{bit}</span>
          </button>
        ))}
      </motion.div>

      <p className="mt-5 font-display text-lg font-bold text-fg-soft">
        {t('arena.q.your')}{' '}
        <span className={`tabular-nums ${value === target ? 'text-success-600' : 'text-danger'}`}>{value}</span>
      </p>
      <button type="button" onClick={check} className="btn-primary mt-3 w-full">{t('mg.check')}</button>
      <p className="mt-3 text-sm font-semibold text-fg-faint">{t('mg.binary.tries', { n: tries })}</p>
    </div>
  );
}
