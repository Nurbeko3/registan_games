'use client';

import type { ConnectionState } from '@/lib/arena/network/types';

/** Tiny status pill for a room — connection health + whether it's real cloud
 *  multiplayer or the same-device local test transport. */
export function ConnectionStatus({ connection, kind }: { connection: ConnectionState; kind: 'cloud' | 'local' }) {
  const map: Record<ConnectionState, { label: string; dot: string; cls: string }> = {
    connecting: { label: 'Connecting…', dot: 'bg-sun', cls: 'bg-sun/20 text-mango-600' },
    connected: kind === 'cloud'
      ? { label: 'Online', dot: 'bg-mint', cls: 'bg-mint/20 text-mint-600' }
      : { label: 'Local test', dot: 'bg-sky', cls: 'bg-sky/20 text-sky-600' },
    error: { label: 'Offline', dot: 'bg-ink-faint', cls: 'bg-ink/10 text-ink-faint' },
    offline: { label: 'Offline', dot: 'bg-ink-faint', cls: 'bg-ink/10 text-ink-faint' },
  };
  const s = map[connection];
  return (
    <span className={`chip ${s.cls} inline-flex items-center gap-1.5`}>
      <span className={`h-2 w-2 rounded-full ${s.dot} ${connection === 'connecting' ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  );
}
