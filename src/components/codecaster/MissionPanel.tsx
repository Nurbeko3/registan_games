'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { Stars } from '@/components/ui/Bits';
import { useGame, useHydrated } from '@/store/useGame';
import { useT } from '@/lib/i18n';
import type { CodecasterLevel } from '@/data/codecaster/types';

/**
 * Mission brief body: objective, "Today: <concept>" badge, star goals and the
 * student's current best (hydration-safe). Rendered inside the collapsible
 * `MissionPanel` on phones and inside the Code Studio side panel / README tab
 * on desktop (`compact`).
 */
export function MissionBrief({ level, compact = false }: { level: CodecasterLevel; compact?: boolean }) {
  const t = useT();
  const hydrated = useHydrated();
  const best = useGame((s) => s.codecaster[level.id]?.stars ?? 0);
  const isBoss = level.victory.defeatBoss === true;

  return (
    <div className={compact ? 'space-y-3' : 'grid gap-4 md:grid-cols-[1fr_auto] md:items-start'}>
      <div className="min-w-0">
        {compact && (
          <div className="mb-2 flex items-center gap-2">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${isBoss ? 'bg-violet-50 text-violet-600 ring-violet-100' : 'bg-brand-50 text-brand ring-brand-100'}`}>
              <Icon name={isBoss ? 'crown' : 'sword'} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-extrabold text-fg">{t(level.title)}</p>
              <p className="font-mono text-2xs text-fg-faint">{level.id}</p>
            </div>
          </div>
        )}
        <p className="text-sm leading-relaxed text-fg-soft">{t(level.objective)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="badge-brand">
            <Icon name="brain" className="h-3 w-3" /> {t('cc.todayConcept', { concept: t(level.concept) })}
          </span>
          {isBoss && (
            <span className="badge bg-violet-50 text-violet-700">
              <Icon name="crown" className="h-3 w-3" /> {t('cc.bossLevel')}
            </span>
          )}
          {hydrated && (
            <span className="badge-neutral">
              {best > 0 ? t('cc.bestStars', { n: best }) : t('cc.noAttemptYet')}
            </span>
          )}
        </div>
      </div>

      <div className={`rounded-xl border border-border bg-surface px-3.5 py-3 ${compact ? '' : 'md:min-w-[260px]'}`}>
        <p className="eyebrow">{t('cc.starGoals')}</p>
        <ul className="mt-2 space-y-1.5 text-xs font-semibold text-fg-soft">
          <li className="flex items-center gap-2"><Stars count={1} size="text-xs" /> {t('cc.star1')}</li>
          <li className="flex items-center gap-2"><Stars count={2} size="text-xs" /> {t('cc.star2', { par: level.parSteps })}</li>
          <li className="flex items-center gap-2"><Stars count={3} size="text-xs" /> {t('cc.star3', { concept: t(level.concept) })}</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Collapsible mission card (phone/tablet layout): title row + `MissionBrief`.
 */
export function MissionPanel({ level }: { level: CodecasterLevel }) {
  const t = useT();
  const shouldReduceMotion = useReducedMotion();
  const hydrated = useHydrated();
  const best = useGame((s) => s.codecaster[level.id]?.stars ?? 0);
  const [open, setOpen] = useState(true);
  const isBoss = level.victory.defeatBoss === true;

  return (
    <div className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${
            isBoss ? 'bg-violet-50 text-violet-600 ring-violet-100' : 'bg-brand-50 text-brand ring-brand-100'
          }`}
        >
          <Icon name={isBoss ? 'crown' : 'sword'} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-extrabold text-fg">{t(level.title)}</p>
          <p className="truncate text-xs font-semibold text-fg-faint">
            <span className="font-mono">{level.id}</span> · {t(level.objective)}
          </p>
        </div>
        {hydrated && best > 0 && (
          <span className="hidden shrink-0 sm:block"><Stars count={best} size="text-sm" /></span>
        )}
        <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-fg-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={shouldReduceMotion ? { height: 'auto' } : { height: 0, opacity: 0 }}
            animate={shouldReduceMotion ? { height: 'auto' } : { height: 'auto', opacity: 1 }}
            exit={shouldReduceMotion ? { height: 'auto' } : { height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 py-4">
              <MissionBrief level={level} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
