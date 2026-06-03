'use client';

import { useEffect, useRef, useState } from 'react';
import { RoomService, type RoomOptions, type RoomState } from './roomService';
import type { RoomSettings, NetEvent, NetEventType } from './types';
import type { TeamId } from '@/lib/arena/types';

/** React binding for a Battle Learn Arena room. Connects on mount, exposes the
 *  live RoomState + the lobby actions, and cleanly leaves on unmount. */
export function useArenaRoom(code: string, opts: RoomOptions) {
  const [state, setState] = useState<RoomState | null>(null);
  const svcRef = useRef<RoomService | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const svc = new RoomService(code, optsRef.current);
    svcRef.current = svc;
    const unsub = svc.subscribe(setState);
    void svc.connect();
    return () => { unsub(); svc.leave(); svcRef.current = null; };
  }, [code]);

  return {
    state,
    setReady: (r: boolean) => svcRef.current?.setReady(r),
    setTeam: (t: TeamId) => svcRef.current?.setTeam(t),
    updateSettings: (p: Partial<RoomSettings>) => svcRef.current?.updateSettings(p),
    start: () => svcRef.current?.start(),
    /** host-only: mirror the authoritative live score to all clients. */
    reportScores: (red: number, blue: number) => svcRef.current?.reportScores(red, blue),
    /** host-only: end the match with the final authoritative score. */
    reportEnd: (red: number, blue: number) => svcRef.current?.reportEnd(red, blue),
    /** M2: send an in-match event (move/shoot/down/respawn). */
    sendNet: (t: NetEventType, data: NetEvent['data']) => svcRef.current?.sendNet(t, data),
    /** M2: drain remote in-match events to apply this frame. */
    drainNet: (): NetEvent[] => svcRef.current?.drainNet() ?? [],
  };
}
