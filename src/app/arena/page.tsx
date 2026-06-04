'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { ArenaMenu, type MenuChoice } from '@/components/arena/ArenaMenu';
import { PracticeSetup } from '@/components/arena/PracticeSetup';
import { RoomLobby } from '@/components/arena/RoomLobby';
import { JoinRoomModal } from '@/components/arena/JoinRoomModal';
import { makeRoomCode, DEFAULT_SETTINGS, type RoomSettings } from '@/lib/arena/network/types';
import { loadArenaAuthorityStatus } from '@/lib/arena/authority';

type View = 'menu' | 'practice' | 'room';
interface RoomEntry { code: string; isHost: boolean; quick: boolean; clientId: string; settings?: RoomSettings }

const ROOM_SESSION_KEY = 'kcq.arena.room.v1';
const makeClientId = () => Math.random().toString(36).slice(2, 10);

function readSavedRoom(): RoomEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ROOM_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RoomEntry>;
    if (typeof parsed.code !== 'string' || !/^\d{6}$/.test(parsed.code)) return null;
    return {
      code: parsed.code,
      isHost: parsed.isHost === true,
      quick: parsed.quick === true,
      clientId: typeof parsed.clientId === 'string' && parsed.clientId ? parsed.clientId : makeClientId(),
      settings: parsed.settings,
    };
  } catch {
    return null;
  }
}

function saveRoom(room: RoomEntry | null) {
  if (typeof window === 'undefined') return;
  if (!room) sessionStorage.removeItem(ROOM_SESSION_KEY);
  else sessionStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(room));
}

/** Battle Learn Arena hub: Create Room · Join Room · Play vs Bots.
 *  Bots is fully offline; the room flows use Supabase Realtime when cloud is
 *  configured, and a same-device local transport otherwise. */
export default function ArenaPage() {
  const [view, setView] = useState<View>('menu');
  const [modal, setModal] = useState<null | 'create' | 'join'>(null);
  const [room, setRoom] = useState<RoomEntry | null>(null);
  const [multiplayerEnabled, setMultiplayerEnabled] = useState(false);
  const [authorityChecked, setAuthorityChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    loadArenaAuthorityStatus().then((status) => {
      if (!alive) return;
      setMultiplayerEnabled(status.enabled);
      setAuthorityChecked(true);
      if (!status.enabled) saveRoom(null);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!authorityChecked) return;
    if (!multiplayerEnabled) {
      saveRoom(null);
      return;
    }
    const saved = readSavedRoom();
    if (!saved) return;
    setRoom(saved);
    setView('room');
  }, [authorityChecked, multiplayerEnabled]);
  useEffect(() => { saveRoom(room); }, [room]);

  const choose = (c: MenuChoice) => {
    if (c === 'practice') setView('practice');
    else if (!multiplayerEnabled) return;
    // Create goes straight to the lobby with defaults — tune length/teams/bots there
    else if (c === 'create') {
      setRoom({ code: makeRoomCode(), isHost: true, quick: false, clientId: makeClientId(), settings: { ...DEFAULT_SETTINGS } });
      setView('room');
    }
    else if (c === 'join') setModal('join');
  };

  const onJoin = (code: string) => {
    setModal(null);
    setRoom({ code, isHost: false, quick: false, clientId: makeClientId() });
    setView('room');
  };

  const updateRoomSettings = useCallback((settings: RoomSettings) => {
    setRoom((r) => (r ? { ...r, settings } : r));
  }, []);

  const toMenu = () => { setRoom(null); setView('menu'); };

  return (
    <main id="main" className={`min-h-screen pb-24 ${view === 'menu' ? 'dotted' : ''}`}>
      <TopBar />

      {view === 'menu' && <ArenaMenu onSelect={choose} multiplayerEnabled={multiplayerEnabled} authorityChecked={authorityChecked} />}
      {view === 'practice' && <PracticeSetup onBack={toMenu} />}
      {view === 'room' && room && (
        <RoomLobby
          code={room.code}
          isHost={room.isHost}
          clientId={room.clientId}
          quick={room.quick}
          settings={room.settings}
          onSettingsChange={updateRoomSettings}
          onLeave={toMenu}
        />
      )}

      <AnimatePresence>
        {modal === 'join' && <JoinRoomModal onJoin={onJoin} onClose={() => setModal(null)} />}
      </AnimatePresence>
    </main>
  );
}
