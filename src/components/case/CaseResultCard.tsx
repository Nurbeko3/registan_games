'use client';

import { Icon } from '@/components/ui/Icon';
import { Stars } from '@/components/ui/Bits';
import { useT } from '@/lib/i18n';
import { rankForCaseXp } from '@/lib/caseLeveling';

/**
 * Shareable result card (visual). PNG export (html-to-canvas) is wired in a later
 * increment — no new dependency in INC 3, so the Share button shows a "coming
 * soon" affordance for now.
 */
export function CaseResultCard({
  caseTitle,
  stars,
  score,
  placement,
  caseXp,
  bestStreak,
}: {
  caseTitle: string;
  stars: number;
  score: number;
  placement: number;
  caseXp: number;
  bestStreak: number;
}) {
  const t = useT();
  const rank = rankForCaseXp(caseXp);
  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-grape via-bubble to-mango p-[2px] shadow-toy">
      <div className="rounded-[22px] bg-white px-5 py-5">
        <div className="flex items-center gap-2 text-grape">
          <Icon name="search" className="h-5 w-5" />
          <span className="font-display text-sm font-extrabold uppercase tracking-wide">{t('case.title')}</span>
          <span className="ml-auto text-2xl" aria-hidden>{rank.emoji}</span>
        </div>

        <p className="mt-2 font-display text-xl font-extrabold leading-tight text-ink">{caseTitle}</p>

        <div className="mt-3 flex justify-center">
          <Stars count={stars} size="text-3xl" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric icon="trophy" label={t('case.placement', { n: placement })} value={`#${placement}`} />
          <Metric icon="zap" label={t('case.scoreboard')} value={String(score)} />
          <Metric icon="flame" label={t('case.bestStreak')} value={String(bestStreak)} />
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-grape-50 px-4 py-2.5">
          <Icon name="rank" className="h-5 w-5 text-grape" />
          <span className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">{t('case.rankLabel')}</span>
          <span className="ml-auto font-display font-extrabold text-grape">{t(rank.nameKey)}</span>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: 'trophy' | 'zap' | 'flame'; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-cloud px-2 py-2">
      <Icon name={icon} className="mx-auto h-4 w-4 text-grape" />
      <p className="mt-1 font-display text-lg font-extrabold text-ink">{value}</p>
      <p className="truncate text-[10px] font-bold text-ink-faint">{label}</p>
    </div>
  );
}
