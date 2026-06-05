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
  /** match length in seconds — the match ends when the clock runs out. */
  durationSec: number;
  difficulty: ArenaDifficulty;
  /** schema version — clients on a different version are rejected at join */
  v: number;
}

/** Match lengths a host can pick (seconds). Scores are uncapped; time decides. */
export const MATCH_LENGTHS: { sec: number; label: string }[] = [
  { sec: 120, label: '2 min' },
  { sec: 180, label: '3 min' },
  { sec: 300, label: '5 min' },
];

/** A lobby member, materialised from channel presence. */
export interface RoomPlayer {
  id: string;
  name: string;
  avatar: string;
  team: TeamId;
  ready: boolean;
  isHost: boolean;
  role: 'player' | 'observer';
}

/** In-match events — the ONLY things sent during play (never full state). */
export type NetEventType =
  | 'move'      // {x,y,aim,vx,vy} — throttled, latest-wins
  | 'shoot'     // {x,y,angle,speed,dmg,life}
  | 'hit'       // {hp,by} — victim-reported current HP after taking damage
  | 'down'      // {by} — "my hero was tagged out by <netId>" (victim-reported)
  | 'respawn'   // {x,y}
  | 'leave'     // {name} — player intentionally left the match
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

export const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: RoomSettings = {
  mapId: 'training',
  modeId: 'deathmatch',
  perTeam: 3,
  botFill: true,
  targetScore: 30,
  durationSec: 180,
  difficulty: 'medium',
  v: SETTINGS_VERSION,
};

/** 6-digit numeric room code, e.g. "483921". */
export const makeRoomCode = (): string => String(Math.floor(100000 + Math.random() * 900000));

/** Identity for ONE shared match. The host generates these at start and ships
 *  them in the `start` handshake so every client loads the IDENTICAL arena. */
export interface MatchInfo {
  /** unique per started match — clients in the same match share this exactly. */
  matchId: string;
  /** PRNG seed → deterministic map, spawns and roster across all clients. */
  seed: number;
}

/** Authoritative match score, owned by the host and broadcast to everyone. */
export interface MatchScores {
  red: number;
  blue: number;
}

export const makeMatchId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** A 31-bit non-negative seed (safe for the mulberry32 PRNG). */
export const makeSeed = (): number => Math.floor(Math.random() * 0x7fffffff);
