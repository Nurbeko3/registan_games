'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGame, useHydrated, selectDailyChallenge, type GameState } from '@/store/useGame';
import { useShallow } from 'zustand/react/shallow';

const dailySlice = (s: GameState) => ({
  lastDailyChallengeDone: s.lastDailyChallengeDone,
  lastDailyChallengeId: s.lastDailyChallengeId,
  completed: s.completed,
  codecaster: s.codecaster,
});
import { dailyChallengeHref, dailyChallengeTitleKey, msUntilNextChallenge } from '@/data/dailyChallenges';
import { getGame } from '@/data/games';
import { Icon, gameIcon } from '@/components/ui/Icon';
import { Stars } from '@/components/ui/Bits';
import { Skeleton } from '@/components/ui/Primitives';
import { playSfx } from '@/lib/sound';
import { useT } from '@/lib/i18n';

/**
 * Today's daily challenge.
 *  - `hero`: compact one-line strip (landing page, under the hero).
 *  - `card`: full card with the goal, bonus and CTA (profile page).
 * Store-derived state is gated on hydration; the countdown to the next
 * challenge is only rendered after mount so SSR and first paint agree.
 */
export function DailyChallengeCard({ variant = 'card', className = '' }: { variant?: 'hero' | 'card'; className?: string }) {
  const t = useT();
  const hydrated = useHydrated();
  const daily = useGame(useShallow(dailySlice));
  const { challenge, done } = selectDailyChallenge(daily);
  const [left, setLeft] = useState<string | null>(null);

  // Countdown to the next UTC day — mount-only, refreshed every minute.
  useEffect(() => {
    const tick = () => {
      const ms = msUntilNextChallenge();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLeft(t('daily.newIn', { h, m }));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [t]);

  if (!hydrated) {
    return <Skeleton className={`${variant === 'hero' ? 'h-16' : 'h-36'} w-full rounded-2xl ${className}`} />;
  }

  const target = t(dailyChallengeTitleKey(challenge));
  const goal = t(challenge.kind === 'game' ? 'daily.goalGame' : 'daily.goalQuest', { stars: challenge.stars, target });
  const href = dailyChallengeHref(challenge);
  const game = challenge.kind === 'game' ? getGame(challenge.slug) : undefined;

  const tile = (
    <span
      className={`grid shrink-0 place-items-center rounded-xl text-white shadow-xs ${variant === 'hero' ? 'h-10 w-10' : 'h-12 w-12'} ${
        done
          ? 'bg-success-600'
          : challenge.kind === 'game'
            ? `bg-gradient-to-br ${game?.color ?? 'from-brand-500 to-brand-600'}`
            : 'bg-gradient-to-br from-brand-500 to-brand-600'
      }`}
    >
      <Icon name={done ? 'check' : challenge.kind === 'game' ? gameIcon(challenge.slug) : 'sword'} className={variant === 'hero' ? 'h-5 w-5' : 'h-6 w-6'} />
    </span>
  );

  const cta = done ? (
    <span className="badge-success inline-flex shrink-0">
      <Icon name="checkCircle" className="h-3 w-3" /> {t('daily.done')}
    </span>
  ) : (
    <Link href={href} onClick={() => playSfx('click')} className={`shrink-0 ${variant === 'hero' ? 'btn-primary btn-sm w-full sm:w-auto' : 'btn-primary'}`}>
      {t('daily.play')}
      <Icon name="arrowRight" className="h-4 w-4" />
    </Link>
  );

  if (variant === 'hero') {
    return (
      <section
        aria-label={t('daily.title')}
        className={`card flex flex-wrap items-center gap-3 !p-3 sm:flex-nowrap sm:!px-4 ${className}`}
      >
        {tile}
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="eyebrow !text-brand">{t('daily.title')}</p>
            <Stars count={challenge.stars} size="text-xs" />
          </div>
          <p className="mt-0.5 text-sm font-bold leading-snug text-fg [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">{goal}</p>
          <p className="text-xs text-fg-faint">
            {done && left ? left : t('daily.bonus', { xp: challenge.bonusXp, coins: challenge.bonusCoins })}
          </p>
        </div>
        {cta}
      </section>
    );
  }

  return (
    <section aria-label={t('daily.title')} className={`card ${className}`}>
      <div className="flex items-start gap-3.5">
        {tile}
        <div className="min-w-0 flex-1">
          <p className="eyebrow !text-brand">{t('daily.title')}</p>
          <p className="mt-0.5 font-display text-base font-extrabold text-fg">{goal}</p>
          <p className="mt-0.5 text-xs text-fg-soft">{t('daily.sub')}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Stars count={challenge.stars} size="text-sm" />
          <span className={done ? 'badge-neutral' : 'badge-warning'}>
            <Icon name="coin" className="h-3 w-3" /> {t('daily.bonus', { xp: challenge.bonusXp, coins: challenge.bonusCoins })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {done && left && <span className="text-xs font-semibold text-fg-faint">{left}</span>}
          {cta}
        </div>
      </div>
    </section>
  );
}

/** Tiny "Today's challenge" badge for list rows; renders nothing when done or not the target. */
export function DailyTargetBadge({ kind, id }: { kind: 'game' | 'quest'; id: string }) {
  const t = useT();
  const hydrated = useHydrated();
  const daily = useGame(useShallow(dailySlice));
  if (!hydrated) return null;
  const { challenge, done } = selectDailyChallenge(daily);
  if (done || challenge.kind !== kind) return null;
  const targetId = challenge.kind === 'game' ? challenge.slug : challenge.levelId;
  if (targetId !== id) return null;
  return (
    <span className="badge-warning normal-case tracking-normal">
      <Icon name="target" className="h-3 w-3" /> {t('daily.badge')}
    </span>
  );
}
