'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { useGame, useHydrated, selectTotalStars } from '@/store/useGame';
import { isCloudEnabled } from '@/lib/supabase/client';
import { ACCOUNT_SESSION_EVENT, accountResume, readSession } from '@/lib/supabase/account';
import { ZONES } from '@/data/worlds';
import { getGame } from '@/data/games';
import { Stars } from '@/components/ui/Bits';
import { Icon, gameIcon, worldIcon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

export default function WorldMapPage() {
  const t = useT();
  const hydrated = useHydrated();
  const totalStars = useGame(selectTotalStars);
  const completed = useGame((s) => s.completed);
  const [loggedIn, setLoggedIn] = useState(false);

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

  const visibleStars = hydrated && loggedIn ? totalStars : 0;
  const visibleCompleted = hydrated && loggedIn ? completed : {};

  return (
    <main id="main" className="min-h-screen dotted page-pad-bottom">
      <TopBar />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-extrabold">{t('map.title')}</h1>
          <p className="mt-1 text-ink-soft">{t('map.stars', { n: visibleStars })}</p>
        </div>

        <div className="relative mt-8 space-y-6">
          {/* dotted path down the middle */}
          <div className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-1 -translate-x-1/2 border-l-4 border-dashed border-grape-100 sm:block" />

          {ZONES.map((zone, zi) => {
            const unlocked = !hydrated ? zi === 0 : zi === 0 || visibleStars >= zone.unlockStars;
            return (
              <motion.section
                key={zone.slug}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: zi * 0.06 }}
                className={`relative rounded-xl2 p-5 shadow-card sm:w-[88%] ${zi % 2 ? 'sm:ml-auto' : ''} ${
                  unlocked ? `bg-gradient-to-br ${zone.color} text-white` : 'bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`grid h-14 w-14 place-items-center rounded-2xl ${unlocked ? 'bg-white/20 text-white ring-1 ring-white/25' : 'bg-cloud text-ink-faint ring-1 ring-grape-100'}`}>
                    <Icon name={unlocked ? worldIcon(zone.slug) : 'lock'} className="h-7 w-7" />
                  </span>
                  <div className="flex-1">
                    <h2 className="font-display text-xl font-extrabold">{t(`world.${zone.slug}.title`)}</h2>
                    <p className={`text-sm ${unlocked ? 'text-white/85' : 'text-ink-soft'}`}>
                      {unlocked ? t(`world.${zone.slug}.desc`) : t('map.unlockAt', { n: zone.unlockStars })}
                    </p>
                  </div>
                </div>

                {unlocked && zone.games.length > 0 && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {zone.games.map((slug) => {
                      const g = getGame(slug);
                      const stars = visibleCompleted[slug]?.stars ?? 0;
                      if (!g) return null;
                      return (
                        <Link
                          key={slug}
                          href={`/play/${slug}`}
                          className="flex items-center gap-3 rounded-2xl bg-white/95 p-3 text-ink shadow-soft ring-1 ring-white/60 transition hover:scale-[1.02] hover:shadow-card active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape"
                        >
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-grape-50 text-grape">
                            <Icon name={gameIcon(slug)} className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-display font-extrabold leading-tight">{t(`game.${slug}.title`)}</p>
                            <div className="text-sm"><Stars count={hydrated ? stars : 0} size="text-xs" /></div>
                          </div>
                          <span className="shrink-0 font-display text-sm font-bold text-grape">{t('common.play')}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {unlocked && zone.finale && (
                  <div className="mt-4 rounded-2xl bg-white/90 p-4 text-center text-ink">
                    <Icon name="trophy" className="mx-auto h-10 w-10 text-mango" />
                    <p className="mt-2 font-display font-extrabold">{t('map.hero')}</p>
                    <p className="text-sm text-ink-soft">{t('map.heroSub')}</p>
                  </div>
                )}
              </motion.section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
