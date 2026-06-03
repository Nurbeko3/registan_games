'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame, getAvatar } from '@/store/useGame';
import { ARENA_MODES, TEAM_SIZES } from '@/data/arenaModes';
import { ARENA_MAPS } from '@/data/arenaMaps';
import { MATCH_LENGTHS } from '@/lib/arena/network/types';
import type { ArenaMode } from '@/lib/arena/types';
import type { ArenaDifficulty } from '@/lib/arena/engine';
import { ArenaGame } from './ArenaGame';

export const DIFFICULTIES: { id: ArenaDifficulty; label: string; emoji: string }[] = [
  { id: 'easy', label: 'Easy', emoji: '😊' },
  { id: 'medium', label: 'Medium', emoji: '🙂' },
  { id: 'hard', label: 'Hard', emoji: '😤' },
  { id: 'expert', label: 'Expert', emoji: '🔥' },
];

/** Practice vs Bots — pick difficulty, map, mode and team size, then play. */
export function PracticeSetup({ onBack }: { onBack: () => void }) {
  const playerName = useGame((s) => s.playerName);
  const avatarId = useGame((s) => s.avatarId);
  const hero = { name: playerName || 'You', avatar: getAvatar(avatarId).emoji };

  const [mode, setMode] = useState<ArenaMode>(ARENA_MODES[0]);
  const [perTeam, setPerTeam] = useState<number>(TEAM_SIZES[1].perTeam);
  const [mapId, setMapId] = useState<string>(ARENA_MAPS[0].id);
  const [difficulty, setDifficulty] = useState<ArenaDifficulty>('medium');
  const [durationSec, setDurationSec] = useState<number>(180);
  const [started, setStarted] = useState(false);

  if (started) {
    const map = ARENA_MAPS.find((m) => m.id === mapId) ?? ARENA_MAPS[0];
    return <ArenaGame config={{ mode, perTeam, hero, obstacles: map.obstacles, difficulty, durationSec }} />;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-5">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={onBack} className="btn-ghost px-3 py-1.5 text-sm">← Back</button>
        <span className="chip bg-grape-50 text-grape">🤖 Practice vs Bots</span>
      </div>

      {/* difficulty */}
      <section>
        <p className="mb-2 font-display font-extrabold">Difficulty</p>
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

      {/* map */}
      <section className="mt-5">
        <p className="mb-2 font-display font-extrabold">Map</p>
        <div className="grid gap-2">
          {ARENA_MAPS.map((m) => {
            const active = m.id === mapId;
            return (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMapId(m.id)}
                className={`flex items-center gap-3 rounded-2xl p-3 text-left shadow-card transition ${
                  active ? 'bg-grape text-white ring-2 ring-sun' : 'bg-white hover:bg-grape-50'
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="flex-1">
                  <span className="block font-display font-extrabold">{m.name}</span>
                  <span className={`block text-xs ${active ? 'text-white/80' : 'text-ink-faint'}`}>{m.blurb}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* mode */}
      <section className="mt-5">
        <p className="mb-2 font-display font-extrabold">Mode</p>
        <div className="grid grid-cols-2 gap-2">
          {ARENA_MODES.map((m) => {
            const active = m.id === mode.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m)}
                className={`rounded-2xl p-2.5 text-left shadow-card transition ${
                  active ? 'bg-grape text-white ring-2 ring-sun' : 'bg-white hover:bg-grape-50'
                }`}
              >
                <span className="block font-display text-sm font-extrabold">{m.emoji} {m.name}</span>
                <span className={`block text-[11px] ${active ? 'text-white/80' : 'text-ink-faint'}`}>{m.blurb}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* team size */}
      <section className="mt-5">
        <p className="mb-2 font-display font-extrabold">Team size</p>
        <div className="flex gap-2">
          {TEAM_SIZES.map((t) => (
            <button
              key={t.perTeam}
              onClick={() => setPerTeam(t.perTeam)}
              className={`flex-1 rounded-2xl py-3 font-display font-extrabold shadow-card transition ${
                t.perTeam === perTeam ? 'bg-sun text-ink ring-2 ring-grape' : 'bg-white hover:bg-grape-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* match length — scores are uncapped; the clock ends the match */}
      <section className="mt-5">
        <p className="mb-2 font-display font-extrabold">Match length</p>
        <div className="flex gap-2">
          {MATCH_LENGTHS.map((m) => (
            <button
              key={m.sec}
              onClick={() => setDurationSec(m.sec)}
              className={`flex-1 rounded-2xl py-3 font-display font-extrabold shadow-card transition ${
                m.sec === durationSec ? 'bg-sun text-ink ring-2 ring-grape' : 'bg-white hover:bg-grape-50'
              }`}
            >
              ⏱ {m.label}
            </button>
          ))}
        </div>
      </section>

      <button onClick={() => setStarted(true)} className="btn-primary mt-6 w-full text-lg">🚀 Enter the arena</button>
    </div>
  );
}
