'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/store/useGame';

const COLORS = ['#7C5CFC', '#FF9F43', '#FF7AB6', '#22C55E', '#3BA7FF', '#FFD43B'];

/** Lightweight CSS/Framer confetti burst — no canvas, no dependency. */
export function Confetti({ count = 40 }: { count?: number }) {
  const reduced = useGame((s) => s.settings.reducedMotion);
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.3,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
        size: 6 + Math.random() * 8,
      })),
    [count],
  );

  if (reduced) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 rounded-sm"
          style={{ left: `${p.x}%`, width: p.size, height: p.size, background: p.color }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: '105vh', rotate: p.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: 1.8 + Math.random(), delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}
