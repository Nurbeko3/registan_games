'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import { useGame, getTheme } from '@/store/useGame';
import { Celebrations } from '@/components/Celebrations';
import { AccountSync } from '@/components/AccountSync';
import { BottomNav } from '@/components/layout/BottomNav';
import { Byte } from '@/components/Byte';
import { MentorProvider } from '@/lib/mentor/context';

// re-export helper so store stays the single source
function useThemeBg(): string {
  const themeId = useGame((s) => s.themeId);
  return getTheme(themeId).bg;
}

/** Keeps `<html class="dark">` in sync with the persisted colour-scheme setting
 *  (and with the OS when the setting is `system`). The inline script in
 *  `layout.tsx` applies the same rule before first paint. */
function useColorScheme() {
  const hydrated = useGame((s) => s.hydrated);
  const scheme = useGame((s) => s.settings.colorScheme ?? 'system');
  useEffect(() => {
    if (!hydrated) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = scheme === 'dark' || (scheme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [hydrated, scheme]);
}

/** Client wrapper: applies the chosen theme background, honors reduced-motion,
 *  hosts the celebration overlay, cloud sync, and the persistent tab bar. */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const bg = useThemeBg();
  const reduced = useGame((s) => s.settings.reducedMotion);
  const pathname = usePathname() ?? '/';
  const [arenaPlaying, setArenaPlaying] = useState(false);
  useColorScheme();

  // Mark the store hydrated after first paint so locale/theme switch to the
  // persisted values without an SSR mismatch (see store note on setHydrated).
  useEffect(() => { useGame.getState().setHydrated(); }, []);
  useEffect(() => {
    const onArenaChrome = (event: Event) => {
      const detail = (event as CustomEvent<{ playing?: boolean }>).detail;
      setArenaPlaying(detail?.playing === true);
    };
    window.addEventListener('kcq:arena-chrome', onArenaChrome);
    return () => window.removeEventListener('kcq:arena-chrome', onArenaChrome);
  }, []);

  // single-player runner, live battle rooms & the admin panel are fullscreen → no bottom nav there
  const showNav = !arenaPlaying && !pathname.startsWith('/play') && !pathname.startsWith('/admin') && !/^\/party\/.+/.test(pathname);

  return (
    <MentorProvider>
      <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
        <div className={`min-h-screen ${bg} transition-colors`}>{children}</div>
        <Celebrations />
        <AccountSync />
        {/* Byte floats site-wide; hidden during a live arena match (fullscreen) and in the teacher panel. */}
        {!arenaPlaying && !pathname.startsWith('/admin') && <Byte />}
        {showNav && <BottomNav />}
      </MotionConfig>
    </MentorProvider>
  );
}
