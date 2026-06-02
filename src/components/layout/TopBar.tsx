'use client';

import Link from 'next/link';
import { useGame, useHydrated, getAvatar } from '@/store/useGame';
import { levelState } from '@/lib/leveling';
import { Stat, ProgressBar } from '@/components/ui/Bits';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useT } from '@/lib/i18n';

/** Persistent player HUD: avatar, level, XP bar, coins, streak. */
export function TopBar({ showBack = false }: { showBack?: boolean }) {
  const t = useT();
  const hydrated = useHydrated();
  const coins = useGame((s) => s.coins);
  const streak = useGame((s) => s.streak);
  const avatarId = useGame((s) => s.avatarId);
  const xp = useGame((s) => s.xp);
  const ls = levelState(xp);

  return (
    <header className="sticky top-0 z-30 border-b border-grape-100/60 bg-cloud/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5">
        {showBack ? (
          <Link href="/map" className="btn-ghost px-3 py-1.5 text-sm" aria-label={t('common.map')}>{t('common.map')}</Link>
        ) : (
          <Link href="/" className="font-display text-lg font-extrabold">KidsCode<span className="text-grape"> Quest</span></Link>
        )}

        <div className="flex-1" />

        <LanguageSwitcher />

        {hydrated && (
          <>
            <Stat icon="🔥" value={streak} label={t('common.dayStreak')} />
            <Stat icon="💰" value={coins} label={t('common.coins')} />
            <Link href="/rewards" className="flex items-center gap-2 rounded-full bg-white px-2.5 py-1.5 shadow-card" title={t('topbar.profile')}>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-grape-50 text-lg">{getAvatar(avatarId).emoji}</span>
              <span className="hidden font-display font-extrabold sm:inline">{t('common.lv')} {ls.level}</span>
            </Link>
          </>
        )}
      </div>

      {hydrated && (
        <div className="mx-auto max-w-4xl px-4 pb-2">
          <ProgressBar pct={ls.progressPct} className="bg-gradient-to-r from-grape to-bubble" />
        </div>
      )}
    </header>
  );
}
