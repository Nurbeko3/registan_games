/**
 * Codecaster — core types for the Python dungeon game.
 *
 * These describe the *pure simulation* only: grid, entities, the primitive
 * command vocabulary, and win conditions. No React, no DOM, no i18n strings —
 * the data layer (src/data/codecaster) wraps these with titles/hints/i18n keys.
 *
 * Keeping this framework-free is deliberate: the same engine that runs in the
 * browser can be re-run on the server to validate a win (anti-cheat). See
 * docs/codecaster-design.md §7.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Vec {
  x: number;
  y: number;
}

/** Terrain. Entities (coins, enemies, …) sit *on top of* terrain tiles. */
export type TileType =
  | 'floor'
  | 'wall'
  | 'pit'    // walkable but deadly
  | 'spike'  // walkable; damages on its "on" turns
  | 'door'   // blocks until opened with a key (then becomes floor)
  | 'goal';

export type EntityKind =
  | 'coin'
  | 'gem'
  | 'key'
  | 'chest'
  | 'goblin'
  | 'slime'
  | 'bat'
  | 'guard'
  | 'boss';

/** A non-hero thing on the board. */
export interface EntitySpec {
  id: string;
  kind: EntityKind;
  pos: Vec;
  /** Enemies & boss: remaining hit points. */
  hp?: number;
  /** Patrolling enemies (e.g. bat): a repeating cycle of step directions. */
  patrol?: Direction[];
}

/** What counts as a win — all *specified* conditions must hold. */
export interface VictorySpec {
  reachGoal?: boolean;
  collectAllCoins?: boolean;
  collectAllGems?: boolean;
  defeatBoss?: boolean;
}

/** The simulation-relevant definition of a level (the data layer adds more). */
export interface LevelDef {
  id: string;
  cols: number;
  rows: number;
  /** tiles[y][x] — row-major. */
  tiles: TileType[][];
  entities: EntitySpec[];
  heroStart: Vec;
  heroFacing?: Direction;
  heroHp?: number; // default 3
  startKeys?: number; // default 0
  victory: VictorySpec;
  /** Spikes are dangerous when (turn % spikePeriod) === spikePhase. */
  spikePeriod?: number; // default 2
  spikePhase?: number; // default 0
  /** Hard cap on hero actions; exceeding it loses (kills infinite loops). */
  maxSteps?: number; // default 200
}

/** The primitive command vocabulary — what the Python API compiles down to.
 *  Sensors (canMove/seeEnemy/…) are *queries*, not commands; they read live
 *  engine state during execution and never appear in a realized action trace. */
export type Command =
  | { op: 'move'; dir: Direction }
  | { op: 'attack'; target?: string }
  | { op: 'collect'; target?: string }
  | { op: 'useKey' }
  | { op: 'wait' }
  | { op: 'say'; text: string };

export type GameStatus = 'playing' | 'won' | 'lost';

/** Live hero state. */
export interface HeroState {
  pos: Vec;
  facing: Direction;
  hp: number;
  keys: number;
  coins: number;
  gems: number;
}

/** A serializable snapshot of the world — what a renderer draws. */
export interface EngineState {
  tiles: TileType[][];
  hero: HeroState;
  entities: EntitySpec[];
  turn: number;
  status: GameStatus;
  loseReason?: string;
  log: string[];
}

/** Side-effects of a single action, for the presentation layer (anim/audio). */
export type GameEvent =
  | { type: 'move'; from: Vec; to: Vec; dir: Direction }
  | { type: 'blocked'; pos: Vec; dir: Direction }
  | { type: 'collect'; kind: EntityKind; pos: Vec }
  | { type: 'attack'; pos: Vec; hit: boolean; targetId?: string; defeated?: boolean }
  | { type: 'whiff'; pos: Vec }
  | { type: 'door'; pos: Vec }
  | { type: 'enemyMove'; id: string; from: Vec; to: Vec }
  | { type: 'damage'; amount: number; source: string; hp: number }
  | { type: 'say'; text: string }
  | { type: 'wait' }
  | { type: 'win' }
  | { type: 'lose'; reason: string };

export interface StepResult {
  events: GameEvent[];
  status: GameStatus;
}

/** Star grade for a finished run (computed outside the engine). */
export interface Grade {
  won: boolean;
  stars: 0 | 1 | 2 | 3;
  steps: number;
}
