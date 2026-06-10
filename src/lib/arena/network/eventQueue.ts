/** Outbound/inbound event batching for Battle Learn Arena netcode.
 *
 *  Goal: keep bandwidth tiny and mobile-friendly.
 *   • `move` is COALESCED (latest-wins) — spamming the joystick never floods.
 *   • everything else is queued in order.
 *   • `flush()` is called on a fixed cadence (~12 Hz), not every frame.
 *
 *  Pure & framework-free so it is unit-testable. */

import type { NetEvent, NetEventType } from './types';

export class OutboundQueue {
  private latestMove: NetEvent | null = null;
  private others: NetEvent[] = [];
  private seq = 0;

  /** Stage an event. `move` overwrites the pending one; others append. */
  push(t: NetEventType, from: string, data: NetEvent['data']) {
    const ev: NetEvent = { t, from, seq: ++this.seq, data };
    if (t === 'move') this.latestMove = ev;
    else this.others.push(ev);
  }

  /** Drain everything staged since the last flush (move last, so it's freshest). */
  drain(): NetEvent[] {
    const out = this.others;
    this.others = [];
    if (this.latestMove) { out.push(this.latestMove); this.latestMove = null; }
    return out;
  }

  get pending(): boolean {
    return this.latestMove !== null || this.others.length > 0;
  }
}

/** Inbound buffer cap. A tab that sat hidden for minutes drains its backlog in
 *  ONE frame on return — keep the queue bounded, shedding the oldest `move`
 *  snapshots first (they're superseded anyway; non-move events are kept). */
const INBOUND_MAX = 256;

export class InboundQueue {
  private buffer: NetEvent[] = [];
  /** highest seq seen per sender — drop out-of-order `move` packets */
  private lastSeq = new Map<string, number>();

  accept(ev: NetEvent) {
    if (ev.t === 'move') {
      const last = this.lastSeq.get(ev.from) ?? 0;
      if (ev.seq <= last) return; // stale movement — ignore
      this.lastSeq.set(ev.from, ev.seq);
    }
    if (this.buffer.length >= INBOUND_MAX) {
      const oldestMove = this.buffer.findIndex((e) => e.t === 'move');
      this.buffer.splice(oldestMove >= 0 ? oldestMove : 0, 1);
    }
    this.buffer.push(ev);
  }

  /** Take all buffered events for the consumer to apply this frame. */
  drain(): NetEvent[] {
    if (!this.buffer.length) return [];
    const out = this.buffer;
    this.buffer = [];
    return out;
  }

  forget(playerId: string) {
    this.lastSeq.delete(playerId);
  }
}
