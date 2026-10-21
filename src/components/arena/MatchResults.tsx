'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { type MatchResult } from '@/lib/arena/types';
import { Confetti } from '@/components/ui/Confetti';
import { Icon } from '@/components/ui/Icon';
import { GuestRewardNudge } from '@/components/ui/GuestRewardNudge';
import { StatCard } from '@/components/ui/Primitives';
import { useT } from '@/lib/i18n';
import { useMustLogIn } from '@/lib/supabase/useAccount';

/** Post-match screen. Win or lose, the framing is positive: it celebrates what
 *  the child LEARNED (accuracy, questions, XP) as much as the battle result. */
export function MatchResults({ result, onPlayAgain }: { result: MatchResult; onPlayAgain: () => void }) {
  const t = useT();
  const reduce = useReducedMotion();
  const mustLogIn = useMustLogIn();
  const acc = result.answered ? Math.round((result.correct / result.answered) * 100) : 0;
  const myTeamName = t(`team.${result.myTeam}`);

  return (
    <div className="relative mx-auto max-w-md">
      {result.won && <Confetti />}
      <div className="card text-center">
        <motion.span
          initial={reduce ? false : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className={`mx-auto grid h-14 w-14 place-items-center rounded-xl ${result.won ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand'}`}
        >
          <Icon name={result.won ? 'trophy' : 'brain'} className="h-7 w-7" />
        </motion.span>
        <p className="mt-4 font-display text-2xl font-extrabold tracking-tight text-fg">
          {result.won ? t('arena.res.victory') : t('arena.res.effort')}
        </p>
        <p className="mt-1 text-sm text-fg-soft">
          {result.won ? t('arena.res.win', { team: myTeamName }) : t('arena.res.smarter')}
        </p>
        <div className="mt-5 inline-flex items-center gap-4 rounded-xl border border-border bg-surface-2 px-5 py-3 font-display text-3xl font-extrabold tabular-nums">
          <span className="flex flex-col items-center">
            <span className="text-danger-600">{result.redScore}</span>
            <span className="mt-0.5 text-2xs font-bold uppercase tracking-wide text-fg-faint">{t('team.red')}</span>
          </span>
          <span className="text-fg-faint">–</span>
          <span className="flex flex-col items-center">
            <span className="text-info-600">{result.blueScore}</span>
            <span className="mt-0.5 text-2xs font-bold uppercase tracking-wide text-fg-faint">{t('team.blue')}</span>
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatCard icon="zap" tone="brand" label={t('arena.res.tagouts')} value={result.elims} />
        <StatCard icon="target" tone="success" label={t('arena.res.accuracy')} value={`${acc}%`} />
        <StatCard icon="checkCircle" tone="brand" label={t('arena.res.correct')} value={`${result.correct}/${result.answered}`} />
        <StatCard icon="spark" tone="amber" label={t('arena.res.xp')} value={`+${result.xpEarned}`} />
      </div>

      {mustLogIn ? (
        <GuestRewardNudge className="mt-3" />
      ) : (
        <div className="mt-3 flex justify-center">
          <span className="chip bg-amber-50 text-amber-700">
            <Icon name="coin" className="h-3.5 w-3.5" /> +{result.coinsEarned} {t('arena.res.coins')}
          </span>
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <Link href="/arena" className="btn-secondary flex-1">{t('arena.res.newMatch')}</Link>
        <button type="button" onClick={onPlayAgain} className="btn-primary flex-1">
          <Icon name="refresh" className="h-4 w-4" />
          {t('arena.res.rematch')}
        </button>
      </div>
    </div>
  );
}
