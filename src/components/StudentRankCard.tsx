'use client';

import { STUDENT_RANKS, nextStudentRank, studentRankForLevel } from '@/lib/studentRanks';
import { ProgressBar } from '@/components/ui/Bits';
import { Icon } from '@/components/ui/Icon';
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
    <section className="card overflow-hidden !p-0">
      <div className="flex items-start gap-4 p-5">
        <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${current.color} text-3xl leading-none text-white shadow-xs`} aria-hidden>
          {current.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{t('rank.current')}</p>
          <h2 className="mt-0.5 font-display text-xl font-extrabold leading-tight text-fg">{t(current.titleKey)}</h2>
          <p className="mt-0.5 text-xs font-semibold text-fg-faint">
            {t('rank.levelRange', { from: current.minLevel, to: current.maxLevel ?? `${level}+` })}
          </p>
          <p className="mt-1.5 text-sm text-fg-soft">{t(current.descriptionKey)}</p>
        </div>
      </div>

      {next && (
        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold">
            <span className="text-fg-soft">{t('rank.next', { rank: t(next.titleKey) })}</span>
            <span className="tabular-nums text-fg-faint">{t('rank.levelLeft', { n: next.minLevel - level })}</span>
          </div>
          <ProgressBar pct={progress} className="mt-2 bg-brand" />
        </div>
      )}

      <div className="border-t border-border px-5 py-4">
        <p className="eyebrow">{t('rank.path')}</p>
        <ol className="scrollbar-none -mx-5 mt-3 flex items-start gap-1 overflow-x-auto px-5 pb-1">
          {STUDENT_RANKS.map((rank, i) => {
            const reached = level >= rank.minLevel;
            const active = rank.id === current.id;
            return (
              <li key={rank.id} className="flex min-w-0 flex-1 items-start">
                <div
                  className={`flex min-w-[3.75rem] flex-1 flex-col items-center rounded-lg px-1 py-2 text-center transition ${
                    active ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' : ''
                  }`}
                  aria-current={active ? 'step' : undefined}
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full text-base leading-none ${
                      active ? 'bg-brand text-white' : reached ? 'bg-success-50 text-success-600' : 'bg-surface-3 text-fg-faint'
                    }`}
                    aria-hidden
                  >
                    {reached && !active ? <Icon name="check" className="h-4 w-4" /> : rank.emoji}
                  </span>
                  <span className={`mt-1.5 line-clamp-2 w-full text-2xs font-bold leading-tight ${active ? 'text-brand-700' : reached ? 'text-fg' : 'text-fg-faint'}`}>
                    {t(rank.titleKey)}
                  </span>
                  <span className="text-2xs font-semibold tabular-nums text-fg-faint">{rank.minLevel}+</span>
                </div>
                {i < STUDENT_RANKS.length - 1 && (
                  <span aria-hidden className={`mt-6 h-px w-2 shrink-0 ${level >= STUDENT_RANKS[i + 1]!.minLevel ? 'bg-success-300' : 'bg-border'}`} />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
