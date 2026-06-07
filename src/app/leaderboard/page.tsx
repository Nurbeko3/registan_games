'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { isCloudEnabled } from '@/lib/supabase/client';
import { fetchLeaderboard, type LeaderboardRow } from '@/lib/supabase/leaderboard';
import { readSession } from '@/lib/supabase/account';
import { levelForXp } from '@/lib/leveling';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const t = useT();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [mounted, setMounted] = useState(false);
  const [myUsername, setMyUsername] = useState<string | null>(null);

  // gate cloud-dependent UI until after mount → no SSR/client mismatch
  useEffect(() => {
    setMounted(true);
    setMyUsername(readSession()?.username ?? null);
    fetchLeaderboard().then(setRows);
  }, []);

  return (
    <main id="main" className="min-h-screen page-pad-bottom">
      <TopBar />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-extrabold">{t('lb.title')}</h1>
          <p className="mt-1 text-ink-soft">{t('lb.sub')}</p>
        </div>

        {/* before mount: neutral placeholder (matches server render) */}
        {!mounted && (
          <div className="mt-6 space-y-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-14" />)}</div>
        )}

        {/* cloud disabled → friendly fallback (offline build) */}
        {mounted && !isCloudEnabled() && (
          <div className="card mt-6 text-center">
            <Icon name="cloud" className="mx-auto h-11 w-11 text-grape" />
            <p className="mt-2 font-display font-extrabold">{t('lb.offline')}</p>
            <p className="mt-1 text-ink-soft">{t('lb.offlineSub')}</p>
            <Link href="/rewards" className="btn-primary mt-4">{t('lb.goCloud')}</Link>
          </div>
        )}

        {mounted && isCloudEnabled() && (
          <div className="mt-6">
            {rows === null && (
              <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-14" />)}</div>
            )}
            {rows && rows.length === 0 && (
              <div className="card text-center">
                <div className="text-4xl">🌱</div>
                <p className="mt-2 font-display font-extrabold">{t('lb.noChamps')}</p>
                <p className="mt-1 text-ink-soft">{t('lb.noChampsSub')}</p>
                <Link href="/map" className="btn-primary mt-4">{t('lb.playNow')}</Link>
              </div>
            )}
            {rows && rows.length > 0 && (
              <ol className="space-y-2">
                {rows.map((r, i) => {
                  const me = !!myUsername && r.username.toLowerCase() === myUsername.toLowerCase();
                  const isTop3 = i < 3;
                  return (
                    <motion.li
                      key={r.username}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.5) }}
                      className={`flex items-center gap-3 rounded-2xl p-3 shadow-card transition ${
                        me ? 'bg-grape-50 ring-2 ring-grape' : isTop3 ? 'bg-white ring-1 ring-sun/30' : 'bg-white'
                      }`}
                    >
                      <span className={`w-8 shrink-0 text-center font-display text-lg font-extrabold ${isTop3 ? '' : 'text-ink-faint'}`}>
                        {MEDALS[i] ?? <span className="text-base text-ink-faint">{i + 1}</span>}
                      </span>
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ${
                        isTop3 ? 'bg-sun/20 ring-1 ring-sun/40' : 'bg-grape-50'
                      }`}>
                        🚀
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display font-extrabold">
                          {r.display_name ?? t('lb.anon')}
                          {me && <span className="ml-1.5 rounded-full bg-grape px-2 py-0.5 text-[10px] font-extrabold text-white">{t('common.you')}</span>}
                        </p>
                        <p className="text-xs font-bold text-ink-faint">{t('common.level')} {levelForXp(r.xp)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="inline-flex items-center gap-1 font-display font-extrabold text-mango">
                          {r.total_stars}
                          <Icon name="star" className="h-4 w-4" />
                        </div>
                        <p className="text-xs font-bold text-ink-faint">{r.xp} XP</p>
                      </div>
                    </motion.li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
