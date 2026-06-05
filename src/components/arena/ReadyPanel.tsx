'use client';

import { TEAMS, type TeamId } from '@/lib/arena/types';
import type { RoomPlayer } from '@/lib/arena/network/types';
import { useT } from '@/lib/i18n';

/** Bottom-of-lobby controls: pick a team, toggle ready, and (host) start.
 *  The host CANNOT start until every joined player is ready — the panel lists
 *  exactly who is still holding things up. */
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
  const t = useT();
  const me = players.find((p) => p.id === myId);
  const activePlayers = players.filter((p) => !(p.isHost && p.role === 'observer'));
  const isObserverHost = isHost && me?.isHost && me.role === 'observer';
  const myTeam = me?.team ?? 'red';
  const ready = me?.ready ?? false;
  const unready = activePlayers.filter((p) => !p.ready);
  const enoughPlayers = activePlayers.length >= 2;
  const allReady = enoughPlayers && unready.length === 0;

  return (
    <div className="space-y-3">
      {/* team pick */}
      {isObserverHost ? (
        <div className="rounded-2xl bg-sun/15 p-3 text-center ring-1 ring-sun/40">
          <p className="font-display font-extrabold text-mango">{t('lobby.youObserve')}</p>
          <p className="mt-1 text-xs font-bold text-ink-soft">{t('lobby.youObserveBody')}</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            {(['red', 'blue'] as TeamId[]).map((tm) => (
              <button
                key={tm}
                onClick={() => onTeam(tm)}
                className={`flex-1 rounded-2xl py-2.5 font-display font-extrabold shadow-card transition ${
                  myTeam === tm ? (tm === 'red' ? 'bg-bubble text-white ring-2 ring-grape' : 'bg-sky text-white ring-2 ring-grape') : 'bg-white hover:bg-grape-50'
                }`}
              >
                {TEAMS[tm].emoji} {TEAMS[tm].name}
              </button>
            ))}
          </div>

          <button
            onClick={() => onReady(!ready)}
            className={`w-full rounded-2xl py-3 font-display text-lg font-extrabold shadow-card transition ${
              ready ? 'bg-mint text-white' : 'bg-white hover:bg-grape-50'
            }`}
          >
            {ready ? `✓ ${t('lobby.imReady')}` : t('lobby.tapReady')}
          </button>
        </>
      )}

      {/* who's not ready yet — the match can't start until this list is empty */}
      {!enoughPlayers && (
        <div className="rounded-2xl bg-bubble/10 p-3 ring-1 ring-bubble/30">
          <p className="text-xs font-extrabold uppercase tracking-wide text-bubble-600">⏳ {t('lobby.needPlayers')}</p>
          <p className="mt-1 text-sm font-bold text-ink-soft">{t('lobby.needPlayersBody')}</p>
        </div>
      )}

      {enoughPlayers && unready.length > 0 && (
        <div className="rounded-2xl bg-bubble/10 p-3 ring-1 ring-bubble/30">
          <p className="text-xs font-extrabold uppercase tracking-wide text-bubble-600">⏳ {t('lobby.waitingFor')}</p>
          <ul className="mt-1.5 space-y-1">
            {unready.map((p) => (
              <li key={p.id} className="flex items-center gap-1.5 text-sm font-bold text-ink-soft">
                <span>{TEAMS[p.team].emoji}</span>
                <span className="flex-1">{p.name}{p.id === myId ? ` ${t('common.you')}` : ''}</span>
                <span className="rounded-full bg-bubble/15 px-2 py-0.5 text-[11px] font-extrabold text-bubble-600">{t('lobby.notReady')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isHost ? (
        <button
          onClick={onStart}
          disabled={!allReady}
          className="btn-primary w-full text-lg disabled:opacity-40"
        >
          {allReady ? `🚀 ${t('lobby.startMatch')}` : t('lobby.cantStart')}
        </button>
      ) : (
        <p className="text-center text-sm font-bold text-ink-faint">{t('lobby.waitingHost')}</p>
      )}
    </div>
  );
}
