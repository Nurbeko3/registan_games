'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { Icon, gameIcon, worldIcon, type IconName } from '@/components/ui/Icon';
import { SectionHeader, TextLink } from '@/components/ui/Primitives';
import { GAMES } from '@/data/games';
import { ZONES } from '@/data/worlds';
import { useGame, useHydrated, selectTotalStars } from '@/store/useGame';
import { useT } from '@/lib/i18n';

/** Game modes shown on the landing page. */
const MODE_CARDS: { href: string; icon: IconName; tone: string; title: string; sub: string; soon?: boolean }[] = [
  { href: '/quest', icon: 'sword', tone: 'bg-brand-50 text-brand ring-brand-100', title: 'home.questTitle', sub: 'home.questSub' },
  { href: '/arena', icon: 'arena', tone: 'bg-violet-50 text-violet-600 ring-violet-100', title: 'home.arenaTitle', sub: 'home.arenaSub' },
  { href: '/case', icon: 'search', tone: 'bg-info-50 text-info-600 ring-info-100', title: 'case.title', sub: 'case.sub' },
  { href: '/party', icon: 'party', tone: 'bg-warning-50 text-warning-600 ring-warning-100', title: 'home.partyTitle', sub: 'home.partySub' },
];

const ease = [0.22, 1, 0.36, 1] as const;

export default function HomePage() {
  const t = useT();
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  const totalStars = useGame(selectTotalStars);
  const completed = useGame((s) => s.completed);
  const previewGames = GAMES.slice(0, 8);
  const stars = hydrated ? totalStars : 0;
  const doneCount = hydrated ? Object.keys(completed).length : 0;

  const reveal = (i: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.05 * i, duration: 0.5, ease } };

  return (
    <main id="main" className="page-pad-bottom">
      <TopBar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-surface">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(60%_80%_at_50%_0%,black,transparent)]" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <motion.span {...reveal(0)} className="badge-brand inline-flex">{t('home.badge')}</motion.span>
              <motion.h1
                {...reveal(1)}
                className="mt-4 max-w-2xl font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-fg sm:text-5xl lg:text-[3.5rem]"
              >
                {t('home.title.a')} <span className="text-brand">{t('home.title.play')}</span>
              </motion.h1>
              <motion.p {...reveal(2)} className="mt-4 max-w-xl text-base text-fg-soft sm:text-lg">
                {t('home.subtitle')}
              </motion.p>
              <motion.div {...reveal(3)} className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/map" className="btn-primary btn-lg">
                  {t('home.startPath')}
                  <Icon name="arrowRight" className="h-4 w-4" />
                </Link>
                <Link href="#modes" className="btn-secondary btn-lg">{t('home.moreModes')}</Link>
              </motion.div>

              {/* quick facts */}
              <motion.dl {...reveal(4)} className="mt-9 grid max-w-md grid-cols-3 divide-x divide-border border-y border-border py-4">
                <Fact value={GAMES.length} label={t('home.minigames')} />
                <Fact value={ZONES.length} label={t('nav.worlds')} />
                <Fact value={stars} label={t('rw.stars')} icon="star" />
              </motion.dl>
            </div>

            {/* Learning-path preview panel */}
            <motion.div {...reveal(2)} className="relative">
              <Link
                href="/map"
                className="card card-hover block overflow-hidden !p-0 focus-visible:ring-2 focus-visible:ring-brand"
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand">
                      <Icon name="map" className="h-4 w-4" />
                    </span>
                    <p className="font-display text-sm font-bold text-fg">{t('home.pathTitle')}</p>
                  </div>
                  <span className="text-xs font-semibold text-fg-faint">{doneCount}/{GAMES.length}</span>
                </div>
                <ol className="divide-y divide-border">
                  {ZONES.slice(0, 4).map((z, i) => {
                    const unlocked = i === 0 || stars >= z.unlockStars;
                    const zoneDone = z.games.filter((g) => completed[g]).length;
                    return (
                      <li key={z.slug} className="flex items-center gap-3 px-5 py-3">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${z.color} text-white ${unlocked ? '' : 'opacity-40 grayscale'}`}>
                          <Icon name={unlocked ? worldIcon(z.slug) : 'lock'} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-fg">{t(`world.${z.slug}.title`)}</p>
                          <p className="text-xs text-fg-faint">{t('map.stage', { n: i + 1 })}</p>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-fg-faint">
                          {hydrated && unlocked ? `${zoneDone}/${z.games.length}` : unlocked ? '' : t('map.unlockAt', { n: z.unlockStars })}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <div className="flex items-center justify-between bg-surface-2 px-5 py-3 text-sm font-bold text-brand">
                  {t('home.pathCta')}
                  <Icon name="arrowRight" className="h-4 w-4" />
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── MODES ────────────────────────────────────────────────────────── */}
      <section id="modes" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10 sm:px-6 sm:py-12">
        <SectionHeader title={t('home.modes')} description={t('home.modesSub')} />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODE_CARDS.map((m, i) => (
            <motion.div
              key={m.href}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + 0.05 * i, duration: 0.45, ease }}
            >
              <Link href={m.href} className="card card-hover group flex h-full flex-col focus-visible:ring-2 focus-visible:ring-brand">
                <div className="flex items-start justify-between">
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ring-1 ring-inset ${m.tone}`}>
                    <Icon name={m.icon} className="h-5 w-5" />
                  </span>
                  {m.soon && <span className="badge-neutral">{t('home.modeSoon')}</span>}
                </div>
                <h3 className="mt-4 font-display text-base font-extrabold text-fg">{t(m.title)}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-fg-soft">{t(m.sub)}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand">
                  {t('home.openMode')}
                  <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── GAMES PREVIEW ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <SectionHeader
          title={t('home.minigames')}
          description={t('home.minigamesSub', { n: GAMES.length })}
          action={<TextLink href="/map">{t('home.seeAll')}</TextLink>}
        />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {previewGames.map((g, i) => {
            const rec = hydrated ? completed[g.slug] : undefined;
            return (
              <motion.div
                key={g.slug}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + 0.04 * i, duration: 0.4, ease }}
              >
                <Link href={`/play/${g.slug}`} className="card card-hover flex items-center gap-3 !p-3.5 focus-visible:ring-2 focus-visible:ring-brand">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${g.color} text-white shadow-xs`}>
                    <Icon name={gameIcon(g.slug)} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-fg">{t(`game.${g.slug}.title`)}</p>
                    <p className="truncate text-xs text-fg-faint">{t(`game.${g.slug}.skill`)}</p>
                  </div>
                  {rec && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-600">
                      {rec.stars}
                      <Icon name="star" className="h-3.5 w-3.5 [&>path]:fill-current" />
                    </span>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-6 text-center">
          <Link href="/map" className="btn-secondary">{t('home.allGames')}</Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-fg-faint sm:flex-row sm:px-6">
          <span className="font-display font-bold text-fg-soft">KidsCode Quest</span>
          <span>{t('home.footer')}</span>
        </div>
      </footer>
    </main>
  );
}

function Fact({ value, label, icon }: { value: number; label: string; icon?: IconName }) {
  return (
    <div className="px-4 first:pl-0 last:pr-0">
      <dt className="text-xs font-semibold text-fg-faint">{label}</dt>
      <dd className="mt-0.5 inline-flex items-center gap-1 font-display text-2xl font-extrabold tabular-nums tracking-tight text-fg">
        {value}
        {icon && <Icon name={icon} className="h-4 w-4 text-amber-500 [&>path]:fill-current" />}
      </dd>
    </div>
  );
}
