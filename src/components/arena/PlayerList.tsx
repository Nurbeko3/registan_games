'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { TEAMS, type TeamId } from '@/lib/arena/types';
import type { RoomPlayer } from '@/lib/arena/network/types';
import { useT } from '@/lib/i18n';

/** Live lobby roster from channel presence — team colour, host crown, ready tick. */
export function PlayerList({ players, myId }: { players: RoomPlayer[]; myId: string }) {
  const t = useT();
  const count = (tm: TeamId) => players.filter((p) => p.team === tm).length;
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <p className="font-display font-extrabold">{t('arena.players')} ({players.length})</p>
        <span className="text-xs font-bold text-ink-faint">
          {TEAMS.red.emoji} {count('red')} · {TEAMS.blue.emoji} {count('blue')}
        </span>
      </div>
      <ul className="mt-3 grid gap-2">
        <AnimatePresence initial={false}>
          {players.map((p) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="flex items-center gap-2 rounded-2xl bg-grape-50/60 px-3 py-2"
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.team === 'red' ? 'bg-bubble' : 'bg-sky'}`} />
              <span className="text-xl">{p.avatar}</span>
              <span className="flex-1 truncate font-bold">
                {p.name}
                {p.id === myId && <span className="ml-1 text-xs text-ink-faint">{t('common.you')}</span>}
              </span>
              {p.isHost && <span title="Host" className="text-sm">👑</span>}
              <span className={`text-sm ${p.ready ? 'text-mint-600' : 'text-ink-faint'}`}>{p.ready ? '✓' : '…'}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
