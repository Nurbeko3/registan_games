import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchService } from './matchService';
import type { Transport } from './realtime';
import type { ConnectionState } from './types';

/** Capturing stub transport — records broadcasts, lets tests inject inbound. */
function stubTransport(id: string) {
  const sent: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const handlers: Record<string, (p: Record<string, unknown>) => void> = {};
  const t: Transport = {
    id,
    kind: 'local',
    state: 'connected' as ConnectionState,
    onState: () => {},
    onPresence: () => {},
    on: (event, cb) => { handlers[event] = cb; },
    connect: async () => {},
    track: () => {},
    broadcast: (event, payload) => { sent.push({ event, payload }); },
    disconnect: () => {},
  };
  return { t, sent, inject: (p: Record<string, unknown>) => handlers['net']?.(p) };
}

describe('MatchService envelopes', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('flushes everything staged in one tick as a SINGLE broadcast', () => {
    const { t, sent } = stubTransport('me');
    const svc = new MatchService(t, 'me');
    svc.start();
    svc.send('move', { x: 10, y: 20, vx: 0, vy: 0, aim: 0 });
    svc.send('shoot', { x: 10, y: 20, angle: 0, speed: 420, dmg: 24, life: 1500, weapon: 'energy-rifle' });
    svc.send('shoot', { x: 12, y: 20, angle: 0.1, speed: 420, dmg: 24, life: 1500, weapon: 'energy-rifle' });
    vi.advanceTimersByTime(100); // > one 12Hz flush interval
    expect(sent.length).toBe(1);
    const events = sent[0].payload.events as Array<{ t: string }>;
    expect(events.map((e) => e.t)).toEqual(['shoot', 'shoot', 'move']);
    svc.stop();
  });

  it('receives enveloped events and still accepts the legacy bare shape', () => {
    const { t, inject } = stubTransport('me');
    const svc = new MatchService(t, 'me');
    svc.start();
    inject({
      __from: 'opp',
      events: [
        { t: 'move', from: 'opp', seq: 1, data: { x: 1, y: 2, vx: 0, vy: 0, aim: 0 } },
        { t: 'shoot', from: 'opp', seq: 2, data: { x: 1, y: 2, angle: 0, speed: 400, dmg: 20, life: 1000, weapon: 'smg' } },
      ],
    });
    // legacy: one bare event per broadcast (pre-envelope clients mid-rollout)
    inject({ t: 'move', from: 'opp', seq: 3, data: { x: 5, y: 6, vx: 0, vy: 0, aim: 0 }, __from: 'opp' });
    const got = svc.receive();
    expect(got.map((e) => e.t)).toEqual(['move', 'shoot', 'move']);
    svc.stop();
  });

  it('rejects events whose claimed sender mismatches the transport sender', () => {
    const { t, inject } = stubTransport('me');
    const svc = new MatchService(t, 'me');
    svc.start();
    inject({
      __from: 'mallory',
      events: [{ t: 'move', from: 'opp', seq: 1, data: { x: 1, y: 2, vx: 0, vy: 0, aim: 0 } }],
    });
    expect(svc.receive()).toEqual([]);
    svc.stop();
  });

  it('drops oversized envelopes outright', () => {
    const { t, inject } = stubTransport('me');
    const svc = new MatchService(t, 'me');
    svc.start();
    inject({
      __from: 'opp',
      events: Array.from({ length: 100 }, (_, i) => (
        { t: 'shoot', from: 'opp', seq: i + 1, data: { x: 1, y: 2, angle: 0, speed: 400, dmg: 20, life: 1000, weapon: 'smg' } }
      )),
    });
    expect(svc.receive()).toEqual([]);
    svc.stop();
  });
});
