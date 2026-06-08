/**
 * Codecaster — pure, deterministic dungeon engine.
 *
 * Framework-free (no React/DOM): the same code runs in the browser to animate a
 * student's program AND on the server to validate that a submitted solution
 * actually wins (anti-cheat). Mirrors the engine/presentation split in
 * src/lib/arena/engine.ts.
 *
 * Turn model: the hero performs one *action* (move/attack/collect/useKey/wait/
 * say). After the action the world reacts deterministically — enemies act, then
 * trap (spike) damage resolves — then win/lose is evaluated. One action == one
 * turn, so a line of Python maps 1:1 to a visible step.
 */

import type {
  Command,
  Direction,
  EngineState,
  EntityKind,
  EntitySpec,
  GameEvent,
  GameStatus,
  Grade,
  HeroState,
  LevelDef,
  StepResult,
  TileType,
  Vec,
} from './types';

const DELTA: Record<Direction, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const ENEMY_KINDS: ReadonlySet<EntityKind> = new Set(['goblin', 'slime', 'bat', 'guard', 'boss']);
const BLOCKING_KINDS: ReadonlySet<EntityKind> = new Set(['goblin', 'slime', 'bat', 'guard', 'boss', 'chest']);

const isEnemy = (k: EntityKind): boolean => ENEMY_KINDS.has(k);
const eq = (a: Vec, b: Vec): boolean => a.x === b.x && a.y === b.y;
const add = (a: Vec, d: Vec): Vec => ({ x: a.x + d.x, y: a.y + d.y });
const manhattan = (a: Vec, b: Vec): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** A self-contained, mutable simulation of one level. */
export class DungeonEngine {
  readonly cols: number;
  readonly rows: number;
  private readonly tiles: TileType[][];
  private readonly victory: LevelDef['victory'];
  private readonly spikePeriod: number;
  private readonly spikePhase: number;
  private readonly maxSteps: number;

  private hero: HeroState;
  private entities: EntitySpec[];
  private _turn = 0;
  private _status: GameStatus = 'playing';
  private _loseReason?: string;
  private readonly _log: string[] = [];

  constructor(level: LevelDef) {
    this.cols = level.cols;
    this.rows = level.rows;
    // Deep-clone everything we mutate so re-running a LevelDef is side-effect free.
    this.tiles = level.tiles.map((row) => row.slice());
    this.entities = level.entities.map((e) => ({ ...e, pos: { ...e.pos }, patrol: e.patrol?.slice() }));
    this.victory = { ...level.victory };
    this.spikePeriod = level.spikePeriod ?? 2;
    this.spikePhase = level.spikePhase ?? 0;
    this.maxSteps = level.maxSteps ?? 200;
    this.hero = {
      pos: { ...level.heroStart },
      facing: level.heroFacing ?? 'right',
      hp: level.heroHp ?? 3,
      keys: level.startKeys ?? 0,
      coins: 0,
      gems: 0,
    };
  }

  // ── public read-only accessors ─────────────────────────────────────────────

  get status(): GameStatus {
    return this._status;
  }
  get turn(): number {
    return this._turn;
  }
  /** A fresh, serializable snapshot (safe to hand to a renderer / store). */
  get state(): EngineState {
    return {
      tiles: this.tiles.map((row) => row.slice()),
      hero: { ...this.hero, pos: { ...this.hero.pos } },
      entities: this.entities.map((e) => ({ ...e, pos: { ...e.pos } })),
      turn: this._turn,
      status: this._status,
      loseReason: this._loseReason,
      log: this._log.slice(),
    };
  }

  // ── sensors (pure queries on current state — used by `if`/`while`) ──────────

  canMove(dir: Direction): boolean {
    return this.isWalkable(add(this.hero.pos, DELTA[dir]));
  }
  health(): number {
    return this.hero.hp;
  }
  /** True if an enemy sits in the tile the hero currently faces. */
  seeEnemy(): boolean {
    return this.nearbyEnemy() !== null;
  }
  /** The kind of enemy in the faced tile, or null. */
  nearbyEnemy(): EntityKind | null {
    const e = this.entityAt(add(this.hero.pos, DELTA[this.hero.facing]));
    return e && isEnemy(e.kind) ? e.kind : null;
  }
  /** True if a coin is on the hero's tile or an orthogonally adjacent tile. */
  seeCoin(): boolean {
    return this.entities.some((e) => e.kind === 'coin' && manhattan(e.pos, this.hero.pos) <= 1);
  }

  // ── actions (each is one turn) ──────────────────────────────────────────────

  move(dir: Direction): StepResult {
    return this.act((events) => {
      this.hero.facing = dir;
      const from = { ...this.hero.pos };
      const to = add(from, DELTA[dir]);
      if (!this.isWalkable(to)) {
        events.push({ type: 'blocked', pos: from, dir });
        return;
      }
      this.hero.pos = to;
      events.push({ type: 'move', from, to, dir });
      if (this.tileAt(to) === 'pit') {
        events.push({ type: 'damage', amount: this.hero.hp, source: 'pit', hp: 0 });
        this.hero.hp = 0;
        this.lose('pit', events);
      }
    });
  }

  attack(_target?: string): StepResult {
    return this.act((events) => {
      const at = add(this.hero.pos, DELTA[this.hero.facing]);
      const target = this.entityAt(at);
      if (!target || !isEnemy(target.kind)) {
        events.push({ type: 'whiff', pos: at });
        return;
      }
      target.hp = (target.hp ?? 1) - 1;
      const defeated = target.hp <= 0;
      if (defeated) this.entities = this.entities.filter((e) => e.id !== target.id);
      events.push({ type: 'attack', pos: at, hit: true, targetId: target.id, defeated });
    });
  }

  collect(_target?: string): StepResult {
    return this.act((events) => {
      const here = this.entities.find(
        (e) => eq(e.pos, this.hero.pos) && (e.kind === 'coin' || e.kind === 'gem' || e.kind === 'key'),
      );
      if (!here) {
        events.push({ type: 'whiff', pos: { ...this.hero.pos } });
        return;
      }
      this.entities = this.entities.filter((e) => e.id !== here.id);
      if (here.kind === 'coin') this.hero.coins += 1;
      else if (here.kind === 'gem') this.hero.gems += 1;
      else this.hero.keys += 1;
      events.push({ type: 'collect', kind: here.kind, pos: { ...here.pos } });
    });
  }

  useKey(): StepResult {
    return this.act((events) => {
      const at = add(this.hero.pos, DELTA[this.hero.facing]);
      if (this.hero.keys > 0 && this.inBounds(at) && this.tileAt(at) === 'door') {
        this.hero.keys -= 1;
        this.tiles[at.y][at.x] = 'floor';
        events.push({ type: 'door', pos: at });
      } else {
        events.push({ type: 'whiff', pos: at });
      }
    });
  }

  wait(): StepResult {
    return this.act((events) => {
      events.push({ type: 'wait' });
    });
  }

  say(text: string): StepResult {
    return this.act((events) => {
      this._log.push(text);
      events.push({ type: 'say', text });
    });
  }

  /** Apply a primitive command (used for deterministic replay/validation). */
  apply(cmd: Command): StepResult {
    switch (cmd.op) {
      case 'move':
        return this.move(cmd.dir);
      case 'attack':
        return this.attack(cmd.target);
      case 'collect':
        return this.collect(cmd.target);
      case 'useKey':
        return this.useKey();
      case 'wait':
        return this.wait();
      case 'say':
        return this.say(cmd.text);
    }
  }

  // ── turn pipeline ───────────────────────────────────────────────────────────

  /** Wraps a hero action with step-cap check, world reaction, and win/lose. */
  private act(heroAction: (events: GameEvent[]) => void): StepResult {
    const events: GameEvent[] = [];
    if (this._status !== 'playing') return { events, status: this._status };

    this._turn += 1;
    if (this._turn > this.maxSteps) {
      this.lose('maxSteps', events);
      return { events, status: this._status };
    }

    heroAction(events);
    if (this._status !== 'playing') return { events, status: this._status };

    this.enemyPhase(events);
    this.trapPhase(events);
    if (this._status !== 'playing') return { events, status: this._status };

    if (this.checkVictory()) {
      this._status = 'won';
      events.push({ type: 'win' });
    } else if (this.hero.hp <= 0) {
      this.lose('hp', events);
    }
    return { events, status: this._status };
  }

  /** Enemies act after the hero. Patrollers step; everyone adjacent strikes. */
  private enemyPhase(events: GameEvent[]): void {
    for (const e of this.entities) {
      if (!isEnemy(e.kind)) continue;
      if (e.kind === 'bat' && e.patrol && e.patrol.length > 0) {
        const dir = e.patrol[this._turn % e.patrol.length];
        const to = add(e.pos, DELTA[dir]);
        if (this.inBounds(to) && this.tileAt(to) !== 'wall' && this.tileAt(to) !== 'door' && !this.entityAt(to) && !eq(to, this.hero.pos)) {
          const from = { ...e.pos };
          e.pos = to;
          events.push({ type: 'enemyMove', id: e.id, from, to });
        }
      }
      if (manhattan(e.pos, this.hero.pos) === 1) {
        this.hero.hp -= 1;
        events.push({ type: 'damage', amount: 1, source: e.kind, hp: this.hero.hp });
      }
    }
  }

  /** Spike tiles damage the hero on their "on" turns. */
  private trapPhase(events: GameEvent[]): void {
    if (this.tileAt(this.hero.pos) === 'spike' && this.spikeDangerous()) {
      this.hero.hp -= 1;
      events.push({ type: 'damage', amount: 1, source: 'spike', hp: this.hero.hp });
    }
  }

  private spikeDangerous(): boolean {
    return this._turn % this.spikePeriod === this.spikePhase;
  }

  private checkVictory(): boolean {
    const v = this.victory;
    if (v.reachGoal && this.tileAt(this.hero.pos) !== 'goal') return false;
    if (v.collectAllCoins && this.entities.some((e) => e.kind === 'coin')) return false;
    if (v.collectAllGems && this.entities.some((e) => e.kind === 'gem')) return false;
    if (v.defeatBoss && this.entities.some((e) => e.kind === 'boss')) return false;
    // At least one condition must be requested, else a level is unwinnable by design.
    return Boolean(v.reachGoal || v.collectAllCoins || v.collectAllGems || v.defeatBoss);
  }

  private lose(reason: string, events: GameEvent[]): void {
    this._status = 'lost';
    this._loseReason = reason;
    events.push({ type: 'lose', reason });
  }

  // ── geometry helpers ────────────────────────────────────────────────────────

  private inBounds(p: Vec): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.cols && p.y < this.rows;
  }
  private tileAt(p: Vec): TileType {
    return this.tiles[p.y][p.x];
  }
  private entityAt(p: Vec): EntitySpec | undefined {
    return this.inBounds(p) ? this.entities.find((e) => eq(e.pos, p)) : undefined;
  }
  /** Can the hero step onto `p`? Walls/closed doors and blocking entities stop it. */
  private isWalkable(p: Vec): boolean {
    if (!this.inBounds(p)) return false;
    const t = this.tileAt(p);
    if (t === 'wall' || t === 'door') return false;
    const e = this.entityAt(p);
    if (e && BLOCKING_KINDS.has(e.kind)) return false;
    return true;
  }
}

// ── convenience helpers (replay + grading) ────────────────────────────────────

/** Run a realized primitive action trace against a fresh engine — the exact
 *  function the server uses to validate a submitted solve. Deterministic. */
export function runActions(level: LevelDef, actions: Command[]): DungeonEngine {
  const engine = new DungeonEngine(level);
  for (const a of actions) {
    if (engine.status !== 'playing') break;
    engine.apply(a);
  }
  return engine;
}

/** Star grade. ⭐ win · ⭐⭐ win under par · ⭐⭐⭐ also used the target concept
 *  with no hints. Hints cap the result at ⭐⭐ so mastery stays honest. */
export function gradeRun(
  engine: DungeonEngine,
  opts: { parSteps?: number; conceptUsed?: boolean; hintsUsed?: number } = {},
): Grade {
  const won = engine.status === 'won';
  const steps = engine.turn;
  if (!won) return { won: false, stars: 0, steps };

  const underPar = opts.parSteps === undefined || steps <= opts.parSteps;
  const noHints = (opts.hintsUsed ?? 0) === 0;

  let stars: Grade['stars'] = 1;
  if (underPar) stars = 2;
  if (underPar && noHints && opts.conceptUsed === true) stars = 3;
  return { won, stars, steps };
}
