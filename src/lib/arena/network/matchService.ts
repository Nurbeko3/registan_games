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
const NET_EVENT = 'net'; // single broadcast channel-event carrying a NetEvent envelope
const FROM_KEY = '__from';
// Hard bound on events per envelope — a legit flush carries a handful
// (1 move + a few shoot/hit), so anything huge is malformed or hostile.
const MAX_ENVELOPE = 64;
const WORLD_LIMIT = 5000;
const MAX_VELOCITY = 1200;
const MAX_BULLET_SPEED = 1800;
// Must exceed the highest weapon's damage * headshotMult (sniper: 80 * 2.0 = 160).
const MAX_DAMAGE = 200;
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
      const transportFrom = payload[FROM_KEY];
      // One broadcast = one envelope of events (rate-limit friendly). Old
      // clients sent one bare event per broadcast — accept that shape too.
      const batch = Array.isArray(payload.events) ? payload.events : [payload];
      if (batch.length > MAX_ENVELOPE) return;
      for (const raw of batch) {
        const ev = raw as NetEvent;
        if (
          ev &&
          ev.from !== this.myId &&
          (typeof transportFrom !== 'string' || transportFrom === ev.from) &&
          safeEvent(ev)
        ) this.inbound.accept(ev);
      }
    });
    // Guard against a double interval if start() is called more than once.
    if (this.flushTimer) clearInterval(this.flushTimer);
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
    // ONE broadcast per flush, however many events piled up. A firefight used
    // to fan out as 15-25 separate sends/sec per player — message COUNT is what
    // burns the Realtime tenant events/sec quota (and any client throttle), so
    // batching keeps a full lobby far below the ceiling.
    this.transport.broadcast(NET_EVENT, { events: this.out.drain() });
  }

  /** Take all remote events received since the last call, for the engine to apply. */
  receive(): NetEvent[] {
    return this.inbound.drain();
  }

  /** Inject a synthetic inbound 'leave' for a player who vanished from presence
   *  (refresh / tab close / crash / network drop) and never sent their own
   *  'leave'. This is the RELIABLE path: it's server-detected, so a dying client
   *  doesn't have to successfully transmit anything for its character to be
   *  removed and the "X left" notice to show on every remaining client. */
  injectLeave(fromId: string, name: string) {
    if (!fromId) return;
    this.inbound.accept({ t: 'leave', from: fromId, seq: 1, data: { name } });
    this.forget(fromId);
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
