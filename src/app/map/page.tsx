'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { useGame, useHydrated, selectTotalStars } from '@/store/useGame';
import { ZONES } from '@/data/worlds';
import { getGame } from '@/data/games';
import { Stars } from '@/components/ui/Bits';

export default function WorldMapPage() {
  const hydrated = useHydrated();
  const totalStars = useGame(selectTotalStars);
  const completed = useGame((s) => s.completed);

  return (
    <main id="main" className="min-h-screen pb-4 dotted">
      <TopBar />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-extrabold">🗺️ World Map</h1>
          <p className="mt-1 text-ink-soft">Earn ⭐ to unlock new worlds! You have <strong>{hydrated ? totalStars : 0}</strong> stars.</p>
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
                    <h2 className="font-display text-xl font-extrabold">{zone.title}</h2>
                    <p className={`text-sm ${unlocked ? 'text-white/85' : 'text-ink-soft'}`}>
                      {unlocked ? zone.description : `Unlock at ${zone.unlockStars} ⭐`}
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
                            <p className="font-display font-extrabold leading-tight">{g.title}</p>
                            <div className="text-sm"><Stars count={hydrated ? stars : 0} size="text-xs" /></div>
                          </div>
                          <span className="font-display font-bold text-grape">Play →</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {unlocked && zone.finale && (
                  <div className="mt-4 rounded-2xl bg-white/90 p-4 text-center text-ink">
                    <p className="text-4xl">🏆</p>
                    <p className="mt-2 font-display font-extrabold">You’re a Code Hero!</p>
                    <p className="text-sm text-ink-soft">You’ve mastered every world. Replay games to beat your star records!</p>
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
