'use client';

import { use } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import { Icon } from '@/components/ui/Icon';
import { PlayScreen } from '@/components/codecaster/PlayScreen';
import { getLevel } from '@/data/codecaster/levels';
import { useT } from '@/lib/i18n';

/**
 * Codecaster — play a single dungeon level.
 *
 * Dynamic route param is a React 19 Promise — unwrap with `use(params)`
 * (mirrors `/play/[game]/page.tsx`). Delegates all gameplay to `PlayScreen`;
 * this file only resolves the level and handles the not-found case kindly.
 */
export default function QuestLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level: levelId } = use(params);
  const level = getLevel(levelId);

  if (!level) {
    return <NotFoundLevel levelId={levelId} />;
  }

  return <PlayScreen level={level} />;
}

function NotFoundLevel({ levelId }: { levelId: string }) {
  const t = useT();
  return (
    <main id="main" className="page-pad-bottom">
      <TopBar showBack />
      <section className="mx-auto flex max-w-lg flex-col items-center px-5 py-16 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-grape-50 text-grape">
          <Icon name="compass" className="h-8 w-8" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-ink">{t('cc.notFound.title')}</h1>
        <p className="mt-2 font-bold text-ink-soft">{t('cc.notFound.body', { id: levelId })}</p>
        <Link href="/quest" className="btn-primary mt-6 inline-flex items-center gap-2">
          <Icon name="map" className="h-4 w-4" /> {t('cc.notFound.back')}
        </Link>
      </section>
    </main>
  );
}
