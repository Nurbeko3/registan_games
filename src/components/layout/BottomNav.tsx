'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

const TABS = [
  { href: '/', icon: 'home', key: 'nav.home' },
  { href: '/map', icon: 'map', key: 'nav.worlds' },
  { href: '/leaderboard', icon: 'rank', key: 'nav.ranks' },
  { href: '/rewards', icon: 'profile', key: 'nav.profile' },
] as const;

const isActive = (href: string, path: string) => (href === '/' ? path === '/' : path.startsWith(href));
type TabIcon = (typeof TABS)[number]['icon'];

/** Persistent, mobile-first tab bar — the primary way kids move around. */
export function BottomNav() {
  const t = useT();
  const pathname = usePathname() ?? '/';

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-grape-100/70 bg-white/90 shadow-[0_-14px_34px_rgba(38,31,71,0.08)] backdrop-blur-xl safe-bottom"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-md items-stretch gap-1.5 px-3 pt-1.5">
        {TABS.map((tab) => {
          const active = isActive(tab.href, pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors ${
                active ? 'text-grape' : 'text-ink-faint hover:text-ink-soft'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-x-1 inset-y-0.5 -z-0 rounded-xl bg-grape-50 ring-1 ring-grape-100"
                />
              )}
              <motion.span
                animate={{ scale: active ? 1.06 : 1, y: active ? -1 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="relative grid h-6 w-6 place-items-center"
              >
                <Icon name={tab.icon} className="h-[22px] w-[22px]" />
              </motion.span>
              <span className="relative truncate text-[10px] font-extrabold leading-tight">
                {t(tab.key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
