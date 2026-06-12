import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Optional Supabase client — OFFLINE-FIRST.
 *
 * If the env vars are missing (or we're on the server), `supabase` is `null`
 * and every cloud feature no-ops. The game keeps working from localStorage.
 * Nothing here ever throws.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function init(): SupabaseClient | null {
  if (typeof window === 'undefined') return null; // client-side only
  if (!url || !key) return null; // cloud disabled
  try {
    return createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      // Arena netcode flushes at ~12 Hz on top of room traffic. Current
      // realtime-js has no client-side throttle (older builds dropped sends
      // past 10/s via this param) — kept as documented headroom in case the
      // limiter returns. Real ceilings are the tenant quotas.
      realtime: { params: { eventsPerSecond: 30 } },
    });
  } catch {
    return null; // never crash the app over cloud setup
  }
}

export const supabase: SupabaseClient | null = init();

/** True only when a Supabase client is configured and usable. */
export const isCloudEnabled = (): boolean => supabase !== null;
