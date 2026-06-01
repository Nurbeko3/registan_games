'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '@/store/useGame';
import { levelForXp } from '@/lib/leveling';
import {
  createWorld,
  respawn,
  step,
  WORLD_W,
  WORLD_H,
  type World,
} from '@/lib/arena/engine';
import { drawWorld } from '@/lib/arena/render';
import { pickQuestion, isCorrect } from '@/lib/arena/questionEngine';
import {
  type ArenaMode,
  type ArenaPhase,
  type Category,
  type LearnState,
  type MatchResult,
  type PreparedQuestion,
} from '@/lib/arena/types';
import { ArenaHUD } from './ArenaHUD';
import { LearningPanel } from './LearningPanel';
import { MatchResults } from './MatchResults';

const WRONG_COOLDOWN_MS = 8000;
const CELEBRATE_MS = 1300;
const JOY_R = 56; // joystick radius (css px)
const DEADZONE = 12;

export interface ArenaGameConfig {
  mode: ArenaMode;
  perTeam: number;
  categories?: Category[];
  hero: { name: string; avatar: string };
}

interface Controls {
  moveId: number | null;
  moveBase: { x: number; y: number };
  moveKnob: { x: number; y: number };
  fireId: number | null;
  fireBase: { x: number; y: number };
  fireKnob: { x: number; y: number };
  touchAimActive: boolean;
  touchAimAngle: number;
  touchFire: boolean;
  mouseActive: boolean;
  mouseWX: number;
  mouseWY: number;
  mouseFire: boolean;
  keys: Set<string>;
  spaceFire: boolean;
}

export function ArenaGame({ config }: { config: ArenaGameConfig }) {
  const { mode, perTeam } = config;
  const target = mode.targetScore;

  const arenaAnswerCorrect = useGame((s) => s.arenaAnswerCorrect);
  const arenaMatchEnd = useGame((s) => s.arenaMatchEnd);

  const [phase, setPhase] = useState<ArenaPhase>('intro');
  const [count, setCount] = useState(3);
  const [scores, setScores] = useState({ red: 0, blue: 0 });
  const [prepared, setPrepared] = useState<PreparedQuestion | null>(null);
  const [learnState, setLearnState] = useState<LearnState>('answering');
  const [lastReward, setLastReward] = useState<{ xp: number; coins: number } | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<World | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef(0);
  const scaleRef = useRef(1);
  const dprRef = useRef(1);
  const phaseRef = useRef<ArenaPhase>('intro');
  const stats = useRef({ correct: 0, answered: 0, xp: 0, coins: 0 });
  const usedIds = useRef<Set<string>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastScores = useRef({ red: 0, blue: 0 });
  const ctl = useRef<Controls>({
    moveId: null, moveBase: { x: 0, y: 0 }, moveKnob: { x: 0, y: 0 },
    fireId: null, fireBase: { x: 0, y: 0 }, fireKnob: { x: 0, y: 0 },
    touchAimActive: false, touchAimAngle: 0, touchFire: false,
    mouseActive: false, mouseWX: 0, mouseWY: 0, mouseFire: false,
    keys: new Set(), spaceFire: false,
  });

  const setPhaseBoth = (p: ArenaPhase) => { phaseRef.current = p; setPhase(p); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // ── sizing (responsive, crisp on retina) ──
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const cssW = Math.min(wrap.clientWidth, 760);
    const scale = cssW / WORLD_W;
    const cssH = WORLD_H * scale;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    scaleRef.current = scale;
    dprRef.current = dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }, []);

  // ── question loading ──
  const loadQuestion = useCallback(() => {
    const level = levelForXp(useGame.getState().xp);
    const q = pickQuestion({ level, exclude: usedIds.current, categories: config.categories });
    usedIds.current.add(q.q.id);
    if (usedIds.current.size > 24) usedIds.current.clear();
    setPrepared(q);
    setLearnState('answering');
  }, [config.categories]);

  const enterLearning = useCallback(() => {
    const c = ctl.current;
    c.touchFire = c.mouseFire = c.spaceFire = false;
    setPhaseBoth('learning');
    setLastReward(null);
    loadQuestion();
  }, [loadQuestion]);

  const endMatch = useCallback(() => {
    if (phaseRef.current === 'ended') return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    clearTimers();
    const w = worldRef.current!;
    const myScore = w.scores.red;
    const enemyScore = w.scores.blue;
    const won = myScore >= enemyScore && (myScore >= target || myScore > enemyScore);
    const bonus = arenaMatchEnd({ won, correct: stats.current.correct, elims: w.fighters[0].score });
    setResult({
      won,
      myTeam: 'red',
      redScore: w.scores.red,
      blueScore: w.scores.blue,
      elims: w.fighters[0].score,
      correct: stats.current.correct,
      answered: stats.current.answered,
      xpEarned: stats.current.xp + bonus.bonusXp,
      coinsEarned: stats.current.coins + bonus.bonusCoins,
    });
    setPhaseBoth('ended');
  }, [arenaMatchEnd, target]);

  const respawnHero = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    respawn(w.fighters[0], performance.now());
    setPrepared(null);
    if (phaseRef.current !== 'ended') setPhaseBoth('playing');
  }, []);

  const submitAnswer = useCallback(
    (response: number | string[]) => {
      if (!prepared || learnState !== 'answering') return;
      stats.current.answered += 1;
      if (isCorrect(prepared, response)) {
        const reward = arenaAnswerCorrect(prepared.q.difficulty);
        stats.current.correct += 1;
        stats.current.xp += reward.xp;
        stats.current.coins += reward.coins;
        setLastReward(reward);
        setLearnState('correct');
        timers.current.push(setTimeout(respawnHero, CELEBRATE_MS));
      } else {
        setLearnState('wrong-cooldown');
        timers.current.push(
          setTimeout(() => { if (phaseRef.current === 'learning') loadQuestion(); }, WRONG_COOLDOWN_MS),
        );
      }
    },
    [arenaAnswerCorrect, learnState, loadQuestion, prepared, respawnHero],
  );

  // ── combine all input sources into world.input each frame ──
  const applyInput = (w: World) => {
    const c = ctl.current;
    // movement: joystick takes priority over keyboard
    if (c.moveId !== null) {
      const dx = c.moveKnob.x - c.moveBase.x;
      const dy = c.moveKnob.y - c.moveBase.y;
      w.input.moveX = Math.max(-1, Math.min(1, dx / JOY_R));
      w.input.moveY = Math.max(-1, Math.min(1, dy / JOY_R));
    } else {
      let mx = 0, my = 0;
      const k = c.keys;
      if (k.has('w') || k.has('arrowup')) my -= 1;
      if (k.has('s') || k.has('arrowdown')) my += 1;
      if (k.has('a') || k.has('arrowleft')) mx -= 1;
      if (k.has('d') || k.has('arrowright')) mx += 1;
      w.input.moveX = mx; w.input.moveY = my;
    }
    // fire + aim
    w.input.firing = c.touchFire || c.mouseFire || c.spaceFire;
    if (c.touchFire && c.touchAimActive) w.input.aim = { type: 'dir', angle: c.touchAimAngle };
    else if (c.touchFire) w.input.aim = { type: 'none' };
    else if (c.mouseActive) w.input.aim = { type: 'point', x: c.mouseWX, y: c.mouseWY };
    else w.input.aim = { type: 'none' };
  };

  // ── render: world (scaled) + on-screen joysticks & hero HP (screen space) ──
  const render = (now: number) => {
    const canvas = canvasRef.current;
    const w = worldRef.current;
    if (!canvas || !w) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = dprRef.current;
    const s = scaleRef.current;

    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
    drawWorld(ctx, w, now);

    // screen-space overlays
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = ctl.current;
    if (c.moveId !== null) drawStick(ctx, c.moveBase, c.moveKnob, '#7C5CFC');
    if (c.fireId !== null) drawStick(ctx, c.fireBase, c.fireKnob, '#FFD43B');

    // hero HP bar (bottom center)
    const hero = w.fighters[0];
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
    const bw = 160, bx = cssW / 2 - bw / 2, by = cssH - 16;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(bx - 4, by - 4, bw + 8, 12);
    const hp = Math.max(0, hero.hp) / 100;
    ctx.fillStyle = hp > 0.5 ? '#22C55E' : hp > 0.25 ? '#FFD43B' : '#FF7AB6';
    ctx.fillRect(bx, by, bw * hp, 4);
  };

  // ── the loop ──
  const loop = useCallback(
    (ts: number) => {
      const w = worldRef.current;
      if (!w) return;
      const dt = lastTs.current ? (ts - lastTs.current) / 1000 : 0;
      lastTs.current = ts;

      applyInput(w);
      if (phaseRef.current === 'playing') {
        const res = step(w, dt, ts);
        if (w.scores.red !== lastScores.current.red || w.scores.blue !== lastScores.current.blue) {
          lastScores.current = { red: w.scores.red, blue: w.scores.blue };
          setScores(lastScores.current);
        }
        if (w.scores.red >= target || w.scores.blue >= target) {
          endMatch();
          return;
        }
        if (res.heroDied) enterLearning();
      }
      render(ts);
      rafRef.current = requestAnimationFrame(loop);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endMatch, enterLearning, target],
  );

  // ── boot / restart a match ──
  const boot = useCallback(() => {
    clearTimers();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    worldRef.current = createWorld(perTeam, config.hero);
    stats.current = { correct: 0, answered: 0, xp: 0, coins: 0 };
    usedIds.current.clear();
    lastTs.current = 0;
    lastScores.current = { red: 0, blue: 0 };
    setScores({ red: 0, blue: 0 });
    setResult(null);
    setPrepared(null);
    setCount(3);
    setPhaseBoth('intro');
    resize();

    // intro countdown 3-2-1 → play
    let n = 3;
    const tick = () => {
      n -= 1;
      if (n <= 0) { setCount(0); setPhaseBoth('playing'); }
      else { setCount(n); timers.current.push(setTimeout(tick, 800)); }
    };
    timers.current.push(setTimeout(tick, 800));
    rafRef.current = requestAnimationFrame(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perTeam, resize, loop]);

  useEffect(() => {
    boot();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === ' ') { ctl.current.spaceFire = down; e.preventDefault(); return; }
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        if (down) ctl.current.keys.add(k); else ctl.current.keys.delete(k);
        e.preventDefault();
      }
    };
    const kd = onKey(true), ku = onKey(false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimers();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── pointer controls (touch joysticks + mouse aim/fire) ──
  const toLocal = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      cssX: e.clientX - rect.left,
      cssY: e.clientY - rect.top,
      wx: (e.clientX - rect.left) / scaleRef.current,
      wy: (e.clientY - rect.top) / scaleRef.current,
      half: rect.width / 2,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== 'playing') return;
    const c = ctl.current;
    const { cssX, cssY, wx, wy, half } = toLocal(e);
    if (e.pointerType === 'mouse') {
      c.mouseActive = true; c.mouseFire = true; c.mouseWX = wx; c.mouseWY = wy;
      return;
    }
    if (cssX < half && c.moveId === null) {
      c.moveId = e.pointerId; c.moveBase = { x: cssX, y: cssY }; c.moveKnob = { x: cssX, y: cssY };
    } else if (c.fireId === null) {
      c.fireId = e.pointerId; c.fireBase = { x: cssX, y: cssY }; c.fireKnob = { x: cssX, y: cssY };
      c.touchFire = true; c.touchAimActive = false;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const c = ctl.current;
    const { cssX, cssY, wx, wy } = toLocal(e);
    if (e.pointerType === 'mouse') {
      if (c.mouseActive) { c.mouseWX = wx; c.mouseWY = wy; }
      return;
    }
    if (e.pointerId === c.moveId) {
      const dx = cssX - c.moveBase.x, dy = cssY - c.moveBase.y;
      const d = Math.hypot(dx, dy) || 1;
      const cl = Math.min(d, JOY_R);
      c.moveKnob = { x: c.moveBase.x + (dx / d) * cl, y: c.moveBase.y + (dy / d) * cl };
    } else if (e.pointerId === c.fireId) {
      const dx = cssX - c.fireBase.x, dy = cssY - c.fireBase.y;
      const d = Math.hypot(dx, dy) || 1;
      const cl = Math.min(d, JOY_R);
      c.fireKnob = { x: c.fireBase.x + (dx / d) * cl, y: c.fireBase.y + (dy / d) * cl };
      if (d > DEADZONE) { c.touchAimActive = true; c.touchAimAngle = Math.atan2(dy, dx); }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const c = ctl.current;
    if (e.pointerType === 'mouse') { c.mouseFire = false; return; }
    if (e.pointerId === c.moveId) { c.moveId = null; }
    else if (e.pointerId === c.fireId) { c.fireId = null; c.touchFire = false; c.touchAimActive = false; }
  };

  // ── ended → results ──
  if (phase === 'ended' && result) {
    return (
      <div className="mx-auto max-w-md px-4 py-5">
        <MatchResults result={result} onPlayAgain={boot} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <Link href="/arena" className="btn-ghost px-3 py-1.5 text-sm">← Leave</Link>
        <span className="chip bg-grape-50 text-grape">{mode.emoji} {mode.name}</span>
      </div>

      <ArenaHUD mode={mode} scores={scores} myTeam="red" />

      <div ref={wrapRef} className="relative mt-3 select-none">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          className={`w-full touch-none rounded-xl2 shadow-card ring-1 ring-grape-100 transition ${
            phase === 'learning' ? 'blur-sm brightness-90' : ''
          }`}
          style={{ cursor: 'crosshair', touchAction: 'none' }}
        />

        {/* intro countdown */}
        <AnimatePresence>
          {phase === 'intro' && (
            <motion.div
              className="absolute inset-0 grid place-items-center rounded-xl2 bg-ink/45 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                key={count}
                initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="text-center text-white"
              >
                <p className="font-display text-7xl font-extrabold">{count > 0 ? count : 'GO!'}</p>
                <p className="mt-1 text-white/80">{mode.blurb}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* learning pod — full-screen modal over the blurred battlefield */}
      <AnimatePresence>
        {phase === 'learning' && prepared && (
          <LearningPanel
            prepared={prepared}
            learnState={learnState}
            lastReward={lastReward}
            cooldownMs={WRONG_COOLDOWN_MS}
            onAnswer={submitAnswer}
          />
        )}
      </AnimatePresence>

      <p className="mt-2 text-center text-xs font-bold text-ink-faint">
        📱 Left side = move · right side = aim &amp; shoot &nbsp;|&nbsp; ⌨️ WASD move · mouse aim · click/space shoot
      </p>
    </div>
  );
}

function drawStick(
  ctx: CanvasRenderingContext2D,
  base: { x: number; y: number },
  knob: { x: number; y: number },
  color: string,
) {
  ctx.beginPath();
  ctx.arc(base.x, base.y, JOY_R, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(knob.x, knob.y, JOY_R * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
