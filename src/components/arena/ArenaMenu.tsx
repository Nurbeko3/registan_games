'use client';

import { motion } from 'framer-motion';
import { useGame } from '@/store/useGame';
import { ARENA_AVATARS } from '@/data/arenaAvatars';
import { useT } from '@/lib/i18n';

export type MenuChoice = 'practice' | 'create' | 'join';

const OPTIONS: { id: MenuChoice; emoji: string; titleKey: string; blurbKey: string; color: string }[] = [
  { id: 'create', emoji: '🛠️', titleKey: 'arena.create', blurbKey: 'arena.createSub', color: 'from-mango to-sun' },
  { id: 'join', emoji: '🔑', titleKey: 'arena.join', blurbKey: 'arena.joinSub', color: 'from-mint to-sky' },
  { id: 'practice', emoji: '🤖', titleKey: 'arena.bots', blurbKey: 'arena.botsSub', color: 'from-grape to-bubble' },
];

/** Arena landing — pick your name + avatar, then Create / Join / Play vs Bots. */
export function ArenaMenu({ onSelect }: { onSelect: (c: MenuChoice) => void }) {
  const t = useT();
  const playerName = useGame((s) => s.playerName);
  const setPlayerName = useGame((s) => s.setPlayerName);
  const arenaAvatar = useGame((s) => s.arenaAvatar);
  const setArenaAvatar = useGame((s) => s.setArenaAvatar);

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="text-center">
        <div className="text-5xl">⚔️</div>
        <h1 className="mt-2 h-section">Battle Learn Arena</h1>
      </div>

      {/* hero setup: name + avatar */}
      <section className="card mt-5">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-grape-50 text-3xl">{arenaAvatar}</span>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder={t('arena.namePlaceholder')}
            maxLength={20}
            className="flex-1 rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-bold outline-none focus:border-grape"
          />
        </div>

        {/* avatar grid */}
        <p className="mt-3 mb-1.5 text-xs font-bold text-ink-faint">{t('arena.pickAvatar')}</p>
        <div className="grid grid-cols-8 gap-1.5">
          {ARENA_AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => setArenaAvatar(a)}
              className={`grid aspect-square place-items-center rounded-xl text-xl shadow-card transition ${
                arenaAvatar === a ? 'scale-110 bg-grape text-white ring-2 ring-sun' : 'bg-white hover:bg-grape-50'
              }`}
            >
              {a}
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
              <span className="block font-display text-lg font-extrabold leading-tight">{t(o.titleKey)}</span>
              <span className="block text-sm text-white/85">{t(o.blurbKey)}</span>
            </span>
            <span className="text-2xl">›</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
