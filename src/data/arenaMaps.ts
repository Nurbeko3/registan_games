/** Battle Learn Arena MAPS.
 *
 *  Each map is a set of cover rectangles in WORLD units (720×440). They feed
 *  straight into `createWorld(perTeam, hero, obstacles)` — no engine change.
 *  Designs aim for: central cover, chokepoints, flank routes and a risk/reward
 *  lane. The left third is the red base, the right third the blue base. */

import { WORLD_W, WORLD_H, type Rect } from '@/lib/arena/engine';

export interface ArenaMap {
  id: string;
  name: string;
  emoji: string;
  size: 'small' | 'medium' | 'large';
  challenge: 'easy' | 'medium' | 'hard';
  blurb: string;
  obstacles: Rect[];
}

const W = WORLD_W, H = WORLD_H;
const cx = W / 2;
const cy = H / 2;

export const ARENA_MAPS: ArenaMap[] = [
  {
    id: 'training',
    name: 'Training Facility',
    emoji: '🎯',
    size: 'medium',
    challenge: 'easy',
    blurb: 'Open and friendly — a clean place to learn the ropes.',
    obstacles: [
      { x: W / 2 - 22, y: H / 2 - 70, w: 44, h: 140 },
      { x: 180, y: 70, w: 90, h: 26 },
      { x: 180, y: H - 96, w: 90, h: 26 },
      { x: W - 270, y: 70, w: 90, h: 26 },
      { x: W - 270, y: H - 96, w: 90, h: 26 },
      { x: W / 2 - 90, y: 40, w: 26, h: 70 },
      { x: W / 2 + 64, y: H - 110, w: 26, h: 70 },
    ],
  },
  {
    id: 'tech-lab',
    name: 'Tech Lab',
    emoji: '🧪',
    size: 'small',
    challenge: 'medium',
    blurb: 'Tight benches and two chokepoints. Watch the crossfire!',
    obstacles: [
      { x: W / 2 - 16, y: 40, w: 32, h: 110 },
      { x: W / 2 - 16, y: H - 150, w: 32, h: 110 },
      { x: 150, y: H / 2 - 18, w: 120, h: 36 },
      { x: W - 270, y: H / 2 - 18, w: 120, h: 36 },
      { x: W / 2 - 70, y: H / 2 - 14, w: 140, h: 28 },
    ],
  },
  {
    id: 'cyber-city',
    name: 'Cyber City',
    emoji: '🌆',
    size: 'large',
    challenge: 'medium',
    blurb: 'A grid of buildings — endless flank routes and ambushes.',
    obstacles: [
      { x: 150, y: 60, w: 54, h: 54 },
      { x: 150, y: H - 114, w: 54, h: 54 },
      { x: W - 204, y: 60, w: 54, h: 54 },
      { x: W - 204, y: H - 114, w: 54, h: 54 },
      { x: W / 2 - 27, y: 50, w: 54, h: 54 },
      { x: W / 2 - 27, y: H - 104, w: 54, h: 54 },
      { x: W / 2 - 90, y: H / 2 - 27, w: 54, h: 54 },
      { x: W / 2 + 36, y: H / 2 - 27, w: 54, h: 54 },
    ],
  },
  {
    id: 'ai-factory',
    name: 'AI Factory',
    emoji: '🏭',
    size: 'medium',
    challenge: 'hard',
    blurb: 'Conveyor walls funnel the fight. A risky center lane scores big.',
    obstacles: [
      { x: W / 2 - 13, y: H / 2 - 90, w: 26, h: 180 }, // tall central divider
      { x: 200, y: 90, w: 150, h: 24 },
      { x: 200, y: H - 114, w: 150, h: 24 },
      { x: W - 350, y: 90, w: 150, h: 24 },
      { x: W - 350, y: H - 114, w: 150, h: 24 },
      { x: 156, y: H / 2 - 13, w: 26, h: 26 },
      { x: W - 182, y: H / 2 - 13, w: 26, h: 26 },
    ],
  },
  {
    id: 'algorithm-temple',
    name: 'Algorithm Temple',
    emoji: '🏛️',
    size: 'medium',
    challenge: 'medium',
    blurb: 'Symmetric pillars and a sacred center hill. Hold the middle!',
    obstacles: [
      { x: W / 2 - 40, y: H / 2 - 40, w: 80, h: 80 }, // central shrine
      { x: 170, y: 80, w: 26, h: 80 },
      { x: 170, y: H - 160, w: 26, h: 80 },
      { x: W - 196, y: 80, w: 26, h: 80 },
      { x: W - 196, y: H - 160, w: 26, h: 80 },
      { x: W / 2 - 13, y: 36, w: 26, h: 60 },
      { x: W / 2 - 13, y: H - 96, w: 26, h: 60 },
    ],
  },
  {
    id: 'mini-maze',
    name: 'Mini Maze',
    emoji: '🧩',
    size: 'small',
    challenge: 'easy',
    blurb: 'Short sightlines, quick turns and safe corners for new players.',
    obstacles: [
      { x: cx - 96, y: cy - 18, w: 64, h: 36 },
      { x: cx + 32, y: cy - 18, w: 64, h: 36 },
      { x: 210, y: 82, w: 34, h: 116 },
      { x: 210, y: H - 198, w: 34, h: 116 },
      { x: W - 244, y: 82, w: 34, h: 116 },
      { x: W - 244, y: H - 198, w: 34, h: 116 },
      { x: cx - 16, y: 40, w: 32, h: 70 },
      { x: cx - 16, y: H - 110, w: 32, h: 70 },
    ],
  },
  {
    id: 'open-sky-yard',
    name: 'Open Sky Yard',
    emoji: '🛸',
    size: 'large',
    challenge: 'easy',
    blurb: 'Wide lanes for movement practice, dodging and long-range blasters.',
    obstacles: [
      { x: cx - 32, y: cy - 32, w: 64, h: 64 },
      { x: 210, y: 92, w: 82, h: 24 },
      { x: 210, y: H - 116, w: 82, h: 24 },
      { x: W - 292, y: 92, w: 82, h: 24 },
      { x: W - 292, y: H - 116, w: 82, h: 24 },
    ],
  },
  {
    id: 'crystal-caves',
    name: 'Crystal Caves',
    emoji: '💎',
    size: 'small',
    challenge: 'hard',
    blurb: 'Jagged cover makes every angle tricky. Great for close fights.',
    obstacles: [
      { x: cx - 22, y: 42, w: 44, h: 106 },
      { x: cx - 22, y: H - 148, w: 44, h: 106 },
      { x: 190, y: cy - 78, w: 92, h: 32 },
      { x: 190, y: cy + 46, w: 92, h: 32 },
      { x: W - 282, y: cy - 78, w: 92, h: 32 },
      { x: W - 282, y: cy + 46, w: 92, h: 32 },
      { x: cx - 82, y: cy - 20, w: 48, h: 40 },
      { x: cx + 34, y: cy - 20, w: 48, h: 40 },
    ],
  },
  {
    id: 'rocket-docks',
    name: 'Rocket Docks',
    emoji: '🚀',
    size: 'large',
    challenge: 'medium',
    blurb: 'Long outer routes and a busy center dock reward smart flanks.',
    obstacles: [
      { x: cx - 18, y: 28, w: 36, h: 120 },
      { x: cx - 18, y: H - 148, w: 36, h: 120 },
      { x: cx - 92, y: cy - 18, w: 184, h: 36 },
      { x: 176, y: 76, w: 34, h: 78 },
      { x: 176, y: H - 154, w: 34, h: 78 },
      { x: W - 210, y: 76, w: 34, h: 78 },
      { x: W - 210, y: H - 154, w: 34, h: 78 },
    ],
  },
  {
    id: 'forest-circuit',
    name: 'Forest Circuit',
    emoji: '🌲',
    size: 'medium',
    challenge: 'easy',
    blurb: 'Soft ring-shaped cover keeps fights moving around the middle.',
    obstacles: [
      { x: cx - 72, y: cy - 72, w: 42, h: 42 },
      { x: cx + 30, y: cy - 72, w: 42, h: 42 },
      { x: cx - 72, y: cy + 30, w: 42, h: 42 },
      { x: cx + 30, y: cy + 30, w: 42, h: 42 },
      { x: 190, y: 82, w: 70, h: 28 },
      { x: 190, y: H - 110, w: 70, h: 28 },
      { x: W - 260, y: 82, w: 70, h: 28 },
      { x: W - 260, y: H - 110, w: 70, h: 28 },
    ],
  },
  {
    id: 'boss-bridge',
    name: 'Boss Bridge',
    emoji: '🌉',
    size: 'medium',
    challenge: 'hard',
    blurb: 'A narrow bridge splits the arena. Control the bridge or flank wide.',
    obstacles: [
      { x: cx - 138, y: cy - 86, w: 276, h: 28 },
      { x: cx - 138, y: cy + 58, w: 276, h: 28 },
      { x: cx - 18, y: cy - 58, w: 36, h: 116 },
      { x: 170, y: 68, w: 48, h: 88 },
      { x: 170, y: H - 156, w: 48, h: 88 },
      { x: W - 218, y: 68, w: 48, h: 88 },
      { x: W - 218, y: H - 156, w: 48, h: 88 },
    ],
  },
  {
    id: 'pixel-park',
    name: 'Pixel Park',
    emoji: '🎮',
    size: 'large',
    challenge: 'easy',
    blurb: 'Playful open pockets with enough cover for every team size.',
    obstacles: [
      { x: 200, y: 74, w: 58, h: 58 },
      { x: 200, y: H - 132, w: 58, h: 58 },
      { x: W - 258, y: 74, w: 58, h: 58 },
      { x: W - 258, y: H - 132, w: 58, h: 58 },
      { x: cx - 100, y: cy - 18, w: 56, h: 36 },
      { x: cx + 44, y: cy - 18, w: 56, h: 36 },
      { x: cx - 18, y: cy - 92, w: 36, h: 54 },
      { x: cx - 18, y: cy + 38, w: 36, h: 54 },
    ],
  },
  {
    id: 'neon-crossroads',
    name: 'Neon Crossroads',
    emoji: '✨',
    size: 'small',
    challenge: 'hard',
    blurb: 'Fast rotations, sharp corners and dangerous center crossings.',
    obstacles: [
      { x: cx - 112, y: cy - 18, w: 84, h: 36 },
      { x: cx + 28, y: cy - 18, w: 84, h: 36 },
      { x: cx - 18, y: cy - 112, w: 36, h: 84 },
      { x: cx - 18, y: cy + 28, w: 36, h: 84 },
      { x: 188, y: 72, w: 44, h: 44 },
      { x: 188, y: H - 116, w: 44, h: 44 },
      { x: W - 232, y: 72, w: 44, h: 44 },
      { x: W - 232, y: H - 116, w: 44, h: 44 },
    ],
  },
];

export const getMap = (id: string): ArenaMap => ARENA_MAPS.find((m) => m.id === id) ?? ARENA_MAPS[0];
