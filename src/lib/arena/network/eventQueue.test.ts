import { describe, expect, it } from 'vitest';
import { InboundQueue, OutboundQueue } from './eventQueue';

describe('arena event queues', () => {
  it('coalesces movement while preserving other event order', () => {
    const q = new OutboundQueue();
    q.push('move', 'p1', { x: 1, y: 1, vx: 0, vy: 0, aim: 0 });
    q.push('shoot', 'p1', { x: 2, y: 2, angle: 0, speed: 100, dmg: 10, life: 100, weapon: 'blaster' });
    q.push('move', 'p1', { x: 3, y: 3, vx: 1, vy: 1, aim: 1 });

    expect(q.pending).toBe(true);
    const drained = q.drain();
    expect(drained.map((e) => e.t)).toEqual(['shoot', 'move']);
    expect(drained[1].data).toMatchObject({ x: 3, y: 3, aim: 1 });
    expect(q.pending).toBe(false);
  });

  it('drops stale movement packets per sender', () => {
    const q = new InboundQueue();
    q.accept({ t: 'move', from: 'p1', seq: 2, data: { x: 2, y: 2, vx: 0, vy: 0, aim: 0 } });
    q.accept({ t: 'move', from: 'p1', seq: 1, data: { x: 1, y: 1, vx: 0, vy: 0, aim: 0 } });
    q.accept({ t: 'move', from: 'p2', seq: 1, data: { x: 5, y: 5, vx: 0, vy: 0, aim: 0 } });

    expect(q.drain().map((e) => `${e.from}:${e.seq}`)).toEqual(['p1:2', 'p2:1']);
  });

  it('allows a sender to rejoin after forgetting its sequence', () => {
    const q = new InboundQueue();
    q.accept({ t: 'move', from: 'p1', seq: 7, data: { x: 7, y: 7, vx: 0, vy: 0, aim: 0 } });
    q.drain();

    q.forget('p1');
    q.accept({ t: 'move', from: 'p1', seq: 1, data: { x: 1, y: 1, vx: 0, vy: 0, aim: 0 } });

    expect(q.drain().map((e) => e.seq)).toEqual([1]);
  });
});
