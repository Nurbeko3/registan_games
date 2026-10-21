'use client';

import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import { Icon } from '@/components/ui/Icon';
import { Stars, ProgressBar } from '@/components/ui/Bits';
import { PageHeader } from '@/components/ui/Primitives';
import { CODECASTER_LEVELS } from '@/data/codecaster/levels';
import { useGame, useHydrated } from '@/store/useGame';
import { useT } from '@/lib/i18n';
import { DailyTargetBadge } from '@/components/DailyChallengeCard';

/**
 * Codecaster — Code Dungeon level select.
 *
 * Sequential unlock: L01 is always open; L(n) opens once L(n-1) has earned at
 * least 1 star. Earned stars are read from `useGame(s => s.codecaster)` and
 * gated on `useHydrated()` so SSR and first paint agree (no lock flicker).
 */
export default function QuestPage() {
  const t = useT();
  const hydrated = useHydrated();
  const codecaster = useGame((s) => s.codecaster);

  const maxStars = CODECASTER_LEVELS.length * 3;
  const earnedStars = hydrated
    ? CODECASTER_LEVELS.reduce((sum, lvl) => sum + (codecaster[lvl.id]?.stars ?? 0), 0)
    : 0;
  const clearedCount = hydrated
    ? CODECASTER_LEVELS.filter((lvl) => (codecaster[lvl.id]?.stars ?? 0) >= 1).length
    : 0;

  return (
    <main id="main" className="page-pad-bottom">
      <TopBar />

      <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          icon="sword"
          eyebrow={t('nav.quest')}
          title={t('quest.title')}
          description={t('quest.sub')}
        />

        {/* overall progress */}
        <div className="card mt-6 !p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-600">
                <Icon name="star" className="h-4 w-4 [&>path]:fill-current" />
              </span>
              <div>
                <p className="text-xs font-semibold text-fg-faint">{t('rw.stars')}</p>
                <p className="font-display text-lg font-extrabold leading-none tabular-nums text-fg">
                  {earnedStars}
                  <span className="text-fg-faint"> / {maxStars}</span>
                </p>
              </div>
            </div>
            <p className="text-xs font-semibold tabular-nums text-fg-faint">
              {clearedCount}/{CODECASTER_LEVELS.length}
            </p>
          </div>
          <ProgressBar pct={(earnedStars / maxStars) * 100} className="bg-amber-500" size="h-1.5" track="bg-surface-3 mt-3" />
        </div>

        {/* level list */}
        <ol className="panel mt-4 divide-y divide-border">
          {CODECASTER_LEVELS.map((lvl, i) => {
            const isBoss = lvl.victory.defeatBoss === true;
            const stars = codecaster[lvl.id]?.stars ?? 0;
            const prevStars = i === 0 ? 1 : (codecaster[CODECASTER_LEVELS[i - 1]!.id]?.stars ?? 0);
            // Before hydration, only L01 shows unlocked — avoids an SSR/client
            // mismatch; once hydrated the real per-student unlock state shows.
            const unlocked = i === 0 || (hydrated && prevStars >= 1);
            const showStars = hydrated && unlocked && stars > 0;

            const row = (
              <div className={`flex items-center gap-3.5 px-4 py-3.5 ${unlocked ? '' : 'opacity-60'}`}>
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg font-display text-sm font-extrabold ring-1 ring-inset ${
                    isBoss
                      ? 'bg-violet-50 text-violet-600 ring-violet-100'
                      : 'bg-brand-50 text-brand ring-brand-100'
                  }`}
                >
                  {isBoss ? <Icon name="crown" className="h-5 w-5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-bold ${unlocked ? 'text-fg' : 'text-fg-soft'}`}>{t(lvl.title)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="badge-neutral normal-case tracking-normal">
                      {t('quest.learn')}: {t(lvl.concept)}
                    </span>
                    <DailyTargetBadge kind="quest" id={lvl.id} />
                  </div>
                </div>
                {showStars ? (
                  <Stars count={stars} size="text-sm" />
                ) : unlocked ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-brand">
                    {t('quest.start')}
                    <Icon name="chevronRight" className="h-4 w-4" />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-fg-faint">
                    <Icon name="lock" className="h-3.5 w-3.5" />
                    {t('quest.locked')}
                  </span>
                )}
              </div>
            );

            return (
              <li key={lvl.id} className="first:rounded-t-2xl last:rounded-b-2xl">
                {unlocked ? (
                  <Link
                    href={`/quest/${lvl.id}`}
                    className="block transition-colors hover:bg-surface-2 focus-visible:relative focus-visible:z-10 first:rounded-t-2xl last:rounded-b-2xl"
                  >
                    {row}
                  </Link>
                ) : (
                  <div aria-disabled="true">{row}</div>
                )}
              </li>
            );
          })}
        </ol>

        <Link href="/#modes" className="btn-secondary mt-5">
          <Icon name="layers" className="h-4 w-4" /> {t('home.modes')}
        </Link>
      </section>
    </main>
  );
}
