'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/store/useGame';
import { useArenaRoom } from '@/lib/arena/network/useArenaRoom';
import { TEAM_SIZES, getMode } from '@/data/arenaModes';
import { getMap } from '@/data/arenaMaps';
import { DIFFICULTIES } from './PracticeSetup';
import type { RoomSettings } from '@/lib/arena/network/types';
import type { ArenaDifficulty } from '@/lib/arena/engine';
import { useT } from '@/lib/i18n';
import { ArenaGame, type ArenaNet } from './ArenaGame';
import { ConnectionStatus } from './ConnectionStatus';
import { PlayerList } from './PlayerList';
import { ReadyPanel } from './ReadyPanel';
import { MatchLengthInput } from './MatchLengthInput';

/** The custom-room / quick-match lobby. Shows live players, lets the host tune
 *  settings, and hands off into ArenaGame when the match starts. */
export function RoomLobby({
  code,
  isHost,
  clientId,
  quick,
  settings,
  onSettingsChange,
  onLeave,
}: {
  code: string;
  isHost: boolean;
  clientId: string;
  quick?: boolean;
  settings?: RoomSettings;
  onSettingsChange?: (settings: RoomSettings) => void;
  onLeave: () => void;
}) {
  const t = useT();
  const playerName = useGame((s) => s.playerName);
  const arenaAvatar = useGame((s) => s.arenaAvatar);
  const hero = { name: playerName || 'You', avatar: arenaAvatar };

  const room = useArenaRoom(code, { name: hero.name, avatar: hero.avatar, isHost, clientId, quick, settings });
  const s = room.state;

  useEffect(() => {
    if (s?.settings) onSettingsChange?.(s.settings);
  }, [onSettingsChange, s?.settings]);

  // joiner stays here until the host is confirmed (or it times out → error)
  if (!s || s.phase === 'connecting') {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <motion.div animate={{ rotate: [0, 12, -12, 0] }} transition={{ duration: 1.6, repeat: Infinity }} className="text-4xl">🔍</motion.div>
        <p className="mt-3 font-display font-extrabold text-ink-soft">{t('lobby.lookingForRoom')}</p>
        <button onClick={onLeave} className="btn-ghost mt-5 px-4 py-2 text-sm">← {t('hud.leave')}</button>
      </div>
    );
  }

  // ── match running → hand off to the engine (ONE shared match) ──
  // Every client builds the identical arena from the host's seed, and the host
  // drives the authoritative score/end. This is what makes one room = one match.
  if (s.phase === 'playing') {
    const cfg = {
      mode: getMode(s.settings.modeId),
      perTeam: s.settings.perTeam,
      hero,
      obstacles: getMap(s.settings.mapId).obstacles,
      difficulty: s.settings.difficulty,
      durationSec: s.settings.durationSec,
      botFill: s.settings.botFill,
      seed: s.seed ?? undefined,
    };
    const net: ArenaNet = {
      isHost: s.isHost,
      scores: s.liveScores,
      ended: s.matchEnd,
      onScores: room.reportScores,
      onEnd: room.reportEnd,
      onExit: onLeave,
      myNetId: s.myId,
      roster: s.roster,
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
        scores: s.liveScores,
        lastEvent: s.lastEvent,
      },
    };
    return <ArenaGame config={cfg} net={net} />;
  }

  if (s.phase === 'error') {
    const notFound = s.errorReason === 'notfound';
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="card text-center">
          <div className="text-4xl">{notFound ? '🚫' : '📡'}</div>
          <p className="mt-2 font-display font-extrabold">{notFound ? t('arena.invalidTitle') : t('arena.cloudTitle')}</p>
          <p className="mt-1 text-ink-soft">{notFound ? t('arena.invalidBody') : t('arena.cloudBody')}</p>
          <button onClick={onLeave} className="btn-primary mt-4">← {t('hud.leave')}</button>
        </div>
      </div>
    );
  }

  const counting = s.phase === 'countdown';
  const set = (patch: Partial<RoomSettings>) => room.updateSettings(patch);

  return (
    <div className="mx-auto max-w-md px-4 py-5">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={onLeave} className="btn-ghost px-3 py-1.5 text-sm">← {t('hud.leave')}</button>
        <ConnectionStatus connection={s.connection} kind={s.kind} />
      </div>

      {/* room code */}
      <div className="card text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">{t('lobby.roomCode')}</p>
        <p className="mt-1 font-display text-4xl font-extrabold tracking-[0.3em] text-grape">{code}</p>
        <p className="mt-1 text-xs text-ink-soft">{t('lobby.shareCode')}</p>
      </div>

      <div className="mt-4">
        <PlayerList players={s.players} myId={s.myId} />
      </div>

      {/* settings — editable by host, read-only otherwise */}
      <div className="card mt-4">
        <p className="font-display font-extrabold">
          {t('lobby.settings')} {s.isHost && <span className="text-xs text-grape">{t('lobby.youreHost')}</span>}
        </p>

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
            items={DIFFICULTIES.map((d) => ({ id: d.id, label: `${d.emoji} ${d.label}` }))}
            value={s.settings.difficulty}
            disabled={!s.isHost}
            onPick={(id) => set({ difficulty: id as ArenaDifficulty })}
          />
        </SettingRow>

        <SettingRow label={t('lobby.matchLength')}>
          <MatchLengthInput
            durationSec={s.settings.durationSec}
            disabled={!s.isHost}
            onChange={(sec) => set({ durationSec: sec })}
          />
        </SettingRow>

        <SettingRow label={t('lobby.fillBots')}>
          <button
            disabled={!s.isHost}
            onClick={() => set({ botFill: !s.settings.botFill })}
            className={`rounded-full px-4 py-1.5 text-sm font-extrabold shadow-card transition disabled:opacity-60 ${
              s.settings.botFill ? 'bg-mint text-white' : 'bg-white text-ink-faint'
            }`}
          >
            {s.settings.botFill ? 'ON' : 'OFF'}
          </button>
        </SettingRow>
      </div>

      <div className="mt-4">
        {counting ? (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="card text-center">
            <p className="font-display text-2xl font-extrabold text-grape">{t('lobby.getReady')}</p>
            <p className="text-ink-soft">{t('lobby.starting')}</p>
          </motion.div>
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
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-bold text-ink-faint">{label}</p>
      {children}
    </div>
  );
}

function Pills({
  items,
  value,
  disabled,
  onPick,
}: {
  items: { id: string; label: string }[];
  value: string;
  disabled?: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <button
          key={it.id}
          disabled={disabled}
          onClick={() => onPick(it.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-extrabold shadow-card transition disabled:opacity-60 ${
            value === it.id ? 'bg-grape text-white' : 'bg-white hover:bg-grape-50'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
