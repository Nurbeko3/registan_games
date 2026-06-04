'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';
import type { GameProps } from './GameProps';

type Cmd = 'up' | 'down' | 'left' | 'right';

const GRID = 5;
const MOVES: Record<Cmd, { dx: number; dy: number; icon: string }> = {
  up:    { dx: 0,  dy: -1, icon: '⬆️' },
  down:  { dx: 0,  dy:  1, icon: '⬇️' },
  left:  { dx: -1, dy:  0, icon: '⬅️' },
  right: { dx:  1, dy:  0, icon: '➡️' },
};

// 0 empty · 1 wall · 2 gem · 9 goal
interface LevelDef {
  grid: number[][];
  start: { x: number; y: number };
  parMoves: number; // 3-star threshold
  goodMoves: number; // 2-star threshold
  label: string;
}

const LEVELS: LevelDef[] = [
  {
    label: 'Level 1 — Forest Path',
    start: { x: 0, y: 0 },
    parMoves: 9,
    goodMoves: 12,
    grid: [
      [0, 0, 1, 2, 0],
      [0, 1, 0, 0, 0],
      [0, 0, 0, 1, 0],
      [2, 1, 0, 1, 0],
      [0, 0, 0, 0, 9],
    ],
  },
  {
    label: 'Level 2 — Gem Cave',
    start: { x: 0, y: 4 },
    parMoves: 10,
    goodMoves: 14,
    grid: [
      [0, 0, 0, 0, 9],
      [1, 1, 0, 1, 0],
      [2, 0, 0, 0, 0],
      [1, 0, 1, 1, 0],
      [0, 0, 2, 0, 0],
    ],
  },
  {
    label: 'Level 3 — Robot Factory',
    start: { x: 0, y: 0 },
    parMoves: 11,
    goodMoves: 15,
    grid: [
      [0, 0, 0, 1, 2],
      [0, 1, 0, 0, 0],
      [0, 0, 1, 0, 1],
      [1, 0, 0, 0, 0],
      [2, 0, 1, 0, 9],
    ],
  },
];

export function RobotMaze({ onWin }: GameProps) {
  const t = useT();
  const [levelIdx, setLevelIdx] = useState(0);
  const [program, setProgram] = useState<Cmd[]>([]);
  const [robot, setRobot] = useState(LEVELS[0].start);
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const level = LEVELS[levelIdx];
  const totalGems = level.grid.flat().filter((c) => c === 2).length;

  const reset = useCallback((idx = levelIdx) => {
    setRobot(LEVELS[idx].start);
    setCollected(new Set());
    setMsg(null);
    setProgram([]);
  }, [levelIdx]);

  const switchLevel = (idx: number) => {
    setLevelIdx(idx);
    reset(idx);
  };

  const run = useCallback(async () => {
    setRunning(true);
    setMsg(null);
    let pos = { ...level.start };
    const got = new Set<string>();

    for (const cmd of program) {
      const { dx, dy } = MOVES[cmd];
      const next = { x: pos.x + dx, y: pos.y + dy };
      if (
        next.x < 0 || next.x >= GRID ||
        next.y < 0 || next.y >= GRID ||
        level.grid[next.y][next.x] === 1
      ) {
        setMsg('💥 Oops! The robot hit a wall. Try again!');
        setRunning(false);
        return;
      }
      pos = next;
      setRobot({ ...pos });
      if (level.grid[pos.y][pos.x] === 2) {
        got.add(`${pos.x},${pos.y}`);
        setCollected(new Set(got));
      }
      await new Promise((r) => setTimeout(r, 280));
    }

    if (level.grid[pos.y][pos.x] === 9 && got.size === totalGems) {
      const moves = program.length;
      const stars = moves <= level.parMoves ? 3 : moves <= level.goodMoves ? 2 : 1;
      if (levelIdx < LEVELS.length - 1) {
        setTimeout(() => {
          const next = levelIdx + 1;
          setLevelIdx(next);
          reset(next);
          setRunning(false);
        }, 600);
        setMsg(`⭐ Level ${levelIdx + 1} done! Next level…`);
        setRunning(false);
      } else {
        onWin(stars);
        setRunning(false);
      }
    } else {
      setMsg('Almost! Collect all 💎 and reach 🏁.');
      setRunning(false);
    }
  }, [program, totalGems, onWin, level, levelIdx, reset]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* level tabs */}
      <div className="flex gap-2 sm:col-span-2">
        {LEVELS.map((l, i) => (
          <button
            key={i}
            onClick={() => switchLevel(i)}
            className={`rounded-2xl px-3 py-1.5 text-xs font-bold shadow-card transition ${
              i === levelIdx ? 'bg-grape text-white' : 'bg-white text-ink-faint'
            }`}
          >
            {i + 1}
          </button>
        ))}
        <span className="ml-1 self-center text-xs font-bold text-ink-faint">{level.label}</span>
      </div>

      <div className="card">
        <div className="mx-auto grid aspect-square w-full max-w-xs grid-cols-5 gap-1.5 rounded-2xl bg-grape-50 p-2">
          {level.grid.map((row, y) =>
            row.map((cell, x) => {
              const isRobot = robot.x === x && robot.y === y;
              const isGem = cell === 2 && !collected.has(`${x},${y}`);
              return (
                <div
                  key={`${x}-${y}`}
                  className={`relative grid place-items-center rounded-xl ${cell === 1 ? 'bg-ink/80' : 'bg-white'}`}
                >
                  {cell === 9 && <span className="text-xl">🏁</span>}
                  {isGem && <span className="text-xl">💎</span>}
                  {isRobot && (
                    <motion.span
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute text-2xl"
                    >
                      🤖
                    </motion.span>
                  )}
                </div>
              );
            }),
          )}
        </div>
        <p className="mt-2 text-center text-sm font-bold text-ink-soft">
          💎 {collected.size}/{totalGems} · par: {level.parMoves} moves
        </p>
        {msg && (
          <p className="mt-2 rounded-xl bg-bubble/15 p-2 text-center text-sm font-bold text-bubble-600">
            {msg}
          </p>
        )}
      </div>

      <div className="card flex flex-col">
        <p className="font-display font-extrabold">{t('mg.robot.build')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(MOVES) as Cmd[]).map((c) => (
            <button
              key={c}
              onClick={() => setProgram((p) => [...p, c])}
              disabled={running}
              className="btn-ghost px-3 py-2 text-sm disabled:opacity-40"
            >
              {MOVES[c].icon}
            </button>
          ))}
        </div>
        <div className="mt-3 min-h-[70px] flex-1 rounded-2xl bg-cloud p-2">
          {program.length === 0 ? (
            <p className="grid h-full place-items-center text-sm text-ink-faint">
              {t('mg.robot.addSteps')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {program.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setProgram((p) => p.filter((_, idx) => idx !== i))}
                  className="chip bg-grape text-white"
                >
                  {MOVES[c].icon}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={run}
            disabled={running || !program.length}
            className="btn-primary flex-1 disabled:opacity-40"
          >
            {running ? t('mg.robot.running') : t('mg.robot.run')}
          </button>
          <button onClick={() => reset()} disabled={running} className="btn-ghost">
            {t('mg.robot.clear')}
          </button>
        </div>
      </div>
    </div>
  );
}
