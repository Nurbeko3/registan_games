'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';
import type { GameProps } from './GameProps';

const PADS = [
  { color: 'bg-brand', lit: 'bg-brand-300' },
  { color: 'bg-warning-500', lit: 'bg-amber-300' },
  { color: 'bg-success-500', lit: 'bg-success-300' },
  { color: 'bg-info-500', lit: 'bg-info-300' },
];
const TARGET = 6; // sequence length to win

/** Simon-style memory game: watch the sequence light up, then repeat it. */
export function PatternPop({ onWin }: GameProps) {
  const t = useT();
  const [seq, setSeq] = useState<number[]>([]);
  const [lit, setLit] = useState<number | null>(null);
  const [phase, setPhase] = useState<'idle' | 'watch' | 'play'>('idle');
  const [pos, setPos] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  const playback = useCallback(async (full: number[]) => {
    setPhase('watch');
    await new Promise((r) => setTimeout(r, 500));
    for (const pad of full) {
      setLit(pad);
      await new Promise((r) => setTimeout(r, 450));
      setLit(null);
      await new Promise((r) => setTimeout(r, 200));
    }
    setPos(0);
    setPhase('play');
  }, []);

  const begin = useCallback(() => {
    const first = [Math.floor(Math.random() * 4)];
    setSeq(first);
    setMsg(null);
    void playback(first);
  }, [playback]);

  const tap = useCallback(
    (pad: number) => {
      if (phase !== 'play') return;
      if (pad !== seq[pos]) {
        // mistake → reward by how far they got
        const len = seq.length;
        const stars = len >= 5 ? 3 : len >= 3 ? 2 : 1;
        setMsg(t('mg.pattern.oops'));
        setPhase('idle');
        setTimeout(() => onWin(stars), 800);
        return;
      }
      if (pos + 1 === seq.length) {
        if (seq.length >= TARGET) {
          onWin(3);
          return;
        }
        const next = [...seq, Math.floor(Math.random() * 4)];
        setSeq(next);
        void playback(next);
      } else {
        setPos((p) => p + 1);
      }
    },
    [phase, seq, pos, onWin, playback],
  );

  return (
    <div className="card text-center">
      <p className="text-sm font-semibold text-fg-soft" aria-live="polite">
        {phase === 'idle' && t('mg.pattern.idle')}
        {phase === 'watch' && t('mg.pattern.watch')}
        {phase === 'play' && t('mg.pattern.turn', { n: seq.length })}
      </p>

      <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3 rounded-xl border border-border bg-surface-2 p-3">
        {PADS.map((pad, i) => (
          <motion.button
            key={i}
            type="button"
            onClick={() => tap(i)}
            whileTap={{ scale: 0.95 }}
            disabled={phase !== 'play'}
            className={`aspect-square min-h-28 rounded-xl shadow-xs transition-[background-color,opacity,filter] duration-150 ${lit === i ? pad.lit : pad.color} ${
              lit === i ? 'brightness-110 ring-4 ring-white/60' : ''
            } ${phase === 'play' ? 'hover:brightness-105' : 'opacity-75'}`}
            aria-label={`Pad ${i + 1}`}
          />
        ))}
      </div>

      {msg && <p className="mt-3 text-sm font-bold text-danger">{msg}</p>}
      {phase === 'idle' && !msg && <button type="button" onClick={begin} className="btn-primary mt-4">{t('mg.start')}</button>}
      {phase === 'idle' && msg && <button type="button" onClick={begin} className="btn-secondary mt-3">{t('mg.tryAgain')}</button>}
    </div>
  );
}
