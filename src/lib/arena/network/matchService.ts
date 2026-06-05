/** In-match EVENT RELAY for Battle Learn Arena (the M3 netcode seam).
 *
 *  During play we never ship full game state — only the events the spec calls
 *  for: MOVE / SHOOT / HIT / RESPAWN / ANSWERED / SCORE / MATCH_END. This service
 *  batches outbound events (movement coalesced, flushed at ~12 Hz) and drains
 *  inbound ones for the engine to apply to remote fighters.
 *
 *  It rides the SAME transport/channel as the room, so no extra connection. The
 *  in-engine application of these events lands in M3 (ArenaGame consumes drain()).
 *  Persistence to `arena_matches` / `arena_match_events` is optional and only
 *  attempted when cloud is configured — it never blocks gameplay. */

import { InboundQueue, OutboundQueue } from './eventQueue';
import type { Transport } from './realtime';
import type { NetEvent, NetEventType } from './types';

const FLUSH_HZ = 12;
const FLUSH_MS = Math.round(1000 / FLUSH_HZ);
const NET_EVENT = 'net'; // single broadcast channel-event carrying a NetEvent
const FROM_KEY = '__from';
const WORLD_LIMIT = 5000;
const MAX_VELOCITY = 1200;
const MAX_BULLET_SPEED = 1800;
const MAX_DAMAGE = 60;
const MAX_LIFE = 2500;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const bounded = (n: unknown, min: number, max: number): n is number => finite(n) && n >= min && n <= max;
const shortId = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 40;

function safeEvent(ev: NetEvent): boolean {
  if (!shortId(ev.from) || !Number.isInteger(ev.seq) || ev.seq < 1) return false;
  const d = ev.data;
  if (!d || typeof d !== 'object') return false;
  switch (ev.t) {
    case 'move':
      return bounded(d.x, 0, WORLD_LIMIT) && bounded(d.y, 0, WORLD_LIMIT) &&
        bounded(d.vx, -MAX_VELOCITY, MAX_VELOCITY) && bounded(d.vy, -MAX_VELOCITY, MAX_VELOCITY) &&
        bounded(d.aim, -Math.PI * 2, Math.PI * 2);
    case 'shoot':
      return bounded(d.x, 0, WORLD_LIMIT) && bounded(d.y, 0, WORLD_LIMIT) &&
        bounded(d.angle, -Math.PI * 2, Math.PI * 2) && bounded(d.speed, 0, MAX_BULLET_SPEED) &&
        bounded(d.dmg, 0, MAX_DAMAGE) && bounded(d.life, 0, MAX_LIFE) &&
        (typeof d.weapon === 'string' && d.weapon.length <= 32);
    case 'hit':
      return bounded(d.hp, 0, 100) && shortId(d.by);
    case 'down':
      return shortId(d.by);
    case 'respawn':
      return bounded(d.x, 0, WORLD_LIMIT) && bounded(d.y, 0, WORLD_LIMIT);
    case 'leave':
      return typeof d.name === 'string' && d.name.length > 0 && d.name.length <= 30;
    case 'answered':
      return typeof d.correct === 'boolean';
    case 'score':
    case 'match_end':
      return false;
    default:
      return false;
  }
}

export class MatchService {
  private out = new OutboundQueue();
  private inbound = new InboundQueue();
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private transport: Transport, private myId: string) {}

  /** Begin relaying. Call once the match starts. */
  start() {
    this.transport.on(NET_EVENT, (payload) => {
      const ev = payload as unknown as NetEvent;
      const transportFrom = payload[FROM_KEY];
      if (
        ev &&
        ev.from !== this.myId &&
        (typeof transportFrom !== 'string' || transportFrom === ev.from) &&
        safeEvent(ev)
      ) this.inbound.accept(ev);
    });
    this.flushTimer = setInterval(() => this.flush(), FLUSH_MS);
  }

  /** Queue one of my events to send (movement is coalesced to latest-wins). */
  send(t: NetEventType, data: NetEvent['data']) {
    if (t === 'score' || t === 'match_end') return;
    this.out.push(t, this.myId, data);
    if (t === 'leave') this.flush();
  }

  private flush() {
    if (!this.out.pending) return;
    for (const ev of this.out.drain()) {
      this.transport.broadcast(NET_EVENT, ev as unknown as Record<string, unknown>);
    }
  }

  /** Take all remote events received since the last call, for the engine to apply. */
  receive(): NetEvent[] {
    return this.inbound.drain();
  }

  /** A player left mid-match — stop trusting their stale movement sequence. */
  forget(playerId: string) {
    this.inbound.forget(playerId);
  }

  stop() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = null;
  }
}
