'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { useGame, useHydrated, getAvatar } from '@/store/useGame';
import { levelState } from '@/lib/leveling';
import { ACCOUNT_SESSION_EVENT, accountResume, readSession } from '@/lib/supabase/account';
import { useMustLogIn } from '@/lib/supabase/useAccount';
import { Stat } from '@/components/ui/Bits';
import { Icon } from '@/components/ui/Icon';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useT } from '@/lib/i18n';

/** Persistent player HUD: avatar, level, XP bar, coins, streak. */
export function TopBar({ showBack = false }: { showBack?: boolean }) {
  const t = useT();
  const hydrated = useHydrated();
  const shouldReduceMotion = useReducedMotion();
  const coins = useGame((s) => s.coins);
  const streak = useGame((s) => s.streak);
  const avatarId = useGame((s) => s.avatarId);
  const xp = useGame((s) => s.xp);
  const ls = levelState(xp);
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

        {hydrated && mustLogIn && (
          <Link
            href="/rewards"
            className="hidden items-center gap-1.5 rounded-full bg-mint/15 px-3 py-1.5 text-xs font-extrabold text-mint-700 ring-1 ring-mint/30 transition hover:bg-mint/25 sm:flex"
            title={t('guest.winNudge')}
          >
            <Icon name="lock" className="h-3.5 w-3.5" />
            {t('guest.chip')}
          </Link>
        )}

        {hydrated && loggedIn && (
          <>
            {student && (
              <Link
                href="/rewards"
                className="hidden max-w-[150px] truncate rounded-full bg-mint/15 px-3 py-1.5 text-xs font-extrabold text-mint-700 ring-1 ring-mint/30 sm:block"
                title={t('topbar.currentStudent')}
              >
                {student}
              </Link>
            )}
            <Stat icon={<Icon name="flame" className="h-4 w-4" />} value={streak} label={t('common.dayStreak')} />
            <Stat icon={<Icon name="coin" className="h-4 w-4" />} value={coins} label={t('common.coins')} />
            <Link href="/rewards" className="flex items-center gap-2 rounded-full bg-white px-2.5 py-1.5 shadow-card" title={t('topbar.profile')}>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-grape-50 text-lg">{getAvatar(avatarId).emoji}</span>
              <span className="hidden font-display font-extrabold sm:inline">{t('common.lv')} {ls.level}</span>
            </Link>
          </>
        )}
      </div>

      {/* Profile level-progress — a game XP bar (level → next), not a page loader.
          Tap it to open the profile. */}
      {hydrated && loggedIn && (
        <Link
          href="/rewards"
          aria-label={t('topbar.profile')}
          className="group mx-auto flex max-w-4xl items-center gap-2 px-4 pb-2"
        >
          <span className="shrink-0 rounded-full bg-grape px-2 py-0.5 font-display text-[11px] font-extrabold text-white shadow-card">
            {t('common.lv')} {ls.level}
          </span>
          <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-grape-100 ring-1 ring-grape-100 transition group-hover:ring-grape-200">
            <motion.div
              initial={false}
              animate={{ width: `${Math.max(4, ls.progressPct)}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              className="relative h-full rounded-full bg-gradient-to-r from-grape via-bubble to-sun"
            >
              {/* sweeping shine — skipped when reduced-motion is on */}
              {!shouldReduceMotion && (
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-8 -skew-x-12 bg-white/45 blur-[2px]"
                  animate={{ x: ['-2rem', '14rem'] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.8 }}
                />
              )}
            </motion.div>
          </div>
          <span className="shrink-0 font-bold tabular-nums text-[11px] text-ink-faint">
            {ls.xpIntoLevel}/{ls.xpForNextLevel} XP
          </span>
        </Link>
      )}
    </header>
  );
}
