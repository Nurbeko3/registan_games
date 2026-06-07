'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useGame, type Celebration, type LevelCelebration } from '@/store/useGame';
import { Confetti } from '@/components/ui/Confetti';
import { useT } from '@/lib/i18n';

function isLevelCelebration(c: Celebration): c is LevelCelebration {
  return 'kind' in c && c.kind === 'level';
}

/** Global overlay that pops whenever a new achievement or level is unlocked. */
export function Celebrations() {
  const t = useT();
  const shouldReduceMotion = useReducedMotion();
  const celebrations = useGame((s) => s.celebrations);
  const dismiss = useGame((s) => s.dismissCelebration);
  const current = celebrations[0];
  const isLevel = current ? isLevelCelebration(current) : false;
  const emoji = !current ? '' : isLevelCelebration(current) ? '🚀' : current.emoji;
  const label = !current ? '' : isLevelCelebration(current) ? t('level.unlocked') : t('ach.unlocked');
  const title = !current ? '' : isLevelCelebration(current) ? t('level.title', { n: current.level }) : t(current.titleKey);
  const body = !current ? '' : isLevelCelebration(current) ? t('level.body') : t(current.descriptionKey);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.code}
          className="fixed inset-0 z-[60] grid place-items-center bg-ink/40 p-5 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => dismiss(current.code)}
          role="dialog"
          aria-modal="true"
          aria-live="polite"
          aria-label={label}
        >
          <Confetti />
          <motion.div
            initial={shouldReduceMotion ? {} : { scale: 0.6, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={shouldReduceMotion ? {} : { scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="card max-w-xs text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="text-6xl"
              animate={shouldReduceMotion ? {} : { rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.8, repeat: shouldReduceMotion ? 0 : Infinity }}
              aria-hidden
            >
              {emoji}
            </motion.div>
            <p className="mt-2 font-display text-sm font-bold uppercase tracking-wide text-grape">
              {label}
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold">
              {title}
            </h2>
            <p className="mt-1 text-ink-soft">
              {body}
            </p>
            {!isLevel && <p className="mt-2 font-bold text-mango">{t('ach.reward')}</p>}
            <button
              className="btn-primary mt-4 w-full"
              onClick={() => dismiss(current.code)}
              autoFocus
            >
              {t('ach.awesome')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
