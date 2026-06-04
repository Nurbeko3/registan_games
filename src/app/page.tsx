'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { Mascot } from '@/components/Mascot';
import { Icon, IconTile, gameIcon, worldIcon } from '@/components/ui/Icon';
import { GAMES } from '@/data/games';
import { ZONES } from '@/data/worlds';
import { useT } from '@/lib/i18n';

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.5 } }),
};

export default function HomePage() {
  const t = useT();
  const previewGames = GAMES.slice(0, 8);

  return (
    <main id="main">
      <TopBar />

      {/* ── HERO ── */}
      <section className="dotted relative overflow-hidden">
        <div className="mx-auto max-w-4xl px-5 py-8 sm:py-10">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-grape to-bubble p-7 text-white shadow-toy sm:p-9">
            <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
              <div>
                <span className="chip bg-white/20 text-base text-white">{t('home.badge')}</span>
                <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">
                  {t('home.title.a')} <span className="text-sun">{t('home.title.play')}</span>
                </h1>
                <p className="mt-3 max-w-xl text-xl font-bold text-white/90">
                  {t('home.subtitle')}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/map" className="btn-sun text-xl">
                    {t('home.startPath')}
                  </Link>
                  <Link
                    href="#modes"
                    className="inline-flex min-h-[52px] items-center rounded-2xl bg-white/20 px-5 py-3 font-display text-lg font-extrabold text-white ring-1 ring-white/30 transition hover:bg-white/30"
                  >
                    {t('home.moreModes')}
                  </Link>
                </div>
              </div>
              <div className="hidden shrink-0 sm:block">
                <Mascot size={180} />
              </div>
            </div>
            <div className="mt-4 flex justify-center sm:hidden">
              <Mascot size={140} />
            </div>
          </div>
        </div>
      </section>

      {/* ── LEARNING PATH ── */}
      <section className="mx-auto max-w-4xl px-5 pb-2">
        <div className="flex items-center justify-between">
          <h2 className="h-section">{t('home.path')}</h2>
          <Link href="/map" className="font-display text-sm font-extrabold text-grape">
            {t('home.seeAll')}
          </Link>
        </div>
        <Link
          href="/map"
          className="card-tap mt-4 grid gap-5 overflow-hidden rounded-2xl bg-white p-4 shadow-card ring-1 ring-grape-100/70 sm:grid-cols-[1.1fr_1fr] sm:p-5"
        >
          <div className="rounded-2xl bg-gradient-to-br from-mint to-sky p-5 text-white">
            <IconTile name="map" className="h-16 w-16 bg-white/20 text-white" iconClassName="h-8 w-8" />
            <h3 className="mt-4 font-display text-3xl font-extrabold leading-tight">{t('home.pathTitle')}</h3>
            <p className="mt-2 max-w-md text-base font-bold text-white/90">{t('home.pathSub')}</p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 font-display font-extrabold text-grape shadow-card">
              {t('home.pathCta')} <Icon name="spark" className="h-4 w-4" />
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {ZONES.slice(0, 4).map((z, i) => (
              <div
                key={z.slug}
                className={`flex min-h-[112px] flex-col justify-between rounded-2xl bg-gradient-to-br ${z.color} p-4 text-white shadow-card`}
              >
                <IconTile name={worldIcon(z.slug)} className="h-11 w-11 bg-white/20 text-white" iconClassName="h-6 w-6" />
                <div>
                  <p className="font-display text-sm font-extrabold leading-tight">{t(`world.${z.slug}.title`)}</p>
                  <p className="mt-1 text-xs font-bold text-white/70">{i + 1}-bosqich</p>
                </div>
              </div>
            ))}
          </div>
        </Link>
      </section>

      {/* ── MODES ── */}
      <section id="modes" className="mx-auto max-w-4xl px-5 py-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="h-section">{t('home.modes')}</h2>
            <p className="mt-1 text-ink-soft">{t('home.modesSub')}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            href="/arena"
            className="card-tap group overflow-hidden rounded-2xl bg-gradient-to-br from-grape to-bubble p-5 text-white shadow-card"
          >
            <div className="flex items-start justify-between gap-4">
              <IconTile name="arena" className="h-14 w-14 bg-white/20 text-white" iconClassName="h-7 w-7" />
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold">{t('home.modeExtra')}</span>
            </div>
            <h3 className="mt-5 font-display text-2xl font-extrabold">{t('home.arenaTitle')}</h3>
            <p className="mt-1 font-bold text-white/80">{t('home.arenaSub')}</p>
            <span className="mt-5 inline-flex items-center gap-2 font-display font-extrabold text-sun">
              {t('home.openMode')} <Icon name="spark" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
          <Link
            href="/party"
            className="card-tap group overflow-hidden rounded-2xl bg-gradient-to-br from-mango to-sun p-5 text-white shadow-card"
          >
            <div className="flex items-start justify-between gap-4">
              <IconTile name="party" className="h-14 w-14 bg-white/20 text-white" iconClassName="h-7 w-7" />
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold">{t('home.modeExtra')}</span>
            </div>
            <h3 className="mt-5 font-display text-2xl font-extrabold">{t('home.partyTitle')}</h3>
            <p className="mt-1 font-bold text-white/90">{t('home.partySub')}</p>
            <span className="mt-5 inline-flex items-center gap-2 font-display font-extrabold text-white">
              {t('home.openMode')} <Icon name="spark" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </section>

      {/* ── GAMES PREVIEW ── */}
      <section className="mx-auto max-w-4xl px-5 py-6">
        <h2 className="h-section">{t('home.minigames')}</h2>
        <p className="mt-1 text-ink-soft">
          {t('home.minigamesSub', { n: GAMES.length })}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {previewGames.map((g, i) => (
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
                  <Icon name={gameIcon(g.slug)} className="h-7 w-7 text-white" />
                </div>
                <p className="mt-2 font-display text-sm font-extrabold leading-tight">{t(`game.${g.slug}.title`)}</p>
                <p className="mt-0.5 text-[11px] font-bold text-ink-faint">{t(`game.${g.slug}.skill`)}</p>
              </Link>
            </motion.div>
          ))}
        </div>
        <div className="mt-5 text-center">
          <Link href="/map" className="btn-ghost inline-flex">
            {t('home.allGames')}
          </Link>
        </div>
      </section>

      <p className="pb-4 text-center text-sm text-ink-faint">{t('home.footer')}</p>
    </main>
  );
}
