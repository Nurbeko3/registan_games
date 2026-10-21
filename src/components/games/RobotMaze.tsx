'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { GameProps } from './GameProps';

type Cmd = 'up' | 'down' | 'left' | 'right';

const GRID = 5;
const MOVES: Record<Cmd, { dx: number; dy: number; icon: IconName; rot: string }> = {
  up:    { dx: 0,  dy: -1, icon: 'chevronDown', rot: 'rotate-180' },
  down:  { dx: 0,  dy:  1, icon: 'chevronDown', rot: '' },
  left:  { dx: -1, dy:  0, icon: 'chevronLeft', rot: '' },
  right: { dx:  1, dy:  0, icon: 'chevronRight', rot: '' },
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

function MoveGlyph({ c, className = 'h-5 w-5' }: { c: Cmd; className?: string }) {
  return <Icon name={MOVES[c].icon} className={`${className} ${MOVES[c].rot}`} />;
}

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
        setMsg('Oops! The robot hit a wall. Try again!');
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
        setMsg(`Level ${levelIdx + 1} done! Next level…`);
        setRunning(false);
      } else {
        onWin(stars);
        setRunning(false);
      }
    } else {
      setMsg('Almost! Collect all gems and reach the flag.');
      setRunning(false);
    }
  }, [program, totalGems, onWin, level, levelIdx, reset]);

  const isSuccessMsg = msg?.startsWith('Level') ?? false;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* level tabs */}
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <div role="tablist" aria-label="Level" className="inline-flex rounded-lg bg-surface-3 p-0.5">
          {LEVELS.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === levelIdx}
              onClick={() => switchLevel(i)}
              className={`min-h-[34px] rounded-md px-3.5 text-sm font-bold tabular-nums transition ${
                i === levelIdx ? 'bg-surface text-fg shadow-xs' : 'text-fg-soft hover:text-fg'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <span className="text-sm font-semibold text-fg-soft">{level.label}</span>
      </div>

      <div className="card">
        <div className="mx-auto grid aspect-square w-full max-w-md grid-cols-5 gap-1.5 rounded-xl border border-border bg-surface-2 p-2">
          {level.grid.map((row, y) =>
            row.map((cell, x) => {
              const isRobot = robot.x === x && robot.y === y;
              const isGem = cell === 2 && !collected.has(`${x},${y}`);
              return (
                <div
                  key={`${x}-${y}`}
                  className={`relative grid place-items-center rounded-lg ${cell === 1 ? 'bg-fg/80 dark:bg-border-strong' : 'bg-surface shadow-xs'}`}
                >
                  {cell === 9 && <span className="text-2xl sm:text-3xl" aria-label="Flag">🏁</span>}
                  {isGem && <span className="text-2xl sm:text-3xl" aria-label="Gem">💎</span>}
                  {isRobot && (
                    <motion.span
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute text-3xl sm:text-4xl"
                      aria-label="Robot"
                    >
                      🤖
                    </motion.span>
                  )}
                </div>
              );
            }),
          )}
        </div>
        <p className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-fg-soft">
          <span className="chip bg-surface-2 text-fg-soft tabular-nums"><Icon name="gem" className="h-3.5 w-3.5 text-info-500" /> {collected.size}/{totalGems}</span>
          <span className="chip bg-surface-2 text-fg-soft tabular-nums">par: {level.parMoves} moves</span>
        </p>
        {msg && (
          <p role="status" className={`mt-3 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium ${
            isSuccessMsg ? 'border-success-100 bg-success-50 text-success-700' : 'border-danger-100 bg-danger-50 text-danger-700'
          }`}>
            <Icon name={isSuccessMsg ? 'checkCircle' : 'warning'} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{msg}</span>
          </p>
        )}
      </div>

      <div className="card flex flex-col">
        <p className="eyebrow">{t('mg.robot.build')}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {(Object.keys(MOVES) as Cmd[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setProgram((p) => [...p, c])}
              disabled={running}
              aria-label={c}
              className="btn-secondary btn-icon h-12 w-12 min-h-0 text-fg"
            >
              <MoveGlyph c={c} className="h-5 w-5" />
            </button>
          ))}
        </div>
        <div className="mt-3 min-h-24 flex-1 rounded-xl border border-dashed border-border-strong bg-surface-2 p-2.5">
          {program.length === 0 ? (
            <p className="grid h-full place-items-center text-sm font-semibold text-fg-faint">
              {t('mg.robot.addSteps')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {program.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setProgram((p) => p.filter((_, idx) => idx !== i))}
                  aria-label={`${c} (remove)`}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white transition hover:bg-brand-600"
                >
                  <MoveGlyph c={c} className="h-4 w-4" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={run}
            disabled={running || !program.length}
            className="btn-primary flex-1"
          >
            <Icon name="play" className="h-4 w-4" />
            {running ? t('mg.robot.running') : t('mg.robot.run')}
          </button>
          <button type="button" onClick={() => reset()} disabled={running} className="btn-secondary">
            {t('mg.robot.clear')}
          </button>
        </div>
      </div>
    </div>
  );
}
