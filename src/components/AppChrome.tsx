'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import { useGame, getTheme } from '@/store/useGame';
import { Celebrations } from '@/components/Celebrations';
import { CloudSync } from '@/components/CloudSync';
import { BottomNav } from '@/components/layout/BottomNav';

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

  // Mark the store hydrated after first paint so locale/theme switch to the
  // persisted values without an SSR mismatch (see store note on setHydrated).
  useEffect(() => { useGame.getState().setHydrated(); }, []);

  // single-player runner & live battle rooms are fullscreen → no bottom nav there
  const showNav = !pathname.startsWith('/play') && !/^\/party\/.+/.test(pathname);

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <div className={`min-h-screen ${bg} transition-colors ${showNav ? 'pb-24' : ''}`}>{children}</div>
      <Celebrations />
      <CloudSync />
      {showNav && <BottomNav />}
    </MotionConfig>
  );
}
