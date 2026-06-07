'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/store/useGame';
import { useArenaRoom } from '@/lib/arena/network/useArenaRoom';
import { TEAM_SIZES, getMode } from '@/data/arenaModes';
import { ARENA_MAPS, getMap } from '@/data/arenaMaps';
import { DIFFICULTIES } from './PracticeSetup';
import type { RoomSettings } from '@/lib/arena/network/types';
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
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <motion.div animate={{ rotate: [0, 12, -12, 0] }} transition={{ duration: 1.6, repeat: Infinity }} className="text-4xl">🔍</motion.div>
        <p className="mt-3 font-display font-extrabold text-ink-soft">{t('lobby.lookingForRoom')}</p>
        <button onClick={leaveRoom} className="btn-ghost mt-5 px-4 py-2 text-sm">← {t('hud.leave')}</button>
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
        <div className="mx-auto max-w-md px-4 py-8">
          <div className="rounded-[28px] border border-grape-100 bg-white p-6 text-center shadow-soft">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-grape-50 text-3xl">⏱</div>
            <p className="mt-3 font-display text-xl font-extrabold">{t('arena.matchAlreadyStarted')}</p>
            <p className="mt-2 text-sm font-bold text-ink-soft">{t('arena.matchAlreadyStartedBody')}</p>
            <button onClick={leaveRoom} className="btn-primary mt-5 w-full">← {t('hud.leave')}</button>
          </div>
        </div>
      );
    }
    const cfg = {
      mode: getMode(s.settings.modeId),
      perTeam: s.settings.perTeam,
      hero,
      obstacles: getMap(s.settings.mapId).obstacles,
      difficulty: s.settings.difficulty,
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
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="card text-center">
          <div className="text-4xl">{hostLeft ? '👋' : notFound ? '🚫' : '📡'}</div>
          <p className="mt-2 font-display font-extrabold">{hostLeft ? t('arena.hostLeftTitle') : notFound ? t('arena.invalidTitle') : t('arena.cloudTitle')}</p>
          <p className="mt-1 text-ink-soft">{hostLeft ? t('arena.hostLeftBody') : notFound ? t('arena.invalidBody') : t('arena.cloudBody')}</p>
          <button onClick={leaveRoom} className="btn-primary mt-4">← {t('hud.leave')}</button>
        </div>
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
    <div className="mx-auto max-w-md px-4 py-5">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={leaveRoom} className="btn-ghost px-3 py-1.5 text-sm">← {t('hud.leave')}</button>
        <ConnectionStatus connection={s.connection} kind={s.kind} />
      </div>

      <div className="rounded-[28px] border border-grape-100 bg-white p-5 text-center shadow-soft">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-grape-50 text-2xl">#</div>
        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-ink-faint">{t('lobby.roomCode')}</p>
        <button
          type="button"
          onClick={copyCode}
          className="mt-2 w-full rounded-3xl bg-grape-50 px-4 py-4 font-display text-5xl font-extrabold tracking-[0.22em] text-grape shadow-inner transition hover:bg-grape-100"
          aria-label={t('lobby.roomCode')}
        >
          {code}
        </button>
        <p className="mt-2 text-sm font-bold text-ink-soft">{copiedCode ? t('lobby.codeCopied') : t('lobby.shareCode')}</p>
      </div>

      <div className="mt-4">
        <PlayerList players={s.players} myId={s.myId} />
      </div>

      {/* settings — editable by host, read-only otherwise */}
      <div className="card mt-4">
        <p className="font-display font-extrabold">
          {t('lobby.settings')} {s.isHost && <span className="text-xs text-grape">{t('lobby.youreHost')}</span>}
        </p>

        <SettingRow label="Map">
          <Pills
            items={ARENA_MAPS.map((m) => ({ id: m.id, label: `${m.emoji} ${m.name} · ${m.size} · ${m.challenge}` }))}
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

      <WeaponLoadout value={weapon} onChange={setWeapon} compact />

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
