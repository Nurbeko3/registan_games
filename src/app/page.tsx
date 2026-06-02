'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { Mascot } from '@/components/Mascot';
import { GAMES } from '@/data/games';
import { ZONES } from '@/data/worlds';
import { useGame, useHydrated } from '@/store/useGame';
import { useT } from '@/lib/i18n';

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.5 } }),
};

function NamePrompt() {
  const t = useT();
  const hydrated = useHydrated();
  const playerName = useGame((s) => s.playerName);
  const setPlayerName = useGame((s) => s.setPlayerName);
  const [draft, setDraft] = useState('');
  const [dismissed, setDismissed] = useState(false);

  if (!hydrated || playerName || dismissed) return null;

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed) setPlayerName(trimmed);
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="mx-auto max-w-2xl px-5 pt-4"
      >
        <div className="card flex items-center gap-3 bg-gradient-to-r from-sun/20 to-mango/20">
          <span className="text-3xl">🧑‍🚀</span>
          <div className="flex-1">
            <p className="font-display font-extrabold">{t('home.name.q')}</p>
            <div className="mt-2 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder={t('home.name.ph')}
                maxLength={20}
                autoFocus
                className="flex-1 rounded-2xl border-2 border-grape-100 bg-white px-4 py-2 font-bold outline-none focus:border-grape"
              />
              <button onClick={save} className="btn-primary px-5">
                {t('home.name.go')}
              </button>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="self-start text-ink-faint hover:text-ink">
            ✕
          </button>
        </div>
      </motion.section>
    </AnimatePresence>
  );
}

export default function HomePage() {
  const t = useT();
  return (
    <main id="main">
      <TopBar />
      <NamePrompt />

      {/* ── HERO ── */}
      <section className="dotted relative overflow-hidden">
        <div className="pointer-events-none absolute -left-16 top-6 h-56 w-56 rounded-full bg-bubble/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 top-24 h-64 w-64 rounded-full bg-sky/20 blur-3xl" />

        <div className="mx-auto max-w-2xl px-5 py-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="relative overflow-hidden rounded-xl2 bg-gradient-to-br from-grape to-bubble p-6 text-white shadow-toy"
          >
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <span className="chip bg-white/20 text-white">{t('home.badge')}</span>
                <h1 className="mt-3 font-display text-3xl font-extrabold leading-[1.1] md:text-4xl">
                  {t('home.title.a')} <span className="text-sun">{t('home.title.play')}</span>
                </h1>
                <p className="mt-2 max-w-sm text-white/90">
                  {t('home.subtitle')}
                </p>
                <Link href="/map" className="btn-sun mt-5 text-lg">
                  {t('common.playNow')}
                </Link>
              </div>
              <div className="hidden shrink-0 sm:block">
                <Mascot size={150} />
              </div>
            </div>
            <div className="mt-2 flex justify-center sm:hidden">
              <Mascot size={120} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── WORLDS ── */}
      <section className="mx-auto max-w-2xl px-5 pb-2">
        <div className="flex items-center justify-between">
          <h2 className="h-section">{t('home.worlds')}</h2>
          <Link href="/map" className="font-display text-sm font-extrabold text-grape">
            {t('home.seeAll')}
          </Link>
        </div>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
          {ZONES.map((z, i) => (
            <motion.div
              key={z.slug}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              custom={i}
            >
              <Link
                href="/map"
                className={`card-tap block min-w-[140px] rounded-xl2 bg-gradient-to-br ${z.color} p-4 text-center text-white shadow-card`}
              >
                <div className="text-4xl">{z.emoji}</div>
                <p className="mt-2 font-display font-extrabold leading-tight">{t(`world.${z.slug}.title`)}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── GAMES ── */}
      <section className="mx-auto max-w-2xl px-5 py-6">
        <h2 className="h-section">{t('home.minigames')}</h2>
        <p className="mt-1 text-ink-soft">
          {t('home.minigamesSub', { n: GAMES.length })}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {GAMES.map((g, i) => (
            <motion.div
              key={g.slug}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              custom={i}
            >
              <Link href={`/play/${g.slug}`} className="card card-tap block text-center !p-4">
                <div
                  className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${g.color} text-2xl shadow-toy`}
                >
                  {g.emoji}
                </div>
                <p className="mt-2 font-display text-sm font-extrabold leading-tight">{t(`game.${g.slug}.title`)}</p>
                <p className="mt-0.5 text-[11px] font-bold text-ink-faint">{t(`game.${g.slug}.skill`)}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <p className="pb-4 text-center text-sm text-ink-faint">{t('home.footer')}</p>
    </main>
  );
}
