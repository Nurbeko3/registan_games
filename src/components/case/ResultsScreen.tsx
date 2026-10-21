'use client';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';
import type { CaseMatchResult } from '@/store/useGame';
import { CaseResultCard } from './CaseResultCard';
import { DetectiveRankBadge } from './DetectiveRankBadge';

/**
 * End-of-case results. Shows the win/lose headline, the reward breakdown from the
 * store settlement (`CaseMatchResult`), and the shareable result card.
 */
export function ResultsScreen({
  caseTitle,
  result,
  score,
  placement,
  caseXp,
  bestStreak,
  correct,
  total,
  onReplay,
  onExit,
}: {
  caseTitle: string;
  result: CaseMatchResult;
  score: number;
  placement: number;
  caseXp: number;
  bestStreak: number;
  correct: number;
  total: number;
  onReplay: () => void;
  onExit: () => void;
}) {
  const t = useT();
  const solved = result.stars >= 1;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <section className="card text-center">
        <span
          className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${
            solved ? 'bg-success-50 text-success-600' : 'bg-surface-2 text-fg-faint'
          }`}
        >
          <Icon name={solved ? 'trophy' : 'search'} className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-fg">
          {solved ? t('case.results.solvedTitle') : t('case.results.unsolvedTitle')}
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          {solved ? t('case.results.solvedSub') : t('case.results.unsolvedSub')}
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-bold text-fg">
          <Icon name="checkCircle" className="h-4 w-4 text-success-600" />
          {t('case.correctCount', { correct, total })}
        </p>

        {/* Detective rank chip — shows the rank earned after this match */}
        <div className="mt-4 flex justify-center">
          <DetectiveRankBadge variant="compact" caseXp={caseXp} />
        </div>
      </section>

      {result.firstOfDay && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700" role="status">
          <Icon name="gift" className="h-4 w-4" />
          {t('case.firstOfDay')}
        </div>
      )}

      {/* Reward breakdown */}
      <div className="card grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Reward icon="zap" value={`+${result.xpAwarded}`} label="XP" tone="bg-brand-50 text-brand" />
        <Reward icon="coin" value={`+${result.coinsAwarded}`} label={t('rw.coins')} tone="bg-amber-50 text-amber-600" />
        {result.caseXpAwarded > 0 && (
          <Reward icon="rank" value={`+${result.caseXpAwarded}`} label={t('case.rankLabel')} tone="bg-info-50 text-info-600" />
        )}
      </div>

      {/* Newly unlocked achievements */}
      {result.newAchievements.length > 0 && (
        <div className="card">
          <p className="eyebrow">{t('rw.achievements')}</p>
          <ul className="mt-2 space-y-1.5">
            {result.newAchievements.map((a) => (
              <li key={a.code} className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2">
                <span className="text-lg leading-none" aria-hidden>{a.emoji}</span>
                <span className="text-sm font-bold text-fg">{t(a.titleKey)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CaseResultCard
        caseTitle={caseTitle}
        stars={result.stars}
        score={score}
        placement={placement}
        caseXp={caseXp}
        bestStreak={bestStreak}
      />

      <div className="flex gap-2">
        <button type="button" onClick={onReplay} className="btn-primary flex-1">
          <Icon name="refresh" className="h-4 w-4" />
          {t('case.replay')}
        </button>
        <button type="button" onClick={onExit} className="btn-secondary flex-1">
          {t('case.backToCases')}
        </button>
      </div>
    </div>
  );
}

function Reward({ icon, value, label, tone }: { icon: IconName; value: string; label: string; tone: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}>
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-lg font-extrabold leading-none tabular-nums text-fg">{value}</p>
        <p className="mt-0.5 truncate text-2xs font-semibold uppercase tracking-wide text-fg-faint">{label}</p>
      </div>
    </div>
  );
}
