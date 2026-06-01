'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame, type CompleteResult } from '@/store/useGame';
import { getGame } from '@/data/games';
import { zoneOfGame } from '@/data/worlds';
import { TopBar } from '@/components/layout/TopBar';
import { AIMentor } from '@/components/AIMentor';
import { Stars } from '@/components/ui/Bits';
import { Confetti } from '@/components/ui/Confetti';
import { GAME_REGISTRY } from './registry';

export function GameShell({ slug }: { slug: string }) {
  const meta = getGame(slug);
  const GameComponent = GAME_REGISTRY[slug];
  const completeGame = useGame((s) => s.completeGame);
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [round, setRound] = useState(0);

  if (!meta || !GameComponent) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-5xl">🚧</p>
        <p className="mt-3 font-display text-xl font-extrabold">Game not found</p>
        <Link href="/map" className="btn-primary mt-4">← Back to map</Link>
      </div>
    );
  }

  const onWin = (stars: number) => setResult(completeGame(slug, stars));
  const playAgain = () => {
    setResult(null);
    setRound((r) => r + 1);
  };

  // suggest the sibling game in the same zone as "next"
  const zone = zoneOfGame(slug);
  const nextSlug = zone?.games.find((g) => g !== slug);

  return (
    <div className="min-h-screen pb-24">
      <TopBar showBack />

      <div className="mx-auto max-w-2xl px-4 py-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-card">{meta.emoji}</span>
          <div>
            <h1 className="font-display text-xl font-extrabold leading-tight">{meta.title}</h1>
            <p className="text-sm text-ink-soft">{meta.blurb}</p>
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
                {result.stars >= 3 ? 'Perfect!' : result.stars >= 1 ? 'Level cleared!' : 'Good try!'}
              </p>
              <div className="mt-3 flex justify-center"><Stars count={result.stars} size="text-4xl" /></div>

              <div className="mt-4 flex justify-center gap-3">
                <span className="chip bg-sun/30 text-ink">⚡ +{result.xpAwarded} XP</span>
                {result.coinsAwarded > 0 && <span className="chip bg-mango/20 text-ink">💰 +{result.coinsAwarded}</span>}
              </div>

              {result.leveledUp && (
                <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-3 font-display text-lg font-extrabold text-bubble-600">
                  ⬆️ Level {result.newLevel}!
                </motion.p>
              )}
              {result.newAchievements.length > 0 && (
                <p className="mt-2 font-bold text-mango">
                  🏅 {result.newAchievements.map((a) => a.title).join(', ')}
                </p>
              )}

              <div className="mt-5 grid gap-2">
                <button onClick={playAgain} className="btn-primary w-full">🔁 Play again</button>
                <div className="flex gap-2">
                  <Link href="/map" className="btn-ghost flex-1">🗺️ Map</Link>
                  {nextSlug && <Link href={`/play/${nextSlug}`} className="btn-sun flex-1">Next →</Link>}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
