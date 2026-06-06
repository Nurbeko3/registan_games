'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { ArenaMenu, type MenuChoice } from '@/components/arena/ArenaMenu';
import { hasSavedPracticeSession, PracticeSetup } from '@/components/arena/PracticeSetup';
import { RoomLobby } from '@/components/arena/RoomLobby';
import { JoinRoomModal } from '@/components/arena/JoinRoomModal';
import { makeRoomCode, DEFAULT_SETTINGS, type RoomSettings } from '@/lib/arena/network/types';
import { loadArenaAuthorityStatus } from '@/lib/arena/authority';
import { DEFAULT_WEAPON, isWeaponId, type WeaponId } from '@/lib/arena/weapons';

type View = 'menu' | 'practice' | 'room';
type HostRole = 'observer' | 'player';
interface RoomEntry { code: string; isHost: boolean; quick: boolean; clientId: string; settings?: RoomSettings; hostRole?: HostRole; weapon?: WeaponId }

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
      hostRole: parsed.hostRole === 'player' ? 'player' : 'observer',
      weapon: isWeaponId(parsed.weapon) ? parsed.weapon : DEFAULT_WEAPON,
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
  const [modal, setModal] = useState<null | 'hostRole' | 'join'>(null);
  const [room, setRoom] = useState<RoomEntry | null>(null);
  const [multiplayerEnabled, setMultiplayerEnabled] = useState(false);
  const [authorityChecked, setAuthorityChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    loadArenaAuthorityStatus().then((status) => {
      if (!alive) return;
      setMultiplayerEnabled(status.enabled);
      setAuthorityChecked(true);
    });
    return () => { alive = false; };
  }, []);

  // Restore a saved room on refresh BEFORE we ever persist, and do it
  // independently from the authority health probe. A temporary probe failure
  // must not kick an already-playing student out of their room.
  const restoredRef = useRef(false);
  const skipNextPersistRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const saved = readSavedRoom();
    if (saved) {
      skipNextPersistRef.current = true;
      setRoom(saved);
      setView('room');
      return;
    }
    if (hasSavedPracticeSession()) setView('practice');
  }, []);
  // Persist only AFTER the restore attempt — otherwise the mount-time room=null
  // would wipe the saved room before refresh could ever recover it.
  useEffect(() => {
    if (!restoredRef.current) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    saveRoom(room);
  }, [room]);

  const choose = (c: MenuChoice) => {
    if (c === 'practice') setView('practice');
    else if (!multiplayerEnabled) return;
    else if (c === 'create') setModal('hostRole');
    else if (c === 'join') setModal('join');
  };

  const onCreate = (hostRole: HostRole) => {
    setModal(null);
    setRoom({ code: makeRoomCode(), isHost: true, quick: false, clientId: makeClientId(), settings: { ...DEFAULT_SETTINGS }, hostRole });
    setView('room');
  };

  const onJoin = (code: string) => {
    setModal(null);
    setRoom({ code, isHost: false, quick: false, clientId: makeClientId() });
    setView('room');
  };

  const updateRoomSettings = useCallback((settings: RoomSettings) => {
    setRoom((r) => (r ? { ...r, settings } : r));
  }, []);

  const updateRoomWeapon = useCallback((weapon: WeaponId) => {
    setRoom((r) => (r ? { ...r, weapon } : r));
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
          hostRole={room.hostRole}
          settings={room.settings}
          initialWeapon={room.weapon}
          onSettingsChange={updateRoomSettings}
          onWeaponChange={updateRoomWeapon}
          onLeave={toMenu}
        />
      )}

      <AnimatePresence>
        {modal === 'hostRole' && <HostRoleModal onPick={onCreate} onClose={() => setModal(null)} />}
        {modal === 'join' && <JoinRoomModal onJoin={onJoin} onClose={() => setModal(null)} />}
      </AnimatePresence>
    </main>
  );
}

function HostRoleModal({ onPick, onClose }: { onPick: (role: HostRole) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-xl font-extrabold">Host roli</p>
        <p className="mt-1 text-sm font-bold text-ink-soft">Xonani qanday boshqarasiz?</p>
        <div className="mt-4 grid gap-3">
          <button onClick={() => onPick('observer')} className="rounded-2xl bg-grape-50 p-4 text-left shadow-card ring-2 ring-grape">
            <span className="block font-display text-lg font-extrabold text-grape">👁 Kuzatuvchi</span>
            <span className="mt-1 block text-sm font-bold text-ink-soft">Siz o‘ynamaysiz. O‘quvchilar o‘ynaydi, siz kuzatasiz.</span>
          </button>
          <button onClick={() => onPick('player')} className="rounded-2xl bg-white p-4 text-left shadow-card ring-1 ring-grape-100">
            <span className="block font-display text-lg font-extrabold">⚔️ O‘yinchi</span>
            <span className="mt-1 block text-sm font-bold text-ink-soft">Siz ham jamoaga qo‘shilib o‘ynaysiz.</span>
          </button>
        </div>
      </div>
    </div>
  );
}
