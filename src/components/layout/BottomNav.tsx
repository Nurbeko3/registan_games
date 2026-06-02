'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';

const TABS = [
  { href: '/', icon: '🏠', key: 'nav.home' },
  { href: '/map', icon: '🗺️', key: 'nav.worlds' },
  { href: '/arena', icon: '⚔️', key: 'nav.arena' },
  { href: '/party', icon: '🎉', key: 'nav.party' },
  { href: '/leaderboard', icon: '🏆', key: 'nav.ranks' },
  { href: '/rewards', icon: '🎁', key: 'nav.profile' },
];

const isActive = (href: string, path: string) => (href === '/' ? path === '/' : path.startsWith(href));

/** Persistent, mobile-first tab bar — the primary way kids move around. */
export function BottomNav() {
  const t = useT();
  const pathname = usePathname() ?? '/';

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-grape-100/70 bg-white/90 backdrop-blur-lg safe-bottom"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-md items-stretch px-2 pt-1">
        {TABS.map((tab) => {
          const active = isActive(tab.href, pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5"
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-x-1.5 inset-y-0.5 -z-0 rounded-2xl bg-grape-50"
                />
              )}
              <motion.span
                animate={{ scale: active ? 1.15 : 1, y: active ? -1 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className={`relative text-2xl ${active ? '' : 'opacity-55 grayscale'}`}
              >
                {tab.icon}
              </motion.span>
              <span className={`relative text-[11px] font-extrabold ${active ? 'text-grape' : 'text-ink-faint'}`}>
                {t(tab.key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
