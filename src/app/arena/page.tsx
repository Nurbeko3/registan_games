'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { ArenaGame } from '@/components/arena/ArenaGame';
import { ARENA_MODES, TEAM_SIZES } from '@/data/arenaModes';
import { TEAMS, type ArenaMode, type TeamId } from '@/lib/arena/types';
import { useGame, getAvatar } from '@/store/useGame';

/** Battle Learn Arena lobby → match. Fully offline (plays vs friendly bots),
 *  so it works with zero setup. Pick a mode + team size and jump in. */
export default function ArenaPage() {
  const playerName = useGame((s) => s.playerName);
  const avatarId = useGame((s) => s.avatarId);

  const [mode, setMode] = useState<ArenaMode>(ARENA_MODES[0]);
  const [perTeam, setPerTeam] = useState<number>(TEAM_SIZES[1].perTeam);
  const [started, setStarted] = useState(false);

  // assign the hero a team for the match (you lead the Red Foxes)
  const myTeam: TeamId = 'red';
  const hero = { name: playerName || 'You', avatar: getAvatar(avatarId).emoji };

  if (started) {
    return (
      <main id="main" className="min-h-screen pb-24">
        <TopBar />
        <ArenaGame config={{ mode, perTeam, hero }} />
      </main>
    );
  }

  return (
    <main id="main" className="min-h-screen dotted pb-24">
      <TopBar />
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="text-center">
          <div className="text-5xl">⚔️</div>
          <h1 className="mt-2 h-section">Battle Learn Arena</h1>
          <p className="mt-1 text-ink-soft">
            Battle other players — and when you’re tagged out, answer a question to respawn.
            Get smarter every round!
          </p>
        </div>

        {/* mode picker */}
        <section className="mt-6">
          <p className="mb-2 font-display font-extrabold">Choose a mode</p>
          <div className="grid gap-2">
            {ARENA_MODES.map((m) => {
              const active = m.id === mode.id;
              return (
                <motion.button
                  key={m.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setMode(m)}
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

        {/* team size */}
        <section className="mt-5">
          <p className="mb-2 font-display font-extrabold">Team size</p>
          <div className="flex gap-2">
            {TEAM_SIZES.map((t) => {
              const active = t.perTeam === perTeam;
              return (
                <button
                  key={t.perTeam}
                  onClick={() => setPerTeam(t.perTeam)}
                  className={`flex-1 rounded-2xl py-3 font-display font-extrabold shadow-card transition ${
                    active ? 'bg-sun text-ink ring-2 ring-grape' : 'bg-white hover:bg-grape-50'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* your hero */}
        <section className="card mt-5 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-grape-50 text-2xl">{hero.avatar}</span>
          <div className="flex-1">
            <p className="font-display font-extrabold">{hero.name}</p>
            <p className="text-xs text-ink-faint">Leading {TEAMS[myTeam].emoji} {TEAMS[myTeam].name}</p>
          </div>
        </section>

        <button onClick={() => setStarted(true)} className="btn-primary mt-5 w-full text-lg">
          🚀 Enter the arena
        </button>
      </div>
    </main>
  );
}
