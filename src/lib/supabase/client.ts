import { io, type Socket } from 'socket.io-client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Backend client — OFFLINE-FIRST, but now backed by our OWN backend
 * (Fastify + Prisma + Socket.io on Render / Neon) instead of Supabase.
 *
 * It deliberately keeps the *exact* shape of the small `supabase-js` surface
 * the app uses, so none of the call sites (account, leaderboard, codecaster,
 * party, arena, case files) had to change:
 *
 *   • supabase.rpc(fn, args)              → POST  {API}/rpc/:fn
 *   • supabase.from(view).select()...     → GET   {API}/views/:view
 *   • supabase.channel(name).on(...)      → Socket.io room (/realtime):
 *        - presence            → presence:sync
 *        - broadcast           → broadcast
 *        - postgres_changes    → db:change   (emulated server-side)
 *   • supabase.removeChannel(ch)          → leaves the room + unbinds
 *
 * Cloud is enabled only when NEXT_PUBLIC_API_URL is set (and we're in the
 * browser). With it absent every cloud path no-ops and the game runs fully
 * from localStorage — identical to the old Supabase-less behaviour.
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

// ── shared Socket.io connection (multiplexed across all channels) ─────────────
let sharedSocket: Socket | null = null;
function getSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io(API_URL, {
      path: '/realtime',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 8000,
    });
  }
  return sharedSocket;
}

type Json = Record<string, unknown>;
type RpcResponse = { data: unknown; error: { message: string } | null };

async function rpc(fn: string, args?: Json): Promise<RpcResponse> {
  if (!API_URL) return { data: null, error: { message: 'cloud disabled' } };
  try {
    const res = await fetch(`${API_URL}/rpc/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args ?? {}),
    });
    if (!res.ok) return { data: null, error: { message: `HTTP ${res.status}` } };
    return { data: await res.json(), error: null };
  } catch (e) {
    return { data: null, error: { message: (e as Error)?.message ?? 'network' } };
  }
}

// ── `.from(view).select().order().limit()` — read-only public views ───────────
class QueryBuilder implements PromiseLike<{ data: unknown[] | null; error: unknown }> {
  constructor(private view: string) {}
  select() { return this; }
  order() { return this; }
  limit() { return this; }
  eq() { return this; }
  then<R = { data: unknown[] | null; error: unknown }>(
    onfulfilled?: ((v: { data: unknown[] | null; error: unknown }) => R | PromiseLike<R>) | null,
  ): PromiseLike<R> {
    const run = async () => {
      if (!API_URL) return { data: [] as unknown[], error: null };
      try {
        const res = await fetch(`${API_URL}/views/${this.view}`);
        if (!res.ok) return { data: null, error: { message: `HTTP ${res.status}` } };
        return { data: (await res.json()) as unknown[], error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error)?.message ?? 'network' } };
      }
    };
    return run().then(onfulfilled as never) as PromiseLike<R>;
  }
}

// ── channel shim (presence + broadcast + postgres_changes) ────────────────────
type AnyHandler = (payload: Record<string, unknown>) => void;

interface SyncMsg { channel: string; state: Record<string, Json> }
interface BroadcastMsg { channel: string; event: string; payload: Json }
interface DbChangeMsg { channel: string; table: string; eventType: string; new: Json }

class BackendChannel {
  private presenceHandlers: AnyHandler[] = [];
  private broadcastHandlers: Record<string, AnyHandler> = {};
  private pgHandlers: Array<{ table: string; cb: AnyHandler }> = [];
  private presence: Record<string, Json> = {};
  private meta: Json = {};
  private joined = false;
  private socket: Socket | null = null;

  constructor(private name: string, private presenceKey: string) {}

  private onSync = (m: SyncMsg) => {
    if (m.channel !== this.name) return;
    this.presence = m.state ?? {};
    for (const h of this.presenceHandlers) h({});
  };
  private onBroadcast = (m: BroadcastMsg) => {
    if (m.channel !== this.name) return;
    this.broadcastHandlers[m.event]?.({ payload: m.payload ?? {} });
  };
  private onDbChange = (m: DbChangeMsg) => {
    if (m.channel !== this.name) return;
    for (const p of this.pgHandlers) {
      if (p.table === m.table) p.cb({ eventType: m.eventType, new: m.new, old: m.new });
    }
  };
  private onConnect = () => {
    if (this.joined) {
      this.socket?.emit('channel:join', { channel: this.name, presenceKey: this.presenceKey, meta: this.meta });
    }
  };

  /** supabase: channel.on('presence'|'broadcast'|'postgres_changes', filter, cb) */
  on(type: string, filter: Record<string, unknown>, cb: AnyHandler) {
    if (type === 'presence') this.presenceHandlers.push(cb);
    else if (type === 'broadcast') this.broadcastHandlers[String(filter.event)] = cb;
    else if (type === 'postgres_changes') this.pgHandlers.push({ table: String(filter.table), cb });
    return this;
  }

  subscribe(cb?: (status: string) => void) {
    const s = getSocket();
    this.socket = s;
    s.on('presence:sync', this.onSync as never);
    s.on('broadcast', this.onBroadcast as never);
    s.on('db:change', this.onDbChange as never);
    s.on('connect', this.onConnect);

    const join = () => {
      s.emit('channel:join', { channel: this.name, presenceKey: this.presenceKey, meta: this.meta });
      this.joined = true;
      cb?.('SUBSCRIBED');
    };
    if (s.connected) join();
    else s.once('connect', join);
    return this;
  }

  /** supabase: channel.track(meta) → presence metadata for this client */
  track(meta: Json) {
    this.meta = meta;
    this.socket?.emit('presence:track', { channel: this.name, meta });
    return Promise.resolve('ok' as const);
  }

  /** supabase: channel.send({ type:'broadcast', event, payload }) */
  send(msg: { type?: string; event: string; payload: Json }) {
    this.socket?.emit('broadcast', { channel: this.name, event: msg.event, payload: msg.payload ?? {} });
    return Promise.resolve('ok' as const);
  }

  /** supabase: channel.presenceState() → Record<key, meta[]> */
  presenceState() {
    const out: Record<string, Json[]> = {};
    for (const [k, v] of Object.entries(this.presence)) out[k] = [v];
    return out;
  }

  unsubscribe() {
    const s = this.socket;
    if (s) {
      s.emit('channel:leave', { channel: this.name });
      s.off('presence:sync', this.onSync as never);
      s.off('broadcast', this.onBroadcast as never);
      s.off('db:change', this.onDbChange as never);
      s.off('connect', this.onConnect);
    }
    this.joined = false;
    return Promise.resolve('ok' as const);
  }
}

// ── the fake "SupabaseClient" ─────────────────────────────────────────────────
function makeClient() {
  return {
    rpc,
    from: (view: string) => new QueryBuilder(view),
    channel: (name: string, opts?: { config?: { presence?: { key?: string } } }) => {
      const key = opts?.config?.presence?.key ?? Math.random().toString(36).slice(2, 10);
      return new BackendChannel(name, key);
    },
    removeChannel: (ch: { unsubscribe?: () => void }) => {
      ch.unsubscribe?.();
      return Promise.resolve('ok' as const);
    },
  };
}

function init(): SupabaseClient | null {
  if (typeof window === 'undefined') return null; // client-side only
  if (!API_URL) return null; // cloud disabled → offline-first
  try {
    return makeClient() as unknown as SupabaseClient;
  } catch {
    return null;
  }
}

export const supabase: SupabaseClient | null = init();

/** True only when our backend URL is configured and we're in the browser. */
export const isCloudEnabled = (): boolean => supabase !== null;
