'use client';

import { motion } from 'framer-motion';
import { useGame } from '@/store/useGame';
import { ARENA_AVATARS } from '@/data/arenaAvatars';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

export type MenuChoice = 'practice' | 'create' | 'join';

const OPTIONS: { id: MenuChoice; icon: IconName; titleKey: string; blurbKey: string; color: string }[] = [
  { id: 'create', icon: 'wrench', titleKey: 'arena.create', blurbKey: 'arena.createSub', color: 'from-mango to-sun' },
  { id: 'join', icon: 'signal', titleKey: 'arena.join', blurbKey: 'arena.joinSub', color: 'from-mint to-sky' },
  { id: 'practice', icon: 'bot', titleKey: 'arena.bots', blurbKey: 'arena.botsSub', color: 'from-grape to-bubble' },
];

/** Arena landing — pick your name + avatar, then Create / Join / Play vs Bots. */
export function ArenaMenu({
  onSelect,
  multiplayerEnabled,
  authorityChecked,
}: {
  onSelect: (c: MenuChoice) => void;
  multiplayerEnabled: boolean;
  authorityChecked: boolean;
}) {
  const t = useT();
  const playerName = useGame((s) => s.playerName);
  const setPlayerName = useGame((s) => s.setPlayerName);
  const arenaAvatar = useGame((s) => s.arenaAvatar);
  const setArenaAvatar = useGame((s) => s.setArenaAvatar);
  const hasName = playerName.trim().length > 0;

  return (
    <div className="mx-auto max-w-md px-4 py-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-grape-50 text-grape">
          <Icon name="sword" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-lg font-extrabold leading-tight">{t('arena.title')}</h1>
          <p className="truncate text-xs text-ink-soft">{t('arena.subtitle')}</p>
        </div>
      </div>

      {/* setup: name + avatar */}
      <section className="mt-4 rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-grape-100/70">
        <div className="flex items-center gap-2.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-grape-50 text-2xl">{arenaAvatar}</span>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder={t('arena.namePlaceholder')}
            required
            maxLength={20}
            aria-invalid={!hasName}
            className={`flex-1 rounded-xl border-2 bg-white px-3 py-2 font-extrabold outline-none focus:border-grape ${
              hasName ? 'border-grape-100' : 'border-bubble/60'
            }`}
          />
        </div>
        {!hasName && <p className="mt-2 text-xs font-extrabold text-bubble-600">{t('arena.nameRequired')}</p>}

        {/* avatar grid */}
        <p className="mb-1.5 mt-3 text-xs font-extrabold text-ink-soft">{t('arena.pickAvatar')}</p>
        <div className="grid grid-cols-8 gap-1">
          {ARENA_AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => setArenaAvatar(a)}
              className={`grid aspect-square place-items-center rounded-lg text-base transition ${
                arenaAvatar === a ? 'scale-110 bg-grape text-white ring-2 ring-sun' : 'bg-grape-50 hover:bg-grape-100'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </section>

      {/* play options */}
      <div className="mt-4 grid gap-2">
        {OPTIONS.map((o, i) => (
          <motion.button
            key={o.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.98 }}
            disabled={!hasName || (((!authorityChecked || !multiplayerEnabled) && o.id !== 'practice'))}
            onClick={() => onSelect(o.id)}
            className={`group flex items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-card ring-1 ring-grape-100/70 transition hover:scale-[1.01] ${
              !hasName || (((!authorityChecked || !multiplayerEnabled) && o.id !== 'practice')) ? 'cursor-not-allowed opacity-50 grayscale hover:scale-100' : ''
            }`}
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${o.color} text-white shadow-card`}>
              <Icon name={o.icon} className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block font-display font-extrabold leading-tight">{t(o.titleKey)}</span>
              <span className="block text-xs font-bold text-ink-soft">
                {!hasName
                  ? t('arena.nameRequiredShort')
                  : !authorityChecked && o.id !== 'practice'
                  ? t('arena.authorityChecking')
                  : !multiplayerEnabled && o.id !== 'practice'
                    ? t('arena.authorityOff')
                    : t(o.blurbKey)}
              </span>
            </span>
            <Icon name="spark" className="h-4 w-4 text-grape transition-transform group-hover:translate-x-1" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
