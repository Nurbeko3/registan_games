import { describe, it, expect } from 'vitest';
import { DungeonEngine, runActions, gradeRun } from './engine';
import type { Command, Direction, EntityKind, EntitySpec, LevelDef, TileType, VictorySpec } from './types';

/**
 * Build a LevelDef from an ASCII map for readable tests.
 *   # wall   . floor   G goal   P pit   S spike   D door
 *   H hero   c coin    m gem    k key   x chest
 *   g goblin l slime   t bat    r guard B boss
 * Entity cells render as floor terrain with the entity on top.
 */
const TILE: Record<string, TileType> = {
  '#': 'wall', '.': 'floor', 'G': 'goal', 'P': 'pit', 'S': 'spike', 'D': 'door',
};
const ENTITY: Record<string, EntityKind> = {
  c: 'coin', m: 'gem', k: 'key', x: 'chest', g: 'goblin', l: 'slime', t: 'bat', r: 'guard', B: 'boss',
};
const ENEMY_HP: Partial<Record<EntityKind, number>> = { goblin: 1, slime: 2, bat: 1, guard: 1, boss: 3 };

function level(
  map: string,
  victory: VictorySpec,
  extra: Partial<LevelDef> = {},
): LevelDef {
  const rows = map.trim().split('\n').map((r) => r.trim());
  const tiles: TileType[][] = [];
  const entities: EntitySpec[] = [];
  let heroStart = { x: 0, y: 0 };
  let id = 0;
  rows.forEach((row, y) => {
    const line: TileType[] = [];
    [...row].forEach((ch, x) => {
      if (ch === 'H') {
        heroStart = { x, y };
        line.push('floor');
      } else if (TILE[ch]) {
        line.push(TILE[ch]);
      } else if (ENTITY[ch]) {
        const kind = ENTITY[ch];
        const e: EntitySpec = { id: `${kind}-${id++}`, kind, pos: { x, y } };
        if (ENEMY_HP[kind] !== undefined) e.hp = ENEMY_HP[kind];
        if (kind === 'bat') e.patrol = ['right', 'left'];
        entities.push(e);
        line.push('floor');
      } else {
        line.push('floor');
      }
    });
    tiles.push(line);
  });
  return {
    id: 'test', cols: tiles[0].length, rows: tiles.length,
    tiles, entities, heroStart, victory, ...extra,
  };
}

const moves = (dirs: Direction[]): Command[] => dirs.map((dir) => ({ op: 'move', dir }));

/** A victory that can never be met on a map with no 'G' tile — used as an
 *  "unwinnable harness" for tests that assert intermediate state (hp, hits,
 *  sensors) without the run ending in a win. */
const NEVER_WINS = { reachGoal: true } as const;

describe('DungeonEngine — movement & goal', () => {
  it('reaches the goal with a sequence of moves and wins', () => {
    const e = runActions(level('H..G', { reachGoal: true }), moves(['right', 'right', 'right']));
    expect(e.status).toBe('won');
    expect(e.state.hero.pos).toEqual({ x: 3, y: 0 });
  });

  it('turns a corner (right then down)', () => {
    const e = runActions(level('H.\n.G', { reachGoal: true }), [
      { op: 'move', dir: 'right' }, { op: 'move', dir: 'down' },
    ]);
    expect(e.status).toBe('won');
  });

  it('does not win before the goal is reached', () => {
    const e = runActions(level('H..G', { reachGoal: true }), moves(['right']));
    expect(e.status).toBe('playing');
  });

  it('blocks movement into a wall and stays in place', () => {
    const e = new DungeonEngine(level('H#G', { reachGoal: true }));
    const r = e.move('right');
    expect(r.events.some((ev) => ev.type === 'blocked')).toBe(true);
    expect(e.state.hero.pos).toEqual({ x: 0, y: 0 });
  });

  it('blocks movement off the grid edge', () => {
    const e = new DungeonEngine(level('HG', { reachGoal: true }));
    e.move('left');
    expect(e.state.hero.pos).toEqual({ x: 0, y: 0 });
  });
});

describe('DungeonEngine — traps', () => {
  it('stepping into a pit is fatal', () => {
    const e = runActions(level('HPG', { reachGoal: true }), moves(['right']));
    expect(e.status).toBe('lost');
    expect(e.state.loseReason).toBe('pit');
    expect(e.state.hero.hp).toBe(0);
  });

  it('a spike damages on its "on" turn', () => {
    // spikePeriod 2, phase 0 → dangerous on even turns. Turn 1 (odd) is safe.
    const e = new DungeonEngine(level('HS.G', { reachGoal: true }, { spikePeriod: 2, spikePhase: 0, heroHp: 3 }));
    e.move('right'); // turn 1 (odd) → safe
    expect(e.state.hero.hp).toBe(3);
  });

  it('waiting changes spike timing so the crossing is safe', () => {
    // dangerous on even turns. Move onto spike on turn 2 → damage; but wait first.
    const danger = new DungeonEngine(level('HS', NEVER_WINS, { spikePeriod: 2, spikePhase: 1, heroHp: 3 }));
    danger.move('right'); // turn 1; phase 1 → 1%2===1 dangerous → damage
    expect(danger.state.hero.hp).toBe(2);

    const safe = new DungeonEngine(level('HS', NEVER_WINS, { spikePeriod: 2, spikePhase: 1, heroHp: 3 }));
    safe.wait(); // turn 1
    safe.move('right'); // turn 2; 2%2===0 !== 1 → safe
    expect(safe.state.hero.hp).toBe(3);
  });
});

describe('DungeonEngine — collectibles & doors', () => {
  it('collects all coins to win', () => {
    const e = runActions(level('Hcc', { collectAllCoins: true }), [
      { op: 'move', dir: 'right' }, { op: 'collect' },
      { op: 'move', dir: 'right' }, { op: 'collect' },
    ]);
    expect(e.status).toBe('won');
    expect(e.state.hero.coins).toBe(2);
  });

  it('collect on an empty tile whiffs and collects nothing', () => {
    const e = new DungeonEngine(level('H.c', { collectAllCoins: true }));
    const r = e.collect();
    expect(r.events.some((ev) => ev.type === 'whiff')).toBe(true);
    expect(e.state.hero.coins).toBe(0);
  });

  it('a key opens an adjacent door, then the hero can pass', () => {
    const e = new DungeonEngine(level('HkDG', { reachGoal: true }));
    e.move('right'); // onto key tile (x=1)
    e.collect(); // pick up key
    expect(e.state.hero.keys).toBe(1);
    e.useKey(); // faces right → opens door at x=2
    expect(e.canMove('right')).toBe(true);
    e.move('right'); // onto former door (x=2)
    e.move('right'); // onto goal
    expect(e.status).toBe('won');
  });

  it('a closed door blocks movement', () => {
    const e = new DungeonEngine(level('HDG', { reachGoal: true }));
    expect(e.canMove('right')).toBe(false);
    e.move('right');
    expect(e.state.hero.pos).toEqual({ x: 0, y: 0 });
  });
});

describe('DungeonEngine — combat', () => {
  it('cannot walk into an enemy; must attack it', () => {
    const e = new DungeonEngine(level('HgG', { reachGoal: true, defeatBoss: false }));
    e.move('right'); // blocked by goblin
    expect(e.state.hero.pos).toEqual({ x: 0, y: 0 });
    e.attack(); // facing right → hits goblin (hp 1 → defeated)
    expect(e.state.entities.some((en) => en.kind === 'goblin')).toBe(false);
    e.move('right');
    e.move('right');
    expect(e.status).toBe('won');
  });

  it('a slime takes two hits', () => {
    const e = new DungeonEngine(level('Hl', NEVER_WINS));
    e.attack();
    expect(e.state.entities.find((en) => en.kind === 'slime')?.hp).toBe(1);
    e.attack();
    expect(e.state.entities.some((en) => en.kind === 'slime')).toBe(false);
  });

  it('attacking empty air whiffs', () => {
    const e = new DungeonEngine(level('H.G', { reachGoal: true }));
    const r = e.attack();
    expect(r.events.some((ev) => ev.type === 'whiff')).toBe(true);
  });

  it('an adjacent enemy damages the hero each turn until death', () => {
    // hero next to a goblin it never kills; goblin strikes on the world phase.
    const lvl = level('Hg', NEVER_WINS, { heroHp: 2 });
    const e = new DungeonEngine(lvl);
    e.wait(); // turn 1 → goblin adjacent → -1
    expect(e.state.hero.hp).toBe(1);
    e.wait(); // turn 2 → -1 → dead
    expect(e.status).toBe('lost');
    expect(e.state.loseReason).toBe('hp');
  });

  it('defeats a boss to win', () => {
    const e = new DungeonEngine(level('HB', { defeatBoss: true }, { heroHp: 9 }));
    e.attack();
    e.attack();
    expect(e.status).toBe('playing'); // boss hp 3, two hits left 1
    e.attack();
    expect(e.status).toBe('won');
  });
});

describe('DungeonEngine — sensors', () => {
  it('canMove reflects walls and edges', () => {
    const e = new DungeonEngine(level('H#\n..', NEVER_WINS));
    expect(e.canMove('right')).toBe(false);
    expect(e.canMove('down')).toBe(true);
    expect(e.canMove('up')).toBe(false);
  });

  it('seeEnemy / nearbyEnemy read the faced tile', () => {
    const e = new DungeonEngine(level('Hg', NEVER_WINS));
    expect(e.seeEnemy()).toBe(true);
    expect(e.nearbyEnemy()).toBe('goblin');
    e.move('down'); // faces down → no enemy below
    expect(e.seeEnemy()).toBe(false);
  });

  it('seeCoin detects coins on or next to the hero', () => {
    const e = new DungeonEngine(level('H.c', { collectAllCoins: true }));
    expect(e.seeCoin()).toBe(false);
    e.move('right'); // now adjacent to the coin
    expect(e.seeCoin()).toBe(true);
  });

  it('health reports current hp', () => {
    const e = new DungeonEngine(level('Hg', NEVER_WINS, { heroHp: 3 }));
    expect(e.health()).toBe(3);
    e.wait();
    expect(e.health()).toBe(2);
  });
});

describe('DungeonEngine — safety & determinism', () => {
  it('exceeding maxSteps loses (kills infinite loops)', () => {
    const e = new DungeonEngine(level('H.', { reachGoal: true }, { maxSteps: 3 }));
    e.wait();
    e.wait();
    e.wait(); // turn 3 ok
    const r = e.wait(); // turn 4 > maxSteps → lost
    expect(r.status).toBe('lost');
    expect(e.state.loseReason).toBe('maxSteps');
  });

  it('actions after the game ends are no-ops', () => {
    const e = runActions(level('H.G', { reachGoal: true }), moves(['right', 'right']));
    expect(e.status).toBe('won');
    const r = e.move('left');
    expect(r.events).toHaveLength(0);
    expect(e.state.hero.pos).toEqual({ x: 2, y: 0 });
  });

  it('does not mutate the input LevelDef (re-runnable for server replay)', () => {
    const lvl = level('Hc', { collectAllCoins: true });
    const snapshot = JSON.stringify(lvl);
    runActions(lvl, [{ op: 'move', dir: 'right' }, { op: 'collect' }]);
    runActions(lvl, [{ op: 'move', dir: 'right' }, { op: 'collect' }]);
    expect(JSON.stringify(lvl)).toBe(snapshot);
  });

  it('the same actions produce the same result every time', () => {
    const lvl = level('H..G', { reachGoal: true });
    const a = runActions(lvl, moves(['right', 'right', 'right'])).state;
    const b = runActions(lvl, moves(['right', 'right', 'right'])).state;
    expect(a).toEqual(b);
  });
});

describe('gradeRun — stars', () => {
  const winIn = (steps: number): DungeonEngine => {
    const dirs: Direction[] = Array(steps).fill('right');
    return runActions(level('H' + '.'.repeat(steps - 1) + 'G', { reachGoal: true }), moves(dirs));
  };

  it('0 stars when the run did not win', () => {
    const e = runActions(level('H..G', { reachGoal: true }), moves(['right']));
    expect(gradeRun(e).stars).toBe(0);
  });

  it('1 star for a win over par', () => {
    const e = winIn(3);
    expect(gradeRun(e, { parSteps: 2 }).stars).toBe(1);
  });

  it('2 stars for a win at/under par', () => {
    const e = winIn(3);
    expect(gradeRun(e, { parSteps: 3 }).stars).toBe(2);
  });

  it('3 stars require under par, the concept, and no hints', () => {
    const e = winIn(3);
    expect(gradeRun(e, { parSteps: 3, conceptUsed: true, hintsUsed: 0 }).stars).toBe(3);
    expect(gradeRun(e, { parSteps: 3, conceptUsed: true, hintsUsed: 1 }).stars).toBe(2); // hints cap at 2
    expect(gradeRun(e, { parSteps: 3, conceptUsed: false, hintsUsed: 0 }).stars).toBe(2);
  });
});
