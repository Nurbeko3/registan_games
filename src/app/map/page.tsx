'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { useGame, useHydrated, selectTotalStars } from '@/store/useGame';
import { isCloudEnabled } from '@/lib/supabase/client';
import { ACCOUNT_SESSION_EVENT, accountResume, readSession } from '@/lib/supabase/account';
import { ZONES } from '@/data/worlds';
import { getGame } from '@/data/games';
import { Stars } from '@/components/ui/Bits';
import { Icon, gameIcon, worldIcon, type IconName } from '@/components/ui/Icon';
import { PageHeader, StatCard } from '@/components/ui/Primitives';
import { useT } from '@/lib/i18n';
import { DailyTargetBadge } from '@/components/DailyChallengeCard';

const ease = [0.22, 1, 0.36, 1] as const;

export default function WorldMapPage() {
  const t = useT();
  const hydrated = useHydrated();
  const reduce = useReducedMotion();
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
  const totalGames = ZONES.reduce((n, z) => n + z.games.length, 0);
  const doneGames = ZONES.reduce((n, z) => n + z.games.filter((g) => visibleCompleted[g]).length, 0);
  const unlockedWorlds = ZONES.filter((z, i) => i === 0 || visibleStars >= z.unlockStars).length;

  return (
    <main id="main" className="page-pad-bottom min-h-screen">
      <TopBar />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <PageHeader icon="map" eyebrow={t('nav.worlds')} title={t('map.title')} description={t('map.stars', { n: visibleStars })} />

        <div className="mt-6 hidden grid-cols-3 gap-3 sm:grid">
          <StatCard label={t('rw.stars')} value={visibleStars} icon="star" tone="amber" />
          <StatCard label={t('nav.worlds')} value={`${unlockedWorlds}/${ZONES.length}`} icon="unlock" tone="brand" />
          <StatCard label={t('home.minigames')} value={`${doneGames}/${totalGames}`} icon="checkCircle" tone="success" />
        </div>
        <dl className="card mt-6 grid grid-cols-3 divide-x divide-border !p-0 sm:hidden">
          <Metric label={t('rw.stars')} value={visibleStars} icon="star" tone="text-amber-500" />
          <Metric label={t('nav.worlds')} value={`${unlockedWorlds}/${ZONES.length}`} icon="unlock" tone="text-brand" />
          <Metric label={t('home.minigames')} value={`${doneGames}/${totalGames}`} icon="checkCircle" tone="text-success-600" />
        </dl>

        {/* learning path timeline */}
        <ol className="relative mt-8 space-y-5 sm:pl-10">
          <span aria-hidden className="absolute bottom-6 left-[18px] top-6 hidden w-px bg-border sm:block" />

          {ZONES.map((zone, zi) => {
            const unlocked = !hydrated ? zi === 0 : zi === 0 || visibleStars >= zone.unlockStars;
            const zoneDone = zone.games.filter((g) => visibleCompleted[g]).length;
            const allDone = unlocked && zone.games.length > 0 && zoneDone === zone.games.length;
            return (
              <motion.li
                key={zone.slug}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * zi, duration: 0.45, ease }}
                className="relative"
              >
                {/* timeline node */}
                <span
                  aria-hidden
                  className={`absolute -left-10 top-5 hidden h-[37px] w-[37px] place-items-center rounded-full border bg-surface font-display text-xs font-extrabold sm:grid ${
                    allDone
                      ? 'border-success-200 bg-success-50 text-success-600'
                      : unlocked
                        ? 'border-brand-200 text-brand'
                        : 'border-border text-fg-faint'
                  }`}
                >
                  {allDone ? <Icon name="check" className="h-4 w-4" /> : zi + 1}
                </span>

                <section className={`card overflow-hidden !p-0 ${unlocked ? '' : 'bg-surface-2'}`} aria-label={t(`world.${zone.slug}.title`)}>
                  <header className="flex items-center gap-3.5 px-5 py-4">
                    <span
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white ${
                        unlocked ? `bg-gradient-to-br ${zone.color} shadow-xs` : 'bg-surface-3 text-fg-faint'
                      }`}
                    >
                      <Icon name={unlocked ? worldIcon(zone.slug) : 'lock'} className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="eyebrow sm:hidden">{t('map.stage', { n: zi + 1 })}</p>
                      <h2 className={`font-display text-lg font-extrabold leading-tight ${unlocked ? 'text-fg' : 'text-fg-soft'}`}>
                        {t(`world.${zone.slug}.title`)}
                      </h2>
                      <p className="mt-0.5 text-sm text-fg-soft">
                        {unlocked ? t(`world.${zone.slug}.desc`) : t('map.unlockAt', { n: zone.unlockStars })}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {allDone ? (
                        <span className="badge-success"><Icon name="check" className="h-3 w-3" />{zoneDone}/{zone.games.length}</span>
                      ) : unlocked ? (
                        <span className="badge-brand">{zoneDone}/{zone.games.length}</span>
                      ) : (
                        <span className="badge-neutral">
                          <Icon name="lock" className="h-3 w-3" />
                          <span className="hidden sm:inline">{t('map.unlockAt', { n: zone.unlockStars })}</span>
                          <span className="sm:hidden">{zone.unlockStars}</span>
                        </span>
                      )}
                    </div>
                  </header>

                  {unlocked && zone.games.length > 0 && (
                    <div className="grid gap-2 border-t border-border bg-surface-2/60 p-3 sm:grid-cols-2">
                      {zone.games.map((slug) => {
                        const g = getGame(slug);
                        const stars = visibleCompleted[slug]?.stars ?? 0;
                        if (!g) return null;
                        return (
                          <Link
                            key={slug}
                            href={`/play/${slug}`}
                            className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-xs transition hover:border-border-strong hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand"
                          >
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${g.color} text-white`}>
                              <Icon name={gameIcon(slug)} className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-fg">{t(`game.${slug}.title`)}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <Stars count={hydrated ? stars : 0} size="text-xs" />
                                <span className="truncate text-xs text-fg-faint">{t(`game.${slug}.skill`)}</span>
                                <DailyTargetBadge kind="game" id={slug} />
                              </div>
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-brand">
                              {t('common.play')}
                              <Icon name="chevronRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {unlocked && zone.finale && (
                    <div className="flex items-center gap-3 border-t border-border px-5 py-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
                        <Icon name="trophy" className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-fg">{t('map.hero')}</p>
                        <p className="text-xs text-fg-soft">{t('map.heroSub')}</p>
                      </div>
                    </div>
                  )}
                </section>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}

/** Compact 3-up metric cell for phones (desktop uses StatCard). */
function Metric({ label, value, icon, tone }: { label: string; value: number | string; icon: IconName; tone: string }) {
  return (
    <div className="min-w-0 px-3 py-3">
      <dt className="flex items-center gap-1 truncate text-2xs font-semibold text-fg-faint">
        <Icon name={icon} className={`h-3.5 w-3.5 shrink-0 ${tone}`} />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-0.5 font-display text-lg font-extrabold tabular-nums leading-none text-fg">{value}</dd>
    </div>
  );
}
