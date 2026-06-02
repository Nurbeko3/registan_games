/** Canvas renderer for the arena shooter. Pure drawing — no game logic.
 *  Draws in WORLD units; the component applies the world→canvas camera first
 *  (scale, zoom, shake). Also draws the full game-feel effects layer (particles,
 *  damage numbers, impact rings, muzzle flashes). */

import { FIGHTER_R, BULLET_R, type World, type Fighter } from './engine';
import type { Fx } from './effects';

const TEAM_COLOR: Record<string, string> = { red: '#FF7AB6', blue: '#3BA7FF' };
const TEAM_DARK: Record<string, string> = { red: '#F0509A', blue: '#1E8FF0' };

export function drawWorld(ctx: CanvasRenderingContext2D, world: World, now: number, fx?: Fx) {
  const { w, h } = world;

  // floor
  ctx.fillStyle = '#F1EDFF';
  ctx.fillRect(0, 0, w, h);

  // subtle grid
  ctx.strokeStyle = 'rgba(124,92,252,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y <= h; y += 40) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();

  // team bases (tinted end zones)
  ctx.fillStyle = 'rgba(255,122,182,0.12)';
  ctx.fillRect(0, 0, 70, h);
  ctx.fillStyle = 'rgba(59,167,255,0.12)';
  ctx.fillRect(w - 70, 0, 70, h);

  // obstacles (cover)
  for (const r of world.obstacles) {
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = '#C9BEF7';
    ctx.fill();
    ctx.strokeStyle = '#9B82FF';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // impact rings (under fighters)
  if (fx) {
    for (const ring of fx.rings) {
      ctx.globalAlpha = Math.max(0, ring.life / ring.max);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = ring.width;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // bullets (beefier glow + trail)
  for (const b of world.bullets) {
    ctx.strokeStyle = TEAM_COLOR[b.team];
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BULLET_R, 0, Math.PI * 2);
    ctx.fillStyle = TEAM_DARK[b.team];
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // fighters
  for (const f of world.fighters) {
    if (!f.alive) { drawRespawning(ctx, f, now); continue; }
    drawFighter(ctx, f, now);
  }

  // particles (additive-ish, over fighters)
  if (fx) {
    for (const p of fx.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life / p.max), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // muzzle flashes
    for (const fl of fx.flashes) {
      ctx.globalAlpha = Math.max(0, fl.life / fl.max);
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2);
      ctx.fillStyle = fl.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // floating damage numbers
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of fx.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.max);
      ctx.font = `900 ${t.size}px system-ui`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(30,27,58,0.6)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, now: number) {
  // recoil offset — body kicks backward along the aim when firing
  const rb = f.recoil * 5;
  const fxp = f.x - Math.cos(f.aimAngle) * rb;
  const fyp = f.y - Math.sin(f.aimAngle) * rb;

  // shield aura (post-respawn invulnerability)
  if (now < f.shieldUntil) {
    const pulse = 0.6 + 0.4 * Math.sin(now / 90);
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(f.x, f.y, FIGHTER_R + 7, 0, Math.PI * 2);
    ctx.strokeStyle = '#7FE7FF';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // aim line (hero only — shows where you'll shoot)
  if (f.isHero) {
    ctx.strokeStyle = 'rgba(255,212,59,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fxp, fyp);
    ctx.lineTo(fxp + Math.cos(f.aimAngle) * 46, fyp + Math.sin(f.aimAngle) * 46);
    ctx.stroke();
  }

  // body
  ctx.beginPath();
  ctx.arc(fxp, fyp, FIGHTER_R, 0, Math.PI * 2);
  ctx.fillStyle = TEAM_COLOR[f.team];
  ctx.fill();
  ctx.lineWidth = f.isHero ? 4 : 2;
  ctx.strokeStyle = f.isHero ? '#FFD43B' : TEAM_DARK[f.team];
  ctx.stroke();

  // white hit flash on taking damage
  if (f.flash > 0) {
    ctx.globalAlpha = f.flash * 0.8;
    ctx.beginPath();
    ctx.arc(fxp, fyp, FIGHTER_R, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // face
  ctx.font = `${FIGHTER_R + 4}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(f.emoji, fxp, fyp + 1);

  // HP bar
  const bw = FIGHTER_R * 2;
  const hp = Math.max(0, f.hp) / 100;
  ctx.fillStyle = 'rgba(30,27,58,0.25)';
  ctx.fillRect(fxp - FIGHTER_R, fyp - FIGHTER_R - 9, bw, 4);
  ctx.fillStyle = hp > 0.5 ? '#22C55E' : hp > 0.25 ? '#FFD43B' : '#FF7AB6';
  ctx.fillRect(fxp - FIGHTER_R, fyp - FIGHTER_R - 9, bw * hp, 4);

  if (f.isHero) {
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = '#1E1B3A';
    ctx.fillText('YOU', fxp, fyp - FIGHTER_R - 18);
  }
}

function drawRespawning(ctx: CanvasRenderingContext2D, f: Fighter, now: number) {
  const t = (now % 1000) / 1000;
  ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * Math.PI * 2);
  ctx.beginPath();
  ctx.arc(f.x, f.y, FIGHTER_R, 0, Math.PI * 2);
  ctx.fillStyle = TEAM_COLOR[f.team];
  ctx.fill();
  ctx.globalAlpha = 1;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
