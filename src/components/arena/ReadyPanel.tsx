'use client';

import { type TeamId } from '@/lib/arena/types';
import type { RoomPlayer } from '@/lib/arena/network/types';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Primitives';
import { useT } from '@/lib/i18n';

const TEAM_STYLE: Record<TeamId, { active: string; dot: string }> = {
  red: { active: 'border-danger-500 bg-danger-50 text-danger-700', dot: 'bg-danger-500' },
  blue: { active: 'border-info-500 bg-info-50 text-info-700', dot: 'bg-info-500' },
};

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
        <Notice tone="warning" icon="eye">
          <span className="block font-bold">{t('lobby.youObserve')}</span>
          <span className="block text-xs font-medium opacity-90">{t('lobby.youObserveBody')}</span>
        </Notice>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('lobby.teamSize')}>
            {(['red', 'blue'] as TeamId[]).map((tm) => {
              const active = myTeam === tm;
              return (
                <button
                  key={tm}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onTeam(tm)}
                  className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition ${
                    active ? TEAM_STYLE[tm].active : 'border-border bg-surface text-fg-soft hover:border-border-strong hover:bg-surface-2'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${TEAM_STYLE[tm].dot}`} />
                  {t(`team.${tm}`)}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onReady(!ready)}
            aria-pressed={ready}
            className={`w-full ${ready ? 'btn-success' : 'btn-secondary'}`}
          >
            {ready && <Icon name="check" className="h-4 w-4" />}
            {ready ? t('lobby.imReady') : t('lobby.tapReady')}
          </button>
        </>
      )}

      {/* who's not ready yet — the match can't start until this list is empty */}
      {!enoughPlayers && (
        <Notice tone="neutral" icon="users">
          <span className="block font-bold text-fg">{t('lobby.needPlayers')}</span>
          <span className="block text-xs">{t('lobby.needPlayersBody')}</span>
        </Notice>
      )}

      {enoughPlayers && unready.length > 0 && (
        <div className="rounded-xl border border-border bg-surface-2 px-3.5 py-3">
          <p className="eyebrow">{t('lobby.waitingFor')}</p>
          <ul className="mt-2 space-y-1.5">
            {unready.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm font-semibold text-fg-soft">
                <span className={`h-1.5 w-1.5 rounded-full ${TEAM_STYLE[p.team].dot}`} />
                <span className="flex-1 truncate">{p.name}{p.id === myId ? ` ${t('common.you')}` : ''}</span>
                <span className="badge-neutral normal-case tracking-normal">{t('lobby.notReady')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isHost ? (
        <button type="button" onClick={onStart} disabled={!allReady} className="btn-primary btn-lg w-full">
          {allReady && <Icon name="play" className="h-4 w-4 [&>path]:fill-current" />}
          {allReady ? t('lobby.startMatch') : t('lobby.cantStart')}
        </button>
      ) : (
        <p className="text-center text-sm font-medium text-fg-faint">{t('lobby.waitingHost')}</p>
      )}
    </div>
  );
}
