export interface ArenaAuthorityStatus {
  enabled: boolean;
  reason?: string;
}

/**
 * Arena multiplayer must be backed by an authoritative server/edge runtime.
 * The public flag is only an operator intent. The real enable decision comes
 * from `/api/arena/authority`, which also requires server-only env + health.
 */
export function wantsArenaMultiplayer(): boolean {
  return process.env.NEXT_PUBLIC_ARENA_MULTIPLAYER_AUTHORITY === 'enabled';
}

export async function loadArenaAuthorityStatus(): Promise<ArenaAuthorityStatus> {
  if (!wantsArenaMultiplayer()) return { enabled: false, reason: 'client_disabled' };
  try {
    const res = await fetch('/api/arena/authority', { cache: 'no-store' });
    if (!res.ok) return { enabled: false, reason: 'status_failed' };
    const json = (await res.json()) as Partial<ArenaAuthorityStatus>;
    return { enabled: json.enabled === true, reason: typeof json.reason === 'string' ? json.reason : undefined };
  } catch {
    return { enabled: false, reason: 'status_unreachable' };
  }
}
