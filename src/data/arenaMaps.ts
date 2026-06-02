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
  blurb: string;
  obstacles: Rect[];
}

const W = WORLD_W, H = WORLD_H;

export const ARENA_MAPS: ArenaMap[] = [
  {
    id: 'training',
    name: 'Training Facility',
    emoji: '🎯',
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
    blurb: 'Conveyor walls funnel the fight. A risky center lane scores big.',
    obstacles: [
      { x: W / 2 - 13, y: H / 2 - 90, w: 26, h: 180 }, // tall central divider
      { x: 200, y: 90, w: 150, h: 24 },
      { x: 200, y: H - 114, w: 150, h: 24 },
      { x: W - 350, y: 90, w: 150, h: 24 },
      { x: W - 350, y: H - 114, w: 150, h: 24 },
      { x: 120, y: H / 2 - 13, w: 26, h: 26 },
      { x: W - 146, y: H / 2 - 13, w: 26, h: 26 },
    ],
  },
  {
    id: 'algorithm-temple',
    name: 'Algorithm Temple',
    emoji: '🏛️',
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
];

export const getMap = (id: string): ArenaMap => ARENA_MAPS.find((m) => m.id === id) ?? ARENA_MAPS[0];
