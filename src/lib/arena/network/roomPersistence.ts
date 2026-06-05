import { supabase, isCloudEnabled } from '@/lib/supabase/client';
import type { RosterEntry } from '@/lib/arena/types';
import type { RoomSettings } from './types';

export interface PersistentRoomState {
  code: string;
  host_client_id: string | null;
  settings: RoomSettings | null;
  status: 'lobby' | 'playing' | 'ended' | string;
  match_id: string | null;
  seed: number | null;
  roster: RosterEntry[];
  started_at: string | null;
  revision: number;
  updated_at: string | null;
}

interface RpcEnvelope {
  ok?: boolean;
  reason?: string;
  token?: string;
  state?: Partial<PersistentRoomState>;
}

export interface PersistentRoomResult {
  ok: boolean;
  reason?: string;
  token?: string;
  state?: PersistentRoomState;
}

const normalizeRoster = (value: unknown): RosterEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const r = entry as Partial<RosterEntry>;
      if (typeof r.netId !== 'string' || typeof r.name !== 'string' || typeof r.avatar !== 'string') return null;
      return {
        netId: r.netId,
        name: r.name.slice(0, 20),
        avatar: r.avatar,
        team: r.team === 'blue' ? 'blue' : 'red',
      } satisfies RosterEntry;
    })
    .filter((entry): entry is RosterEntry => entry !== null);
};

const normalizeState = (state?: Partial<PersistentRoomState>): PersistentRoomState | undefined => {
  if (!state || typeof state !== 'object') return undefined;
  return {
    code: typeof state.code === 'string' ? state.code : '',
    host_client_id: typeof state.host_client_id === 'string' ? state.host_client_id : null,
    settings: state.settings && typeof state.settings === 'object' ? (state.settings as RoomSettings) : null,
    status: typeof state.status === 'string' ? state.status : 'lobby',
    match_id: typeof state.match_id === 'string' ? state.match_id : null,
    seed: typeof state.seed === 'number' ? state.seed : null,
    roster: normalizeRoster(state.roster),
    started_at: typeof state.started_at === 'string' ? state.started_at : null,
    revision: typeof state.revision === 'number' ? state.revision : 0,
    updated_at: typeof state.updated_at === 'string' ? state.updated_at : null,
  };
};

async function callRpc(name: string, args: Record<string, unknown>): Promise<PersistentRoomResult> {
  if (!isCloudEnabled() || !supabase) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await supabase.rpc(name, args);
    if (error) return { ok: false, reason: error.message };
    const envelope = (data ?? {}) as RpcEnvelope;
    return {
      ok: envelope.ok === true,
      reason: envelope.reason,
      token: typeof envelope.token === 'string' ? envelope.token : undefined,
      state: normalizeState(envelope.state),
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'rpc' };
  }
}

export const arenaRoomCreate = (code: string, hostClientId: string, settings: RoomSettings) =>
  callRpc('arena_room_create', { p_code: code, p_host_client_id: hostClientId, p_settings: settings });

export const arenaRoomState = (code: string) =>
  callRpc('arena_room_state', { p_code: code });

export const arenaRoomStart = (
  code: string,
  hostToken: string,
  payload: { matchId: string; seed: number; roster: RosterEntry[]; settings: RoomSettings; countdownMs: number },
) =>
  callRpc('arena_room_start', {
    p_code: code,
    p_host_token: hostToken,
    p_match_id: payload.matchId,
    p_seed: payload.seed,
    p_roster: payload.roster,
    p_settings: payload.settings,
    p_countdown_ms: payload.countdownMs,
  });

export const arenaRoomEnd = (code: string, hostToken: string) =>
  callRpc('arena_room_end', { p_code: code, p_host_token: hostToken });
