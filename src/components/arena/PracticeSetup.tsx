'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/store/useGame';
import { ARENA_MODES, TEAM_SIZES } from '@/data/arenaModes';
import { ARENA_MAPS, type ArenaMap } from '@/data/arenaMaps';
import { WORLD_H, WORLD_W, type ArenaDifficulty } from '@/lib/arena/engine';
import { GRADES, type Grade } from '@/lib/arena/types';
import { useT } from '@/lib/i18n';
import { Icon } from '@/components/ui/Icon';
import { ArenaGame, type ArenaPracticeSnapshot } from './ArenaGame';
import { MatchLengthInput } from './MatchLengthInput';
import { WeaponLoadout } from './WeaponLoadout';
import { DEFAULT_WEAPON, isWeaponId, type WeaponId } from '@/lib/arena/weapons';

export const PRACTICE_SESSION_KEY = 'kcq.arena.practice.v1';

interface PracticeSession {
  v: 1;
  started: boolean;
  mapId: string;
  perTeam: number;
  difficulty: ArenaDifficulty;
  grade?: Grade;
  durationSec: number;
  weapon: WeaponId;
  snapshot: ArenaPracticeSnapshot | null;
}

function readPracticeSession(): PracticeSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PRACTICE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PracticeSession>;
    const mapId = typeof parsed.mapId === 'string' && ARENA_MAPS.some((m) => m.id === parsed.mapId)
      ? parsed.mapId
      : ARENA_MAPS[0].id;
    const perTeam = TEAM_SIZES.some((t) => t.perTeam === parsed.perTeam) ? parsed.perTeam! : TEAM_SIZES[1].perTeam;
    const difficulty = parsed.difficulty === 'easy' || parsed.difficulty === 'medium' || parsed.difficulty === 'hard' || parsed.difficulty === 'expert'
      ? parsed.difficulty
      : 'medium';
    const durationSec = typeof parsed.durationSec === 'number' && Number.isFinite(parsed.durationSec)
      ? Math.max(30, Math.min(900, Math.round(parsed.durationSec)))
      : 180;
    const grade = typeof parsed.grade === 'number' && parsed.grade >= 1 && parsed.grade <= 11
      ? (parsed.grade as Grade)
      : undefined;
    return {
      v: 1,
      started: parsed.started === true,
      mapId,
      perTeam,
      difficulty,
      grade,
      durationSec,
      weapon: isWeaponId(parsed.weapon) ? parsed.weapon : DEFAULT_WEAPON,
      snapshot: parsed.snapshot?.v === 1 ? parsed.snapshot : null,
    };
  } catch {
    return null;
  }
}

function savePracticeSession(session: PracticeSession | null) {
  if (typeof window === 'undefined') return;
  if (!session) sessionStorage.removeItem(PRACTICE_SESSION_KEY);
  else sessionStorage.setItem(PRACTICE_SESSION_KEY, JSON.stringify(session));
}

export function hasSavedPracticeSession(): boolean {
  return readPracticeSession() !== null;
}

export const DIFFICULTIES: { id: ArenaDifficulty; label: string; emoji: string }[] = [
  { id: 'easy', label: 'Easy', emoji: '😊' },
  { id: 'medium', label: 'Medium', emoji: '🙂' },
  { id: 'hard', label: 'Hard', emoji: '😤' },
  { id: 'expert', label: 'Expert', emoji: '🔥' },
];

const MAP_SIZE_LABEL: Record<ArenaMap['size'], string> = {
  small: 'Kichik',
  medium: 'O‘rtacha',
  large: 'Katta',
};

const MAP_CHALLENGE_LABEL: Record<ArenaMap['challenge'], string> = {
  easy: 'Oson',
  medium: 'Normal',
  hard: 'Qiyin',
};

/** Play vs Bots — pick map, difficulty, team size and match length, then play. */
export function PracticeSetup({ onBack }: { onBack: () => void }) {
  const t = useT();
  const savedRef = useRef<PracticeSession | null>(readPracticeSession());
  const playerName = useGame((s) => s.playerName);
  const arenaAvatar = useGame((s) => s.arenaAvatar);
  const hero = { name: playerName || 'You', avatar: arenaAvatar };

  const mode = ARENA_MODES[0];
  const [mapId, setMapId] = useState<string>(savedRef.current?.mapId ?? ARENA_MAPS[0].id);
  const map = ARENA_MAPS.find((m) => m.id === mapId) ?? ARENA_MAPS[0];
  const [perTeam, setPerTeam] = useState<number>(savedRef.current?.perTeam ?? TEAM_SIZES[1].perTeam);
  const [difficulty, setDifficulty] = useState<ArenaDifficulty>(savedRef.current?.difficulty ?? 'medium');
  const [grade, setGrade] = useState<Grade | undefined>(savedRef.current?.grade);
  const [durationSec, setDurationSec] = useState<number>(savedRef.current?.durationSec ?? 180);
  const [weapon, setWeapon] = useState<WeaponId>(savedRef.current?.weapon ?? DEFAULT_WEAPON);
  const [started, setStarted] = useState(savedRef.current?.started ?? false);
  const snapshotRef = useRef<ArenaPracticeSnapshot | null>(savedRef.current?.snapshot ?? null);

  const writeSession = useCallback((nextSnapshot = snapshotRef.current) => {
    savePracticeSession({ v: 1, started, mapId, perTeam, difficulty, grade, durationSec, weapon, snapshot: nextSnapshot });
  }, [difficulty, grade, durationSec, mapId, perTeam, started, weapon]);

  useEffect(() => {
    writeSession();
  }, [writeSession]);

  const clearAndBack = () => {
    savePracticeSession(null);
    onBack();
  };

  const startPractice = () => {
    snapshotRef.current = null;
    setStarted(true);
  };

  const saveSnapshot = useCallback((snapshot: ArenaPracticeSnapshot | null) => {
    snapshotRef.current = snapshot;
    savePracticeSession({ v: 1, started: true, mapId, perTeam, difficulty, grade, durationSec, weapon, snapshot });
  }, [difficulty, grade, durationSec, mapId, perTeam, weapon]);

  if (started) {
    return (
      <ArenaGame
        config={{
          mode,
          perTeam,
          hero,
          obstacles: map.obstacles,
          difficulty,
          grade,
          durationSec,
          initialWeapon: weapon,
          initialSnapshot: snapshotRef.current ?? undefined,
          onSnapshot: saveSnapshot,
          onExit: clearAndBack,
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={clearAndBack} className="btn-ghost px-3 py-1.5 text-sm">← {t('hud.leave')}</button>
        <span className="chip bg-grape-50 text-grape"><Icon name="bot" className="h-4 w-4" /> {t('arena.bots')}</span>
      </div>

      <section>
        <p className="mb-2 font-display font-extrabold">Map</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ARENA_MAPS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMapId(m.id)}
              className={`rounded-3xl p-3 text-left shadow-card transition ${
                mapId === m.id ? 'bg-grape text-white ring-2 ring-sun' : 'bg-white hover:bg-grape-50'
              }`}
            >
              <MapPreview map={m} selected={mapId === m.id} />
              <span className="mt-3 flex items-center gap-1.5 font-display text-base font-extrabold">
                <span className="text-xl">{m.emoji}</span>
                <span className="min-w-0 flex-1">{m.name}</span>
              </span>
              <span className={`mt-2 flex flex-wrap gap-1.5 text-[10px] font-extrabold uppercase ${mapId === m.id ? 'text-white/85' : 'text-ink-faint'}`}>
                <span className={`rounded-full px-2 py-1 ${mapId === m.id ? 'bg-white/15' : 'bg-grape-50'}`}>{MAP_SIZE_LABEL[m.size]}</span>
                <span className={`rounded-full px-2 py-1 ${mapId === m.id ? 'bg-white/15' : 'bg-sun/30'}`}>{MAP_CHALLENGE_LABEL[m.challenge]}</span>
              </span>
              <span className={`mt-2 block text-xs font-bold leading-snug ${mapId === m.id ? 'text-white/85' : 'text-ink-soft'}`}>{m.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <p className="mb-2 font-display font-extrabold">{t('lobby.botDifficulty')}</p>
        <div className="grid grid-cols-4 gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              onClick={() => setDifficulty(d.id)}
              className={`rounded-2xl py-2.5 text-center font-display text-sm font-extrabold shadow-card transition ${
                difficulty === d.id ? 'bg-grape text-white ring-2 ring-sun' : 'bg-white hover:bg-grape-50'
              }`}
            >
              <span className="block text-lg">{d.emoji}</span>
              {d.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <p className="mb-2 font-display font-extrabold">{t('arena.grade')}</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setGrade(undefined)}
            className={`rounded-2xl px-3 py-2 font-display text-sm font-extrabold shadow-card transition ${
              grade == null ? 'bg-grape text-white ring-2 ring-sun' : 'bg-white hover:bg-grape-50'
            }`}
          >
            {t('arena.gradeAll')}
          </button>
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => setGrade(g)}
              className={`rounded-2xl px-3 py-2 font-display text-sm font-extrabold shadow-card transition ${
                grade === g ? 'bg-grape text-white ring-2 ring-sun' : 'bg-white hover:bg-grape-50'
              }`}
            >
              {t('arena.gradeN', { n: g })}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <p className="mb-2 font-display font-extrabold">{t('lobby.teamSize')}</p>
        <div className="flex gap-2">
          {TEAM_SIZES.map((tz) => (
            <button
              key={tz.perTeam}
              onClick={() => setPerTeam(tz.perTeam)}
              className={`flex-1 rounded-2xl py-3 font-display font-extrabold shadow-card transition ${
                tz.perTeam === perTeam ? 'bg-sun text-ink ring-2 ring-grape' : 'bg-white hover:bg-grape-50'
              }`}
            >
              {tz.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <p className="mb-2 font-display font-extrabold">{t('lobby.matchLength')}</p>
        <MatchLengthInput durationSec={durationSec} onChange={setDurationSec} />
      </section>

      <WeaponLoadout value={weapon} onChange={setWeapon} />

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={startPractice}
        className="btn-primary mt-6 w-full text-lg"
      >
        <Icon name="rocket" className="h-5 w-5" /> {t('arena.bots')}
      </motion.button>
    </div>
  );
}

function MapPreview({ map, selected }: { map: ArenaMap; selected: boolean }) {
  return (
    <span className={`relative block aspect-[720/440] overflow-hidden rounded-2xl border ${
      selected ? 'border-white/35 bg-white/15' : 'border-grape-100 bg-[#F1EDFF]'
    }`}>
      <span className="absolute inset-y-0 left-0 w-[9.72%] bg-[#FF7AB6]/20" />
      <span className="absolute inset-y-0 right-0 w-[9.72%] bg-[#3BA7FF]/20" />
      <span
        className={`absolute left-[5.2%] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${
          selected ? 'bg-white ring-2 ring-[#FF7AB6]' : 'bg-[#FF7AB6]'
        }`}
      />
      <span
        className={`absolute right-[5.2%] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${
          selected ? 'bg-white ring-2 ring-[#3BA7FF]' : 'bg-[#3BA7FF]'
        }`}
      />
      {map.obstacles.map((r, i) => (
        <span
          key={`${map.id}-${i}`}
          className={`absolute rounded-[3px] ${selected ? 'bg-white/70' : 'bg-grape/45'}`}
          style={{
            left: `${(r.x / WORLD_W) * 100}%`,
            top: `${(r.y / WORLD_H) * 100}%`,
            width: `${(r.w / WORLD_W) * 100}%`,
            height: `${(r.h / WORLD_H) * 100}%`,
          }}
        />
      ))}
    </span>
  );
}
