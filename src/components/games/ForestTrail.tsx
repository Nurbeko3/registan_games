'use client';

import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  up: [0, -1, '⬆️'], down: [0, 1, '⬇️'], left: [-1, 0, '⬅️'], right: [1, 0, '➡️'],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    <div className="overflow-hidden rounded-xl2 bg-gradient-to-br from-[#dff6e3] to-[#bfe9cf] p-4 shadow-card">
      {/* header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="chip bg-white/70 text-mint-600">🌳 {lvl + 1}-bosqich</span>
        <span className="chip bg-white/70 text-ink-soft">🫐 {collected.size}/{berries.size}</span>
      </div>

      {/* board */}
      <div className="relative mx-auto w-fit rounded-2xl bg-[#a7dbb6]/40 p-2">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${W}, minmax(0, 1fr))` }}>
          {Array.from({ length: H }).map((_, y) =>
            Array.from({ length: W }).map((_, x) => {
              const cell = level.grid[y][x];
              const here = pos.x === x && pos.y === y;
              const key = `${x},${y}`;
              const berryGone = collected.has(key);
              return (
                <div key={key} className={`relative grid h-12 w-12 place-items-center rounded-xl sm:h-14 sm:w-14 ${
                  cell === 'T' ? 'bg-[#5fa86f]' : 'bg-[#c8edd1] shadow-inner'
                }`}>
                  {cell === 'T' && <span className="text-2xl drop-shadow">🌲</span>}
                  {cell === 'G' && <span className="text-2xl">🏡</span>}
                  {cell === 'B' && !berryGone && (
                    <motion.span animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="text-xl">🫐</motion.span>
                  )}
                  {here && (
                    <motion.span
                      layoutId="fox"
                      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                      animate={bump ? { rotate: [0, -12, 12, 0], x: [0, -4, 4, 0] } : { y: [0, -6, 0] }}
                      className="absolute z-10 text-3xl drop-shadow-lg"
                    >🦊</motion.span>
                  )}
                </div>
              );
            }),
          )}
        </div>

        <AnimatePresence>
          {msg === 'win' && (
            <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 grid place-items-center rounded-2xl bg-mint/30 backdrop-blur-[1px]">
              <span className="font-display text-3xl font-extrabold text-mint-600 drop-shadow">🎉 Zo‘r!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* hint */}
      <AnimatePresence>
        {(msg === 'berries' || msg === 'den') && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-3 rounded-xl bg-white/70 p-2 text-center text-sm font-bold text-bubble-600">
            {msg === 'berries' ? '🫐 Avval hamma mevani yig‘! Buyruqlarni qayta tuz.' : '🏡 Mevalar tayyor — endi uyga (🏡) yetib bor!'}
          </motion.p>
        )}
      </AnimatePresence>

      {/* command palette */}
      <div className="mt-4 rounded-2xl bg-white/80 p-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {(['up', 'down', 'left', 'right'] as const).map((c) => (
            <button key={c} disabled={running} onClick={() => setProgram((p) => [...p, c])}
              className="grid h-11 w-11 place-items-center rounded-xl bg-mint/20 text-xl shadow-card transition active:scale-90 disabled:opacity-40">
              {DIRS[c][2]}
            </button>
          ))}
          <button disabled={running} onClick={() => setProgram((p) => [...p, 'loop'])}
            className="flex h-11 items-center gap-1 rounded-xl bg-grape/15 px-3 text-sm font-extrabold text-grape shadow-card transition active:scale-90 disabled:opacity-40">
            🔁 Takror
            <select value={loopN} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); setLoopN(Number(e.target.value)); }}
              className="rounded bg-white/70 px-1 text-grape">
              {[2, 3, 4].map((n) => <option key={n} value={n}>×{n}</option>)}
            </select>
          </button>
        </div>

        {/* program strip */}
        <div className="mt-3 min-h-[44px] rounded-xl border-2 border-dashed border-mint/40 bg-[#f3fbf5] p-2">
          {program.length === 0 ? (
            <p className="grid h-7 place-items-center text-xs font-bold text-ink-faint">Buyruqlarni shu yerga qo‘sh → 🦊</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {program.map((c, i) => (
                <motion.button key={i} layout initial={{ scale: 0 }} animate={{ scale: 1 }} disabled={running}
                  onClick={() => setProgram((p) => p.filter((_, idx) => idx !== i))}
                  className={`grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-sm font-extrabold shadow-card ${c === 'loop' ? 'bg-grape text-white' : 'bg-mint/30'}`}>
                  {c === 'loop' ? `🔁×${loopN}` : DIRS[c][2]}
                </motion.button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button onClick={run} disabled={running || !program.length} className="btn-primary flex-1 disabled:opacity-40">
            {running ? 'Yuribdi…' : '▶ Ishga tushir'}
          </button>
          <button onClick={() => reset()} disabled={running} className="btn-ghost">Tozalash</button>
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-faint">🔁 Takror = oldidagi buyruqlarni qaytaradi. Kamroq buyruq = ⭐⭐⭐</p>
      </div>
    </div>
  );
}
