import { describe, expect, it } from 'vitest';
import { levelCelebrationsBetween } from './useGame';

describe('level celebrations', () => {
  it('queues every level crossed by an XP gain', () => {
    expect(levelCelebrationsBetween(90, 310)).toEqual([
      { code: 'LEVEL_UP_2', kind: 'level', level: 2 },
      { code: 'LEVEL_UP_3', kind: 'level', level: 3 },
    ]);
  });

  it('does not queue a celebration when the level stays the same', () => {
    expect(levelCelebrationsBetween(10, 90)).toEqual([]);
  });
});
