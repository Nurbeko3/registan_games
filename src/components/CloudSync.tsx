'use client';

import { useEffect } from 'react';
import { isCloudEnabled } from '@/lib/supabase/client';
import { currentUserId } from '@/lib/supabase/auth';
import { pullProgress, schedulePush } from '@/lib/supabase/sync';
import { useGame } from '@/store/useGame';

/** A meaningful "fingerprint" of progress — push only when this changes. */
function signature(): string {
  const s = useGame.getState();
  const stars = Object.values(s.completed).reduce((n, r) => n + r.stars, 0);
  return [
    s.xp, s.coins, stars, Object.keys(s.completed).length,
    s.unlockedAchievements.length, s.streak,
    s.avatarId, s.themeId, s.unlockedAvatars.length, s.unlockedThemes.length, s.playerName,
  ].join('|');
}

/**
 * Headless component: when cloud is enabled AND a session exists, it pulls once
 * on mount, then pushes (debounced) whenever real progress changes. No-ops
 * entirely when Supabase isn't configured — the offline game is unaffected.
 */
export function CloudSync() {
  useEffect(() => {
    if (!isCloudEnabled()) return;
    let lastSig = signature();

    (async () => {
      const userId = await currentUserId();
      if (userId) await pullProgress(); // returning session → restore cloud
      lastSig = signature();
    })();

    const unsub = useGame.subscribe(() => {
      const sig = signature();
      if (sig !== lastSig) {
        lastSig = sig;
        schedulePush();
      }
    });
    return unsub;
  }, []);

  return null;
}
