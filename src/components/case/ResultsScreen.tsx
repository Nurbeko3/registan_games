'use client';

import { Icon } from '@/components/ui/Icon';
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
      <div
        className={`rounded-3xl px-6 py-6 text-center text-white shadow-toy ${
          solved ? 'bg-gradient-to-br from-mint to-sky' : 'bg-gradient-to-br from-ink-faint to-grape'
        }`}
      >
        <Icon name={solved ? 'trophy' : 'search'} className="mx-auto h-12 w-12" />
        <h1 className="mt-2 font-display text-2xl font-extrabold">
          {solved ? t('case.results.solvedTitle') : t('case.results.unsolvedTitle')}
        </h1>
        <p className="mt-1 font-bold text-white/85">
          {solved ? t('case.results.solvedSub') : t('case.results.unsolvedSub')}
        </p>
        <p className="mt-2 font-display font-extrabold">
          {t('case.correctCount', { correct, total })}
        </p>
      </div>

      {result.firstOfDay && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-sun/20 px-4 py-2.5 font-display text-sm font-extrabold text-mango-600">
          <Icon name="gift" className="h-5 w-5" /> {t('case.firstOfDay')}
        </div>
      )}

      {/* Detective rank chip — shows the rank earned after this match */}
      <div className="flex justify-center">
        <DetectiveRankBadge variant="compact" caseXp={caseXp} />
      </div>

      {/* Reward breakdown */}
      <div className="card flex items-center justify-center gap-6">
        <Reward icon="zap" value={`+${result.xpAwarded}`} label="XP" tone="text-grape" />
        <Reward icon="coin" value={`+${result.coinsAwarded}`} label="" tone="text-mango-600" />
        {result.caseXpAwarded > 0 && (
          <Reward icon="rank" value={`+${result.caseXpAwarded}`} label={t('case.rankLabel')} tone="text-sky-600" />
        )}
      </div>

      {/* Newly unlocked achievements */}
      {result.newAchievements.length > 0 && (
        <div className="card">
          <p className="font-display text-xs font-extrabold uppercase tracking-wide text-ink-faint">🏅</p>
          <ul className="mt-2 space-y-1.5">
            {result.newAchievements.map((a) => (
              <li key={a.code} className="flex items-center gap-2 rounded-xl bg-grape-50 px-3 py-2">
                <span className="text-lg" aria-hidden>{a.emoji}</span>
                <span className="font-bold text-ink">{t(a.titleKey)}</span>
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

      <div className="flex gap-3">
        <button type="button" onClick={onReplay} className="btn-primary flex-1">
          {t('case.replay')}
        </button>
        <button type="button" onClick={onExit} className="btn-ghost flex-1">
          {t('case.backToCases')}
        </button>
      </div>
    </div>
  );
}

function Reward({ icon, value, label, tone }: { icon: 'zap' | 'coin' | 'rank'; value: string; label: string; tone: string }) {
  return (
    <div className="text-center">
      <Icon name={icon} className={`mx-auto h-6 w-6 ${tone}`} />
      <p className={`mt-1 font-display text-xl font-extrabold ${tone}`}>{value}</p>
      {label && <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">{label}</p>}
    </div>
  );
}
