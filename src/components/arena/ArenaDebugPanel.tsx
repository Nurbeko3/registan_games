'use client';

import { useState } from 'react';
import type { ConnectionState } from '@/lib/arena/network/types';

/** Everything the multiplayer diagnostics overlay shows. The KEY proof that
 *  "one room = one shared match" is that matchId + seed are IDENTICAL across
 *  every player's panel. */
export interface ArenaDebugInfo {
  roomCode: string;
  matchId: string | null;
  hostId: string | null;
  myId: string;
  isHost: boolean;
  playerCount: number;
  seed: number | null;
  connection: ConnectionState;
  kind: 'cloud' | 'local';
  version: number;
  scores: { red: number; blue: number } | null;
  lastEvent: { name: string; at: number } | null;
}

const DOT: Record<ConnectionState, string> = {
  offline: 'bg-ink-faint',
  connecting: 'bg-mango',
  connected: 'bg-mint',
  error: 'bg-bubble',
};

/** Collapsible diagnostics overlay for Battle Learn Arena multiplayer.
 *  Pinned to a corner; tap the chip to expand. Render only when networked. */
export function ArenaDebugPanel({ info }: { info: ArenaDebugInfo }) {
  const [open, setOpen] = useState(false);
  const ago = info.lastEvent ? `${Math.max(0, Math.round((Date.now() - info.lastEvent.at) / 100) / 10)}s` : '—';

  return (
    <div className="pointer-events-auto absolute left-2 top-2 z-30 font-mono text-[10px] leading-tight">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full bg-ink/80 px-2.5 py-1 font-bold text-white shadow"
      >
        <span className={`h-2 w-2 rounded-full ${DOT[info.connection]}`} />
        NET {open ? '▾' : '▸'}
      </button>

      {open && (
        <div className="mt-1 w-[208px] space-y-0.5 rounded-lg bg-ink/85 p-2 text-white shadow-card">
          <Row k="Room" v={info.roomCode} />
          <Row k="Match" v={info.matchId ?? '—'} highlight />
          <Row k="Seed" v={info.seed == null ? '—' : String(info.seed)} highlight />
          <Row k="Host" v={`${short(info.hostId)}${info.isHost ? ' (me)' : ''}`} />
          <Row k="Me" v={short(info.myId)} />
          <Row k="Players" v={String(info.playerCount)} />
          <Row k="Transport" v={`${info.kind} · ${info.connection}`} />
          <Row k="Score" v={info.scores ? `🔴${info.scores.red} 🔵${info.scores.blue}` : '—'} />
          <Row k="Ping" v="— (M2)" />
          <Row k="Version" v={String(info.version)} />
          <Row k="Last evt" v={info.lastEvent ? `${info.lastEvent.name} · ${ago}` : '—'} />
        </div>
      )}
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/55">{k}</span>
      <span className={`truncate ${highlight ? 'font-extrabold text-mango' : 'text-white'}`}>{v}</span>
    </div>
  );
}

const short = (id: string | null) => (id ? id.slice(0, 6) : '—');
