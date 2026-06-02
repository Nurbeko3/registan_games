'use client';

import { TEAMS, type TeamId } from '@/lib/arena/types';
import type { RoomPlayer } from '@/lib/arena/network/types';

/** Bottom-of-lobby controls: pick a team, toggle ready, and (host) start. */
export function ReadyPanel({
  players,
  myId,
  isHost,
  onTeam,
  onReady,
  onStart,
}: {
  players: RoomPlayer[];
  myId: string;
  isHost: boolean;
  onTeam: (t: TeamId) => void;
  onReady: (r: boolean) => void;
  onStart: () => void;
}) {
  const me = players.find((p) => p.id === myId);
  const myTeam = me?.team ?? 'red';
  const ready = me?.ready ?? false;
  const everyoneReady = players.length > 0 && players.every((p) => p.ready);

  return (
    <div className="space-y-3">
      {/* team pick */}
      <div className="flex gap-2">
        {(['red', 'blue'] as TeamId[]).map((t) => (
          <button
            key={t}
            onClick={() => onTeam(t)}
            className={`flex-1 rounded-2xl py-2.5 font-display font-extrabold shadow-card transition ${
              myTeam === t ? (t === 'red' ? 'bg-bubble text-white ring-2 ring-grape' : 'bg-sky text-white ring-2 ring-grape') : 'bg-white hover:bg-grape-50'
            }`}
          >
            {TEAMS[t].emoji} {TEAMS[t].name}
          </button>
        ))}
      </div>

      <button
        onClick={() => onReady(!ready)}
        className={`w-full rounded-2xl py-3 font-display text-lg font-extrabold shadow-card transition ${
          ready ? 'bg-mint text-white' : 'bg-white hover:bg-grape-50'
        }`}
      >
        {ready ? "✓ I'm ready!" : 'Tap when ready'}
      </button>

      {isHost && (
        <button
          onClick={onStart}
          className="btn-primary w-full text-lg disabled:opacity-40"
          disabled={players.length === 0}
        >
          {everyoneReady ? '🚀 Start match!' : `Start match (${players.filter((p) => p.ready).length}/${players.length} ready)`}
        </button>
      )}
      {!isHost && <p className="text-center text-sm font-bold text-ink-faint">Waiting for the host to start… 👑</p>}
    </div>
  );
}
