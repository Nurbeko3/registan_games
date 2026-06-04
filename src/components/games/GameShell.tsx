'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { selectTotalStars, useGame, useHydrated, type CompleteResult } from '@/store/useGame';
import { getGame } from '@/data/games';
import { zoneOfGame } from '@/data/worlds';
import { isCloudEnabled } from '@/lib/supabase/client';
import { ACCOUNT_SESSION_EVENT, accountResume, readSession } from '@/lib/supabase/account';
import { TopBar } from '@/components/layout/TopBar';
import { AIMentor } from '@/components/AIMentor';
import { Stars } from '@/components/ui/Bits';
import { Icon, gameIcon } from '@/components/ui/Icon';
import { Confetti } from '@/components/ui/Confetti';
import { useT } from '@/lib/i18n';
import { GAME_REGISTRY } from './registry';

export function GameShell({ slug }: { slug: string }) {
  const t = useT();
  const meta = getGame(slug);
  const GameComponent = GAME_REGISTRY[slug];
  const completeGame = useGame((s) => s.completeGame);
  const hydrated = useHydrated();
  const totalStars = useGame(selectTotalStars);
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [round, setRound] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);
  const awardedRef = useRef(false);

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

  if (!meta || !GameComponent) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <Icon name="warning" className="mx-auto h-12 w-12 text-grape" />
        <p className="mt-3 font-display text-xl font-extrabold">{t('gs.notFound')}</p>
        <Link href="/map" className="btn-primary mt-4">{t('common.map')}</Link>
      </div>
    );
  }

  const zone = zoneOfGame(slug);
  const visibleStars = hydrated && loggedIn ? totalStars : 0;
  const locked = hydrated && !!zone && visibleStars < zone.unlockStars;
  const currentIndex = zone?.games.indexOf(slug) ?? -1;
  const nextSlug = zone && currentIndex >= 0 ? zone.games[currentIndex + 1] : undefined;

  if (!hydrated) {
    return (
      <div className="min-h-screen pb-24">
        <TopBar showBack />
        <div className="grid min-h-[50vh] place-items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-grape-100 border-t-grape" />
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="min-h-screen pb-24">
        <TopBar showBack />
        <main id="main" className="mx-auto grid min-h-[55vh] max-w-md place-items-center px-4 text-center">
          <section className="card w-full">
            <Icon name="lock" className="mx-auto h-12 w-12 text-grape" />
            <h1 className="mt-3 font-display text-2xl font-extrabold">{t(`game.${slug}.title`)}</h1>
            <p className="mt-1 font-bold text-ink-soft">{t('map.unlockAt', { n: zone.unlockStars })}</p>
            <Link href="/map" className="btn-primary mt-5 w-full">{t('common.map')}</Link>
          </section>
        </main>
      </div>
    );
  }

  const onWin = (stars: number) => {
    if (awardedRef.current) return;
    awardedRef.current = true;
    const safeStars = Math.max(0, Math.min(3, Math.round(stars)));
    setResult(completeGame(slug, safeStars));
  };
  const playAgain = () => {
    awardedRef.current = false;
    setResult(null);
    setRound((r) => r + 1);
  };

  return (
    <div className="min-h-screen pb-24">
      <TopBar showBack />

      <div className="game-surface mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5 flex items-center gap-4">
          <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${meta.color} text-white shadow-card`}>
            <Icon name={gameIcon(slug)} className="h-8 w-8" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-extrabold leading-tight">{t(`game.${slug}.title`)}</h1>
            <p className="mt-1 text-base font-bold text-ink-soft">{t(`game.${slug}.blurb`)}</p>
          </div>
        </div>

        <GameComponent key={round} onWin={onWin} />
      </div>

      <AIMentor game={slug} />

      <AnimatePresence>
        {result && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {result.stars >= 1 && <Confetti />}
            <motion.div
              initial={{ scale: 0.7, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 18 }}
              className="card w-full max-w-sm text-center"
            >
              <p className="font-display text-sm font-bold uppercase tracking-wide text-grape">
                {result.stars >= 3 ? t('gs.perfect') : result.stars >= 1 ? t('gs.cleared') : t('gs.goodTry')}
              </p>
              <div className="mt-3 flex justify-center"><Stars count={result.stars} size="text-4xl" /></div>

              <div className="mt-4 flex justify-center gap-3">
                <span className="chip bg-sun/30 text-ink"><Icon name="zap" className="h-4 w-4" /> +{result.xpAwarded} XP</span>
                {result.coinsAwarded > 0 && <span className="chip bg-mango/20 text-ink"><Icon name="coin" className="h-4 w-4" /> +{result.coinsAwarded}</span>}
              </div>

              {result.leveledUp && (
                <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-3 font-display text-lg font-extrabold text-bubble-600">
                  {t('gs.levelUp', { n: result.newLevel })}
                </motion.p>
              )}
              {result.newAchievements.length > 0 && (
                <p className="mt-2 font-bold text-mango">
                  {result.newAchievements.map((a) => a.title).join(', ')}
                </p>
              )}

              <div className="mt-5 grid gap-2">
                <button onClick={playAgain} className="btn-primary w-full">{t('gs.playAgain')}</button>
                <div className="flex gap-2">
                  <Link href="/map" className="btn-ghost flex-1">{t('gs.map')}</Link>
                  {nextSlug && <Link href={`/play/${nextSlug}`} className="btn-sun flex-1">{t('gs.next')}</Link>}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
