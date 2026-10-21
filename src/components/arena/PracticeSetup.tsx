'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button type="button" onClick={clearAndBack} className="btn-secondary btn-sm">
          <Icon name="arrowLeft" className="h-4 w-4" /> {t('hud.leave')}
        </button>
        <span className="chip bg-brand-50 text-brand-700"><Icon name="bot" className="h-3.5 w-3.5" /> {t('arena.bots')}</span>
      </div>

      <section aria-labelledby="practice-map">
        <p id="practice-map" className="mb-2 text-sm font-bold text-fg">{t('arena.map')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label={t('arena.map')}>
          {ARENA_MAPS.map((m) => {
            const active = mapId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMapId(m.id)}
                className={`rounded-2xl border p-3 text-left transition ${
                  active ? 'border-brand bg-brand-50/50 shadow-xs ring-1 ring-brand' : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2'
                }`}
              >
                <MapPreview map={m} selected={active} />
                <span className="mt-3 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-fg">{m.name}</span>
                  {active && <Icon name="checkCircle" className="h-4 w-4 shrink-0 text-brand" />}
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="badge-neutral">{MAP_SIZE_LABEL[m.size]}</span>
                  <span className="badge-warning">{MAP_CHALLENGE_LABEL[m.challenge]}</span>
                </span>
                <span className="mt-2 block text-xs leading-snug text-fg-soft">{m.blurb}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="card mt-5 space-y-4">
        <section>
          <p className="label">{t('lobby.botDifficulty')}</p>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('lobby.botDifficulty')}>
            {DIFFICULTIES.map((d) => {
              const active = difficulty === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDifficulty(d.id)}
                  className={`inline-flex min-h-[38px] items-center justify-center rounded-lg border px-2 text-xs font-bold transition sm:text-sm ${
                    active ? 'border-brand bg-brand-50 text-brand-700' : 'border-border bg-surface text-fg-soft hover:border-border-strong hover:text-fg'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <p className="label">{t('arena.grade')}</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('arena.grade')}>
            {[{ id: 'all', label: t('arena.gradeAll') }, ...GRADES.map((g) => ({ id: String(g), label: t('arena.gradeN', { n: g }) }))].map((it) => {
              const active = it.id === 'all' ? grade == null : grade === Number(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setGrade(it.id === 'all' ? undefined : (Number(it.id) as Grade))}
                  className={`inline-flex min-h-[32px] items-center rounded-lg border px-2.5 text-xs font-bold transition ${
                    active ? 'border-brand bg-brand-50 text-brand-700' : 'border-border bg-surface text-fg-soft hover:border-border-strong hover:text-fg'
                  }`}
                >
                  {it.label}
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section>
            <p className="label">{t('lobby.teamSize')}</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('lobby.teamSize')}>
              {TEAM_SIZES.map((tz) => {
                const active = tz.perTeam === perTeam;
                return (
                  <button
                    key={tz.perTeam}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPerTeam(tz.perTeam)}
                    className={`inline-flex min-h-[38px] items-center justify-center rounded-lg border px-2 text-sm font-bold transition ${
                      active ? 'border-brand bg-brand-50 text-brand-700' : 'border-border bg-surface text-fg-soft hover:border-border-strong hover:text-fg'
                    }`}
                  >
                    {tz.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <p className="label">{t('lobby.matchLength')}</p>
            <MatchLengthInput durationSec={durationSec} onChange={setDurationSec} />
          </section>
        </div>
      </div>

      <WeaponLoadout value={weapon} onChange={setWeapon} />

      <button type="button" onClick={startPractice} className="btn-primary btn-lg mt-6 w-full">
        <Icon name="play" className="h-4 w-4 [&>path]:fill-current" /> {t('arena.bots')}
      </button>
    </div>
  );
}

function MapPreview({ map, selected }: { map: ArenaMap; selected: boolean }) {
  return (
    <span className={`relative block aspect-[720/440] overflow-hidden rounded-xl border ${
      selected ? 'border-brand-200 bg-brand-50' : 'border-border bg-surface-2'
    }`}>
      <span className="absolute inset-y-0 left-0 w-[9.72%] bg-danger-500/15" />
      <span className="absolute inset-y-0 right-0 w-[9.72%] bg-info-500/15" />
      <span className="absolute left-[5.2%] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-danger-500 ring-2 ring-surface" />
      <span className="absolute right-[5.2%] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-info-500 ring-2 ring-surface" />
      {map.obstacles.map((r, i) => (
        <span
          key={`${map.id}-${i}`}
          className={`absolute rounded-[3px] ${selected ? 'bg-brand/50' : 'bg-fg-faint/40'}`}
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
