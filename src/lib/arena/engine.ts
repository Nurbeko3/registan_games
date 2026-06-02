/** Real-time top-down arena SHOOTER engine for Battle Learn Arena.
 *
 *  Counter-Strike / Brawl-Stars style: fighters move with momentum, take cover
 *  behind obstacles, aim and fire "blasters" (colorful — it's tag, not violence),
 *  lose HP, score crits, and get eliminated. When the HERO is eliminated the
 *  match layer opens the Learning Pod; a correct answer respawns them with a
 *  short protective shield.
 *
 *  Bots now run a 4-personality AI (aggressive / defensive / sniper / support)
 *  with self-preservation, weak-target focus and crossfire avoidance.
 *
 *  Framework-free & deterministic-ish (only Math.random for AI jitter & crits)
 *  so it can be unit-tested and, later, run authoritatively for real netcode.
 *
 *  Game-feel: pass an optional `Fx` sink into `step` and it spawns muzzle flashes,
 *  impact particles, damage numbers, kill bursts and screen-shake trauma. Sound
 *  events accumulate on `StepResult.sounds` for the audio layer to play. */

import type { TeamId } from './types';
import type { Fx } from './effects';
import type { ArenaSound } from './audio';

// ── world geometry (logical units; the canvas scales to fit) ──
export const WORLD_W = 720;
export const WORLD_H = 440;
export const FIGHTER_R = 15;
export const BULLET_R = 5;

// ── tuning ──
const HERO_SPEED = 178; // units / sec (top speed)
const HERO_ACCEL = 16; // velocity smoothing toward target (higher = snappier)
const HERO_DECEL = 12; // smoothing when stopping
const BOT_ACCEL = 9; // bots ease into their target velocity too (no robot snaps)
const BULLET_SPEED = 380;
const BULLET_LIFE = 1.4; // sec
const BULLET_DMG = 25; // 4 hits to down a full-HP fighter
const BULLET_DMG_CRIT = 45;
const CRIT_CHANCE = 0.12; // rare, punchy
const MAX_HP = 100;
const HERO_COOLDOWN = 250; // ms between shots
const RESPAWN_BOT_MS = 2200;
const RECOIL_KICK = 38; // backward velocity nudge on firing (units/sec)
const SHIELD_MS = 2600; // post-respawn invulnerability for the hero

export interface Rect { x: number; y: number; w: number; h: number }

/** Bot archetypes — same engine, different instincts. */
export type Personality = 'aggressive' | 'defensive' | 'sniper' | 'support';

interface AiProfile {
  keep: number;    // preferred distance to the enemy
  range: number;   // will try to shoot within this range
  cooldown: number;// ms between shots
  spread: number;  // aim jitter (radians) — lower = more accurate
  retreat: number; // HP threshold to flee
  speed: number;   // movement speed
}

const AI: Record<Personality, AiProfile> = {
  aggressive: { keep: 95,  range: 270, cooldown: 760,  spread: 0.16, retreat: 22, speed: 138 },
  defensive:  { keep: 185, range: 300, cooldown: 1000, spread: 0.13, retreat: 42, speed: 116 },
  sniper:     { keep: 245, range: 430, cooldown: 1300, spread: 0.05, retreat: 34, speed: 102 },
  support:    { keep: 150, range: 300, cooldown: 950,  spread: 0.14, retreat: 46, speed: 122 },
};

const SQUAD: Personality[] = ['aggressive', 'sniper', 'defensive', 'support', 'aggressive', 'defensive'];

/** Practice difficulty → bot skill multiplier (faster cooldown, tighter aim,
 *  quicker feet at higher skill). 1 = the default "medium" bot. */
export type ArenaDifficulty = 'easy' | 'medium' | 'hard' | 'expert';
export const DIFFICULTY_SKILL: Record<ArenaDifficulty, number> = {
  easy: 0.7, medium: 1, hard: 1.2, expert: 1.45,
};

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
  personality: Personality | null; // null for the hero
  skill: number; // bot skill multiplier (practice difficulty); 1 for the hero
  recoil: number; // 0..1, decays — visual gun kick
  flash: number;  // 0..1, decays — white hit flash
  shieldUntil: number; // ms timestamp; while now < this the fighter is invulnerable
  // ── multiplayer ──
  /** true = another human, driven by network packets (no local AI/physics). */
  remote: boolean;
  /** true = THIS client applies this fighter's damage/death (single-owner authority). */
  local: boolean;
  /** network player id for a remote human, else null. */
  netId: string | null;
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
  crit: boolean;
}

export interface StepResult {
  kills: KillEvent[];
  heroDied: boolean;
  /** where the hero died, for the death camera (only set when heroDied). */
  heroDeath?: { x: number; y: number };
  /** semantic sound events for the audio layer to play this frame. */
  sounds: ArenaSound[];
}

const RED_NAMES = ['Pixel', 'Nova', 'Spark', 'Echo', 'Ziggy', 'Mochi', 'Comet', 'Lumi', 'Pip'];
const BLUE_NAMES = ['Splash', 'Wave', 'Coral', 'Bubbles', 'Marina', 'Finn', 'Tide', 'Pearl', 'Reef'];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const TEAM_HEX: Record<TeamId, string> = { red: '#FF7AB6', blue: '#3BA7FF' };

/** Base/spawn point for a team (left = red, right = blue) with a little spread. */
function spawnPoint(team: TeamId): { x: number; y: number } {
  const x = team === 'red' ? rnd(40, 150) : rnd(WORLD_W - 150, WORLD_W - 40);
  const y = rnd(60, WORLD_H - 60);
  return { x, y };
}

export function createWorld(
  perTeam: number,
  hero: { name: string; avatar: string },
  obstacles?: Rect[],
  difficulty: ArenaDifficulty = 'medium',
): World {
  const skill = DIFFICULTY_SKILL[difficulty];
  const walls: Rect[] = obstacles ?? [
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

  const make = (team: TeamId, isHero: boolean, idx: number): Fighter => {
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
      personality: isHero ? null : SQUAD[idx % SQUAD.length],
      skill: isHero ? 1 : skill,
      recoil: 0, flash: 0, shieldUntil: 0,
      remote: false, local: true, netId: null,
    };
  };

  fighters.push(make('red', true, 0)); // the hero leads red
  for (let i = 0; i < perTeam - 1; i++) fighters.push(make('red', false, i));
  for (let i = 0; i < perTeam; i++) fighters.push(make('blue', false, i));

  return {
    w: WORLD_W, h: WORLD_H, obstacles: walls, fighters, bullets: [],
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
  f.recoil = 0; f.flash = 0;
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

/** Crossfire guard: would a shot toward `angle` pass dangerously near a teammate? */
function teammateInLine(world: World, f: Fighter, angle: number, reach: number) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  for (const o of world.fighters) {
    if (o === f || o.team !== f.team || !o.alive) continue;
    const rx = o.x - f.x, ry = o.y - f.y;
    const along = rx * ca + ry * sa; // projection onto the shot direction
    if (along <= 0 || along > reach) continue; // behind us or too far
    const perp = Math.abs(rx * -sa + ry * ca); // distance from the shot line
    if (perp < FIGHTER_R + BULLET_R + 4) return true;
  }
  return false;
}

/** Pick a target: nearest by default, but aggressive/snipers prefer the weakest
 *  enemy in sight so a team can focus-fire and finish wounded foes. */
function pickTarget(world: World, f: Fighter): Fighter | null {
  let best: Fighter | null = null;
  let bestScore = Infinity;
  const focusWeak = f.personality === 'aggressive' || f.personality === 'sniper';
  for (const o of world.fighters) {
    if (o.team === f.team || !o.alive) continue;
    const d = dist(f.x, f.y, o.x, o.y);
    const score = focusWeak ? d + o.hp * 1.4 : d; // weight low-HP enemies closer
    if (score < bestScore) { bestScore = score; best = o; }
  }
  return best;
}

/** Average position of living teammates — supports rally toward the squad. */
function teammateCentroid(world: World, f: Fighter): { x: number; y: number } | null {
  let sx = 0, sy = 0, n = 0;
  for (const o of world.fighters) {
    if (o === f || o.team !== f.team || !o.alive) continue;
    sx += o.x; sy += o.y; n++;
  }
  return n ? { x: sx / n, y: sy / n } : null;
}

function fire(world: World, f: Fighter, angle: number, now: number, cooldown: number) {
  f.cooldownUntil = now + cooldown;
  f.recoil = 1;
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
  // recoil kick (visual momentum) + muzzle flash
  f.vx -= Math.cos(angle) * RECOIL_KICK;
  f.vy -= Math.sin(angle) * RECOIL_KICK;
}

/** Advance the whole world by dt seconds. Mutates `world`; returns events.
 *  Pass `fx` to spawn juice (particles / shake) and collect `sounds`. */
export function step(world: World, dt: number, now: number, fx?: Fx): StepResult {
  const kills: KillEvent[] = [];
  const sounds: ArenaSound[] = [];
  let heroDied = false;
  let heroDeath: { x: number; y: number } | undefined;
  dt = Math.min(dt, 0.05); // clamp big frame gaps

  const hero = world.fighters[0];

  // decay per-fighter feel state
  for (const f of world.fighters) {
    if (f.recoil > 0) f.recoil = Math.max(0, f.recoil - dt * 6);
    if (f.flash > 0) f.flash = Math.max(0, f.flash - dt * 5);
  }

  // ── HERO (momentum movement) ──
  if (hero.alive) {
    const inp = world.input;
    const tmag = Math.hypot(inp.moveX, inp.moveY);
    const inv = 1 / Math.max(1, tmag);
    const tvx = inp.moveX * inv * HERO_SPEED;
    const tvy = inp.moveY * inv * HERO_SPEED;
    const resp = tmag > 0.01 ? HERO_ACCEL : HERO_DECEL;
    const k = Math.min(1, resp * dt);
    hero.vx += (tvx - hero.vx) * k;
    hero.vy += (tvy - hero.vy) * k;
    hero.x = clamp(hero.x + hero.vx * dt, FIGHTER_R, world.w - FIGHTER_R);
    hero.y = clamp(hero.y + hero.vy * dt, FIGHTER_R, world.h - FIGHTER_R);
    resolveObstacles(hero, world.obstacles);

    // aim
    let angle = hero.aimAngle;
    if (inp.aim.type === 'dir' && inp.aim.angle != null) angle = inp.aim.angle;
    else if (inp.aim.type === 'point' && inp.aim.x != null && inp.aim.y != null)
      angle = Math.atan2(inp.aim.y - hero.y, inp.aim.x - hero.x);
    else {
      const e = pickTarget(world, hero);
      if (e) angle = Math.atan2(e.y - hero.y, e.x - hero.x);
    }
    hero.aimAngle = angle;

    if (inp.firing && now >= hero.cooldownUntil) {
      fire(world, hero, angle, now, HERO_COOLDOWN);
      fx?.muzzle(hero.x, hero.y, angle, '#FFD43B');
      sounds.push('shoot');
    }
  }

  // ── BOTS (personality AI + momentum) ──
  for (let i = 1; i < world.fighters.length; i++) {
    const b = world.fighters[i];
    if (!b.alive) {
      if (now >= b.respawnAt) respawn(b, now);
      continue;
    }
    const prof = AI[b.personality ?? 'aggressive'];
    const enemy = pickTarget(world, b);
    let tvx = 0, tvy = 0;

    if (enemy) {
      const d = dist(b.x, b.y, enemy.x, enemy.y);
      const toEnemy = Math.atan2(enemy.y - b.y, enemy.x - b.x);
      b.aimAngle = toEnemy;

      let mvAngle: number;
      const lowHp = b.hp <= prof.retreat;
      if (lowHp) {
        mvAngle = toEnemy + Math.PI + rnd(-0.4, 0.4); // flee, weaving
      } else if (d < prof.keep) {
        mvAngle = toEnemy + Math.PI * 0.5 * (b.wander > Math.PI ? 1 : -1); // strafe / back off
      } else if (d > prof.range) {
        mvAngle = toEnemy; // close in
      } else {
        mvAngle = toEnemy + rnd(-0.6, 0.6); // jockey at range
      }
      tvx = Math.cos(mvAngle) * prof.speed * (0.9 + 0.1 * b.skill);
      tvy = Math.sin(mvAngle) * prof.speed * (0.9 + 0.1 * b.skill);

      // shoot: in range, off cooldown, clear LOS, and NOT through a teammate
      if (
        !lowHp && d < prof.range && now >= b.cooldownUntil &&
        hasLOS(world, b.x, b.y, enemy.x, enemy.y) &&
        !teammateInLine(world, b, toEnemy, d)
      ) {
        // higher skill → tighter aim + faster cadence
        const spread = prof.spread / b.skill;
        const a = toEnemy + rnd(-spread, spread);
        fire(world, b, a, now, prof.cooldown / b.skill + rnd(0, 300 / b.skill));
        fx?.muzzle(b.x, b.y, a, TEAM_HEX[b.team]);
      }
    } else if (b.personality === 'support') {
      // no enemy in sight → rally toward the squad
      const c = teammateCentroid(world, b);
      if (c) { const a = Math.atan2(c.y - b.y, c.x - b.x); tvx = Math.cos(a) * prof.speed * 0.7; tvy = Math.sin(a) * prof.speed * 0.7; }
    } else {
      // wander
      b.wander += rnd(-0.5, 0.5) * dt * 4;
      tvx = Math.cos(b.wander) * prof.speed * 0.5;
      tvy = Math.sin(b.wander) * prof.speed * 0.5;
    }

    // ease into the target velocity (no robotic snapping)
    const k = Math.min(1, BOT_ACCEL * dt);
    b.vx += (tvx - b.vx) * k;
    b.vy += (tvy - b.vy) * k;
    b.x = clamp(b.x + b.vx * dt, FIGHTER_R, world.w - FIGHTER_R);
    b.y = clamp(b.y + b.vy * dt, FIGHTER_R, world.h - FIGHTER_R);
    resolveObstacles(b, world.obstacles);
  }

  // ── BULLETS ──
  const live: Bullet[] = [];
  for (const bullet of world.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    const ang = Math.atan2(bullet.vy, bullet.vx);
    if (now - bullet.born > BULLET_LIFE * 1000) continue;
    if (bullet.x < 0 || bullet.x > world.w || bullet.y < 0 || bullet.y > world.h) {
      fx?.impact(clamp(bullet.x, 0, world.w), clamp(bullet.y, 0, world.h), ang, 'wall');
      continue;
    }
    if (world.obstacles.some((r) => pointInRect(bullet.x, bullet.y, r))) {
      fx?.impact(bullet.x, bullet.y, ang, 'obstacle');
      continue;
    }

    let hit = false;
    for (const f of world.fighters) {
      if (!f.alive || f.team === bullet.team) continue;
      if (dist(bullet.x, bullet.y, f.x, f.y) <= FIGHTER_R + BULLET_R) {
        hit = true;
        // respawn shield absorbs the shot harmlessly
        if (now < f.shieldUntil) {
          fx?.shieldHit(bullet.x, bullet.y);
          sounds.push('shield');
          break;
        }
        const crit = Math.random() < CRIT_CHANCE;
        const dmg = crit ? BULLET_DMG_CRIT : BULLET_DMG;
        f.hp -= dmg;
        f.flash = 1;
        fx?.impact(bullet.x, bullet.y, ang, 'player');
        fx?.damage(f.x, f.y - FIGHTER_R, dmg, crit);
        sounds.push(crit ? 'crit' : 'hit');
        if (f.isHero) { fx?.addTrauma(crit ? 0.42 : 0.22); if (fx) fx.heroFlash = 1; sounds.push('hurt'); }

        if (f.hp <= 0) {
          f.alive = false;
          f.respawnAt = now + RESPAWN_BOT_MS;
          world.scores[bullet.team] += 1;
          const killer = world.fighters.find((k) => k.id === bullet.ownerId);
          if (killer) killer.score += 1;
          fx?.kill(f.x, f.y, TEAM_HEX[f.team]);
          fx?.addTrauma(f.isHero ? 0.7 : killer?.isHero ? 0.45 : 0.18);
          sounds.push('kill');
          kills.push({
            killerId: bullet.ownerId,
            killerName: killer?.name ?? '?',
            victimId: f.id,
            victimName: f.name,
            team: bullet.team,
            crit,
          });
          if (f.isHero) { heroDied = true; heroDeath = { x: f.x, y: f.y }; }
        }
        break;
      }
    }
    if (!hit) live.push(bullet);
  }
  world.bullets = live;

  return { kills, heroDied, heroDeath, sounds };
}
