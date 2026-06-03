'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { ArenaMenu, type MenuChoice } from '@/components/arena/ArenaMenu';
import { PracticeSetup } from '@/components/arena/PracticeSetup';
import { RoomLobby } from '@/components/arena/RoomLobby';
import { JoinRoomModal } from '@/components/arena/JoinRoomModal';
import { makeRoomCode, DEFAULT_SETTINGS, type RoomSettings } from '@/lib/arena/network/types';

type View = 'menu' | 'practice' | 'room';
interface RoomEntry { code: string; isHost: boolean; quick: boolean; settings?: RoomSettings }

/** Battle Learn Arena hub: Create Room · Join Room · Play vs Bots.
 *  Bots is fully offline; the room flows use Supabase Realtime when cloud is
 *  configured, and a same-device local transport otherwise. */
export default function ArenaPage() {
  const [view, setView] = useState<View>('menu');
  const [modal, setModal] = useState<null | 'create' | 'join'>(null);
  const [room, setRoom] = useState<RoomEntry | null>(null);

  const choose = (c: MenuChoice) => {
    if (c === 'practice') setView('practice');
    // Create goes straight to the lobby with defaults — tune length/teams/bots there
    else if (c === 'create') { setRoom({ code: makeRoomCode(), isHost: true, quick: false, settings: { ...DEFAULT_SETTINGS } }); setView('room'); }
    else if (c === 'join') setModal('join');
  };

  const onJoin = (code: string) => {
    setModal(null);
    setRoom({ code, isHost: false, quick: false });
    setView('room');
  };

  const toMenu = () => { setRoom(null); setView('menu'); };

  return (
    <main id="main" className={`min-h-screen pb-24 ${view === 'menu' ? 'dotted' : ''}`}>
      <TopBar />

      {view === 'menu' && <ArenaMenu onSelect={choose} />}
      {view === 'practice' && <PracticeSetup onBack={toMenu} />}
      {view === 'room' && room && (
        <RoomLobby
          code={room.code}
          isHost={room.isHost}
          quick={room.quick}
          settings={room.settings}
          onLeave={toMenu}
        />
      )}

      <AnimatePresence>
        {modal === 'join' && <JoinRoomModal onJoin={onJoin} onClose={() => setModal(null)} />}
      </AnimatePresence>
    </main>
  );
}
