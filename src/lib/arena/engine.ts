/** Real-time top-down arena SHOOTER engine for Battle Learn Arena.
 *
 *  Counter-Strike / Brawl-Stars style: fighters move, take cover behind
 *  obstacles, aim and fire "blasters" (colorful — it's tag, not violence),
 *  lose HP, and get eliminated. When the HERO is eliminated the match layer
 *  opens the Learning Pod; a correct answer respawns them.
 *
 *  Framework-free & deterministic-ish (only Math.random for AI jitter) so it can
 *  be unit-tested and, later, run authoritatively on a server for real netcode. */

import type { TeamId } from './types';

// ── world geometry (logical units; the canvas scales to fit) ──
export const WORLD_W = 720;
export const WORLD_H = 440;
export const FIGHTER_R = 15;
export const BULLET_R = 5;

// ── tuning ──
const HERO_SPEED = 175; // units / sec
const BOT_SPEED = 120;
const BULLET_SPEED = 380;
const BULLET_LIFE = 1.4; // sec
const BULLET_DMG = 25; // 4 hits to down a full-HP fighter
const MAX_HP = 100;
const HERO_COOLDOWN = 260; // ms between shots
const BOT_COOLDOWN = 950;
const BOT_RANGE = 300; // will try to shoot within this range
const BOT_KEEP = 150; // preferred distance — strafe when closer
const RESPAWN_BOT_MS = 2200;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Fighter {
  id: string;
  team: TeamId;
  isHero: boolean;
  name: string;
  emoji: string;
  x: number; y: number;
  vx: number; vy: number;
  hp: number;
  alive: boolean;
  respawnAt: number; // ms timestamp (bots only)
  aimAngle: number;
  cooldownUntil: number; // ms
  score: number; // eliminations made
  wander: number; // AI heading bias
}

export interface Bullet {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  team: TeamId;
  ownerId: string;
  born: number; // ms
}

/** Hero input, mutated by the controls layer and read each frame. */
export interface ArenaInput {
  moveX: number; // -1..1
  moveY: number; // -1..1
  firing: boolean;
  /** how the aim is expressed this frame */
  aim: { type: 'none' | 'dir' | 'point'; angle?: number; x?: number; y?: number };
}

export interface World {
  w: number; h: number;
  obstacles: Rect[];
  fighters: Fighter[];
  bullets: Bullet[];
  scores: { red: number; blue: number };
  input: ArenaInput;
  bulletSeq: number;
}

export interface KillEvent {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  team: TeamId; // scoring team
}

export interface StepResult {
  kills: KillEvent[];
  heroDied: boolean;
}

const RED_NAMES = ['Pixel', 'Nova', 'Spark', 'Echo', 'Ziggy', 'Mochi', 'Comet', 'Lumi', 'Pip'];
const BLUE_NAMES = ['Splash', 'Wave', 'Coral', 'Bubbles', 'Marina', 'Finn', 'Tide', 'Pearl', 'Reef'];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Base/spawn point for a team (left = red, right = blue) with a little spread. */
function spawnPoint(team: TeamId): { x: number; y: number } {
  const x = team === 'red' ? rnd(40, 150) : rnd(WORLD_W - 150, WORLD_W - 40);
  const y = rnd(60, WORLD_H - 60);
  return { x, y };
}

export function createWorld(
  perTeam: number,
  hero: { name: string; avatar: string },
): World {
  const obstacles: Rect[] = [
    { x: WORLD_W / 2 - 22, y: WORLD_H / 2 - 70, w: 44, h: 140 }, // center pillar
    { x: 180, y: 70, w: 90, h: 26 },
    { x: 180, y: WORLD_H - 96, w: 90, h: 26 },
    { x: WORLD_W - 270, y: 70, w: 90, h: 26 },
    { x: WORLD_W - 270, y: WORLD_H - 96, w: 90, h: 26 },
    { x: WORLD_W / 2 - 90, y: 40, w: 26, h: 70 },
    { x: WORLD_W / 2 + 64, y: WORLD_H - 110, w: 26, h: 70 },
  ];

  const fighters: Fighter[] = [];
  let nrI = 0;
  let nbI = 0;

  const make = (team: TeamId, isHero: boolean): Fighter => {
    const p = spawnPoint(team);
    const name = isHero
      ? hero.name || 'You'
      : team === 'red'
        ? RED_NAMES[nrI++ % RED_NAMES.length]
        : BLUE_NAMES[nbI++ % BLUE_NAMES.length];
    return {
      id: isHero ? 'hero' : `${team}-${name}-${Math.random().toString(36).slice(2, 6)}`,
      team,
      isHero,
      name,
      emoji: isHero ? hero.avatar : team === 'red' ? '🦊' : '🐳',
      x: p.x, y: p.y, vx: 0, vy: 0,
      hp: MAX_HP, alive: true, respawnAt: 0,
      aimAngle: team === 'red' ? 0 : Math.PI,
      cooldownUntil: 0, score: 0, wander: rnd(0, Math.PI * 2),
    };
  };

  fighters.push(make('red', true)); // the hero leads red
  for (let i = 0; i < perTeam - 1; i++) fighters.push(make('red', false));
  for (let i = 0; i < perTeam; i++) fighters.push(make('blue', false));

  return {
    w: WORLD_W, h: WORLD_H, obstacles, fighters, bullets: [],
    scores: { red: 0, blue: 0 },
    input: { moveX: 0, moveY: 0, firing: false, aim: { type: 'none' } },
    bulletSeq: 1,
  };
}

/** Respawn a fighter at its base with full HP. */
export function respawn(f: Fighter, now: number) {
  const p = spawnPoint(f.team);
  f.x = p.x; f.y = p.y; f.vx = 0; f.vy = 0;
  f.hp = MAX_HP; f.alive = true; f.respawnAt = 0; f.cooldownUntil = now + 300;
}

function pointInRect(x: number, y: number, r: Rect, pad = 0) {
  return x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
}

/** Push a circle out of any rect it overlaps (simple min-axis resolution). */
function resolveObstacles(f: Fighter, obstacles: Rect[]) {
  for (const r of obstacles) {
    const cx = clamp(f.x, r.x, r.x + r.w);
    const cy = clamp(f.y, r.y, r.y + r.h);
    const dx = f.x - cx;
    const dy = f.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < FIGHTER_R * FIGHTER_R) {
      const d = Math.sqrt(d2) || 0.0001;
      const push = FIGHTER_R - d;
      f.x += (dx / d) * push;
      f.y += (dy / d) * push;
    }
  }
}

/** Cheap line-of-sight: sample the segment; blocked if any sample is in a wall. */
function hasLOS(world: World, x1: number, y1: number, x2: number, y2: number) {
  const steps = 14;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    for (const r of world.obstacles) if (pointInRect(x, y, r)) return false;
  }
  return true;
}

function nearestEnemy(world: World, f: Fighter): Fighter | null {
  let best: Fighter | null = null;
  let bd = Infinity;
  for (const o of world.fighters) {
    if (o.team === f.team || !o.alive) continue;
    const d = dist(f.x, f.y, o.x, o.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function fire(world: World, f: Fighter, angle: number, now: number, cooldown: number) {
  f.cooldownUntil = now + cooldown;
  const muzzle = FIGHTER_R + BULLET_R + 2;
  world.bullets.push({
    id: world.bulletSeq++,
    x: f.x + Math.cos(angle) * muzzle,
    y: f.y + Math.sin(angle) * muzzle,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    team: f.team,
    ownerId: f.id,
    born: now,
  });
}

/** Advance the whole world by dt seconds. Mutates `world`; returns events. */
export function step(world: World, dt: number, now: number): StepResult {
  const kills: KillEvent[] = [];
  let heroDied = false;
  dt = Math.min(dt, 0.05); // clamp big frame gaps

  const hero = world.fighters[0];

  // ── HERO ──
  if (hero.alive) {
    const inp = world.input;
    const mag = Math.hypot(inp.moveX, inp.moveY) || 1;
    hero.x += (inp.moveX / Math.max(1, mag)) * HERO_SPEED * dt;
    hero.y += (inp.moveY / Math.max(1, mag)) * HERO_SPEED * dt;
    hero.x = clamp(hero.x, FIGHTER_R, world.w - FIGHTER_R);
    hero.y = clamp(hero.y, FIGHTER_R, world.h - FIGHTER_R);
    resolveObstacles(hero, world.obstacles);

    // aim
    let angle = hero.aimAngle;
    if (inp.aim.type === 'dir' && inp.aim.angle != null) angle = inp.aim.angle;
    else if (inp.aim.type === 'point' && inp.aim.x != null && inp.aim.y != null)
      angle = Math.atan2(inp.aim.y - hero.y, inp.aim.x - hero.x);
    else {
      const e = nearestEnemy(world, hero);
      if (e) angle = Math.atan2(e.y - hero.y, e.x - hero.x);
    }
    hero.aimAngle = angle;

    if (inp.firing && now >= hero.cooldownUntil) fire(world, hero, angle, now, HERO_COOLDOWN);
  }

  // ── BOTS ──
  for (let i = 1; i < world.fighters.length; i++) {
    const b = world.fighters[i];
    if (!b.alive) {
      if (now >= b.respawnAt) respawn(b, now);
      continue;
    }
    const enemy = nearestEnemy(world, b);
    if (enemy) {
      const d = dist(b.x, b.y, enemy.x, enemy.y);
      const toEnemy = Math.atan2(enemy.y - b.y, enemy.x - b.x);
      b.aimAngle = toEnemy;
      let mvAngle = toEnemy;
      if (d < BOT_KEEP) mvAngle = toEnemy + Math.PI * 0.5 * (b.wander > Math.PI ? 1 : -1); // strafe
      else if (d > BOT_RANGE) mvAngle = toEnemy; // close in
      else mvAngle = toEnemy + rnd(-0.6, 0.6); // jockey at range
      b.x += Math.cos(mvAngle) * BOT_SPEED * dt;
      b.y += Math.sin(mvAngle) * BOT_SPEED * dt;
      // shoot when in range with a clear shot
      if (d < BOT_RANGE && now >= b.cooldownUntil && hasLOS(world, b.x, b.y, enemy.x, enemy.y)) {
        fire(world, b, toEnemy + rnd(-0.13, 0.13), now, BOT_COOLDOWN + rnd(0, 350));
      }
    } else {
      // wander
      b.wander += rnd(-0.5, 0.5) * dt * 4;
      b.x += Math.cos(b.wander) * BOT_SPEED * 0.5 * dt;
      b.y += Math.sin(b.wander) * BOT_SPEED * 0.5 * dt;
    }
    b.x = clamp(b.x, FIGHTER_R, world.w - FIGHTER_R);
    b.y = clamp(b.y, FIGHTER_R, world.h - FIGHTER_R);
    resolveObstacles(b, world.obstacles);
  }

  // ── BULLETS ──
  const live: Bullet[] = [];
  for (const bullet of world.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (now - bullet.born > BULLET_LIFE * 1000) continue;
    if (bullet.x < 0 || bullet.x > world.w || bullet.y < 0 || bullet.y > world.h) continue;
    if (world.obstacles.some((r) => pointInRect(bullet.x, bullet.y, r))) continue;

    let hit = false;
    for (const f of world.fighters) {
      if (!f.alive || f.team === bullet.team) continue;
      if (dist(bullet.x, bullet.y, f.x, f.y) <= FIGHTER_R + BULLET_R) {
        f.hp -= BULLET_DMG;
        hit = true;
        if (f.hp <= 0) {
          f.alive = false;
          f.respawnAt = now + RESPAWN_BOT_MS;
          world.scores[bullet.team] += 1;
          const killer = world.fighters.find((k) => k.id === bullet.ownerId);
          if (killer) killer.score += 1;
          kills.push({
            killerId: bullet.ownerId,
            killerName: killer?.name ?? '?',
            victimId: f.id,
            victimName: f.name,
            team: bullet.team,
          });
          if (f.isHero) heroDied = true;
        }
        break;
      }
    }
    if (!hit) live.push(bullet);
  }
  world.bullets = live;

  return { kills, heroDied };
}
