'use client';

import { motion } from 'framer-motion';
import { TEAMS, type TeamId } from '@/lib/arena/types';
import type { HeroWeaponHud } from '@/lib/arena/engine';
import { WEAPONS, type WeaponId } from '@/lib/arena/weapons';
import { useT } from '@/lib/i18n';
import { WeaponIcon } from '../WeaponIcon';

/** Everything the competitive HUD draws each (throttled) tick. Pure data so the
 *  game loop can snapshot it cheaply ~10x/sec without re-rendering every frame. */
export interface HudData {
  mode: { name: string; emoji: string; targetScore: number };
  scores: { red: number; blue: number };
  alive: { red: number; blue: number };
  myTeam: TeamId;
  timeMs: number;
  hp: number;
  shielded: boolean;
  streak: number;
  coins: number;
  learnCorrect: number;
  weapon: HeroWeaponHud;
  roster: { name: string; team: TeamId; hp: number; alive: boolean; isHero: boolean }[];
  minimap: { x: number; y: number; team: TeamId; alive: boolean; isHero: boolean }[];
  worldW: number;
  worldH: number;
  /** bumps when a hero bolt lands → triggers the hit marker (crit = bigger). */
  hitMarker: { id: number; crit: boolean } | null;
}

export interface HudActions {
  onReload: () => void;
  onSwitch: (id: WeaponId) => void;
}

const TEAM_TEXT: Record<TeamId, string> = { red: 'text-bubble-600', blue: 'text-sky-600' };
const TEAM_BG: Record<TeamId, string> = { red: 'bg-bubble', blue: 'bg-sky' };
const TEAM_SOFT: Record<TeamId, string> = { red: 'bg-bubble/15', blue: 'bg-sky/15' };

const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** CS2-inspired competitive overlay — original, non-violent, kid-friendly.
 *  Regions mirror the reference for instant readability: score/timer up top,
 *  minimap top-left, vitals bottom-left, weapon/ammo bottom-center, rewards
 *  bottom-right, team roster on the right. */
export function ArenaHud({ d, actions }: { d: HudData; actions: HudActions }) {
  const t = useT();
  return (
    <>
      <TopCluster d={d} t={t} />
      <Minimap d={d} />
      <Roster d={d} t={t} />
      <Vitals d={d} t={t} />
      <WeaponPanel d={d} actions={actions} t={t} />
      <Rewards d={d} t={t} />
      {d.hitMarker && <HitMarker key={d.hitMarker.id} crit={d.hitMarker.crit} />}
    </>
  );
}

type T = (k: string, v?: Record<string, string | number>) => string;

// ── TOP CENTER: team scores · timer · round/objective · ALIVE ──
function TopCluster({ d, t }: { d: HudData; t: T }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1.5 z-20 flex flex-col items-center gap-1">
      <div className="flex items-stretch overflow-hidden rounded-2xl bg-ink/78 text-white shadow-card ring-1 ring-white/10 backdrop-blur">
        <Score team="red" score={d.scores.red} mine={d.myTeam === 'red'} />
        <div className="flex min-w-[104px] flex-col items-center justify-center px-3 py-1">
          <span
            className={`font-mono text-xl font-extrabold leading-none tabular-nums ${
              d.timeMs <= 30000 ? 'animate-pulse text-bubble-300' : ''
            }`}
          >
            {fmtTime(d.timeMs)}
          </span>
          <span className="mt-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white/55">
            {d.mode.emoji} {d.mode.name}
          </span>
        </div>
        <Score team="blue" score={d.scores.blue} mine={d.myTeam === 'blue'} />
      </div>
      <div className="flex items-center gap-1.5 rounded-full bg-ink/75 px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow">
        <span className={TEAM_TEXT.red.replace('600', '300')}>🦊 {d.alive.red}</span>
        <span className="text-white/50">{t('hud.alive')}</span>
        <span className="text-sky-300">{d.alive.blue} 🐳</span>
      </div>
    </div>
  );
}

function Score({ team, score, mine }: { team: TeamId; score: number; mine: boolean }) {
  return (
    <div className={`flex min-w-[64px] flex-col items-center justify-center px-3 py-1 ${TEAM_BG[team]}`}>
      <span className="font-display text-2xl font-extrabold leading-none">{score}</span>
      <span className="text-[8px] font-bold uppercase tracking-wide text-white/80">
        {TEAMS[team].emoji}{mine ? ' ★' : ''}
      </span>
    </div>
  );
}

// ── TOP LEFT: minimap with team dots + your arrow ──
function Minimap({ d }: { d: HudData }) {
  const W = 118, H = Math.round((d.worldH / d.worldW) * 118);
  return (
    <div
      className="pointer-events-none absolute left-2 top-2 z-10 overflow-hidden rounded-xl bg-ink/64 ring-1 ring-white/15 backdrop-blur"
      style={{ width: W, height: H }}
    >
      {d.minimap.map((p, i) => {
        const x = (p.x / d.worldW) * W;
        const y = (p.y / d.worldH) * H;
        const size = p.isHero ? 8 : 6;
        return (
          <span
            key={i}
            className={`absolute rounded-full ${p.isHero ? 'bg-sun ring-2 ring-white' : TEAM_BG[p.team]} ${p.alive ? '' : 'opacity-30'}`}
            style={{ left: x - size / 2, top: y - size / 2, width: size, height: size }}
          />
        );
      })}
    </div>
  );
}

// ── RIGHT: team roster (alive status + HP) ──
function Roster({ d, t }: { d: HudData; t: T }) {
  const mine = d.roster.filter((p) => p.team === d.myTeam);
  return (
    <div className="pointer-events-none absolute right-2 top-1/2 z-10 hidden w-36 -translate-y-1/2 flex-col gap-1 sm:flex">
      <p className="px-1 text-[9px] font-extrabold uppercase tracking-widest text-white/70 drop-shadow">
        {t('hud.team')} · {mine.filter((p) => p.alive).length}/{mine.length}
      </p>
      {mine.map((p, i) => (
        <div
          key={i}
          className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 backdrop-blur ${p.alive ? 'bg-ink/65' : 'bg-ink/35'}`}
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${p.alive ? 'bg-mint' : 'bg-white/30'}`} />
          <span className="flex-1 truncate text-[10px] font-bold text-white">{p.isHero ? `★ ${p.name}` : p.name}</span>
          <div className="h-1 w-8 overflow-hidden rounded-full bg-white/20">
            <div className={`h-full ${TEAM_BG[p.team]}`} style={{ width: `${Math.max(0, p.hp)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── BOTTOM LEFT: health · shield · streak ──
function Vitals({ d, t }: { d: HudData; t: T }) {
  const hp = Math.max(0, Math.round(d.hp));
  const hpColor = hp > 50 ? 'bg-mint' : hp > 25 ? 'bg-sun' : 'bg-bubble';
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-20 w-40">
      <div className="rounded-xl bg-ink/72 p-2 shadow-card ring-1 ring-white/10 backdrop-blur">
        <div className="flex items-center justify-between text-white">
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-white/60">{t('hud.health')}</span>
          <span className="font-display text-xl font-extrabold leading-none">{hp}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15">
          <motion.div animate={{ width: `${hp}%` }} className={`h-full ${hpColor}`} />
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold text-white/80">
          <span className={`rounded-full px-2 py-0.5 ${d.shielded ? 'bg-sky text-white' : 'bg-white/10 text-white/40'}`}>
            🛡 {t('hud.shield')}
          </span>
          {d.streak > 0 && <span className="rounded-full bg-mango/80 px-2 py-0.5 text-ink">🔥 {d.streak}</span>}
        </div>
      </div>
    </div>
  );
}

// ── BOTTOM CENTER: weapon · ammo · reload · weapon strip ──
function WeaponPanel({ d, actions, t }: { d: HudData; actions: HudActions; t: T }) {
  const wpn = d.weapon;
  const low = !wpn.reloading && wpn.mag <= Math.max(1, Math.ceil(wpn.magSize * 0.25));
  return (
    <div className="absolute inset-x-0 bottom-2 z-20 flex flex-col items-center gap-1">
      <div className="pointer-events-auto flex max-w-[70vw] gap-1 overflow-x-auto rounded-2xl bg-ink/35 px-1.5 py-1 shadow-card backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {WEAPONS.map((w, i) => (
          <button
            key={w.id}
            onClick={() => actions.onSwitch(w.id)}
            aria-label={t(w.nameKey)}
            className={`grid h-7 w-9 shrink-0 place-items-center rounded-xl shadow transition ${
              w.id === wpn.id ? 'scale-105 bg-sun text-ink ring-2 ring-white' : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            <span className="relative grid place-items-center">
              <WeaponIcon id={w.id} className="h-5 w-8" />
              <span className={`absolute -bottom-1.5 -right-1 text-[7px] font-extrabold ${w.id === wpn.id ? 'text-ink/60' : 'text-white/60'}`}>{i + 1}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-2xl bg-ink/78 px-3 py-1.5 text-white shadow-card ring-1 ring-white/10 backdrop-blur">
        <WeaponIcon id={wpn.id} className="h-9 w-16 shrink-0" />
        <div className="min-w-[84px]">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-white/60">{t(wpn.nameKey)}</p>
          {wpn.reloading ? (
            <div className="mt-0.5 h-3 w-24 overflow-hidden rounded-full bg-white/15">
              <div className="h-full bg-sun transition-[width] duration-100" style={{ width: `${Math.round(wpn.reloadPct * 100)}%` }} />
            </div>
          ) : (
            <p className="font-mono text-lg font-extrabold leading-none tabular-nums">
              <span className={low ? 'text-bubble-300' : ''}>{wpn.mag}</span>
              <span className="text-white/45"> / {wpn.reserve}</span>
            </p>
          )}
        </div>
        <button
          onClick={actions.onReload}
          className="pointer-events-auto rounded-xl bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white hover:bg-white/20"
        >
          {wpn.reloading ? t('hud.reloading') : `↻ ${t('hud.reload')}`}
        </button>
      </div>
    </div>
  );
}

// ── BOTTOM RIGHT: coins · learning score ──
function Rewards({ d, t }: { d: HudData; t: T }) {
  return (
    <div className="pointer-events-none absolute bottom-2 right-2 z-20 flex flex-col items-end gap-1">
      <span className="rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-extrabold text-sun shadow backdrop-blur">
        💰 {d.coins}
      </span>
      <span className="rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-extrabold text-mint shadow backdrop-blur">
        🎓 {t('hud.learning')}: {d.learnCorrect}
      </span>
    </div>
  );
}

// ── center hit marker (energy spark, not gore) ──
function HitMarker({ crit }: { crit: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
      initial={{ scale: crit ? 1.4 : 1, opacity: 1 }}
      animate={{ scale: crit ? 2 : 1.5, opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <span className={`font-display text-2xl font-extrabold ${crit ? 'text-sun' : 'text-white'}`}>✦</span>
    </motion.div>
  );
}
