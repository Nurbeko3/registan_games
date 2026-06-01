'use client';

import { motion } from 'framer-motion';

export function Stat({ icon, value, label }: { icon: string; value: number | string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-card" title={label}>
      <span aria-hidden>{icon}</span>
      <span className="font-display font-extrabold tabular-nums">{value}</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ProgressBar({ pct, className = 'bg-grape', track = 'bg-grape-100' }: { pct: number; className?: string; track?: string }) {
  return (
    <div className={`h-3 w-full overflow-hidden rounded-full ${track}`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className={`h-full rounded-full ${className}`}
      />
    </div>
  );
}

export function Stars({ count, size = 'text-2xl' }: { count: number; size?: string }) {
  return (
    <div className={`flex gap-1 ${size}`} aria-label={`${count} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15 * i, type: 'spring', stiffness: 300 }}
        >
          {i <= count ? '⭐' : '☆'}
        </motion.span>
      ))}
    </div>
  );
}

export function Chip({ children, className = 'bg-cloud text-ink-faint' }: { children: React.ReactNode; className?: string }) {
  return <span className={`chip ${className}`}>{children}</span>;
}
