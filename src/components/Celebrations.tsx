'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useGame, type Celebration, type LevelCelebration } from '@/store/useGame';
import { Confetti } from '@/components/ui/Confetti';
import { useEffect } from 'react';
import { playSfx } from '@/lib/sound';
import { useT } from '@/lib/i18n';
import { isRankPromotion, studentRankForLevel } from '@/lib/studentRanks';

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
  // One cue per celebration card as it appears (level-up fanfare vs unlock chime).
  useEffect(() => {
    if (!current) return;
    playSfx(isLevelCelebration(current) ? 'levelUp' : 'unlock');
  }, [current]);
  const isLevel = current ? isLevelCelebration(current) : false;
  const currentLevel = current && isLevelCelebration(current) ? current.level : null;
  const promoted = currentLevel !== null && isRankPromotion(currentLevel);
  const levelRank = currentLevel !== null ? studentRankForLevel(currentLevel) : null;
  const emoji = !current ? '' : isLevelCelebration(current) ? levelRank!.emoji : current.emoji;
  const label = !current ? '' : isLevelCelebration(current) ? t(promoted ? 'rank.promoted' : 'level.unlocked') : t('ach.unlocked');
  const title = !current ? '' : isLevelCelebration(current) ? t('level.title', { n: current.level }) : t(current.titleKey);
  const body = !current ? '' : isLevelCelebration(current)
    ? t(promoted ? 'rank.promotedBody' : 'level.body', { rank: levelRank ? t(levelRank.titleKey) : '' })
    : t(current.descriptionKey);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.code}
          className="fixed inset-0 z-[60] grid place-items-center bg-fg/40 p-5 backdrop-blur-[2px]"
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
            initial={shouldReduceMotion ? {} : { scale: 0.96, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={shouldReduceMotion ? {} : { scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="card w-full max-w-xs !p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-4xl ring-1 ring-inset ring-amber-200"
              initial={shouldReduceMotion ? false : { scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.05 }}
              aria-hidden
            >
              {emoji}
            </motion.div>
            <p className="eyebrow mt-4 text-brand">
              {label}
            </p>
            <h2 className="mt-1 font-display text-xl font-extrabold text-fg">
              {title}
            </h2>
            {isLevel && levelRank && (
              <p className="mt-1 font-display text-base font-bold text-brand">{t(levelRank.titleKey)}</p>
            )}
            <p className="mt-1.5 text-sm text-fg-soft">
              {body}
            </p>
            {!isLevel && <p className="badge-warning mt-3 inline-flex">{t('ach.reward')}</p>}
            <button
              className="btn-primary mt-5 w-full"
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
