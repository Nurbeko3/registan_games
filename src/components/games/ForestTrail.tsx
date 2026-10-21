'use client';

import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { GameProps } from './GameProps';

/**
 * FOREST TRAIL — Coding Forest's flagship. Program a fox with direction blocks
 * (and a Repeat/loop block) to gather every berry and reach its den. Teaches
 * sequencing + loops with juicy, springy feedback. Levels get bigger; loops
 * are the elegant way to earn 3 stars.
 */

type Cmd = 'up' | 'down' | 'left' | 'right' | 'loop';
interface Level { grid: string[]; par: number } // S start · G den · B berry · T tree · . ground

const LEVELS: Level[] = [
  { par: 5, grid: [
    'S.B..',
    '..T..',
    '..T.B',
    '....G',
  ] },
  { par: 6, grid: [
    'S....',
    'TTT.B',
    'B...T',
    '.TT.T',
    '...BG',
  ] },
  { par: 7, grid: [
    'S..B..',
    '.TT.T.',
    'B..T.B',
    '.T.T.T',
    '.T...G',
  ] },
];

const DIRS: Record<Exclude<Cmd, 'loop'>, [number, number, string]> = {
  up: [0, -1, '↑'], down: [0, 1, '↓'], left: [-1, 0, '←'], right: [1, 0, '→'],
};
const DIR_ICON: Record<Exclude<Cmd, 'loop'>, IconName> = { up: 'chevronDown', down: 'chevronDown', left: 'chevronLeft', right: 'chevronRight' };
const DIR_ROT: Record<Exclude<Cmd, 'loop'>, string> = { up: 'rotate-180', down: '', left: '', right: '' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function DirGlyph({ c, className = 'h-4 w-4' }: { c: Exclude<Cmd, 'loop'>; className?: string }) {
  return <Icon name={DIR_ICON[c]} className={`${className} ${DIR_ROT[c]}`} />;
}

export function ForestTrail({ onWin }: GameProps) {
  const [lvl, setLvl] = useState(0);
  const level = LEVELS[lvl];
  const W = level.grid[0].length;
  const H = level.grid.length;

  const start = useMemo(() => {
    for (let y = 0; y < H; y++) { const x = level.grid[y].indexOf('S'); if (x >= 0) return { x, y }; }
    return { x: 0, y: 0 };
  }, [level, H]);
  const berries = useMemo(() => {
    const set = new Set<string>();
    level.grid.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'B') set.add(`${x},${y}`); }));
    return set;
  }, [level]);
  const den = useMemo(() => {
    for (let y = 0; y < H; y++) { const x = level.grid[y].indexOf('G'); if (x >= 0) return { x, y }; }
    return { x: W - 1, y: H - 1 };
  }, [level, H, W]);

  const [program, setProgram] = useState<Cmd[]>([]);
  const [loopN, setLoopN] = useState(2);
  const [pos, setPos] = useState(start);
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [bump, setBump] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const wonRef = useRef(false);
  void tries;

  const isWall = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || level.grid[y][x] === 'T';

  const reset = (keepProgram = false) => {
    setPos(start); setCollected(new Set()); setBump(false); setMsg(null);
    if (!keepProgram) setProgram([]);
  };

  /** Expand the program: a Loop block repeats every command BEFORE it, loopN times. */
  const expand = (cmds: Cmd[]): Exclude<Cmd, 'loop'>[] => {
    const out: Exclude<Cmd, 'loop'>[] = [];
    const buffer: Exclude<Cmd, 'loop'>[] = [];
    for (const c of cmds) {
      if (c === 'loop') { for (let i = 0; i < loopN; i++) out.push(...buffer); buffer.length = 0; }
      else { out.push(c); buffer.push(c); }
    }
    return out;
  };

  const run = async () => {
    if (running || !program.length) return;
    setRunning(true); reset(true); setMsg(null);
    setTries((t) => t + 1);
    await sleep(250);

    const steps = expand(program);
    let cur = { ...start };
    const got = new Set<string>();

    for (const c of steps) {
      const [dx, dy] = DIRS[c];
      const nx = cur.x + dx, ny = cur.y + dy;
      if (isWall(nx, ny)) { setBump(true); await sleep(220); setBump(false); continue; }
      cur = { x: nx, y: ny };
      setPos({ ...cur });
      const key = `${cur.x},${cur.y}`;
      if (berries.has(key) && !got.has(key)) { got.add(key); setCollected(new Set(got)); }
      await sleep(260);
    }

    const allBerries = got.size === berries.size;
    const atDen = cur.x === den.x && cur.y === den.y;

    if (allBerries && atDen) {
      wonRef.current = true;
      const used = program.filter((c) => c !== 'loop').length;
      const usedLoop = program.includes('loop');
      const stars = used <= level.par && usedLoop ? 3 : used <= level.par + 1 ? 2 : 1;
      setMsg('win');
      await sleep(700);
      if (lvl < LEVELS.length - 1) {
        setLvl((l) => l + 1); setProgram([]); reset(); setRunning(false); wonRef.current = false;
      } else {
        onWin(stars);
      }
      return;
    }
    setMsg(!allBerries ? 'berries' : 'den');
    setRunning(false);
  };

  return (
    <div className="card">
      {/* header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="chip bg-success-50 text-success-700"><Icon name="forest" className="h-3.5 w-3.5" /> {lvl + 1}-bosqich</span>
        <span className="chip bg-surface-2 text-fg-soft tabular-nums">🫐 {collected.size}/{berries.size}</span>
      </div>

      {/* board */}
      <div className="relative mx-auto w-fit max-w-full rounded-xl border border-border bg-success-50 p-2 dark:bg-success-50/60">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${W}, minmax(0, 1fr))` }}>
          {Array.from({ length: H }).map((_, y) =>
            Array.from({ length: W }).map((_, x) => {
              const cell = level.grid[y][x];
              const here = pos.x === x && pos.y === y;
              const key = `${x},${y}`;
              const berryGone = collected.has(key);
              return (
                <div key={key} className={`relative grid h-11 w-11 place-items-center rounded-lg sm:h-14 sm:w-14 ${
                  cell === 'T' ? 'bg-success-600/90' : 'bg-surface shadow-xs'
                }`}>
                  {cell === 'T' && <span className="text-2xl drop-shadow" aria-hidden>🌲</span>}
                  {cell === 'G' && <span className="text-2xl" aria-hidden>🏡</span>}
                  {cell === 'B' && !berryGone && (
                    <motion.span animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="text-xl" aria-hidden>🫐</motion.span>
                  )}
                  {here && (
                    <motion.span
                      layoutId="fox"
                      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                      animate={bump ? { rotate: [0, -12, 12, 0], x: [0, -4, 4, 0] } : { y: [0, -6, 0] }}
                      className="absolute z-10 text-3xl drop-shadow-lg"
                      aria-label="Fox"
                    >🦊</motion.span>
                  )}
                </div>
              );
            }),
          )}
        </div>

        <AnimatePresence>
          {msg === 'win' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 grid place-items-center rounded-xl bg-success-500/30 backdrop-blur-[1px]">
              <span className="rounded-lg bg-surface px-4 py-2 font-display text-xl font-extrabold text-success-600 shadow-sm">Zo‘r!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* hint */}
      <AnimatePresence>
        {(msg === 'berries' || msg === 'den') && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status"
            className="mt-3 flex items-start gap-2 rounded-xl border border-warning-100 bg-warning-50 px-3.5 py-2.5 text-sm font-medium text-warning-700">
            <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{msg === 'berries' ? 'Avval hamma mevani yig‘! Buyruqlarni qayta tuz.' : 'Mevalar tayyor — endi uyga yetib bor!'}</span>
          </motion.p>
        )}
      </AnimatePresence>

      {/* command palette */}
      <div className="mt-4 rounded-xl border border-border bg-surface-2 p-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {(['up', 'down', 'left', 'right'] as const).map((c) => (
            <button key={c} type="button" disabled={running} onClick={() => setProgram((p) => [...p, c])} aria-label={c}
              className="btn-secondary btn-icon h-11 w-11 min-h-0 text-fg">
              <DirGlyph c={c} className="h-5 w-5" />
            </button>
          ))}
          <span className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 pl-1 pr-2 text-sm font-bold text-brand-700">
            <button type="button" disabled={running} onClick={() => setProgram((p) => [...p, 'loop'])}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 transition hover:bg-brand-100 disabled:opacity-40">
              <Icon name="loop" className="h-4 w-4" /> Takror
            </button>
            <select value={loopN} aria-label="Takror soni" onChange={(e) => setLoopN(Number(e.target.value))}
              className="h-7 rounded-md border border-brand-200 bg-surface px-1 text-xs font-bold text-brand-700 outline-none">
              {[2, 3, 4].map((n) => <option key={n} value={n}>×{n}</option>)}
            </select>
          </span>
        </div>

        {/* program strip */}
        <div className="mt-3 min-h-[44px] rounded-xl border border-dashed border-border-strong bg-surface p-2">
          {program.length === 0 ? (
            <p className="grid h-7 place-items-center text-xs font-semibold text-fg-faint">Buyruqlarni shu yerga qo‘sh</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {program.map((c, i) => (
                <motion.button key={i} type="button" layout initial={{ scale: 0 }} animate={{ scale: 1 }} disabled={running}
                  onClick={() => setProgram((p) => p.filter((_, idx) => idx !== i))}
                  aria-label={`${c} (remove)`}
                  className={`grid h-8 min-w-8 place-items-center rounded-lg border px-1.5 text-xs font-extrabold ${
                    c === 'loop' ? 'border-brand bg-brand text-white' : 'border-border bg-surface-2 text-fg'
                  }`}>
                  {c === 'loop' ? <span className="inline-flex items-center gap-0.5"><Icon name="loop" className="h-3.5 w-3.5" />×{loopN}</span> : <DirGlyph c={c} className="h-4 w-4" />}
                </motion.button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button type="button" onClick={run} disabled={running || !program.length} className="btn-primary flex-1">
            <Icon name="play" className="h-4 w-4" /> {running ? 'Yuribdi…' : 'Ishga tushir'}
          </button>
          <button type="button" onClick={() => reset()} disabled={running} className="btn-secondary">Tozalash</button>
        </div>
        <p className="mt-2 text-center text-xs text-fg-faint">Takror = oldidagi buyruqlarni qaytaradi. Kamroq buyruq = 3 yulduz</p>
      </div>
    </div>
  );
}
