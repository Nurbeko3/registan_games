/**
 * Case Files cloud sync — progress + leaderboard via Supabase SECURITY DEFINER RPCs.
 *
 * OFFLINE-FIRST CONTRACT (do not violate): every export returns a safe default
 * when cloud is unavailable. `supabase` may be null (no env, SSR, init error).
 * This module never throws. Mirrors src/lib/codecaster/cloud.ts.
 *
 * RPC surface (supabase/migrations/0011_case_files.sql):
 *   kcq_case_save_progress(p_token, p_case_id, p_stars) → upsert best result;
 *     the SERVER derives caseXp from stars (never trusts a client XP).
 *   kcq_case_leaderboard() → public ranking view (no auth).
 */

import { supabase, isCloudEnabled } from '@/lib/supabase/client';
import { readSession } from '@/lib/supabase/account';

export interface CaseLeaderboardEntry {
  userId: string;
  displayName: string;
  totalCaseXp: number;
  casesSolved: number;
  cases3star: number;
}

interface RawLeaderboardRow {
  user_id: string;
  display_name: string;
  total_case_xp: number;
  cases_solved: number;
  cases_3star: number;
}

/**
 * Persist a case result to Supabase (account players only). Monotonic + anti-farm
 * server-side: stars never downgrade and caseXp is derived from stars on the server.
 * Offline / no session → returns false (caller keeps local store state).
 */
export async function saveCaseProgress(caseId: string, stars: number): Promise<boolean> {
  if (!isCloudEnabled()) return false;
  const session = readSession();
  if (!session) return false;
  try {
    const { data, error } = await supabase!.rpc('kcq_case_save_progress', {
      p_token: session.token,
      p_case_id: caseId,
      p_stars: Math.max(0, Math.min(3, Math.round(stars))),
    });
    return !error && !!data?.ok;
  } catch {
    return false;
  }
}

/** Public Case Files leaderboard (top 100 by total case XP). Offline → []. */
export async function fetchCaseLeaderboard(): Promise<CaseLeaderboardEntry[]> {
  if (!isCloudEnabled()) return [];
  try {
    const { data, error } = await supabase!.rpc('kcq_case_leaderboard');
    if (error || !data?.ok) return [];
    const rows: RawLeaderboardRow[] = data.rows ?? [];
    return rows.map((r) => ({
      userId: r.user_id ?? '',
      displayName: r.display_name ?? '',
      totalCaseXp: r.total_case_xp ?? 0,
      casesSolved: r.cases_solved ?? 0,
      cases3star: r.cases_3star ?? 0,
    }));
  } catch {
    return [];
  }
}
