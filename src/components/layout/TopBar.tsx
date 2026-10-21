'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGame, useHydrated } from '@/store/useGame';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { levelState } from '@/lib/leveling';
import { ACCOUNT_SESSION_EVENT, accountResume, readSession } from '@/lib/supabase/account';
import { useMustLogIn } from '@/lib/supabase/useAccount';
import { Stat } from '@/components/ui/Bits';
import { Icon, type IconName } from '@/components/ui/Icon';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useT } from '@/lib/i18n';
import { studentRankForLevel } from '@/lib/studentRanks';

/** Primary navigation shown in the header on ≥lg screens (smaller screens use BottomNav). */
export const PRIMARY_NAV: { href: string; icon: IconName; key: string }[] = [
  { href: '/map', icon: 'map', key: 'nav.worlds' },
  { href: '/quest', icon: 'sword', key: 'nav.quest' },
  { href: '/arena', icon: 'arena', key: 'nav.arena' },
  { href: '/case', icon: 'search', key: 'nav.case' },
  { href: '/leaderboard', icon: 'rank', key: 'nav.ranks' },
  { href: '/shop', icon: 'bag', key: 'nav.shop' },
];

export const isNavActive = (href: string, path: string) => (href === '/' ? path === '/' : path.startsWith(href));

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 rounded-lg ${className}`} aria-label="KidsCode Quest — home">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white shadow-xs">
        <Icon name="binary" className="h-4 w-4" />
      </span>
      <span className="whitespace-nowrap font-display text-[15px] font-extrabold tracking-tight text-fg">
        KidsCode<span className="text-brand"> Quest</span>
      </span>
    </Link>
  );
}

/** Persistent app header: brand, primary nav (desktop), language, player HUD. */
export function TopBar({ showBack = false, backHref = '/map' }: { showBack?: boolean; backHref?: string }) {
  const t = useT();
  const hydrated = useHydrated();
  const pathname = usePathname() ?? '/';
  const coins = useGame((s) => s.coins);
  const streak = useGame((s) => s.streak);
  const avatarId = useGame((s) => s.avatarId);
  const xp = useGame((s) => s.xp);
  const ls = levelState(xp);
  const rank = studentRankForLevel(ls.level);
  const mustLogIn = useMustLogIn();
  const [loggedIn, setLoggedIn] = useState(false);
  const [student, setStudent] = useState('');

  useEffect(() => {
    let alive = true;
    const sync = () => {
      if (!readSession()) {
        setLoggedIn(false);
        setStudent('');
        return;
      }
      const session = readSession();
      if (session?.username) setStudent(`@${session.username}`);
      accountResume().then((user) => {
        if (!alive) return;
        setLoggedIn(!!user);
        setStudent(user ? (user.display_name || `@${user.username}`) : '');
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

  const showHud = hydrated && loggedIn;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        {showBack ? (
          <Link href={backHref} className="btn-secondary btn-sm -ml-1 gap-1.5 pl-2" aria-label={t('common.back')}>
            <Icon name="arrowLeft" className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common.back')}</span>
          </Link>
        ) : (
          <Logo />
        )}

        {/* desktop primary nav */}
        {!showBack && (
          <nav className="ml-3 hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            {PRIMARY_NAV.map((item) => {
              const active = isNavActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-bold transition-colors ${
                    active ? 'text-fg' : 'text-fg-soft hover:bg-surface-3 hover:text-fg'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="topnav-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 -z-10 rounded-lg bg-surface shadow-xs ring-1 ring-border"
                    />
                  )}
                  <Icon name={item.icon} className="h-4 w-4 opacity-80" />
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex-1" />

        <LanguageSwitcher className="hidden sm:block" />

        {hydrated && mustLogIn && (
          <Link href="/rewards" className="btn-primary btn-sm gap-1.5" title={t('guest.winNudge')}>
            <Icon name="user" className="h-3.5 w-3.5" />
            <span>{t('guest.cta')}</span>
          </Link>
        )}

        {showHud && (
          <>
            <div className="hidden items-center gap-1.5 sm:flex">
              <Stat icon={<Icon name="flame" className="h-4 w-4" />} value={streak} label={t('common.dayStreak')} tone="warning" />
              <Stat icon={<Icon name="coin" className="h-4 w-4" />} value={coins} label={t('common.coins')} tone="amber" />
            </div>
            <Link
              href="/rewards"
              className="group flex h-9 items-center gap-2 rounded-lg border border-border bg-surface pl-1 pr-2.5 shadow-xs transition hover:border-border-strong"
              title={student ? `${student} · ${t('topbar.profile')}` : t('topbar.profile')}
            >
              <AvatarBadge avatar={avatarId} className="h-7 w-7 text-base" rounded="rounded-md" bg="bg-brand-50" />
              <span className="hidden min-w-0 flex-col leading-none sm:flex">
                <span className="truncate text-[11px] font-bold text-fg">{student || t(rank.titleKey)}</span>
                <span className="mt-0.5 text-2xs font-semibold text-fg-faint">{t('common.lv')} {ls.level} · {ls.xpIntoLevel}/{ls.xpForNextLevel} XP</span>
              </span>
              <span className="font-display text-xs font-bold text-fg sm:hidden">{t('common.lv')} {ls.level}</span>
            </Link>
          </>
        )}
      </div>

      {/* XP progress hairline — tap to open the profile */}
      {showHud && (
        <Link href="/rewards" aria-label={t('topbar.profile')} className="block">
          <div className="h-[3px] w-full bg-border/60">
            <motion.div
              initial={false}
              animate={{ width: `${Math.max(2, ls.progressPct)}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 24 }}
              className="h-full bg-brand"
            />
          </div>
        </Link>
      )}
    </header>
  );
}
