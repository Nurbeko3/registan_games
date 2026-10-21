'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { selectTotalStars, useGame, useHydrated, type CompleteResult } from '@/store/useGame';
import { getGame } from '@/data/games';
import { zoneOfGame } from '@/data/worlds';
import { isCloudEnabled } from '@/lib/supabase/client';
import { ACCOUNT_SESSION_EVENT, accountResume, readSession } from '@/lib/supabase/account';
import { TopBar } from '@/components/layout/TopBar';
import { useRegisterByte } from '@/lib/mentor/context';
import { Stars } from '@/components/ui/Bits';
import { Icon, gameIcon, worldIcon } from '@/components/ui/Icon';
import { Confetti } from '@/components/ui/Confetti';
import { GuestRewardNudge } from '@/components/ui/GuestRewardNudge';
import { EmptyState, Notice, PageLoading } from '@/components/ui/Primitives';
import { playSfx, playStars } from '@/lib/sound';
import { useT } from '@/lib/i18n';
import { GAME_REGISTRY } from './registry';
import { studentRankForLevel } from '@/lib/studentRanks';

export function GameShell({ slug }: { slug: string }) {
  const t = useT();
  const shouldReduceMotion = useReducedMotion();
  const meta = getGame(slug);
  const GameComponent = GAME_REGISTRY[slug];
  const completeGame = useGame((s) => s.completeGame);
  const hydrated = useHydrated();
  const totalStars = useGame(selectTotalStars);
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [round, setRound] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);
  const awardedRef = useRef(false);

  // Register this mini-game with the site-wide Byte assistant (generic per-game hints).
  useRegisterByte(slug);

  useEffect(() => {
    let alive = true;
    const sync = () => {
      if (!isCloudEnabled()) {
        setLoggedIn(true);
        return;
      }
      if (!readSession()) {
        setLoggedIn(false);
        return;
      }
      accountResume().then((user) => {
        if (alive) setLoggedIn(!!user);
      });
    };
    sync();
    window.addEventListener(ACCOUNT_SESSION_EVENT, sync);
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      alive = false;
      window.removeEventListener(ACCOUNT_SESSION_EVENT, sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const onWin = (stars: number) => {
    if (awardedRef.current) return;
    awardedRef.current = true;
    const safeStars = Math.max(0, Math.min(3, Math.round(stars)));
    const r = completeGame(slug, safeStars);
    setResult(r);
    // Sound: one cue for the outcome, then the star chimes; fanfares for level-up / unlocks.
    playSfx(safeStars >= 1 ? 'success' : 'error');
    playStars(safeStars, 160);
    if (r.leveledUp) setTimeout(() => playSfx('levelUp'), 650);
    if (r.newAchievements.length > 0) setTimeout(() => playSfx('unlock'), r.leveledUp ? 1200 : 650);
  };
  const playAgain = () => {
    awardedRef.current = false;
    setResult(null);
    setRound((r) => r + 1);
  };

  // Escape key closes the result modal. Declared before any early return so
  // the hook order is stable across the hydration / locked / not-found states.
  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') playAgain(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (!meta || !GameComponent) {
    return (
      <div className="min-h-screen">
        <TopBar showBack />
        <main id="main" className="mx-auto max-w-md px-4 py-12">
          <EmptyState
            icon="warning"
            tone="danger"
            title={t('gs.notFound')}
            action={<Link href="/map" className="btn-primary">{t('common.map')}</Link>}
          />
        </main>
      </div>
    );
  }

  const zone = zoneOfGame(slug);
  // Cloud/classroom mode without a logged-in profile: rewards are no-ops
  // (see useGame.completeGame), so guide the player to log in instead of
  // silently showing "+0 XP / +0 coins".
  const mustLogIn = isCloudEnabled() && !loggedIn;
  const visibleStars = hydrated && loggedIn ? totalStars : 0;
  const locked = hydrated && !!zone && visibleStars < zone.unlockStars;
  const currentIndex = zone?.games.indexOf(slug) ?? -1;
  const nextSlug = zone && currentIndex >= 0 ? zone.games[currentIndex + 1] : undefined;

  if (!hydrated) {
    return (
      <div className="min-h-screen">
        <TopBar showBack />
        <PageLoading />
      </div>
    );
  }

  if (locked) {
    return (
      <div className="min-h-screen">
        <TopBar showBack />
        <main id="main" className="mx-auto max-w-md px-4 py-12">
          <EmptyState
            icon="lock"
            tone="brand"
            title={t(`game.${slug}.title`)}
            description={t('map.unlockAt', { n: zone.unlockStars })}
            action={<Link href="/map" className="btn-primary">{t('common.map')}</Link>}
          />
        </main>
      </div>
    );
  }

  const resultLabel = result
    ? result.stars >= 3 ? t('gs.perfect') : result.stars >= 1 ? t('gs.cleared') : t('gs.goodTry')
    : '';

  return (
    <div className="min-h-screen pb-10">
      <TopBar showBack />

      <div className="game-surface mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {/* header */}
        <header className="mb-5 flex items-start gap-4">
          <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${meta.color} text-white shadow-xs`}>
            <Icon name={gameIcon(slug)} className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-fg sm:text-[1.75rem]">
                {t(`game.${slug}.title`)}
              </h1>
              {zone && (
                <span className="badge-neutral inline-flex items-center gap-1 normal-case tracking-normal">
                  <Icon name={worldIcon(zone.slug)} className="h-3 w-3" />
                  {t(`world.${zone.slug}.title`)}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-fg-soft sm:text-[0.9375rem]">{t(`game.${slug}.blurb`)}</p>
          </div>
        </header>

        <GameComponent key={round} onWin={onWin} />
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-fg/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            role="dialog"
            aria-modal="true"
            aria-label={resultLabel}
            onClick={playAgain}
          >
            {result.stars >= 1 && <Confetti />}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm overflow-hidden rounded-t-2xl bg-surface shadow-xl ring-1 ring-border sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pb-5 pt-6 text-center">
                <p className="eyebrow text-brand">{resultLabel}</p>
                <div className="mt-3 flex justify-center"><Stars count={result.stars} size="text-4xl" /></div>

                {mustLogIn ? (
                  <GuestRewardNudge className="mt-5" />
                ) : (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <span className="chip animate-pop bg-amber-50 text-amber-700" style={{ animationDelay: '0.35s' }}>
                      <Icon name="zap" className="h-3.5 w-3.5" /> +{result.xpAwarded} XP
                    </span>
                    {result.coinsAwarded > 0 && (
                      <span className="chip animate-pop bg-amber-50 text-amber-700" style={{ animationDelay: '0.5s' }}>
                        <Icon name="coin" className="h-3.5 w-3.5" /> +{result.coinsAwarded}
                      </span>
                    )}
                  </div>
                )}
                {result.dailyBonus && (
                  <Notice tone="success" icon="target" className="mt-4 animate-fade-up text-left" >
                    {t('daily.completedToast', { xp: result.dailyBonus.xp, coins: result.dailyBonus.coins })}
                  </Notice>
                )}

                {result.leveledUp && (
                  <motion.p
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-4 font-display text-base font-extrabold text-brand"
                  >
                    {t('gs.levelUp', { n: result.newLevel })} · {t(studentRankForLevel(result.newLevel).titleKey)}
                  </motion.p>
                )}
                {result.newAchievements.length > 0 && (
                  <p className="mt-2 text-sm font-semibold text-success-600">
                    {result.newAchievements.map((a) => a.title).join(', ')}
                  </p>
                )}
              </div>

              <div className="grid gap-2 border-t border-border bg-surface-2 px-6 py-4">
                <button autoFocus onClick={playAgain} className="btn-primary w-full">{t('gs.playAgain')}</button>
                <div className="flex gap-2">
                  <Link href="/map" className="btn-secondary flex-1">{t('gs.map')}</Link>
                  {nextSlug && (
                    <Link href={`/play/${nextSlug}`} className="btn-accent flex-1">
                      {t('gs.next')}
                      <Icon name="arrowRight" className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
