'use client';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Stars } from '@/components/ui/Bits';
import { useT } from '@/lib/i18n';
import { rankForCaseXp } from '@/lib/caseLeveling';

/**
 * Shareable result card (visual). PNG export (html-to-canvas) is wired in a later
 * increment — no new dependency yet.
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
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-5 py-3">
        <Icon name="search" className="h-4 w-4 text-brand" />
        <span className="eyebrow">{t('case.title')}</span>
        <span className="ml-auto text-lg leading-none" aria-hidden>{rank.emoji}</span>
      </div>

      <div className="px-5 py-5">
        <p className="font-display text-lg font-extrabold leading-tight tracking-tight text-fg">{caseTitle}</p>

        <div className="mt-3 flex justify-center">
          <Stars count={stars} size="text-3xl" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric icon="trophy" tone="text-amber-600 bg-amber-50" label={t('case.placement', { n: placement })} value={`#${placement}`} />
          <Metric icon="zap" tone="text-brand bg-brand-50" label={t('case.scoreboard')} value={String(score)} />
          <Metric icon="flame" tone="text-warning-600 bg-warning-50" label={t('case.bestStreak')} value={String(bestStreak)} />
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
          <Icon name="rank" className="h-4 w-4 text-brand" />
          <span className="text-xs font-bold text-fg-faint">{t('case.rankLabel')}</span>
          <span className="ml-auto font-display text-sm font-bold text-fg">{t(rank.nameKey)}</span>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-2 py-3 text-center">
      <span className={`mx-auto grid h-7 w-7 place-items-center rounded-md ${tone}`}>
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <p className="mt-1.5 font-display text-lg font-extrabold tabular-nums leading-none text-fg">{value}</p>
      <p className="mt-1 truncate text-2xs font-semibold text-fg-faint">{label}</p>
    </div>
  );
}
