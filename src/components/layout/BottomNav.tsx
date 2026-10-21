'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

const TABS: { href: string; icon: IconName; key: string }[] = [
  { href: '/', icon: 'home', key: 'nav.home' },
  { href: '/map', icon: 'map', key: 'nav.worlds' },
  { href: '/quest', icon: 'sword', key: 'nav.quest' },
  { href: '/leaderboard', icon: 'rank', key: 'nav.ranks' },
  { href: '/rewards', icon: 'profile', key: 'nav.profile' },
];

const isActive = (href: string, path: string) => (href === '/' ? path === '/' : path.startsWith(href));

/** Mobile/tablet tab bar (hidden on ≥lg where the header carries the primary nav). */
export function BottomNav() {
  const t = useT();
  const pathname = usePathname() ?? '/';

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur-xl lg:hidden"
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
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 pb-1.5 pt-1.5 transition-colors ${
                active ? 'text-brand' : 'text-fg-faint hover:text-fg-soft'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="bottomnav-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-x-2 top-0.5 h-[3px] rounded-full bg-brand"
                />
              )}
              <Icon name={tab.icon} className="h-[22px] w-[22px]" />
              <span className="truncate text-[10px] font-bold leading-none">{t(tab.key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
