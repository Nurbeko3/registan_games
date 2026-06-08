'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { TEAMS, type MatchResult } from '@/lib/arena/types';
import { Confetti } from '@/components/ui/Confetti';
import { Icon, type IconName } from '@/components/ui/Icon';
import { GuestRewardNudge } from '@/components/ui/GuestRewardNudge';
import { useT } from '@/lib/i18n';
import { useMustLogIn } from '@/lib/supabase/useAccount';

/** Post-match screen. Win or lose, the framing is positive: it celebrates what
 *  the child LEARNED (accuracy, questions, XP) as much as the battle result. */
export function MatchResults({ result, onPlayAgain }: { result: MatchResult; onPlayAgain: () => void }) {
  const t = useT();
  const mustLogIn = useMustLogIn();
  const acc = result.answered ? Math.round((result.correct / result.answered) * 100) : 0;
  const mine = TEAMS[result.myTeam];
  const myTeamName = `${mine.emoji} ${t(`team.${result.myTeam}`)}`;

  return (
    <div className="relative">
      {result.won && <Confetti />}
      <div className="card text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260 }} className="text-6xl">
          <Icon name={result.won ? 'trophy' : 'brain'} className="mx-auto h-14 w-14 text-grape" />
        </motion.div>
        <p className="mt-2 font-display text-2xl font-extrabold">
          {result.won ? t('arena.res.victory') : t('arena.res.effort')}
        </p>
        <p className="text-ink-soft">
          {result.won ? t('arena.res.win', { team: myTeamName }) : t('arena.res.smarter')}
        </p>
        <p className="mt-2 font-display text-3xl font-extrabold">
          <span className="text-bubble-600">{result.redScore}</span>
          <span className="mx-2 text-ink-faint">–</span>
          <span className="text-sky-600">{result.blueScore}</span>
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat icon="zap" label={t('arena.res.tagouts')} value={result.elims} />
        <Stat icon="rank" label={t('arena.res.accuracy')} value={`${acc}%`} />
        <Stat icon="star" label={t('arena.res.correct')} value={`${result.correct}/${result.answered}`} />
        <Stat icon="spark" label={t('arena.res.xp')} value={`+${result.xpEarned}`} />
      </div>

      {mustLogIn ? (
        <GuestRewardNudge className="mt-3" />
      ) : (
        <div className="mt-3 flex justify-center">
          <span className="chip bg-mango/20 text-ink"><Icon name="coin" className="h-4 w-4" /> +{result.coinsEarned} {t('arena.res.coins')}</span>
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <Link href="/arena" className="btn-ghost flex-1 text-center">{t('arena.res.newMatch')}</Link>
        <button onClick={onPlayAgain} className="btn-primary flex-1">{t('arena.res.rematch')}</button>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: number | string }) {
  return (
    <div className="card flex flex-col items-center gap-0.5 p-3 text-center">
      <Icon name={icon} className="h-5 w-5 text-grape" />
      <span className="font-display text-xl font-extrabold">{value}</span>
      <span className="text-[11px] font-bold text-ink-faint">{label}</span>
    </div>
  );
}
