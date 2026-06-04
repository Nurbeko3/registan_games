'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/store/useGame';
import { ARENA_MODES, TEAM_SIZES } from '@/data/arenaModes';
import { ARENA_MAPS } from '@/data/arenaMaps';
import type { ArenaDifficulty } from '@/lib/arena/engine';
import { useT } from '@/lib/i18n';
import { Icon } from '@/components/ui/Icon';
import { ArenaGame } from './ArenaGame';
import { MatchLengthInput } from './MatchLengthInput';
import { WeaponLoadout } from './WeaponLoadout';
import { DEFAULT_WEAPON, type WeaponId } from '@/lib/arena/weapons';

export const DIFFICULTIES: { id: ArenaDifficulty; label: string; emoji: string }[] = [
  { id: 'easy', label: 'Easy', emoji: '😊' },
  { id: 'medium', label: 'Medium', emoji: '🙂' },
  { id: 'hard', label: 'Hard', emoji: '😤' },
  { id: 'expert', label: 'Expert', emoji: '🔥' },
];

/** Play vs Bots — pick difficulty, team size and match length, then play.
 *  No modes/maps: one default arena keeps it simple for kids. */
export function PracticeSetup({ onBack }: { onBack: () => void }) {
  const t = useT();
  const playerName = useGame((s) => s.playerName);
  const arenaAvatar = useGame((s) => s.arenaAvatar);
  const hero = { name: playerName || 'You', avatar: arenaAvatar };

  const mode = ARENA_MODES[0];
  const map = ARENA_MAPS[0];
  const [perTeam, setPerTeam] = useState<number>(TEAM_SIZES[1].perTeam);
  const [difficulty, setDifficulty] = useState<ArenaDifficulty>('medium');
  const [durationSec, setDurationSec] = useState<number>(180);
  const [weapon, setWeapon] = useState<WeaponId>(DEFAULT_WEAPON);
  const [started, setStarted] = useState(false);

  if (started) {
    return <ArenaGame config={{ mode, perTeam, hero, obstacles: map.obstacles, difficulty, durationSec, initialWeapon: weapon, onExit: onBack }} />;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-5">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={onBack} className="btn-ghost px-3 py-1.5 text-sm">← {t('hud.leave')}</button>
        <span className="chip bg-grape-50 text-grape"><Icon name="bot" className="h-4 w-4" /> {t('arena.bots')}</span>
      </div>

      <section>
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
        onClick={() => setStarted(true)}
        className="btn-primary mt-6 w-full text-lg"
      >
        <Icon name="rocket" className="h-5 w-5" /> {t('arena.bots')}
      </motion.button>
    </div>
  );
}
