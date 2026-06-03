/** Realtime TRANSPORT for Battle Learn Arena.
 *
 *  One abstraction, two backings:
 *   • SupabaseTransport — a single Supabase Realtime channel (presence + broadcast),
 *     exactly the proven pattern in `lib/party/useParty.ts`. Real cross-device play.
 *   • LocalTransport — a BroadcastChannel, so the room flow runs across TABS on one
 *     device with zero backend. Used for dev/testing and graceful offline.
 *
 *  The transport only moves messages; rooms/matches build their logic on top. */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isCloudEnabled } from '@/lib/supabase/client';
import type { ConnectionState, RoomPlayer } from './types';

export type PresenceMeta = Omit<RoomPlayer, 'id'>;
type PresenceMap = Record<string, PresenceMeta>;
type BroadcastHandler = (payload: Record<string, unknown>) => void;

export interface Transport {
  readonly id: string;
  readonly kind: 'cloud' | 'local';
  state: ConnectionState;
  /** register handlers BEFORE connect() */
  onState(cb: (s: ConnectionState) => void): void;
  onPresence(cb: (players: PresenceMap) => void): void;
  on(event: string, cb: BroadcastHandler): void;
  connect(meta: PresenceMeta): Promise<void>;
  track(meta: PresenceMeta): void;
  broadcast(event: string, payload: Record<string, unknown>): void;
  disconnect(): void;
}

const randomId = () => Math.random().toString(36).slice(2, 10);

// ── Supabase Realtime ─────────────────────────────────────────────────────────
class SupabaseTransport implements Transport {
  readonly id = randomId();
  readonly kind = 'cloud' as const;
  state: ConnectionState = 'offline';
  private channel: RealtimeChannel | null = null;
  private stateCb?: (s: ConnectionState) => void;
  private presenceCb?: (p: PresenceMap) => void;
  private handlers: Record<string, BroadcastHandler> = {};

  constructor(private code: string) {}

  onState(cb: (s: ConnectionState) => void) { this.stateCb = cb; }
  onPresence(cb: (p: PresenceMap) => void) { this.presenceCb = cb; }
  on(event: string, cb: BroadcastHandler) { this.handlers[event] = cb; }

  private setState(s: ConnectionState) { this.state = s; this.stateCb?.(s); }

  async connect(meta: PresenceMeta) {
    this.setState('connecting');
    const channel = supabase!.channel(`kcq-arena-${this.code}`, {
      config: { presence: { key: this.id }, broadcast: { self: true } },
    });
    this.channel = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const raw = channel.presenceState() as Record<string, Array<Partial<PresenceMeta>>>;
      const map: PresenceMap = {};
      for (const [id, metas] of Object.entries(raw)) {
        // NEWEST presence wins: re-track() (ready/team change) can leave the old
        // ref at [0], so reading metas[0] showed stale state to other clients.
        const m = metas[metas.length - 1] ?? {};
        map[id] = {
          name: m.name ?? 'Player', avatar: m.avatar ?? '🐱',
          team: m.team ?? 'red', ready: m.ready ?? false, isHost: m.isHost ?? false,
        };
      }
      this.presenceCb?.(map);
    });

    for (const [event, cb] of Object.entries(this.handlers)) {
      channel.on('broadcast', { event }, ({ payload }) => cb((payload ?? {}) as Record<string, unknown>));
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') { void channel.track(meta); this.setState('connected'); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') this.setState('error');
    });
  }

  track(meta: PresenceMeta) { void this.channel?.track(meta); }
  broadcast(event: string, payload: Record<string, unknown>) {
    void this.channel?.send({ type: 'broadcast', event, payload });
  }
  disconnect() {
    if (this.channel) { void this.channel.unsubscribe(); void supabase!.removeChannel(this.channel); this.channel = null; }
    this.setState('offline');
  }
}

// ── BroadcastChannel (same-device, cross-tab) ─────────────────────────────────
interface LocalMsg {
  kind: 'presence' | 'leave' | 'hello' | 'broadcast';
  id?: string;
  meta?: PresenceMeta;
  event?: string;
  payload?: Record<string, unknown>;
}

class LocalTransport implements Transport {
  readonly id = randomId();
  readonly kind = 'local' as const;
  state: ConnectionState = 'offline';
  private bc: BroadcastChannel | null = null;
  private stateCb?: (s: ConnectionState) => void;
  private presenceCb?: (p: PresenceMap) => void;
  private handlers: Record<string, BroadcastHandler> = {};
  private presence: PresenceMap = {};
  private myMeta: PresenceMeta | null = null;

  constructor(private code: string) {}

  onState(cb: (s: ConnectionState) => void) { this.stateCb = cb; }
  onPresence(cb: (p: PresenceMap) => void) { this.presenceCb = cb; }
  on(event: string, cb: BroadcastHandler) { this.handlers[event] = cb; }

  private setState(s: ConnectionState) { this.state = s; this.stateCb?.(s); }
  private emitPresence() { this.presenceCb?.({ ...this.presence }); }

  async connect(meta: PresenceMeta) {
    this.setState('connecting');
    if (typeof BroadcastChannel === 'undefined') { this.setState('error'); return; }
    this.myMeta = meta;
    this.presence[this.id] = meta;
    this.bc = new BroadcastChannel(`kcq-arena-${this.code}`);
    this.bc.onmessage = (e: MessageEvent<LocalMsg>) => this.receive(e.data);
    this.post({ kind: 'presence', id: this.id, meta });
    this.post({ kind: 'hello', id: this.id });
    this.setState('connected');
    this.emitPresence();
  }

  private post(m: LocalMsg) { this.bc?.postMessage(m); }

  private receive(m: LocalMsg) {
    switch (m.kind) {
      case 'presence':
        if (m.id && m.meta) { this.presence[m.id] = m.meta; this.emitPresence(); }
        break;
      case 'leave':
        if (m.id) { delete this.presence[m.id]; this.emitPresence(); }
        break;
      case 'hello': // a new tab joined — re-announce myself
        if (this.myMeta) this.post({ kind: 'presence', id: this.id, meta: this.myMeta });
        break;
      case 'broadcast':
        if (m.event) this.handlers[m.event]?.((m.payload ?? {}) as Record<string, unknown>);
        break;
    }
  }

  track(meta: PresenceMeta) {
    this.myMeta = meta;
    this.presence[this.id] = meta;
    this.post({ kind: 'presence', id: this.id, meta });
    this.emitPresence();
  }
  broadcast(event: string, payload: Record<string, unknown>) {
    this.handlers[event]?.(payload); // self (broadcast:self parity)
    this.post({ kind: 'broadcast', event, payload });
  }
  disconnect() {
    this.post({ kind: 'leave', id: this.id });
    this.bc?.close();
    this.bc = null;
    this.setState('offline');
  }
}

/** Pick the best transport: real Supabase when configured, else same-device local. */
export function createTransport(code: string): Transport {
  return isCloudEnabled() ? new SupabaseTransport(code) : new LocalTransport(code);
}
