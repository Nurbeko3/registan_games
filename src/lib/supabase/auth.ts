import { supabase, isCloudEnabled } from './client';

/**
 * Username-based auth (no email). Supabase only does email/password under the
 * hood, so we map a username → a synthetic, never-emailed address. The kid only
 * ever sees their username + an auto-generated password.
 *
 * NOTE: for sign-up to return a session immediately, the Supabase project must
 * have "Confirm email" turned OFF (Auth → Providers → Email). The synthetic
 * addresses are never deliverable, so confirmation would otherwise block login.
 */
const SYNTH_DOMAIN = 'kcqplayers.com';

/** Normalize a username into a stable, valid email local-part. */
export function usernameToEmail(username: string): string {
  const slug = username.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  return `${slug || 'player'}@${SYNTH_DOMAIN}`;
}

/** A friendly username is 3–20 chars, letters/digits/._- only. */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9._-]{3,20}$/.test(username.trim());
}

/** Auto-generate a readable, easy-to-save password like "Robo-Fox-4821". */
export function generatePassword(): string {
  const a = ['Robo', 'Star', 'Pixel', 'Byte', 'Nova', 'Turbo', 'Cyber', 'Mega', 'Hyper', 'Laser'];
  const b = ['Fox', 'Tiger', 'Whale', 'Dragon', 'Falcon', 'Wolf', 'Panda', 'Shark', 'Lion', 'Hawk'];
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${pick(a)}-${pick(b)}-${n}`;
}

export interface AuthResult {
  ok: boolean;
  /** machine-readable reason on failure */
  reason?: 'cloud' | 'taken' | 'confirm' | 'bad-credentials' | 'weak' | 'unknown';
  userId?: string;
}

/** Create a new account from a username + password. */
export async function signUpWithUsername(username: string, password: string): Promise<AuthResult> {
  if (!isCloudEnabled()) return { ok: false, reason: 'cloud' };
  const email = usernameToEmail(username);
  const { data, error } = await supabase!.auth.signUp({
    email,
    password,
    options: { data: { username: username.trim() } },
  });

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('already') || m.includes('registered')) return { ok: false, reason: 'taken' };
    if (m.includes('password')) return { ok: false, reason: 'weak' };
    return { ok: false, reason: 'unknown' };
  }

  // No session → the project still requires email confirmation. Try a direct
  // sign-in; if that also fails, surface the 'confirm' hint.
  if (!data.session) {
    const back = await supabase!.auth.signInWithPassword({ email, password });
    if (back.error) return { ok: false, reason: 'confirm' };
    return { ok: true, userId: back.data.user?.id };
  }
  return { ok: true, userId: data.user?.id };
}

/** Log in to an existing account. */
export async function signInWithUsername(username: string, password: string): Promise<AuthResult> {
  if (!isCloudEnabled()) return { ok: false, reason: 'cloud' };
  const email = usernameToEmail(username);
  const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, reason: 'bad-credentials' };
  return { ok: true, userId: data.user?.id };
}

export async function cloudSignOut(): Promise<void> {
  if (!isCloudEnabled()) return;
  await supabase!.auth.signOut();
}

/** Current signed-in user id, or null. */
export async function currentUserId(): Promise<string | null> {
  if (!isCloudEnabled()) return null;
  const { data } = await supabase!.auth.getUser();
  return data.user?.id ?? null;
}

/** Username stored in the session's user metadata, or null. */
export async function currentUsername(): Promise<string | null> {
  if (!isCloudEnabled()) return null;
  const { data } = await supabase!.auth.getUser();
  return (data.user?.user_metadata?.username as string | undefined) ?? null;
}

// ── legacy anonymous sign-in (kept so older callers still link) ──────────────
/** @deprecated username auth replaces anonymous accounts. */
export async function cloudSignIn(): Promise<string | null> {
  if (!isCloudEnabled()) return null;
  const { data: existing } = await supabase!.auth.getUser();
  if (existing.user) return existing.user.id;
  const { data, error } = await supabase!.auth.signInAnonymously();
  if (error) return null;
  return data.user?.id ?? null;
}
