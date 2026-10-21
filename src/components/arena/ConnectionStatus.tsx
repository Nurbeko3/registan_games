'use client';

import type { ConnectionState } from '@/lib/arena/network/types';
import { useT } from '@/lib/i18n';

/** Tiny status pill for a room — connection health + whether it's real cloud
 *  multiplayer or the same-device local test transport. */
export function ConnectionStatus({ connection, kind }: { connection: ConnectionState; kind: 'cloud' | 'local' }) {
  const t = useT();
  const map: Record<ConnectionState, { label: string; dot: string; cls: string }> = {
    connecting: { label: t('arena.conn.connecting'), dot: 'bg-amber-500', cls: 'bg-amber-50 text-amber-700' },
    connected: kind === 'cloud'
      ? { label: t('arena.conn.online'), dot: 'bg-success-500', cls: 'bg-success-50 text-success-700' }
      : { label: t('arena.conn.local'), dot: 'bg-info-500', cls: 'bg-info-50 text-info-700' },
    error: { label: t('arena.conn.offline'), dot: 'bg-fg-faint', cls: 'bg-surface-3 text-fg-soft' },
    offline: { label: t('arena.conn.offline'), dot: 'bg-fg-faint', cls: 'bg-surface-3 text-fg-soft' },
  };
  const s = map[connection];
  return (
    <span className={`chip ${s.cls}`} role="status">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${connection === 'connecting' ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  );
}
