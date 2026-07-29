'use client';

import { motion } from 'framer-motion';
import { STUDENT_RANKS, nextStudentRank, studentRankForLevel } from '@/lib/studentRanks';
import { useT } from '@/lib/i18n';

export function StudentRankCard({ level }: { level: number }) {
  const t = useT();
  const current = studentRankForLevel(level);
  const next = nextStudentRank(level);
  const levelsInRank = current.maxLevel === null ? 1 : current.maxLevel - current.minLevel + 1;
  const progress = current.maxLevel === null
    ? 100
    : Math.min(100, Math.max(0, ((level - current.minLevel + 1) / levelsInRank) * 100));

  return (
    <section className="mt-5 overflow-hidden rounded-xl2 bg-white shadow-card ring-1 ring-grape-100">
      <div className={`bg-gradient-to-r ${current.color} p-5 text-white`}>
        <p className="text-xs font-extrabold uppercase tracking-wide text-white/80">{t('rank.current')}</p>
        <div className="mt-2 flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/20 text-4xl ring-1 ring-white/30">
            {current.emoji}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-extrabold">{t(current.titleKey)}</h2>
            <p className="mt-0.5 text-sm font-bold text-white/85">
              {t('rank.levelRange', {
                from: current.minLevel,
                to: current.maxLevel ?? `${level}+`,
              })}
            </p>
            <p className="mt-1 text-sm text-white/80">{t(current.descriptionKey)}</p>
          </div>
        </div>

        {next && (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 text-xs font-bold">
              <span>{t('rank.next', { rank: t(next.titleKey) })}</span>
              <span>{t('rank.levelLeft', { n: next.minLevel - level })}</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/20">
              <motion.div
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                className="h-full rounded-full bg-white"
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="font-display text-sm font-extrabold text-ink-soft">{t('rank.path')}</p>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {STUDENT_RANKS.map((rank) => {
            const reached = level >= rank.minLevel;
            const active = rank.id === current.id;
            return (
              <div
                key={rank.id}
                className={`flex min-w-0 flex-col items-center rounded-xl px-1 py-2 text-center ${
                  active ? 'bg-grape-50 ring-2 ring-grape' : reached ? 'bg-mint/10' : 'bg-cloud opacity-55'
                }`}
                aria-current={active ? 'step' : undefined}
              >
                <span className="text-xl" aria-hidden>{rank.emoji}</span>
                <span className="mt-1 w-full truncate text-[10px] font-extrabold">{t(rank.titleKey)}</span>
                <span className="text-[9px] font-bold text-ink-faint">{rank.minLevel}+</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
