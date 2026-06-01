/** Canvas renderer for the arena shooter. Pure drawing — no game logic.
 *  Draws in WORLD units; the component applies the world→canvas scale first. */

import { FIGHTER_R, BULLET_R, type World, type Fighter } from './engine';

const TEAM_COLOR: Record<string, string> = { red: '#FF7AB6', blue: '#3BA7FF' };
const TEAM_DARK: Record<string, string> = { red: '#F0509A', blue: '#1E8FF0' };

export function drawWorld(ctx: CanvasRenderingContext2D, world: World, now: number) {
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

  // bullets
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, BULLET_R, 0, Math.PI * 2);
    ctx.fillStyle = TEAM_DARK[b.team];
    ctx.fill();
    // little trail
    ctx.strokeStyle = TEAM_COLOR[b.team];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.stroke();
  }

  // fighters
  for (const f of world.fighters) {
    if (!f.alive) {
      drawRespawning(ctx, f, now);
      continue;
    }
    drawFighter(ctx, f);
  }
}

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter) {
  // aim line (hero only — shows where you'll shoot)
  if (f.isHero) {
    ctx.strokeStyle = 'rgba(255,212,59,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(f.x + Math.cos(f.aimAngle) * 46, f.y + Math.sin(f.aimAngle) * 46);
    ctx.stroke();
  }

  // body
  ctx.beginPath();
  ctx.arc(f.x, f.y, FIGHTER_R, 0, Math.PI * 2);
  ctx.fillStyle = TEAM_COLOR[f.team];
  ctx.fill();
  ctx.lineWidth = f.isHero ? 4 : 2;
  ctx.strokeStyle = f.isHero ? '#FFD43B' : TEAM_DARK[f.team];
  ctx.stroke();

  // face
  ctx.font = `${FIGHTER_R + 4}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(f.emoji, f.x, f.y + 1);

  // HP bar
  const bw = FIGHTER_R * 2;
  const hp = Math.max(0, f.hp) / 100;
  ctx.fillStyle = 'rgba(30,27,58,0.25)';
  ctx.fillRect(f.x - FIGHTER_R, f.y - FIGHTER_R - 9, bw, 4);
  ctx.fillStyle = hp > 0.5 ? '#22C55E' : hp > 0.25 ? '#FFD43B' : '#FF7AB6';
  ctx.fillRect(f.x - FIGHTER_R, f.y - FIGHTER_R - 9, bw * hp, 4);

  if (f.isHero) {
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = '#1E1B3A';
    ctx.fillText('YOU', f.x, f.y - FIGHTER_R - 18);
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
