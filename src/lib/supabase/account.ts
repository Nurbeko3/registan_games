import { supabase, isCloudEnabled } from './client';
import { useGame } from '@/store/useGame';

/**
 * Username/password student accounts backed by Supabase Postgres RPCs
 * (see supabase/migrations/0003_accounts.sql). No email, no Supabase Auth:
 * a locked table reached only through SECURITY DEFINER functions. The teacher
 * pre-creates accounts; students log in here.
 */

export interface AccountUser {
  id: string;
  username: string;
  display_name: string;
  xp: number;
  coins: number;
  total_stars: number;
  avatar_id: string;
  theme_id: string;
  state: Record<string, unknown>;
}

export type AuthReason = 'cloud' | 'bad' | 'unknown';
export interface LoginResult { ok: boolean; reason?: AuthReason; user?: AccountUser }

const SESSION_KEY = 'kcq.session'; // { token, username } — local only
export const ACCOUNT_SESSION_EVENT = 'kcq-account-session';

function emitSessionChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ACCOUNT_SESSION_EVENT));
}

export function readSession(): { token: string; username: string } | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function writeSession(token: string, username: string) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ token, username })); } catch {}
  emitSessionChange();
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
  emitSessionChange();
}
export function isLoggedIn(): boolean { return readSession() !== null; }

// ── store ↔ account mapping ──────────────────────────────────────────
/** Load an account's saved progress into the game store (cloud is authoritative). */
function applyToStore(u: AccountUser) {
  const st = (u.state ?? {}) as Record<string, unknown>;
  useGame.setState({
    xp: u.xp,
    coins: u.coins,
    avatarId: u.avatar_id || 'kid',
    themeId: u.theme_id || 'cloud',
    playerName: u.display_name || useGame.getState().playerName,
    gems: (st.gems as number) ?? 0,
    streak: (st.streak as number) ?? 0,
    lastPlayedDay: (st.lastPlayedDay as string | null) ?? null,
    lastDailyClaim: (st.lastDailyClaim as string | null) ?? null,
    completed: (st.completed as Record<string, { stars: number; plays: number }>) ?? {},
    unlockedAchievements: (st.unlockedAchievements as string[]) ?? [],
    unlockedAvatars: (st.unlockedAvatars as string[]) ?? ['kid', 'boy', 'girl'],
    unlockedThemes: (st.unlockedThemes as string[]) ?? ['cloud'],
    arenaAvatar: (st.arenaAvatar as string) ?? '🦊',
    arenaMatches: (st.arenaMatches as number) ?? 0,
    arenaWins: (st.arenaWins as number) ?? 0,
    arenaCorrect: (st.arenaCorrect as number) ?? 0,
    arenaBestElims: (st.arenaBestElims as number) ?? 0,
  });
}

interface SaveArgs {
  p_token: string; p_xp: number; p_coins: number; p_total_stars: number;
  p_avatar: string; p_theme: string; p_display_name: string;
  p_state: Record<string, unknown>;
}
function collectFromStore(token: string): SaveArgs {
  const s = useGame.getState();
  const totalStars = Object.values(s.completed).reduce((n, r) => n + r.stars, 0);
  return {
    p_token: token,
    p_xp: s.xp, p_coins: s.coins, p_total_stars: totalStars,
    p_avatar: s.avatarId, p_theme: s.themeId, p_display_name: s.playerName,
    p_state: {
      gems: s.gems, streak: s.streak,
      lastPlayedDay: s.lastPlayedDay, lastDailyClaim: s.lastDailyClaim,
      completed: s.completed, unlockedAchievements: s.unlockedAchievements,
      unlockedAvatars: s.unlockedAvatars, unlockedThemes: s.unlockedThemes,
      arenaAvatar: s.arenaAvatar,
      arenaMatches: s.arenaMatches, arenaWins: s.arenaWins,
      arenaCorrect: s.arenaCorrect, arenaBestElims: s.arenaBestElims,
    },
  };
}

// ── public API ───────────────────────────────────────────────────────
export async function accountLogin(username: string, password: string): Promise<LoginResult> {
  if (!isCloudEnabled()) return { ok: false, reason: 'cloud' };
  const { data, error } = await supabase!.rpc('kcq_login', { p_username: username.trim(), p_password: password });
  if (error) return { ok: false, reason: 'unknown' };
  if (!data?.ok) return { ok: false, reason: 'bad' };

  const u = data.user as AccountUser;
  writeSession(data.token as string, u.username);
  // Classroom devices may be shared. On login, the account is authoritative so
  // a previous student's local progress can never be pushed into this account.
  applyToStore(u);
  return { ok: true, user: u };
}

/** Re-establish the logged-in account on app load from the stored token. */
export async function accountResume(): Promise<AccountUser | null> {
  const s = readSession();
  if (!s || !isCloudEnabled()) return null;
  const { data, error } = await supabase!.rpc('kcq_session', { p_token: s.token });
  if (error || !data?.ok) { clearSession(); return null; }
  return data.user as AccountUser;
}

/** Push the current store progress to the logged-in account. */
export async function accountSave(): Promise<boolean> {
  const s = readSession();
  if (!s || !isCloudEnabled()) return false;
  const { data, error } = await supabase!.rpc('kcq_save', collectFromStore(s.token));
  return !error && !!data?.ok;
}

export function accountLogout() {
  clearSession();
  // Shared classroom devices: wipe this student's progress from the store so
  // the next person who plays as a guest (or logs in as someone else) never
  // sees/inherits a stale balance. Device prefs (locale/settings) survive.
  useGame.getState().resetToGuest();
}

export { applyToStore as applyAccountToStore };
