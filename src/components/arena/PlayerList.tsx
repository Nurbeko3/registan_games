'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { TEAMS, type TeamId } from '@/lib/arena/types';
import type { RoomPlayer } from '@/lib/arena/network/types';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

const TEAM_DOT: Record<TeamId, string> = { red: 'bg-danger-500', blue: 'bg-info-500' };

/** Live lobby roster from channel presence — team colour, host badge, ready tick. */
export function PlayerList({ players, myId }: { players: RoomPlayer[]; myId: string }) {
  const t = useT();
  const contenders = players.filter((p) => !(p.isHost && p.role === 'observer'));
  const count = (tm: TeamId) => contenders.filter((p) => p.team === tm).length;
  return (
    <div className="panel">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-sm font-bold text-fg">
          {t('arena.players')} <span className="text-fg-faint">({contenders.length})</span>
        </p>
        <span className="inline-flex items-center gap-2.5 text-xs font-semibold text-fg-faint">
          <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${TEAM_DOT.red}`} />{t('team.red')} {count('red')}</span>
          <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${TEAM_DOT.blue}`} />{t('team.blue')} {count('blue')}</span>
        </span>
      </div>
      <ul className="divide-y divide-border">
        <AnimatePresence initial={false}>
          {players.map((p) => {
            const observer = p.isHost && p.role === 'observer';
            return (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${observer ? 'bg-amber-500' : TEAM_DOT[p.team]}`} aria-label={observer ? t('lobby.hostObserver') : TEAMS[p.team].name} />
                <AvatarBadge avatar={p.avatar} className="h-8 w-8 text-lg" rounded="rounded-md" bg="bg-surface-2" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
                  {p.name}
                  {p.id === myId && <span className="ml-1.5 text-xs font-medium text-fg-faint">{t('common.you')}</span>}
                </span>
                {observer && <span className="badge-warning">{t('lobby.hostObserver')}</span>}
                {p.isHost && p.role === 'player' && <span className="badge-brand">Host</span>}
                {!observer && (
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${p.ready ? 'bg-success-50 text-success-600' : 'bg-surface-3 text-fg-faint'}`} aria-label={p.ready ? t('lobby.imReady') : t('lobby.notReady')}>
                    {p.ready ? <Icon name="check" className="h-3.5 w-3.5" /> : <Icon name="clock" className="h-3.5 w-3.5" />}
                  </span>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
