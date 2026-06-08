'use client';

import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import { Icon } from '@/components/ui/Icon';
import { Stars } from '@/components/ui/Bits';
import { CODECASTER_LEVELS } from '@/data/codecaster/levels';
import { useGame, useHydrated } from '@/store/useGame';
import { useT } from '@/lib/i18n';

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

  return (
    <main id="main" className="page-pad-bottom">
      <TopBar />

      {/* ── header ── */}
      <section className="mx-auto max-w-3xl px-5 py-6">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-sky to-grape p-6 text-white shadow-toy">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20">
              <Icon name="sword" className="h-7 w-7" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-extrabold">{t('quest.title')}</h1>
              <p className="mt-1 font-bold text-white/80">{t('quest.sub')}</p>
            </div>
          </div>
        </div>

        {/* ── level list ── */}
        <ol className="mt-4 space-y-2">
          {CODECASTER_LEVELS.map((lvl, i) => {
            const isBoss = lvl.victory.defeatBoss === true;
            const stars = codecaster[lvl.id]?.stars ?? 0;
            const prevStars = i === 0 ? 1 : (codecaster[CODECASTER_LEVELS[i - 1]!.id]?.stars ?? 0);
            // Before hydration, only L01 shows unlocked — avoids an SSR/client
            // mismatch; once hydrated the real per-student unlock state shows.
            const unlocked = i === 0 || (hydrated && prevStars >= 1);

            const card = (
              <div
                className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition ${
                  unlocked
                    ? 'border-grape-100 bg-white hover:border-grape-400 hover:shadow-card'
                    : 'border-grape-100/60 bg-white/60'
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display font-extrabold text-white ${
                    isBoss ? 'bg-gradient-to-br from-bubble to-grape' : 'bg-gradient-to-br from-sky to-grape'
                  } ${unlocked ? '' : 'opacity-50'}`}
                >
                  {isBoss ? <Icon name="crown" className="h-5 w-5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-display font-extrabold ${unlocked ? 'text-ink' : 'text-ink-faint'}`}>
                    {lvl.title}
                  </p>
                  <p className="truncate text-xs font-bold text-ink-faint">
                    {t('quest.learn')}: {lvl.concept}
                  </p>
                </div>
                {hydrated && unlocked && stars > 0 ? (
                  <Stars count={stars} size="text-sm" />
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-grape-50 px-3 py-1 text-[11px] font-extrabold text-grape">
                    <Icon name={unlocked ? 'unlock' : 'lock'} className="h-3 w-3" />
                    {unlocked ? t('quest.start') : t('quest.locked')}
                  </span>
                )}
              </div>
            );

            return (
              <li key={lvl.id}>
                {unlocked ? (
                  <Link
                    href={`/quest/${lvl.id}`}
                    className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape focus-visible:ring-offset-2"
                  >
                    {card}
                  </Link>
                ) : (
                  <div aria-disabled="true">{card}</div>
                )}
              </li>
            );
          })}
        </ol>

        <Link href="/#modes" className="btn-ghost mt-5 inline-flex items-center gap-2">
          <Icon name="home" className="h-4 w-4" /> {t('home.modes')}
        </Link>
      </section>
    </main>
  );
}
