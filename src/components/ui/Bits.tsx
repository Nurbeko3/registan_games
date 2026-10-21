'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from './Icon';

/** Compact HUD statistic (streak, coins). */
export function Stat({ icon, value, label, tone = 'neutral' }: { icon: React.ReactNode; value: number | string; label: string; tone?: 'neutral' | 'amber' | 'warning' }) {
  const tones = { neutral: 'text-fg-soft', amber: 'text-amber-600', warning: 'text-warning-600' };
  return (
    <div
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-sm shadow-xs"
      title={label}
    >
      <span aria-hidden className={tones[tone]}>{icon}</span>
      <span className="font-display font-bold tabular-nums text-fg">{value}</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ProgressBar({
  pct,
  className = 'bg-brand',
  track = 'bg-surface-3',
  size = 'h-2',
}: {
  pct: number;
  className?: string;
  track?: string;
  size?: string;
}) {
  return (
    <div className={`${size} w-full overflow-hidden rounded-full ${track}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`h-full rounded-full ${className}`}
      />
    </div>
  );
}

export function Stars({ count, size = 'text-2xl' }: { count: number; size?: string }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className={`flex gap-0.5 ${size}`} aria-label={`${count} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <motion.span
          key={i}
          initial={shouldReduceMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={shouldReduceMotion ? {} : { scale: 1, opacity: 1 }}
          transition={{ delay: 0.08 * i, type: 'spring', stiffness: 320, damping: 18 }}
          className={i <= count ? 'text-amber-500' : 'text-border-strong'}
        >
          <Icon name="star" className="h-[1em] w-[1em] [&>path]:fill-current" />
        </motion.span>
      ))}
    </div>
  );
}

export function Chip({ children, className = 'bg-surface-2 text-fg-soft' }: { children: React.ReactNode; className?: string }) {
  return <span className={`chip ${className}`}>{children}</span>;
}
