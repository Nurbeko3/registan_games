'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useGame } from '@/store/useGame';
import { ARENA_AVATARS } from '@/data/arenaAvatars';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Notice, PageHeader } from '@/components/ui/Primitives';
import { useT } from '@/lib/i18n';

export type MenuChoice = 'practice' | 'create' | 'join';

const OPTIONS: { id: MenuChoice; icon: IconName; titleKey: string; blurbKey: string; tone: string }[] = [
  { id: 'practice', icon: 'bot', titleKey: 'arena.bots', blurbKey: 'arena.botsSub', tone: 'bg-brand-50 text-brand ring-brand-100' },
  { id: 'create', icon: 'plus', titleKey: 'arena.create', blurbKey: 'arena.createSub', tone: 'bg-violet-50 text-violet-600 ring-violet-100' },
  { id: 'join', icon: 'signal', titleKey: 'arena.join', blurbKey: 'arena.joinSub', tone: 'bg-success-50 text-success-600 ring-success-100' },
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
  const reduce = useReducedMotion();
  const playerName = useGame((s) => s.playerName);
  const setPlayerName = useGame((s) => s.setPlayerName);
  const arenaAvatar = useGame((s) => s.arenaAvatar);
  const setArenaAvatar = useGame((s) => s.setArenaAvatar);
  const hasName = playerName.trim().length > 0;
  const multiplayerBlocked = !authorityChecked || !multiplayerEnabled;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader icon="arena" eyebrow={t('nav.arena')} title={t('arena.title')} description={t('arena.subtitle')} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* setup: name + avatar */}
        <section className="card" aria-labelledby="arena-setup">
          <p id="arena-setup" className="eyebrow">{t('arena.pickAvatar')}</p>
          <div className="mt-3 flex items-center gap-3">
            <AvatarBadge avatar={arenaAvatar} className="h-11 w-11 shrink-0 text-2xl" rounded="rounded-lg" bg="bg-brand-50" />
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={t('arena.namePlaceholder')}
              required
              maxLength={20}
              aria-invalid={!hasName}
              aria-label={t('arena.namePlaceholder')}
              className={`input ${hasName ? '' : 'input-error'}`}
            />
          </div>
          {!hasName && <p className="help text-danger-600">{t('arena.nameRequired')}</p>}

          <div className="mt-4 grid grid-cols-8 gap-1.5" role="radiogroup" aria-label={t('arena.pickAvatar')}>
            {ARENA_AVATARS.map((a) => {
              const active = arenaAvatar === a;
              return (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setArenaAvatar(a)}
                  className={`grid aspect-square place-items-center rounded-lg transition ${
                    active ? 'bg-brand-50 ring-2 ring-brand' : 'bg-surface-2 hover:bg-surface-3'
                  }`}
                >
                  <AvatarBadge avatar={a} className="h-full w-full text-base" rounded="rounded-lg" bg="" />
                </button>
              );
            })}
          </div>
        </section>

        {/* play options */}
        <section className="space-y-2" aria-label={t('home.modes')}>
          {OPTIONS.map((o, i) => {
            const blocked = !hasName || (multiplayerBlocked && o.id !== 'practice');
            const sub = !hasName
              ? t('arena.nameRequiredShort')
              : !authorityChecked && o.id !== 'practice'
                ? t('arena.authorityChecking')
                : !multiplayerEnabled && o.id !== 'practice'
                  ? t('arena.authorityOff')
                  : t(o.blurbKey);
            return (
              <motion.button
                key={o.id}
                type="button"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                disabled={blocked}
                onClick={() => onSelect(o.id)}
                className={`card group flex w-full items-center gap-3.5 !p-4 text-left transition ${
                  blocked ? 'cursor-not-allowed opacity-50' : 'card-hover'
                }`}
              >
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${o.tone}`}>
                  <Icon name={o.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-fg">{t(o.titleKey)}</span>
                  <span className="mt-0.5 block text-xs text-fg-soft">{sub}</span>
                </span>
                <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-fg-faint transition-transform group-hover:translate-x-0.5" />
              </motion.button>
            );
          })}

          {hasName && !authorityChecked && (
            <Notice tone="neutral" icon="signal">{t('arena.authorityChecking')}</Notice>
          )}
          {hasName && authorityChecked && !multiplayerEnabled && (
            <Notice tone="warning" icon="lock">{t('arena.authorityOff')}</Notice>
          )}
        </section>
      </div>
    </div>
  );
}
