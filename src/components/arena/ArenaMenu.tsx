'use client';

import { motion } from 'framer-motion';
import { useGame } from '@/store/useGame';
import { ARENA_AVATARS } from '@/data/arenaAvatars';
import { Icon, IconTile, type IconName } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

export type MenuChoice = 'practice' | 'create' | 'join';

const OPTIONS: { id: MenuChoice; icon: IconName; titleKey: string; blurbKey: string; color: string }[] = [
  { id: 'create', icon: 'wrench', titleKey: 'arena.create', blurbKey: 'arena.createSub', color: 'from-mango to-sun' },
  { id: 'join', icon: 'signal', titleKey: 'arena.join', blurbKey: 'arena.joinSub', color: 'from-mint to-sky' },
  { id: 'practice', icon: 'bot', titleKey: 'arena.bots', blurbKey: 'arena.botsSub', color: 'from-grape to-bubble' },
];

/** Arena landing — pick your name + avatar, then Create / Join / Play vs Bots. */
export function ArenaMenu({ onSelect }: { onSelect: (c: MenuChoice) => void }) {
  const t = useT();
  const playerName = useGame((s) => s.playerName);
  const setPlayerName = useGame((s) => s.setPlayerName);
  const arenaAvatar = useGame((s) => s.arenaAvatar);
  const setArenaAvatar = useGame((s) => s.setArenaAvatar);

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="text-center">
        <Icon name="sword" className="mx-auto h-14 w-14 text-grape" />
        <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight">Battle Learn Arena</h1>
      </div>

      {/* hero setup: name + avatar */}
      <section className="card mt-6">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-grape-50 text-4xl">{arenaAvatar}</span>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder={t('arena.namePlaceholder')}
            maxLength={20}
            className="flex-1 rounded-2xl border-2 border-grape-100 bg-white px-5 py-4 text-xl font-extrabold outline-none focus:border-grape"
          />
        </div>

        {/* avatar grid */}
        <p className="mb-2 mt-5 text-base font-extrabold text-ink-soft">{t('arena.pickAvatar')}</p>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {ARENA_AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => setArenaAvatar(a)}
              className={`grid aspect-square min-h-14 place-items-center rounded-2xl text-2xl shadow-card transition ${
                arenaAvatar === a ? 'scale-110 bg-grape text-white ring-2 ring-sun' : 'bg-white hover:bg-grape-50'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </section>

      {/* play options */}
      <div className="mt-6 grid gap-4">
        {OPTIONS.map((o, i) => (
          <motion.button
            key={o.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(o.id)}
            className={`flex min-h-28 items-center gap-5 rounded-2xl bg-gradient-to-br ${o.color} p-5 text-left text-white shadow-toy`}
          >
            <IconTile name={o.icon} className="h-16 w-16 shrink-0 bg-white/18 text-white" iconClassName="h-8 w-8" />
            <span className="flex-1">
              <span className="block font-display text-2xl font-extrabold leading-tight">{t(o.titleKey)}</span>
              <span className="mt-1 block text-lg font-bold text-white/90">{t(o.blurbKey)}</span>
            </span>
            <Icon name="spark" className="h-6 w-6 text-white/85" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
