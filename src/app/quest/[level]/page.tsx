'use client';

import { use } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/Primitives';
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
      <TopBar showBack backHref="/quest" />
      <section className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <EmptyState
          icon="compass"
          tone="brand"
          title={t('cc.notFound.title')}
          description={t('cc.notFound.body', { id: levelId })}
          action={
            <Link href="/quest" className="btn-primary">
              <Icon name="map" className="h-4 w-4" /> {t('cc.notFound.back')}
            </Link>
          }
        />
      </section>
    </main>
  );
}
