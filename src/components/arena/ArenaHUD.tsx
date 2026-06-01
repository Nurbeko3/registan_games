'use client';

import { motion } from 'framer-motion';
import { TEAMS, type ArenaMode, type TeamId } from '@/lib/arena/types';

// static classes so Tailwind's JIT can see them (never build class names dynamically)
const TEAM_NUM: Record<TeamId, string> = { red: 'text-bubble-600', blue: 'text-sky-600' };

/** Top-of-arena scoreboard: both team tallies, the objective, and a race bar
 *  toward the win target. Mirrors the bright HUD style used elsewhere. */
export function ArenaHUD({
  mode,
  scores,
  myTeam,
}: {
  mode: ArenaMode;
  scores: { red: number; blue: number };
  myTeam: TeamId;
}) {
  const pct = (n: number) => Math.min(100, (n / mode.targetScore) * 100);

  return (
    <div className="rounded-xl2 bg-white/90 p-3 shadow-card ring-1 ring-ink/[0.03] backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <TeamTally team="red" score={scores.red} mine={myTeam === 'red'} />
        <div className="text-center">
          <p className="text-xl leading-none">{mode.emoji}</p>
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-faint">
            first to {mode.targetScore}
          </p>
        </div>
        <TeamTally team="blue" score={scores.blue} mine={myTeam === 'blue'} align="right" />
      </div>

      {/* race bars */}
      <div className="mt-2 flex gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-bubble/15">
          <motion.div animate={{ width: `${pct(scores.red)}%` }} className="ml-auto h-full bg-bubble" />
        </div>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-sky/15">
          <motion.div animate={{ width: `${pct(scores.blue)}%` }} className="h-full bg-sky" />
        </div>
      </div>
    </div>
  );
}

function TeamTally({
  team,
  score,
  mine,
  align = 'left',
}: {
  team: TeamId;
  score: number;
  mine: boolean;
  align?: 'left' | 'right';
}) {
  const info = TEAMS[team];
  return (
    <div className={`flex items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <span className="text-2xl">{info.emoji}</span>
      <div className={align === 'right' ? 'text-right' : ''}>
        <p className={`font-display text-2xl font-extrabold leading-none ${TEAM_NUM[team]}`}>{score}</p>
        <p className="text-[10px] font-bold text-ink-faint">{info.name}{mine && ' (you)'}</p>
      </div>
    </div>
  );
}
