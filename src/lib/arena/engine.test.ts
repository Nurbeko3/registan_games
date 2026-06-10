import { describe, expect, it } from 'vitest';
import {
  applyRemoteMove,
  applyRemoteRespawn,
  applyRemoteShot,
  createWorld,
  INTERP_DELAY_MS,
  requestReload,
  step,
  type World,
} from './engine';
import { getWeapon } from './weapons';

/** Two-human multiplayer world; fighters[0] = me, fighters[1] = remote "opp". */
function mpWorld(): World {
  return createWorld(
    1, { name: 'Me', avatar: '🎯' }, undefined, 'medium', 42, false,
    [
      { netId: 'a-me', name: 'Me', avatar: '🎯', team: 'red' },
      { netId: 'b-opp', name: 'Opp', avatar: '🐳', team: 'blue' },
    ],
    'a-me',
  );
}

describe('arena weapon ammo', () => {
  it('reloads to a full magazine without consuming reserve ammo', () => {
    const world = createWorld(1, { name: 'Tester', avatar: '🎯' }, undefined, 'medium', 123, true, undefined, undefined, 'burst-rifle');
    const spec = getWeapon('burst-rifle');

    world.weapon.mag = 0;
    world.weapon.reserve = 0;

    requestReload(world, 1000);
    expect(world.weapon.reloadUntil).toBe(1000 + spec.reloadMs);
    expect(world.weapon.reserve).toBe(spec.reserve);

    step(world, 0.016, 1000 + spec.reloadMs + 1);

    expect(world.weapon.mag).toBe(spec.magSize);
    expect(world.weapon.reserve).toBe(spec.reserve);
  });
});

describe('remote shots (windowed fire-rate, not hard cooldown)', () => {
  const shot = (w: World, now: number, weapon = 'energy-rifle') => {
    const opp = w.fighters.find((f) => f.netId === 'b-opp')!;
    applyRemoteShot(w, 'b-opp', { x: opp.x, y: opp.y, angle: 0, weapon }, now);
  };

  it('accepts two legit shots arriving in the same ~12Hz batch (same now)', () => {
    const w = mpWorld();
    shot(w, 1000);
    shot(w, 1000); // the old cooldownUntil gate dropped this one
    expect(w.bullets.length).toBe(2);
  });

  it('caps a spammer at ~125% of the weapon fire rate per rolling second', () => {
    const w = mpWorld();
    const spec = getWeapon('energy-rifle');
    const allowed = Math.max(2, Math.ceil((1000 / spec.fireRate) * 1.25));
    for (let i = 0; i < 50; i++) shot(w, 1000 + i);
    expect(w.bullets.length).toBe(allowed);
    // window slides: a second later, firing is allowed again
    shot(w, 2200);
    expect(w.bullets.length).toBe(allowed + 1);
  });

  it('realizes every shotgun pellet from one network event', () => {
    const w = mpWorld();
    shot(w, 1000, 'shotgun');
    expect(w.bullets.length).toBe(getWeapon('shotgun').pellets);
  });
});

describe('remote movement interpolation', () => {
  const opp = (w: World) => w.fighters.find((f) => f.netId === 'b-opp')!;

  it('lerps between two snapshots at the delayed render time', () => {
    const w = mpWorld();
    const f = opp(w);
    f.x = 100; f.y = 100;
    applyRemoteMove(w, 'b-opp', { x: 100, y: 100, vx: 0, vy: 0, aim: 0 }, 1000);
    applyRemoteMove(w, 'b-opp', { x: 200, y: 100, vx: 0, vy: 0, aim: 0 }, 1100);
    // render time = now - INTERP_DELAY_MS = exactly halfway between snapshots
    step(w, 0.016, 1050 + INTERP_DELAY_MS);
    expect(f.x).toBeCloseTo(150, 0);
    expect(f.y).toBeCloseTo(100, 0);
  });

  it('holds position (no runaway extrapolation) when packets stop', () => {
    const w = mpWorld();
    const f = opp(w);
    applyRemoteMove(w, 'b-opp', { x: 300, y: 200, vx: 170, vy: 0, aim: 0 }, 1000);
    // long after the last snapshot: pinned at snapshot + 250ms extrapolation
    step(w, 0.016, 5000);
    expect(f.x).toBeCloseTo(300 + 170 * 0.25, 0);
    const x1 = f.x;
    step(w, 0.016, 5100);
    expect(f.x).toBe(x1); // not sliding any further
  });

  it('drops stale snapshots on respawn so they cannot drag the fighter back', () => {
    const w = mpWorld();
    const f = opp(w);
    applyRemoteMove(w, 'b-opp', { x: 500, y: 300, vx: 0, vy: 0, aim: 0 }, 1000);
    f.alive = false;
    applyRemoteRespawn(w, 'b-opp', { x: 60, y: 60 }, 1200);
    expect(f.snaps).toEqual([]);
    expect(f.alive).toBe(true);
  });
});
