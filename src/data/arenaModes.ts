/** The four BATTLE LEARN ARENA team modes. All share one shooter engine;
 *  they differ only in pacing, the win target, and how a "point" is framed.
 *  Targets are tuned for short, kid-friendly matches (2–4 min). */

import type { ArenaMode, ModeId } from '@/lib/arena/types';

export const ARENA_MODES: ArenaMode[] = [
  {
    id: 'deathmatch',
    name: 'Team Tag-Out',
    emoji: '⚔️',
    blurb: 'First team to reach the score wins. Classic team battle!',
    targetScore: 30,
    scoreLabel: 'tag-outs',
    tickMs: 1300,
    learnToRespawn: false,
  },
  {
    id: 'capture-the-flag',
    name: 'Capture the Flag',
    emoji: '🚩',
    blurb: 'Grab the enemy flag and bring it home for big points.',
    targetScore: 5,
    scoreLabel: 'captures',
    tickMs: 2600,
    learnToRespawn: false,
  },
  {
    id: 'king-of-the-hill',
    name: 'King of the Hill',
    emoji: '👑',
    blurb: 'Stand on the hill to earn ticks. Hold it longest to win!',
    targetScore: 20,
    scoreLabel: 'hill ticks',
    tickMs: 1100,
    learnToRespawn: false,
  },
  {
    id: 'knowledge-war',
    name: 'Knowledge War',
    emoji: '🧠',
    blurb: 'You can ONLY respawn by answering questions. Smartest team wins!',
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
