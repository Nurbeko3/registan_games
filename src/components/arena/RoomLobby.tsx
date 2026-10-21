'use client';

import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/store/useGame';
import { useArenaRoom } from '@/lib/arena/network/useArenaRoom';
import { TEAM_SIZES, getMode } from '@/data/arenaModes';
import { ARENA_MAPS, getMap } from '@/data/arenaMaps';
import { DIFFICULTIES } from './PracticeSetup';
import { Pills, SettingRow } from './CreateRoomModal';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Spinner, Switch } from '@/components/ui/Primitives';
import type { RoomSettings } from '@/lib/arena/network/types';
import { GRADES, type Grade } from '@/lib/arena/types';
import type { ArenaDifficulty } from '@/lib/arena/engine';
import { useT } from '@/lib/i18n';
import { ArenaGame, type ArenaNet } from './ArenaGame';
import { ConnectionStatus } from './ConnectionStatus';
import { PlayerList } from './PlayerList';
import { ReadyPanel } from './ReadyPanel';
import { MatchLengthInput } from './MatchLengthInput';
import { WeaponLoadout } from './WeaponLoadout';
import { DEFAULT_WEAPON, type WeaponId } from '@/lib/arena/weapons';

/** The custom-room / quick-match lobby. Shows live players, lets the host tune
 *  settings, and hands off into ArenaGame when the match starts. */
export function RoomLobby({
  code,
  isHost,
  clientId,
  quick,
  hostRole,
  settings,
  initialWeapon,
  onSettingsChange,
  onWeaponChange,
  onLeave,
}: {
  code: string;
  isHost: boolean;
  clientId: string;
  quick?: boolean;
  hostRole?: 'player' | 'observer';
  settings?: RoomSettings;
  initialWeapon?: WeaponId;
  onSettingsChange?: (settings: RoomSettings) => void;
  onWeaponChange?: (weapon: WeaponId) => void;
  onLeave: () => void;
}) {
  const t = useT();
  const playerName = useGame((s) => s.playerName);
  const arenaAvatar = useGame((s) => s.arenaAvatar);
  const hero = { name: playerName || 'You', avatar: arenaAvatar };
  const [weapon, setWeapon] = useState<WeaponId>(initialWeapon ?? DEFAULT_WEAPON);
  const [copiedCode, setCopiedCode] = useState(false);

  const room = useArenaRoom(code, { name: hero.name, avatar: hero.avatar, isHost, clientId, quick, settings, hostRole });
  const s = room.state;

  // Only propagate settings when their values actually change, not just the
  // object reference, to avoid setRoom churn in the parent on every snapshot.
  const lastSettingsJsonRef = useRef<string | null>(null);
  useEffect(() => {
    if (!s?.settings) return;
    const json = JSON.stringify(s.settings);
    if (json === lastSettingsJsonRef.current) return;
    lastSettingsJsonRef.current = json;
    onSettingsChange?.(s.settings);
  }, [onSettingsChange, s?.settings]);

  useEffect(() => {
    onWeaponChange?.(weapon);
  }, [onWeaponChange, weapon]);

  useEffect(() => {
    if (s?.phase === 'error' && s.errorReason === 'hostleft') {
      const id = window.setTimeout(onLeave, 900);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [onLeave, s?.errorReason, s?.phase]);

  const leaveRoom = () => {
    if (s?.isHost) room.closeRoom();
    onLeave();
  };

  // joiner stays here until the host is confirmed (or it times out → error)
  if (!s || s.phase === 'connecting') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <Spinner className="h-8 w-8" label={t('lobby.lookingForRoom')} />
        <p className="mt-4 text-sm font-semibold text-fg-soft">{t('lobby.lookingForRoom')}</p>
        <button type="button" onClick={leaveRoom} className="btn-secondary btn-sm mt-5">
          <Icon name="arrowLeft" className="h-4 w-4" /> {t('hud.leave')}
        </button>
      </div>
    );
  }

  // ── match running → hand off to the engine (ONE shared match) ──
  // Every client builds the identical arena from the host's seed, and the host
  // drives the authoritative score/end. This is what makes one room = one match.
  if (s.phase === 'playing') {
    const joinedBeforeStart = s.roster.length === 0 || s.roster.some((p) => p.netId === s.myId);
    if (!joinedBeforeStart && !s.isHost) {
      return (
        <div className="mx-auto max-w-md px-4 py-10">
          <EmptyState
            icon="timer"
            tone="brand"
            title={t('arena.matchAlreadyStarted')}
            description={t('arena.matchAlreadyStartedBody')}
            action={<button type="button" onClick={leaveRoom} className="btn-primary"><Icon name="arrowLeft" className="h-4 w-4" /> {t('hud.leave')}</button>}
          />
        </div>
      );
    }
    const cfg = {
      mode: getMode(s.settings.modeId),
      perTeam: s.settings.perTeam,
      hero,
      obstacles: getMap(s.settings.mapId).obstacles,
      difficulty: s.settings.difficulty,
      grade: s.settings.grade,
      durationSec: s.settings.durationSec,
      botFill: s.settings.botFill,
      seed: s.seed ?? undefined,
      initialWeapon: weapon,
      onExit: leaveRoom,
    };
    const net: ArenaNet = {
      isHost: s.isHost,
      scores: s.liveScores,
      ended: s.matchEnd,
      onScores: room.reportScores,
      onEnd: room.reportEnd,
      onExit: leaveRoom,
      myNetId: s.myId,
      roster: s.roster,
      spectator: s.isHost && !s.roster.some((p) => p.netId === s.myId),
      sendNet: room.sendNet,
      drainNet: room.drainNet,
      debug: {
        roomCode: code,
        matchId: s.matchId,
        hostId: s.players.find((p) => p.isHost)?.id ?? null,
        myId: s.myId,
        isHost: s.isHost,
        playerCount: s.players.length,
        seed: s.seed,
        connection: s.connection,
        kind: s.kind,
        version: s.settings.v,
        phase: s.phase,
        mapId: s.settings.mapId,
        difficulty: s.settings.difficulty,
        durationSec: s.settings.durationSec,
        roster: s.roster.map((p) => ({ id: p.netId, team: p.team })),
        scores: s.liveScores,
        lastEvent: s.lastEvent,
      },
    };
    return <ArenaGame config={cfg} net={net} />;
  }

  if (s.phase === 'error') {
    const notFound = s.errorReason === 'notfound';
    const hostLeft = s.errorReason === 'hostleft';
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <EmptyState
          icon={hostLeft ? 'logout' : notFound ? 'warning' : 'signal'}
          tone={hostLeft ? 'neutral' : 'danger'}
          title={hostLeft ? t('arena.hostLeftTitle') : notFound ? t('arena.invalidTitle') : t('arena.cloudTitle')}
          description={hostLeft ? t('arena.hostLeftBody') : notFound ? t('arena.invalidBody') : t('arena.cloudBody')}
          action={<button type="button" onClick={leaveRoom} className="btn-primary"><Icon name="arrowLeft" className="h-4 w-4" /> {t('hud.leave')}</button>}
        />
      </div>
    );
  }

  const counting = s.phase === 'countdown';
  const set = (patch: Partial<RoomSettings>) => room.updateSettings(patch);
  const copyCode = async () => {
    try {
      await navigator.clipboard?.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1400);
    } catch {
      setCopiedCode(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button type="button" onClick={leaveRoom} className="btn-secondary btn-sm">
          <Icon name="arrowLeft" className="h-4 w-4" /> {t('hud.leave')}
        </button>
        <ConnectionStatus connection={s.connection} kind={s.kind} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
        {/* ── left: code + players + ready ── */}
        <div className="space-y-4">
          <div className="card">
            <p className="eyebrow">{t('lobby.roomCode')}</p>
            <div className="mt-2 flex items-center gap-2">
              <code
                className="flex-1 select-all rounded-xl border border-border bg-surface-2 px-4 py-3 text-center font-mono text-3xl font-bold tracking-[0.3em] text-fg"
                aria-label={t('lobby.roomCode')}
              >
                {code}
              </code>
              <button
                type="button"
                onClick={copyCode}
                className={`btn-secondary btn-icon h-[58px] w-[58px] ${copiedCode ? 'text-success-600' : ''}`}
                aria-label={t('lobby.codeCopied')}
                title={t('lobby.codeCopied')}
              >
                <Icon name={copiedCode ? 'check' : 'copy'} className="h-5 w-5" />
              </button>
            </div>
            <p className={`help ${copiedCode ? 'text-success-600' : ''}`}>{copiedCode ? t('lobby.codeCopied') : t('lobby.shareCode')}</p>
          </div>

          <PlayerList players={s.players} myId={s.myId} />

          {counting ? (
            <div className="card text-center">
              <Spinner className="mx-auto h-6 w-6" label={t('lobby.starting')} />
              <p className="mt-3 font-display text-lg font-extrabold text-fg">{t('lobby.getReady')}</p>
              <p className="text-sm text-fg-soft">{t('lobby.starting')}</p>
            </div>
          ) : (
            <ReadyPanel
              players={s.players}
              myId={s.myId}
              isHost={s.isHost}
              onTeam={room.setTeam}
              onReady={room.setReady}
              onStart={room.start}
            />
          )}
        </div>

        {/* ── right: settings (host-editable) + loadout ── */}
        <div>
          <div className="card">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-fg">{t('lobby.settings')}</p>
              {s.isHost ? <span className="badge-brand">{t('lobby.youreHost')}</span> : <span className="badge-neutral"><Icon name="lock" className="h-3 w-3" /> {t('lobby.waitingHost')}</span>}
            </div>

            <div className="mt-3">
              <SettingRow label={t('arena.map')}>
                <Pills
                  items={ARENA_MAPS.map((m) => ({ id: m.id, label: `${m.name} · ${m.size} · ${m.challenge}` }))}
                  value={s.settings.mapId}
                  disabled={!s.isHost}
                  onPick={(id) => set({ mapId: id })}
                />
              </SettingRow>

              <SettingRow label={t('lobby.teamSize')}>
                <Pills
                  items={TEAM_SIZES.map((tz) => ({ id: String(tz.perTeam), label: tz.label }))}
                  value={String(s.settings.perTeam)}
                  disabled={!s.isHost}
                  onPick={(id) => set({ perTeam: Number(id) })}
                />
              </SettingRow>

              <SettingRow label={t('lobby.botDifficulty')}>
                <Pills
                  items={DIFFICULTIES.map((d) => ({ id: d.id, label: d.label }))}
                  value={s.settings.difficulty}
                  disabled={!s.isHost}
                  onPick={(id) => set({ difficulty: id as ArenaDifficulty })}
                />
              </SettingRow>

              <SettingRow label={t('arena.grade')}>
                <Pills
                  items={[
                    { id: 'all', label: t('arena.gradeAll') },
                    ...GRADES.map((g) => ({ id: String(g), label: t('arena.gradeN', { n: g }) })),
                  ]}
                  value={s.settings.grade == null ? 'all' : String(s.settings.grade)}
                  disabled={!s.isHost}
                  onPick={(id) => set({ grade: id === 'all' ? undefined : (Number(id) as Grade) })}
                />
              </SettingRow>

              <SettingRow label={t('lobby.matchLength')}>
                <MatchLengthInput
                  durationSec={s.settings.durationSec}
                  disabled={!s.isHost}
                  onChange={(sec) => set({ durationSec: sec })}
                />
              </SettingRow>

              <div className={`mt-3 rounded-xl border border-border ${s.isHost ? '' : 'pointer-events-none opacity-60'}`}>
                <Switch checked={s.settings.botFill} onChange={(v) => set({ botFill: v })} label={t('lobby.fillBots')} icon="bot" />
              </div>
            </div>
          </div>

          <WeaponLoadout value={weapon} onChange={setWeapon} compact />
        </div>
      </div>
    </div>
  );
}
