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
        (typeof transportFrom !== 'string' || transportFrom === ev.from)
      ) this.inbound.accept(ev);
    });
    this.flushTimer = setInterval(() => this.flush(), FLUSH_MS);
  }

  /** Queue one of my events to send (movement is coalesced to latest-wins). */
  send(t: NetEventType, data: NetEvent['data']) {
    this.out.push(t, this.myId, data);
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
