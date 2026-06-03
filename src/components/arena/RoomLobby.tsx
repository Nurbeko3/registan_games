'use client';

import { motion } from 'framer-motion';
import { useGame, getAvatar } from '@/store/useGame';
import { useArenaRoom } from '@/lib/arena/network/useArenaRoom';
import { ARENA_MODES, TEAM_SIZES, getMode } from '@/data/arenaModes';
import { ARENA_MAPS, getMap } from '@/data/arenaMaps';
import { DIFFICULTIES } from './PracticeSetup';
import { MATCH_LENGTHS, type RoomSettings } from '@/lib/arena/network/types';
import type { ArenaDifficulty } from '@/lib/arena/engine';
import { ArenaGame, type ArenaNet } from './ArenaGame';
import { ConnectionStatus } from './ConnectionStatus';
import { PlayerList } from './PlayerList';
import { ReadyPanel } from './ReadyPanel';

/** The custom-room / quick-match lobby. Shows live players, lets the host tune
 *  settings, and hands off into ArenaGame when the match starts. */
export function RoomLobby({
  code,
  isHost,
  quick,
  settings,
  onLeave,
}: {
  code: string;
  isHost: boolean;
  quick?: boolean;
  settings?: RoomSettings;
  onLeave: () => void;
}) {
  const playerName = useGame((s) => s.playerName);
  const avatarId = useGame((s) => s.avatarId);
  const hero = { name: playerName || 'You', avatar: getAvatar(avatarId).emoji };

  const room = useArenaRoom(code, { name: hero.name, avatar: hero.avatar, isHost, quick, settings });
  const s = room.state;

  if (!s) {
    return <div className="mx-auto max-w-md px-4 py-10 text-center text-ink-soft">Connecting…</div>;
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
      seed: s.seed ?? undefined,
    };
    const net: ArenaNet = {
      isHost: s.isHost,
      scores: s.liveScores,
      ended: s.matchEnd,
      onScores: room.reportScores,
      onEnd: room.reportEnd,
      onExit: onLeave,
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
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="card text-center">
          <div className="text-4xl">📡</div>
          <p className="mt-2 font-display font-extrabold">Multiplayer needs the internet</p>
          <p className="mt-1 text-ink-soft">Cloud isn’t set up here. Practice vs Bots works fully offline!</p>
          <button onClick={onLeave} className="btn-primary mt-4">← Back to menu</button>
        </div>
      </div>
    );
  }

  const counting = s.phase === 'countdown';
  const set = (patch: Partial<RoomSettings>) => room.updateSettings(patch);

  return (
    <div className="mx-auto max-w-md px-4 py-5">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={onLeave} className="btn-ghost px-3 py-1.5 text-sm">← Leave</button>
        <ConnectionStatus connection={s.connection} kind={s.kind} />
      </div>

      {/* room code */}
      <div className="card text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">{quick ? 'Quick Match' : 'Room Code'}</p>
        <p className="mt-1 font-display text-4xl font-extrabold tracking-[0.3em] text-grape">{code}</p>
        {!quick && <p className="mt-1 text-xs text-ink-soft">Share this code so friends can join!</p>}
      </div>

      <div className="mt-4">
        <PlayerList players={s.players} myId={s.myId} />
      </div>

      {/* settings — editable by host, read-only otherwise */}
      <div className="card mt-4">
        <p className="font-display font-extrabold">Match settings {s.isHost && <span className="text-xs text-grape">(you’re host 👑)</span>}</p>

        <SettingRow label="Map">
          <Pills
            items={ARENA_MAPS.map((m) => ({ id: m.id, label: `${m.emoji} ${m.name}` }))}
            value={s.settings.mapId}
            disabled={!s.isHost}
            onPick={(id) => set({ mapId: id })}
          />
        </SettingRow>

        <SettingRow label="Mode">
          <Pills
            items={ARENA_MODES.map((m) => ({ id: m.id, label: `${m.emoji} ${m.name}` }))}
            value={s.settings.modeId}
            disabled={!s.isHost}
            onPick={(id) => set({ modeId: id as RoomSettings['modeId'] })}
          />
        </SettingRow>

        <SettingRow label="Team size">
          <Pills
            items={TEAM_SIZES.map((t) => ({ id: String(t.perTeam), label: t.label }))}
            value={String(s.settings.perTeam)}
            disabled={!s.isHost}
            onPick={(id) => set({ perTeam: Number(id) })}
          />
        </SettingRow>

        <SettingRow label="Bot difficulty">
          <Pills
            items={DIFFICULTIES.map((d) => ({ id: d.id, label: `${d.emoji} ${d.label}` }))}
            value={s.settings.difficulty}
            disabled={!s.isHost}
            onPick={(id) => set({ difficulty: id as ArenaDifficulty })}
          />
        </SettingRow>

        <SettingRow label="Match length">
          <Pills
            items={MATCH_LENGTHS.map((m) => ({ id: String(m.sec), label: `⏱ ${m.label}` }))}
            value={String(s.settings.durationSec)}
            disabled={!s.isHost}
            onPick={(id) => set({ durationSec: Number(id) })}
          />
        </SettingRow>

        <SettingRow label="Fill empty slots with bots">
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
            <p className="font-display text-2xl font-extrabold text-grape">Get ready… 🚀</p>
            <p className="text-ink-soft">Match starting!</p>
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
