import { supabase, isCloudEnabled } from './client';

/** One-tap anonymous sign-in. No password, no email. Returns the user id or null. */
export async function cloudSignIn(): Promise<string | null> {
  if (!isCloudEnabled()) return null;
  const { data: existing } = await supabase!.auth.getUser();
  if (existing.user) return existing.user.id;

  const { data, error } = await supabase!.auth.signInAnonymously();
  if (error) return null;
  return data.user?.id ?? null;
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
