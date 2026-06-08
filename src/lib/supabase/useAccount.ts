'use client';

import { useEffect, useState } from 'react';
import { ACCOUNT_SESSION_EVENT, readSession } from './account';
import { isCloudEnabled } from './client';

/**
 * Reactive "is a student profile logged in" hook.
 *
 * `false` on server/first paint (hydration-safe), then reflects whether a
 * session token exists in localStorage. Stays live across login/logout via
 * `ACCOUNT_SESSION_EVENT` (same-tab) and `storage` (other tabs/devices).
 *
 * This is a lightweight presence check (token exists), matching the shop's
 * original gating — it intentionally does not await `accountResume()`, so it
 * updates instantly on logout/login without a network round trip.
 */
export function useAccountLoggedIn(): boolean {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(readSession() !== null);

    const sync = () => setLoggedIn(readSession() !== null);

    window.addEventListener(ACCOUNT_SESSION_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(ACCOUNT_SESSION_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return loggedIn;
}

/**
 * `true` only in cloud/classroom mode while no student profile is logged in —
 * i.e. exactly when reward-earning UI nudges ("log in to save your XP & coins")
 * should be shown. Always `false` offline (no Supabase env): there is no login
 * concept there, so nothing should be hidden/gated.
 */
export function useMustLogIn(): boolean {
  const loggedIn = useAccountLoggedIn();
  return isCloudEnabled() && !loggedIn;
}
