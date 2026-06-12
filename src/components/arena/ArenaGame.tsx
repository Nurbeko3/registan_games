'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '@/store/useGame';
import { levelForXp } from '@/lib/leveling';
import {
  createWorld,
  respawn,
  step,
  requestReload,
  heroWeaponHud,
  aliveCounts,
  applyRemoteMove,
  applyRemoteShot,
  applyRemoteDown,
  applyRemoteLeave,
  applyRemoteRespawn,
  WORLD_W,
  WORLD_H,
  type World,
  type Fighter,
  type Bullet,
  type HeroWeaponState,
  type Rect,
  type ArenaDifficulty,
} from '@/lib/arena/engine';
import type { NetEvent, NetEventType } from '@/lib/arena/network/types';
import type { WeaponId } from '@/lib/arena/weapons';
import { useLocale, useT } from '@/lib/i18n';
import { ArenaHud, type HudData } from './hud/ArenaHud';
import { drawWorld } from '@/lib/arena/render';
import { Fx } from '@/lib/arena/effects';
import { ArenaAudio, createSynth, type ArenaSound } from '@/lib/arena/audio';
import { pickQuestion, isCorrect } from '@/lib/arena/questionEngine';
import {
  TEAMS,
  type ArenaMode,
  type ArenaPhase,
  type Category,
  type Grade,
  type LearnState,
  type MatchResult,
  type PreparedQuestion,
  type TeamId,
  type RosterEntry,
} from '@/lib/arena/types';
import { LearningPanel } from './LearningPanel';
import { MatchResults } from './MatchResults';
import { ArenaDebugPanel, type ArenaDebugInfo } from './ArenaDebugPanel';

const WRONG_COOLDOWN_MS = 2000;
const CELEBRATE_MS = 1300;
const MAX_REWARDED_LEARNING_PODS = 8;
const JOY_R = 56; // joystick radius (css px)
const DEADZONE = 12;
const SHIELD_MS = 2600; // post-respawn hero invulnerability
const DEATH_DUR = 0.85; // seconds of freeze-frame death camera
const DEATH_DUR_RM = 0.4; // …shortened when the player prefers reduced motion

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface ArenaGameConfig {
  mode: ArenaMode;
  perTeam: number;
  categories?: Category[];
  /** which school class's questions to use in the learning pod; undefined = all. */
  grade?: Grade;
  hero: { name: string; avatar: string };
  /** custom map layout (defaults to the engine's built-in map) */
  obstacles?: Rect[];
  /** bot difficulty for Practice (defaults to medium) */
  difficulty?: ArenaDifficulty;
  /** shared match seed → identical arena across clients (multiplayer only). */
  seed?: number;
  /** match length in seconds. Scores are uncapped; the clock ends the match. */
  durationSec?: number;
  /** fill your team's empty slots with ally bots (lobby toggle; default on). */
  botFill?: boolean;
  /** hero's starting blaster selected in the pre-match loadout carousel. */
  initialWeapon?: WeaponId;
  /** offline Practice refresh restore. Multiplayer keeps its own room/session flow. */
  initialSnapshot?: ArenaPracticeSnapshot;
  onSnapshot?: (snapshot: ArenaPracticeSnapshot | null) => void;
  /** leave the match and return to the previous Arena screen. */
  onExit?: () => void;
}

/** Multiplayer bridge. When present, the match is host-authoritative: the host
 *  publishes score + the end signal; non-hosts display and obey them so every
 *  client shares ONE match. Absent for offline Practice (everything local). */
export interface ArenaNet {
  isHost: boolean;
  /** host-authoritative live score (mirrored to non-hosts). */
  scores: { red: number; blue: number } | null;
  /** host-authoritative end signal (final score). */
  ended: { red: number; blue: number } | null;
  /** host → publish live score as it changes. */
  onScores: (red: number, blue: number) => void;
  /** host → declare the match over. */
  onEnd: (red: number, blue: number) => void;
  /** leave the match (back to menu) — used by the results screen in multiplayer. */
  onExit: () => void;
  /** diagnostics overlay data. */
  debug: ArenaDebugInfo;
  // ── M2: embodied players ──
  /** my network id (matches my hero's netId). */
  myNetId: string;
  /** everyone in the match + their teams (drives the shared world build). */
  roster: RosterEntry[];
  /** true for the host/teacher view: watch the match, do not control a fighter. */
  spectator?: boolean;
  /** send an in-match event (move/shoot/down/respawn). */
  sendNet: (t: NetEventType, data: NetEvent['data']) => void;
  /** drain remote in-match events to apply this frame. */
  drainNet: () => NetEvent[];
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

interface FeedEntry { id: number; killerName: string; victimName: string; team: TeamId; crit: boolean }
interface Banner { text: string; key: number }

type SnapshotFighter = Omit<Fighter, 'cooldownUntil' | 'respawnAt' | 'shieldUntil'> & {
  cooldownIn: number;
  respawnIn: number;
  shieldIn: number;
};
type SnapshotBullet = Omit<Bullet, 'born'> & { ageMs: number };
type SnapshotWeapon = Omit<HeroWeaponState, 'reloadUntil' | 'reloadStart'> & {
  reloadRemaining: number;
  reloadElapsed: number;
};

export interface ArenaPracticeSnapshot {
  v: 1;
  savedAt: number;
  phase: ArenaPhase;
  count: number;
  scores: { red: number; blue: number };
  prepared: PreparedQuestion | null;
  learnState: LearnState;
  lastReward: { xp: number; coins: number } | null;
  result: MatchResult | null;
  stats: { correct: number; answered: number; xp: number; coins: number };
  usedIds: string[];
  matchRemainingMs: number;
  dying: { active: boolean; t: number; x: number; y: number };
  heroKills: number[];
  lastScores: { red: number; blue: number };
  scoredVictims: string[];
  hitSeq: number;
  world: Omit<World, 'fighters' | 'bullets' | 'weapon' | 'input'> & {
    fighters: SnapshotFighter[];
    bullets: SnapshotBullet[];
    weapon: SnapshotWeapon;
  };
}

const remaining = (deadline: number, now: number) => (deadline > now ? deadline - now : 0);

function snapshotWorld(world: World, now: number): ArenaPracticeSnapshot['world'] {
  const { input: _input, fighters, bullets, weapon, ...rest } = world;
  return {
    ...rest,
    fighters: fighters.map((f) => ({
      ...f,
      cooldownIn: remaining(f.cooldownUntil, now),
      respawnIn: remaining(f.respawnAt, now),
      shieldIn: remaining(f.shieldUntil, now),
    })),
    bullets: bullets.map((b) => ({ ...b, ageMs: Math.max(0, now - b.born) })),
    weapon: {
      ...weapon,
      reloadRemaining: remaining(weapon.reloadUntil, now),
      reloadElapsed: weapon.reloadUntil > 0 ? Math.max(0, now - weapon.reloadStart) : 0,
    },
  };
}

function restoreWorld(snapshot: ArenaPracticeSnapshot['world'], now: number): World {
  return {
    ...snapshot,
    input: { moveX: 0, moveY: 0, firing: false, aim: { type: 'none' } },
    fighters: snapshot.fighters.map(({ cooldownIn, respawnIn, shieldIn, ...f }) => ({
      ...f,
      cooldownUntil: cooldownIn > 0 ? now + cooldownIn : 0,
      respawnAt: respawnIn > 0 ? now + respawnIn : 0,
      shieldUntil: shieldIn > 0 ? now + shieldIn : 0,
    })),
    bullets: snapshot.bullets.map(({ ageMs, ...b }) => ({ ...b, born: now - Math.max(0, ageMs) })),
    weapon: {
      id: snapshot.weapon.id,
      mag: snapshot.weapon.mag,
      reserve: snapshot.weapon.reserve,
      reloadUntil: snapshot.weapon.reloadRemaining > 0 ? now + snapshot.weapon.reloadRemaining : 0,
      reloadStart: snapshot.weapon.reloadRemaining > 0 ? now - snapshot.weapon.reloadElapsed : 0,
    },
  };
}

export function ArenaGame({ config, net }: { config: ArenaGameConfig; net?: ArenaNet }) {
  const { mode, perTeam } = config;
  const target = mode.targetScore;
  const durationMs = (config.durationSec ?? 180) * 1000;

  // In multiplayer the HOST owns score/end; non-hosts mirror the host. Offline
  // Practice has no `net`, so `authoritative` is false and everything stays local.
  const authoritative = !!net && !net.isHost;
  const spectator = net?.spectator === true;
  // M2: embodied play needs ≥2 humans in the roster; otherwise fall back to bots.
  const mp = !!(net && net.roster && net.roster.length >= 2);
  // The lobby team choice is honoured in BOTH modes — even solo-vs-bots, so picking
  // Blue actually spawns you on the blue team (not always red).
  const myTeam: TeamId = net?.roster?.find((r) => r.netId === net.myNetId)?.team ?? 'red';

  const arenaAnswerCorrect = useGame((s) => s.arenaAnswerCorrect);
  const arenaMatchEnd = useGame((s) => s.arenaMatchEnd);
  const soundOn = useGame((s) => s.settings.sound);
  const reducedMotion = useGame((s) => s.settings.reducedMotion);
  const t = useT();
  const locale = useLocale();

  const [phase, setPhase] = useState<ArenaPhase>('intro');
  const [count, setCount] = useState(3);
  const [scores, setScores] = useState({ red: 0, blue: 0 });
  const [prepared, setPrepared] = useState<PreparedQuestion | null>(null);
  const [learnState, setLearnState] = useState<LearnState>('answering');
  const [lastReward, setLastReward] = useState<{ xp: number; coins: number } | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [hud, setHud] = useState<HudData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false); // ref guard prevents double-leave from stale closure
  const [confirmLeave, setConfirmLeave] = useState(false);
  const isFullscreenRef = useRef(false); // read inside resize() (kept deps-free)

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

  // game-feel refs
  const fxRef = useRef(new Fx());
  const audioRef = useRef(new ArenaAudio());
  const synthRef = useRef<ReturnType<typeof createSynth> | null>(null);
  const resumedRef = useRef(false);
  const camRef = useRef({ zoom: 1, cx: WORLD_W / 2, cy: WORLD_H / 2 });
  const dyingRef = useRef({ active: false, t: 0, x: 0, y: 0 });
  const heroKills = useRef<number[]>([]);
  const feedSeq = useRef(0);
  const matchPointRef = useRef(false);
  const behindRef = useRef(false);
  const scoredVictims = useRef<Set<string>>(new Set());
  /** netIds we've already processed a 'leave' for, so a player's own 'leave'
   *  broadcast and the presence-derived fallback don't double-remove/announce. */
  const leftPlayers = useRef<Set<string>>(new Set());
  const frameRef = useRef<(ts: number) => boolean | void>(() => {});
  // HUD: throttle the overlay snapshot, track match clock + hit-marker pulses
  const hudAccum = useRef(0);
  /** epoch ms the match ends at (0 until play begins). The clock — not score —
   *  ends the match; the host is authoritative for the actual end. */
  const matchEndsAtRef = useRef(0);
  const hitMarkerRef = useRef<{ id: number; crit: boolean } | null>(null);
  const hitSeq = useRef(0);

  const ctl = useRef<Controls>({
    moveId: null, moveBase: { x: 0, y: 0 }, moveKnob: { x: 0, y: 0 },
    fireId: null, fireBase: { x: 0, y: 0 }, fireKnob: { x: 0, y: 0 },
    touchAimActive: false, touchAimAngle: 0, touchFire: false,
    mouseActive: false, mouseWX: 0, mouseWY: 0, mouseFire: false,
    keys: new Set(), spaceFire: false,
  });

  const setPhaseBoth = (p: ArenaPhase) => { phaseRef.current = p; setPhase(p); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // ── audio setup ──
  useEffect(() => {
    const synth = createSynth();
    synthRef.current = synth;
    audioRef.current.setHook(synth.hook);
  }, []);
  useEffect(() => { audioRef.current.setMuted(!soundOn); }, [soundOn]);
  useEffect(() => { fxRef.current.intensity = reducedMotion ? 0.35 : 1; }, [reducedMotion]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('kcq:arena-chrome', { detail: { playing: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent('kcq:arena-chrome', { detail: { playing: false } }));
    };
  }, []);

  const resumeAudio = () => {
    if (!resumedRef.current) { synthRef.current?.resume(); resumedRef.current = true; }
  };
  const emit = (s: ArenaSound, i = 1) => audioRef.current.emit(s, i);

  // ── sizing (responsive, crisp on retina) ──
  // Windowed: fit the wrapper width (capped). Fullscreen: fit the WHOLE screen,
  // letterboxing to keep the world's aspect ratio. scaleRef stays world→css so
  // pointer mapping and the camera transform keep working at any size.
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const aspect = WORLD_W / WORLD_H;
    const fs = isFullscreenRef.current;
    const maxW = fs ? window.innerWidth : Math.min(wrap.clientWidth, 1080);
    const maxH = fs ? window.innerHeight : Number.POSITIVE_INFINITY;
    let cssW = maxW;
    let cssH = cssW / aspect;
    if (cssH > maxH) { cssH = maxH; cssW = cssH * aspect; }
    const scale = cssW / WORLD_W;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    scaleRef.current = scale;
    dprRef.current = dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }, []);

  // ── fullscreen toggle (real Fullscreen API + CSS fallback for iOS) ──
  const applyFullscreen = useCallback((on: boolean) => {
    isFullscreenRef.current = on;
    setIsFullscreen(on);
    requestAnimationFrame(() => resize());
  }, [resize]);

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
    const node = el as HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> };
    const active = !!(document.fullscreenElement || doc.webkitFullscreenElement);
    if (active) {
      (document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document);
      applyFullscreen(false);
    } else {
      const req = node.requestFullscreen ?? node.webkitRequestFullscreen;
      // request real fullscreen where supported; CSS fallback covers the rest
      req?.call(node).catch(() => {});
      applyFullscreen(true);
    }
  }, [applyFullscreen]);

  // ── question loading ──
  const loadQuestion = () => {
    const level = levelForXp(useGame.getState().xp);
    // anyDifficulty: within the host's chosen grade, draw from every difficulty
    // so all of that class's questions can appear (grade undefined = all grades).
    const q = pickQuestion({ level, exclude: usedIds.current, categories: config.categories, grade: config.grade, anyDifficulty: true, locale });
    usedIds.current.add(q.q.id);
    // Keep accumulating across the whole match so questions don't repeat early.
    // pickQuestion gracefully falls back to the full pool once everything is seen,
    // so there's no need to wipe history mid-match (which caused instant repeats).
    setPrepared(q);
    setLearnState('answering');
  };

  const enterLearning = () => {
    const c = ctl.current;
    c.touchFire = c.mouseFire = c.spaceFire = false;
    dyingRef.current.active = false;
    setPhaseBoth('learning');
    setLastReward(null);
    loadQuestion();
  };

  const startDying = (pos: { x: number; y: number }) => {
    dyingRef.current = { active: true, t: 0, x: pos.x, y: pos.y };
    setPhaseBoth('dying');
  };

  const announce = (text: string) => {
    const key = Date.now() + Math.random();
    setBanner({ text, key });
    timers.current.push(setTimeout(() => setBanner((b) => (b && b.key === key ? null : b)), 1600));
  };

  const leaveMatch = useCallback(() => {
    // Use a ref guard so two rapid calls in the same render cycle don't both
    // fire the leave path (state closure would be stale for the second call).
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    const c = ctl.current;
    c.touchFire = c.mouseFire = c.spaceFire = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    clearTimers();
    if (net && worldRef.current?.multiplayer) {
      net.sendNet('leave', { name: config.hero.name || 'Player' });
      if (net.isHost) net.onEnd(worldRef.current.scores.red, worldRef.current.scores.blue);
    }
    const finish = () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      if (net) net.onExit();
      else if (config.onExit) config.onExit();
      else window.location.assign('/arena');
    };
    window.setTimeout(finish, net ? 140 : 0);
  }, [config, net]);

  // Leaving is destructive (in multiplayer it removes your character for
  // everyone else), so ALWAYS confirm first — a stray tap or reflex must never
  // drop you out of the match. Only an explicit "Yes" runs leaveMatch().
  // A refresh / tab reload is deliberately NOT treated as leaving here: peers
  // hold a reconnect grace window, so reloading resumes you into the same match
  // instead of removing your character.
  const requestLeave = useCallback(() => {
    if (leaving) return;
    setConfirmLeave(true);
  }, [leaving]);

  // `override` carries the host's authoritative final score (non-host path);
  // otherwise the local world's score is canonical (host / offline practice).
  const endMatch = (override?: { red: number; blue: number }) => {
    if (phaseRef.current === 'ended') return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    clearTimers();
    const w = worldRef.current!;
    const redScore = override?.red ?? w.scores.red;
    const blueScore = override?.blue ?? w.scores.blue;
    const myScore = myTeam === 'red' ? redScore : blueScore;
    const enemyScore = myTeam === 'red' ? blueScore : redScore;
    // time-based: highest score when the clock ends wins (ties are not a win)
    const won = myScore > enemyScore;
    // host: publish the authoritative end to everyone (no-op offline)
    if (net?.isHost) net.onEnd(redScore, blueScore);
    emit(won ? 'victory' : 'defeat');
    const bonus = arenaMatchEnd({ won, correct: stats.current.correct, elims: w.fighters[0].score });
    setResult({
      won,
      myTeam,
      redScore,
      blueScore,
      elims: w.fighters[0].score,
      correct: stats.current.correct,
      answered: stats.current.answered,
      xpEarned: stats.current.xp + bonus.bonusXp,
      coinsEarned: stats.current.coins + bonus.bonusCoins,
    });
    setPhaseBoth('ended');
  };

  const respawnHero = () => {
    const w = worldRef.current;
    if (!w) return;
    const now = performance.now();
    const hero = w.fighters[0];
    respawn(hero, now);
    hero.shieldUntil = now + SHIELD_MS;
    if (net?.myNetId) scoredVictims.current.delete(net.myNetId);
    fxRef.current.portal(hero.x, hero.y, '#FFD43B');
    emit('respawn');
    emit('shield');
    // M2: tell opponents I'm back on the battlefield
    if (net && w.multiplayer) net.sendNet('respawn', { x: Math.round(hero.x), y: Math.round(hero.y) });
    setPrepared(null);
    if (phaseRef.current !== 'ended') setPhaseBoth('playing');
  };

  const submitAnswer = (response: number | string[]) => {
    if (!prepared || learnState !== 'answering') return;
    stats.current.answered += 1;
    if (isCorrect(prepared, response)) {
      stats.current.correct += 1;
      if (stats.current.correct <= MAX_REWARDED_LEARNING_PODS) {
        const reward = arenaAnswerCorrect(prepared.q.difficulty);
        stats.current.xp += reward.xp;
        stats.current.coins += reward.coins;
        setLastReward(reward);
      } else {
        setLastReward(null);
      }
      setLearnState('correct');
      emit('correct');
      timers.current.push(setTimeout(respawnHero, CELEBRATE_MS));
    } else {
      setLearnState('wrong-cooldown');
      emit('wrong');
      timers.current.push(
        setTimeout(() => { if (phaseRef.current === 'learning') loadQuestion(); }, WRONG_COOLDOWN_MS),
      );
    }
  };

  // ── feedback: kill feed, multi-kills, comeback / match-point ──
  const pushKills = (
    kills: { killerId: string; killerName: string; victimName: string; team: TeamId; crit: boolean }[],
    ts: number,
  ) => {
    if (!kills.length) return;
    const entries: FeedEntry[] = kills.map((k) => ({
      id: feedSeq.current++, killerName: k.killerName, victimName: k.victimName, team: k.team, crit: k.crit,
    }));
    setFeed((prev) => [...entries, ...prev].slice(0, 4));
    for (const e of entries) {
      timers.current.push(setTimeout(() => setFeed((f) => f.filter((x) => x.id !== e.id)), 3200));
    }

    const heroK = kills.filter((k) => k.killerId === 'hero').length;
    if (heroK > 0) {
      const arr = heroKills.current;
      for (let i = 0; i < heroK; i++) arr.push(ts);
      const recent = arr.filter((t) => ts - t < 2500);
      heroKills.current = recent;
      if (recent.length >= 2) {
        announce(recent.length >= 4 ? t('arena.rampage') : recent.length === 3 ? t('arena.triple') : t('arena.double'));
        emit(recent.length >= 3 ? 'streak' : 'multikill');
      }
    }
  };

  const checkScoreAlerts = (red: number, blue: number) => {
    // (no score target in time-based play) — celebrate big comebacks only
    if (blue - red >= 8) behindRef.current = true;
    if (behindRef.current && red >= blue && red > 0) {
      behindRef.current = false;
      announce(t('arena.comeback'));
    }
  };

  const playSounds = (list: ArenaSound[]) => {
    if (!list.length) return;
    const seen = new Set<ArenaSound>();
    for (const s of list) { if (!seen.has(s)) { seen.add(s); emit(s); } }
  };

  // ── combine all input sources into world.input each frame ──
  const applyInput = (w: World) => {
    if (spectator) {
      w.input.moveX = 0;
      w.input.moveY = 0;
      w.input.firing = false;
      w.input.aim = { type: 'none' };
      return;
    }
    const c = ctl.current;
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
    w.input.firing = c.touchFire || c.mouseFire || c.spaceFire;
    if (c.touchFire && c.touchAimActive) w.input.aim = { type: 'dir', angle: c.touchAimAngle };
    else if (c.touchFire) w.input.aim = { type: 'none' };
    else if (c.mouseActive) w.input.aim = { type: 'point', x: c.mouseWX, y: c.mouseWY };
    else w.input.aim = { type: 'none' };
  };

  // ── camera easing (zoom toward the death point during 'dying') ──
  const updateCamera = (dt: number) => {
    const cam = camRef.current;
    let tz = 1, tx = WORLD_W / 2, ty = WORLD_H / 2;
    if (dyingRef.current.active) {
      tz = reducedMotion ? 1.25 : 1.7;
      tx = dyingRef.current.x; ty = dyingRef.current.y;
    }
    const halfW = WORLD_W / (2 * tz), halfH = WORLD_H / (2 * tz);
    tx = clampN(tx, halfW, WORLD_W - halfW);
    ty = clampN(ty, halfH, WORLD_H - halfH);
    const k = Math.min(1, 7 * dt);
    cam.zoom += (tz - cam.zoom) * k;
    cam.cx += (tx - cam.cx) * k;
    cam.cy += (ty - cam.cy) * k;
  };

  // ── render: world (camera-transformed) + screen-space overlays ──
  const render = (now: number) => {
    const canvas = canvasRef.current;
    const w = worldRef.current;
    if (!canvas || !w) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = dprRef.current;
    const s = scaleRef.current;
    const fx = fxRef.current;
    const cam = camRef.current;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    const sh = reducedMotion ? { x: 0, y: 0 } : fx.shake(7);
    const a = dpr * s * cam.zoom;
    const tx = dpr * (cssW / 2 - cam.cx * s * cam.zoom + sh.x);
    const ty = dpr * (cssH / 2 - cam.cy * s * cam.zoom + sh.y);
    ctx.setTransform(a, 0, 0, a, tx, ty);
    drawWorld(ctx, w, now, fx);

    // screen-space overlays
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // hero hit vignette
    if (fx.heroFlash > 0) {
      ctx.globalAlpha = fx.heroFlash * 0.33;
      ctx.fillStyle = '#FF3B6B';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.globalAlpha = 1;
    }

    const c = ctl.current;
    if (c.moveId !== null) drawStick(ctx, c.moveBase, c.moveKnob, '#7C5CFC');
    if (c.fireId !== null) drawStick(ctx, c.fireBase, c.fireKnob, '#FFD43B');
    // hero HP / shield / ammo now live in the DOM HUD overlay (ArenaHud)
  };

  // ── snapshot the world into HUD data (called throttled, ~10x/sec) ──
  const buildHud = (now: number): HudData => {
    const w = worldRef.current!;
    const hero = w.fighters[0];
    const gs = useGame.getState();
    return {
      mode: { name: mode.name, emoji: mode.emoji, targetScore: target },
      scores, // authoritative-aware (mirrors host for non-hosts)
      alive: aliveCounts(w),
      myTeam,
      // count DOWN to the deadline; show the full length before play begins
      timeMs: matchEndsAtRef.current ? Math.max(0, matchEndsAtRef.current - Date.now()) : durationMs,
      hp: hero.hp,
      shielded: now < hero.shieldUntil,
      streak: gs.streak,
      coins: gs.coins,
      learnCorrect: stats.current.correct,
      weapon: heroWeaponHud(w, now),
      roster: w.fighters.map((f) => ({ name: f.name, team: f.team, hp: f.hp, alive: f.alive, isHero: f.isHero })),
      minimap: w.fighters.map((f) => ({ x: f.x, y: f.y, team: f.team, alive: f.alive, isHero: f.isHero })),
      worldW: w.w, worldH: w.h,
      hitMarker: hitMarkerRef.current,
    };
  };

  const hudActions = {
    onReload: () => { const w = worldRef.current; if (w) { requestReload(w, performance.now()); setHud(buildHud(performance.now())); } },
  };

  const makePracticeSnapshot = useCallback((): ArenaPracticeSnapshot | null => {
    const w = worldRef.current;
    if (!w || net) return null;
    return {
      v: 1,
      savedAt: Date.now(),
      phase: phaseRef.current,
      count,
      scores: { ...w.scores },
      prepared,
      learnState,
      lastReward,
      result,
      stats: { ...stats.current },
      usedIds: Array.from(usedIds.current),
      matchRemainingMs: matchEndsAtRef.current ? Math.max(0, matchEndsAtRef.current - Date.now()) : durationMs,
      dying: { ...dyingRef.current },
      heroKills: [...heroKills.current],
      lastScores: { ...lastScores.current },
      scoredVictims: Array.from(scoredVictims.current),
      hitSeq: hitSeq.current,
      world: snapshotWorld(w, performance.now()),
    };
  }, [count, durationMs, learnState, lastReward, net, prepared, result]);

  // Keep the snapshot fn in a ref so the interval/event listeners don't need
  // to re-register every time learnState / lastReward / etc. changes.
  const snapRef = useRef(makePracticeSnapshot);
  snapRef.current = makePracticeSnapshot;
  useEffect(() => {
    if (net || !config.onSnapshot) return;
    const save = () => config.onSnapshot?.(snapRef.current());
    const id = window.setInterval(save, 500);
    // pagehide is the correct unload event on iOS Safari; beforeunload covers
    // desktop browsers that may skip pagehide (e.g. Chrome bfcache).
    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', save);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('pagehide', save);
      window.removeEventListener('beforeunload', save);
    };
  }, [config, net]);

  // ── multiplayer: tab visibility ──
  // Hidden tab = rAF stops = no more 'move' packets, so opponents watched my
  // fighter dead-reckon forever (slide into a wall / look frozen). Send one
  // final stopped-move on hide; on return, reset the frame clock so the first
  // visible frame doesn't compute a multi-second dt.
  useEffect(() => {
    if (!net) return;
    const onVisibility = () => {
      if (document.hidden) {
        const w = worldRef.current;
        const hero = w?.fighters[0];
        if (w?.multiplayer && hero?.alive && !spectator) {
          net.sendNet('move', {
            x: Math.round(hero.x), y: Math.round(hero.y),
            vx: 0, vy: 0, aim: +hero.aimAngle.toFixed(3),
          });
        }
      } else {
        lastTs.current = 0;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [net, spectator]);

  // ── M2 helpers: roster lookups, kill feed, host scoring from 'down' events ──
  const rosterName = (netId: string) => net?.roster.find((r) => r.netId === netId)?.name ?? 'Player';
  const rosterTeam = (netId: string): TeamId | undefined => net?.roster.find((r) => r.netId === netId)?.team;
  const remoteFighter = (netId: string) => worldRef.current?.fighters.find((f) => f.netId === netId && !f.isHero);
  const validOpposingPlayers = (killerNetId: string, victimNetId: string) => {
    if (!killerNetId || !victimNetId || killerNetId === victimNetId) return false;
    const killerTeam = rosterTeam(killerNetId);
    const victimTeam = rosterTeam(victimNetId);
    return !!killerTeam && !!victimTeam && killerTeam !== victimTeam;
  };
  const pushDown = (killerNetId: string, victimNetId: string, ts: number) => {
    if (!validOpposingPlayers(killerNetId, victimNetId)) return;
    pushKills([{
      killerId: killerNetId === net?.myNetId ? 'hero' : `p:${killerNetId}`,
      killerName: rosterName(killerNetId),
      victimName: rosterName(victimNetId),
      team: rosterTeam(killerNetId) ?? 'red',
      crit: false,
    }], ts);
  };
  const applyRemoteHit = (victimNetId: string, byNetId: string, hp: number) => {
    if (!validOpposingPlayers(byNetId, victimNetId)) return;
    const victim = remoteFighter(victimNetId);
    if (!victim || !victim.alive || scoredVictims.current.has(victimNetId)) return;
    victim.hp = clampN(Math.round(hp), 0, 100);
    victim.flash = 1;
  };
  // host only: a tag-out scores for the killer's team (authoritative + broadcast)
  const hostScore = (killerNetId: string, victimNetId: string) => {
    const w = worldRef.current;
    const team = rosterTeam(killerNetId);
    if (!w || !team || !validOpposingPlayers(killerNetId, victimNetId)) return;
    if (scoredVictims.current.has(victimNetId)) return;
    scoredVictims.current.add(victimNetId);
    w.scores[team] += 1;
    if (killerNetId === net?.myNetId) w.fighters[0].score += 1;
    const s = { red: w.scores.red, blue: w.scores.blue };
    lastScores.current = s;
    setScores(s);
    net?.onScores(s.red, s.blue);
  };

  // ── one frame (stored in a ref so the rAF trampoline never goes stale) ──
  frameRef.current = (ts: number) => {
    const w = worldRef.current;
    if (!w) return;
    // clamp: after a backgrounded tab resumes, the rAF gap can be many seconds —
    // an unclamped dt exploded fx/death timers (step() clamps internally too)
    const dt = Math.min(lastTs.current ? (ts - lastTs.current) / 1000 : 0, 0.1);
    lastTs.current = ts;
    const fx = fxRef.current;

    applyInput(w);

    // M2: apply remote players' events every frame (so opponents keep moving /
    // shooting even while I'm in the Learning Pod or the intro countdown).
    if (net && w.multiplayer) {
      for (const ev of net.drainNet()) {
        const d = ev.data;
        if (ev.t === 'move') applyRemoteMove(w, ev.from, { x: Number(d.x), y: Number(d.y), vx: Number(d.vx), vy: Number(d.vy), aim: Number(d.aim) }, ts);
        else if (ev.t === 'shoot') applyRemoteShot(w, ev.from, {
          x: Number(d.x), y: Number(d.y), angle: Number(d.angle),
          speed: Number(d.speed), dmg: Number(d.dmg), life: Number(d.life), weapon: String(d.weapon ?? ''),
        }, ts);
        else if (ev.t === 'respawn') {
          const victim = remoteFighter(ev.from);
          if (!victim || victim.alive) continue;
          applyRemoteRespawn(w, ev.from, { x: Number(d.x), y: Number(d.y) }, ts);
          scoredVictims.current.delete(ev.from);
        }
        else if (ev.t === 'hit') {
          applyRemoteHit(ev.from, String(d.by ?? ''), Number(d.hp));
        }
        else if (ev.t === 'leave') {
          if (leftPlayers.current.has(ev.from)) continue;
          leftPlayers.current.add(ev.from);
          const name = typeof d.name === 'string' && d.name.trim() ? d.name.slice(0, 30) : rosterName(ev.from);
          applyRemoteLeave(w, ev.from);
          scoredVictims.current.delete(ev.from);
          announce(t('arena.playerLeft', { name }));
        }
        else if (ev.t === 'down') {
          const by = String(d.by ?? '');
          if (net.isHost) {
            // Host (whether spectator-only or a player) is the authoritative
            // scorer for remote downs. The old `if (!spectator) continue` was
            // wrong: a player-host is still authoritative and must process these.
            const victim = remoteFighter(ev.from);
            if (!victim || !victim.alive || !validOpposingPlayers(by, ev.from) || scoredVictims.current.has(ev.from)) continue;
            applyRemoteDown(w, ev.from);
            pushDown(by, ev.from, ts);
            hostScore(by, ev.from);
            continue;
          }
          const victim = remoteFighter(ev.from);
          if (!victim || !victim.alive || !validOpposingPlayers(by, ev.from) || scoredVictims.current.has(ev.from)) continue;
          applyRemoteDown(w, ev.from);
          pushDown(by, ev.from, ts);
          scoredVictims.current.add(ev.from);
          if (by === net.myNetId) w.fighters[0].score += 1;
        }
      }
    }

    if (phaseRef.current === 'playing') {
      const res = step(w, dt, ts, fx);
      playSounds(res.sounds);
      pushKills(res.kills, ts);
      if (res.heroHit) hitMarkerRef.current = { id: ++hitSeq.current, crit: res.heroHit.crit };
      if (w.scores.red !== lastScores.current.red || w.scores.blue !== lastScores.current.blue) {
        lastScores.current = { red: w.scores.red, blue: w.scores.blue };
        // non-hosts mirror the host's score (applied via effect) — never their own
        if (!authoritative) {
          setScores(lastScores.current);
          checkScoreAlerts(w.scores.red, w.scores.blue);
        }
        // host publishes its authoritative score to all clients
        if (net?.isHost) net.onScores(w.scores.red, w.scores.blue);
      }
      if (res.heroDied && res.heroDeath) startDying(res.heroDeath);

      // ── M2: broadcast MY hero so opponents see me (move coalesced @12Hz) ──
      if (net && w.multiplayer && !spectator) {
        const hero = w.fighters[0];
        if (hero.alive) {
          net.sendNet('move', {
            x: Math.round(hero.x), y: Math.round(hero.y),
            vx: Math.round(hero.vx), vy: Math.round(hero.vy), aim: +hero.aimAngle.toFixed(3),
          });
        }
        if (res.heroShot) {
          net.sendNet('shoot', {
            x: Math.round(res.heroShot.x), y: Math.round(res.heroShot.y), angle: +res.heroShot.angle.toFixed(3),
            speed: res.heroShot.speed, dmg: res.heroShot.dmg, life: res.heroShot.life, weapon: w.weapon.id,
          });
        }
        if (res.heroDamaged?.by) {
          net.sendNet('hit', { hp: Math.max(0, Math.round(res.heroDamaged.hp)), by: res.heroDamaged.by });
        }
        if (res.heroDied) {
          const by = res.heroDownedBy ?? '';
          net.sendNet('down', { by });           // tell everyone I was tagged out
          pushDown(by, net.myNetId, ts);         // my own kill-feed line
          if (net.isHost) hostScore(by, net.myNetId); // self-'down' is filtered, so score here
        }
      }
    }

    // ── TIME'S UP → end the match (scores are uncapped; the clock decides) ──
    // Runs in any phase so it ends even while the hero is in the Learning Pod.
    // Host/offline triggers it; non-hosts end on the host's authoritative signal.
    if (
      !authoritative && matchEndsAtRef.current &&
      Date.now() >= matchEndsAtRef.current && phaseRef.current !== 'ended'
    ) {
      endMatch();
      return false;
    }

    // freeze-frame slow-mo during the death camera, normal speed otherwise
    fx.update(phaseRef.current === 'dying' ? dt * 0.32 : dt);

    if (phaseRef.current === 'dying') {
      dyingRef.current.t += dt;
      if (dyingRef.current.t >= (reducedMotion ? DEATH_DUR_RM : DEATH_DUR)) enterLearning();
    }

    updateCamera(dt);
    render(ts);

    // throttled HUD overlay refresh (~10 Hz keeps re-renders cheap)
    hudAccum.current += dt;
    if (hudAccum.current >= 0.1 && worldRef.current) { hudAccum.current = 0; setHud(buildHud(ts)); }
  };

  const loop = useCallback((ts: number) => {
    const cont = frameRef.current(ts);
    if (cont !== false) rafRef.current = requestAnimationFrame(loop);
  }, []);

  // ── boot / restart a match ──
  const boot = useCallback((allowSnapshot = true) => {
    clearTimers();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const restored = allowSnapshot && !net && config.initialSnapshot?.v === 1 ? config.initialSnapshot : null;
    worldRef.current = restored
      ? restoreWorld(restored.world, performance.now())
      : createWorld(
        perTeam, config.hero, config.obstacles, config.difficulty, config.seed, config.botFill ?? true,
        mp ? net!.roster : undefined, mp ? net!.myNetId : undefined, config.initialWeapon, myTeam,
        spectator,
      );
    stats.current = restored ? { ...restored.stats } : { correct: 0, answered: 0, xp: 0, coins: 0 };
    usedIds.current = new Set(restored?.usedIds ?? []);
    lastTs.current = 0;
    lastScores.current = restored ? { ...restored.lastScores } : { red: 0, blue: 0 };
    fxRef.current = new Fx();
    fxRef.current.intensity = reducedMotion ? 0.35 : 1;
    camRef.current = { zoom: 1, cx: WORLD_W / 2, cy: WORLD_H / 2 };
    dyingRef.current = restored ? { ...restored.dying } : { active: false, t: 0, x: 0, y: 0 };
    heroKills.current = [...(restored?.heroKills ?? [])];
    matchPointRef.current = false;
    behindRef.current = false;
    scoredVictims.current = new Set(restored?.scoredVictims ?? []);
    hitSeq.current = restored?.hitSeq ?? 0;
    matchEndsAtRef.current = restored?.matchRemainingMs ? Date.now() + restored.matchRemainingMs : 0;
    hudAccum.current = 0;
    hitMarkerRef.current = null;
    setFeed([]);
    setBanner(null);
    setScores(restored ? restored.scores : { red: 0, blue: 0 });
    setResult(restored?.result ?? null);
    setPrepared(restored?.prepared ?? null);
    setLearnState(restored?.learnState ?? 'answering');
    setLastReward(restored?.lastReward ?? null);
    setCount(restored?.count ?? 3);
    setPhaseBoth(restored?.phase ?? 'intro');
    resize();

    if (restored) {
      if (restored.phase === 'intro') {
        let n = Math.max(1, restored.count);
        const tick = () => {
          n -= 1;
          emit('countdown');
          if (n <= 0) { setCount(0); matchEndsAtRef.current = Date.now() + Math.max(1, restored.matchRemainingMs); setPhaseBoth('playing'); }
          else { setCount(n); timers.current.push(setTimeout(tick, 800)); }
        };
        timers.current.push(setTimeout(tick, 800));
      } else if (restored.phase === 'learning' && restored.learnState === 'correct') {
        timers.current.push(setTimeout(respawnHero, CELEBRATE_MS));
      } else if (restored.phase === 'learning' && restored.learnState === 'wrong-cooldown') {
        timers.current.push(setTimeout(() => { if (phaseRef.current === 'learning') loadQuestion(); }, WRONG_COOLDOWN_MS));
      }
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    // intro countdown 3-2-1 → play
    let n = 3;
    emit('countdown');
    const tick = () => {
      n -= 1;
      emit('countdown');
      if (n <= 0) { setCount(0); matchEndsAtRef.current = Date.now() + durationMs; setPhaseBoth('playing'); }
      else { setCount(n); timers.current.push(setTimeout(tick, 800)); }
    };
    timers.current.push(setTimeout(tick, 800));
    rafRef.current = requestAnimationFrame(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perTeam, resize, loop, reducedMotion, myTeam]);

  useEffect(() => {
    boot();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    // Mobile robustness: re-size whenever the canvas wrapper's box changes (layout
    // settling after mount, orientation change, address-bar show/hide). Without
    // this the canvas can mount at 0×0 on a phone → "the game doesn't show".
    let ro: ResizeObserver | null = null;
    if (wrapRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => resize());
      ro.observe(wrapRef.current);
    }
    requestAnimationFrame(() => resize()); // one more pass after first paint

    // keep state in sync when the user leaves real fullscreen via Esc
    const onFsChange = () => {
      const active = !!(document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement);
      isFullscreenRef.current = active;
      setIsFullscreen(active);
      requestAnimationFrame(() => resize());
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);

    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (down) resumeAudio();
      if (k === ' ') { ctl.current.spaceFire = down; e.preventDefault(); return; }
      if (down && k === 'f') { toggleFullscreen(); return; } // F = toggle fullscreen
      // Weapon controls: the selected blaster is locked for the whole match.
      // R reloads; number-key weapon switching is intentionally disabled.
      if (down && k === 'r') { const w = worldRef.current; if (w) requestReload(w, performance.now()); return; }
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
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── non-host: mirror the host's authoritative live score into the HUD ──
  const netScoreRed = net?.scores?.red;
  const netScoreBlue = net?.scores?.blue;
  useEffect(() => {
    if (!authoritative || netScoreRed == null || netScoreBlue == null) return;
    setScores({ red: netScoreRed, blue: netScoreBlue });
    checkScoreAlerts(netScoreRed, netScoreBlue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authoritative, netScoreRed, netScoreBlue]);

  // ── non-host: end the match when the host says so (shared, single end) ──
  const netEnded = net?.ended;
  useEffect(() => {
    if (authoritative && netEnded && phaseRef.current !== 'ended') endMatch(netEnded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authoritative, netEnded]);

  // ── pointer controls (touch joysticks + mouse aim/fire) ──
  const toLocal = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cam = camRef.current;
    const s = scaleRef.current * cam.zoom;
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    return {
      cssX,
      cssY,
      wx: cam.cx + (cssX - rect.width / 2) / s,
      wy: cam.cy + (cssY - rect.height / 2) / s,
      half: rect.width / 2,
    };
  };

  const isUiControlEvent = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement | null;
    return !!target?.closest('button, a, input, [data-arena-control="true"]');
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (isUiControlEvent(e)) return;
    resumeAudio();
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
    if (isUiControlEvent(e)) return;
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
    // multiplayer: "Play Again" returns to the menu (a fresh local boot would
    // re-create the isolated-match bug). Re-lobbying in place is an M2 task.
    return (
      <div className="mx-auto max-w-md px-4 py-5">
        <MatchResults result={result} onPlayAgain={net ? net.onExit : () => boot(false)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={requestLeave} disabled={leaving} className="btn-ghost px-3 py-1.5 text-sm disabled:opacity-60">
          ← {leaving ? t('arena.leaving') : t('hud.leave')}
        </button>
        <span className="chip bg-grape-50 text-grape">{mode.emoji} {mode.name}</span>
      </div>

      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        className={`select-none ${isFullscreen ? 'fixed inset-0 z-50 grid place-items-center bg-ink' : 'relative mt-3'}`}
      >
        <canvas
          ref={canvasRef}
          className={`touch-none transition ${
            isFullscreen ? '' : 'w-full rounded-xl2 shadow-card ring-1 ring-grape-100'
          } ${phase === 'learning' ? 'blur-sm brightness-90' : ''}`}
          style={{ cursor: 'crosshair', touchAction: 'none' }}
        />

        {/* CS2-inspired competitive HUD overlay */}
        {hud && phase !== 'ended' && <ArenaHud d={hud} actions={hudActions} />}

        {/* multiplayer diagnostics — proves matchId + seed match across clients */}
        {net && <ArenaDebugPanel info={net.debug} />}

        {/* fullscreen toggle (F key also works) */}
        <button
          onClick={requestLeave}
          disabled={leaving}
          className="pointer-events-auto absolute left-2 top-2 z-40 rounded-xl bg-white/90 px-3 py-2 text-xs font-extrabold text-ink shadow-card ring-1 ring-grape-100 backdrop-blur transition hover:bg-white disabled:opacity-60"
        >
          ← {leaving ? t('arena.leaving') : t('hud.leave')}
        </button>

        <button
          onClick={toggleFullscreen}
          aria-label={t(isFullscreen ? 'hud.exitFullscreen' : 'hud.fullscreen')}
          className="pointer-events-auto absolute right-2 top-2 z-40 grid h-9 w-9 place-items-center rounded-xl bg-ink/80 text-lg text-white shadow-card backdrop-blur transition hover:bg-ink"
        >
          {isFullscreen ? '✕' : '⛶'}
        </button>

        {/* kill feed (sits below the fullscreen button) */}
        <div className="pointer-events-none absolute right-2 top-12 z-20 flex flex-col items-end gap-1">
          <AnimatePresence>
            {feed.map((e) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 28 }}
                className="rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-extrabold text-white shadow"
              >
                <span>{TEAMS[e.team].emoji} {e.killerName}</span>
                <span className="mx-1 text-mango">⚡</span>
                <span className="opacity-80">{e.victimName}</span>
                {e.crit && <span className="ml-1 text-sun">CRIT</span>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* big announcement (multi-kill / comeback / match point) */}
        <AnimatePresence>
          {banner && (
            <motion.div
              key={banner.key}
              initial={{ opacity: 0, scale: 0.6, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.35 }}
              className="pointer-events-none absolute inset-x-0 top-10 z-20 text-center"
            >
              <span className="font-display text-2xl font-extrabold text-white drop-shadow-[0_2px_10px_rgba(124,92,252,0.95)]">
                {banner.text}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

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

        {/* death freeze-frame flourish */}
        <AnimatePresence>
          {phase === 'dying' && (
            <motion.div
              className="pointer-events-none absolute inset-0 grid place-items-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.p
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="font-display text-4xl font-extrabold text-white drop-shadow-[0_2px_12px_rgba(255,59,107,0.9)]"
              >
                {t('arena.taggedOut')}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* learning pod — rendered INSIDE the fullscreen element so the question
            shows in fullscreen too (otherwise the player can't answer to respawn) */}
        <AnimatePresence>
          {phase === 'learning' && prepared && (
            <LearningPanel
              key={prepared.q.id}
              prepared={prepared}
              learnState={learnState}
              lastReward={lastReward}
              cooldownMs={WRONG_COOLDOWN_MS}
              onAnswer={submitAnswer}
              onLeave={requestLeave}
            />
          )}
        </AnimatePresence>

        {/* leave confirmation — only after the player explicitly confirms do we
            drop them from the match (and remove their character for everyone). */}
        <AnimatePresence>
          {confirmLeave && (
            <motion.div
              className="absolute inset-0 z-50 grid place-items-center bg-ink/55 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0.85, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-xs rounded-[26px] bg-white p-6 text-center shadow-soft"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-grape-50 text-3xl">👋</div>
                <p className="mt-3 font-display text-xl font-extrabold">{t('arena.leaveConfirmTitle')}</p>
                <p className="mt-2 text-sm font-bold text-ink-soft">{t('arena.leaveConfirmBody')}</p>
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => setConfirmLeave(false)}
                    disabled={leaving}
                    className="btn-ghost flex-1 px-4 py-2.5 disabled:opacity-60"
                  >
                    {t('arena.leaveConfirmStay')}
                  </button>
                  <button
                    onClick={() => { setConfirmLeave(false); leaveMatch(); }}
                    disabled={leaving}
                    className="flex-1 rounded-full bg-bubble px-4 py-2.5 font-extrabold text-white shadow-card transition hover:brightness-105 disabled:opacity-60"
                  >
                    {t('arena.leaveConfirmLeave')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-2 text-center text-xs font-bold text-ink-faint">
        {t('arena.controls')}
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
