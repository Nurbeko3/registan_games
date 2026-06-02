/** Room ORCHESTRATION for Battle Learn Arena.
 *
 *  Wraps a realtime Transport into a lobby: presence → live player list, host
 *  broadcasts settings + the start signal, players toggle ready/team. This is
 *  the same presence+broadcast shape proven in `lib/party/useParty.ts`, lifted
 *  into a small observable service the React hook subscribes to.
 *
 *  Two host models:
 *   • custom rooms — the creator is the fixed host.
 *   • quick match  — host is ELECTED (lowest present id) so a shared public room
 *     always has exactly one host even as people come and go. */

import { getMode } from '@/data/arenaModes';
import { createTransport, type PresenceMeta, type Transport } from './realtime';
import {
  DEFAULT_SETTINGS,
  type ConnectionState,
  type RoomPhase,
  type RoomPlayer,
  type RoomSettings,
} from './types';
import type { TeamId } from '@/lib/arena/types';

const COUNTDOWN_MS = 3200;

export interface RoomState {
  phase: RoomPhase;
  connection: ConnectionState;
  kind: 'cloud' | 'local';
  myId: string;
  isHost: boolean;
  players: RoomPlayer[];
  settings: RoomSettings;
  /** epoch ms the match starts at, during 'countdown' */
  startAt: number | null;
}

export interface RoomOptions {
  name: string;
  avatar: string;
  isHost: boolean;
  /** quick match → host is elected rather than fixed */
  quick?: boolean;
  settings?: RoomSettings;
}

export class RoomService {
  private transport: Transport;
  private me: PresenceMeta;
  private settings: RoomSettings;
  private readonly quick: boolean;
  private readonly forcedHost: boolean;
  private presence: Record<string, PresenceMeta> = {};
  private phase: RoomPhase = 'connecting';
  private connection: ConnectionState = 'offline';
  private startAt: number | null = null;
  private listeners = new Set<(s: RoomState) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(public readonly code: string, opts: RoomOptions) {
    this.quick = opts.quick ?? false;
    this.forcedHost = opts.isHost;
    this.settings = opts.settings ?? { ...DEFAULT_SETTINGS };
    this.transport = createTransport(code);
    this.me = {
      name: opts.name || 'Player',
      avatar: opts.avatar,
      team: 'red',
      ready: opts.isHost,
      isHost: opts.isHost,
    };
  }

  /** Am I currently the host? Fixed for custom rooms, elected for quick match. */
  private isHost(): boolean {
    if (!this.quick) return this.forcedHost;
    const ids = Object.keys(this.presence);
    if (!ids.length) return true; // alone → I host
    return this.transport.id === ids.slice().sort()[0];
  }

  subscribe(cb: (s: RoomState) => void): () => void {
    this.listeners.add(cb);
    cb(this.snapshot());
    return () => this.listeners.delete(cb);
  }

  private emit() { const s = this.snapshot(); this.listeners.forEach((cb) => cb(s)); }

  private toPlayers(): RoomPlayer[] {
    const list: RoomPlayer[] = Object.entries(this.presence).map(([id, m]) => ({ id, ...m }));
    list.sort((a, b) => (a.isHost === b.isHost ? a.name.localeCompare(b.name) : a.isHost ? -1 : 1));
    return list;
  }

  snapshot(): RoomState {
    return {
      phase: this.phase,
      connection: this.connection,
      kind: this.transport.kind,
      myId: this.transport.id,
      isHost: this.isHost(),
      players: this.toPlayers(),
      settings: this.settings,
      startAt: this.startAt,
    };
  }

  async connect() {
    const t = this.transport;
    t.onState((s) => {
      this.connection = s;
      if (s === 'connected' && this.phase === 'connecting') this.phase = 'lobby';
      if (s === 'error') this.phase = 'error';
      this.emit();
    });
    t.onPresence((map) => {
      const grew = Object.keys(map).length > Object.keys(this.presence).length;
      this.presence = map;
      // keep my own host crown accurate (matters for elected quick-match hosts)
      const host = this.isHost();
      if (this.me.isHost !== host) {
        this.me = { ...this.me, isHost: host };
        t.track(this.me);
        if (host) t.broadcast('settings', this.settings as unknown as Record<string, unknown>);
      } else if (host && grew) {
        // a newcomer arrived — sync them to the current settings
        t.broadcast('settings', this.settings as unknown as Record<string, unknown>);
      }
      this.emit();
    });
    t.on('settings', (payload) => {
      if (this.isHost()) return; // host is the source of truth
      this.settings = payload as unknown as RoomSettings;
      this.emit();
    });
    t.on('start', (payload) => {
      this.startAt = Number(payload.at) || Date.now() + COUNTDOWN_MS;
      this.phase = 'countdown';
      this.emit();
      const delay = Math.max(0, this.startAt - Date.now());
      this.timer = setTimeout(() => { this.phase = 'playing'; this.emit(); }, delay);
    });
    await t.connect(this.me);
  }

  setReady(ready: boolean) { this.me = { ...this.me, ready }; this.transport.track(this.me); }
  setTeam(team: TeamId) { this.me = { ...this.me, team }; this.transport.track(this.me); }

  /** Host-only: change room settings (mode change also resets the target score). */
  updateSettings(patch: Partial<RoomSettings>) {
    if (!this.isHost()) return;
    const next = { ...this.settings, ...patch };
    if (patch.modeId) next.targetScore = getMode(patch.modeId).targetScore;
    this.settings = next;
    this.transport.broadcast('settings', next as unknown as Record<string, unknown>);
    this.emit();
  }

  /** Host-only: everyone counts down, then flips to 'playing'. */
  start() {
    if (!this.isHost()) return;
    const at = Date.now() + COUNTDOWN_MS;
    this.transport.broadcast('start', { at });
  }

  leave() {
    if (this.timer) clearTimeout(this.timer);
    this.transport.disconnect();
    this.listeners.clear();
  }
}
