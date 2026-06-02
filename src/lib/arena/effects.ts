/** Game-feel effects layer for BATTLE LEARN ARENA.
 *
 *  Particles, floating damage numbers, expanding impact rings, muzzle flashes
 *  and trauma-based screen shake. Pure logic (no React, no canvas) so the engine
 *  can SPAWN effects and the renderer can DRAW them — keeping the clean split.
 *
 *  Allocation-light by design (in-place array compaction, a hard particle cap)
 *  so it holds 60 FPS even in the thick of a 10v10 firefight. */

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  drag: number; gravity: number;
}
export interface FloatText {
  x: number; y: number; vy: number; life: number; max: number;
  text: string; color: string; size: number; crit: boolean;
}
export interface Ring {
  x: number; y: number; r: number; maxR: number;
  life: number; max: number; color: string; width: number;
}
export interface Flash { x: number; y: number; r: number; life: number; max: number; color: string }

const TAU = Math.PI * 2;
const PARTICLE_CAP = 600;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Fx {
  particles: Particle[] = [];
  texts: FloatText[] = [];
  rings: Ring[] = [];
  flashes: Flash[] = [];
  /** 0..1 screen-shake energy; shake = trauma² so small hits barely register. */
  trauma = 0;
  /** 0..1 red vignette pulse when the HERO takes damage. */
  heroFlash = 0;
  /** scales every spawn — set to 0.35 when the player prefers reduced motion. */
  intensity = 1;

  addTrauma(a: number) { this.trauma = Math.min(1, this.trauma + a * this.intensity); }

  private push(p: Particle) { if (this.particles.length < PARTICLE_CAP) this.particles.push(p); }

  private spray(x: number, y: number, angle: number, color: string, count: number, speed: number, spread = 0.9) {
    const n = Math.max(1, Math.round(count * this.intensity));
    for (let i = 0; i < n; i++) {
      const a = angle + rnd(-spread, spread);
      const s = speed * rnd(0.4, 1);
      this.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.18, 0.42), max: 0.42, size: rnd(1.5, 3.5), color, drag: 4, gravity: 0 });
    }
  }

  /** Bright flash + sparks at a gun muzzle when a shot is fired. */
  muzzle(x: number, y: number, angle: number, color: string) {
    const mx = x + Math.cos(angle) * 18, my = y + Math.sin(angle) * 18;
    this.flashes.push({ x: mx, y: my, r: 13, life: 0.07, max: 0.07, color });
    this.spray(mx, my, angle, color, 4, 260, 0.5);
  }

  /** Bullet impact — different feel for a wall, a player, or an obstacle. */
  impact(x: number, y: number, angle: number, kind: 'wall' | 'player' | 'obstacle') {
    const color = kind === 'player' ? '#FFFFFF' : kind === 'wall' ? '#C9BEF7' : '#9B82FF';
    this.spray(x, y, angle + Math.PI, color, kind === 'player' ? 10 : 6, kind === 'player' ? 220 : 150);
    this.rings.push({ x, y, r: 3, maxR: kind === 'player' ? 22 : 13, life: 0.28, max: 0.28, color, width: kind === 'player' ? 3 : 2 });
  }

  /** A floating, rising damage number (gold + bigger on a crit). */
  damage(x: number, y: number, amount: number, crit: boolean) {
    this.texts.push({
      x: x + rnd(-4, 4), y, vy: -52, life: crit ? 0.95 : 0.7, max: crit ? 0.95 : 0.7,
      text: crit ? `${amount}!` : `${amount}`, color: crit ? '#FFD43B' : '#FFFFFF', size: crit ? 22 : 15, crit,
    });
  }

  /** Big celebratory burst when a fighter is tagged out. */
  kill(x: number, y: number, color: string) {
    this.spray(x, y, 0, color, 18, 260, Math.PI);
    this.rings.push({ x, y, r: 6, maxR: 46, life: 0.45, max: 0.45, color, width: 4 });
    this.rings.push({ x, y, r: 3, maxR: 30, life: 0.35, max: 0.35, color: '#FFFFFF', width: 2 });
    const n = Math.round(10 * this.intensity);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU);
      this.push({ x, y, vx: Math.cos(a) * rnd(60, 200), vy: Math.sin(a) * rnd(60, 200), life: rnd(0.3, 0.7), max: 0.7, size: rnd(2, 4), color: i % 2 ? color : '#FFD43B', drag: 3, gravity: 120 });
    }
  }

  /** Sparkly portal that collapses inward as the hero respawns. */
  portal(x: number, y: number, color: string) {
    for (let k = 0; k < 3; k++) this.rings.push({ x, y, r: 42 - k * 8, maxR: 5, life: 0.5, max: 0.5, color, width: 3 });
    const n = Math.round(16 * this.intensity);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), r = rnd(20, 42);
      this.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: -Math.cos(a) * 130, vy: -Math.sin(a) * 130, life: 0.5, max: 0.5, size: rnd(2, 4), color, drag: 1, gravity: 0 });
    }
  }

  /** A shield ping when a shot is absorbed by the respawn shield. */
  shieldHit(x: number, y: number) {
    this.rings.push({ x, y, r: 18, maxR: 30, life: 0.25, max: 0.25, color: '#7FE7FF', width: 3 });
  }

  /** Advance every effect by dt seconds, compacting dead ones in place. */
  update(dt: number) {
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    this.heroFlash = Math.max(0, this.heroFlash - dt * 2.2);

    let n = 0;
    for (const p of this.particles) {
      const f = Math.min(1, p.drag * dt);
      p.vx -= p.vx * f; p.vy -= p.vy * f; p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life > 0) this.particles[n++] = p;
    }
    this.particles.length = n;

    let t = 0;
    for (const f of this.texts) {
      f.y += f.vy * dt; f.vy += 38 * dt; f.life -= dt;
      if (f.life > 0) this.texts[t++] = f;
    }
    this.texts.length = t;

    let r = 0;
    for (const ring of this.rings) {
      ring.r += (ring.maxR - ring.r) * Math.min(1, 8 * dt); ring.life -= dt;
      if (ring.life > 0) this.rings[r++] = ring;
    }
    this.rings.length = r;

    let fl = 0;
    for (const f of this.flashes) { f.life -= dt; if (f.life > 0) this.flashes[fl++] = f; }
    this.flashes.length = fl;
  }

  /** Current camera offset (css px) + a tiny rotation, from trauma². */
  shake(maxPx: number) {
    const t = this.trauma * this.trauma;
    return { x: rnd(-1, 1) * t * maxPx, y: rnd(-1, 1) * t * maxPx, rot: rnd(-1, 1) * t * 0.035 };
  }
}
