import { supabase, isCloudEnabled } from './client';

export interface LeaderboardRow {
  username: string;
  display_name: string | null;
  xp: number;
  total_stars: number;
}

/** Top 100 players by XP. Returns [] when cloud is disabled/unavailable — never throws. */
export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  if (!isCloudEnabled()) return [];
  try {
    const { data, error } = await supabase!
      .from('kcq_leaderboard')
      .select('username, display_name, xp, total_stars')
      .order('xp', { ascending: false })
      .order('total_stars', { ascending: false })
      .limit(100);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}
