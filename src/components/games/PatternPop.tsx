'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { GameProps } from './GameProps';

const PADS = [
  { color: 'bg-grape', lit: 'bg-grape-400' },
  { color: 'bg-mango', lit: 'bg-sun' },
  { color: 'bg-mint', lit: 'bg-mint-600' },
  { color: 'bg-sky', lit: 'bg-sky-600' },
];
const TARGET = 6; // sequence length to win

/** Simon-style memory game: watch the sequence light up, then repeat it. */
export function PatternPop({ onWin }: GameProps) {
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
        setMsg('Oops! Nice memory though 🧠');
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
      <p className="font-bold text-ink-soft">
        {phase === 'idle' && 'Watch the colors, then tap them in the same order!'}
        {phase === 'watch' && '👀 Watch closely…'}
        {phase === 'play' && `🎯 Your turn! (${seq.length} in the pattern)`}
      </p>

      <div className="mx-auto mt-4 grid max-w-[260px] grid-cols-2 gap-3">
        {PADS.map((pad, i) => (
          <motion.button
            key={i}
            onClick={() => tap(i)}
            whileTap={{ scale: 0.92 }}
            disabled={phase !== 'play'}
            className={`aspect-square rounded-2xl shadow-card transition-colors ${lit === i ? pad.lit : pad.color} ${lit === i ? 'brightness-125' : ''} ${phase === 'play' ? '' : 'opacity-80'}`}
            aria-label={`Pad ${i + 1}`}
          />
        ))}
      </div>

      {msg && <p className="mt-3 text-sm font-bold text-bubble-600">{msg}</p>}
      {phase === 'idle' && !msg && <button onClick={begin} className="btn-primary mt-4">▶ Start</button>}
      {phase === 'idle' && msg && <button onClick={begin} className="btn-ghost mt-3">↺ Try again</button>}
    </div>
  );
}
