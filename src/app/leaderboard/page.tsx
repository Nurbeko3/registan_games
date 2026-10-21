'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { isCloudEnabled } from '@/lib/supabase/client';
import { fetchLeaderboard, type LeaderboardRow } from '@/lib/supabase/leaderboard';
import { readSession } from '@/lib/supabase/account';
import { levelForXp } from '@/lib/leveling';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/Primitives';
import { useT } from '@/lib/i18n';

const ease = [0.22, 1, 0.36, 1] as const;

/** Rank badge: top-3 get medal tones (gold / silver / bronze), the rest a neutral number. */
function RankBadge({ index }: { index: number }) {
  const tone =
    index === 0
      ? 'bg-amber-100 text-amber-700 ring-amber-200'
      : index === 1
        ? 'bg-surface-3 text-fg-soft ring-border-strong'
        : index === 2
          ? 'bg-warning-50 text-warning-700 ring-warning-100'
          : 'bg-transparent text-fg-faint ring-transparent';
  return (
    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-sm font-extrabold tabular-nums ring-1 ring-inset ${tone}`}>
      {index + 1}
    </span>
  );
}

function SkeletonRows() {
  return (
    <div className="card divide-y divide-border !p-0">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-3.5 w-14" />
        </div>
      ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const t = useT();
  const reduce = useReducedMotion();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [mounted, setMounted] = useState(false);
  const [myUsername, setMyUsername] = useState<string | null>(null);

  // gate cloud-dependent UI until after mount → no SSR/client mismatch
  useEffect(() => {
    setMounted(true);
    setMyUsername(readSession()?.username ?? null);
    fetchLeaderboard().then(setRows);
  }, []);

  const myIndex = rows && myUsername ? rows.findIndex((r) => r.username.toLowerCase() === myUsername.toLowerCase()) : -1;

  return (
    <main id="main" className="page-pad-bottom min-h-screen">
      <TopBar />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PageHeader
          icon="rank"
          eyebrow={t('nav.ranks')}
          title={t('lb.title')}
          description={t('lb.sub')}
          actions={
            mounted && isCloudEnabled() && myIndex >= 0 ? (
              <span className="badge-brand">{t('common.you')} · #{myIndex + 1}</span>
            ) : undefined
          }
        />

        <div className="mt-6">
          {/* before mount: neutral placeholder (matches server render) */}
          {!mounted && <SkeletonRows />}

          {/* cloud disabled → friendly fallback (offline build) */}
          {mounted && !isCloudEnabled() && (
            <EmptyState
              icon="cloud"
              tone="brand"
              title={t('lb.offline')}
              description={t('lb.offlineSub')}
              action={<Link href="/rewards" className="btn-primary">{t('lb.goCloud')}</Link>}
            />
          )}

          {mounted && isCloudEnabled() && (
            <>
              {rows === null && <SkeletonRows />}
              {rows && rows.length === 0 && (
                <EmptyState
                  icon="trophy"
                  tone="brand"
                  title={t('lb.noChamps')}
                  description={t('lb.noChampsSub')}
                  action={<Link href="/map" className="btn-primary">{t('lb.playNow')}</Link>}
                />
              )}
              {rows && rows.length > 0 && (
                <div className="card !p-0">
                  <div className="hidden grid-cols-[2rem_2.25rem_1fr_auto_auto] items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5 text-2xs font-bold uppercase tracking-wide text-fg-faint sm:grid">
                    <span>{t('lb.rank')}</span>
                    <span />
                    <span>{t('lb.player')}</span>
                    <span className="w-16 text-right">{t('rw.stars')}</span>
                    <span className="w-20 text-right">XP</span>
                  </div>
                  <ol className="divide-y divide-border">
                    {rows.map((r, i) => {
                      const me = !!myUsername && r.username.toLowerCase() === myUsername.toLowerCase();
                      const isTop3 = i < 3;
                      return (
                        <motion.li
                          key={r.username}
                          initial={reduce ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.03, 0.4), duration: 0.35, ease }}
                          className={`grid grid-cols-[2rem_2.25rem_1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[2rem_2.25rem_1fr_auto_auto] ${
                            me ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' : ''
                          }`}
                        >
                          <RankBadge index={i} />
                          <span
                            className={`grid h-9 w-9 place-items-center rounded-full ${
                              isTop3 ? 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100' : 'bg-surface-2 text-fg-faint'
                            }`}
                          >
                            <Icon name={isTop3 ? 'crown' : 'user'} className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-sm font-bold text-fg">
                              <span className="truncate">{r.display_name ?? t('lb.anon')}</span>
                              {me && <span className="badge-brand shrink-0">{t('common.you')}</span>}
                            </p>
                            <p className="text-xs text-fg-faint">{t('common.level')} {levelForXp(r.xp)}</p>
                          </div>
                          <div className="inline-flex w-16 items-center justify-end gap-1 font-display text-sm font-extrabold tabular-nums text-amber-600">
                            {r.total_stars}
                            <Icon name="star" className="h-3.5 w-3.5 [&>path]:fill-current" />
                          </div>
                          <div className="hidden w-20 text-right text-sm font-semibold tabular-nums text-fg-soft sm:block">{r.xp} XP</div>
                        </motion.li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
