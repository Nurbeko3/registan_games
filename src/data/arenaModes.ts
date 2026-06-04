/** Battle Learn Arena currently supports timed tag-out matches. These variants
 *  keep the lobby interesting without promising unimplemented objectives. */

import type { ArenaMode, ModeId } from '@/lib/arena/types';

export const ARENA_MODES: ArenaMode[] = [
  {
    id: 'deathmatch',
    name: 'Team Tag-Out',
    emoji: '⚔️',
    blurb: 'Score the most tag-outs before the timer ends.',
    targetScore: 30,
    scoreLabel: 'tag-outs',
    tickMs: 1300,
    learnToRespawn: false,
  },
  {
    id: 'capture-the-flag',
    name: 'Quick Tag Rush',
    emoji: '🏁',
    blurb: 'A faster tag-out round with shorter pressure windows.',
    targetScore: 20,
    scoreLabel: 'tag-outs',
    tickMs: 2600,
    learnToRespawn: false,
  },
  {
    id: 'king-of-the-hill',
    name: 'Squad Holdout',
    emoji: '🛡️',
    blurb: 'A steadier round where staying alive with your squad matters.',
    targetScore: 20,
    scoreLabel: 'tag-outs',
    tickMs: 1100,
    learnToRespawn: false,
  },
  {
    id: 'knowledge-war',
    name: 'Knowledge War',
    emoji: '🧠',
    blurb: 'Every tag-out opens a Learning Pod. Answer well and swing the match.',
    targetScore: 24,
    scoreLabel: 'tag-outs',
    tickMs: 1500,
    learnToRespawn: true,
  },
];

export const getMode = (id: ModeId): ArenaMode =>
  ARENA_MODES.find((m) => m.id === id) ?? ARENA_MODES[0];

/** Team sizes a kid can pick in the lobby. */
export const TEAM_SIZES = [
  { perTeam: 3, label: '3 v 3' },
  { perTeam: 5, label: '5 v 5' },
  { perTeam: 10, label: '10 v 10' },
] as const;
