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

import type { TeamId, RosterEntry } from './types';
import { otherTeam } from './types';
import type { Fx } from './effects';
import type { ArenaSound } from './audio';
import { getWeapon, DEFAULT_WEAPON, WEAPONS, isWeaponId, type WeaponId } from './weapons';

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
const RESPAWN_BOT_MS = 2200;
const RECOIL_KICK = 38; // backward velocity nudge on firing (units/sec)
const SHIELD_MS = 2600; // post-respawn invulnerability for the hero
const REMOTE_MAX_SPEED = HERO_SPEED * 1.35;
const REMOTE_SHOT_ORIGIN_TOLERANCE = 96;

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
  weaponId?: WeaponId;
  /** remote humans: trigger-pull timestamps in the last second (windowed
   *  fire-rate allowance — replaces the hard cooldown that dropped batched shots). */
  shotTimes?: number[];
  /** remote humans: position snapshots for interpolated rendering. */
  snaps?: RemoteSnap[];
}

/** One network movement snapshot for a remote fighter (see applyRemoteMove). */
export interface RemoteSnap {
  /** local receive time, ms. */
  at: number;
  x: number; y: number;
  vx: number; vy: number;
  aim: number;
}

export interface Bullet {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  team: TeamId;
  ownerId: string;
  born: number; // ms
  /** base damage this bolt deals on hit (before headshot/crit multiplier). */
  dmg: number;
  /** lifetime in ms → effective range. */
  life: number;
}

/** The hero's live weapon state (ammo + reload). Bots keep the simple blaster. */
export interface HeroWeaponState {
  id: WeaponId;
  /** rounds in the current magazine. */
  mag: number;
  /** rounds held in reserve. */
  reserve: number;
  /** ms timestamp the in-progress reload completes (0 = not reloading). */
  reloadUntil: number;
  /** ms the current reload started (for the HUD progress bar). */
  reloadStart: number;
}

/** Hero input, mutated by the controls layer and read each frame. */
export interface ArenaInput {
  moveX: number; // -1..1
  moveY: number; // -1..1
  firing: boolean;
  /** how the aim is expressed this frame */
  aim: { type: 'none' | 'dir' | 'point'; angle?: number; x?: number; y?: number };
}

/** Read-only view of the hero weapon for the HUD (ammo / reload progress). */
export interface HeroWeaponHud {
  id: WeaponId;
  name: string;
  nameKey: string;
  emoji: string;
  mag: number;
  magSize: number;
  reserve: number;
  reloading: boolean;
  /** 0..1 reload progress (0 when not reloading). */
  reloadPct: number;
}

export interface World {
  w: number; h: number;
  obstacles: Rect[];
  fighters: Fighter[];
  bullets: Bullet[];
  scores: { red: number; blue: number };
  input: ArenaInput;
  bulletSeq: number;
  /** the hero's weapon (ammo/reload); see HeroWeaponState. */
  weapon: HeroWeaponState;
  /** M2: true when other fighters are network-driven humans (not local bots). */
  multiplayer: boolean;
  /** M2: my own network id (matches fighters[0].netId). */
  myNetId: string | null;
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
  /** set when one of the hero's bolts landed this frame → drives the hit marker. */
  heroHit?: { crit: boolean; killed: boolean };
  /** M2: the hero fired this frame → broadcast so opponents see/spawn the bolt. */
  heroShot?: { x: number; y: number; angle: number; speed: number; dmg: number; life: number };
  /** M2: my hero took damage from this netId → broadcast current HP to opponents. */
  heroDamaged?: { hp: number; by: string | null };
  /** M2: my hero was tagged out by this netId → broadcast a 'down' for scoring. */
  heroDownedBy?: string | null;
}

const RED_NAMES = ['Pixel', 'Nova', 'Spark', 'Echo', 'Ziggy', 'Mochi', 'Comet', 'Lumi', 'Pip'];
const BLUE_NAMES = ['Splash', 'Wave', 'Coral', 'Bubbles', 'Marina', 'Finn', 'Tide', 'Pearl', 'Reef'];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const finite = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback);
const finiteClamp = (v: number, lo: number, hi: number, fallback = lo) => clamp(finite(v, fallback), lo, hi);

/** Seeded PRNG (mulberry32). Used so every client in a multiplayer match builds
 *  the IDENTICAL world (map + initial spawns + roster) from one shared seed. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEAM_HEX: Record<TeamId, string> = { red: '#FF7AB6', blue: '#3BA7FF' };

/** Base/spawn point for a team (left = red, right = blue) with a little spread.
 *  Pass a seeded `rand` for deterministic initial spawns; defaults to Math.random
 *  for cosmetic in-match respawns where divergence doesn't matter. */
function spawnPoint(team: TeamId, rand: () => number = Math.random): { x: number; y: number } {
  const r = (a: number, b: number) => a + rand() * (b - a);
  const x = team === 'red' ? r(40, 150) : r(WORLD_W - 150, WORLD_W - 40);
  const y = r(60, WORLD_H - 60);
  return { x, y };
}

function validWeaponId(id: unknown): id is WeaponId {
  return typeof id === 'string' && WEAPONS.some((w) => w.id === id);
}

function sanitizeRemoteSpawn(team: TeamId, d: { x: number; y: number }): { x: number; y: number } {
  const minX = team === 'red' ? 40 : WORLD_W - 150;
  const maxX = team === 'red' ? 150 : WORLD_W - 40;
  return {
    x: finiteClamp(d.x, minX, maxX, (minX + maxX) / 2),
    y: finiteClamp(d.y, 60, WORLD_H - 60, WORLD_H / 2),
  };
}

export function createWorld(
  perTeam: number,
  hero: { name: string; avatar: string },
  obstacles?: Rect[],
  difficulty: ArenaDifficulty = 'medium',
  /** shared match seed → deterministic layout/spawns across clients (multiplayer). */
  seed?: number,
  /** fill your team's empty slots with ally bots (the lobby toggle). Enemies are
   *  always present so there's an opponent; OFF = lone hero vs the enemy squad. */
  botFill = true,
  /** M2: when given, build a human-vs-human world from this roster (no bots);
   *  fighters[0] is MY hero (the entry matching myNetId), the rest are remote. */
  roster?: RosterEntry[],
  myNetId?: string,
  initialWeapon: WeaponId = DEFAULT_WEAPON,
  /** the team the hero chose in the lobby (solo vs bots honours this too). */
  heroTeam: TeamId = 'red',
  /** Host/teacher view: render the roster as remote fighters and do not spawn a playable hero. */
  spectator = false,
): World {
  const rand = seed === undefined ? Math.random : makeRng(seed);
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
    const p = spawnPoint(team, rand);
    const name = isHero
      ? hero.name || 'You'
      : team === 'red'
        ? RED_NAMES[nrI++ % RED_NAMES.length]
        : BLUE_NAMES[nbI++ % BLUE_NAMES.length];
    return {
      id: isHero ? 'hero' : `${team}-${name}-${Math.floor(rand() * 1e6).toString(36)}`,
      team,
      isHero,
      name,
      emoji: isHero ? hero.avatar : team === 'red' ? '🦊' : '🐳',
      x: p.x, y: p.y, vx: 0, vy: 0,
      hp: MAX_HP, alive: true, respawnAt: 0,
      aimAngle: team === 'red' ? 0 : Math.PI,
      cooldownUntil: 0, score: 0, wander: rand() * Math.PI * 2,
      personality: isHero ? null : SQUAD[idx % SQUAD.length],
      skill: isHero ? 1 : skill,
      recoil: 0, flash: 0, shieldUntil: 0,
      remote: false, local: true, netId: null, weaponId: isHero ? initialWeapon : undefined,
    };
  };

  const multiplayer = !!(roster && roster.length && myNetId);
  if (multiplayer) {
    // human-vs-human: deterministic spawns drawn in netId-sorted order so every
    // client places everyone identically; fighters[0] is MY hero (local).
    const sorted = [...roster!].sort((a, b) => (a.netId < b.netId ? -1 : 1));
    const spawns = new Map<string, { x: number; y: number }>();
    for (const e of sorted) spawns.set(e.netId, spawnPoint(e.team, rand));
    if (spectator) {
      fighters.push(makeSpectator(hero));
      for (const e of roster!) fighters.push(makeHuman(e, false, spawns.get(e.netId)!));
    } else {
      const me = roster!.find((r) => r.netId === myNetId) ?? roster![0];
      fighters.push(makeHuman(me, true, spawns.get(me.netId)!));
      for (const e of roster!) if (e.netId !== me.netId) fighters.push(makeHuman(e, false, spawns.get(e.netId)!));
    }
  } else {
    const enemyTeam = otherTeam(heroTeam);
    fighters.push(make(heroTeam, true, 0)); // the hero leads their chosen team
    const allies = botFill ? perTeam - 1 : 0; // botFill OFF → no ally bots
    for (let i = 0; i < allies; i++) fighters.push(make(heroTeam, false, i));
    for (let i = 0; i < perTeam; i++) fighters.push(make(enemyTeam, false, i)); // enemies always present
  }

  const startWeaponId = isWeaponId(initialWeapon) ? initialWeapon : DEFAULT_WEAPON;
  const startWeapon = getWeapon(startWeaponId);
  if (fighters[0]) fighters[0].weaponId = startWeaponId;
  return {
    w: WORLD_W, h: WORLD_H, obstacles: walls, fighters, bullets: [],
    scores: { red: 0, blue: 0 },
    input: { moveX: 0, moveY: 0, firing: false, aim: { type: 'none' } },
    bulletSeq: 1,
    weapon: { id: startWeaponId, mag: startWeapon.magSize, reserve: startWeapon.reserve, reloadUntil: 0, reloadStart: 0 },
    multiplayer,
    myNetId: multiplayer ? myNetId! : null,
  };
}

function makeSpectator(hero: { name: string; avatar: string }): Fighter {
  return {
    id: 'spectator',
    team: 'red',
    isHero: true,
    name: hero.name || 'Host',
    emoji: '👁️',
    x: WORLD_W / 2, y: WORLD_H / 2, vx: 0, vy: 0,
    hp: 0, alive: false, respawnAt: 0,
    aimAngle: 0,
    cooldownUntil: 0, score: 0, wander: 0,
    personality: null, skill: 1,
    recoil: 0, flash: 0, shieldUntil: 0,
    remote: false, local: false, netId: null, weaponId: DEFAULT_WEAPON,
  };
}

/** Build a human fighter (local hero or remote opponent) from a roster entry. */
function makeHuman(e: RosterEntry, isHero: boolean, p: { x: number; y: number }): Fighter {
  return {
    id: isHero ? 'hero' : `p:${e.netId}`,
    team: e.team,
    isHero,
    name: e.name || 'Player',
    emoji: e.avatar || (e.team === 'red' ? '🦊' : '🐳'),
    x: p.x, y: p.y, vx: 0, vy: 0,
    hp: MAX_HP, alive: true, respawnAt: 0,
    aimAngle: e.team === 'red' ? 0 : Math.PI,
    cooldownUntil: 0, score: 0, wander: 0,
    personality: null, skill: 1,
    recoil: 0, flash: 0, shieldUntil: 0,
    // a remote human is driven by network packets, not local AI/physics
    remote: !isHero, local: isHero, netId: e.netId, weaponId: isHero ? undefined : DEFAULT_WEAPON,
  };
}

// ── M2: apply remote-human network events to the local world ──────────────────

const byNet = (world: World, netId: string): Fighter | undefined =>
  world.fighters.find((f) => f.netId === netId && !f.isHero);

/** How far in the past remote fighters are rendered. Two flush intervals
 *  (~83ms each at 12 Hz) of buffer absorbs normal network jitter, so remotes
 *  glide between snapshots instead of teleporting on every packet. */
export const INTERP_DELAY_MS = 130;
/** Past this with no fresh snapshot, stop extrapolating (freeze in place) —
 *  better a briefly-still opponent than one sliding through walls. */
const EXTRAP_MAX_MS = 250;
/** Snapshots kept per remote fighter (≈1s of history at 12 Hz). */
const SNAP_BUFFER_MAX = 12;

/** Remote MOVE: buffer the snapshot; `step()` renders ~INTERP_DELAY_MS in the
 *  past, lerping between snapshots (extrapolating briefly if packets stall). */
export function applyRemoteMove(
  world: World, netId: string,
  d: { x: number; y: number; vx: number; vy: number; aim: number },
  now: number,
) {
  const f = byNet(world, netId);
  if (!f || !f.alive) return;
  let vx = finite(d.vx);
  let vy = finite(d.vy);
  const speed = Math.hypot(vx, vy);
  if (speed > REMOTE_MAX_SPEED) {
    const k = REMOTE_MAX_SPEED / speed;
    vx *= k; vy *= k;
  }
  const snaps = (f.snaps ??= []);
  snaps.push({
    at: now,
    x: finiteClamp(d.x, FIGHTER_R, world.w - FIGHTER_R, f.x),
    y: finiteClamp(d.y, FIGHTER_R, world.h - FIGHTER_R, f.y),
    vx, vy,
    aim: finite(d.aim, f.aimAngle),
  });
  if (snaps.length > SNAP_BUFFER_MAX) snaps.splice(0, snaps.length - SNAP_BUFFER_MAX);
  // aim stays realtime — a 130ms-late gun barrel reads as lag, positions don't
  f.aimAngle = finite(d.aim, f.aimAngle);
}

/** Drive a remote fighter's position from its snapshot buffer (interpolation
 *  with short extrapolation). Falls back to plain dead-reckoning before the
 *  first packet arrives. Called from `step()` each frame. */
function updateRemoteFromSnaps(world: World, f: Fighter, now: number, dt: number) {
  const snaps = f.snaps;
  if (!snaps || snaps.length === 0) {
    f.x = clamp(f.x + f.vx * dt, FIGHTER_R, world.w - FIGHTER_R);
    f.y = clamp(f.y + f.vy * dt, FIGHTER_R, world.h - FIGHTER_R);
    return;
  }
  const t = now - INTERP_DELAY_MS;
  // drop history older than the pair bracketing the render time
  while (snaps.length > 2 && snaps[1].at <= t) snaps.shift();
  const a = snaps[0];
  const b = snaps.length > 1 ? snaps[1] : null;
  if (t <= a.at) {
    // render time hasn't reached the oldest snapshot yet — hold it
    f.x = a.x; f.y = a.y; f.vx = a.vx; f.vy = a.vy;
  } else if (b && b.at > a.at) {
    const k = clamp((t - a.at) / (b.at - a.at), 0, 1);
    f.x = a.x + (b.x - a.x) * k;
    f.y = a.y + (b.y - a.y) * k;
    f.vx = b.vx; f.vy = b.vy;
  } else {
    // newest snapshot is already in the past → extrapolate up to the budget,
    // then pin at that point (a briefly-still opponent beats a wall-clipper)
    const overMs = t - a.at;
    const s = Math.min(overMs, EXTRAP_MAX_MS) / 1000;
    f.x = clamp(a.x + a.vx * s, FIGHTER_R, world.w - FIGHTER_R);
    f.y = clamp(a.y + a.vy * s, FIGHTER_R, world.h - FIGHTER_R);
    if (overMs > EXTRAP_MAX_MS) { f.vx = 0; f.vy = 0; }
  }
}

/** Remote SHOOT: spawn the opponent's bolt(s) in our world (they can hit our hero).
 *
 *  Fire-rate anti-cheat is a WINDOWED allowance, not a hard cooldown: events
 *  arrive in ~12 Hz batches, so two legitimate trigger pulls often share one
 *  `now` — the old `cooldownUntil` gate silently dropped the second one (an SMG
 *  lost ~half its bullets on the opponent's screen). */
export function applyRemoteShot(
  world: World, netId: string,
  d: { x: number; y: number; angle: number; speed?: number; dmg?: number; life?: number; weapon?: string }, now: number,
) {
  const f = byNet(world, netId);
  if (!f || !f.alive) return;
  const remoteWeapon = validWeaponId(d.weapon) ? d.weapon : DEFAULT_WEAPON;
  const spec = getWeapon(remoteWeapon);
  // allow up to ~125% of the weapon's true rate over a rolling second
  const times = (f.shotTimes ??= []);
  while (times.length && times[0] < now - 1000) times.shift();
  const maxPerSec = Math.max(2, Math.ceil((1000 / spec.fireRate) * 1.25));
  if (times.length >= maxPerSec) return;
  times.push(now);
  const rx = finiteClamp(d.x, FIGHTER_R, world.w - FIGHTER_R, f.x);
  const ry = finiteClamp(d.y, FIGHTER_R, world.h - FIGHTER_R, f.y);
  const tooFar = dist(rx, ry, f.x, f.y) > REMOTE_SHOT_ORIGIN_TOLERANCE;
  const sx = tooFar ? f.x : rx;
  const sy = tooFar ? f.y : ry;
  const angle = finite(d.angle, f.aimAngle);
  const speed = finiteClamp(d.speed ?? spec.bulletSpeed, spec.bulletSpeed * 0.75, spec.bulletSpeed * 1.1, spec.bulletSpeed);
  const dmg = finiteClamp(d.dmg ?? spec.damage, 1, spec.damage, spec.damage);
  const life = finiteClamp(d.life ?? spec.rangeMs, 120, spec.rangeMs, spec.rangeMs);
  f.aimAngle = angle;
  f.weaponId = remoteWeapon;
  f.cooldownUntil = now + spec.fireRate * 0.75; // kept for HUD/visual pacing only
  f.recoil = 1;
  // multi-pellet weapons (shotgun) fire ONE network event per trigger pull —
  // realize the full spread locally so they hit as hard as on the shooter's screen
  for (let p = 0; p < spec.pellets; p++) {
    const spr = spec.spread && spec.pellets > 1 ? rnd(-spec.spread, spec.spread) : 0;
    const a = angle + spr;
    world.bullets.push({
      id: world.bulletSeq++,
      x: sx + Math.cos(a) * (FIGHTER_R + BULLET_R + 2),
      y: sy + Math.sin(a) * (FIGHTER_R + BULLET_R + 2),
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      team: f.team, ownerId: f.id, born: now, dmg, life,
    });
  }
}

/** Remote DOWN: the opponent was tagged out (hide them until they respawn). */
export function applyRemoteDown(world: World, netId: string) {
  const f = byNet(world, netId);
  if (f) { f.alive = false; f.hp = 0; f.snaps = []; }
}

/** Remote LEAVE: remove the opponent from the active field without scoring. */
export function applyRemoteLeave(world: World, netId: string) {
  const f = byNet(world, netId);
  if (f) {
    f.alive = false;
    f.hp = 0;
    f.respawnAt = Number.POSITIVE_INFINITY;
    f.vx = 0;
    f.vy = 0;
    f.snaps = [];
  }
}

/** Remote RESPAWN: the opponent answered their Learning Pod and is back. */
export function applyRemoteRespawn(world: World, netId: string, d: { x: number; y: number }, now: number) {
  const f = byNet(world, netId);
  if (!f) return;
  const p = sanitizeRemoteSpawn(f.team, d);
  f.alive = true; f.hp = MAX_HP; f.x = p.x; f.y = p.y; f.vx = 0; f.vy = 0;
  f.snaps = []; // stale pre-death snapshots must not drag them off the spawn
  f.shieldUntil = now + SHIELD_MS;
}

// ── hero weapon controls (called from the React/controls layer) ──────────────

/** Begin a reload if it makes sense. Reserve is infinite for kid-friendly play:
 *  the visible reserve stays at the weapon's normal reserve count after reloads. */
export function requestReload(world: World, now: number) {
  const w = world.weapon;
  const spec = getWeapon(w.id);
  if (w.reloadUntil > 0 || w.mag >= spec.magSize) return;
  w.reserve = spec.reserve;
  w.reloadStart = now;
  w.reloadUntil = now + spec.reloadMs;
}

/** Snapshot the hero weapon for the HUD (ammo + reload progress). */
export function heroWeaponHud(world: World, now: number): HeroWeaponHud {
  const w = world.weapon;
  const spec = getWeapon(w.id);
  const reloading = w.reloadUntil > now;
  const span = w.reloadUntil - w.reloadStart;
  return {
    id: spec.id, name: spec.name, nameKey: spec.nameKey, emoji: spec.emoji,
    mag: w.mag, magSize: spec.magSize, reserve: w.reserve,
    reloading,
    reloadPct: reloading && span > 0 ? clamp((now - w.reloadStart) / span, 0, 1) : 0,
  };
}

/** Count living fighters per team — for the "ALIVE x vs y" HUD pill. */
export function aliveCounts(world: World): { red: number; blue: number } {
  const out = { red: 0, blue: 0 };
  for (const f of world.fighters) if (f.alive) out[f.team] += 1;
  return out;
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

/** Spawn one bolt from `f` along `angle`. Shared by bots and the hero weapon. */
function spawnBolt(
  world: World, f: Fighter, angle: number, now: number,
  speed: number, dmg: number, lifeMs: number,
) {
  const muzzle = FIGHTER_R + BULLET_R + 2;
  world.bullets.push({
    id: world.bulletSeq++,
    x: f.x + Math.cos(angle) * muzzle,
    y: f.y + Math.sin(angle) * muzzle,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    team: f.team,
    ownerId: f.id,
    born: now,
    dmg,
    life: lifeMs,
  });
}

/** Bot firing — one bolt, baseline stats (unchanged behavior). */
function fire(world: World, f: Fighter, angle: number, now: number, cooldown: number) {
  f.cooldownUntil = now + cooldown;
  f.recoil = 1;
  spawnBolt(world, f, angle, now, BULLET_SPEED, BULLET_DMG, BULLET_LIFE * 1000);
  // recoil kick (visual momentum)
  f.vx -= Math.cos(angle) * RECOIL_KICK;
  f.vy -= Math.sin(angle) * RECOIL_KICK;
}

/** Hero firing — full weapon: ammo, spread, pellets, per-weapon recoil/range.
 *  Returns true if a shot actually went out (mag had a round). */
function fireHeroWeapon(world: World, hero: Fighter, angle: number, now: number): boolean {
  const w = world.weapon;
  const spec = getWeapon(w.id);
  if (w.mag <= 0) return false;
  for (let p = 0; p < spec.pellets; p++) {
    const spr = spec.spread ? rnd(-spec.spread, spec.spread) : 0;
    spawnBolt(world, hero, angle + spr, now, spec.bulletSpeed, spec.damage, spec.rangeMs);
  }
  w.mag -= 1;
  hero.cooldownUntil = now + spec.fireRate;
  hero.recoil = 1;
  // single recoil kick regardless of pellet count
  hero.vx -= Math.cos(angle) * RECOIL_KICK * spec.recoil;
  hero.vy -= Math.sin(angle) * RECOIL_KICK * spec.recoil;
  return true;
}

/** Advance the whole world by dt seconds. Mutates `world`; returns events.
 *  Pass `fx` to spawn juice (particles / shake) and collect `sounds`. */
export function step(world: World, dt: number, now: number, fx?: Fx): StepResult {
  const kills: KillEvent[] = [];
  const sounds: ArenaSound[] = [];
  let heroDied = false;
  let heroDeath: { x: number; y: number } | undefined;
  let heroHit: StepResult['heroHit'];
  let heroShot: StepResult['heroShot'];
  let heroDamaged: StepResult['heroDamaged'];
  let heroDownedBy: string | null | undefined;
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

    // ── weapon: finish a completed reload, then fire if ammo allows ──
    const W = world.weapon;
    if (W.reloadUntil > 0 && now >= W.reloadUntil) {
      const spec = getWeapon(W.id);
      W.mag = spec.magSize;
      W.reserve = spec.reserve;
      W.reloadUntil = 0; W.reloadStart = 0;
    }
    const reloading = W.reloadUntil > 0;
    if (inp.firing && !reloading && now >= hero.cooldownUntil) {
      if (fireHeroWeapon(world, hero, angle, now)) {
        fx?.muzzle(hero.x, hero.y, angle, '#FFD43B');
        sounds.push('shoot');
        if (world.multiplayer) {
          const spec = getWeapon(world.weapon.id);
          // one representative bolt for opponents to spawn (flat, accurate enough)
          heroShot = { x: hero.x, y: hero.y, angle, speed: spec.bulletSpeed, dmg: spec.damage, life: spec.rangeMs };
        }
        if (W.mag === 0) requestReload(world, now); // auto-reload when empty
      } else {
        requestReload(world, now); // clicked on an empty mag → start reloading
      }
    }
  }

  // ── BOTS (personality AI + momentum) ──
  for (let i = 1; i < world.fighters.length; i++) {
    const b = world.fighters[i];
    // remote humans are driven by network packets, not AI: render them from the
    // interpolation buffer and never auto-respawn (their owner controls respawn).
    if (b.remote) {
      if (b.alive) {
        updateRemoteFromSnaps(world, b, now, dt);
        resolveObstacles(b, world.obstacles);
      }
      continue;
    }
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
    if (now - bullet.born > bullet.life) continue;
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
        const isHeroBolt = bullet.ownerId === 'hero';

        // MP: a bolt only damages MY local hero. Hitting a remote opponent is
        // feedback-only here — their own client applies the damage to themselves
        // (victim-authoritative), so nobody double-counts.
        if (world.multiplayer && !f.local) {
          fx?.impact(bullet.x, bullet.y, ang, 'player');
          if (isHeroBolt) heroHit = { crit: false, killed: false };
          break;
        }

        // respawn shield absorbs the shot harmlessly
        if (now < f.shieldUntil) {
          fx?.shieldHit(bullet.x, bullet.y);
          sounds.push('shield');
          break;
        }
        const crit = Math.random() < CRIT_CHANCE;
        // hero bolts use their weapon's headshot multiplier; bots use the baseline
        const mult = crit ? (isHeroBolt ? getWeapon(world.weapon.id).headshotMult : BULLET_DMG_CRIT / BULLET_DMG) : 1;
        const dmg = Math.round(bullet.dmg * mult);
        f.hp -= dmg;
        f.flash = 1;
        const killer = world.fighters.find((k) => k.id === bullet.ownerId);
        if (world.multiplayer && f.isHero) heroDamaged = { hp: Math.max(0, f.hp), by: killer?.netId ?? null };
        fx?.impact(bullet.x, bullet.y, ang, 'player');
        fx?.damage(f.x, f.y - FIGHTER_R, dmg, crit);
        sounds.push(crit ? 'crit' : 'hit');
        if (f.isHero) { fx?.addTrauma(crit ? 0.42 : 0.22); if (fx) fx.heroFlash = 1; sounds.push('hurt'); }
        if (isHeroBolt) heroHit = { crit, killed: f.hp <= 0 };

        if (f.hp <= 0 && f.alive) {
          f.alive = false;
          if (world.multiplayer) {
            // f is MY hero. Don't score locally — report who downed me; the host
            // tallies it from my broadcast 'down'. I return via the Learning Pod.
            heroDied = true;
            heroDeath = { x: f.x, y: f.y };
            heroDownedBy = killer?.netId ?? null;
            fx?.kill(f.x, f.y, TEAM_HEX[f.team]);
            fx?.addTrauma(0.7);
            sounds.push('kill');
          } else {
            f.respawnAt = now + RESPAWN_BOT_MS;
            world.scores[bullet.team] += 1;
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
        }
        break;
      }
    }
    if (!hit) live.push(bullet);
  }
  world.bullets = live;

  return { kills, heroDied, heroDeath, sounds, heroHit, heroShot, heroDamaged, heroDownedBy };
}
