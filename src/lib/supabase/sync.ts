import { supabase, isCloudEnabled } from './client';
import { currentUserId } from './auth';
import { useGame } from '@/store/useGame';

const TABLE = 'kcq_progress';

/** The subset of store state we persist to the cloud (no functions/transient). */
interface CloudState {
  xp: number;
  coins: number;
  gems: number;
  streak: number;
  lastPlayedDay: string | null;
  lastDailyClaim: string | null;
  completed: Record<string, { stars: number; plays: number }>;
  unlockedAchievements: string[];
  avatarId: string;
  unlockedAvatars: string[];
  themeId: string;
  unlockedThemes: string[];
  playerName: string;
}

function snapshot(): CloudState {
  const s = useGame.getState();
  return {
    xp: s.xp,
    coins: s.coins,
    gems: s.gems,
    streak: s.streak,
    lastPlayedDay: s.lastPlayedDay,
    lastDailyClaim: s.lastDailyClaim,
    completed: s.completed,
    unlockedAchievements: s.unlockedAchievements,
    avatarId: s.avatarId,
    unlockedAvatars: s.unlockedAvatars,
    themeId: s.themeId,
    unlockedThemes: s.unlockedThemes,
    playerName: s.playerName,
  };
}

const totalStars = (c: CloudState) => Object.values(c.completed).reduce((n, r) => n + r.stars, 0);
/** Single number to compare "who is ahead". */
const progressScore = (c: CloudState) => c.xp + totalStars(c) * 10;

// guard so applying a remote pull doesn't immediately re-trigger a push
let applyingRemote = false;

/** PULL on sign-in: adopt whichever side (cloud vs local) has more progress. */
export async function pullProgress(): Promise<'cloud' | 'local' | 'none'> {
  if (!isCloudEnabled()) return 'none';
  const userId = await currentUserId();
  if (!userId) return 'none';

  const { data, error } = await supabase!
    .from(TABLE)
    .select('state')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return 'none';

  const local = snapshot();
  const cloud = data?.state as CloudState | undefined;

  if (cloud && progressScore(cloud) > progressScore(local)) {
    // cloud is ahead → adopt it (merge over current persisted fields)
    applyingRemote = true;
    useGame.setState({ ...cloud });
    applyingRemote = false;
    return 'cloud';
  }

  // local is ahead (or no cloud row yet) → upload local
  await pushProgress();
  return 'local';
}

/** PUSH local progress to the cloud (idempotent upsert). */
export async function pushProgress(): Promise<void> {
  if (!isCloudEnabled()) return;
  const userId = await currentUserId();
  if (!userId) return;

  // ensure a stable, fun display name for the leaderboard
  let { playerName } = useGame.getState();
  if (!playerName) {
    playerName = `Hero${Math.floor(1000 + Math.random() * 9000)}`;
    useGame.getState().setPlayerName(playerName);
  }

  const state = snapshot();
  await supabase!.from(TABLE).upsert(
    {
      user_id: userId,
      display_name: playerName,
      xp: state.xp,
      coins: state.coins,
      total_stars: totalStars(state),
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
}

// ── debounced auto-push ──────────────────────────────────────────────
let timer: ReturnType<typeof setTimeout> | null = null;

export function schedulePush(): void {
  if (!isCloudEnabled() || applyingRemote) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void pushProgress();
  }, 1500);
}

export type { CloudState };
