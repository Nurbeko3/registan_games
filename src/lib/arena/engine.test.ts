import { describe, expect, it } from 'vitest';
import { createWorld, requestReload, step } from './engine';
import { getWeapon } from './weapons';

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
