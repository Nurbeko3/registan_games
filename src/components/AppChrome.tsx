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

/** Client wrapper: applies the chosen theme background, honors reduced-motion,
 *  hosts the celebration overlay, cloud sync, and the persistent tab bar. */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const bg = useThemeBg();
  const reduced = useGame((s) => s.settings.reducedMotion);
  const pathname = usePathname() ?? '/';
  const [arenaPlaying, setArenaPlaying] = useState(false);

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
        <div className={`min-h-screen ${bg} transition-colors ${showNav ? 'pb-24' : ''}`}>{children}</div>
        <Celebrations />
        <AccountSync />
        {/* Byte floats site-wide; hidden only during a live arena match (fullscreen). */}
        {!arenaPlaying && <Byte />}
        {showNav && <BottomNav />}
      </MotionConfig>
    </MentorProvider>
  );
}
