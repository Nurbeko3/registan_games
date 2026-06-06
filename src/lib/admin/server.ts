import { cookies } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ADMIN_COOKIE,
  ADMIN_LOGIN_LIMIT,
  ADMIN_LOGIN_WINDOW_MS,
} from './constants';

/**
 * Server-only admin helpers. Admin auth lives in Supabase (kcq_admins, bcrypt);
 * the cookie just carries the DB-issued session token, validated on every call
 * by the kcq_admin_* RPCs. Nothing secret ships to the client bundle.
 */

export { ADMIN_COOKIE, ADMIN_SESSION_MAX_AGE } from './constants';

interface LoginBucket { count: number; resetAt: number }

const loginAttempts = new Map<string, LoginBucket>();

/** Server-side Supabase client (anon key — RPC security is the admin token + role). */
export function supabaseServer(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** The current admin's session token from the cookie, or null. */
export async function adminToken(): Promise<string | null> {
  return (await cookies()).get(ADMIN_COOKIE)?.value ?? null;
}

export function adminRateLimitKey(req: Request, email: string): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.headers.get('x-real-ip') || 'local';
  return `${ip}:${email.toLowerCase()}`;
}

export function checkAdminLoginRateLimit(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + ADMIN_LOGIN_WINDOW_MS });
    return { ok: true };
  }

  if (current.count >= ADMIN_LOGIN_LIMIT) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  current.count += 1;
  return { ok: true };
}

export function clearAdminLoginRateLimit(key: string) {
  loginAttempts.delete(key);
}

export interface AdminInfo { id: string; email: string; name: string; role: 'super' | 'admin' }

/** Validate the cookie token against Supabase → the admin (with role), or null. */
export async function requireAdmin(): Promise<{ sb: SupabaseClient; token: string; admin: AdminInfo } | null> {
  const token = await adminToken();
  if (!token) return null;
  const sb = supabaseServer();
  if (!sb) return null;
  const { data, error } = await sb.rpc('kcq_admin_whoami', { p_token: token });
  if (error || !data?.ok) return null;
  return { sb, token, admin: data.admin as AdminInfo };
}

/** Readable auto-generated password, e.g. "Robo-Fox-4821". */
export function generatePassword(): string {
  const a = ['Robo', 'Star', 'Pixel', 'Byte', 'Nova', 'Turbo', 'Cyber', 'Mega', 'Hyper', 'Laser'];
  const b = ['Fox', 'Tiger', 'Whale', 'Dragon', 'Falcon', 'Wolf', 'Panda', 'Shark', 'Lion', 'Hawk'];
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  return `${pick(a)}-${pick(b)}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Slugify a display name into a candidate username. */
export function slugUsername(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20);
}
