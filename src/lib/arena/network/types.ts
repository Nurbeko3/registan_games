/** Shared types for Battle Learn Arena multiplayer.
 *
 *  Transport-agnostic: the same shapes flow over Supabase Realtime in production
 *  and a BroadcastChannel locally for dev/testing. Pure data, no React. */

import type { ModeId, TeamId } from '@/lib/arena/types';
import type { ArenaDifficulty } from '@/lib/arena/engine';

/** Connection lifecycle for the ConnectionStatus pill. */
export type ConnectionState = 'offline' | 'connecting' | 'connected' | 'error';

/** Room lifecycle, mirrored from the host over broadcast. */
export type RoomPhase = 'connecting' | 'lobby' | 'countdown' | 'playing' | 'ended' | 'error';

/** Host-owned room configuration (synced to everyone via presence/broadcast). */
export interface RoomSettings {
  mapId: string;
  modeId: ModeId;
  perTeam: number;
  botFill: boolean;
  targetScore: number;
  difficulty: ArenaDifficulty;
  /** schema version — clients on a different version are rejected at join */
  v: number;
}

/** A lobby member, materialised from channel presence. */
export interface RoomPlayer {
  id: string;
  name: string;
  avatar: string;
  team: TeamId;
  ready: boolean;
  isHost: boolean;
}

/** In-match events — the ONLY things sent during play (never full state). */
export type NetEventType =
  | 'move'      // {x,y,aim,vx,vy} — throttled, latest-wins
  | 'shoot'     // {x,y,angle}
  | 'hit'       // {target,dmg,crit}
  | 'respawn'   // {x,y}
  | 'answered'  // {correct} — telemetry for the host
  | 'score'     // {red,blue} — host authoritative
  | 'match_end';// {redScore,blueScore}

export interface NetEvent {
  t: NetEventType;
  /** sender player id */
  from: string;
  /** per-sender monotonic sequence (drop stale move packets) */
  seq: number;
  data: Record<string, number | string | boolean>;
}

export const SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS: RoomSettings = {
  mapId: 'training',
  modeId: 'deathmatch',
  perTeam: 3,
  botFill: true,
  targetScore: 30,
  difficulty: 'medium',
  v: SETTINGS_VERSION,
};

/** 6-digit numeric room code, e.g. "483921". */
export const makeRoomCode = (): string => String(Math.floor(100000 + Math.random() * 900000));
