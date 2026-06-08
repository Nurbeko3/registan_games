'use client';

import { useEffect } from 'react';
import { isCloudEnabled } from '@/lib/supabase/client';
import { accountResume, accountSave, applyAccountToStore, readSession } from '@/lib/supabase/account';
import { useGame } from '@/store/useGame';

/** Fingerprint of progress — save only when this changes. */
function signature(): string {
  const s = useGame.getState();
  const stars = Object.values(s.completed).reduce((n, r) => n + r.stars, 0);
  return [
    s.xp, s.coins, stars, Object.keys(s.completed).length,
    s.unlockedAchievements.length, s.streak,
    s.avatarId, s.themeId, s.unlockedAvatars.length, s.unlockedThemes.length, s.playerName,
  ].join('|');
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void accountSave(); }, 1500);
}

/**
 * Headless: resumes the logged-in student account on mount, then debounce-saves
 * their progress to the cloud whenever it changes. No-ops when cloud is off or
 * nobody is logged in — the offline game is unaffected.
 */
export function AccountSync() {
  useEffect(() => {
    if (!isCloudEnabled()) return;
    let lastSig = signature();

    (async () => {
      const u = await accountResume();
      if (u) {
        // Account progress is authoritative on shared classroom devices. Never
        // push anonymous/previous-student local progress into the resumed account.
        applyAccountToStore(u);
      } else if (!readSession()) {
        // Cloud is on but nobody is logged in: clear any stale persisted guest
        // progress (e.g. coins earned before the earning-gate existed, or left
        // behind by a previous student) so the display never shows a phantom
        // balance. Device prefs (locale/settings) survive resetToGuest().
        useGame.getState().resetToGuest();
      }
      lastSig = signature();
    })();

    const unsub = useGame.subscribe(() => {
      const sig = signature();
      if (sig !== lastSig) {
        lastSig = sig;
        if (readSession()) scheduleSave();
      }
    });
    return unsub;
  }, []);

  return null;
}
