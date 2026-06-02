'use client';

import { motion } from 'framer-motion';
import { useGame, getAvatar } from '@/store/useGame';

export type MenuChoice = 'practice' | 'online' | 'create' | 'join';

const OPTIONS: { id: MenuChoice; emoji: string; title: string; blurb: string; color: string }[] = [
  { id: 'practice', emoji: '🤖', title: 'Practice vs Bots', blurb: 'Solo — pick map & difficulty', color: 'from-grape to-bubble' },
  { id: 'online', emoji: '🌐', title: 'Online Multiplayer', blurb: 'Quick match with players + bots', color: 'from-sky to-bubble' },
  { id: 'create', emoji: '🛠️', title: 'Create Room', blurb: 'Host a custom game', color: 'from-mango to-sun' },
  { id: 'join', emoji: '🔑', title: 'Join Room', blurb: 'Enter a 6-digit code', color: 'from-mint to-sky' },
];

/** Arena landing menu — the 4 ways to play. */
const GENDERS = [
  { id: 'boy', emoji: '👦', label: 'Boy' },
  { id: 'girl', emoji: '👧', label: 'Girl' },
] as const;

export function ArenaMenu({ onSelect }: { onSelect: (c: MenuChoice) => void }) {
  const playerName = useGame((s) => s.playerName);
  const setPlayerName = useGame((s) => s.setPlayerName);
  const avatarId = useGame((s) => s.avatarId);
  const selectAvatar = useGame((s) => s.selectAvatar);

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="text-center">
        <div className="text-5xl">⚔️</div>
        <h1 className="mt-2 h-section">Battle Learn Arena</h1>
        <p className="mt-1 text-ink-soft">Battle, get tagged out, answer a question to respawn — and get smarter every round!</p>
      </div>

      {/* hero */}
      <section className="card mt-6">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-grape-50 text-2xl">{getAvatar(avatarId).emoji}</span>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Your hero name"
            maxLength={20}
            className="flex-1 rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-bold outline-none focus:border-grape"
          />
        </div>

        {/* gender / character pick */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-bold text-ink-faint">I am:</span>
          {GENDERS.map((g) => (
            <button
              key={g.id}
              onClick={() => selectAvatar(g.id)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-extrabold shadow-card transition ${
                avatarId === g.id ? 'bg-grape text-white ring-2 ring-sun' : 'bg-white hover:bg-grape-50'
              }`}
            >
              <span className="text-base">{g.emoji}</span>
              {g.label}
            </button>
          ))}
        </div>
      </section>

      {/* play options */}
      <div className="mt-5 grid gap-3">
        {OPTIONS.map((o, i) => (
          <motion.button
            key={o.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(o.id)}
            className={`flex items-center gap-4 rounded-xl2 bg-gradient-to-br ${o.color} p-4 text-left text-white shadow-toy`}
          >
            <span className="text-3xl">{o.emoji}</span>
            <span className="flex-1">
              <span className="block font-display text-lg font-extrabold leading-tight">{o.title}</span>
              <span className="block text-sm text-white/85">{o.blurb}</span>
            </span>
            <span className="text-2xl">›</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
