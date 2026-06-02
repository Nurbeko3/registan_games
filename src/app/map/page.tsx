'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { useGame, useHydrated, selectTotalStars } from '@/store/useGame';
import { ZONES } from '@/data/worlds';
import { getGame } from '@/data/games';
import { Stars } from '@/components/ui/Bits';
import { useT } from '@/lib/i18n';

export default function WorldMapPage() {
  const t = useT();
  const hydrated = useHydrated();
  const totalStars = useGame(selectTotalStars);
  const completed = useGame((s) => s.completed);

  return (
    <main id="main" className="min-h-screen pb-4 dotted">
      <TopBar />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-extrabold">{t('map.title')}</h1>
          <p className="mt-1 text-ink-soft">{t('map.stars', { n: hydrated ? totalStars : 0 })}</p>
        </div>

        <div className="relative mt-8 space-y-6">
          {/* dotted path down the middle */}
          <div className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-1 -translate-x-1/2 border-l-4 border-dashed border-grape-100 sm:block" />

          {ZONES.map((zone, zi) => {
            const unlocked = !hydrated ? zi === 0 : totalStars >= zone.unlockStars;
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
                  <span className={`grid h-14 w-14 place-items-center rounded-2xl text-3xl ${unlocked ? 'bg-white/20' : 'bg-cloud grayscale'}`}>
                    {unlocked ? zone.emoji : '🔒'}
                  </span>
                  <div className="flex-1">
                    <h2 className="font-display text-xl font-extrabold">{t(`world.${zone.slug}.title`)}</h2>
                    <p className={`text-sm ${unlocked ? 'text-white/85' : 'text-ink-soft'}`}>
                      {unlocked ? t(`world.${zone.slug}.desc`) : t('map.unlockAt', { n: zone.unlockStars })}
                    </p>
                  </div>
                </div>

                {unlocked && !zone.finale && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {zone.games.map((slug) => {
                      const g = getGame(slug);
                      const stars = completed[slug]?.stars ?? 0;
                      if (!g) return null;
                      return (
                        <Link
                          key={slug}
                          href={`/play/${slug}`}
                          className="flex items-center gap-3 rounded-2xl bg-white/95 p-3 text-ink transition hover:scale-[1.02]"
                        >
                          <span className="text-2xl">{g.emoji}</span>
                          <div className="flex-1">
                            <p className="font-display font-extrabold leading-tight">{t(`game.${slug}.title`)}</p>
                            <div className="text-sm"><Stars count={hydrated ? stars : 0} size="text-xs" /></div>
                          </div>
                          <span className="font-display font-bold text-grape">{t('common.play')}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {unlocked && zone.finale && (
                  <div className="mt-4 rounded-2xl bg-white/90 p-4 text-center text-ink">
                    <p className="text-4xl">🏆</p>
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
