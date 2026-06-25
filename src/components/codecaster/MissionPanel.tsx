'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { Stars } from '@/components/ui/Bits';
import { useGame, useHydrated } from '@/store/useGame';
import { useT } from '@/lib/i18n';
import type { CodecasterLevel } from '@/data/codecaster/types';

/**
 * Collapsible mission brief shown at the top of the code pane:
 * title, objective, "Today: <concept>" badge, star requirements, and the
 * student's current best for this level (from the store, hydration-safe).
 */
export function MissionPanel({ level }: { level: CodecasterLevel }) {
  const t = useT();
  const shouldReduceMotion = useReducedMotion();
  const hydrated = useHydrated();
  const best = useGame((s) => s.codecaster[level.id]?.stars ?? 0);
  const [open, setOpen] = useState(true);

  const isBoss = level.victory.defeatBoss === true;

  return (
    <div className="card !p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape focus-visible:ring-offset-2"
      >
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white ${
            isBoss ? 'bg-gradient-to-br from-bubble to-grape' : 'bg-gradient-to-br from-sky to-grape'
          }`}
        >
          <Icon name={isBoss ? 'crown' : 'sword'} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-extrabold text-ink">{t(level.title)}</p>
          <p className="truncate text-xs font-bold text-ink-faint">{level.id} · {t(level.objective)}</p>
        </div>
        {hydrated && best > 0 && (
          <span className="shrink-0"><Stars count={best} size="text-base" /></span>
        )}
        <Icon name={open ? 'unlock' : 'lock'} className="h-4 w-4 shrink-0 text-ink-faint" />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={shouldReduceMotion ? { height: 'auto' } : { height: 0, opacity: 0 }}
            animate={shouldReduceMotion ? { height: 'auto' } : { height: 'auto', opacity: 1 }}
            exit={shouldReduceMotion ? { height: 'auto' } : { height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-grape-100/60 px-4 py-3">
              <p className="text-sm font-bold leading-relaxed text-ink-soft">{t(level.objective)}</p>

              <div className="flex flex-wrap items-center gap-2">
                <span className="chip bg-sky/15 text-sky-600">
                  <Icon name="brain" className="h-4 w-4" /> {t('cc.todayConcept', { concept: t(level.concept) })}
                </span>
                {isBoss && (
                  <span className="chip bg-bubble/15 text-bubble-600">
                    <Icon name="crown" className="h-4 w-4" /> {t('cc.bossLevel')}
                  </span>
                )}
              </div>

              <div className="rounded-xl2 bg-cloud/70 px-3 py-2.5">
                <p className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">{t('cc.starGoals')}</p>
                <ul className="mt-1.5 space-y-1 text-sm font-bold text-ink-soft">
                  <li className="flex items-center gap-1.5"><Stars count={1} size="text-xs" /> {t('cc.star1')}</li>
                  <li className="flex items-center gap-1.5"><Stars count={2} size="text-xs" /> {t('cc.star2', { par: level.parSteps })}</li>
                  <li className="flex items-center gap-1.5"><Stars count={3} size="text-xs" /> {t('cc.star3', { concept: t(level.concept) })}</li>
                </ul>
              </div>

              {hydrated && (
                <p className="text-xs font-bold text-ink-faint">
                  {best > 0 ? t('cc.bestStars', { n: best }) : t('cc.noAttemptYet')}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
